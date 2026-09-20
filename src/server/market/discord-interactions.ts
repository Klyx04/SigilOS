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
 *      pour la modale `mkt:offer`, `cancelMarketReservationCore` pour
 *      `mkt:cancel`) — aucune règle n'est dupliquée ici. Le bouton « Contacter »
 *      a été **supprimé** (BUG-7) : il ne reste que les 3 actions ci-dessus.
 *
 * BUG-8 — **tout clic est throttlé côté serveur** (`rateLimit`, fail-closed)
 * avant d'atteindre la base : un spam de boutons ne peut pas marteler la DB.
 *
 * Deux formes de réponse (§13.5) : `ephemeral` (message du seul membre, type 4)
 * ou `modal` (modale d'offre, type 9 — S4.3). Aucune réponse ne contient un
 * montant d'offre ni un pseudo d'acheteur (§13.7).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { getAppBaseUrl } from "@/lib/utils";
import { isModuleEnabled } from "@/server/actions/module-actions";
import {
    MARKET_EPHEMERAL,
    MARKET_EPHEMERAL_LINK_LABEL,
    buildMarketDashboardLinkRow,
    buildMarketDashboardUrl,
    buildMarketOfferModal,
    parseMarketCustomId,
    parseMarketOfferSubmission,
    type MarketComponentRow,
    type MarketModalPayload,
    type MarketModalSubmitRow,
} from "@/lib/market/discord-interactions";
import {
    cancelMarketReservationCore,
    reserveMarketListingCore,
    type MarketReservationFailure,
} from "@/server/market/reservations";
import { createMarketOfferCore, type MarketOfferFailure } from "@/server/market/offers";
import {
    releaseBundleComponentCore,
    reserveBundleComponentCore,
    type BundleCoreReason,
} from "@/server/market/bundle";

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
 * 🧺 **Option A** — refus du moteur **par objet** (`reserveBundleComponentCore`).
 * Chaque motif a son message : l'acheteur doit comprendre *pourquoi* **cet objet**
 * n'est pas réservable (déjà pris, déjà vendu, lot clôturé), jamais un « échec ».
 */
const BUNDLE_RESERVE_FAILURE_MESSAGES: Record<BundleCoreReason, string> = {
    NOT_FOUND: MARKET_EPHEMERAL.LISTING_NOT_FOUND,
    OWN_LISTING: MARKET_EPHEMERAL.RESERVE_OWN_LISTING,
    NOT_AVAILABLE: MARKET_EPHEMERAL.RESERVE_UNAVAILABLE,
    ALREADY_RESERVED: MARKET_EPHEMERAL.RESERVE_CONFLICT,
    SOLD: "❌ Cet objet du lot a déjà été vendu.",
    CONFLICT: MARKET_EPHEMERAL.RESERVE_CONFLICT,
    INVALID: MARKET_EPHEMERAL.LISTING_NOT_FOUND,
    ERROR: MARKET_EPHEMERAL.GENERIC_ERROR,
};

/**
 * BUG-8 — **anti-spam des interactions Discord** (docs/RULES.md § Rate Limiting).
 *
 * Fenêtre volontairement courte et borne basse : un membre qui clique
 * légitimement (réserver puis se désister) reste sous la limite, tandis qu'un
 * spam de clics — ou un bot qui rejoue le même `custom_id` — est coupé
 * **côté serveur**. Les deux formes (clic de bouton et soumission de modale)
 * partagent la même politique.
 */
const MARKET_INTERACTION_RATE_LIMIT = { max: 6, windowMs: 10_000 } as const;

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
    if (!profile) {
        // BUG-6 — profil **absent** : le membre a une action à faire (le créer).
        logger.info("[market] interaction refusée — profil SigilOS absent", {
            discordGuildId,
            userId,
        });
        return { ok: false, outcome: ephemeral(MARKET_EPHEMERAL.PROFILE_MISSING) };
    }
    if (profile.status !== "ACTIVE") {
        // BUG-6 — profil **inactif** : la cause n'est pas la même, le message non
        // plus (l'ancien texte unique faisait croire à un profil inexistant).
        logger.info("[market] interaction refusée — profil SigilOS inactif", {
            discordGuildId,
            userId,
            status: profile.status,
        });
        return { ok: false, outcome: ephemeral(MARKET_EPHEMERAL.PROFILE_INACTIVE) };
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
 * S4.2 — `mkt:reserve:<listingId>[:<componentId>]` : réserve l'annonce **ou
 * l'objet visé** au prix demandé.
 *
 * 🧺 **Option A** : sur un lot, chaque message d'objet porte ses propres boutons
 * (4 segments) ⇒ on délègue au moteur **par objet** (`reserveBundleComponentCore`),
 * qui réserve *cet* objet à *son* prix. Sans `componentId`, on garde exactement le
 * comportement historique (annonce entière) : rétro-compatibilité des messages
 * publiés avant l'option A, et simplicité des annonces non-lot.
 */
async function handleReserve(
    discordGuildId: string,
    listingId: string,
    userId: string,
    componentId?: string
): Promise<MarketInteractionOutcome> {
    if (componentId) return handleReserveComponent(discordGuildId, listingId, componentId, userId);

    const member = await resolveMemberContext(discordGuildId, userId);
    if (!member.ok) return member.outcome;

    // BUG-8 — re-clic sur « Réserver au prix » alors que c'est **sa** réservation :
    // sans ce garde-fou, le membre recevrait « annonce déjà réservée par quelqu'un
    // d'autre », ce qui l'empêcherait de comprendre qu'il peut se désister.
    const ownReservation = await db.marketReservation.findFirst({
        where: {
            listingId,
            buyerProfileId: member.profileId,
            status: "ACTIVE",
            listing: { guildId: member.guildConfigId },
        },
        select: { id: true },
    });
    if (ownReservation) return ephemeral(MARKET_EPHEMERAL.RESERVE_ALREADY_YOURS);

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
 * 🧺 **Option A** — `mkt:reserve:<listingId>:<componentId>` : réserve **un objet**
 * d'un lot au prix de **cet objet**.
 *
 * Tout est résolu **côté serveur** (guilde interne, profil SigilOS, identités) :
 * le `componentId` ne vient que du `custom_id` signé par Discord et est
 * systématiquement re-vérifié comme appartenant bien à l'annonce
 * (`reserveBundleComponentCore` porte `listingId` **et** `guildId` dans ses
 * requêtes — isolation §16.2, aucune donnée du client n'est crue).
 *
 * Après succès, le message du lot **et** tous les messages d'objets sont
 * resynchronisés par le point d'entrée habituel (`syncListingMessage`, non
 * bloquant) : le bouton de l'objet réservé passe en « réservé », les autres
 * restent disponibles.
 */
async function handleReserveComponent(
    discordGuildId: string,
    listingId: string,
    componentId: string,
    userId: string
): Promise<MarketInteractionOutcome> {
    const member = await resolveMemberContext(discordGuildId, userId);
    if (!member.ok) return member.outcome;

    // Re-clic sur SA propre réservation d'objet : même garde-fou que pour
    // l'annonce entière (sinon « déjà réservé par quelqu'un d'autre »).
    const ownReservation = await db.marketReservation.findFirst({
        where: {
            listingId,
            componentId,
            buyerProfileId: member.profileId,
            status: "ACTIVE",
            listing: { guildId: member.guildConfigId },
        },
        select: { id: true },
    });
    if (ownReservation) return ephemeral(MARKET_EPHEMERAL.RESERVE_ALREADY_YOURS);

    const outcome = await reserveBundleComponentCore({
        guildId: member.guildConfigId,
        listingId,
        componentId,
        buyerProfileId: member.profileId,
        buyerUserId: userId,
        reservationHours: member.reservationHours,
    });

    if (!outcome.success) {
        logger.info("[market] réservation d'objet refusée", {
            discordGuildId,
            listingId,
            componentId,
            reason: outcome.reason,
        });
        return ephemeral(BUNDLE_RESERVE_FAILURE_MESSAGES[outcome.reason] ?? MARKET_EPHEMERAL.RESERVE_UNAVAILABLE);
    }

    logger.info("[market] réservation d'objet créée depuis Discord", {
        discordGuildId,
        listingId,
        componentId,
        reservationId: outcome.data.reservationId,
    });

    // Resynchronisation **non bloquante** (même contrat que le désistement) :
    // l'état réel doit apparaître dans le salon sans que le clic en dépende.
    try {
        const { syncListingMessage } = await import("@/server/market/discord");
        await syncListingMessage(listingId);
    } catch (error) {
        logger.warn("[market] resynchronisation Discord après réservation d'objet échouée", {
            discordGuildId,
            listingId,
            componentId,
            err: error instanceof Error ? error.message : String(error),
        });
    }

    const dashboardUrl = buildMarketDashboardUrl(getAppBaseUrl(), discordGuildId, listingId);
    return ephemeral(MARKET_EPHEMERAL.RESERVE_SUCCESS, true, [
        buildMarketDashboardLinkRow(dashboardUrl, MARKET_EPHEMERAL_LINK_LABEL),
    ]);
}

/**
 * S4.3 — `mkt:offer:<listingId>` : ouvre la **modale d'offre** (type 9).
 *
 * Les pré-requis du bouton (§13.5 : annonce négociable et **non terminale**,
 * négociations activées, demandeur ≠ vendeur) sont vérifiés **avant** d'ouvrir la
 * modale : un message non resynchronisé ne doit pas laisser saisir une offre
 * vouée à l'échec. La **création** de l'offre à la soumission vit en S4.4 (même
 * moteur que le dashboard).
 *
 * BUG-3 (R3, ratifié) — une annonce **`RESERVED`** reste **négociable** : on peut
 * toujours proposer un prix, le vendeur décide (et doit **lever** la réservation
 * avant d'accepter l'offre).
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
    if (listing.status !== "ACTIVE" && listing.status !== "RESERVED") {
        return ephemeral(MARKET_EPHEMERAL.OFFER_NOT_AVAILABLE);
    }
    if (!member.negotiationsEnabled || !listing.negotiable) {
        return ephemeral(MARKET_EPHEMERAL.OFFER_DISABLED);
    }

    logger.info("[market] modale d'offre ouverte", { discordGuildId, listingId, userId });
    // D43 — « kamas uniquement » : la modale le dit, le serveur le fera respecter.
    return modal(buildMarketOfferModal(listingId, { acceptsTrade: listing.acceptsTrade }));
}

/**
 * BUG-8 — `mkt:cancel:<listingId>` : l'acheteur **se désiste**.
 *
 * Réutilise le moteur partagé `cancelMarketReservationCore()` (§13.4 : aucune
 * règle dupliquée) — garde de statut **dans le `WHERE`**, remise en vente de
 * l'annonce et **notification au vendeur** y vivent déjà.
 *
 * Ici on ne fait que :
 *   1. résoudre le **contexte serveur** (guilde interne + profil SigilOS) ;
 *   2. retrouver **la réservation active de CE membre** — l'annonce est cherchée
 *      par `id` **et** `guildId` (isolation §16.2), le rôle n'est **jamais**
 *      transmis par le client ;
 *   3. appeler le core avec l'identité **serveur** (`actorProfileId`) ;
 *   4. resynchroniser le message Discord (**non bloquant**) pour que le bouton
 *      « Me désister » disparaisse immédiatement.
 */
async function handleCancel(
    discordGuildId: string,
    listingId: string,
    userId: string,
    componentId?: string
): Promise<MarketInteractionOutcome> {
    const member = await resolveMemberContext(discordGuildId, userId);
    if (!member.ok) return member.outcome;

    const listing = await db.marketListing.findFirst({
        where: { id: listingId, guildId: member.guildConfigId, deletedAt: null },
        select: { id: true, profileId: true, status: true },
    });
    if (!listing) return ephemeral(MARKET_EPHEMERAL.LISTING_NOT_FOUND);
    if (listing.profileId === member.profileId) return ephemeral(MARKET_EPHEMERAL.CANCEL_OWN_LISTING);

    const reservation = await db.marketReservation.findFirst({
        where: {
            listingId: listing.id,
            buyerProfileId: member.profileId,
            status: "ACTIVE",
            // 🧺 Objet visé : un même lot peut avoir **plusieurs** réservations
            // simultanées (une par objet) ⇒ le filtre par `componentId` est
            // indispensable, sinon on annulerait la réservation d'un autre objet.
            ...(componentId ? { componentId } : {}),
            listing: { guildId: member.guildConfigId },
        },
        select: { id: true },
    });
    if (!reservation) return ephemeral(MARKET_EPHEMERAL.CANCEL_NOT_YOURS);

    /**
     * 🧺 **Option A** — désistement sur un **objet** de lot : le moteur par objet
     * libère l'objet **et** clôt la réservation (`releaseBundleComponentCore`),
     * puis redérive le statut du lot (`refreshBundleListingStatusCore`) — le lot
     * redevient `ACTIVE` s'il reste des objets disponibles.
     */
    if (componentId) {
        const released = await releaseBundleComponentCore({
            guildId: member.guildConfigId,
            listingId: listing.id,
            componentId,
            reservationStatus: "CANCELLED_BY_BUYER",
            actorUserId: userId,
            reason: "Désistement de l'acheteur (Discord, objet du lot)",
        });
        if (!released.success) {
            logger.info("[market] désistement d'objet refusé", {
                discordGuildId,
                listingId,
                componentId,
                reason: released.reason,
            });
            return ephemeral(MARKET_EPHEMERAL.CANCEL_UNAVAILABLE);
        }

        try {
            const { syncListingMessage } = await import("@/server/market/discord");
            await syncListingMessage(listingId);
        } catch (error) {
            logger.warn("[market] resynchronisation Discord après désistement d'objet échouée", {
                discordGuildId,
                listingId,
                componentId,
                err: error instanceof Error ? error.message : String(error),
            });
        }

        logger.info("[market] désistement d'objet depuis Discord", { discordGuildId, listingId, componentId });
        const componentDashboardUrl = buildMarketDashboardUrl(getAppBaseUrl(), discordGuildId, listingId);
        return ephemeral(MARKET_EPHEMERAL.CANCEL_SUCCESS, true, [
            buildMarketDashboardLinkRow(componentDashboardUrl, MARKET_EPHEMERAL_LINK_LABEL),
        ]);
    }

    if (listing.status !== "RESERVED") return ephemeral(MARKET_EPHEMERAL.CANCEL_UNAVAILABLE);

    const outcome = await cancelMarketReservationCore({
        guildConfigId: member.guildConfigId,
        reservationId: reservation.id,
        actorProfileId: member.profileId,
        actorUserId: userId,
    });
    if (!outcome.ok) {
        logger.info("[market] désistement refusé", {
            discordGuildId,
            listingId,
            reason: outcome.error,
        });
        return ephemeral(MARKET_EPHEMERAL.CANCEL_UNAVAILABLE);
    }

    // Resynchronisation **non bloquante** : le message Discord doit refléter
    // l'état réel (annonce de nouveau `ACTIVE`, bouton « Me désister » retiré).
    try {
        // Import **paresseux** : la chaîne Discord complète n'est chargée que sur
        // un désistement réel (aucun coût pour les autres interactions ni tests).
        const { syncListingMessage } = await import("@/server/market/discord");
        await syncListingMessage(listingId);
    } catch (error) {
        logger.warn("[market] resynchronisation Discord après désistement échouée", {
            discordGuildId,
            listingId,
            err: error instanceof Error ? error.message : String(error),
        });
    }

    logger.info("[market] désistement depuis Discord", { discordGuildId, listingId });
    const dashboardUrl = buildMarketDashboardUrl(getAppBaseUrl(), discordGuildId, listingId);
    return ephemeral(MARKET_EPHEMERAL.CANCEL_SUCCESS, true, [
        buildMarketDashboardLinkRow(dashboardUrl, MARKET_EPHEMERAL_LINK_LABEL),
    ]);
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

    // BUG-8 — **anti-spam des boutons** (docs/RULES.md § Rate Limiting : toute action
    // déclenchée depuis Discord est throttlée **côté serveur**, pas seulement
    // côté bot). `rateLimit()` est **fail-closed** : si Redis est indisponible,
    // le clic est refusé plutôt que laissé passer.
    const limited = await rateLimit(
        `market:discord:${params.userId}:${parsed.action}`,
        MARKET_INTERACTION_RATE_LIMIT.max,
        MARKET_INTERACTION_RATE_LIMIT.windowMs
    );
    if (!limited.success) {
        logger.info("[market] interaction Discord refusée — rate limit", {
            action: parsed.action,
            discordGuildId: params.discordGuildId,
        });
        return ephemeral(MARKET_EPHEMERAL.RATE_LIMITED);
    }

    // S4.2 — réservation : délègue au moteur partagé avec le dashboard (verrou
    // §11.3, refus de sa propre annonce, embed réécrit). Sur un **message par
    // objet**, `parsed.componentId` route vers le moteur par objet (§A1).
    if (parsed.action === "reserve") {
        return handleReserve(params.discordGuildId, parsed.listingId, params.userId, parsed.componentId);
    }

    // S4.3 — offre : ouvre la modale (type 9). La création de l'offre à la
    // soumission vit en S4.4 (même moteur que le dashboard).
    if (parsed.action === "offer") {
        return handleOffer(params.discordGuildId, parsed.listingId, params.userId);
    }

    // BUG-8 — désistement de l'acheteur (moteur partagé `cancelMarketReservationCore`,
    // ou `releaseBundleComponentCore` sur un message par objet).
    if (parsed.action === "cancel") {
        return handleCancel(params.discordGuildId, parsed.listingId, params.userId, parsed.componentId);
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

    // BUG-8 — même anti-spam que les clics (chemin de la modale d'offre).
    const limited = await rateLimit(
        `market:discord:${params.userId}:offer-submit`,
        MARKET_INTERACTION_RATE_LIMIT.max,
        MARKET_INTERACTION_RATE_LIMIT.windowMs
    );
    if (!limited.success) {
        logger.info("[market] soumission de modale refusée — rate limit", {
            discordGuildId: params.discordGuildId,
        });
        return ephemeral(MARKET_EPHEMERAL.RATE_LIMITED);
    }

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
