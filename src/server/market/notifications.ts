/**
 * Module « Marché » — notifications du vendeur (§11.9 / D30 / Q12).
 *
 * ⚠️ Fichier **serveur partagé** : ni `"use server"` (ce n'est pas un server
 * action), ni React. Il porte l'**unique** implémentation de l'alerte Marché,
 * appelée à l'identique par le dashboard et par les interactions Discord :
 *   · `notifyMarketUser()` — trace persistante (`Notification`, catégorie
 *     `MARKET`) ; le réglage `notificationPrefs.market[<type>]` est appliqué
 *     **dans `createNotification`** (§11.9 : un seul point de vérité) ;
 *   · `mentionMarketListingOwner()` — ping du **créateur** dans le fil de son
 *     annonce, pour qu'il soit alerté sans ouvrir le site (Q12) ;
 *   · `notifyMarketSellerActivity()` — les deux, pour une arrivée (offre /
 *     réservation).
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
