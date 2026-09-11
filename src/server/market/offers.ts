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
 * de l'annonce : plusieurs offres `PENDING` coexistent, c'est le vendeur qui
 * tranche (S4.10). La seule écriture concurrente significative est donc
 * `lastActivityAt` (§11.6 : toute activité reporte les rappels), mise à jour
 * **dans la même transaction** que l'offre.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isValidKamas } from "@/lib/market/kamas";
import { MARKET_AUDIT_ACTIONS, MARKET_SETTINGS_BOUNDS } from "@/server/actions/market-constants";
import { writeMarketAuditLog } from "@/server/market/audit";
import { syncListingMessage } from "@/server/market/discord";

/** Motif de refus — sert à choisir le message affiché (aucun détail interne exposé). */
export type MarketOfferFailure =
    | "NOT_FOUND"
    | "OWN_LISTING"
    | "NOT_AVAILABLE"
    | "NEGOTIATIONS_OFF"
    | "EMPTY_OFFER"
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
            select: { id: true, profileId: true, status: true, negotiable: true },
        });
        if (!listing) return fail("NOT_FOUND");
        if (listing.profileId === params.buyerProfileId) return fail("OWN_LISTING");
        if (listing.status !== "ACTIVE") return fail("NOT_AVAILABLE");
        if (!params.negotiationsEnabled || !listing.negotiable) return fail("NEGOTIATIONS_OFF");

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

        // `MarketOffer.expiresAt` est nullable en base : on renvoie l'horodatage
        // que l'on vient d'écrire (jamais un `null` au membre).
        return { ok: true, offerId: offer.id, expiresAt };
    } catch (error) {
        logger.error("[market] createMarketOfferCore failed", { err: error });
        return fail("ERROR");
    }
}
