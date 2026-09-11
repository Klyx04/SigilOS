"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, type MarketReportReason, type MarketReportStatus } from "@prisma/client";
import { getUserContext, type ActionResponse } from "./user-actions";
import { fetchChannel, validateChannelBelongsToGuild } from "@/server/discord";
import { writeMarketAuditLog } from "@/server/market/audit";
import { sanitizeMarketText } from "@/lib/market/text";
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


// ---------------------------------------------------------------------------
// S4.11 — Modération des annonces & signalements (`market:moderate`, §6.9)
// ---------------------------------------------------------------------------

/** Ligne du panneau de signalements — tout ce que le modérateur doit voir. */
export type MarketReportRecord = {
    id: string;
    listingId: string;
    listingTitle: string;
    listingStatus: string;
    reason: MarketReportReason;
    details: string | null;
    /** État de l'annonce **au moment du signalement** (§6.9). */
    snapshot: Prisma.JsonValue | null;
    status: MarketReportStatus;
    resolution: string | null;
    /** Pseudo du membre qui a signalé (`UserProfile` — écran privé). */
    reporterLabel: string | null;
    createdAt: string;
    reviewedAt: string | null;
};

/** La guilde du contexte doit exister : sans elle, rien n'est isolé (§16.2). */
async function requireGuildConfigId(guildId: string): Promise<string | null> {
    const config = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true },
    });
    return config?.id ?? null;
}

/**
 * S4.11 — retire une annonce de la vue publique (modération).
 *
 * `WITHDRAWN` + `moderationNote` : le vendeur garde son annonce (il peut la
 * corriger), le public ne la voit plus. La **garde de statut est dans le
 * `WHERE`** (§11.3) : deux modérateurs simultanés, ou une annonce vendue
 * entre-temps, ne produisent jamais un retrait incohérent.
 */
export async function takeDownMarketListing(
    guildId: string,
    listingId: string,
    note?: string | null
): Promise<ActionResponse<{ status: "WITHDRAWN" }>> {
    try {
        const guard = await requireMarketModerator(guildId);
        if ("error" in guard) return { success: false, error: guard.error };

        const parsed = z.string().min(1).max(64).safeParse(listingId);
        if (!parsed.success) return { success: false, error: "Annonce introuvable" };

        const guildConfigId = await requireGuildConfigId(guildId);
        if (!guildConfigId) return { success: false, error: "Guilde introuvable" };

        const moderationNote = sanitizeMarketText(note);
        const now = new Date();
        const updated = await db.marketListing.updateMany({
            where: {
                id: parsed.data,
                guildId: guildConfigId,
                deletedAt: null,
                status: { in: ["DRAFT", "ACTIVE", "RESERVED"] },
            },
            data: { status: "WITHDRAWN", moderationNote, lastActivityAt: now },
        });
        // `count === 0` : annonce absente, déjà vendue/expirée ou déjà retirée.
        if (updated.count === 0) {
            return { success: false, error: "Cette annonce ne peut pas être retirée (statut incompatible)." };
        }

        await writeMarketAuditLog({
            guildId: guildConfigId,
            listingId: parsed.data,
            actorUserId: guard.user.id ?? null,
            action: MARKET_AUDIT_ACTIONS.LISTING_TAKEN_DOWN,
            reason: moderationNote,
            nextData: { status: "WITHDRAWN", moderationNote },
        });

        // §13.6 — l'embed public dit « retirée » ; jamais bloquant pour le modo.
        const { syncListingMessage } = await import("@/server/market/discord");
        void syncListingMessage(parsed.data).catch((err) =>
            logger.warn("[market] synchronisation Discord différée", {
                listingId: parsed.data,
                err: String(err),
            })
        );

        revalidatePath(`/dashboard/${guildId}/marche/${parsed.data}`);
        revalidatePath(`/dashboard/${guildId}/marche`);
        return { success: true, data: { status: "WITHDRAWN" } };
    } catch (error) {
        logger.error("[takeDownMarketListing] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

/**
 * S4.11 — restaure une annonce retirée (`WITHDRAWN → ACTIVE`).
 *
 * Une annonce dont la durée de vie est dépassée n'est **pas** ressuscitée : le
 * cron l'expirerait aussitôt et le vendeur n'aurait qu'un faux espoir — on lui
 * dit de la renouveler (§11.7).
 */
export async function restoreMarketListing(
    guildId: string,
    listingId: string
): Promise<ActionResponse<{ status: "ACTIVE" }>> {
    try {
        const guard = await requireMarketModerator(guildId);
        if ("error" in guard) return { success: false, error: guard.error };

        const parsed = z.string().min(1).max(64).safeParse(listingId);
        if (!parsed.success) return { success: false, error: "Annonce introuvable" };

        const guildConfigId = await requireGuildConfigId(guildId);
        if (!guildConfigId) return { success: false, error: "Guilde introuvable" };

        const listing = await db.marketListing.findFirst({
            where: { id: parsed.data, guildId: guildConfigId, deletedAt: null },
            select: { id: true, status: true, expiresAt: true },
        });
        if (!listing) return { success: false, error: "Annonce introuvable" };
        if (listing.status !== "WITHDRAWN") {
            return { success: false, error: "Seule une annonce retirée peut être restaurée." };
        }
        const now = new Date();
        if (listing.expiresAt && listing.expiresAt.getTime() <= now.getTime()) {
            return { success: false, error: "Annonce expirée : le vendeur doit la renouveler." };
        }

        const updated = await db.marketListing.updateMany({
            where: { id: listing.id, status: "WITHDRAWN" }, // garde de statut (§11.3)
            data: { status: "ACTIVE", moderationNote: null, lastActivityAt: now },
        });
        if (updated.count === 0) {
            return { success: false, error: "Cette annonce vient d'être modifiée, réessaie." };
        }

        await writeMarketAuditLog({
            guildId: guildConfigId,
            listingId: listing.id,
            actorUserId: guard.user.id ?? null,
            action: MARKET_AUDIT_ACTIONS.LISTING_RESTORED,
            previousData: { status: "WITHDRAWN" },
            nextData: { status: "ACTIVE" },
        });

        const { syncListingMessage } = await import("@/server/market/discord");
        void syncListingMessage(listing.id).catch((err) =>
            logger.warn("[market] synchronisation Discord différée", { listingId: listing.id, err: String(err) })
        );

        revalidatePath(`/dashboard/${guildId}/marche/${listing.id}`);
        revalidatePath(`/dashboard/${guildId}/marche`);
        return { success: true, data: { status: "ACTIVE" } };
    } catch (error) {
        logger.error("[restoreMarketListing] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

/** Nombre de dossiers affichés par le panneau (S4.11, base). */
const MARKET_REPORT_PAGE_SIZE = 50;

/** Filtre du panneau : un statut précis, ou tout l'historique. */
export type MarketReportFilter = MarketReportStatus | "ALL";

/**
 * S4.11 — liste les dossiers de signalement de la guilde (§6.9).
 *
 * Lecture **stricte** de la guilde du contexte (isolation par la relation
 * `listing.guildId` : `MarketReport` ne porte pas de `guildId` propre) et
 * pseudos joints à part — la modération voit **qui** signale, jamais le public.
 */
export async function listMarketReports(
    guildId: string,
    filter: MarketReportFilter = "OPEN"
): Promise<ActionResponse<MarketReportRecord[]>> {
    try {
        const guard = await requireMarketModerator(guildId);
        if ("error" in guard) return { success: false, error: guard.error };

        const guildConfigId = await requireGuildConfigId(guildId);
        if (!guildConfigId) return { success: false, error: "Guilde introuvable" };

        const parsedFilter = z.enum(["OPEN", "REVIEWED", "CLOSED", "ALL"]).safeParse(filter);
        if (!parsedFilter.success) return { success: false, error: "Filtre invalide" };

        const reports = await db.marketReport.findMany({
            where: {
                listing: { guildId: guildConfigId },
                ...(parsedFilter.data === "ALL" ? {} : { status: parsedFilter.data }),
            },
            select: {
                id: true,
                reason: true,
                details: true,
                snapshot: true,
                status: true,
                resolution: true,
                createdAt: true,
                reviewedAt: true,
                reporterProfileId: true,
                listing: { select: { id: true, title: true, status: true } },
            },
            orderBy: [{ createdAt: "desc" }],
            take: MARKET_REPORT_PAGE_SIZE,
        });

        const reporterIds = Array.from(new Set(reports.map((report) => report.reporterProfileId)));
        const reporters = reporterIds.length
            ? await db.userProfile.findMany({
                  where: { id: { in: reporterIds } },
                  select: { id: true, pseudoDofus: true, discordNickname: true },
              })
            : [];
        const labelById = new Map(
            reporters.map((profile) => [
                profile.id,
                profile.pseudoDofus?.trim() || profile.discordNickname?.trim() || null,
            ])
        );

        return {
            success: true,
            data: reports.map((report) => ({
                id: report.id,
                listingId: report.listing.id,
                listingTitle: report.listing.title,
                listingStatus: report.listing.status,
                reason: report.reason,
                details: report.details,
                snapshot: report.snapshot,
                status: report.status,
                resolution: report.resolution,
                reporterLabel: labelById.get(report.reporterProfileId) ?? null,
                createdAt: report.createdAt.toISOString(),
                reviewedAt: report.reviewedAt ? report.reviewedAt.toISOString() : null,
            })),
        };
    } catch (error) {
        logger.error("[listMarketReports] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

/**
 * S4.11 — classe un dossier : `REVIEWED` (pris en charge) ou `CLOSED` (réglé),
 * avec la note de résolution du modérateur.
 *
 * Un dossier `OPEN` ne se traite qu'**une fois** : la garde de statut est dans
 * le `WHERE` (§11.3) et tout est journalisé (`REPORT_REVIEWED`).
 */
export async function resolveMarketReport(
    guildId: string,
    reportId: string,
    status: "REVIEWED" | "CLOSED",
    resolution?: string | null
): Promise<ActionResponse<{ status: "REVIEWED" | "CLOSED" }>> {
    try {
        const guard = await requireMarketModerator(guildId);
        if ("error" in guard) return { success: false, error: guard.error };

        const parsed = z.string().min(1).max(64).safeParse(reportId);
        if (!parsed.success) return { success: false, error: "Dossier introuvable" };
        const parsedStatus = z.enum(["REVIEWED", "CLOSED"]).safeParse(status);
        if (!parsedStatus.success) return { success: false, error: "Statut invalide" };

        const guildConfigId = await requireGuildConfigId(guildId);
        if (!guildConfigId) return { success: false, error: "Guilde introuvable" };

        const report = await db.marketReport.findFirst({
            where: { id: parsed.data, listing: { guildId: guildConfigId } },
            select: { id: true, status: true, listingId: true },
        });
        if (!report) return { success: false, error: "Dossier introuvable" };
        if (report.status !== "OPEN") return { success: false, error: "Ce dossier est déjà traité." };

        const note = sanitizeMarketText(resolution);
        const updated = await db.marketReport.updateMany({
            where: { id: report.id, status: "OPEN" }, // garde de statut (§11.3)
            data: {
                status: parsedStatus.data,
                reviewedByUserId: guard.user.id ?? null,
                reviewedAt: new Date(),
                resolution: note,
            },
        });
        if (updated.count === 0) return { success: false, error: "Ce dossier vient d'être traité." };

        await writeMarketAuditLog({
            guildId: guildConfigId,
            listingId: report.listingId,
            actorUserId: guard.user.id ?? null,
            action: MARKET_AUDIT_ACTIONS.REPORT_REVIEWED,
            previousData: { status: "OPEN" },
            nextData: { status: parsedStatus.data, reportId: report.id, resolution: note },
        });

        revalidatePath(`/dashboard/${guildId}/marche/moderation`);
        return { success: true, data: { status: parsedStatus.data } };
    } catch (error) {
        logger.error("[resolveMarketReport] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

