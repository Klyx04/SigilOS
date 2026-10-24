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
    type DiscordCommandPermissionEntry,
} from "@/lib/discord/command-permissions";

const DISCORD_API_BASE = "https://discord.com/api/v10";
/** Discord accepte 5 requêtes/s par route : on espace les écritures de permissions. */
const PERMISSION_SYNC_DELAY_MS = 150;

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
): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
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
        return { ok: false, error: `Discord ${res.status}: ${errBody.slice(0, 200)}` };
    }
    const text = await res.text();
    return { ok: true, json: text ? JSON.parse(text) : null };
}

export interface GuildCommandSyncResult {
    ok: boolean;
    guildId: string;
    error?: string;
    count?: number;
    /** Commandes enregistrées dont les **permissions** n'ont pas pu être écrites. */
    permissionErrors?: string[];
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

        return await pushCommandPermissions({
            appId,
            botToken,
            discordGuildId,
            registered,
            permissionRows,
            ticketCommands,
            ticketStaffRoleIds,
        });
    } catch (err) {
        logger.error("[SlashCommandSync] Fetch error", { guild: discordGuildId, error: String(err) });
        return { ok: false, guildId: discordGuildId, error: String(err) };
    }
}

/**
 * Écrit les permissions de chaque commande enregistrée, puis **efface** les défauts
 * de l'application (les cases cochées à la main dans Discord → Intégrations).
 */
async function pushCommandPermissions(input: {
    appId: string;
    botToken: string;
    discordGuildId: string;
    registered: Array<{ id: string; name: string }>;
    permissionRows: Map<string, { commandName: string; isEnabled: boolean; roleIds: string[]; channelIds: string[] }>;
    ticketCommands: TicketCustomCommand[];
    ticketStaffRoleIds: string[];
}): Promise<GuildCommandSyncResult> {
    const { appId, botToken, discordGuildId, registered } = input;
    const permissionErrors: string[] = [];

    for (const command of registered) {
        const catalogRow = input.permissionRows.get(command.name);
        const ticketCommand = input.ticketCommands.find(
            (candidate) => candidate.isEnabled && candidate.name === command.name
        );

        let entries: DiscordCommandPermissionEntry[] = [];
        if (catalogRow) {
            entries = buildCommandPermissionEntries({
                discordGuildId,
                roleIds: catalogRow.roleIds,
                channelIds: catalogRow.channelIds,
            });
        } else if (ticketCommand) {
            // ⚠️ Pas de dérogation de salon pour les commandes de ticket : leurs salons
            // sont créés à la volée (`ticket-0042-…`) et ne peuvent pas être listés à
            // l'avance. Le garde d'exécution du bot refuse hors ticket.
            entries = buildCommandPermissionEntries({
                discordGuildId,
                roleIds: resolveTicketCommandRoleIds(ticketCommand, input.ticketStaffRoleIds),
                channelIds: [],
            });
        }

        const permissionUrl = discordApiUrl(
            `applications/${appId}/guilds/${discordGuildId}/commands/${command.id}/permissions`
        );
        const written = await putDiscordJson(permissionUrl, { permissions: entries }, botToken);
        if (!written.ok) {
            permissionErrors.push(`/${command.name}: ${written.error}`);
            logger.warn("[SlashCommandSync] permissions non écrites", {
                guild: discordGuildId,
                command: command.name,
                error: written.error,
            });
        }
        await sleep(PERMISSION_SYNC_DELAY_MS);
    }

    // Défauts de l'application : « Tous les salons » limité à 5 salons + `@everyone`
    // refusé masquaient toutes les commandes hors de ces salons — dont #bot-notif et
    // les salons de tickets. Le dashboard est désormais la seule source de vérité.
    const defaultsUrl = discordApiUrl(`applications/${appId}/guilds/${discordGuildId}/commands/permissions`);
    const defaults = await putDiscordJson(defaultsUrl, { permissions: [] }, botToken);
    if (!defaults.ok) {
        permissionErrors.push(`défauts de l'application: ${defaults.error}`);
        logger.warn("[SlashCommandSync] défauts de permissions non réinitialisés", {
            guild: discordGuildId,
            error: defaults.error,
        });
    }

    return {
        ok: true,
        guildId: discordGuildId,
        count: registered.length,
        permissionErrors: permissionErrors.length > 0 ? permissionErrors : undefined,
    };
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
