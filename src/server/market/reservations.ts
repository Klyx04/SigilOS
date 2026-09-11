/**
 * Module « Marché » — moteur de réservation (§11.2 / §11.3).
 *
 * ⚠️ Fichier **serveur partagé** : ni `"use server"` (ce n'est pas un server
 * action), ni React. Il porte l'**unique** implémentation de la réservation,
 * appelée à l'identique par :
 *   · le dashboard (server action `reserveMarketListing`) ;
 *   · les interactions Discord (`mkt:reserve:<id>`).
 * §13.4 — la logique métier n'est **jamais** dupliquée ni portée par la route.
 *
 * Le point dur est la **concurrence** (§11.3) : jamais de « lire puis écrire ».
 * La transition `ACTIVE → RESERVED` se fait par un `updateMany` **conditionnel**
 * dans une transaction ; si `count === 0`, quelqu'un est passé avant et
 * **aucune** réservation n'est créée. L'unicité de la réservation active est
 * garantie par cette atomicité, jamais par une simple vérification applicative.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { MARKET_AUDIT_ACTIONS } from "@/server/actions/market-constants";
import { writeMarketAuditLog } from "@/server/market/audit";
import { syncListingMessage } from "@/server/market/discord";

/** Motif de refus — sert à choisir le message affiché (aucun détail interne exposé). */
export type MarketReservationFailure =
    | "NOT_FOUND"
    | "OWN_LISTING"
    | "NOT_AVAILABLE"
    | "CONFLICT"
    | "INVALID"
    | "ERROR";

export type MarketReservationOutcome =
    | { ok: true; reservationId: string; expiresAt: Date }
    | { ok: false; reason: MarketReservationFailure; error: string };

const FAILURE_MESSAGES: Record<MarketReservationFailure, string> = {
    NOT_FOUND: "Cette annonce est introuvable.",
    OWN_LISTING: "Tu ne peux pas réserver ta propre annonce.",
    NOT_AVAILABLE: "Cette annonce n'est plus disponible.",
    CONFLICT: "Cette annonce vient d'être réservée.",
    INVALID: "Demande invalide.",
    ERROR: "Erreur interne, réessaie dans un instant.",
};

function fail(reason: MarketReservationFailure): MarketReservationOutcome {
    return { ok: false, reason, error: FAILURE_MESSAGES[reason] };
}

/**
 * Réserve une annonce `ACTIVE` au prix demandé.
 *
 * Pré-requis (§11.2) : annonce de **la guilde** du contexte, `ACTIVE`, et
 * demandeur ≠ vendeur. L'`expiresAt` vaut `now + marketReservationHours`.
 */
export async function reserveMarketListingCore(params: {
    /** `GuildConfig.id` **interne** (§16.2 : jamais le snowflake Discord). */
    guildConfigId: string;
    listingId: string;
    /** Profil de l'acheteur **dans cette guilde**. */
    buyerProfileId: string;
    /** `User.id` SigilOS de l'acheteur (traçabilité + journal). */
    buyerUserId: string;
    /** Durée de la réservation en heures (`GuildConfig.marketReservationHours`). */
    reservationHours: number;
}): Promise<MarketReservationOutcome> {
    try {
        if (!params.listingId || !Number.isFinite(params.reservationHours) || params.reservationHours <= 0) {
            return fail("INVALID");
        }

        // Isolation : l'annonce est cherchée par `id` **et** par guilde interne.
        const listing = await db.marketListing.findFirst({
            where: { id: params.listingId, guildId: params.guildConfigId, deletedAt: null },
            select: { id: true, profileId: true, status: true },
        });
        if (!listing) return fail("NOT_FOUND");
        if (listing.profileId === params.buyerProfileId) return fail("OWN_LISTING");
        if (listing.status !== "ACTIVE") return fail("NOT_AVAILABLE");

        const now = new Date();
        const expiresAt = new Date(now.getTime() + params.reservationHours * 60 * 60 * 1000);

        // §11.3 — la condition de statut vit dans le WHERE, jamais dans un `if`
        // lu avant l'écriture : deux clics simultanés ne peuvent pas créer deux
        // réservations (le second `updateMany` compte 0 ligne).
        const locked = await db.$transaction(async (tx) => {
            const updated = await tx.marketListing.updateMany({
                where: { id: listing.id, guildId: params.guildConfigId, status: "ACTIVE", deletedAt: null },
                data: { status: "RESERVED", reservedUntil: expiresAt, lastActivityAt: now },
            });
            if (updated.count === 0) return null;
            return tx.marketReservation.create({
                data: {
                    listingId: listing.id,
                    buyerProfileId: params.buyerProfileId,
                    buyerUserId: params.buyerUserId,
                    status: "ACTIVE",
                    expiresAt,
                },
                select: { id: true, expiresAt: true },
            });
        });

        if (!locked) {
            logger.info("[market] réservation refusée — annonce prise entre-temps", {
                listingId: listing.id,
                profileId: params.buyerProfileId,
            });
            return fail("CONFLICT");
        }

        await writeMarketAuditLog({
            guildId: params.guildConfigId,
            listingId: listing.id,
            actorUserId: params.buyerUserId,
            action: MARKET_AUDIT_ACTIONS.RESERVATION_CREATED,
            previousData: { status: "ACTIVE" },
            nextData: { status: "RESERVED", reservationId: locked.id, expiresAt },
        });

        // §11.2 — l'annonce passe en « Réservé » (embed réécrit, boutons
        // désactivés) : jamais bloquant pour la réponse à l'utilisateur.
        void syncListingMessage(listing.id).catch((err) =>
            logger.warn("[market] synchronisation Discord différée", { listingId: listing.id, err: String(err) })
        );

        return { ok: true, reservationId: locked.id, expiresAt: locked.expiresAt };
    } catch (error) {
        logger.error("[market] reserveMarketListingCore failed", { err: error });
        return fail("ERROR");
    }
}
