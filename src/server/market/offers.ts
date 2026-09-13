/**
 * Module « Marché » — moteur d'offre (§11.4 / §13.5).
 *
 * ⚠️ Fichier **serveur partagé** : ni `"use server"` (ce n'est pas un server
 * action), ni React. Il porte l'**unique** implémentation de la création d'une
 * offre, appelée à l'identique par :
 *   · le dashboard (server action `createMarketOffer`) ;
 *   · la soumission de la modale Discord (`mkt:offer:<id>`, type 5 — S4.4).
 * §13.4 — la logique métier n'est **jamais** dupliquée ni portée par la route.
 *
 * Contrairement à la réservation (§11.3), une offre **ne change pas le statut**
 * de l'annonce : plusieurs offres `PENDING` coexistent et ce sont les parties qui
 * tranchent — `respondToMarketOfferCore()` (S4.9 : accepter / refuser) et sa
 * contre-offre (S4.10) portent cette décision, `cancelMarketOfferCore()` (S4.10)
 * permet à l'auteur de retirer sa proposition. La seule écriture concurrente
 * significative est donc `lastActivityAt` (§11.6 : toute activité reporte les
 * rappels), mise à jour **dans la même transaction** que l'offre.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isValidKamas } from "@/lib/market/kamas";
import { MARKET_AUDIT_ACTIONS, MARKET_SETTINGS_BOUNDS } from "@/server/actions/market-constants";
import { writeMarketAuditLog } from "@/server/market/audit";
import { syncListingMessage } from "@/server/market/discord";
import { notifyMarketBuyerActivity, notifyMarketSellerActivity } from "@/server/market/notifications";

/** Motif de refus — sert à choisir le message affiché (aucun détail interne exposé). */
export type MarketOfferFailure =
    | "NOT_FOUND"
    | "OWN_LISTING"
    | "NOT_AVAILABLE"
    | "NEGOTIATIONS_OFF"
    | "EMPTY_OFFER"
    | "TRADE_NOT_ACCEPTED"
    | "INVALID"
    | "ERROR";

export type MarketOfferOutcome =
    | { ok: true; offerId: string; expiresAt: Date }
    | { ok: false; reason: MarketOfferFailure; error: string };

const FAILURE_MESSAGES: Record<MarketOfferFailure, string> = {
    NOT_FOUND: "Cette annonce est introuvable.",
    OWN_LISTING: "Tu ne peux pas faire d'offre sur ta propre annonce.",
    NOT_AVAILABLE: "Cette annonce n'est plus disponible.",
    NEGOTIATIONS_OFF: "Les négociations sont désactivées sur cette annonce.",
    EMPTY_OFFER: "Renseigne un montant en kamas ou un troc.",
    TRADE_NOT_ACCEPTED: "Cette annonce n'accepte que les kamas : propose un montant.",
    INVALID: "Offre invalide.",
    ERROR: "Erreur interne, réessaie dans un instant.",
};
function fail(reason: MarketOfferFailure): MarketOfferOutcome {
    return { ok: false, reason, error: FAILURE_MESSAGES[reason] };
}

/**
 * Crée une offre `PENDING` sur une annonce **négociable** (§11.4).
 *
 * Pré-requis, tous vérifiés **serveur** : annonce de la guilde du contexte,
 * `ACTIVE`, demandeur ≠ vendeur, négociations **guilde ET annonce** actives, et
 * un contenu réel (`offeredKamas > 0` **ou** `tradeDescription` non vide).
 * `expiresAt` vaut `now + marketOfferHours`.
 *
 * Les valeurs arrivent **déjà nettoyées** par `normalizeMarketOfferDraft()`
 * (fichier pur partagé avec Discord) : la route ne valide rien, elle traduit.
 */
export async function createMarketOfferCore(params: {
    /** `GuildConfig.id` **interne** (§16.2 : jamais le snowflake Discord). */
    guildConfigId: string;
    listingId: string;
    /** Profil de l'acheteur **dans cette guilde**. */
    buyerProfileId: string;
    /** `User.id` SigilOS de l'acheteur (traçabilité + journal). */
    buyerUserId: string;
    /** `GuildConfig.marketNegotiationsEnabled` (réglage guilde §13.5). */
    negotiationsEnabled: boolean;
    /** Durée de vie de l'offre en heures (`GuildConfig.marketOfferHours`, 48 h). */
    offerHours: number;
    /** Montant offert (`null` si l'offre est un troc pur). */
    offeredKamas: number | null;
    /** Troc nettoyé (`null` si absent). */
    tradeDescription: string | null;
    /** Message au vendeur nettoyé (`null` si absent). */
    note: string | null;
    /**
     * `true` = saisie **inexploitable** (`normalizeMarketOfferDraft()` : kamas
     * illisible, texte hors bornes) ⇒ refus explicite, jamais une offre
     * silencieusement amputée de son montant (§0.1). La règle vit **ici**, pas
     * chez les appelants (§13.4).
     */
    invalid?: boolean;
}): Promise<MarketOfferOutcome> {
    try {
        const { min, max } = MARKET_SETTINGS_BOUNDS.marketOfferHours;
        if (
            !params.listingId ||
            !Number.isFinite(params.offerHours) ||
            params.offerHours < min ||
            params.offerHours > max
        ) {
            return fail("INVALID");
        }

        // Saisie inexploitable (kamas illisible / texte hors bornes) : refus
        // explicite — « 12abc kamas + un troc » ne devient jamais un troc muet.
        if (params.invalid) return fail("INVALID");

        // §11.4 — plafond Int32 et « pas de valeur négative » : un montant hors
        // bornes est refusé, jamais ramené en silence à une valeur arbitraire.
        if (params.offeredKamas !== null && (!isValidKamas(params.offeredKamas) || params.offeredKamas <= 0)) {
            return fail("INVALID");
        }

        const tradeDescription = params.tradeDescription?.trim() || null;
        const note = params.note?.trim() || null;

        // §11.4 — « kamas > 0 OU troc non vide » : la règle est appliquée ici,
        // côté serveur, même si la modale laissait tout vide.
        if (params.offeredKamas === null && tradeDescription === null) return fail("EMPTY_OFFER");

        // Isolation : l'annonce est cherchée par `id` **et** par guilde interne.
        const listing = await db.marketListing.findFirst({
            where: { id: params.listingId, guildId: params.guildConfigId, deletedAt: null },
            select: {
                id: true,
                profileId: true,
                status: true,
                negotiable: true,
                // D43 — « troc accepté » : règle **serveur** lue sur l'annonce.
                acceptsTrade: true,
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
        if (!params.negotiationsEnabled || !listing.negotiable) return fail("NEGOTIATIONS_OFF");

        // D43 / §11.4 — « Troc accepté » : une annonce « **kamas uniquement** »
        // (`acceptsTrade = false`) refuse une offre **sans kamas** (troc seul).
        // À cet instant `offeredKamas` vaut `null` ou `> 0` (gardes ci-dessus) :
        // `null` est donc bien « aucune pièce offerte ». Règle **serveur**, posée
        // **avant toute écriture** — le client n'est jamais cru (§0.1).
        if (params.offeredKamas === null && !listing.acceptsTrade) return fail("TRADE_NOT_ACCEPTED");

        const now = new Date();
        const expiresAt = new Date(now.getTime() + params.offerHours * 60 * 60 * 1000);

        // §11.6 — « toute activité (offre, réservation, vente) ⇒ lastActivityAt » :
        // l'horodatage est écrit avec l'offre, jamais avant (pas d'activité
        // fantôme si la création échoue).
        const offer = await db.$transaction(async (tx) => {
            const created = await tx.marketOffer.create({
                data: {
                    listingId: listing.id,
                    buyerProfileId: params.buyerProfileId,
                    buyerUserId: params.buyerUserId,
                    offeredKamas: params.offeredKamas,
                    tradeDescription,
                    note,
                    status: "PENDING",
                    expiresAt,
                },
                select: { id: true },
            });

            await tx.marketListing.update({
                where: { id: listing.id },
                data: { lastActivityAt: now },
            });

            return created;
        });

        await writeMarketAuditLog({
            guildId: params.guildConfigId,
            listingId: listing.id,
            actorUserId: params.buyerUserId,
            action: MARKET_AUDIT_ACTIONS.OFFER_CREATED,
            previousData: { status: listing.status },
            nextData: {
                offerId: offer.id,
                expiresAt,
                // §13.7 — le montant reste **interne** (journal d'audit modo) : il
                // n'apparaît jamais dans le salon Discord (seul le compteur est public).
                offeredKamas: params.offeredKamas,
                hasTrade: tradeDescription !== null,
                hasNote: note !== null,
            },
        });

        // §13.7 / S4.7 — « N offre(s) en cours » est **le seul** indicateur public
        // (jamais le montant ni le pseudo) : l'embed est réécrit sans bloquer la
        // réponse au membre, la BDD reste la référence.
        void syncListingMessage(listing.id).catch((err) =>
            logger.warn("[market] synchronisation Discord différée", { listingId: listing.id, err: String(err) })
        );

        // §11.9 / Q12 — le vendeur est alerté d'un dépôt d'offre : notification
        // dashboard (`MARKET_OFFER_RECEIVED`) **et** mention dans le fil de son
        // annonce. `try` local : l'offre est déjà commitée, une panne d'alerte
        // ne doit jamais se transformer en échec renvoyé à l'acheteur.
        try {
            await notifyMarketSellerActivity({
                type: "MARKET_OFFER_RECEIVED",
                ownerUserId: listing.userId,
                ownerProfileId: listing.profileId,
                actorProfileId: params.buyerProfileId,
                listingId: listing.id,
                discordGuildId: listing.guild.discordGuildId,
                itemLabel: listing.title,
            });
        } catch (err) {
            logger.warn("[market] alerte vendeur différée", { listingId: listing.id, err: String(err) });
        }

        // `MarketOffer.expiresAt` est nullable en base : on renvoie l'horodatage
        // que l'on vient d'écrire (jamais un `null` au membre).
        return { ok: true, offerId: offer.id, expiresAt };
    } catch (error) {
        logger.error("[market] createMarketOfferCore failed", { err: error });
        return fail("ERROR");
    }
}

// ---------------------------------------------------------------------------
// RÉPONSE À UNE OFFRE (S4.9 / S4.10 — §11.4 / §11.9)
// ---------------------------------------------------------------------------

/**
 * Décision d'une **partie** à une offre vivante (§14.1). `COUNTER` (S4.10) ne
 * décide pas : l'offre courante passe `DECLINED` et une offre de remplacement
 * `PENDING`, rattachée par `counterOfId`, repart chez l'autre partie (§11.4).
 */
export type MarketOfferDecisionInput = "ACCEPT" | "DECLINE" | "COUNTER";

/** Motif de refus d'une réponse — sert au message affiché (aucun détail interne). */
export type MarketOfferDecisionFailure =
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "NOT_PENDING"
    | "EXPIRED"
    | "CONFLICT"
    | "EMPTY_OFFER"
    | "TRADE_NOT_ACCEPTED"
    | "INVALID"
    | "ERROR";

export type MarketOfferDecisionOutcome =
    | {
          ok: true;
          offerId: string;
          status: "ACCEPTED" | "DECLINED" | "COUNTERED";
          /** Renseigné par une acceptation (annonce passée `RESERVED`). */
          reservationId?: string;
          /** Renseigné par une contre-offre : la nouvelle offre `PENDING`. */
          counterOfferId?: string;
          expiresAt?: Date;
          /** Offres concurrentes passées `EXPIRED` (§11.4). */
          expiredOthers: number;
      }
    | { ok: false; reason: MarketOfferDecisionFailure; error: string };

/** Saisie d'une contre-offre (§11.4) — mêmes champs qu'un dépôt d'offre. */
export type MarketOfferCounterDraft = {
    /** Montant offert (`null` si troc pur). */
    offeredKamas: number | null;
    /** Troc nettoyé (`null` si absent). */
    tradeDescription: string | null;
    /** Message net(`null` si absent). */
    note: string | null;
    /** `true` = saisie inexploitable (`normalizeMarketOfferDraft()`). */
    invalid?: boolean;
};

const DECISION_FAILURE_MESSAGES: Record<MarketOfferDecisionFailure, string> = {
    NOT_FOUND: "Cette offre est introuvable.",
    FORBIDDEN: "Seule la partie concernée peut répondre à cette offre.",
    NOT_PENDING: "Cette offre a déjà reçu une réponse.",
    EXPIRED: "Cette offre a expiré.",
    CONFLICT: "Cette annonce vient d'être réservée.",
    EMPTY_OFFER: "Renseigne un montant en kamas ou un troc.",
    TRADE_NOT_ACCEPTED: "Cette annonce n'accepte que les kamas : propose un montant.",
    INVALID: "Demande invalide.",
    ERROR: "Erreur interne, réessaie dans un instant.",
};

function failDecision(reason: MarketOfferDecisionFailure): MarketOfferDecisionOutcome {
    return { ok: false, reason, error: DECISION_FAILURE_MESSAGES[reason] };
}

/**
 * Conflit détecté **dans** la transaction : on **lève** pour forcer le
 * `ROLLBACK` (§11.3). Une garde de statut qui échoue après une première écriture
 * ne doit jamais laisser cette écriture derrière elle (jamais d'offre `ACCEPTED`
 * sans annonce réservée).
 */
class MarketDecisionConflict extends Error {
    constructor(readonly reason: MarketOfferDecisionFailure) {
        super(`market offer decision conflict: ${reason}`);
    }
}

/** Offre concurrente expirée, avec son destinataire (notification §11.9). */
type MarketLoserOffer = { id: string; buyerUserId: string };

/**
 * Réponse d'**une partie** à une offre vivante (§14.1 / §11.4) — moteur
 * **unique** partagé par le dashboard (`respondToMarketOffer`) et le centre de
 * négociation (§13.4). §13.4 : la règle n'est jamais portée par l'appelant.
 *
 * Qui peut répondre ? L'**autre partie** que l'auteur de l'offre vivante :
 *   · offre d'origine (déposée par l'acheteur) ⇒ le **vendeur** de l'annonce ;
 *   · contre-offre (`counterOfId`), peu importe son auteur ⇒ l'auteur de
 *     l'offre **référencée**. La négociation alterne donc, et personne ne peut
 *     répondre à sa propre proposition (§11.4).
 *
 * · `DECLINE` → offre `DECLINED` (+ `respondedAt` / `respondedByUserId`) ; les
 *   autres offres restent `PENDING` ; le répondant n'est jamais notifié de son
 *   propre geste, **l'auteur** de l'offre reçoit `MARKET_OFFER_ANSWERED` (§11.9).
 * · `ACCEPT` → offre `ACCEPTED`, annonce `RESERVED` **au prix de l'offre** avec
 *   `reservedUntil`, réservation `ACTIVE` créée pour **l'acheteur** (l'auteur de
 *   l'offre acceptée — ou l'auteur de l'offre d'origine quand on accepte une
 *   contre-offre émise par le vendeur), **les autres offres passent `EXPIRED`**
 *   (chaque offreur est notifié), journal `OFFER_ACCEPTED`, embed réécrit.
 * · `COUNTER` → l'offre courante passe `DECLINED` et une offre **de
 *   remplacement** `PENDING` (rattachée par `counterOfId`) part chez l'auteur de
 *   l'offre courante, pour `marketOfferHours`. Le compteur public « N offre(s)
 *   en cours » (S4.7) est **inchangé** (une offre en remplace une autre) : aucune
 *   réécriture d'embed n'est nécessaire.
 *
 * Concurrence (§11.3) : chaque garde de statut vit dans le `WHERE` d'un
 * `updateMany` **dans** la transaction. Deux réponses simultanées, une
 * réservation directe ou une vente confirmée entre-temps ⇒ `count === 0` ⇒
 * rollback, jamais un écrasement.
 */
export async function respondToMarketOfferCore(params: {
    /** `GuildConfig.id` **interne** (§16.2 : jamais le snowflake Discord). */
    guildConfigId: string;
    offerId: string;
    /** `User.id` SigilOS du répondant (contexte serveur, jamais le client). */
    responderUserId: string;
    /** `UserProfile.id` du répondant : auteur de la contre-offre (§11.4). */
    responderProfileId: string;
    decision: MarketOfferDecisionInput;
    /** `GuildConfig.marketReservationHours` — durée de la réservation créée. */
    reservationHours: number;
    /** `GuildConfig.marketOfferHours` — durée de vie de la contre-offre créée. */
    offerHours?: number;
    /** Saisie nettoyée (`normalizeMarketOfferDraft`) — requise pour `COUNTER`. */
    counter?: MarketOfferCounterDraft;
}): Promise<MarketOfferDecisionOutcome> {
    try {
        const { min, max } = MARKET_SETTINGS_BOUNDS.marketReservationHours;
        if (
            !params.offerId ||
            !Number.isFinite(params.reservationHours) ||
            params.reservationHours < min ||
            params.reservationHours > max
        ) {
            return failDecision("INVALID");
        }

        // Isolation (§16.2) : l'offre est cherchée par `id` **et** par guilde de
        // son annonce — une offre d'une autre guilde n'existe pas ici.
        const offer = await db.marketOffer.findFirst({
            where: { id: params.offerId, listing: { guildId: params.guildConfigId, deletedAt: null } },
            select: {
                id: true,
                status: true,
                expiresAt: true,
                buyerProfileId: true,
                buyerUserId: true,
                counterOfId: true,
                listing: {
                    select: {
                        id: true,
                        userId: true,
                        profileId: true,
                        title: true,
                        // D43 — la contre-offre suit la règle du dépôt d'offre
                        // (§11.4) : il faut lire « troc accepté » sur l'annonce.
                        acceptsTrade: true,
                        guild: { select: { discordGuildId: true } },
                    },
                },
            },
        });
        if (!offer) return failDecision("NOT_FOUND");

        // §11.4 — quelle est l'**autre partie**, la seule à pouvoir répondre ?
        // L'offre d'origine vient de l'acheteur : c'est le vendeur qui répond. Une
        // contre-offre, elle, se répond par l'auteur de l'offre qu'elle référence :
        // la négociation alterne, chacun répond à l'autre, jamais à soi-même.
        let counterpart: { userId: string; profileId: string };
        if (offer.counterOfId) {
            const origin = await db.marketOffer.findUnique({
                where: { id: offer.counterOfId },
                select: { buyerUserId: true, buyerProfileId: true },
            });
            // Chaîne cassée (donnée incohérente) : on refuse, on ne devine pas.
            if (!origin) return failDecision("NOT_FOUND");
            counterpart = { userId: origin.buyerUserId, profileId: origin.buyerProfileId };
        } else {
            // Une offre d'origine est déposée par l'acheteur en vertu de la
            // contrainte `OWN_LISTING` de la création ; sinon la donnée est
            // incohérente, et une offre « du vendeur » ne serait plus négociable.
            if (offer.buyerUserId === offer.listing.userId) return failDecision("FORBIDDEN");
            counterpart = { userId: offer.listing.userId, profileId: offer.listing.profileId };
        }
        // §14.1 — la propriété de l'annonce ne suffit plus : c'est **cette** partie.
        if (params.responderUserId !== counterpart.userId) return failDecision("FORBIDDEN");
        if (offer.status !== "PENDING") return failDecision("NOT_PENDING");

        const now = new Date();
        // L'expiration **effective** appartient au cron (§15.1 point 5) : ici on
        // refuse, on ne ressuscite jamais une offre périmée.
        if (offer.expiresAt && offer.expiresAt.getTime() <= now.getTime()) return failDecision("EXPIRED");

        // Auteur de l'offre vivante (celui qui a proposé les termes courants) et
        // **acheteur** d'une acceptation : la partie qui n'est pas le vendeur.
        const author = { userId: offer.buyerUserId, profileId: offer.buyerProfileId };
        const isAuthorOwner = author.userId === offer.listing.userId;
        const buyer = isAuthorOwner ? counterpart : author;

        if (params.decision === "DECLINE") {
            const declined = await db.$transaction(async (tx) => {
                const updated = await tx.marketOffer.updateMany({
                    where: { id: offer.id, status: "PENDING" }, // garde dans le WHERE (§11.3)
                    data: { status: "DECLINED", respondedAt: now, respondedByUserId: params.responderUserId },
                });
                if (updated.count === 0) return false;
                // §11.6 — répondre est une activité : les rappels J+7 / J+15 reculent.
                await tx.marketListing.update({
                    where: { id: offer.listing.id },
                    data: { lastActivityAt: now },
                });
                return true;
            });
            if (!declined) return failDecision("NOT_PENDING");

            await writeMarketAuditLog({
                guildId: params.guildConfigId,
                listingId: offer.listing.id,
                actorUserId: params.responderUserId,
                action: MARKET_AUDIT_ACTIONS.OFFER_DECLINED,
                previousData: { status: "PENDING" },
                nextData: { status: "DECLINED", offerId: offer.id },
            });

            // Le compteur public « N offre(s) en cours » (S4.7) a changé : l'embed
            // est réécrit sans bloquer la réponse au vendeur (§13.6).
            void syncListingMessage(offer.listing.id).catch((err) =>
                logger.warn("[market] synchronisation Discord différée", {
                    listingId: offer.listing.id,
                    err: String(err),
                })
            );

            // §11.9 — « réponse à ton offre » → **acheteur**. `try` local : la
            // décision est déjà commitée, une panne d'alerte ne la transforme
            // jamais en échec renvoyé au vendeur.
            try {
                await notifyMarketBuyerActivity({
                    type: "MARKET_OFFER_ANSWERED",
                    buyerUserId: author.userId,
                    decision: "rejected",
                    listingId: offer.listing.id,
                    discordGuildId: offer.listing.guild.discordGuildId,
                    itemLabel: offer.listing.title,
                });
            } catch (err) {
                logger.warn("[market] notification acheteur différée", { offerId: offer.id, err: String(err) });
            }

            return { ok: true, offerId: offer.id, status: "DECLINED", expiredOthers: 0 };
        }

        // ── CONTRE-OFFRE (§11.4 : l'offre courante tombe, une nouvelle repart) ─
        if (params.decision === "COUNTER") {
            const bounds = MARKET_SETTINGS_BOUNDS.marketOfferHours;
            const counter = params.counter;
            const counterHours = params.offerHours;
            if (
                !counter ||
                typeof counterHours !== "number" ||
                !Number.isFinite(counterHours) ||
                counterHours < bounds.min ||
                counterHours > bounds.max
            ) {
                return failDecision("INVALID");
            }
            // Mêmes règles de contenu qu'un dépôt d'offre (§11.4) : une contre-offre
            // n'est jamais vide, et un montant illisible ou hors bornes est refusé
            // plutôt que ramené en silence (§0.1).
            if (counter.invalid) return failDecision("INVALID");
            if (counter.offeredKamas !== null && (!isValidKamas(counter.offeredKamas) || counter.offeredKamas <= 0)) {
                return failDecision("INVALID");
            }
            const trade = counter.tradeDescription?.trim() || null;
            const note = counter.note?.trim() || null;
            if (counter.offeredKamas === null && trade === null) return failDecision("EMPTY_OFFER");
            // D43 / §11.4 — même règle qu'un dépôt d'offre : une annonce « kamas
            // uniquement » n'accepte pas non plus une contre-offre **sans kamas**.
            // Garde posée **avant la transaction** ⇒ l'offre en face reste
            // `PENDING` (aucun demi-refus, §11.3).
            if (counter.offeredKamas === null && !offer.listing.acceptsTrade) {
                return failDecision("TRADE_NOT_ACCEPTED");
            }

            const counterExpiresAt = new Date(now.getTime() + counterHours * 60 * 60 * 1000);

            let counterOfferId: string;
            try {
                counterOfferId = await db.$transaction(async (tx) => {
                    // L'offre courante est refusée **dans la même transaction** : une
                    // contre-offre ne doit jamais laisser deux offres vivantes en face.
                    const declinedCurrent = await tx.marketOffer.updateMany({
                        where: { id: offer.id, status: "PENDING" },
                        data: { status: "DECLINED", respondedAt: now, respondedByUserId: params.responderUserId },
                    });
                    if (declinedCurrent.count === 0) throw new MarketDecisionConflict("NOT_PENDING");

                    const created = await tx.marketOffer.create({
                        data: {
                            listingId: offer.listing.id,
                            // L'auteur de la contre-offre est **le répondant** : sur une
                            // contre-offre du vendeur, `buyer*` porte donc le vendeur ;
                            // c'est `counterOfId` qui désigne les rôles (§11.4).
                            buyerProfileId: params.responderProfileId,
                            buyerUserId: params.responderUserId,
                            offeredKamas: counter.offeredKamas,
                            tradeDescription: trade,
                            note,
                            status: "PENDING",
                            counterOfId: offer.id,
                            expiresAt: counterExpiresAt,
                        },
                        select: { id: true },
                    });

                    // §11.6 — négocier est une activité : les rappels J+7 / J+15 reculent.
                    await tx.marketListing.update({
                        where: { id: offer.listing.id },
                        data: { lastActivityAt: now },
                    });

                    return created.id;
                });
            } catch (err) {
                if (err instanceof MarketDecisionConflict) return failDecision(err.reason);
                throw err;
            }

            await writeMarketAuditLog({
                guildId: params.guildConfigId,
                listingId: offer.listing.id,
                actorUserId: params.responderUserId,
                action: MARKET_AUDIT_ACTIONS.OFFER_COUNTERED,
                previousData: { status: "PENDING", offerId: offer.id },
                nextData: {
                    status: "COUNTERED",
                    declinedOfferId: offer.id,
                    counterOfferId,
                    expiresAt: counterExpiresAt,
                    // §13.7 — montant **interne** (journal modo), jamais dans le salon.
                    offeredKamas: counter.offeredKamas,
                    hasTrade: trade !== null,
                },
            });

            // §11.9 — « la réponse à mon offre » part chez **l'auteur** de l'offre
            // remplacée : `MARKET_OFFER_ANSWERED` (`counter`) quand c'est l'acheteur,
            // l'alerte vendeur habituelle quand c'est le vendeur (« une offre sur ton
            // annonce » — Q12 ne mentionne jamais que le créateur).
            try {
                if (author.userId === offer.listing.userId) {
                    await notifyMarketSellerActivity({
                        type: "MARKET_OFFER_RECEIVED",
                        ownerUserId: author.userId,
                        ownerProfileId: offer.listing.profileId,
                        actorProfileId: params.responderProfileId,
                        listingId: offer.listing.id,
                        discordGuildId: offer.listing.guild.discordGuildId,
                        itemLabel: offer.listing.title,
                    });
                } else {
                    await notifyMarketBuyerActivity({
                        type: "MARKET_OFFER_ANSWERED",
                        buyerUserId: author.userId,
                        decision: "counter",
                        listingId: offer.listing.id,
                        discordGuildId: offer.listing.guild.discordGuildId,
                        itemLabel: offer.listing.title,
                    });
                }
            } catch (err) {
                logger.warn("[market] notification de contre-offre différée", {
                    offerId: offer.id,
                    err: String(err),
                });
            }

            // Aucune réécriture d'embed (S4.7 / §13.7) : le compteur public « N
            // offre(s) en cours » est inchangé, une offre en remplace une autre.
            return {
                ok: true,
                offerId: offer.id,
                status: "COUNTERED",
                counterOfferId,
                expiresAt: counterExpiresAt,
                expiredOthers: 0,
            };
        }

        // ── ACCEPTATION (§11.4 : RESERVED + les autres offres EXPIRED) ────────
        const expiresAt = new Date(now.getTime() + params.reservationHours * 60 * 60 * 1000);

        let locked: { reservationId: string; losers: MarketLoserOffer[] };
        try {
            locked = await db.$transaction(async (tx) => {
                const accepted = await tx.marketOffer.updateMany({
                    where: { id: offer.id, status: "PENDING" },
                    data: { status: "ACCEPTED", respondedAt: now, respondedByUserId: params.responderUserId },
                });
                if (accepted.count === 0) throw new MarketDecisionConflict("NOT_PENDING");

                // §11.3 — `ACTIVE` reste dans le WHERE : accepter une offre ne peut
                // pas écraser une réservation directe ni une vente simultanée.
                const reserved = await tx.marketListing.updateMany({
                    where: {
                        id: offer.listing.id,
                        guildId: params.guildConfigId,
                        status: "ACTIVE",
                        deletedAt: null,
                    },
                    data: { status: "RESERVED", reservedUntil: expiresAt, lastActivityAt: now },
                });
                if (reserved.count === 0) throw new MarketDecisionConflict("CONFLICT");

                const reservation = await tx.marketReservation.create({
                    data: {
                        listingId: offer.listing.id,
                        // L'acheteur est **la partie qui n'est pas le vendeur** —
                        // l'auteur de l'offre acceptée, ou l'auteur de l'offre d'origine
                        // si l'on accepte la contre-offre émise par le vendeur (§11.4).
                        buyerProfileId: buyer.profileId,
                        buyerUserId: buyer.userId,
                        status: "ACTIVE",
                        expiresAt,
                    },
                    select: { id: true },
                });

                // §11.4 — « les autres offres passent `EXPIRED` » : lues **dans** la
                // transaction pour que chaque offreur soit notifié, écrites avec la
                // même garde `PENDING`.
                const losers = await tx.marketOffer.findMany({
                    where: { listingId: offer.listing.id, status: "PENDING", id: { not: offer.id } },
                    select: { id: true, buyerUserId: true },
                });
                if (losers.length > 0) {
                    await tx.marketOffer.updateMany({
                        where: { id: { in: losers.map((loser) => loser.id) }, status: "PENDING" },
                        data: { status: "EXPIRED", respondedAt: now, respondedByUserId: params.responderUserId },
                    });
                }

                return { reservationId: reservation.id, losers };
            });
        } catch (err) {
            if (err instanceof MarketDecisionConflict) return failDecision(err.reason);
            throw err;
        }

        await writeMarketAuditLog({
            guildId: params.guildConfigId,
            listingId: offer.listing.id,
            actorUserId: params.responderUserId,
            action: MARKET_AUDIT_ACTIONS.OFFER_ACCEPTED,
            previousData: { status: "PENDING", listingStatus: "ACTIVE" },
            nextData: {
                status: "ACCEPTED",
                offerId: offer.id,
                reservationId: locked.reservationId,
                expiresAt,
                // §13.7 — le montant de l'offre reste **interne** : jamais dans le salon.
                expiredOffers: locked.losers.length,
            },
        });

        void syncListingMessage(offer.listing.id).catch((err) =>
            logger.warn("[market] synchronisation Discord différée", {
                listingId: offer.listing.id,
                err: String(err),
            })
        );

        // §11.9 — l'offre acceptée **et** chaque offre évincée reçoivent leur
        // réponse : l'acheteur sait toujours où il en est (jamais bloquant).
        try {
            await notifyMarketBuyerActivity({
                type: "MARKET_OFFER_ANSWERED",
                buyerUserId: buyer.userId,
                decision: "accepted",
                listingId: offer.listing.id,
                discordGuildId: offer.listing.guild.discordGuildId,
                itemLabel: offer.listing.title,
            });
            for (const loser of locked.losers) {
                await notifyMarketBuyerActivity({
                    type: "MARKET_OFFER_ANSWERED",
                    buyerUserId: loser.buyerUserId,
                    decision: "rejected",
                    listingId: offer.listing.id,
                    discordGuildId: offer.listing.guild.discordGuildId,
                    itemLabel: offer.listing.title,
                });
            }
        } catch (err) {
            logger.warn("[market] notification acheteur différée", { offerId: offer.id, err: String(err) });
        }

        return {
            ok: true,
            offerId: offer.id,
            status: "ACCEPTED",
            reservationId: locked.reservationId,
            expiresAt,
            expiredOthers: locked.losers.length,
        };
    } catch (error) {
        logger.error("[market] respondToMarketOfferCore failed", { err: error });
        return failDecision("ERROR");
    }
}

// ---------------------------------------------------------------------------
// RETRAIT D'UNE OFFRE (S4.10 — §14.1)
// ---------------------------------------------------------------------------

/** Motif de refus d'un retrait — sert au message affiché (aucun détail interne). */
export type MarketOfferCancelFailure =
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "NOT_PENDING"
    | "EXPIRED"
    | "INVALID"
    | "ERROR";

export type MarketOfferCancelOutcome =
    | { ok: true; offerId: string; status: "CANCELLED" }
    | { ok: false; reason: MarketOfferCancelFailure; error: string };

const CANCEL_FAILURE_MESSAGES: Record<MarketOfferCancelFailure, string> = {
    NOT_FOUND: "Cette offre est introuvable.",
    FORBIDDEN: "Seul l'auteur d'une offre peut la retirer.",
    NOT_PENDING: "Cette offre a déjà reçu une réponse.",
    EXPIRED: "Cette offre a expiré.",
    INVALID: "Demande invalide.",
    ERROR: "Erreur interne, réessaie dans un instant.",
};

function failCancel(reason: MarketOfferCancelFailure): MarketOfferCancelOutcome {
    return { ok: false, reason, error: CANCEL_FAILURE_MESSAGES[reason] };
}

/**
 * Retrait d'une offre **par son auteur**, tant qu'elle est `PENDING` (§14.1).
 *
 * ❌ Aucune notification : §11.9 ne prévoit rien pour un retrait volontaire et
 * D30 interdit tout message privé. ✅ Le compteur public « N offre(s) en cours »
 * (S4.7) redescend, en revanche : l'embed est réécrit, la BDD restant la
 * référence (jamais bloquant pour le membre).
 */
export async function cancelMarketOfferCore(params: {
    /** `GuildConfig.id` **interne** (§16.2 : jamais le snowflake Discord). */
    guildConfigId: string;
    offerId: string;
    /** `User.id` SigilOS de l'auteur — déduit du contexte serveur, jamais du client. */
    actorUserId: string;
}): Promise<MarketOfferCancelOutcome> {
    try {
        if (!params.offerId) return failCancel("INVALID");

        // Isolation (§16.2) : l'offre est cherchée par `id` **et** par guilde de
        // son annonce — une offre d'une autre guilde n'existe pas ici.
        const offer = await db.marketOffer.findFirst({
            where: { id: params.offerId, listing: { guildId: params.guildConfigId, deletedAt: null } },
            select: {
                id: true,
                status: true,
                expiresAt: true,
                buyerUserId: true,
                listing: { select: { id: true } },
            },
        });
        if (!offer) return failCancel("NOT_FOUND");
        // §14.1 — garde « **auteur** » : celui qui a déposé l'offre, personne d'autre.
        // (Vrai aussi pour une contre-offre : son auteur est `buyer*` par construction.)
        if (offer.buyerUserId !== params.actorUserId) return failCancel("FORBIDDEN");
        if (offer.status !== "PENDING") return failCancel("NOT_PENDING");

        const now = new Date();
        if (offer.expiresAt && offer.expiresAt.getTime() <= now.getTime()) return failCancel("EXPIRED");

        // Garde de statut **dans le `WHERE`** (§11.3) : deux retraits simultanés ou
        // une réponse du vendeur arrivée entre-temps ⇒ `count === 0` ⇒ rien écrit.
        const cancelled = await db.marketOffer.updateMany({
            where: { id: offer.id, status: "PENDING" },
            data: { status: "CANCELLED", respondedAt: now, respondedByUserId: params.actorUserId },
        });
        if (cancelled.count === 0) return failCancel("NOT_PENDING");

        await writeMarketAuditLog({
            guildId: params.guildConfigId,
            listingId: offer.listing.id,
            actorUserId: params.actorUserId,
            action: MARKET_AUDIT_ACTIONS.OFFER_CANCELLED,
            previousData: { status: "PENDING" },
            nextData: { status: "CANCELLED", offerId: offer.id },
        });

        void syncListingMessage(offer.listing.id).catch((err) =>
            logger.warn("[market] synchronisation Discord différée", {
                listingId: offer.listing.id,
                err: String(err),
            })
        );

        return { ok: true, offerId: offer.id, status: "CANCELLED" };
    } catch (error) {
        logger.error("[market] cancelMarketOfferCore failed", { err: error });
        return failCancel("ERROR");
    }
}

