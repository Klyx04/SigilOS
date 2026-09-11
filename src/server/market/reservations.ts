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
 *
 * Le **retour en vente** (§11.2 / §15.1 point 4) vit ici aussi, avec la même
 * garde de statut : `cancelMarketReservationCore()` (acheteur **ou** vendeur) et
 * `expireMarketReservationsCore()` (lot idempotent appelé par le cron S5.1).
 * Les deux notifient **le vendeur et l'acheteur** (§11.9). Le **rappel H-1**
 * (§11.6, S5.2) complète le cycle : `remindMarketReservationsEndingCore()`.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { MARKET_AUDIT_ACTIONS } from "@/server/actions/market-constants";
import { writeMarketAuditLog } from "@/server/market/audit";
import { syncListingMessage } from "@/server/market/discord";
import { notifyMarketReservationEnded, notifyMarketSellerActivity } from "@/server/market/notifications";

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
            select: {
                id: true,
                profileId: true,
                status: true,
                // §11.9 — destinataire de l'alerte vendeur (propriétaire logique)
                // et deep-link : jamais le snowflake en dur côté appelant.
                userId: true,
                title: true,
                guild: { select: { discordGuildId: true } },
            },
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

        // §11.9 / Q12 — le vendeur est la cible n°1 : notification dashboard
        // (`MARKET_RESERVED`) **et** mention dans le fil de son annonce. Le
        // `try` local garantit la promesse « jamais bloquant » : même une panne
        // inattendue de l'alerte ne peut pas transformer une réservation
        // **déjà commitée** en échec renvoyé à l'acheteur.
        try {
            await notifyMarketSellerActivity({
                type: "MARKET_RESERVED",
                ownerUserId: listing.userId,
                ownerProfileId: listing.profileId,
                actorProfileId: params.buyerProfileId,
                listingId: listing.id,
                discordGuildId: listing.guild.discordGuildId,
                itemLabel: listing.title,
                reservationHours: params.reservationHours,
            });
        } catch (err) {
            logger.warn("[market] alerte vendeur différée", { listingId: listing.id, err: String(err) });
        }

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

// ---------------------------------------------------------------------------
// FIN DE RÉSERVATION (S4.9 — §11.2 / §11.9 / §15.1 point 4)
// ---------------------------------------------------------------------------

/** Motif de refus d'une annulation — sert au message affiché. */
export type MarketReservationCancelFailure =
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "NOT_AVAILABLE"
    | "CONFLICT"
    | "INVALID"
    | "ERROR";

export type MarketReservationCancelOutcome =
    | { ok: true; reservationId: string; listingId: string; cancelledBy: "BUYER" | "SELLER" }
    | { ok: false; reason: MarketReservationCancelFailure; error: string };

const CANCEL_FAILURE_MESSAGES: Record<MarketReservationCancelFailure, string> = {
    NOT_FOUND: "Cette réservation est introuvable.",
    FORBIDDEN: "Tu n'es pas partie à cette réservation.",
    NOT_AVAILABLE: "Cette réservation est déjà terminée.",
    CONFLICT: "Cette annonce vient de changer d'état, recharge la page.",
    INVALID: "Demande invalide.",
    ERROR: "Erreur interne, réessaie dans un instant.",
};

function failCancel(reason: MarketReservationCancelFailure): MarketReservationCancelOutcome {
    return { ok: false, reason, error: CANCEL_FAILURE_MESSAGES[reason] };
}

/**
 * Conflit détecté **dans** la transaction : on **lève** pour forcer le
 * `ROLLBACK` (§11.3) — jamais une réservation close sans annonce remise en vente.
 */
class MarketReservationConflict extends Error {
    constructor(readonly reason: MarketReservationCancelFailure) {
        super(`market reservation conflict: ${reason}`);
    }
}

/** Une partie d'une réservation, telle qu'elle est notifiée (§11.9). */
type ReservationParty = { userId: string; profileId?: string };

/** Le vendeur et l'acheteur d'une réservation — cibles des deux entrées §11.9. */
function reservationParties(reservation: {
    buyerUserId: string;
    buyerProfileId: string;
    listing: { userId: string; profileId: string };
}): { seller: ReservationParty; buyer: ReservationParty } {
    return {
        seller: { userId: reservation.listing.userId, profileId: reservation.listing.profileId },
        buyer: { userId: reservation.buyerUserId, profileId: reservation.buyerProfileId },
    };
}

/**
 * Annulation d'une réservation (§11.2) : **acheteur OU vendeur**.
 *
 * Le rôle (`CANCELLED_BY_BUYER` / `CANCELLED_BY_SELLER`) est **déduit côté
 * serveur** des identités résolues par le contexte (§16.2) : il n'est jamais
 * transmis par le client. Effets : réservation close (`cancelledAt`,
 * `cancelledByUserId`, motif facultatif), annonce remise `ACTIVE`
 * (`reservedUntil` vidé), journal dédié, embed réécrit, **le vendeur et
 * l'acheteur** notifiés (§11.9) — jamais l'auteur de l'action.
 */
export async function cancelMarketReservationCore(params: {
    /** `GuildConfig.id` **interne** (§16.2). */
    guildConfigId: string;
    reservationId: string;
    /** `UserProfile.id` de l'auteur (rôle déduit, jamais fourni par le client). */
    actorProfileId: string;
    /** `User.id` SigilOS de l'auteur (traçabilité + journal). */
    actorUserId: string;
    /** Motif facultatif (§11.2) — nettoyé par l'appelant. */
    reason?: string | null;
}): Promise<MarketReservationCancelOutcome> {
    try {
        if (!params.reservationId || !params.actorUserId) return failCancel("INVALID");

        // Isolation : la réservation est cherchée par `id` **et** par guilde de
        // son annonce — une réservation d'une autre guilde n'existe pas ici.
        const reservation = await db.marketReservation.findFirst({
            where: { id: params.reservationId, listing: { guildId: params.guildConfigId, deletedAt: null } },
            select: {
                id: true,
                status: true,
                buyerUserId: true,
                buyerProfileId: true,
                listing: {
                    select: {
                        id: true,
                        userId: true,
                        profileId: true,
                        title: true,
                        guild: { select: { discordGuildId: true } },
                    },
                },
            },
        });
        if (!reservation) return failCancel("NOT_FOUND");
        if (reservation.status !== "ACTIVE") return failCancel("NOT_AVAILABLE");

        const isBuyer = reservation.buyerProfileId === params.actorProfileId;
        const isSeller =
            reservation.listing.profileId === params.actorProfileId ||
            reservation.listing.userId === params.actorUserId;
        if (!isBuyer && !isSeller) return failCancel("FORBIDDEN");

        const cancelledBy: "BUYER" | "SELLER" = isBuyer ? "BUYER" : "SELLER";
        const now = new Date();
        const reason = params.reason?.trim() || null;

        try {
            await db.$transaction(async (tx) => {
                const ended = await tx.marketReservation.updateMany({
                    where: { id: reservation.id, status: "ACTIVE" }, // garde dans le WHERE (§11.3)
                    data: {
                        status: cancelledBy === "BUYER" ? "CANCELLED_BY_BUYER" : "CANCELLED_BY_SELLER",
                        cancelledAt: now,
                        cancelledByUserId: params.actorUserId,
                        cancellationReason: reason,
                    },
                });
                if (ended.count === 0) throw new MarketReservationConflict("NOT_AVAILABLE");

                // §11.2 — l'annonce redevient disponible. `RESERVED` reste dans le
                // WHERE : une vente confirmée entre-temps n'est jamais écrasée.
                const reopened = await tx.marketListing.updateMany({
                    where: {
                        id: reservation.listing.id,
                        guildId: params.guildConfigId,
                        status: "RESERVED",
                        deletedAt: null,
                    },
                    data: { status: "ACTIVE", reservedUntil: null, lastActivityAt: now },
                });
                if (reopened.count === 0) throw new MarketReservationConflict("CONFLICT");
            });
        } catch (err) {

            if (err instanceof MarketReservationConflict) return failCancel(err.reason);
            throw err;
        }

        await writeMarketAuditLog({
            guildId: params.guildConfigId,
            listingId: reservation.listing.id,
            actorUserId: params.actorUserId,
            action:
                cancelledBy === "BUYER"
                    ? MARKET_AUDIT_ACTIONS.RESERVATION_CANCELLED_BUYER
                    : MARKET_AUDIT_ACTIONS.RESERVATION_CANCELLED_SELLER,
            previousData: { listingStatus: "RESERVED", reservationStatus: "ACTIVE" },
            nextData: {
                listingStatus: "ACTIVE",
                reservationStatus: cancelledBy === "BUYER" ? "CANCELLED_BY_BUYER" : "CANCELLED_BY_SELLER",
                reason,
            },
        });

        // §11.2 — l'annonce redevient « Disponible » : embed réécrit (jamais bloquant).
        void syncListingMessage(reservation.listing.id).catch((err) =>
            logger.warn("[market] synchronisation Discord différée", {
                listingId: reservation.listing.id,
                err: String(err),
            })
        );

        // §11.9 — « Réservation annulée » → vendeur **et** acheteur, sauf l'auteur.
        try {
            await notifyMarketReservationEnded({
                reason: "cancelled",
                listingId: reservation.listing.id,
                discordGuildId: reservation.listing.guild.discordGuildId,
                itemLabel: reservation.listing.title,
                actorProfileId: params.actorProfileId,
                ...reservationParties(reservation),
            });
        } catch (err) {
            logger.warn("[market] notification de fin de réservation différée", {
                reservationId: reservation.id,
                err: String(err),
            });
        }

        return { ok: true, reservationId: reservation.id, listingId: reservation.listing.id, cancelledBy };
    } catch (error) {
        logger.error("[market] cancelMarketReservationCore failed", { err: error });
        return failCancel("ERROR");
    }
}

// ---------------------------------------------------------------------------
// EXPIRATION DES RÉSERVATIONS (S4.9 — §11.2 / §15.1 point 4)
// ---------------------------------------------------------------------------

/** Compteurs d'une passe d'expiration (télémétrie du cron S5.1). */
export type MarketReservationExpiryOutcome = {
    /** Réservations passées `EXPIRED` (0 au 2ᵉ passage ⇒ **idempotent**). */
    expired: number;
    /** Annonces remises `ACTIVE`. */
    reopened: number;
    /** Entrées §11.9 réellement créées (vendeur + acheteur). */
    notified: number;
};

/**
 * Libère les réservations arrivées à échéance (§11.2 : « une réservation
 * expirée remet l'annonce en vente »).
 *
 * Appelée par le cron `/api/cron/market-expire` (S5.1), avec la **même garde de
 * statut** que les actions utilisateur (§11.3 / §15.1 : « le cron doit utiliser
 * la même garde pour ne pas écraser une action simultanée ») :
 *   · `updateMany` conditionnel `status: ACTIVE` + `expiresAt <= now` ⇒ **aucune**
 *     course possible avec une annulation ou une vente en cours ;
 *   · **isolée par élément** : l'échec d'une réservation n'interrompt jamais la
 *     passe, et une passe rejouée ne trouve **plus rien** à traiter ;
 *   · les deux parties sont notifiées (`MARKET_RESERVATION_ENDED`, §11.9).
 */
export async function expireMarketReservationsCore(
    params: { limit?: number; now?: Date; guildConfigId?: string } = {}
): Promise<MarketReservationExpiryOutcome> {
    const now = params.now ?? new Date();
    const limit = params.limit && params.limit > 0 ? params.limit : 200;
    const outcome: MarketReservationExpiryOutcome = { expired: 0, reopened: 0, notified: 0 };

    try {
        const due = await db.marketReservation.findMany({
            where: {
                status: "ACTIVE",
                expiresAt: { lte: now },
                // Le cron est global ; le filtre de guilde sert aux passes ciblées.
                ...(params.guildConfigId ? { listing: { guildId: params.guildConfigId } } : {}),
            },
            select: {
                id: true,
                buyerUserId: true,
                buyerProfileId: true,
                listing: {
                    select: {
                        id: true,
                        guildId: true,
                        userId: true,
                        profileId: true,
                        title: true,
                        guild: { select: { discordGuildId: true } },
                    },
                },
            },
            orderBy: { expiresAt: "asc" },
            take: limit,
        });

        for (const reservation of due) {
            try {
                const closed = await db.$transaction(async (tx) => {
                    const expired = await tx.marketReservation.updateMany({
                        where: { id: reservation.id, status: "ACTIVE", expiresAt: { lte: now } },
                        data: { status: "EXPIRED" },
                    });
                    // Quelqu'un a annulé ou vendu entre-temps : on ne touche à rien.
                    if (expired.count === 0) return { expired: 0, reopened: 0 };

                    const reopened = await tx.marketListing.updateMany({
                        where: {
                            id: reservation.listing.id,
                            guildId: reservation.listing.guildId,
                            status: "RESERVED",
                            deletedAt: null,
                        },
                        data: { status: "ACTIVE", reservedUntil: null, lastActivityAt: now },
                    });
                    return { expired: expired.count, reopened: reopened.count };
                });
                if (closed.expired === 0) continue;

                outcome.expired += closed.expired;
                outcome.reopened += closed.reopened;

                await writeMarketAuditLog({
                    guildId: reservation.listing.guildId,
                    listingId: reservation.listing.id,
                    // Échéance : aucune action humaine ⇒ `actorUserId` nul (système).
                    actorUserId: null,
                    action: MARKET_AUDIT_ACTIONS.RESERVATION_EXPIRED,
                    previousData: { listingStatus: "RESERVED", reservationStatus: "ACTIVE" },
                    nextData: { listingStatus: "ACTIVE", reservationStatus: "EXPIRED" },
                });

                void syncListingMessage(reservation.listing.id).catch((err) =>
                    logger.warn("[market] synchronisation Discord différée", {
                        listingId: reservation.listing.id,
                        err: String(err),
                    })
                );

                try {
                    outcome.notified += await notifyMarketReservationEnded({
                        reason: "expired",
                        listingId: reservation.listing.id,
                        discordGuildId: reservation.listing.guild.discordGuildId,
                        itemLabel: reservation.listing.title,
                        // Aucune annulation : personne n'est écarté, tout le monde est prévenu.
                        ...reservationParties(reservation),
                    });
                } catch (err) {
                    logger.warn("[market] notification d'expiration différée", {
                        reservationId: reservation.id,
                        err: String(err),
                    });
                }
            } catch (error) {
                // Une réservation en échec n'annule pas la passe : le cron repasse.
                logger.error("[market] expireMarketReservationsCore item failed", {
                    reservationId: reservation.id,
                    err: error,
                });
            }
        }

        return outcome;
    } catch (error) {
        logger.error("[market] expireMarketReservationsCore failed", { err: error });
        return outcome;
    }
}

// ---------------------------------------------------------------------------
// RAPPEL H-1 DES RÉSERVATIONS (S5.2 — §11.6)
// ---------------------------------------------------------------------------

/** Fenêtre d'anticipation du rappel « H-1 » (§11.6). */
export const MARKET_RESERVATION_REMINDER_WINDOW_MS = 60 * 60 * 1000;

/** Taille d'un lot d'une passe de rappel (miroir du lot d'expiration). */
export const MARKET_RESERVATION_REMINDER_BATCH_SIZE = 200;

/** Nombre de traces relues pour prouver qu'un rappel H-1 est déjà parti. */
const MARKET_RESERVATION_REMINDER_LOOKBACK = 50;

/** Compteurs d'une passe de rappel H-1 (télémétrie du cron S5.2). */
export type MarketReservationReminderOutcome = {
    /** Réservations éligibles lues dans la passe (borné par le lot). */
    scanned: number;
    /** Réservations rappelées — **0** au 2ᵉ passage : idempotent. */
    reminded: number;
    /** Entrées §11.9 réellement créées (vendeur + acheteur). */
    notified: number;
    /** Le lot était plein : le reste part à la passe suivante (10 min). */
    hasMore: boolean;
};

/**
 * Le rappel H-1 a-t-il **déjà** été envoyé pour cette réservation ?
 *
 * La réservation n'a pas de colonne dédiée à ce rappel : la trace d'audit
 * `RESERVATION_REMINDER_SENT` (qui porte le `reservationId` dans son `nextData`)
 * en fait office, ce qui garde le cron idempotent **sans écrire d'état
 * supplémentaire**. La relecture est bornée et filtrée par annonce + action —
 * jamais un plein-scan.
 */
async function hasReservationReminderEndingBeenSent(
    listingId: string,
    reservationId: string
): Promise<boolean> {
    const rows = await db.marketAuditLog.findMany({
        where: { listingId, action: MARKET_AUDIT_ACTIONS.RESERVATION_REMINDER_SENT },
        select: { nextData: true },
        orderBy: { createdAt: "desc" },
        take: MARKET_RESERVATION_REMINDER_LOOKBACK,
    });

    return rows.some((row) => {
        const data = row.nextData;
        if (!data || typeof data !== "object" || Array.isArray(data)) return false;
        return (data as { reservationId?: unknown }).reservationId === reservationId;
    });
}

/**
 * Rappel **H-1** : prévient **vendeur et acheteur** qu'une réservation `ACTIVE`
 * arrive à échéance dans moins d'une heure (§11.6, D18).
 *
 * Garanties :
 *   · **idempotent** — la trace d'audit `RESERVATION_REMINDER_SENT` sert de
 *     marqueur (relecture bornée) : une passe rejouée toutes les 10 min
 *     **n'envoie rien** de plus ;
 *   · **garde de statut** — la réservation est relue `ACTIVE` dans la fenêtre
 *     juste avant l'envoi : une annulation ou une vente intervenue entre la
 *     lecture et l'écriture annule le rappel (§11.3) ;
 *   · **aucun DM Discord** (D30) : entrée dashboard `MARKET`, désactivable ;
 *   · **isolé par élément** : l'échec d'une réservation n'interrompt pas la passe.
 *
 * ⚠️ Deux passes **strictement concurrentes** pourraient, dans une fenêtre très
 * courte, rappeler deux fois (la trace est écrite juste avant l'envoi) : c'est un
 * doublon cosmétique bénin, jamais une donnée incohérente. Le cron étant appelé
 * toutes les 10 min pour une fenêtre de 60 min, la situation est improbable.
 *
 * Ne lève jamais : renvoie le bilan de la passe.
 */
export async function remindMarketReservationsEndingCore(
    params: { limit?: number; now?: Date; guildConfigId?: string } = {}
): Promise<MarketReservationReminderOutcome> {
    const now = params.now ?? new Date();
    const limit = params.limit && params.limit > 0
        ? Math.min(params.limit, MARKET_RESERVATION_REMINDER_BATCH_SIZE)
        : MARKET_RESERVATION_REMINDER_BATCH_SIZE;
    const windowEnd = new Date(now.getTime() + MARKET_RESERVATION_REMINDER_WINDOW_MS);
    const outcome: MarketReservationReminderOutcome = {
        scanned: 0,
        reminded: 0,
        notified: 0,
        hasMore: false,
    };

    try {
        const due = await db.marketReservation.findMany({
            where: {
                status: "ACTIVE",
                // Strictement dans la fenêtre : `> now` (un rappel n'a de sens que
                // si la réservation court encore) et `<= now + 1 h` (§11.6).
                expiresAt: { gt: now, lte: windowEnd },
                // Le cron est global ; le filtre de guilde sert aux passes ciblées.
                ...(params.guildConfigId ? { listing: { guildId: params.guildConfigId } } : {}),
            },
            select: {
                id: true,
                buyerUserId: true,
                buyerProfileId: true,
                expiresAt: true,
                listing: {
                    select: {
                        id: true,
                        guildId: true,
                        userId: true,
                        profileId: true,
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

        for (const reservation of due) {
            try {
                if (await hasReservationReminderEndingBeenSent(reservation.listing.id, reservation.id)) {
                    continue;
                }

                // Le rappel n'est utile que si la réservation court toujours.
                const stillOpen = await db.marketReservation.count({
                    where: {
                        id: reservation.id,
                        status: "ACTIVE",
                        expiresAt: { gt: now, lte: windowEnd },
                    },
                });
                if (stillOpen === 0) continue;

                await writeMarketAuditLog({
                    guildId: reservation.listing.guildId,
                    listingId: reservation.listing.id,
                    // Rappel automatique : aucune action humaine ⇒ acteur nul.
                    actorUserId: null,
                    action: MARKET_AUDIT_ACTIONS.RESERVATION_REMINDER_SENT,
                    previousData: { reservationStatus: "ACTIVE", expiresAt: reservation.expiresAt },
                    nextData: { reservationId: reservation.id, reminder: "H-1" },
                });

                // §11.9 — rappel « H-1 » : vendeur **et** acheteur, personne n'est
                // écarté (aucun auteur d'action). Jamais bloquant.
                try {
                    outcome.notified += await notifyMarketReservationEnded({
                        reason: "expiring",
                        listingId: reservation.listing.id,
                        discordGuildId: reservation.listing.guild.discordGuildId,
                        itemLabel: reservation.listing.title,
                        ...reservationParties(reservation),
                    });
                } catch (err) {
                    logger.warn("[market] rappel H-1 : notification différée", {
                        reservationId: reservation.id,
                        err: String(err),
                    });
                }

                outcome.reminded += 1;

                logger.info("[market] rappel H-1 de réservation envoyé", {
                    reservationId: reservation.id,
                    listingId: reservation.listing.id,
                    expiresAt: reservation.expiresAt,
                });
            } catch (error) {
                // Une réservation en échec n'annule pas la passe : le cron repasse.
                logger.error("[market] remindMarketReservationsEndingCore item failed", {
                    reservationId: reservation.id,
                    err: error,
                });
            }
        }

        return outcome;
    } catch (error) {
        logger.error("[market] remindMarketReservationsEndingCore failed", { err: error });
        return outcome;
    }
}

