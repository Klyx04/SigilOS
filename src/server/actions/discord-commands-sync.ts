"use server";

import { isSuperAdmin } from "./super-admin-actions";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { SLASH_COMMANDS_CATALOG } from "@/lib/slash-commands-catalog";
import {
    readTicketCustomCommands,
    buildTicketSlashCommandOptions,
    type TicketCustomCommand,
} from "@/lib/tickets/custom-commands";
import {
    buildCommandPermissionEntries,
    isCatalogCommandDeployed,
    resolveTicketCommandRoleIds,
} from "@/lib/discord/command-permissions";
import { rateLimit } from "@/lib/ratelimit";

const DISCORD_API_BASE = "https://discord.com/api/v10";

import { buildDiscordCommandPayloads, type DiscordCommandOption } from "@/lib/discord/command-payloads";


function discordAppId(): string | null {
    return (
        process.env.AUTH_DISCORD_ID ||
        process.env.DISCORD_APPLICATION_ID ||
        process.env.DISCORD_CLIENT_ID ||
        null
    );
}

/**
 * Construit une URL de l'API Discord sur une **base constante** et vérifie l'hôte
 * (même garde anti-SSRF que l'enregistrement : rien ne vient du client sauf des
 * flocons validés en amont).
 */
function discordApiUrl(path: string): URL {
    const apiBase = new URL(`${DISCORD_API_BASE}/`);
    const target = new URL(path, apiBase);
    if (target.protocol !== "https:" || target.hostname !== apiBase.hostname) {
        throw new Error("Hôte Discord invalide");
    }
    return target;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function putDiscordJson(
    url: URL,
    body: unknown,
    botToken: string
): Promise<
    | { ok: true; json: unknown }
    | { ok: false; error: string; status: number; retryAfterMs?: number }
> {
    const res = await fetch(url, {
        method: "PUT",
        headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
            "User-Agent": "DiscordBot (https://sigilos.fr, 1.0.0)",
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errBody = await res.text();
        if (res.status === 429) {
            // 🚦 Une limite Discord n'est **pas** une erreur applicative : on la traite
            // comme telle (warn + message au staff), sinon chaque clic un peu rapide
            // crée une Issue Sentry (`retry_after` mesuré : 11-23 s).
            let retryAfterMs: number | undefined;
            try {
                const parsed = JSON.parse(errBody) as { retry_after?: number };
                if (typeof parsed.retry_after === "number") {
                    retryAfterMs = Math.ceil(parsed.retry_after * 1000);
                }
            } catch {
                retryAfterMs = undefined;
            }
            logger.warn("[SlashCommandSync] Discord limite les écritures", {
                status: res.status,
                retryAfterMs,
            });
            return { ok: false, error: `Discord 429: ${errBody.slice(0, 200)}`, status: res.status, retryAfterMs };
        }
        return { ok: false, error: `Discord ${res.status}: ${errBody.slice(0, 200)}`, status: res.status };
    }
    const text = await res.text();
    return { ok: true, json: text ? JSON.parse(text) : null };
}

export interface GuildCommandSyncResult {
    ok: boolean;
    guildId: string;
    error?: string;
    count?: number;
    /** Rien n'a été envoyé : une synchronisation vient d'avoir lieu (anti-429). */
    throttled?: boolean;
    /**
     * Commandes dont les dérogations Discord **diffèrent** du dashboard.
     * ⚠️ Discord interdit à un bot de les écrire (`20001`) : c'est un **diagnostic**
     * à corriger dans Intégrations, pas une synchronisation.
     */
    permissionDrift?: string[];
}

/**
 * Enregistre (PUT = upsert bulk) toutes les commandes slash sur UN serveur Discord,
 * **puis pousse les permissions réelles** (rôles + salons) depuis la base.
 *
 * Sans la seconde étape, Discord gardait les cases cochées à la main (mesure du
 * 24/10/2026 : `/valider-recrue` visible pour le seul rôle STAFF alors que le
 * dashboard autorisait aussi EMPEREUR). Une commande non déployée n'est **pas**
 * envoyée : Discord la supprime de la guilde (elle n'apparaît nulle part, pas même
 * dans Intégrations).
 */
export async function registerCommandsForGuild(
    discordGuildId: string,
    customCommandsOverride?: Array<{ name: string; description: string; options?: DiscordCommandOption[] }>
): Promise<GuildCommandSyncResult> {
    const appId = discordAppId();
    const botToken = process.env.DISCORD_BOT_TOKEN;

    if (!appId || !botToken) {
        return { ok: false, guildId: discordGuildId, error: "Missing AUTH_DISCORD_ID / DISCORD_CLIENT_ID or DISCORD_BOT_TOKEN" };
    }

    // 🛡️ Garde anti-SSRF (CodeQL) : l'identifiant de guilde vient du CLIENT.
    // Discord n'accepte que des « snowflakes » numériques : tout le reste est refusé
    // AVANT de construire l'URL, et l'hôte reste constant (DISCORD_API_BASE).
    if (!/^\d{17,20}$/.test(discordGuildId)) {
        return { ok: false, guildId: discordGuildId, error: "Identifiant de guilde Discord invalide" };
    }

    // 🚦 Anti-429 : un clic répété dans God ne doit pas marteler Discord (le bucket
    // des commandes est strict ; mesure du 24/10 : `retry_after` ≈ 12-23 s).
    const gate = await rateLimit(`slash-sync:${discordGuildId}`, 1, 8_000);
    if (!gate.success) {
        return { ok: true, guildId: discordGuildId, throttled: true };
    }

    try {
        // 1. Ce que la guilde possède réellement en base (source de vérité).
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: {
                id: true,
                slashCommandPermissions: {
                    select: { commandName: true, isEnabled: true, roleIds: true, channelIds: true },
                },
            },
        });
        const permissionRows = new Map(
            (guild?.slashCommandPermissions ?? []).map((row) => [row.commandName, row])
        );

        let ticketCommands: TicketCustomCommand[] = [];
        let ticketStaffRoleIds: string[] = [];
        let ticketCommandsOverride = customCommandsOverride;
        if (guild) {
            const ticketConfig = await db.ticketGuildConfig.findFirst({
                where: { guildId: guild.id },
                select: { isEnabled: true, settingsJson: true, staffRoleIds: true },
            });
            if (ticketConfig?.isEnabled) {
                ticketCommands = readTicketCustomCommands(ticketConfig.settingsJson);
                const journeys = await db.ticketJourney.findMany({
                    where: { guildId: guild.id },
                    select: { staffRoleIds: true },
                });
                ticketStaffRoleIds = [
                    ...new Set([
                        ...(ticketConfig.staffRoleIds ?? []),
                        ...journeys.flatMap((journey) => journey.staffRoleIds ?? []),
                    ]),
                ];
            }
        }

        // 2. Payloads : commandes du catalogue **déployées** + commandes de ticket actives.
        const catalogPayloads = buildDiscordCommandPayloads().filter((payload) => {
            const definition = SLASH_COMMANDS_CATALOG.find((command) => command.name === payload.name);
            if (!definition) return true;
            return isCatalogCommandDeployed(definition, permissionRows.get(definition.name));
        });

        if (!ticketCommandsOverride) {
            ticketCommandsOverride = ticketCommands
                .filter((command) => command.isEnabled)
                .map((command) => ({
                    name: command.name,
                    description: command.description,
                    options: buildTicketSlashCommandOptions(command),
                }));
        }

        const payloads = [...catalogPayloads, ...(ticketCommandsOverride || [])];

        // 3. Enregistrement (bulk overwrite : la guilde reçoit EXACTEMENT cette liste).
        const apiBase = new URL(`${DISCORD_API_BASE}/`);
        const url = new URL(`applications/${appId}/guilds/${discordGuildId}/commands`, apiBase);
        if (url.protocol !== "https:" || url.hostname !== apiBase.hostname) {
            return { ok: false, guildId: discordGuildId, error: "Hôte Discord invalide" };
        }

        const registration = await putDiscordJson(url, payloads, botToken);
        if (!registration.ok) {
            if (registration.status === 429) {
                const waitSecs = Math.max(5, Math.ceil((registration.retryAfterMs ?? 12_000) / 1000));
                return {
                    ok: false,
                    guildId: discordGuildId,
                    throttled: true,
                    error: `Discord limite les modifications de commandes — réessaie dans ${waitSecs} s.`,
                };
            }
            logger.error("[SlashCommandSync] Discord API error", { guild: discordGuildId, error: registration.error });
            return { ok: false, guildId: discordGuildId, error: registration.error };
        }

        const registered = (Array.isArray(registration.json) ? registration.json : []) as Array<{
            id: string;
            name: string;
        }>;
        logger.info(`[SlashCommandSync] ✅ ${registered.length} commandes enregistrées pour la guilde ${discordGuildId}`, {
            commands: registered.map((command) => command.name),
        });

        return {
            ok: true,
            guildId: discordGuildId,
            count: registered.length,
            // ⚠️ Un bot ne peut **pas** écrire les dérogations de commande
            // (`403 { code: 20001, "Bots cannot use this endpoint" }`). On se contente
            // donc de **lire** l'état Discord et de signaler l'écart au staff.
            permissionDrift: await readCommandPermissionDrift({
                appId,
                botToken,
                discordGuildId,
                registered,
                permissionRows,
                ticketCommands,
                ticketStaffRoleIds,
            }),
        };
    } catch (err) {
        logger.error("[SlashCommandSync] Fetch error", { guild: discordGuildId, error: String(err) });
        return { ok: false, guildId: discordGuildId, error: String(err) };
    }
}

type DiscordPermissionEntry = { id: string; type: number; permission: boolean };

/**
 * ⚠️ **Un bot ne peut pas écrire les dérogations d'une commande.**
 *
 * Mesure du 24/10/2026 : `PUT .../commands/{id}/permissions` **et**
 * `PUT .../commands/permissions` renvoient
 * `403 { code: 20001, message: "Bots cannot use this endpoint" }` ; la **lecture**
 * (GET) est autorisée. Seule la **définition** de la commande est inscriptible
 * (bulk `PUT .../commands`, avec `default_member_permissions`).
 *
 * Conséquence assumée : la visibilité par rôle/salon reste un réglage **manuel**
 * dans Discord → Intégrations, et le bot la fait respecter **à l'exécution**
 * (refus éphémère). Ce diagnostic — **une** lecture, zéro écriture — affiche
 * l'écart réel, au lieu de promettre une synchronisation impossible (et de
 * provoquer un 429 en martelant l'API).
 */
async function readCommandPermissionDrift(input: {
    appId: string;
    botToken: string;
    discordGuildId: string;
    registered: Array<{ id: string; name: string }>;
    permissionRows: Map<string, { commandName: string; isEnabled: boolean; roleIds: string[]; channelIds: string[] }>;
    ticketCommands: TicketCustomCommand[];
    ticketStaffRoleIds: string[];
}): Promise<string[] | undefined> {
    try {
        const url = discordApiUrl(
            `applications/${input.appId}/guilds/${input.discordGuildId}/commands/permissions`
        );
        const res = await fetch(url, {
            headers: {
                Authorization: `Bot ${input.botToken}`,
                "User-Agent": "DiscordBot (https://sigilos.fr, 1.0.0)",
            },
        });
        if (!res.ok) {
            logger.warn("[SlashCommandSync] permissions illisibles", {
                guild: input.discordGuildId,
                status: res.status,
            });
            return undefined;
        }

        const payload = (await res.json()) as Array<{ id: string; permissions?: DiscordPermissionEntry[] }>;
        const actualByCommandId = new Map(payload.map((entry) => [entry.id, entry.permissions ?? []]));
        const signature = (entry: DiscordPermissionEntry) => `${entry.type}:${entry.id}:${entry.permission}`;

        const drift: string[] = [];
        for (const command of input.registered) {
            const catalogRow = input.permissionRows.get(command.name);
            const ticketCommand = input.ticketCommands.find(
                (candidate) => candidate.isEnabled && candidate.name === command.name
            );
            const expected = catalogRow
                ? buildCommandPermissionEntries({
                      discordGuildId: input.discordGuildId,
                      roleIds: catalogRow.roleIds,
                      channelIds: catalogRow.channelIds,
                  })
                : ticketCommand
                  ? buildCommandPermissionEntries({
                        discordGuildId: input.discordGuildId,
                        roleIds: resolveTicketCommandRoleIds(ticketCommand, input.ticketStaffRoleIds),
                        channelIds: [],
                    })
                  : [];

            const expectedSet = new Set(expected.map(signature));
            const actualSet = new Set((actualByCommandId.get(command.id) ?? []).map(signature));
            const identical =
                expectedSet.size === actualSet.size &&
                [...expectedSet].every((entry) => actualSet.has(entry));
            if (!identical) drift.push(`/${command.name}`);
        }

        return drift.length > 0 ? drift : undefined;
    } catch (err) {
        logger.warn("[SlashCommandSync] diagnostic des permissions impossible", {
            guild: input.discordGuildId,
            error: String(err),
        });
        return undefined;
    }
}

/**
 * GOD Action — Déploie les commandes slash sur TOUTES les guildes SigilOS actives.
 * Aussi appelable pour une seule guilde (guildId optionnel).
 */
export async function syncSlashCommandsToDiscordAction(targetGuildId?: string): Promise<{
    success: boolean;
    results: GuildCommandSyncResult[];
    error?: string;
}> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, results: [], error: "Unauthorized: Super-admin required" };
    }

    try {
        let discordGuildIds: string[] = [];

        if (targetGuildId) {
            const guild = await db.guildConfig.findUnique({
                where: { id: targetGuildId },
                select: { discordGuildId: true },
            });
            if (!guild) return { success: false, results: [], error: "Guild not found" };
            discordGuildIds = [guild.discordGuildId];
        } else {
            const guilds = await db.guildConfig.findMany({
                where: { isActive: true },
                select: { discordGuildId: true },
            });
            discordGuildIds = guilds.map((guild) => guild.discordGuildId);
        }

        if (discordGuildIds.length === 0) {
            return { success: false, results: [], error: "No active guilds found" };
        }

        // Run registrations sequentially (rate-limit safety — max 200 req/5s global)
        const results: GuildCommandSyncResult[] = [];
        for (const guildId of discordGuildIds) {
            results.push(await registerCommandsForGuild(guildId));
            if (discordGuildIds.length > 1) {
                await sleep(300);
            }
        }

        const successCount = results.filter((result) => result.ok).length;
        const firstError = results.find((result) => !result.ok)?.error;

        return {
            success: successCount > 0,
            results,
            error: successCount === 0 ? firstError || "Aucun serveur n'a pu être synchronisé" : undefined,
        };
    } catch (err) {
        logger.error("[syncSlashCommandsToDiscordAction] Error", { error: String(err) });
        return { success: false, results: [], error: String(err) };
    }
}
