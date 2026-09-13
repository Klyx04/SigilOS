"use server";

/**
 * God « Marché » — actions **super-admin** de supervision (S8.18 / §18).
 *
 * 🔒 Règles de sécurité appliquées **sur chaque action** (checklist §0) :
 *   · `isSuperAdmin()` **fail-closed en tête de chaque action** — la page ne
 *     protège rien (une server action s'appelle directement) ; un sous-God, même
 *     avec la brique, est refusé ;
 *   · **agrégats cross-guild** réservés au super-admin (aucun admin de guilde ne
 *     passe par ici) ;
 *   · **jamais de snowflake en entrée** : les filtres ne reçoivent que des ids
 *     **internes** (`GuildConfig.id`, `MarketListing.id`) ;
 *   · **mutations tracées** par `createGodAuditLog()` (`isGodLog: true`, **sans**
 *     `guildId` de guilde ⇒ invisibles des admins de guilde) ;
 *   · **rate-limit** sur chaque mutation (fail-closed, `src/lib/ratelimit.ts`) ;
 *   · **Zod borné** partout, lectures bornées (`take`) ;
 *   · on appelle les **cores sans garde** (`syncListingMessage`,
 *     `regenerateMarketImage`, `reconcileMarketDiscordMessagesCore`,
 *     `purgeMarketListingMediaCore`) **après** le contrôle super-admin — jamais
 *     les actions `market:moderate` par guilde (élévation de privilège) ;
 *   · **aucun secret ni `lastError` brut** restitué : message masqué + tronqué.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { isSuperAdmin } from "./super-admin-actions";
import { createGodAuditLog } from "./audit-actions";
import { MARKET_AUDIT_ACTIONS, MARKET_SETTINGS_BOUNDS, marketAuditActionLabel } from "./market-constants";
import { buildMarketImageUrl } from "@/server/market/discord";

// ---------------------------------------------------------------------------
// BORNES (jamais pilotées par le client)
// ---------------------------------------------------------------------------

const GOD_MARKET_GUILD_LIMIT = 200;
const GOD_MARKET_HEALTH_LIMIT = 50;
const GOD_MARKET_LOG_LIMIT = 50;
const GOD_MARKET_LOG_LIMIT_MAX = 100;
const GOD_MARKET_RESYNC_BATCH_MAX = 50;
const GOD_MARKET_PURGE_BATCH_MAX = 200;
const GOD_MARKET_MUTATION_MAX_PER_MINUTE = 10;
const GOD_MARKET_LOCK_BATCH_MAX = 500;
/** Clé de module verrouillable par le staff (`GuildModules.disabledByGod`). */
const MARKET_MODULE_KEY = "marche";
/** Message d'erreur unique : on n'annonce jamais *pourquoi* l'accès est refusé. */
const GOD_MARKET_DENIED = "Accès refusé";

/** Chaînes longues type token/webhook : jamais restituées telles quelles au God. */
const TOKEN_LIKE = /[A-Za-z0-9_\-.]{40,}/g;

export type GodMarketResult<T> = { success: true; data: T } | { success: false; error: string };

// ---------------------------------------------------------------------------
// GARDES
// ---------------------------------------------------------------------------

/** Garde **fail-closed** : super-admin + session, sinon refus (jamais d'exception). */
async function requireSuperAdmin(): Promise<{ userId: string } | { error: string }> {
    const isGod = await isSuperAdmin();
    if (!isGod) return { error: GOD_MARKET_DENIED };

    const session = await auth();
    if (!session?.user?.id) return { error: GOD_MARKET_DENIED };

    return { userId: session.user.id };
}

/** Rate-limit des mutations God (jamais appliqué aux lectures). */
async function godMarketRateLimit(userId: string, action: string): Promise<string | null> {
    const { success } = await rateLimit(`god-market:${action}:${userId}`, GOD_MARKET_MUTATION_MAX_PER_MINUTE, 60_000);
    return success ? null : "Trop de requêtes, réessaie dans quelques secondes.";
}

/**
 * Masque l'erreur Discord stockée avant restitution : tronquée et débarrassée
 * de toute chaîne longue (token, webhook, URL signée). Jamais dans une notif.
 */
function maskLastError(value: string | null): string | null {
    if (!value) return null;
    return value.replace(TOKEN_LIKE, "<masqué>").slice(0, 160);
}

// ---------------------------------------------------------------------------
// LECTURE — indicateurs, santé Discord, médias, journal (§18.2)
// ---------------------------------------------------------------------------

/** Ligne « par guilde » : ids **internes** uniquement, aucun snowflake exposé. */
export type GodMarketGuildRow = {
    /** `GuildConfig.id` interne — sert de filtre aux actions, jamais un snowflake. */
    id: string;
    name: string;
    /** Module effectivement actif (bascule guilde **et** absence de verrou God). */
    moduleEnabled: boolean;
    /** Verrou plateforme posé par le staff (`GuildModules.disabledByGod`). */
    lockedByGod: boolean;
    active: number;
    reserved: number;
    draft: number;
    sold: number;
    withdrawn: number;
    mediaRetentionDays: number;
    logRetentionDays: number;
};

/** Ligne « santé Discord » : ce qui diverge entre la base et les salons. */
export type GodMarketHealthRow = {
    listingId: string;
    listingTitle: string;
    guildName: string | null;
    listingStatus: string;
    syncStatus: string;
    /** Dernière erreur Discord **masquée** (jamais de token, jamais en notif). */
    lastError: string | null;
    lastSyncedAt: string;
    /** URL OG **versionnée** par `statsHash` (carte rejouable telle qu'affichée). */
    imageUrl: string;
};

/** Ligne du journal d'audit du marché (libellé FR, jamais l'action brute). */
export type GodMarketLogRow = {
    id: string;
    action: string;
    actionLabel: string;
    guildName: string | null;
    listingId: string | null;
    reason: string | null;
    createdAt: string;
};

export type GodMarketOverview = {
    totals: {
        active: number;
        reserved: number;
        draft: number;
        sold: number;
        withdrawn: number;
        deleted: number;
        offersPending: number;
        reservationsActive: number;
        reportsOpen: number;
        mediaCount: number;
        mediaBytes: number;
        syncFailed: number;
        syncPending: number;
    };
    guilds: GodMarketGuildRow[];
    health: GodMarketHealthRow[];
    logs: GodMarketLogRow[];
    settings: {
        guildCount: number;
        lockedCount: number;
        enabledCount: number;
        mediaRetentionDaysInUse: number[];
        logRetentionDaysInUse: number[];
        /**
         * T4 (D-B) — **défauts globaux** de durées / plafonds, mêmes « valeurs en
         * base » que la rétention : le God fixe les valeurs une fois pour toutes
         * les guildes. Les tableaux listent les valeurs **réellement en base**
         * (dédupliquées, triées) pour que le staff voie ce qui est appliqué.
         */
        marketMaxActivePerMemberInUse: number[];
        marketDefaultDurationDaysInUse: number[];
        marketMaxLifetimeDaysInUse: number[];
        marketReminderDaysInUse: number[];
        marketReservationHoursInUse: number[];
        marketOfferHoursInUse: number[];
        negotiationsEnabledInUse: boolean[];
    };
};

/** Compteurs de statuts à zéro (6 valeurs d'enum : borne implicite du `groupBy`). */
const EMPTY_STATUS_COUNTS: Record<string, number> = {
    DRAFT: 0,
    ACTIVE: 0,
    RESERVED: 0,
    SOLD: 0,
    EXPIRED: 0,
    WITHDRAWN: 0,
};

/** Valeurs numériques **distinctes** réellement en base (tri croissant). */
function uniqueSortedNumbers(values: number[]): number[] {
    return [...new Set(values)].sort((a, b) => a - b);
}

/**
 * `GuildConfig.marketReminderDays` est une colonne **Json** (`@default("[7, 15]")`) :
 * on n'expose que des entiers **bornés** (jamais la valeur brute, jamais un
 * `string`/`null` égaré qui ferait planter l'affichage).
 */
function reminderDaysFromJson(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    const { min, max } = MARKET_SETTINGS_BOUNDS.marketReminderDays;
    return value.filter(
        (entry): entry is number => typeof entry === "number" && Number.isInteger(entry) && entry >= min && entry <= max
    );
}


/**
 * Vue d'ensemble **cross-guild** réservée au super-admin (§18.2).
 * Toutes les lectures sont bornées (`take`) et n'exposent aucune donnée
 * personnelle : des compteurs, des noms de guilde et des ids internes.
 */
export async function getGodMarketOverview(): Promise<GodMarketResult<GodMarketOverview>> {
    const guard = await requireSuperAdmin();
    if ("error" in guard) return { success: false, error: guard.error };

    try {
        const [
            guilds,
            statusGroups,
            deleted,
            offersPending,
            reservationsActive,
            reportsOpen,
            mediaCount,
            mediaAggregate,
            syncGroups,
        ] = await Promise.all([
            db.guildConfig.findMany({
                select: {
                    id: true,
                    name: true,
                    marketMediaRetentionDays: true,
                    marketLogRetentionDays: true,
                    // T4 (D-B) — défauts globaux de durées / plafonds (§9.1, §11).
                    marketMaxActivePerMember: true,
                    marketDefaultDurationDays: true,
                    marketMaxLifetimeDays: true,
                    marketReminderDays: true,
                    marketReservationHours: true,
                    marketOfferHours: true,
                    marketNegotiationsEnabled: true,
                    modules: { select: { marche: true, disabledByGod: true } },
                },
                orderBy: { name: "asc" },
                take: GOD_MARKET_GUILD_LIMIT,
            }),
            db.marketListing.groupBy({
                by: ["guildId", "status"],
                where: { deletedAt: null },
                _count: { _all: true },
            }),
            db.marketListing.count({ where: { deletedAt: { not: null } } }),
            db.marketOffer.count({ where: { status: "PENDING" } }),
            db.marketReservation.count({ where: { status: "ACTIVE" } }),
            db.marketReport.count({ where: { status: "OPEN" } }),
            db.marketListingMedia.count(),
            db.marketListingMedia.aggregate({ _sum: { sizeBytes: true } }),
            db.marketDiscordMessage.groupBy({ by: ["syncStatus"], _count: { _all: true } }),
        ]);

        const statusByGuild = new Map<string, Record<string, number>>();
        for (const group of statusGroups) {
            const current = statusByGuild.get(group.guildId) ?? { ...EMPTY_STATUS_COUNTS };
            current[group.status] = group._count._all;
            statusByGuild.set(group.guildId, current);
        }

        const guildRows: GodMarketGuildRow[] = guilds.map((guild) => {
            const counts = statusByGuild.get(guild.id) ?? { ...EMPTY_STATUS_COUNTS };
            const lockedByGod = (guild.modules?.disabledByGod ?? []).includes(MARKET_MODULE_KEY);
            return {
                id: guild.id,
                name: guild.name,
                lockedByGod,
                moduleEnabled: Boolean(guild.modules?.marche) && !lockedByGod,
                active: counts.ACTIVE ?? 0,
                reserved: counts.RESERVED ?? 0,
                draft: counts.DRAFT ?? 0,
                sold: counts.SOLD ?? 0,
                withdrawn: counts.WITHDRAWN ?? 0,
                mediaRetentionDays: guild.marketMediaRetentionDays,
                logRetentionDays: guild.marketLogRetentionDays,
            };
        });

        const nameById = new Map(guilds.map((guild) => [guild.id, guild.name]));


        const healthRows = await db.marketDiscordMessage.findMany({
            where: { syncStatus: { in: ["FAILED", "PENDING"] }, listing: { deletedAt: null } },
            select: {
                listingId: true,
                syncStatus: true,
                lastError: true,
                lastSyncedAt: true,
                listing: { select: { title: true, status: true, statsHash: true, guildId: true } },
            },
            orderBy: { lastSyncedAt: "desc" },
            take: GOD_MARKET_HEALTH_LIMIT,
        });

        const logs = await db.marketAuditLog.findMany({
            orderBy: { createdAt: "desc" },
            select: { id: true, action: true, guildId: true, listingId: true, reason: true, createdAt: true },
            take: GOD_MARKET_LOG_LIMIT,
        });

        const totals = { ...EMPTY_STATUS_COUNTS };
        for (const group of statusGroups) {
            totals[group.status] = (totals[group.status] ?? 0) + group._count._all;
        }
        const syncByStatus = new Map(syncGroups.map((group) => [group.syncStatus, group._count._all]));

        return {
            success: true,
            data: {
                totals: {
                    draft: totals.DRAFT,
                    active: totals.ACTIVE,
                    reserved: totals.RESERVED,
                    sold: totals.SOLD,
                    withdrawn: totals.WITHDRAWN,
                    deleted,
                    offersPending,
                    reservationsActive,
                    reportsOpen,
                    mediaCount,
                    mediaBytes: mediaAggregate._sum.sizeBytes ?? 0,
                    syncFailed: syncByStatus.get("FAILED") ?? 0,
                    syncPending: syncByStatus.get("PENDING") ?? 0,
                },
                guilds: guildRows,
                health: healthRows.map((row) => ({
                    listingId: row.listingId,
                    listingTitle: row.listing.title,
                    guildName: nameById.get(row.listing.guildId) ?? null,
                    listingStatus: row.listing.status,
                    syncStatus: row.syncStatus,
                    lastError: maskLastError(row.lastError),
                    lastSyncedAt: row.lastSyncedAt.toISOString(),
                    imageUrl: buildMarketImageUrl(row.listingId, row.listing.statsHash),
                })),
                logs: logs.map((log) => ({
                    id: log.id,
                    action: log.action,
                    actionLabel: marketAuditActionLabel(log.action),
                    guildName: nameById.get(log.guildId) ?? null,
                    listingId: log.listingId,
                    reason: log.reason,
                    createdAt: log.createdAt.toISOString(),
                })),
                settings: {
                    guildCount: guilds.length,
                    lockedCount: guildRows.filter((row) => row.lockedByGod).length,
                    enabledCount: guildRows.filter((row) => row.moduleEnabled).length,
                    mediaRetentionDaysInUse: uniqueSortedNumbers(guilds.map((g) => g.marketMediaRetentionDays)),
                    logRetentionDaysInUse: uniqueSortedNumbers(guilds.map((g) => g.marketLogRetentionDays)),
                    marketMaxActivePerMemberInUse: uniqueSortedNumbers(
                        guilds.map((g) => g.marketMaxActivePerMember)
                    ),
                    marketDefaultDurationDaysInUse: uniqueSortedNumbers(
                        guilds.map((g) => g.marketDefaultDurationDays)
                    ),
                    marketMaxLifetimeDaysInUse: uniqueSortedNumbers(guilds.map((g) => g.marketMaxLifetimeDays)),
                    marketReminderDaysInUse: uniqueSortedNumbers(
                        guilds.flatMap((g) => reminderDaysFromJson(g.marketReminderDays))
                    ),
                    marketReservationHoursInUse: uniqueSortedNumbers(guilds.map((g) => g.marketReservationHours)),
                    marketOfferHoursInUse: uniqueSortedNumbers(guilds.map((g) => g.marketOfferHours)),
                    negotiationsEnabledInUse: [...new Set(guilds.map((g) => g.marketNegotiationsEnabled))],
                },
            },
        };
    } catch (error) {
        logger.error("[god-market] getGodMarketOverview failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


// ---------------------------------------------------------------------------
// MUTATIONS — santé Discord, image, médias, réglages globaux
// ---------------------------------------------------------------------------

/** Bilan d'une resynchronisation God (ciblée **ou** par lot, cross-guild). */
export type GodMarketResyncOutcome = {
    mode: "SINGLE" | "BATCH";
    scanned: number;
    resynced: number;
    recreated: number;
    stillFailed: number;
    skipped: number;
    hasMore: boolean;
    messageId?: string | null;
};

/** Id **interne** d'annonce (jamais un snowflake : Zod + longueur bornée). */
const listingIdSchema = z.string().min(1).max(64);

/** Ciblage de resynchronisation : une annonce **ou** un lot (jamais les deux vides). */
const resyncSchema = z
    .object({
        listingId: listingIdSchema.optional(),
        limit: z.number().int().min(1).max(GOD_MARKET_RESYNC_BATCH_MAX).optional(),
    })
    .refine((value) => Boolean(value.listingId) || value.limit !== undefined, {
        message: "Aucun ciblage fourni",
    });

/**
 * Rejoue la synchronisation Discord d'une annonce (ciblée) ou d'un lot
 * d'annonces divergentes (`reconcileMarketDiscordMessagesCore`, cross-guild).
 *
 * Les cores sont appelés **sans** leur garde par guilde : le contrôle
 * `isSuperAdmin()` ci-dessus en tient lieu (jamais `market:moderate`, qui
 * exigerait la permission **dans** la guilde = élévation de privilège).
 */
export async function resyncGodMarketDiscord(params: {
    listingId?: string;
    limit?: number;
}): Promise<GodMarketResult<GodMarketResyncOutcome>> {
    const guard = await requireSuperAdmin();
    if ("error" in guard) return { success: false, error: guard.error };

    const parsed = resyncSchema.safeParse(params);
    if (!parsed.success) return { success: false, error: "Paramètres invalides" };

    const limited = await godMarketRateLimit(guard.userId, "resync");
    if (limited) return { success: false, error: limited };

    try {
        if (parsed.data.listingId) {
            const listingExists = await db.marketListing.findFirst({
                where: { id: parsed.data.listingId },
                select: { id: true },
            });
            if (!listingExists) return { success: false, error: "Annonce introuvable" };

            const { syncListingMessage } = await import("@/server/market/discord");
            const result = await syncListingMessage(listingExists.id);

            await createGodAuditLog({
                action: "GOD_MARKET_RESYNC",
                targetType: "DATA_SYNC",
                targetId: listingExists.id,
                newValue: { mode: "SINGLE", ok: result.ok, messageId: result.messageId ?? null },
                metadata: { listingId: listingExists.id },
            });

            revalidatePath("/god");

            return {
                success: true,
                data: {
                    mode: "SINGLE",
                    scanned: 1,
                    resynced: result.ok ? 1 : 0,
                    recreated: 0,
                    stillFailed: result.ok ? 0 : 1,
                    skipped: result.skipped ? 1 : 0,
                    hasMore: false,
                    messageId: result.messageId ?? null,
                },
            };
        }

        const { reconcileMarketDiscordMessagesCore } = await import("@/server/market/maintenance");
        const outcome = await reconcileMarketDiscordMessagesCore({
            limit: parsed.data.limit,
            actorUserId: guard.userId,
        });

        await createGodAuditLog({
            action: "GOD_MARKET_RESYNC",
            targetType: "DATA_SYNC",
            newValue: { mode: "BATCH", ...outcome },
            metadata: { limit: parsed.data.limit ?? null },
        });

        revalidatePath("/god");
        return { success: true, data: { mode: "BATCH", ...outcome } };
    } catch (error) {
        logger.error("[god-market] resyncGodMarketDiscord failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

/**
 * Régénère la carte PNG d'une annonce puis réécrit son embed (URL OG
 * **versionnée** par `statsHash`, `buildMarketImageUrl`).
 */
export async function regenerateGodMarketImage(params: {
    listingId: string;
}): Promise<GodMarketResult<{ messageId: string | null }>> {
    const guard = await requireSuperAdmin();
    if ("error" in guard) return { success: false, error: guard.error };

    const parsed = z.object({ listingId: listingIdSchema }).safeParse(params);
    if (!parsed.success) return { success: false, error: "Paramètres invalides" };

    const limited = await godMarketRateLimit(guard.userId, "image");
    if (limited) return { success: false, error: limited };

    try {
        const listing = await db.marketListing.findFirst({
            where: { id: parsed.data.listingId },
            select: { id: true },
        });
        if (!listing) return { success: false, error: "Annonce introuvable" };

        const { regenerateMarketImage } = await import("@/server/market/discord");
        const result = await regenerateMarketImage(listing.id);

        await createGodAuditLog({
            action: "GOD_MARKET_IMAGE_REGEN",
            targetType: "DATA_SYNC",
            targetId: listing.id,
            newValue: { ok: result.ok, messageId: result.messageId ?? null },
        });

        revalidatePath("/god");
        if (!result.ok) return { success: false, error: result.error || "Régénération impossible" };
        return { success: true, data: { messageId: result.messageId ?? null } };
    } catch (error) {
        logger.error("[god-market] regenerateGodMarketImage failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


/**
 * Purge les médias expirés de **toutes** les guildes (cross-guild, lot borné).
 * Le core est appelé après le contrôle super-admin : l'action par guilde
 * (`purgeMarketMedia`) exigerait `market:moderate` **dans** la guilde.
 */
export async function purgeGodMarketMedia(params: {
    limit?: number;
}): Promise<
    GodMarketResult<{
        scanned: number;
        purgedListings: number;
        mediaDeleted: number;
        bytesDeleted: number;
        filesFailed: number;
        failed: number;
        hasMore: boolean;
    }>
> {
    const guard = await requireSuperAdmin();
    if ("error" in guard) return { success: false, error: guard.error };

    const parsed = z
        .object({ limit: z.number().int().min(1).max(GOD_MARKET_PURGE_BATCH_MAX).optional() })
        .safeParse(params);
    if (!parsed.success) return { success: false, error: "Paramètres invalides" };

    const limited = await godMarketRateLimit(guard.userId, "purge");
    if (limited) return { success: false, error: limited };

    try {
        const { purgeMarketListingMediaCore } = await import("@/server/market/retention");
        const outcome = await purgeMarketListingMediaCore({
            limit: parsed.data.limit,
            actorUserId: guard.userId,
        });

        await createGodAuditLog({
            action: "GOD_MARKET_MEDIA_PURGE",
            targetType: "SYSTEM_GOD",
            newValue: {
                purgedListings: outcome.purgedListings,
                mediaDeleted: outcome.mediaDeleted,
                bytesDeleted: outcome.bytesDeleted,
                filesFailed: outcome.filesFailed,
                failed: outcome.failed,
            },
            metadata: { limit: parsed.data.limit ?? null },
        });

        revalidatePath("/god");
        return {
            success: true,
            data: {
                scanned: outcome.scanned,
                purgedListings: outcome.purgedListings,
                mediaDeleted: outcome.mediaDeleted,
                bytesDeleted: outcome.bytesDeleted,
                filesFailed: outcome.filesFailed,
                failed: outcome.failed,
                hasMore: outcome.hasMore,
            },
        };
    } catch (error) {
        logger.error("[god-market] purgeGodMarketMedia failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


/** Bornes issues de `MARKET_SETTINGS_BOUNDS` : jamais de valeur libre côté client. */
const godMarketSettingsSchema = z
    .object({
        /** `true` = verrou plateforme du module, `false` = déverrouillage. */
        lockModule: z.boolean().optional(),
        mediaRetentionDays: z
            .number()
            .int()
            .min(MARKET_SETTINGS_BOUNDS.marketMediaRetentionDays.min)
            .max(MARKET_SETTINGS_BOUNDS.marketMediaRetentionDays.max)
            .optional(),
        logRetentionDays: z
            .number()
            .int()
            .min(MARKET_SETTINGS_BOUNDS.marketLogRetentionDays.min)
            .max(MARKET_SETTINGS_BOUNDS.marketLogRetentionDays.max)
            .optional(),
        // ── T4 (D-B) — **défauts globaux** « Durées, plafonds & rappels » ─────
        // Mêmes bornes et mêmes noms de colonnes que le schéma de guilde
        // (`market-admin-actions.ts`) : le God pousse **une** fois pour toutes
        // les guildes, le panneau de guilde ne sert plus que d'exception.
        marketMaxActivePerMember: z
            .number()
            .int()
            .min(MARKET_SETTINGS_BOUNDS.marketMaxActivePerMember.min)
            .max(MARKET_SETTINGS_BOUNDS.marketMaxActivePerMember.max)
            .optional(),
        marketDefaultDurationDays: z
            .number()
            .int()
            .min(MARKET_SETTINGS_BOUNDS.marketDefaultDurationDays.min)
            .max(MARKET_SETTINGS_BOUNDS.marketDefaultDurationDays.max)
            .optional(),
        marketMaxLifetimeDays: z
            .number()
            .int()
            .min(MARKET_SETTINGS_BOUNDS.marketMaxLifetimeDays.min)
            .max(MARKET_SETTINGS_BOUNDS.marketMaxLifetimeDays.max)
            .optional(),
        marketReminderDays: z
            .array(
                z
                    .number()
                    .int()
                    .min(MARKET_SETTINGS_BOUNDS.marketReminderDays.min)
                    .max(MARKET_SETTINGS_BOUNDS.marketReminderDays.max)
            )
            .min(1)
            .max(3)
            .optional(),
        marketReservationHours: z
            .number()
            .int()
            .min(MARKET_SETTINGS_BOUNDS.marketReservationHours.min)
            .max(MARKET_SETTINGS_BOUNDS.marketReservationHours.max)
            .optional(),
        marketOfferHours: z
            .number()
            .int()
            .min(MARKET_SETTINGS_BOUNDS.marketOfferHours.min)
            .max(MARKET_SETTINGS_BOUNDS.marketOfferHours.max)
            .optional(),
        marketNegotiationsEnabled: z.boolean().optional(),
    })
    .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
        message: "Aucun réglage fourni",
    });

/**
 * Réglages **globaux** du Marché — **aucune migration** : uniquement des
 * colonnes existantes.
 *
 *   · **verrou plateforme** ⇒ `GuildModules.disabledByGod` (nom de module) :
 *     le module est effectivement OFF dans **toutes** les guildes, la bascule
 *     guilde est conservée ;
 *   · **rétention** ⇒ `GuildConfig.marketMediaRetentionDays` /
 *     `marketLogRetentionDays`, appliqués en **un** `updateMany` borné ;
 *   · **T4 (D-B) — durées, plafonds & rappels** ⇒ les 7 colonnes globales
 *     (`marketMaxActivePerMember`, `marketDefaultDurationDays`,
 *     `marketMaxLifetimeDays`, `marketReminderDays`, `marketReservationHours`,
 *     `marketOfferHours`, `marketNegotiationsEnabled`) : le God fixe les valeurs
 *     **une fois pour toutes les guildes** (même modèle que la rétention), le
 *     panneau de guilde devenant un écran **facultatif** (exception locale).
 *
 * Chaque passe est gardée par la valeur courante (`WHERE`) ou bornée par Zod,
 * donc idempotente même en cas d'appels concurrents. **Toute** mutation est
 * auditée (`createGodAuditLog`, `isGodLog: true`) et précédée d'un
 * `isSuperAdmin()` **fail-closed** + d'un rate-limit God.
 */
export async function saveGodMarketSettings(params: {
    lockModule?: boolean;
    mediaRetentionDays?: number;
    logRetentionDays?: number;
    marketMaxActivePerMember?: number;
    marketDefaultDurationDays?: number;
    marketMaxLifetimeDays?: number;
    marketReminderDays?: number[];
    marketReservationHours?: number;
    marketOfferHours?: number;
    marketNegotiationsEnabled?: boolean;
}): Promise<
    GodMarketResult<{ lockedGuilds: number; retentionUpdated: boolean; settingsUpdated: boolean }>
> {
    const guard = await requireSuperAdmin();
    if ("error" in guard) return { success: false, error: guard.error };

    const parsed = godMarketSettingsSchema.safeParse(params);
    if (!parsed.success) return { success: false, error: "Paramètres invalides" };

    const limited = await godMarketRateLimit(guard.userId, "settings");
    if (limited) return { success: false, error: limited };

    try {
        let lockedGuilds = 0;

        if (parsed.data.lockModule !== undefined) {
            const locked = parsed.data.lockModule;
            const rows = await db.guildModules.findMany({
                select: { id: true, disabledByGod: true },
                take: GOD_MARKET_LOCK_BATCH_MAX,
            });

            const toUpdate = rows.filter((row) => row.disabledByGod.includes(MARKET_MODULE_KEY) !== locked);
            for (const row of toUpdate) {
                const next = locked
                    ? [...new Set([...row.disabledByGod, MARKET_MODULE_KEY])]
                    : row.disabledByGod.filter((key) => key !== MARKET_MODULE_KEY);

                // Garde d'idempotence : la valeur lue doit être encore celle en base.
                const updated = await db.guildModules.updateMany({
                    where: { id: row.id, disabledByGod: { equals: row.disabledByGod } },
                    data: { disabledByGod: { set: next } },
                });
                lockedGuilds += updated.count;
            }
        }

        let retentionUpdated = false;
        if (parsed.data.mediaRetentionDays !== undefined || parsed.data.logRetentionDays !== undefined) {
            await db.guildConfig.updateMany({
                data: {
                    ...(parsed.data.mediaRetentionDays !== undefined
                        ? { marketMediaRetentionDays: parsed.data.mediaRetentionDays }
                        : {}),
                    ...(parsed.data.logRetentionDays !== undefined
                        ? { marketLogRetentionDays: parsed.data.logRetentionDays }
                        : {}),
                },
            });
            retentionUpdated = true;
        }

        // T4 (D-B) — **défauts globaux** « Durées, plafonds & rappels » : un seul
        // `updateMany` sur toutes les guildes, avec des valeurs **déjà bornées**
        // par `MARKET_SETTINGS_BOUNDS` (Zod) — jamais une valeur libre du client.
        const settingsUpdated =
            parsed.data.marketMaxActivePerMember !== undefined ||
            parsed.data.marketDefaultDurationDays !== undefined ||
            parsed.data.marketMaxLifetimeDays !== undefined ||
            parsed.data.marketReminderDays !== undefined ||
            parsed.data.marketReservationHours !== undefined ||
            parsed.data.marketOfferHours !== undefined ||
            parsed.data.marketNegotiationsEnabled !== undefined;

        if (settingsUpdated) {
            await db.guildConfig.updateMany({
                data: {
                    ...(parsed.data.marketMaxActivePerMember !== undefined
                        ? { marketMaxActivePerMember: parsed.data.marketMaxActivePerMember }
                        : {}),
                    ...(parsed.data.marketDefaultDurationDays !== undefined
                        ? { marketDefaultDurationDays: parsed.data.marketDefaultDurationDays }
                        : {}),
                    ...(parsed.data.marketMaxLifetimeDays !== undefined
                        ? { marketMaxLifetimeDays: parsed.data.marketMaxLifetimeDays }
                        : {}),
                    ...(parsed.data.marketReminderDays !== undefined
                        ? { marketReminderDays: parsed.data.marketReminderDays }
                        : {}),
                    ...(parsed.data.marketReservationHours !== undefined
                        ? { marketReservationHours: parsed.data.marketReservationHours }
                        : {}),
                    ...(parsed.data.marketOfferHours !== undefined
                        ? { marketOfferHours: parsed.data.marketOfferHours }
                        : {}),
                    ...(parsed.data.marketNegotiationsEnabled !== undefined
                        ? { marketNegotiationsEnabled: parsed.data.marketNegotiationsEnabled }
                        : {}),
                },
            });
        }

        await createGodAuditLog({
            action: "GOD_MARKET_SETTINGS",
            targetType: "CONFIG",
            newValue: {
                lockModule: parsed.data.lockModule ?? null,
                lockedGuilds,
                mediaRetentionDays: parsed.data.mediaRetentionDays ?? null,
                logRetentionDays: parsed.data.logRetentionDays ?? null,
                marketMaxActivePerMember: parsed.data.marketMaxActivePerMember ?? null,
                marketDefaultDurationDays: parsed.data.marketDefaultDurationDays ?? null,
                marketMaxLifetimeDays: parsed.data.marketMaxLifetimeDays ?? null,
                marketReminderDays: parsed.data.marketReminderDays ?? null,
                marketReservationHours: parsed.data.marketReservationHours ?? null,
                marketOfferHours: parsed.data.marketOfferHours ?? null,
                marketNegotiationsEnabled: parsed.data.marketNegotiationsEnabled ?? null,
            },
        });

        revalidatePath("/god");
        return { success: true, data: { lockedGuilds, retentionUpdated, settingsUpdated } };
    } catch (error) {
        logger.error("[god-market] saveGodMarketSettings failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}


/**
 * Journal d'audit du marché (cross-guild), filtrable par **id interne** de
 * guilde et par action connue. Lecture : super-admin uniquement, `take` borné.
 */
export async function listGodMarketAuditLogs(params: {
    limit?: number;
    action?: string;
    guildConfigId?: string;
}): Promise<GodMarketResult<GodMarketLogRow[]>> {
    const guard = await requireSuperAdmin();
    if ("error" in guard) return { success: false, error: guard.error };

    const knownActions = Object.values(MARKET_AUDIT_ACTIONS) as string[];
    const parsed = z
        .object({
            limit: z.number().int().min(1).max(GOD_MARKET_LOG_LIMIT_MAX).optional(),
            action: z
                .string()
                .min(1)
                .max(64)
                .refine((value) => knownActions.includes(value), { message: "Action inconnue" })
                .optional(),
            guildConfigId: z.string().min(1).max(64).optional(),
        })
        .safeParse(params);
    if (!parsed.success) return { success: false, error: "Paramètres invalides" };

    try {
        const logs = await db.marketAuditLog.findMany({
            where: {
                ...(parsed.data.action ? { action: parsed.data.action } : {}),
                ...(parsed.data.guildConfigId ? { guildId: parsed.data.guildConfigId } : {}),
            },
            orderBy: { createdAt: "desc" },
            select: { id: true, action: true, guildId: true, listingId: true, reason: true, createdAt: true },
            take: parsed.data.limit ?? GOD_MARKET_LOG_LIMIT,
        });

        const guildIds = [...new Set(logs.map((log) => log.guildId))];
        const guilds = guildIds.length
            ? await db.guildConfig.findMany({
                  where: { id: { in: guildIds } },
                  select: { id: true, name: true },
                  take: GOD_MARKET_GUILD_LIMIT,
              })
            : [];
        const nameById = new Map(guilds.map((guild) => [guild.id, guild.name]));

        return {
            success: true,
            data: logs.map((log) => ({
                id: log.id,
                action: log.action,
                actionLabel: marketAuditActionLabel(log.action),
                guildName: nameById.get(log.guildId) ?? null,
                listingId: log.listingId,
                reason: log.reason,
                createdAt: log.createdAt.toISOString(),
            })),
        };
    } catch (error) {
        logger.error("[god-market] listGodMarketAuditLogs failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

