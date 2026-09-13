/**
 * Module « Marché » — cascade de retrait liée au cycle de vie du membre
 * (S5.11 / S8.20, §15.2 « Suppression de compte / profil archivé ⇒ les annonces
 * actives passent automatiquement `WITHDRAWN` »).
 *
 * Contexte : `closeMemberPublishedContent()` ferme déjà le contenu publié d'un
 * membre exclu (posts DJ, runs songes). Le Marché s'y branche pour que ses
 * annonces ne survivent pas à un archivage, un bannissement, un nettoyage RGPD
 * ou une suppression de compte — sans jamais bloquer ces opérations.
 *
 * Garanties (checklist §0 sécurité) :
 *   · **garde de statut DANS le `WHERE`** — chaque retrait est un `updateMany`
 *     conditionnel (`status in (DRAFT, ACTIVE, RESERVED)` + `deletedAt: null` +
 *     `profileId` + `guildId` **interne**) : une annonce vendue/retirée entre la
 *     lecture et l'écriture donne `count === 0` (jamais de « lire puis écrire »,
 *     §11.3) ;
 *   · **isolation multi-tenant** — le `guildId` utilisé est l'id **interne** de
 *     `GuildConfig` (résolu serveur depuis le snowflake, jamais reçu du client) ;
 *   · **audit** — une ligne `LISTING_WITHDRAWN` **par annonce** réellement
 *     retirée (`writeMarketAuditLog`, jamais bloquant) avec un motif **typé** ;
 *   · **non bloquant** — l'écriture Discord (`syncListingMessage`) est lancée
 *     sans être attendue : un Discord en panne laisse `syncStatus = FAILED`
 *     (rejouable en God) et **n'annule jamais** le retrait ;
 *   · **jamais d'exception** — le core renvoie son bilan (0 partout en cas
 *     d'erreur globale) : un échec marché ne peut pas faire échouer un
 *     archivage ni une suppression RGPD.
 *
 * ⚠️ Fichier **serveur partagé** : ni `"use server"` (ce n'est pas une server
 * action), ni React — testable directement (patron `maintenance.ts`).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { MARKET_AUDIT_ACTIONS, isMarketTransitionAllowed } from "@/server/actions/market-constants";
import { writeMarketAuditLog } from "@/server/market/audit";
import { syncListingMessage } from "@/server/market/discord";

/** Statuts encore retirables par la cascade (§11.1 : `SOLD` est hors périmètre). */
export const MARKET_WITHDRAWABLE_STATUSES = ["DRAFT", "ACTIVE", "RESERVED"] as const;

/** Taille du lot traité par passe : on ne bloque jamais la base (§15.1). */
export const MARKET_LIFECYCLE_BATCH_SIZE = 200;

/**
 * Motifs de retrait **typés** (union fermée) : le journal d'audit ne reçoit
 * jamais un texte libre — seule la raison bornée ci-dessous est écrite.
 */
export type MarketWithdrawReason =
    | "PROFILE_ARCHIVED"
    | "MEMBER_LEFT"
    | "MEMBER_BANNED"
    | "MEMBER_WIPED"
    | "MEMBER_DELETED"
    | "GDPR_DELETION";

/** Libellés FR des motifs de cascade (affichés dans le journal God/modération). */
export const MARKET_WITHDRAW_REASON_LABELS: Record<MarketWithdrawReason, string> = {
    PROFILE_ARCHIVED: "Profil archivé (membre inactif)",
    MEMBER_LEFT: "Membre parti du serveur Discord",
    MEMBER_BANNED: "Membre banni du serveur Discord",
    MEMBER_WIPED: "Profil nettoyé (RGPD, administration)",
    MEMBER_DELETED: "Profil supprimé par un administrateur",
    GDPR_DELETION: "Suppression de compte (RGPD)",
};

/**
 * Traduit le motif **libre** du cycle de vie en motif borné du marché.
 * Pur et déterministe : `ADMIN_ARCHIVED`/`USER_LEAVE` ⇒ archivage, etc.
 */
export function toMarketWithdrawReason(reason: string | null | undefined): MarketWithdrawReason {
    const raw = (reason ?? "").toUpperCase();
    if (raw.includes("GDPR")) return "GDPR_DELETION";
    if (raw.includes("WIPE")) return "MEMBER_WIPED";
    if (raw.includes("BANNED")) return "MEMBER_BANNED";
    if (raw.includes("DELETED")) return "MEMBER_DELETED";
    if (raw.includes("LEFT")) return "MEMBER_LEFT";
    return "PROFILE_ARCHIVED";
}

/** Bilan d'une passe de cascade (jamais d'exception : 0 partout en erreur). */
export type MarketLifecycleOutcome = {
    /** Annonces candidates lues (borné par le lot). */
    scanned: number;
    /** Annonces réellement passées `WITHDRAWN` (0 au 2ᵉ passage : idempotent). */
    withdrawn: number;
    /** Réécritures Discord **lancées** (non attendues : `syncStatus` visible en God). */
    syncDispatched: number;
};

/**
 * Retire les annonces encore vivantes d'un profil (`WITHDRAWN`).
 *
 * Cible : `DRAFT`/`ACTIVE`/`RESERVED`, non supprimées, **du même profil** et de
 * la **même guilde interne**. Ne lève jamais : renvoie le bilan de la passe.
 */
export async function withdrawMarketListingsForProfileCore(params: {
    /** `GuildConfig.id` **interne** (jamais le snowflake Discord, §16.2). */
    guildConfigId: string;
    /** `UserProfile.id` du membre exclu. */
    profileId: string;
    reason: MarketWithdrawReason;
    /** `User.id` de l'auteur — `null` = action système (cron, webhook, RGPD). */
    actorUserId?: string | null;
    /** Nombre max d'annonces traitées (défaut/plafond `MARKET_LIFECYCLE_BATCH_SIZE`). */
    limit?: number;
    /** Instant de référence (injecté par les tests ; défaut `new Date()`). */
    now?: Date;
}): Promise<MarketLifecycleOutcome> {
    const outcome: MarketLifecycleOutcome = { scanned: 0, withdrawn: 0, syncDispatched: 0 };

    try {
        if (!params.guildConfigId || !params.profileId) {
            logger.warn("[market] cascade WITHDRAWN : paramètres incomplets — passe ignorée");
            return outcome;
        }

        const limit = normalizeLimit(params.limit);
        const now = params.now ?? new Date();

        const due = await db.marketListing.findMany({
            where: {
                guildId: params.guildConfigId,
                profileId: params.profileId,
                status: { in: [...MARKET_WITHDRAWABLE_STATUSES] },
                deletedAt: null,
            },
            select: { id: true, status: true },
            orderBy: { updatedAt: "desc" },
            take: limit,
        });

        outcome.scanned = due.length;

        for (const listing of due) {
            try {
                // Garde de transition vérifiée **avant** l'écriture ; la vérité
                // reste le `WHERE` ci-dessous (deux passes concurrentes, ou un
                // membre qui vend dans l'intervalle, ne produisent rien).
                if (!isMarketTransitionAllowed(listing.status, "WITHDRAWN")) continue;

                const updated = await db.marketListing.updateMany({
                    // §11.3 — garde de statut DANS le `where` : jamais « lire puis écrire ».
                    where: {
                        id: listing.id,
                        guildId: params.guildConfigId,
                        profileId: params.profileId,
                        status: { in: [...MARKET_WITHDRAWABLE_STATUSES] },
                        deletedAt: null,
                    },
                    data: { status: "WITHDRAWN", withdrawnAt: now, lastActivityAt: now },
                });

                if (updated.count === 0) continue; // déjà passée ailleurs : rien à faire

                outcome.withdrawn += 1;

                // Journal par annonce (motif borné) — jamais bloquant (audit.ts).
                await writeMarketAuditLog({
                    guildId: params.guildConfigId,
                    listingId: listing.id,
                    actorUserId: params.actorUserId ?? null,
                    action: MARKET_AUDIT_ACTIONS.LISTING_WITHDRAWN,
                    previousData: { status: listing.status },
                    nextData: { status: "WITHDRAWN" },
                    reason: params.reason,
                });

                // Embed réécrit **en tâche de fond** (jamais attendu) : un échec
                // Discord laisse `syncStatus = FAILED`, rejouable en God (S3.8).
                outcome.syncDispatched += 1;
                void syncListingMessage(listing.id).catch((err) =>
                    logger.warn("[market] cascade : synchronisation Discord différée", {
                        listingId: listing.id,
                        err: String(err),
                    })
                );
            } catch (error) {
                // Isolation annonce par annonce : l'échec d'une annonce n'interrompt
                // jamais la passe ni le cycle de vie du membre appelant.
                logger.error("[market] cascade WITHDRAWN — annonce ignorée", {
                    listingId: listing.id,
                    err: String(error),
                });
            }
        }

        if (outcome.withdrawn > 0) {
            logger.info("[market] cascade WITHDRAWN terminée", {
                guildId: params.guildConfigId,
                reason: params.reason,
                ...outcome,
            });
        }

        return outcome;
    } catch (error) {
        logger.error("[market] withdrawMarketListingsForProfileCore failed", { err: error });
        return outcome;
    }
}


function normalizeLimit(limit?: number): number {
    const requested = limit ?? MARKET_LIFECYCLE_BATCH_SIZE;
    return Number.isFinite(requested) && requested > 0
        ? Math.min(Math.floor(requested), MARKET_LIFECYCLE_BATCH_SIZE)
        : MARKET_LIFECYCLE_BATCH_SIZE;
}

/**
 * Variante appelée par le **cycle de vie du membre** (`closeMemberPublishedContent`,
 * `wipeUserProfile`) : le snowflake Discord de la guilde arrive du hook, il est
 * **résolu côté serveur** en `GuildConfig.id` (aucun id client en entrée).
 *
 * Ne lève **jamais** et n'attend **jamais** Discord : l'archivage / la
 * suppression RGPD ne doivent pas dépendre du Marché.
 */
export async function withdrawMarketListingsForGuildMember(params: {
    /** Snowflake Discord de la guilde (fourni par le hook serveur). */
    discordGuildId: string;
    /** `UserProfile.id` **interne** du membre exclu. */
    profileId: string;
    /** Motif libre du cycle de vie (traduit en union bornée, jamais écrit tel quel). */
    reason: string;
    actorUserId?: string | null;
    now?: Date;
}): Promise<MarketLifecycleOutcome> {
    const outcome: MarketLifecycleOutcome = { scanned: 0, withdrawn: 0, syncDispatched: 0 };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: params.discordGuildId },
            select: { id: true },
        });
        if (!config) return outcome; // guilde inconnue : rien à isoler, rien à faire

        return await withdrawMarketListingsForProfileCore({
            guildConfigId: config.id,
            profileId: params.profileId,
            reason: toMarketWithdrawReason(params.reason),
            actorUserId: params.actorUserId ?? null,
            now: params.now,
        });
    } catch (error) {
        logger.error("[market] withdrawMarketListingsForGuildMember failed", { err: error });
        return outcome;
    }
}

