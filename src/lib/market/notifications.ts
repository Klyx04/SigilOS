/**
 * Module « Marché » — notifications dashboard (§11.9 / D30).
 *
 * ⚠️ Fichier **pur** : ni `"use server"`, ni Prisma, ni React. Il porte :
 *   · la table `NotificationType` → clé de préférence utilisateur (`market.<clé>`) ;
 *   · la règle **serveur** fail-closed « seul un `false` explicite coupe » ;
 *   · la copie des messages (aucun montant, aucun pseudo → §13.7) ;
 *   · le **chemin** de deep-link vers l'annonce (même route que les boutons
 *     Discord, sans hôte : `Notification.link` est relatif, comme les autres
 *     modules — cf. `service-feedback-actions`).
 *
 * ❌ D30 : **aucun DM Discord**. Le vendeur est alerté par le dashboard + une
 * mention dans le fil de son annonce (§11.9, Q12).
 */

import { buildMarketDashboardUrl } from "@/lib/market/discord-interactions";

/**
 * Correspondance `NotificationType` Marché → clé de `UserProfile.notificationPrefs.market`.
 * Un booléen **par type** (§11.9), à plat pour rester compatible avec le reste
 * des préférences (`missions`, `songes`, `ocre`…).
 */
export const MARKET_NOTIFICATION_PREF_KEYS = {
    MARKET_OFFER_RECEIVED: "offer_received",
    MARKET_RESERVED: "reserved",
    MARKET_RESERVATION_ENDED: "reservation_ended",
    MARKET_OFFER_ANSWERED: "offer_answered",
    MARKET_SOLD: "sold",
    MARKET_REMINDER: "reminder",
    MARKET_ARCHIVED: "archived",
    MARKET_REPORT_OPENED: "report_opened",
} as const;

export type MarketNotificationType = keyof typeof MARKET_NOTIFICATION_PREF_KEYS;
export type MarketNotificationPrefKey = (typeof MARKET_NOTIFICATION_PREF_KEYS)[MarketNotificationType];
/** Contenu de `notificationPrefs.market` (Json, partiel ⇒ tout est optionnel). */
export type MarketNotificationPrefs = Partial<Record<MarketNotificationPrefKey, boolean>>;

/** Les 8 types Marché, dans l'ordre d'affichage des interrupteurs du profil. */
export const MARKET_NOTIFICATION_TYPES = Object.keys(
    MARKET_NOTIFICATION_PREF_KEYS
) as MarketNotificationType[];

/** Libellés des interrupteurs (§11.9 — défaut = tout activé). */
export const MARKET_NOTIFICATION_PREF_LABELS: Record<
    MarketNotificationPrefKey,
    { label: string; hint: string }
> = {
    offer_received: { label: "Offres reçues", hint: "Une offre arrive sur mon annonce" },
    reserved: { label: "Annonce réservée", hint: "Quelqu'un réserve mon objet" },
    reservation_ended: { label: "Réservation terminée", hint: "Annulation ou expiration" },
    offer_answered: { label: "Réponse à mon offre", hint: "Acceptée, refusée, contre-offre" },
    sold: { label: "Vente confirmée", hint: "La transaction est conclue" },
    reminder: { label: "Rappels J+7 / J+15", hint: "Aucune activité sur mon annonce" },
    archived: { label: "Archivage J+20", hint: "Mon annonce expire" },
    report_opened: { label: "Signalements", hint: "Modérateurs du Marché" },
};

/** Nombre de clés de préférences Marché (garde de cohérence des tests/UI). */
export const MARKET_NOTIFICATION_PREF_COUNT = MARKET_NOTIFICATION_TYPES.length;

/** Catégorie `NotificationCategory` utilisée par toutes les notifications Marché. */
export const MARKET_NOTIFICATION_CATEGORY = "MARKET" as const;

/** Longueur maximale d'un libellé d'annonce repris dans une copie. */
export const MARKET_NOTIFICATION_LABEL_MAX = 80;

/**
 * Motif de la ligne `MARKET_RESERVATION_ENDED` : `cancelled` (§11.2) et
 * `expired` (§15.1 point 4) constatent la **fin** de la réservation, `expiring`
 * est le **rappel H-1** (§11.6) — la réservation vit encore et expire dans moins
 * d'une heure.
 */
export type MarketReservationEndReason = "cancelled" | "expired" | "expiring";
/** Issue d'une offre (`MARKET_OFFER_ANSWERED`). */
export type MarketOfferDecision = "accepted" | "rejected" | "counter" | "expired";

/**
 * Titre du **rappel H-1** (§11.6) : la réservation n'est pas terminée, elle
 * expire dans moins d'une heure — le titre générique de `TITLES` dirait
 * l'inverse.
 */
export const MARKET_RESERVATION_EXPIRING_TITLE = "⏳ Réservation bientôt terminée";

const TITLES: Record<MarketNotificationType, string> = {
    MARKET_OFFER_RECEIVED: "🤝 Nouvelle offre reçue",
    MARKET_RESERVED: "📦 Annonce réservée",
    MARKET_RESERVATION_ENDED: "⌛ Réservation terminée",
    MARKET_OFFER_ANSWERED: "📨 Réponse à ton offre",
    MARKET_SOLD: "✅ Vente confirmée",
    MARKET_REMINDER: "🔔 Du nouveau pour ton annonce ?",
    MARKET_ARCHIVED: "🗄️ Annonce archivée",
    MARKET_REPORT_OPENED: "🚩 Signalement Marché à traiter",
};

/**
 * Neutralise un libellé d'annonce avant de le reprendre dans une copie
 * (notification **ou** message Discord) : caractères de contrôle, mentions
 * Discord (`@everyone`, `@here`, `<@…>`, `<@&…>`), balises Markdown, espaces
 * multiples, puis troncature. Un titre d'annonce ne doit jamais pouvoir
 * ping une guilde ni casser la mise en forme.
 */
export function sanitizeMarketLabel(raw: unknown, maxLength: number = MARKET_NOTIFICATION_LABEL_MAX): string {
    if (typeof raw !== "string") return "";

    const cleaned = raw
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/<@[!&]?\d+>/g, " ")
        .replace(/@(everyone|here)/gi, " ")
        .replace(/[`*_~|]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (cleaned.length <= maxLength) return cleaned;
    return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/**
 * Règle serveur (§11.9) : la notification Marché est **activée par défaut** ;
 * seul un `false` explicite dans `notificationPrefs.market[<clé>]` la coupe.
 * Toute forme inattendue du Json (absent, `null`, type erroné, clé inconnue)
 * laisse donc la notification partir — le réglage n'est jamais deviné côté client.
 */
export function isMarketNotificationEnabled(prefs: unknown, type: MarketNotificationType): boolean {
    const key: string | undefined = MARKET_NOTIFICATION_PREF_KEYS[type];
    if (!key) return true;
    if (!prefs || typeof prefs !== "object") return true;

    const market = (prefs as { market?: unknown }).market;
    if (!market || typeof market !== "object") return true;

    return (market as Record<string, unknown>)[key] !== false;
}

/**
 * Chemin **relatif** de la fiche SigilOS d'une annonce, à stocker dans
 * `Notification.link` (les autres modules stockent bien une route relative).
 */
export function buildMarketNotificationLink(discordGuildId: string, listingId: string): string {
    return buildMarketDashboardUrl("", discordGuildId, listingId);
}

export type MarketNotificationCopyParams = {
    /** Titre de l'annonce (nettoyé ici, jamais tronqué plus loin). */
    itemLabel: string;
    /** `MARKET_RESERVED` : durée de la réservation en heures. */
    reservationHours?: number;
    /** `MARKET_RESERVATION_ENDED` : origine de la fin. */
    endReason?: MarketReservationEndReason;
    /** `MARKET_OFFER_ANSWERED` : issue de la négociation. */
    decision?: MarketOfferDecision;
    /** `MARKET_REMINDER` : palier de rappel (1 = J+7, 2 = J+15). */
    reminderStage?: number;
};

/**
 * Titre + message d'une notification Marché (§11.9).
 *
 * §13.7 — la copie est volontairement **pauvre** : aucun montant en kamas,
 * aucun pseudo d'acheteur, aucune stat d'item. L'information sensible reste
 * dans le dashboard.
 */
export function buildMarketNotificationCopy(
    type: MarketNotificationType,
    params: MarketNotificationCopyParams
): { title: string; message: string } {
    const title = type === "MARKET_RESERVATION_ENDED" && params.endReason === "expiring"
        ? MARKET_RESERVATION_EXPIRING_TITLE
        : TITLES[type];
    const label = sanitizeMarketLabel(params.itemLabel) || "ton annonce";
    const hours = params.reservationHours && params.reservationHours > 0
        ? Math.round(params.reservationHours)
        : null;

    let message: string;
    switch (type) {
        case "MARKET_OFFER_RECEIVED":
            message = `Une offre a été déposée sur « ${label} ». Ouvre ton annonce pour y répondre.`;
            break;
        case "MARKET_RESERVED":
            message = hours
                ? `« ${label} » vient d'être réservée. Tu as ${hours} h pour finaliser la vente.`
                : `« ${label} » vient d'être réservée. Contacte l'acheteur pour finaliser la vente.`;
            break;
        case "MARKET_RESERVATION_ENDED":
            if (params.endReason === "expiring") {
                message = `La réservation de « ${label} » expire dans moins d'une heure. Finalisez l'échange en jeu, sinon l'annonce repart en vente.`;
            } else if (params.endReason === "cancelled") {
                message = `La réservation de « ${label} » a été annulée.`;
            } else {
                message = `La réservation de « ${label} » a expiré.`;
            }
            break;
        case "MARKET_OFFER_ANSWERED":
            if (params.decision === "accepted") message = `Ton offre sur « ${label} » a été acceptée.`;
            else if (params.decision === "rejected") message = `Ton offre sur « ${label} » a été refusée.`;
            else if (params.decision === "counter") message = `Une contre-offre a été proposée sur « ${label} ».`;
            else if (params.decision === "expired") message = `Ton offre sur « ${label} » a expiré sans réponse.`;
            else message = `Ta négociation sur « ${label} » a évolué.`;
            break;
        case "MARKET_SOLD":
            message = `La vente de « ${label} » est confirmée. Merci !`;
            break;
        case "MARKET_REMINDER":
            message = params.reminderStage === 2
                ? `Ton annonce « ${label} » n'a eu aucune activité depuis 15 jours. Renouvelle-la ou retire-la avant l'archivage.`
                : `Ton annonce « ${label} » n'a eu aucune activité depuis 7 jours. Un renouvellement ?`;
            break;
        case "MARKET_ARCHIVED":
            message = `Ton annonce « ${label} » a été archivée après 20 jours sans activité.`;
            break;
        case "MARKET_REPORT_OPENED":
            message = `Une annonce a été signalée : « ${label} ». Dossier à traiter.`;
            break;
        default:
            message = `Mise à jour sur « ${label} ».`;
            break;
    }

    return { title, message };
}

/**
 * Texte de la mention Discord du **créateur** dans le fil de son annonce
 * (§11.9 Q12) : « quand une offre ou une réservation arrive ». `discordUserId`
 * est un snowflake ; absent ⇒ message sans ping (jamais de faux `@`).
 */
export function buildMarketOwnerMentionCopy(
    type: "MARKET_OFFER_RECEIVED" | "MARKET_RESERVED",
    params: { itemLabel: string; reservationHours?: number; discordUserId?: string | null }
): string {
    const { message } = buildMarketNotificationCopy(type, {
        itemLabel: params.itemLabel,
        reservationHours: params.reservationHours,
    });
    const mention = params.discordUserId ? `<@${params.discordUserId}> ` : "";
    return `${mention}${message}`;
}
