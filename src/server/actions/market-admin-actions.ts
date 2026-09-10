"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserContext, type ActionResponse } from "./user-actions";
import { fetchChannel, validateChannelBelongsToGuild } from "@/server/discord";
import {
    MARKET_AUDIT_ACTIONS,
    MARKET_CHANNEL_KINDS,
    MARKET_SETTINGS_BOUNDS,
    MARKET_SETTINGS_DEFAULTS,
} from "./market-constants";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type MarketSettings = {
    marketNotifyChannelId: string | null;
    marketNotifyRoleId: string | null;
    marketAllowedPingRoleIds: string[];
    marketModeratorRoleId: string | null;
    marketMinRoleId: string | null;
    marketMaxActivePerMember: number;
    marketDefaultDurationDays: number;
    marketMaxLifetimeDays: number;
    marketReminderDays: number[];
    marketReservationHours: number;
    marketOfferHours: number;
    marketNegotiationsEnabled: boolean;
    marketProofsEnabled: boolean;
    marketMediaRetentionDays: number;
    marketLogRetentionDays: number;
    marketChannelKind: string | null;
};

export type MarketConfigTestResult = {
    channelConfigured: boolean;
    channelKind: string | null;
    channelName: string | null;
    channelReachable: boolean;
    issues: string[];
};

// ---------------------------------------------------------------------------
// ZOD
// ---------------------------------------------------------------------------

const snowflake = z.string().trim().regex(/^\d{5,25}$/, "Identifiant Discord invalide");

const marketSettingsSchema = z.object({
    marketNotifyChannelId: snowflake.nullable(),
    marketNotifyRoleId: snowflake.nullable(),
    marketAllowedPingRoleIds: z.array(snowflake).max(25),
    marketModeratorRoleId: snowflake.nullable(),
    marketMinRoleId: snowflake.nullable(),
    marketMaxActivePerMember: z
        .number()
        .int()
        .min(MARKET_SETTINGS_BOUNDS.marketMaxActivePerMember.min)
        .max(MARKET_SETTINGS_BOUNDS.marketMaxActivePerMember.max),
    marketDefaultDurationDays: z
        .number()
        .int()
        .min(MARKET_SETTINGS_BOUNDS.marketDefaultDurationDays.min)
        .max(MARKET_SETTINGS_BOUNDS.marketDefaultDurationDays.max),
    marketMaxLifetimeDays: z
        .number()
        .int()
        .min(MARKET_SETTINGS_BOUNDS.marketMaxLifetimeDays.min)
        .max(MARKET_SETTINGS_BOUNDS.marketMaxLifetimeDays.max),
    marketReminderDays: z.array(z.number().int().min(1).max(59)).min(1).max(3),
    marketReservationHours: z
        .number()
        .int()
        .min(MARKET_SETTINGS_BOUNDS.marketReservationHours.min)
        .max(MARKET_SETTINGS_BOUNDS.marketReservationHours.max),
    marketOfferHours: z
        .number()
        .int()
        .min(MARKET_SETTINGS_BOUNDS.marketOfferHours.min)
        .max(MARKET_SETTINGS_BOUNDS.marketOfferHours.max),
    marketNegotiationsEnabled: z.boolean(),
    marketProofsEnabled: z.boolean(),
    marketMediaRetentionDays: z
        .number()
        .int()
        .min(MARKET_SETTINGS_BOUNDS.marketMediaRetentionDays.min)
        .max(MARKET_SETTINGS_BOUNDS.marketMediaRetentionDays.max),
    marketLogRetentionDays: z
        .number()
        .int()
        .min(MARKET_SETTINGS_BOUNDS.marketLogRetentionDays.min)
        .max(MARKET_SETTINGS_BOUNDS.marketLogRetentionDays.max),
});

export type MarketSettingsInput = z.input<typeof marketSettingsSchema>;

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Normalise un Json Prisma en liste de strings (fail-soft). */
function toStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Normalise un Json Prisma en liste de nombres (fail-soft). */
function toNumberArray(value: unknown): number[] {
    return Array.isArray(value)
        ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
        : [...MARKET_SETTINGS_DEFAULTS.marketReminderDays];
}

/** Admin (RBAC) requis pour lire/écrire les réglages du module. */
async function requireMarketAdmin(guildId: string) {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.isAdmin) {
        return { error: "Admin requis" as const };
    }
    return { user };
}

// ---------------------------------------------------------------------------
// LECTURE / ÉCRITURE DES RÉGLAGES (S1.17)
// ---------------------------------------------------------------------------

/** Réglages du module Marché (valeurs par défaut appliquées si non posées). */
export async function getMarketSettings(guildId: string): Promise<ActionResponse<MarketSettings>> {
    try {
        const guard = await requireMarketAdmin(guildId);
        if ("error" in guard) return { success: false, error: guard.error };

        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                marketNotifyChannelId: true,
                marketNotifyRoleId: true,
                marketAllowedPingRoleIds: true,
                marketModeratorRoleId: true,
                marketMinRoleId: true,
                marketMaxActivePerMember: true,
                marketDefaultDurationDays: true,
                marketMaxLifetimeDays: true,
                marketReminderDays: true,
                marketReservationHours: true,
                marketOfferHours: true,
                marketNegotiationsEnabled: true,
                marketProofsEnabled: true,
                marketMediaRetentionDays: true,
                marketLogRetentionDays: true,
                marketChannelKind: true,
            },
        });
        if (!config) return { success: false, error: "Guilde introuvable" };

        return {
            success: true,
            data: {
                marketNotifyChannelId: config.marketNotifyChannelId,
                marketNotifyRoleId: config.marketNotifyRoleId,
                marketAllowedPingRoleIds: toStringArray(config.marketAllowedPingRoleIds),
                marketModeratorRoleId: config.marketModeratorRoleId,
                marketMinRoleId: config.marketMinRoleId,
                marketMaxActivePerMember: config.marketMaxActivePerMember,
                marketDefaultDurationDays: config.marketDefaultDurationDays,
                marketMaxLifetimeDays: config.marketMaxLifetimeDays,
                marketReminderDays: toNumberArray(config.marketReminderDays),
                marketReservationHours: config.marketReservationHours,
                marketOfferHours: config.marketOfferHours,
                marketNegotiationsEnabled: config.marketNegotiationsEnabled,
                marketProofsEnabled: config.marketProofsEnabled,
                marketMediaRetentionDays: config.marketMediaRetentionDays,
                marketLogRetentionDays: config.marketLogRetentionDays,
                marketChannelKind: config.marketChannelKind,
            },
        };
    } catch (error) {
        logger.error("[getMarketSettings] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


/**
 * Met à jour les réglages du module (Zod + validation stricte du salon).
 * Le salon est **revalidé côté serveur** : jamais un identifiant fourni
 * aveuglément par le client (§16.3 / §9.2).
 */
export async function updateMarketSettings(
    guildId: string,
    input: MarketSettingsInput
): Promise<ActionResponse> {
    try {
        const guard = await requireMarketAdmin(guildId);
        if ("error" in guard) return { success: false, error: guard.error };

        const parsed = marketSettingsSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
        }
        const data = parsed.data;

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Validation serveur du salon de publication (appartient bien à la guilde).
        let channelKind: string | null = null;
        if (data.marketNotifyChannelId) {
            const belongs = await validateChannelBelongsToGuild(data.marketNotifyChannelId, guildId);
            if (!belongs) {
                return { success: false, error: "Le salon sélectionné n'appartient pas à ce serveur Discord." };
            }
            try {
                const channel = await fetchChannel(data.marketNotifyChannelId);
                channelKind = channel?.type === 15 ? MARKET_CHANNEL_KINDS.FORUM : MARKET_CHANNEL_KINDS.TEXT;
            } catch {
                channelKind = null;
            }
        }

        await db.guildConfig.update({
            where: { id: guildConfig.id },
            data: {
                marketNotifyChannelId: data.marketNotifyChannelId,
                marketNotifyRoleId: data.marketNotifyRoleId,
                marketAllowedPingRoleIds: data.marketAllowedPingRoleIds,
                marketModeratorRoleId: data.marketModeratorRoleId,
                marketMinRoleId: data.marketMinRoleId,
                marketMaxActivePerMember: data.marketMaxActivePerMember,
                marketDefaultDurationDays: data.marketDefaultDurationDays,
                marketMaxLifetimeDays: data.marketMaxLifetimeDays,
                marketReminderDays: data.marketReminderDays,
                marketReservationHours: data.marketReservationHours,
                marketOfferHours: data.marketOfferHours,
                marketNegotiationsEnabled: data.marketNegotiationsEnabled,
                marketProofsEnabled: data.marketProofsEnabled,
                marketMediaRetentionDays: data.marketMediaRetentionDays,
                marketLogRetentionDays: data.marketLogRetentionDays,
                marketChannelKind: channelKind,
            },
        });

        const session = await auth();
        try {
            await db.marketAuditLog.create({
                data: {
                    guildId: guildConfig.id,
                    actorUserId: session?.user?.id ?? null,
                    action: MARKET_AUDIT_ACTIONS.CONFIG_UPDATED,
                    nextData: data as unknown as object,
                },
            });
        } catch (auditError) {
            logger.error("[updateMarketSettings] audit failed", { err: auditError });
        }

        revalidatePath(`/dashboard/${guildId}/marche`);
        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        logger.error("[updateMarketSettings] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


// ---------------------------------------------------------------------------
// TEST DE CONFIGURATION (S1.41 — §9.5.4)
// ---------------------------------------------------------------------------

/**
 * Vérifie la configuration Discord du module et **pose** `marketChannelKind`.
 * Ne bloque jamais : renvoie un diagnostic lisible pour l'admin.
 */
export async function testMarketConfiguration(
    guildId: string
): Promise<ActionResponse<MarketConfigTestResult>> {
    try {
        const guard = await requireMarketAdmin(guildId);
        if ("error" in guard) return { success: false, error: guard.error };

        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                id: true,
                marketNotifyChannelId: true,
                marketNotifyRoleId: true,
                marketModeratorRoleId: true,
                marketAllowedPingRoleIds: true,
            },
        });
        if (!config) return { success: false, error: "Guilde introuvable" };

        const issues: string[] = [];
        let channelKind: string | null = null;
        let channelName: string | null = null;
        let channelReachable = false;

        if (!config.marketNotifyChannelId) {
            issues.push("Aucun salon de publication configuré : les annonces ne partiraient pas sur Discord.");
        } else {
            try {
                const channel = await fetchChannel(config.marketNotifyChannelId);
                if (!channel) {
                    issues.push("Le salon configuré est introuvable (supprimé ou bot sans accès).");
                } else if (channel.guild_id !== guildId) {
                    issues.push("Le salon configuré n'appartient pas à ce serveur Discord.");
                } else {
                    channelReachable = true;
                    channelName = channel.name;
                    channelKind = channel.type === 15 ? MARKET_CHANNEL_KINDS.FORUM : MARKET_CHANNEL_KINDS.TEXT;
                }
            } catch (error) {
                logger.warn("[testMarketConfiguration] Discord injoignable", { err: String(error) });
                issues.push("Discord est momentanément injoignable — réessaie dans un instant.");
            }
        }

        if (toStringArray(config.marketAllowedPingRoleIds).length === 0) {
            issues.push("Aucun rôle « pinguable » : les créateurs ne pourront mentionner personne à la publication.");
        }
        if (!config.marketModeratorRoleId) {
            issues.push("Aucun rôle modérateur défini : seuls les admins pourront modérer le marché.");
        }
        if (!config.marketNotifyRoleId) {
            issues.push("Aucun rôle à mentionner : la publication se fera sans notification de rôle.");
        }

        await db.guildConfig.update({
            where: { id: config.id },
            data: { marketChannelKind: channelKind },
        });

        return {
            success: true,
            data: {
                channelConfigured: !!config.marketNotifyChannelId,
                channelKind,
                channelName,
                channelReachable,
                issues,
            },
        };
    } catch (error) {
        logger.error("[testMarketConfiguration] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


// ---------------------------------------------------------------------------
// S3.8 — Réparation Discord (modérateur `market:moderate`)
// ---------------------------------------------------------------------------

/** Modérateur du marché requis (RBAC `market:moderate`). */
async function requireMarketModerator(guildId: string) {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.isMember) {
        return { error: "Accès refusé" as const };
    }
    if (!user.canManageMarket) {
        return { error: "Modérateur du Marché requis" as const };
    }
    return { user };
}

/** Vérifie qu'une annonce appartient bien à la guilde du contexte (§16.2). */
async function findGuildListingId(guildId: string, listingId: string): Promise<string | null> {
    const listing = await db.marketListing.findFirst({
        where: { id: listingId, guild: { discordGuildId: guildId } },
        select: { id: true },
    });
    return listing?.id ?? null;
}

/** Journalise une réparation Discord (jamais bloquant). */
async function writeMarketAdminAudit(params: {
    guildId: string;
    listingId: string;
    action: string;
    actorUserId?: string | null;
}): Promise<void> {
    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: params.guildId },
            select: { id: true },
        });
        if (!config) return;
        await db.marketAuditLog.create({
            data: {
                guildId: config.id,
                listingId: params.listingId,
                actorUserId: params.actorUserId ?? null,
                action: params.action,
            },
        });
    } catch (error) {
        logger.warn("[market-admin] audit failed", { err: error });
    }
}

/**
 * S3.8 — Rejoue la publication/édition Discord d'une annonce (God/modo).
 * La réécriture est **synchrone** ici (action de réparation explicite) et
 * renvoie le résultat pour un retour clair à l'opérateur.
 */
export async function resyncMarketListing(
    guildId: string,
    listingId: string
): Promise<ActionResponse<{ messageId?: string | null; skipped?: boolean }>> {
    try {
        const guard = await requireMarketModerator(guildId);
        if ("error" in guard) return { success: false, error: guard.error };

        const id = await findGuildListingId(guildId, listingId);
        if (!id) return { success: false, error: "Annonce introuvable" };

        const { syncListingMessage } = await import("@/server/market/discord");
        const result = await syncListingMessage(id);
        if (!result.ok) {
            await writeMarketAdminAudit({
                guildId,
                listingId: id,
                action: MARKET_AUDIT_ACTIONS.DISCORD_SYNC_FAILED,
                actorUserId: guard.user.id ?? null,
            });
            return { success: false, error: result.error || "Synchronisation Discord impossible" };
        }
        if (result.messageId) {
            await writeMarketAdminAudit({
                guildId,
                listingId: id,
                action: MARKET_AUDIT_ACTIONS.DISCORD_SYNC_RESTORED,
                actorUserId: guard.user.id ?? null,
            });
        }
        return { success: true, data: { messageId: result.messageId, skipped: result.skipped } };
    } catch (error) {
        logger.error("[resyncMarketListing] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

/** S3.8 — Régénère la carte PNG d'une annonce + resynchronise l'embed (God/modo). */
export async function regenerateMarketImage(
    guildId: string,
    listingId: string
): Promise<ActionResponse<{ messageId?: string | null }>> {
    try {
        const guard = await requireMarketModerator(guildId);
        if ("error" in guard) return { success: false, error: guard.error };

        const id = await findGuildListingId(guildId, listingId);
        if (!id) return { success: false, error: "Annonce introuvable" };

        const { regenerateMarketImage: regenerate } = await import("@/server/market/discord");
        const result = await regenerate(id);
        if (!result.ok) {
            return { success: false, error: result.error || "Régénération impossible" };
        }
        await writeMarketAdminAudit({
            guildId,
            listingId: id,
            action: MARKET_AUDIT_ACTIONS.IMAGE_REGENERATED,
            actorUserId: guard.user.id ?? null,
        });
        return { success: true, data: { messageId: result.messageId } };
    } catch (error) {
        logger.error("[regenerateMarketImage] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

