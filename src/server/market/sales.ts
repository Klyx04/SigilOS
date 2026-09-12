/**
 * Module « Marché » — confirmation de vente (§11.5 / §14.1 `markMarketListingSold`).
 *
 * ⚠️ Fichier **serveur partagé** : ni `"use server"` (ce n'est pas un server
 * action), ni React. Il porte l'**unique** implémentation de la clôture d'une
 * vente, appelée par le dashboard (server action `markMarketListingSold`) et
 * demain par le centre de négociation (§13.4 : la règle n'est jamais portée par
 * l'appelant).
 *
 * §11.5 : seul **le vendeur** clôt la vente, après une **confirmation
 * explicite** (« l'échange a bien eu lieu en jeu »). Effets, dans **une** seule
 * transaction (§11.3 — même garde de statut que la réservation) :
 *   · annonce `RESERVED → SOLD` + `soldAt` + `reservedUntil` vidé ;
 *   · réservation active `ACTIVE → COMPLETED` (+ `completedAt`) ;
 *   · offres restantes `PENDING → EXPIRED` (chacune reçoit sa réponse §11.9) ;
 *   · journal `LISTING_SOLD`, embed réécrit, acheteur notifié `MARKET_SOLD`.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { MARKET_AUDIT_ACTIONS } from "@/server/actions/market-constants";
import { writeMarketAuditLog } from "@/server/market/audit";
import { syncListingMessage } from "@/server/market/discord";
import { notifyMarketBuyerActivity } from "@/server/market/notifications";

/** Motif de refus — sert à choisir le message affiché (aucun détail interne). */
export type MarketSaleFailure =
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "NOT_RESERVED"
    | "NOT_CONFIRMED"
    | "CONFLICT"
    | "INVALID"
    | "ERROR";

export type MarketSaleOutcome =
    | {
          ok: true;
          listingId: string;
          /** Réservation passée `COMPLETED` (null si l'annonce n'en avait plus). */
          reservationId: string | null;
          /** Acheteur notifié `MARKET_SOLD` (§11.9), s'il est connu. */
          buyerUserId: string | null;
          /** Offres restantes closes par la vente (§11.5). */
          expiredOffers: number;
      }
    | { ok: false; reason: MarketSaleFailure; error: string };

const SALE_FAILURE_MESSAGES: Record<MarketSaleFailure, string> = {
    NOT_FOUND: "Cette annonce est introuvable.",
    FORBIDDEN: "Seul le vendeur peut clôturer cette vente.",
    NOT_RESERVED: "Cette annonce doit d'abord être réservée.",
    NOT_CONFIRMED: "Confirme que l'échange a bien eu lieu en jeu.",
    CONFLICT: "Cette annonce vient de changer d'état, recharge la page.",
    INVALID: "Demande invalide.",
    ERROR: "Erreur interne, réessaie dans un instant.",
};

function failSale(reason: MarketSaleFailure): MarketSaleOutcome {
    return { ok: false, reason, error: SALE_FAILURE_MESSAGES[reason] };
}

/**
 * Conflit détecté **dans** la transaction : on **lève** pour forcer le
 * `ROLLBACK` (§11.3) — jamais une annonce `SOLD` sans réservation close.
 */
class MarketSaleConflict extends Error {
    constructor(readonly reason: MarketSaleFailure) {
        super(`market sale conflict: ${reason}`);
    }
}

/** Une offre encore ouverte au moment de la vente, avec son destinataire. */
type MarketOpenOffer = { id: string; buyerUserId: string };

/**
 * Clôt la vente d'une annonce `RESERVED` (§11.5).
 *
 * Pré-requis, tous vérifiés **serveur** : annonce de la guilde du contexte,
 * `RESERVED`, `confirmed === true` (« confirmation explicite obligatoire ») et
 * demandeur = **propriétaire** de l'annonce.
 */
export async function completeMarketSaleCore(params: {
    /** `GuildConfig.id` **interne** (§16.2 : jamais le snowflake Discord). */
    guildConfigId: string;
    listingId: string;
    /** `User.id` SigilOS du **vendeur** : seul le propriétaire peut clôturer. */
    sellerUserId: string;
    /** §11.5 point 2 — « l'échange a bien eu lieu en jeu ». */
    confirmed: boolean;
}): Promise<MarketSaleOutcome> {
    try {
        if (!params.listingId || !params.sellerUserId) return failSale("INVALID");
        if (params.confirmed !== true) return failSale("NOT_CONFIRMED");

        // Isolation (§16.2) : annonce cherchée par `id` **et** par guilde.
        const listing = await db.marketListing.findFirst({
            where: { id: params.listingId, guildId: params.guildConfigId, deletedAt: null },
            select: {
                id: true,
                status: true,
                userId: true,
                title: true,
                guild: { select: { discordGuildId: true } },
            },
        });
        if (!listing) return failSale("NOT_FOUND");
        if (listing.userId !== params.sellerUserId) return failSale("FORBIDDEN");
        // §11.5 / §11.1 : la vente se clôt **depuis** `RESERVED` (jamais `ACTIVE`).
        if (listing.status !== "RESERVED") return failSale("NOT_RESERVED");

        const now = new Date();

        let locked: { reservationId: string | null; buyerUserId: string | null; losers: MarketOpenOffer[] };
        try {
            locked = await db.$transaction(async (tx) => {
                // Gardes dans le `WHERE` (§11.3) : une annulation ou une vente
                // simultanée ⇒ `count === 0` ⇒ rollback, jamais un écrasement.
                const sold = await tx.marketListing.updateMany({
                    where: {
                        id: listing.id,
                        guildId: params.guildConfigId,
                        status: "RESERVED",
                        deletedAt: null,
                    },
                    data: { status: "SOLD", soldAt: now, reservedUntil: null, lastActivityAt: now },
                });
                if (sold.count === 0) throw new MarketSaleConflict("CONFLICT");

                // §11.5 point 3 — la réservation devient `COMPLETED` : lue puis
                // close avec la même garde `ACTIVE` (l'acheteur est la cible §11.9).
                const open = await tx.marketReservation.findMany({
                    where: { listingId: listing.id, status: "ACTIVE" },
                    select: { id: true, buyerUserId: true },
                });
                if (open.length > 0) {
                    await tx.marketReservation.updateMany({
                        where: { listingId: listing.id, status: "ACTIVE" },
                        data: { status: "COMPLETED", completedAt: now },
                    });
                }

                // §11.5 point 3 — « offres restantes `EXPIRED` ».
                const losers = await tx.marketOffer.findMany({
                    where: { listingId: listing.id, status: "PENDING" },
                    select: { id: true, buyerUserId: true },
                });
                if (losers.length > 0) {
                    await tx.marketOffer.updateMany({
                        where: { id: { in: losers.map((loser) => loser.id) }, status: "PENDING" },
                        data: { status: "EXPIRED", respondedAt: now, respondedByUserId: params.sellerUserId },
                    });
                }

                return {
                    reservationId: open[0]?.id ?? null,
                    buyerUserId: open[0]?.buyerUserId ?? null,
                    losers,
                };
            });
        } catch (err) {
            if (err instanceof MarketSaleConflict) return failSale(err.reason);
            throw err;
        }

        // --- Effets **post-commit**, jamais bloquants (§0.1 / §13.6) -----------
        try {
            await writeMarketAuditLog({
                guildId: params.guildConfigId,
                listingId: listing.id,
                actorUserId: params.sellerUserId,
                action: MARKET_AUDIT_ACTIONS.LISTING_SOLD,
                previousData: { status: "RESERVED", reservationId: locked.reservationId },
                // §13.7 — aucun montant : le journal ne recopie que l'état public.
                nextData: { status: "SOLD", expiredOffers: locked.losers.length },
            });
        } catch (error) {
            logger.warn("[market] journal LISTING_SOLD différé", { listingId: listing.id, err: String(error) });
        }

        void syncListingMessage(listing.id).catch((error) =>
            logger.warn("[market] synchronisation Discord différée", {
                listingId: listing.id,
                err: String(error),
            })
        );

        // §11.9 — l'acheteur apprend la conclusion (jamais un DM, D30).
        if (locked.buyerUserId) {
            try {
                await notifyMarketBuyerActivity({
                    type: "MARKET_SOLD",
                    buyerUserId: locked.buyerUserId,
                    listingId: listing.id,
                    discordGuildId: listing.guild.discordGuildId,
                    itemLabel: listing.title,
                });
            } catch (error) {
                logger.warn("[market] notification MARKET_SOLD différée", { listingId: listing.id, err: String(error) });
            }
        }

        // §11.5 point 3 / §11.9 — les offres encore ouvertes reçoivent une réponse.
        for (const loser of locked.losers) {
            if (loser.buyerUserId === locked.buyerUserId) continue;
            try {
                await notifyMarketBuyerActivity({
                    type: "MARKET_OFFER_ANSWERED",
                    buyerUserId: loser.buyerUserId,
                    listingId: listing.id,
                    discordGuildId: listing.guild.discordGuildId,
                    itemLabel: listing.title,
                    decision: "rejected",
                });
            } catch (error) {
                logger.warn("[market] notification de refus différée", { offerId: loser.id, err: String(error) });
            }
        }

        return {
            ok: true,
            listingId: listing.id,
            reservationId: locked.reservationId,
            buyerUserId: locked.buyerUserId,
            expiredOffers: locked.losers.length,
        };
    } catch (error) {
        logger.error("[market] completeMarketSaleCore failed", { err: error });
        return failSale("ERROR");
    }
}
