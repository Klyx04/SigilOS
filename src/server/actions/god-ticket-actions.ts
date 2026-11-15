"use server";

/**
 * 🎫 God — réglages du module support (G4-2).
 *
 * Toutes les actions sont **God uniquement** (`isSuperAdmin`, fail-closed),
 * bornées par Zod et limitées en fréquence. Les identifiants Discord saisis
 * sont **revalidés auprès de Discord** avant écriture : un salon doit
 * appartenir au serveur support, un rôle doit y exister. Discord indisponible
 * ⇒ refus, jamais un enregistrement optimiste.
 *
 * La lecture passe par la règle pure `resolveGodTicketConfig` /
 * `resolveGodTicketCategories` (`src/lib/tickets/god-config.ts`).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { isSuperAdmin } from "./super-admin-actions";
import {
    fetchBotGuilds,
    fetchChannel,
    fetchGuildChannels,
    fetchGuildRoles,
    validateChannelBelongsToGuild,
} from "@/server/discord";
import {
    GOD_TICKET_CATEGORY_KEY_PATTERN,
    GOD_TICKET_COLOR_PATTERN,
    resolveGodTicketCategories,
    resolveGodTicketConfig,
    type GodTicketCategoryRow,
    type GodTicketConfigView,
} from "@/lib/tickets/god-config";

type ActionResult<T = unknown> = { success: true; data: T } | { success: false; error: string };

export type GodTicketGuildOption = { id: string; name: string };
export type GodTicketChannelOption = { id: string; name: string; type: number };
export type GodTicketRoleOption = { id: string; name: string };

export type GodTicketConfigPanelData = {
    config: GodTicketConfigView;
    categories: GodTicketCategoryRow[];
    guilds: GodTicketGuildOption[];
    channels: GodTicketChannelOption[];
    roles: GodTicketRoleOption[];
    csat: { average: number | null; count: number };
    usage: Record<string, number>;
};

const SnowflakeSchema = z.string().regex(/^\d{17,20}$/, "Identifiant Discord invalide");

const GodTicketConfigSchema = z.object({
    supportGuildId: SnowflakeSchema.nullable(),
    supportChannelId: SnowflakeSchema.nullable(),
    staffRoleIds: z.array(SnowflakeSchema).max(25),
    notifyRoleIds: z.array(SnowflakeSchema).max(25),
    namingPattern: z.string().trim().min(1, "Le modèle de nom est requis").max(80),
    closePolicy: z.enum(["STAFF_ONLY", "STAFF_OR_CREATOR"]),
    archiveOnClose: z.boolean(),
    csatEnabled: z.boolean(),
});

const GodTicketCategorySchema = z.object({
    id: z.string().min(1).max(64).optional(),
    key: z
        .string()
        .trim()
        .regex(GOD_TICKET_CATEGORY_KEY_PATTERN, "Clé : minuscules, chiffres et tirets (2 à 40)"),
    label: z.string().trim().min(2, "Libellé requis (2 caractères)").max(40),
    emoji: z.string().trim().min(1, "Emoji requis").max(8),
    color: z.string().trim().regex(GOD_TICKET_COLOR_PATTERN, "Couleur attendue : #RRGGBB"),
    order: z.number().int().min(0).max(999),
    isEnabled: z.boolean(),
});

async function requireGod(): Promise<boolean> {
    try {
        return await isSuperAdmin();
    } catch {
        return false;
    }
}

async function actorId(): Promise<string> {
    const session = await auth().catch(() => null);
    return session?.user?.id || "god";
}

function fail(error: string): { success: false; error: string } {
    return { success: false, error };
}

function channelOptions(
    rows: Array<{ id: string; name: string | null; type: number }>
): GodTicketChannelOption[] {
    return rows
        .filter((channel) => (channel.type === 0 || channel.type === 5) && Boolean(channel.name))
        .map((channel) => ({ id: channel.id, name: channel.name as string, type: channel.type }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function roleOptions(rows: Array<{ id: string; name: string }>): GodTicketRoleOption[] {
    return rows
        .filter((role) => role.name !== "@everyone")
        .map((role) => ({ id: role.id, name: role.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function getGodTicketConfigAction(): Promise<ActionResult<GodTicketConfigPanelData>> {
    try {
        if (!(await requireGod())) return fail("Accès SuperAdmin requis");

        const [row, categoryRows, legacy, usageRows, csatAgg] = await Promise.all([
            db.godTicketConfig.findUnique({ where: { id: "singleton" } }),
            db.godTicketCategory.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] }),
            db.platformConfig.findUnique({
                where: { id: "singleton" },
                select: { ticketSupportGuildId: true },
            }),
            db.supportTicket.groupBy({ by: ["categoryKey"], _count: { _all: true } }),
            db.supportTicket.aggregate({
                where: { origin: "SUPPORT", csatRating: { not: null } },
                _avg: { csatRating: true },
                _count: { _all: true },
            }),
        ]);

        const config = resolveGodTicketConfig(row, {
            supportGuildId: legacy?.ticketSupportGuildId ?? null,
        });
        const categories = resolveGodTicketCategories(categoryRows);

        const usage: Record<string, number> = {};
        for (const item of usageRows) {
            if (item.categoryKey) usage[item.categoryKey] = item._count._all;
        }

        let guilds: GodTicketGuildOption[] = [];
        try {
            guilds = (await fetchBotGuilds())
                .map((guild) => ({ id: guild.id, name: guild.name }))
                .sort((a, b) => a.name.localeCompare(b.name, "fr"));
        } catch (discordError) {
            logger.warn("[GodTicket] Liste des serveurs indisponible", { error: discordError });
        }

        let channels: GodTicketChannelOption[] = [];
        let roles: GodTicketRoleOption[] = [];
        if (config.supportGuildId) {
            const [channelResult, roleResult] = await Promise.allSettled([
                fetchGuildChannels(config.supportGuildId),
                fetchGuildRoles(config.supportGuildId),
            ]);
            if (channelResult.status === "fulfilled") channels = channelOptions(channelResult.value);
            if (roleResult.status === "fulfilled") roles = roleOptions(roleResult.value);
        }

        const average = csatAgg._avg.csatRating;

        return {
            success: true,
            data: {
                config,
                categories,
                guilds,
                channels,
                roles,
                csat: {
                    average: typeof average === "number" ? Number(average.toFixed(1)) : null,
                    count: csatAgg._count._all,
                },
                usage,
            },
        };
    } catch (error) {
        logger.error("[getGodTicketConfigAction] Error", { error });
        return fail("Impossible de charger la configuration du support.");
    }
}

/** Salons et rôles du serveur choisi, pour alimenter les sélecteurs du panneau. */
export async function loadGodTicketGuildAssetsAction(
    guildId: unknown
): Promise<ActionResult<{ channels: GodTicketChannelOption[]; roles: GodTicketRoleOption[] }>> {
    if (!(await requireGod())) return fail("Accès SuperAdmin requis");

    const parsed = SnowflakeSchema.safeParse(guildId);
    if (!parsed.success) return fail("Serveur Discord invalide");

    try {
        const [channels, roles] = await Promise.all([
            fetchGuildChannels(parsed.data),
            fetchGuildRoles(parsed.data),
        ]);
        return {
            success: true,
            data: { channels: channelOptions(channels), roles: roleOptions(roles) },
        };
    } catch (error) {
        logger.error("[loadGodTicketGuildAssetsAction] Error", { error });
        return fail("Discord indisponible — réessaie dans quelques secondes.");
    }
}

/**
 * Enregistre la configuration du support. Chaque identifiant est revalidé
 * **auprès de Discord** : le bot doit être sur le serveur, le salon doit y
 * appartenir et être textuel/annonces, chaque rôle doit exister.
 */
export async function saveGodTicketConfigAction(input: unknown): Promise<ActionResult<null>> {
    if (!(await requireGod())) return fail("Accès SuperAdmin requis");

    const actor = await actorId();
    try {
        const allowed = await rateLimit(`god:ticket-config:${actor}`, 10, 60_000);
        if (!allowed.success) return fail("Trop de modifications — réessaie dans une minute.");
    } catch {
        return fail("Service momentanément indisponible.");
    }

    const parsed = GodTicketConfigSchema.safeParse(input);
    if (!parsed.success) {
        return fail(parsed.error.issues[0]?.message || "Données invalides");
    }
    const data = parsed.data;

    if (!data.supportGuildId && (data.supportChannelId || data.staffRoleIds.length > 0 || data.notifyRoleIds.length > 0)) {
        return fail("Choisis d'abord le serveur support.");
    }

    try {
        if (data.supportGuildId) {
            const guilds = await fetchBotGuilds();
            if (!guilds.some((guild) => guild.id === data.supportGuildId)) {
                return fail("Le bot n'est pas présent sur ce serveur.");
            }
        }

        if (data.supportChannelId) {
            if (!data.supportGuildId) return fail("Choisis d'abord le serveur support.");
            const belongs = await validateChannelBelongsToGuild(data.supportChannelId, data.supportGuildId);
            if (!belongs) return fail("Le salon choisi n'appartient pas au serveur support.");

            const channel = await fetchChannel(data.supportChannelId);
            if (!channel || (channel.type !== 0 && channel.type !== 5)) {
                return fail("Le salon du support doit être un salon textuel ou d'annonces.");
            }
        }

        const roleIds = Array.from(new Set([...data.staffRoleIds, ...data.notifyRoleIds]));
        if (roleIds.length > 0) {
            if (!data.supportGuildId) return fail("Choisis d'abord le serveur support.");
            const roles = await fetchGuildRoles(data.supportGuildId);
            const known = new Set(roles.map((role) => role.id));
            if (roleIds.some((roleId) => !known.has(roleId))) {
                return fail("Un rôle choisi n'existe plus sur le serveur — recharge la liste.");
            }
        }

        await db.godTicketConfig.upsert({
            where: { id: "singleton" },
            create: {
                id: "singleton",
                supportGuildId: data.supportGuildId,
                supportChannelId: data.supportChannelId,
                staffRoleIds: data.staffRoleIds,
                notifyRoleIds: data.notifyRoleIds,
                namingPattern: data.namingPattern,
                closePolicy: data.closePolicy,
                archiveOnClose: data.archiveOnClose,
                csatEnabled: data.csatEnabled,
                updatedBy: actor,
            },
            update: {
                supportGuildId: data.supportGuildId,
                supportChannelId: data.supportChannelId,
                staffRoleIds: data.staffRoleIds,
                notifyRoleIds: data.notifyRoleIds,
                namingPattern: data.namingPattern,
                closePolicy: data.closePolicy,
                archiveOnClose: data.archiveOnClose,
                csatEnabled: data.csatEnabled,
                updatedBy: actor,
            },
        });

        revalidatePath("/god/ticket-bot");
        return { success: true, data: null };
    } catch (error) {
        logger.error("[saveGodTicketConfigAction] Error", { error });
        return fail("Discord ou base indisponible — rien n'a été enregistré.");
    }
}

type CategoryDbRow = {
    id: string;
    key: string;
    label: string;
    emoji: string;
    color: string;
    legacyCategory: string | null;
    order: number;
    isEnabled: boolean;
};

function mapCategoryRow(row: CategoryDbRow): GodTicketCategoryRow {
    return {
        id: row.id,
        key: row.key,
        label: row.label,
        emoji: row.emoji,
        color: row.color,
        legacyCategory: row.legacyCategory,
        order: row.order,
        isEnabled: row.isEnabled,
    };
}

function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        (error as { code?: string }).code === "P2002"
    );
}

/**
 * Crée ou modifie une catégorie. La **clé est immuable** : elle est portée par
 * les `custom_id` Discord des tickets déjà ouverts. Une catégorie ne se
 * supprime jamais : elle se désactive (dernière catégorie active protégée).
 */
export async function saveGodTicketCategoryAction(
    input: unknown
): Promise<ActionResult<GodTicketCategoryRow>> {
    if (!(await requireGod())) return fail("Accès SuperAdmin requis");

    const actor = await actorId();
    try {
        const allowed = await rateLimit(`god:ticket-category:${actor}`, 20, 60_000);
        if (!allowed.success) return fail("Trop de modifications — réessaie dans une minute.");
    } catch {
        return fail("Service momentanément indisponible.");
    }

    const parsed = GodTicketCategorySchema.safeParse(input);
    if (!parsed.success) {
        return fail(parsed.error.issues[0]?.message || "Données invalides");
    }
    const data = parsed.data;

    try {
        if (data.id) {
            const existing = await db.godTicketCategory.findUnique({ where: { id: data.id } });
            if (!existing) return fail("Catégorie introuvable.");
            if (existing.key !== data.key) {
                return fail("La clé d'une catégorie ne change jamais (elle vit dans les tickets).");
            }
            if (existing.isEnabled && !data.isEnabled) {
                const enabled = await db.godTicketCategory.count({ where: { isEnabled: true } });
                if (enabled <= 1) return fail("Garde au moins une catégorie active.");
            }

            const updated = await db.godTicketCategory.update({
                where: { id: data.id },
                data: {
                    label: data.label,
                    emoji: data.emoji,
                    color: data.color,
                    order: data.order,
                    isEnabled: data.isEnabled,
                },
            });
            revalidatePath("/god/ticket-bot");
            return { success: true, data: mapCategoryRow(updated) };
        }

        const created = await db.godTicketCategory.create({
            data: {
                key: data.key,
                label: data.label,
                emoji: data.emoji,
                color: data.color,
                order: data.order,
                isEnabled: data.isEnabled,
            },
        });
        revalidatePath("/god/ticket-bot");
        return { success: true, data: mapCategoryRow(created) };
    } catch (error) {
        if (isUniqueViolation(error)) return fail("Cette clé existe déjà — choisis-en une autre.");
        logger.error("[saveGodTicketCategoryAction] Error", { error });
        return fail("Impossible d'enregistrer la catégorie.");
    }
}

/** Active ou désactive une catégorie (jamais de suppression). */
export async function setGodTicketCategoryEnabledAction(
    input: unknown
): Promise<ActionResult<{ id: string; isEnabled: boolean }>> {
    if (!(await requireGod())) return fail("Accès SuperAdmin requis");

    const actor = await actorId();
    try {
        const allowed = await rateLimit(`god:ticket-category:${actor}`, 20, 60_000);
        if (!allowed.success) return fail("Trop de modifications — réessaie dans une minute.");
    } catch {
        return fail("Service momentanément indisponible.");
    }

    const parsed = z
        .object({ id: z.string().min(1).max(64), enabled: z.boolean() })
        .safeParse(input);
    if (!parsed.success) return fail("Données invalides");

    try {
        const result = await db.$transaction(async (tx) => {
            const existing = await tx.godTicketCategory.findUnique({ where: { id: parsed.data.id } });
            if (!existing) return { ok: false as const, error: "Catégorie introuvable." };

            if (!parsed.data.enabled && existing.isEnabled) {
                const enabled = await tx.godTicketCategory.count({ where: { isEnabled: true } });
                if (enabled <= 1) {
                    return { ok: false as const, error: "Garde au moins une catégorie active." };
                }
            }

            await tx.godTicketCategory.update({
                where: { id: parsed.data.id },
                data: { isEnabled: parsed.data.enabled },
            });
            return { ok: true as const };
        });

        if (!result.ok) return fail(result.error);

        revalidatePath("/god/ticket-bot");
        return { success: true, data: { id: parsed.data.id, isEnabled: parsed.data.enabled } };
    } catch (error) {
        logger.error("[setGodTicketCategoryEnabledAction] Error", { error });
        return fail("Impossible de modifier la catégorie.");
    }
}

/**
 * Publie le panneau support dans le salon réglé. Le contenu vient des
 * catégories actives ; aucun libellé n'est fourni par l'appelant.
 */
export async function publishGodTicketPanelAction(): Promise<ActionResult<{ messageId: string }>> {
    if (!(await requireGod())) return fail("Accès SuperAdmin requis");

    const actor = await actorId();
    try {
        const allowed = await rateLimit(`god:ticket-panel:${actor}`, 3, 60_000);
        if (!allowed.success) return fail("Trop de publications — réessaie dans une minute.");
    } catch {
        return fail("Service momentanément indisponible.");
    }

    const { postTicketPanel } = await import("./ticket-actions");
    const result = await postTicketPanel();

    if (!result.success) return fail(result.error || "Échec de la publication du panneau.");
    if (!result.messageId) return fail("La publication n'a pas renvoyé de message Discord.");

    revalidatePath("/god/ticket-bot");
    return { success: true, data: { messageId: result.messageId } };
}
