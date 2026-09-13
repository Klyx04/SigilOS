/**
 * Module « Marché » — service des interactions Discord (S4.1 → S4.4).
 *
 * ⚠️ **Serveur uniquement** (Prisma + server actions). Importé dynamiquement par
 * `src/app/api/discord/interactions/route.ts` pour la branche `mkt`.
 *
 * Le contrat §13.4 est appliqué ici, dans cet ordre — et **jamais** dans la route :
 *   1. **parsing fail-closed** du `custom_id` (aucune action devinée, §0.1) ;
 *   2. **guilde** : le `guild_id` Discord est obligatoire, un clic hors serveur
 *      (DM, contexte non-Guild) ne peut pas être isolé par guilde ⇒ refus (§16.2) ;
 *   3. **module actif** : `isModuleEnabled(discordGuildId, "marche")`, qui inclut
 *      le verrou God et `DEFAULT_MODULES` ⇒ un serveur non configuré est refusé ;
 *   4. **contexte membre** (guilde interne + profil SigilOS) résolu **serveur** ;
 *   5. **action métier** : déléguée aux **moteurs partagés** avec le dashboard
 *      (`reserveMarketListingCore` pour `mkt:reserve`, `createMarketOfferCore`
 *      pour la modale `mkt:offer`) — aucune règle n'est dupliquée ici.
 *      `mkt:contact` (S4.5) est la seule action 100 % Discord : la commande `/w`
 *      du vendeur, recopiée telle quelle, aucun moteur métier n'étant en jeu.
 *
 * Deux formes de réponse (§13.5) : `ephemeral` (message du seul membre, type 4)
 * ou `modal` (modale d'offre, type 9 — S4.3). Aucune réponse ne contient un
 * montant d'offre ni un pseudo d'acheteur (§13.7).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/utils";
import { isModuleEnabled } from "@/server/actions/module-actions";
import {
    MARKET_EPHEMERAL,
    MARKET_EPHEMERAL_LINK_LABEL,
    buildMarketContactContent,
    buildMarketDashboardLinkRow,
    buildMarketDashboardUrl,
    buildMarketOfferModal,
    parseMarketCustomId,
    parseMarketOfferSubmission,
    type MarketComponentRow,
    type MarketModalPayload,
    type MarketModalSubmitRow,
} from "@/lib/market/discord-interactions";
import { reserveMarketListingCore, type MarketReservationFailure } from "@/server/market/reservations";
import { createMarketOfferCore, type MarketOfferFailure } from "@/server/market/offers";

/** Message éphémère renvoyé au membre (jamais vide, §13.5). */
export type MarketEphemeralOutcome = {
    kind: "ephemeral";
    /** `true` = l'action métier a abouti. */
    ok: boolean;
    /** Contenu Discord affiché au membre (`flags: 64`). */
    content: string;
    /**
     * Lignes de boutons facultatifs (S4.5 : bouton lien vers la fiche SigilOS).
     * Absentes = réponse purement textuelle ; jamais de `custom_id` ici.
     */
    components?: MarketComponentRow[];
};

/**
 * Résultat d'un clic : soit un message éphémère, soit la modale d'offre. La route
 * ne fait que **traduire** cette union en JSON Discord (`type: 4` / `type: 9`).
 */
export type MarketInteractionOutcome =
    | MarketEphemeralOutcome
    | { kind: "modal"; modal: MarketModalPayload };

function ephemeral(
    content: string,
    ok = false,
    components?: MarketComponentRow[]
): MarketEphemeralOutcome {
    return components && components.length > 0
        ? { kind: "ephemeral", ok, content, components }
        : { kind: "ephemeral", ok, content };
}

function modal(modalPayload: MarketModalPayload): MarketInteractionOutcome {
    return { kind: "modal", modal: modalPayload };
}

/** Message éphémère associé à chaque refus de réservation (§13.5 : jamais muet). */
const RESERVE_FAILURE_MESSAGES: Record<MarketReservationFailure, string> = {
    NOT_FOUND: MARKET_EPHEMERAL.LISTING_NOT_FOUND,
    OWN_LISTING: MARKET_EPHEMERAL.RESERVE_OWN_LISTING,
    NOT_AVAILABLE: MARKET_EPHEMERAL.RESERVE_UNAVAILABLE,
    CONFLICT: MARKET_EPHEMERAL.RESERVE_CONFLICT,
    INVALID: MARKET_EPHEMERAL.LISTING_NOT_FOUND,
    ERROR: MARKET_EPHEMERAL.GENERIC_ERROR,
};

/** Message éphémère associé à chaque refus d'offre (S4.4 — §13.5 : jamais muet). */
const OFFER_FAILURE_MESSAGES: Record<MarketOfferFailure, string> = {
    NOT_FOUND: MARKET_EPHEMERAL.LISTING_NOT_FOUND,
    OWN_LISTING: MARKET_EPHEMERAL.OFFER_OWN_LISTING,
    NOT_AVAILABLE: MARKET_EPHEMERAL.OFFER_NOT_AVAILABLE,
    NEGOTIATIONS_OFF: MARKET_EPHEMERAL.OFFER_DISABLED,
    // §11.4 — « ni kamas ni troc » : la modale laisse tout facultatif, la règle
    // est donc recalculée ici, côté serveur (jamais devinée, §0.1).
    EMPTY_OFFER: MARKET_EPHEMERAL.OFFER_EMPTY,
    // D43 — « kamas uniquement » : le refus vient du moteur partagé (§11.4).
    TRADE_NOT_ACCEPTED: MARKET_EPHEMERAL.OFFER_TRADE_NOT_ACCEPTED,
    INVALID: MARKET_EPHEMERAL.OFFER_INVALID,
    ERROR: MARKET_EPHEMERAL.GENERIC_ERROR,
};

/**
 * Contexte **côté serveur uniquement** (§16.2) : la guilde interne vient du
 * `guild_id` de l'interaction, le profil de la guilde vient de l'`User.id`
 * SigilOS résolu par la route. Aucun identifiant n'est accepté du client.
 *
 * Renvoie soit un refus éphémère prêt à afficher, soit le contexte résolu.
 * Partagé par toutes les actions du marché : le handshake guilde/profil n'est
 * écrit qu'une seule fois (§13.4).
 */
type MarketMemberContext =
    | {
          ok: true;
          guildConfigId: string;
          profileId: string;
          /** `GuildConfig.marketReservationHours` (réservation §11.2). */
          reservationHours: number;
          /** `GuildConfig.marketOfferHours` (durée de vie d'une offre, §11.4). */
          offerHours: number;
          /** `GuildConfig.marketNegotiationsEnabled` (négociations §13.5). */
          negotiationsEnabled: boolean;
      }
    | { ok: false; outcome: MarketEphemeralOutcome };

async function resolveMemberContext(
    discordGuildId: string,
    userId: string
): Promise<MarketMemberContext> {
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true, marketReservationHours: true, marketOfferHours: true, marketNegotiationsEnabled: true },
    });
    if (!guildConfig) {
        logger.warn("[market] interaction refusée — guilde non configurée", { discordGuildId });
        return { ok: false, outcome: ephemeral(MARKET_EPHEMERAL.LISTING_NOT_FOUND) };
    }

    const profile = await db.userProfile.findUnique({
        where: { userId_guildId: { userId, guildId: guildConfig.id } },
        select: { id: true, status: true },
    });
    if (!profile || profile.status !== "ACTIVE") {
        logger.info("[market] interaction refusée — profil SigilOS absent ou inactif", {
            discordGuildId,
            userId,
        });
        return { ok: false, outcome: ephemeral(MARKET_EPHEMERAL.PROFILE_REQUIRED) };
    }

    return {
        ok: true,
        guildConfigId: guildConfig.id,
        profileId: profile.id,
        reservationHours: guildConfig.marketReservationHours,
        offerHours: guildConfig.marketOfferHours,
        negotiationsEnabled: guildConfig.marketNegotiationsEnabled,
    };
}

/**
 * S4.2 — `mkt:reserve:<listingId>` : réserve l'annonce au prix demandé.
 */
async function handleReserve(
    discordGuildId: string,
    listingId: string,
    userId: string
): Promise<MarketInteractionOutcome> {
    const member = await resolveMemberContext(discordGuildId, userId);
    if (!member.ok) return member.outcome;

    const outcome = await reserveMarketListingCore({
        guildConfigId: member.guildConfigId,
        listingId,
        buyerProfileId: member.profileId,
        buyerUserId: userId,
        reservationHours: member.reservationHours,
    });

    if (!outcome.ok) {
        logger.info("[market] réservation refusée", {
            discordGuildId,
            listingId,
            reason: outcome.reason,
        });
        return ephemeral(RESERVE_FAILURE_MESSAGES[outcome.reason]);
    }

    logger.info("[market] réservation créée depuis Discord", {
        discordGuildId,
        listingId,
        reservationId: outcome.reservationId,
    });
    return ephemeral(MARKET_EPHEMERAL.RESERVE_SUCCESS, true);
}

/**
 * S4.3 — `mkt:offer:<listingId>` : ouvre la **modale d'offre** (type 9).
 *
 * Les pré-requis du bouton (§13.5 : annonce `ACTIVE`, négociations activées,
 * demandeur ≠ vendeur) sont vérifiés **avant** d'ouvrir la modale : un message
 * non resynchronisé ne doit pas laisser saisir une offre vouée à l'échec. La
 * **création** de l'offre à la soumission vit en S4.4 (même moteur que le
 * dashboard).
 */
async function handleOffer(
    discordGuildId: string,
    listingId: string,
    userId: string
): Promise<MarketInteractionOutcome> {
    const member = await resolveMemberContext(discordGuildId, userId);
    if (!member.ok) return member.outcome;

    const listing = await db.marketListing.findFirst({
        where: { id: listingId, guildId: member.guildConfigId, deletedAt: null },
        select: { id: true, profileId: true, status: true, negotiable: true, acceptsTrade: true },
    });
    if (!listing) return ephemeral(MARKET_EPHEMERAL.LISTING_NOT_FOUND);
    if (listing.profileId === member.profileId) return ephemeral(MARKET_EPHEMERAL.OFFER_OWN_LISTING);
    if (listing.status !== "ACTIVE") return ephemeral(MARKET_EPHEMERAL.OFFER_NOT_AVAILABLE);
    if (!member.negotiationsEnabled || !listing.negotiable) {
        return ephemeral(MARKET_EPHEMERAL.OFFER_DISABLED);
    }

    logger.info("[market] modale d'offre ouverte", { discordGuildId, listingId, userId });
    // D43 — « kamas uniquement » : la modale le dit, le serveur le fera respecter.
    return modal(buildMarketOfferModal(listingId, { acceptsTrade: listing.acceptsTrade }));
}

/**
 * S4.5 — `mkt:contact:<listingId>` : met le membre en relation avec le vendeur.
 *
 * Discord ne permet **pas** d'ouvrir un message privé : la réponse éphémère
 * porte donc la commande `/w` **prête à copier** plus le bouton lien vers la
 * fiche SigilOS (§13.5). Seul le pseudo **du vendeur** est affiché — il est déjà
 * public dans l'embed (§13.2) — et jamais un montant d'offre ni un pseudo
 * d'acheteur (§13.7).
 */
async function handleContact(
    discordGuildId: string,
    listingId: string,
    userId: string
): Promise<MarketInteractionOutcome> {
    const member = await resolveMemberContext(discordGuildId, userId);
    if (!member.ok) return member.outcome;

    const listing = await db.marketListing.findFirst({
        where: { id: listingId, guildId: member.guildConfigId, deletedAt: null },
        select: {
            id: true,
            profileId: true,
            status: true,
            profile: { select: { pseudoDofus: true } },
        },
    });
    if (!listing) return ephemeral(MARKET_EPHEMERAL.LISTING_NOT_FOUND);
    if (listing.profileId === member.profileId) return ephemeral(MARKET_EPHEMERAL.CONTACT_OWN_LISTING);

    const dashboardUrl = buildMarketDashboardUrl(getAppBaseUrl(), discordGuildId, listingId);
    const linkRow = [buildMarketDashboardLinkRow(dashboardUrl, MARKET_EPHEMERAL_LINK_LABEL)];

    // Miroir exact de l'état du bouton (§13.3 : désactivé uniquement en `SOLD`) :
    // une annonce vendue reste consultable via la fiche, pas négociable en jeu.
    if (listing.status === "SOLD") {
        return ephemeral(MARKET_EPHEMERAL.CONTACT_UNAVAILABLE, false, linkRow);
    }

    const sellerPseudo = listing.profile.pseudoDofus?.trim();
    if (!sellerPseudo) {
        // Jamais de commande `/w undefined` : on explique et on renvoie la fiche.
        logger.info("[market] contact refusé — pseudo Dofus du vendeur absent", {
            discordGuildId,
            listingId,
        });
        return ephemeral(MARKET_EPHEMERAL.CONTACT_NO_PSEUDO, false, linkRow);
    }

    logger.info("[market] commande de contact transmise", { discordGuildId, listingId, userId });
    return ephemeral(buildMarketContactContent(sellerPseudo), true, linkRow);
}

/**
 * Traite un clic de bouton du marché (`custom_id` `mkt:<action>:<listingId>`).
 *
 * @param customId       `custom_id` brut reçu de Discord.
 * @param discordGuildId `guild_id` de l'interaction (`null` hors serveur).
 * @param userId         `User.id` SigilOS résolu depuis l'id Discord du membre.
 */
export async function handleMarketComponentInteraction(params: {
    customId: string;
    discordGuildId: string | null;
    userId: string;
}): Promise<MarketInteractionOutcome> {
    const parsed = parseMarketCustomId(params.customId);
    if (!parsed) {
        logger.warn("[market] interaction Discord refusée — custom_id invalide", {
            customId: params.customId,
            discordGuildId: params.discordGuildId,
        });
        return ephemeral(MARKET_EPHEMERAL.UNKNOWN_ACTION);
    }

    if (!params.discordGuildId) {
        logger.warn("[market] interaction Discord refusée — hors serveur (guilde non isolable)", {
            action: parsed.action,
            listingId: parsed.listingId,
        });
        return ephemeral(MARKET_EPHEMERAL.GUILD_REQUIRED);
    }

    const enabled = await isModuleEnabled(params.discordGuildId, "marche");
    if (!enabled) {
        logger.info("[market] interaction Discord refusée — module marché désactivé", {
            discordGuildId: params.discordGuildId,
            action: parsed.action,
        });
        return ephemeral(MARKET_EPHEMERAL.MODULE_DISABLED);
    }

    // S4.2 — réservation : délègue au moteur partagé avec le dashboard (verrou
    // §11.3, refus de sa propre annonce, embed réécrit).
    if (parsed.action === "reserve") {
        return handleReserve(params.discordGuildId, parsed.listingId, params.userId);
    }

    // S4.3 — offre : ouvre la modale (type 9). La création de l'offre à la
    // soumission vit en S4.4 (même moteur que le dashboard).
    if (parsed.action === "offer") {
        return handleOffer(params.discordGuildId, parsed.listingId, params.userId);
    }

    // S4.5 — contact : commande `/w` du vendeur + bouton lien vers la fiche.
    if (parsed.action === "contact") {
        return handleContact(params.discordGuildId, parsed.listingId, params.userId);
    }

    // Défensif : `parseMarketCustomId()` n'accepte que les 3 actions ci-dessus,
    // une action non traitée ne doit jamais partir en silence (§13.5).
    logger.warn("[market] action Discord non traitée", {
        action: parsed.action,
        listingId: parsed.listingId,
        discordGuildId: params.discordGuildId,
    });
    return ephemeral(MARKET_EPHEMERAL.UNKNOWN_ACTION);
}

/**
 * S4.4 — soumission de la **modale d'offre** (`mkt:offer:<listingId>`, type 5).
 *
 * Même chaîne de gardes que les clics (§13.4) : parsing **fail-closed** de la
 * soumission → guilde → module actif → contexte membre → **moteur partagé**
 * `createMarketOfferCore()` (le dashboard appelle exactement le même).
 *
 * La modale ne peut pas exprimer « kamas **ou** troc » (les 3 champs sont
 * facultatifs côté Discord) : la règle est donc **recalculée ici**, côté serveur
 * — un envoi totalement vide est refusé (§0.1/§11.4). Le montant offert et
 * l'identité de l'acheteur ne sortent **jamais** du serveur (§13.7) : seul un
 * message de succès/refus est renvoyé au membre (§13.5, jamais muet).
 */
export async function handleMarketModalSubmit(params: {
    /** `custom_id` de la modale soumise (`mkt:offer:<listingId>`). */
    customId: string;
    /** `data.components` brut de la soumission (jamais fiable ⇒ relu, §0.1). */
    components: readonly MarketModalSubmitRow[] | null | undefined;
    discordGuildId: string | null;
    userId: string;
}): Promise<MarketEphemeralOutcome> {
    const submission = parseMarketOfferSubmission({
        customId: params.customId,
        components: params.components,
    });
    if (!submission) {
        logger.warn("[market] soumission de modale refusée — custom_id invalide", {
            customId: params.customId,
            discordGuildId: params.discordGuildId,
        });
        return ephemeral(MARKET_EPHEMERAL.UNKNOWN_ACTION);
    }

    if (!params.discordGuildId) {
        logger.warn("[market] soumission de modale refusée — hors serveur (guilde non isolable)", {
            listingId: submission.listingId,
        });
        return ephemeral(MARKET_EPHEMERAL.GUILD_REQUIRED);
    }

    const enabled = await isModuleEnabled(params.discordGuildId, "marche");
    if (!enabled) {
        logger.info("[market] soumission de modale refusée — module marché désactivé", {
            discordGuildId: params.discordGuildId,
        });
        return ephemeral(MARKET_EPHEMERAL.MODULE_DISABLED);
    }

    const member = await resolveMemberContext(params.discordGuildId, params.userId);
    if (!member.ok) return member.outcome;

    const outcome = await createMarketOfferCore({
        guildConfigId: member.guildConfigId,
        listingId: submission.listingId,
        buyerProfileId: member.profileId,
        buyerUserId: params.userId,
        negotiationsEnabled: member.negotiationsEnabled,
        offerHours: member.offerHours,
        offeredKamas: submission.offeredKamas,
        tradeDescription: submission.tradeDescription,
        note: submission.note,
        invalid: submission.invalid,
    });

    if (!outcome.ok) {
        logger.info("[market] offre refusée", {
            discordGuildId: params.discordGuildId,
            listingId: submission.listingId,
            reason: outcome.reason,
        });
        return ephemeral(OFFER_FAILURE_MESSAGES[outcome.reason]);
    }

    logger.info("[market] offre créée depuis Discord", {
        discordGuildId: params.discordGuildId,
        listingId: submission.listingId,
        offerId: outcome.offerId,
    });
    return ephemeral(MARKET_EPHEMERAL.OFFER_SUCCESS, true);
}
