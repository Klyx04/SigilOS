/**
 * Module « Marché » — fin de vie automatique de l'annonce (§11.6, §15.1).
 *
 * ⚠️ Fichier **serveur partagé** : ni `"use server"` (ce n'est pas un server
 * action), ni React. Il porte l'**unique** implémentation des expirations du
 * marché, appelée par le cron `/api/cron/market-expire` (S5.1) — les rappels
 * J+7/J+15 (S5.2) vivent ici aussi. L'expiration des **réservations** n'est pas
 * dupliquée : elle vit dans `reservations.ts` (`expireMarketReservationsCore`).
 *
 * Garde-fous obligatoires de la passe (§15.1) :
 *   · **idempotente** — chaque écriture est gardée par un `updateMany`
 *     conditionnel (statut + échéance + `deletedAt`) : une passe rejouée trouve
 *     **zéro** ligne à écrire ;
 *   · **par lots** (`MARKET_EXPIRY_BATCH_SIZE`) : jamais de plein-scan bloquant ;
 *   · **isolée annonce par annonce** : l'échec d'un élément n'interrompt jamais
 *     la passe, il est logué et le suivant continue ;
 *   · **Discord non bloquant** : la base est écrite d'abord ; un échec Discord
 *     laisse `syncStatus = FAILED` (rejouable en God S3.8 / réconciliation S5.4)
 *     et n'annule **jamais** l'archivage ;
 *   · **aucune suppression dure** (§13.5) : `deletedAt` + `deletedReason`
 *     seulement — la purge physique relève de la rétention (S5.5).
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { MARKET_AUDIT_ACTIONS, MARKET_DELETE_REASONS } from "@/server/actions/market-constants";
import { writeMarketAuditLog } from "@/server/market/audit";
import { deleteListingDiscordMessage } from "@/server/market/discord";
import { notifyMarketBuyerActivity, notifyMarketUser } from "@/server/market/notifications";

/** Taille d'un lot d'une passe (§15.1 : « 200 annonces par passe »). */
export const MARKET_EXPIRY_BATCH_SIZE = 200;

/**
 * §11.6 — définition **serveur** d'« aucune activité » : aucune offre
 * `PENDING`/`ACCEPTED`, aucune réservation `ACTIVE`/`COMPLETED`. Calculée sur les
 * **relations**, jamais sur un compteur déclaratif : une annonce vendue ou en
 * cours de vente n'est donc jamais retirée par le cron (§15.1, garde-fou).
 */
export const MARKET_NO_ACTIVITY_WHERE: Prisma.MarketListingWhereInput = {
    offers: { none: { status: { in: ["PENDING", "ACCEPTED"] } } },
    reservations: { none: { status: { in: ["ACTIVE", "COMPLETED"] } } },
};

/** Paramètres communs des passes (bornés ici, jamais pilotés par le client). */
export type MarketExpiryPass = {
    /** Nombre max d'éléments traités (défaut `MARKET_EXPIRY_BATCH_SIZE`). */
    limit?: number;
    /** Instant de référence (injecté par les tests ; défaut `new Date()`). */
    now?: Date;
    /** Isolation multi-tenant interne (`GuildConfig.id`, jamais un snowflake). */
    guildConfigId?: string;
};

function normalizePass(params: MarketExpiryPass): { limit: number; now: Date } {
    const requested = params.limit ?? MARKET_EXPIRY_BATCH_SIZE;
    const limit = Number.isFinite(requested) && requested > 0
        ? Math.min(Math.floor(requested), MARKET_EXPIRY_BATCH_SIZE)
        : MARKET_EXPIRY_BATCH_SIZE;

    return { limit, now: params.now ?? new Date() };
}

// ---------------------------------------------------------------------------
// J+20 — RETRAIT AUTOMATIQUE DE L'ANNONCE (§11.6)
// ---------------------------------------------------------------------------

export type MarketListingExpiryOutcome = {
    /** Annonces éligibles lues dans la passe (borné par le lot). */
    scanned: number;
    /** Annonces archivées (`deletedAt` posé) — **0** au 2ᵉ passage : idempotent. */
    deleted: number;
    /** Messages/posts Discord réellement supprimés. */
    discordDeleted: number;
    /** Retraits Discord en échec (`syncStatus = FAILED`, rejouables en God). */
    discordFailed: number;
    /** Vendeurs prévenus (`MARKET_ARCHIVED`). */
    notified: number;
    /** Le lot était plein : le reste part à la passe suivante (10 min). */
    hasMore: boolean;
};

/**
 * Archive les annonces arrivées à échéance **sans aucune activité** (§11.6).
 *
 * Cible : `ACTIVE`/`RESERVED` (jamais `SOLD`) dont `expiresAt < now()`, filtrées
 * par `MARKET_NO_ACTIVITY_WHERE`. Le cron d'expiration des réservations tourne
 * **avant** (§15.1) : une annonce réservée dont la réservation vient de mourir
 * est donc bien libérée puis reprise ici, tandis qu'une annonce en cours de vente
 * n'est jamais touchée.
 *
 * Ne lève jamais : renvoie le bilan de la passe (0 partout sur erreur globale).
 */
export async function expireMarketListingsCore(
    params: MarketExpiryPass = {}
): Promise<MarketListingExpiryOutcome> {
    const { limit, now } = normalizePass(params);
    const outcome: MarketListingExpiryOutcome = {
        scanned: 0,
        deleted: 0,
        discordDeleted: 0,
        discordFailed: 0,
        notified: 0,
        hasMore: false,
    };

    try {
        const due = await db.marketListing.findMany({
            where: {
                deletedAt: null,
                // `SOLD` est hors périmètre : une vente conclue n'est jamais purgée
                // par le cron (§11.6).
                status: { in: ["ACTIVE", "RESERVED"] },
                expiresAt: { lt: now },
                ...(params.guildConfigId ? { guildId: params.guildConfigId } : {}),
                ...MARKET_NO_ACTIVITY_WHERE,
            },
            select: {
                id: true,
                guildId: true,
                userId: true,
                title: true,
                status: true,
                expiresAt: true,
                guild: { select: { discordGuildId: true } },
            },
            orderBy: { expiresAt: "asc" },
            take: limit,
        });

        outcome.scanned = due.length;
        outcome.hasMore = due.length === limit;

        for (const listing of due) {
            try {
                // Garde de statut **dans le `where`** (§11.3) : si le vendeur
                // renouvelle, retire ou vend l'annonce entre la lecture et
                // l'écriture, `count === 0` et la passe ne touche à rien.
                // `MARKET_NO_ACTIVITY_WHERE` est **rejoué dans l'écriture** (les
                // filtres de relation sont acceptés par `updateMany`, vérifié) :
                // une offre acceptée ou une réservation créée dans l'intervalle
                // annule donc l'archivage au lieu de l'entériner.
                const archived = await db.marketListing.updateMany({
                    where: {
                        id: listing.id,
                        guildId: listing.guildId,
                        deletedAt: null,
                        status: { in: ["ACTIVE", "RESERVED"] },
                        expiresAt: { lt: now },
                        ...MARKET_NO_ACTIVITY_WHERE,
                    },
                    data: {
                        status: "WITHDRAWN",
                        deletedAt: now,
                        withdrawnAt: now,
                        deletedReason: MARKET_DELETE_REASONS.AUTO_EXPIRED,
                    },
                });
                if (archived.count === 0) continue;
                outcome.deleted += archived.count;

                await writeMarketAuditLog({
                    guildId: listing.guildId,
                    listingId: listing.id,
                    // Échéance automatique : aucune action humaine ⇒ acteur nul.
                    actorUserId: null,
                    action: MARKET_AUDIT_ACTIONS.LISTING_AUTO_DELETED,
                    previousData: { status: listing.status, expiresAt: listing.expiresAt },
                    nextData: {
                        status: "WITHDRAWN",
                        deletedAt: now.toISOString(),
                        deletedReason: MARKET_DELETE_REASONS.AUTO_EXPIRED,
                    },
                    reason: MARKET_DELETE_REASONS.AUTO_EXPIRED,
                });

                // Discord **après** la base (§15.1) : un échec ne remet rien en cause.
                const discord = await deleteListingDiscordMessage(listing.id);
                if (!discord.ok) outcome.discordFailed += 1;
                else if (!discord.skipped) outcome.discordDeleted += 1;

                // §11.9 — le créateur apprend l'archivage (jamais bloquant non plus).
                const sent = await notifyMarketUser("MARKET_ARCHIVED", {
                    userId: listing.userId,
                    discordGuildId: listing.guild.discordGuildId,
                    listingId: listing.id,
                    itemLabel: listing.title,
                });
                if (sent) outcome.notified += 1;

                logger.info("[market] annonce archivée automatiquement (J+20)", {
                    listingId: listing.id,
                    guildConfigId: listing.guildId,
                    previousStatus: listing.status,
                    discord: discord.ok ? (discord.skipped ? "skipped" : "deleted") : "failed",
                });
            } catch (error) {
                logger.error("[market] expireMarketListingsCore — annonce ignorée", {
                    listingId: listing.id,
                    err: String(error),
                });
            }
        }

        return outcome;
    } catch (error) {
        logger.error("[market] expireMarketListingsCore failed", { err: error });
        return outcome;
    }
}

// ---------------------------------------------------------------------------
// OFFRES — EXPIRATION À ÉCHÉANCE (§11.6)
// ---------------------------------------------------------------------------

export type MarketOfferExpiryOutcome = {
    /** Offres éligibles lues dans la passe (borné par le lot). */
    scanned: number;
    /** Offres passées à `EXPIRED` — **0** au 2ᵉ passage : idempotent. */
    expired: number;
    /** Acheteurs prévenus (`MARKET_OFFER_ANSWERED`, issue « expirée »). */
    notified: number;
    /** Le lot était plein : le reste part à la passe suivante. */
    hasMore: boolean;
};

/**
 * Expire les offres restées `PENDING` au-delà de leur échéance (§11.6).
 *
 * Le statut est **dans le `where`** (§11.3) : une offre acceptée, refusée ou
 * annulée entre la lecture et l'écriture (`count === 0`) est laissée intacte et
 * ne notifie personne. Seul l'**acheteur** est prévenu (`MARKET_OFFER_ANSWERED`,
 * issue « expirée », §11.9) : aucun montant ni pseudo n'est exposé (§13.7), et
 * l'annonce n'est pas réécrite côté Discord — une offre qui meurt ne change
 * aucune information publique.
 *
 * Ne lève jamais : renvoie le bilan de la passe.
 */
export async function expireMarketOffersCore(
    params: MarketExpiryPass = {}
): Promise<MarketOfferExpiryOutcome> {
    const { limit, now } = normalizePass(params);
    const outcome: MarketOfferExpiryOutcome = { scanned: 0, expired: 0, notified: 0, hasMore: false };

    try {
        const due = await db.marketOffer.findMany({
            where: {
                status: "PENDING",
                expiresAt: { lt: now },
                // Isolation par la guilde de l'**annonce** (l'offre n'en porte pas).
                ...(params.guildConfigId ? { listing: { guildId: params.guildConfigId } } : {}),
            },
            select: {
                id: true,
                buyerUserId: true,
                listing: {
                    select: {
                        id: true,
                        guildId: true,
                        title: true,
                        guild: { select: { discordGuildId: true } },
                    },
                },
            },
            orderBy: { expiresAt: "asc" },
            take: limit,
        });

        outcome.scanned = due.length;
        outcome.hasMore = due.length === limit;

        for (const offer of due) {
            try {
                const expired = await db.marketOffer.updateMany({
                    where: { id: offer.id, status: "PENDING", expiresAt: { lt: now } },
                    data: { status: "EXPIRED", respondedAt: now },
                });
                if (expired.count === 0) continue;
                outcome.expired += expired.count;

                await writeMarketAuditLog({
                    guildId: offer.listing.guildId,
                    listingId: offer.listing.id,
                    // Échéance automatique : aucune action humaine ⇒ acteur nul.
                    actorUserId: null,
                    action: MARKET_AUDIT_ACTIONS.OFFER_EXPIRED,
                    previousData: { status: "PENDING" },
                    nextData: { status: "EXPIRED", respondedAt: now.toISOString() },
                    reason: "OFFER_EXPIRED",
                });

                // §11.9 — l'acheteur apprend la mort de son offre (jamais bloquant).
                const sent = await notifyMarketBuyerActivity({
                    type: "MARKET_OFFER_ANSWERED",
                    buyerUserId: offer.buyerUserId,
                    listingId: offer.listing.id,
                    discordGuildId: offer.listing.guild.discordGuildId,
                    itemLabel: offer.listing.title,
                    decision: "expired",
                });
                if (sent) outcome.notified += 1;

                logger.info("[market] offre expirée automatiquement", {
                    offerId: offer.id,
                    listingId: offer.listing.id,
                });
            } catch (error) {
                logger.error("[market] expireMarketOffersCore — offre ignorée", {
                    offerId: offer.id,
                    err: String(error),
                });
            }
        }

        return outcome;
    } catch (error) {
        logger.error("[market] expireMarketOffersCore failed", { err: error });
        return outcome;
    }
}
