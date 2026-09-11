/**
 * Module « Marché » — notifications dashboard du vendeur **et de l'acheteur**
 * (§11.9 / D30 / Q12).
 *
 * ⚠️ Fichier **serveur partagé** : ni `"use server"` (ce n'est pas un server
 * action), ni React. Il porte l'**unique** implémentation des alertes Marché,
 * appelée à l'identique par le dashboard et par les interactions Discord :
 *   · `notifyMarketUser()` — trace persistante (`Notification`, catégorie
 *     `MARKET`) ; le réglage `notificationPrefs.market[<type>]` est appliqué
 *     **dans `createNotification`** (§11.9 : un seul point de vérité) ;
 *   · `mentionMarketListingOwner()` — ping du **créateur** dans le fil de son
 *     annonce, pour qu'il soit alerté sans ouvrir le site (Q12) ;
 *   · `notifyMarketSellerActivity()` — les deux, pour une arrivée (offre /
 *     réservation) ;
 *   · `notifyMarketBuyerActivity()` — l'acheteur apprend la **décision du
 *     vendeur** (`MARKET_OFFER_ANSWERED`) ou la **conclusion** (`MARKET_SOLD`) ;
 *   · `notifyMarketReservationEnded()` — la ligne « vendeur **+** acheteur »
 *     d'une réservation annulée ou expirée (§11.2 / §15.1 point 4).
 *
 * ❌ D30 : **aucun DM Discord** — tout passe par SigilOS + la mention du fil.
 * Aucune de ces fonctions ne lève : une panne Discord ou BDD ne doit jamais
 * faire échouer l'action métier déjà commitée (même philosophie que
 * `syncListingMessage`, §13.6).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendChannelMessage } from "@/server/discord";
import { createNotification } from "@/server/actions/notification-actions";
import {
    buildMarketNotificationCopy,
    buildMarketNotificationLink,
    buildMarketOwnerMentionCopy,
    type MarketNotificationCopyParams,
    type MarketNotificationType,
    type MarketOfferDecision,
    type MarketReservationEndReason,
} from "@/lib/market/notifications";

/** Événements qui déclenchent aussi une mention Discord du créateur (Q12). */
export type MarketSellerActivityType = "MARKET_OFFER_RECEIVED" | "MARKET_RESERVED";

/** Destinataire d'une notification Marché. */
export type MarketNotificationTarget = {
    /** `User.id` SigilOS du destinataire (vendeur, acheteur, créateur, modo). */
    userId: string;
    /** Snowflake Discord de la guilde (scope multi-tenant + deep-link). */
    discordGuildId: string;
    /** `MarketListing.id` — sert au deep-link et à la résolution du fil. */
    listingId: string;
    /** Titre de l'annonce (nettoyé dans `buildMarketNotificationCopy`). */
    itemLabel: string;
};

/**
 * Crée **une** notification Marché pour un membre.
 *
 * Le réglage utilisateur est lu par `createNotification` (fail-closed §11.9) :
 * rien à dupliquer ici. Renvoie `true` si le `create` a été tenté.
 */
export async function notifyMarketUser(
    type: MarketNotificationType,
    target: MarketNotificationTarget,
    copyParams: Omit<MarketNotificationCopyParams, "itemLabel"> = {}
): Promise<boolean> {
    try {
        const { title, message } = buildMarketNotificationCopy(type, {
            itemLabel: target.itemLabel,
            ...copyParams,
        });

        await createNotification(
            target.userId,
            type,
            title,
            message,
            buildMarketNotificationLink(target.discordGuildId, target.listingId),
            target.discordGuildId,
            "MARKET"
        );

        return true;
    } catch (error) {
        logger.error("[market] notification vendeur échouée", { type, err: error });
        return false;
    }
}

/**
 * Snowflake Discord d'un membre (`Account` Auth.js, provider `discord`) —
 * même résolution que `calendar-service` / `songes-service`.
 */
export async function resolveMarketDiscordUserId(userId: string): Promise<string | null> {
    const account = await db.account.findFirst({
        where: { userId, provider: "discord" },
        select: { providerAccountId: true },
    });
    return account?.providerAccountId ?? null;
}

/**
 * Mention du **créateur** dans le fil de son annonce (Q12) : « quand une offre
 * ou une réservation arrive », pour l'alerter sans qu'il ouvre SigilOS.
 *
 * Gardes : annonce publiée (`MarketDiscordMessage`), guilde identique (§16.2),
 * membre relié à un compte Discord. Aucun montant ni pseudo n'est publié
 * (§13.7) et les embeds sont neutralisés (`suppressEmbeds`) pour ne pas
 * polluer le salon. Renvoie `true` seulement si Discord a accepté le message.
 */
export async function mentionMarketListingOwner(params: {
    type: MarketSellerActivityType;
    /** `MarketListing.userId` du créateur (propriétaire logique). */
    ownerUserId: string;
    listingId: string;
    discordGuildId: string;
    itemLabel: string;
    reservationHours?: number;
}): Promise<boolean> {
    try {
        const discordMessage = await db.marketDiscordMessage.findUnique({
            where: { listingId: params.listingId },
            select: { discordChannelId: true, discordGuildId: true },
        });

        // Annonce en brouillon / pas encore publiée : aucun fil à mentionner.
        if (!discordMessage) return false;
        if (discordMessage.discordGuildId !== params.discordGuildId) {
            logger.warn("[market] mention refusée — guilde Discord différente", { listingId: params.listingId });
            return false;
        }

        const discordUserId = await resolveMarketDiscordUserId(params.ownerUserId);
        if (!discordUserId) {
            logger.info("[market] mention impossible — créateur sans compte Discord", { listingId: params.listingId });
            return false;
        }

        const content = buildMarketOwnerMentionCopy(params.type, {
            itemLabel: params.itemLabel,
            reservationHours: params.reservationHours,
            discordUserId,
        });

        const messageId = await sendChannelMessage(discordMessage.discordChannelId, content, {
            suppressEmbeds: true,
        });

        return Boolean(messageId);
    } catch (error) {
        logger.warn("[market] mention Discord différée", { listingId: params.listingId, err: String(error) });
        return false;
    }
}

/**
 * Arrivée d'une activité sur une annonce (§11.9) : notification dashboard du
 * vendeur **puis** mention Discord du créateur. Les deux appels sont
 * indépendants et non bloquants pour l'action métier appelante.
 */
export async function notifyMarketSellerActivity(params: {
    type: MarketSellerActivityType;
    ownerUserId: string;
    /** `UserProfile.id` du vendeur — sert à ne pas s'auto-notifier. */
    ownerProfileId?: string;
    listingId: string;
    discordGuildId: string;
    itemLabel: string;
    reservationHours?: number;
    /** Profil à l'origine de l'activité : jamais notifié ici (§11.9 : S4.9). */
    actorProfileId?: string;
}): Promise<void> {
    if (params.ownerProfileId && params.actorProfileId === params.ownerProfileId) return;

    await notifyMarketUser(
        params.type,
        {
            userId: params.ownerUserId,
            discordGuildId: params.discordGuildId,
            listingId: params.listingId,
            itemLabel: params.itemLabel,
        },
        { reservationHours: params.reservationHours }
    );

    await mentionMarketListingOwner({
        type: params.type,
        ownerUserId: params.ownerUserId,
        listingId: params.listingId,
        discordGuildId: params.discordGuildId,
        itemLabel: params.itemLabel,
        reservationHours: params.reservationHours,
    });
}

// ---------------------------------------------------------------------------
// ACHETEUR (S4.9 — §11.9)
// ---------------------------------------------------------------------------

/** Événements dont l'**acheteur** est le seul destinataire (§11.9). */
export type MarketBuyerActivityType = "MARKET_OFFER_ANSWERED" | "MARKET_SOLD";

/**
 * Informe **l'acheteur** de la suite donnée à sa démarche (§11.9) : réponse du
 * vendeur à son offre (`MARKET_OFFER_ANSWERED`) ou vente confirmée
 * (`MARKET_SOLD`).
 *
 * ❌ Aucune mention Discord : Q12 ne ping que le **créateur** de l'annonce, et
 * D30 supprime tout message privé. La ligne du tableau dit « toast + entrée »
 * pour une réponse d'offre : le toast est porté par l'action immédiate (S4.10),
 * l'entrée persistante par cette fonction.
 *
 * Le réglage `notificationPrefs.market[...]` de l'acheteur est appliqué par
 * `createNotification` (fail-closed §11.9) : rien à dupliquer ici. Ne lève
 * jamais ; renvoie `true` si le `create` a été tenté.
 */
export async function notifyMarketBuyerActivity(params: {
    type: MarketBuyerActivityType;
    /** `MarketOffer.buyerUserId` / `MarketReservation.buyerUserId`. */
    buyerUserId: string;
    listingId: string;
    discordGuildId: string;
    itemLabel: string;
    /** `MARKET_OFFER_ANSWERED` : issue transmise à l'acheteur. */
    decision?: MarketOfferDecision;
}): Promise<boolean> {
    return notifyMarketUser(
        params.type,
        {
            userId: params.buyerUserId,
            discordGuildId: params.discordGuildId,
            listingId: params.listingId,
            itemLabel: params.itemLabel,
        },
        { decision: params.decision }
    );
}

/** Une partie d'une réservation (`UserProfile.id` sert à écarter l'auteur). */
export type MarketReservationParty = {
    /** `User.id` SigilOS du destinataire. */
    userId: string;
    /** `UserProfile.id` — l'auteur de l'action n'est jamais notifié de son geste. */
    profileId?: string;
};

/**
 * Réservation terminée — **annulation** (§11.2) ou **expiration** (§15.1 point 4).
 *
 * La ligne §11.9 vise « vendeur **+** acheteur » : les deux parties reçoivent la
 * même entrée `MARKET_RESERVATION_ENDED`, sans jamais notifier l'auteur de
 * l'action (annulation) ni deux fois le même membre. Ne lève jamais : chaque
 * envoi est absorbé par `notifyMarketUser`.
 *
 * Renvoie le nombre d'entrées réellement créées (télémétrie du cron S5.1).
 */
export async function notifyMarketReservationEnded(params: {
    /** `cancelled` (§11.2) ou `expired` (§15.1 point 4). */
    reason: MarketReservationEndReason;
    listingId: string;
    discordGuildId: string;
    itemLabel: string;
    /** Le vendeur (`MarketListing.userId`) — cible n°1. */
    seller?: MarketReservationParty;
    /** L'acheteur (`MarketReservation.buyerUserId`). */
    buyer?: MarketReservationParty;
    /** `UserProfile.id` de l'auteur de l'action, s'il y en a un (annulation). */
    actorProfileId?: string;
}): Promise<number> {
    const parties = [params.seller, params.buyer].filter(
        (party): party is MarketReservationParty => Boolean(party?.userId)
    );

    const seen = new Set<string>();
    let sent = 0;

    for (const party of parties) {
        if (seen.has(party.userId)) continue;
        seen.add(party.userId);
        if (params.actorProfileId && party.profileId === params.actorProfileId) continue;

        const created = await notifyMarketUser(
            "MARKET_RESERVATION_ENDED",
            {
                userId: party.userId,
                discordGuildId: params.discordGuildId,
                listingId: params.listingId,
                itemLabel: params.itemLabel,
            },
            { endReason: params.reason }
        );
        if (created) sent += 1;
    }

    return sent;
}
