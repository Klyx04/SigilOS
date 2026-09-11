/**
 * Module « Marché » — interactions Discord (S4.1).
 *
 * ⚠️ Fichier **PUR** (ni Prisma, ni React, ni réseau) → testé par
 * `tests/unit/market-discord-interactions.test.ts`.
 *
 * Contrat §13.4 : la route `/api/discord/interactions` ne contient **aucune
 * règle métier**. Ce fichier porte les trois éléments décidables sans base :
 *   1. le **parsing fail-closed** des `custom_id` du marché, produits par les
 *      boutons de l'annonce (`mkt:<action>:<listingId>`, §13.3) ;
 *   2. le **catalogue des messages éphémères** (§13.5) : un membre reçoit
 *      **toujours** une explication, succès comme refus, jamais de silence ;
 *   3. la **construction d'URL** de la fiche SigilOS (bouton lien).
 *
 * Rien ici ne connaît la base : la guilde, le module actif et les actions
 * vivent dans `src/server/market/discord-interactions.ts`.
 */

import { KAMAS_MAX } from "@/lib/market/kamas";

/** Préfixe de toutes les interactions du marché (cf. `DISCORD_PERM_MAP.mkt`). */
export const MARKET_INTERACTION_PREFIX = "mkt";

/** Actions portées par les boutons de l'annonce (§13.3). */
export type MarketInteractionAction = "reserve" | "offer" | "contact";

/** `custom_id` du marché une fois validé. */
export type MarketCustomId = {
    action: MarketInteractionAction;
    listingId: string;
};

/**
 * Champ texte d'une modale Discord (`ActionRow` + `TextInput`).
 *
 * Discord impose **exactement un** composant par ligne (`type: 1`) et au plus
 * **5 lignes** par modale (§13.5 : 3 champs).
 */
export type MarketModalComponent = {
    type: 1;
    components: Array<{
        type: 4;
        custom_id: string;
        label: string;
        style: 1 | 2;
        required: boolean;
        max_length: number;
        placeholder?: string;
    }>;
};

/** Contenu de `data` d'une réponse Discord **type 9** (modale). */
export type MarketModalPayload = {
    custom_id: string;
    title: string;
    components: MarketModalComponent[];
};

const MARKET_INTERACTION_ACTIONS: readonly MarketInteractionAction[] = ["reserve", "offer", "contact"];

/** Bornes d'un `cuid()` : tout `listingId` hors de ces bornes est refusé. */
const LISTING_ID_MIN_LENGTH = 6;
const LISTING_ID_MAX_LENGTH = 40;

/** Caractères admis dans un identifiant d'annonce (`cuid` / `cuid2`). */
const LISTING_ID_PATTERN = /^[a-z0-9]+$/i;

/**
 * `mkt:<action>:<listingId>` → action + annonce.
 *
 * Retourne `null` dès que la forme n'est **pas exactement** celle produite par
 * les boutons (§0.1 fail-closed) : un `custom_id` bricolé, tronqué, d'une autre
 * version du payload ou d'un autre module n'entraîne **aucune** action métier.
 */
export function parseMarketCustomId(customId: string): MarketCustomId | null {
    if (typeof customId !== "string") return null;

    const parts = customId.split(":");
    if (parts.length !== 3) return null;

    const [prefix, rawAction, listingId] = parts;
    if (prefix !== MARKET_INTERACTION_PREFIX) return null;
    if (!MARKET_INTERACTION_ACTIONS.includes(rawAction as MarketInteractionAction)) return null;
    if (listingId.length < LISTING_ID_MIN_LENGTH || listingId.length > LISTING_ID_MAX_LENGTH) return null;
    if (!LISTING_ID_PATTERN.test(listingId)) return null;

    return { action: rawAction as MarketInteractionAction, listingId };
}

/**
 * URL absolue de la fiche SigilOS d'une annonce
 * (`/dashboard/<discordGuildId>/marche/<listingId>`).
 *
 * Le slash final éventuel de la base est neutralisé : une **seule** forme d'URL
 * circule dans le module (payload de l'annonce §13.3 et boutons Discord).
 */
export function buildMarketDashboardUrl(baseUrl: string, discordGuildId: string, listingId: string): string {
    const base = baseUrl.replace(/\/+$/, "");
    return `${base}/dashboard/${discordGuildId}/marche/${listingId}`;
}

/**
 * §13.5 — Modale « Faire une offre » (type 9) : **3 champs**, tous facultatifs
 * côté Discord. La règle « **kamas OU troc** » n'est **pas** exprimable en
 * modale : elle est appliquée par le serveur à la soumission (S4.4).
 *
 * Les bornes vivent ici (contrat UI) et sont **réutilisées** par la validation
 * serveur : une seule source de vérité pour les deux étapes du formulaire.
 */
export const MARKET_OFFER_MODAL = {
    /** Titre affiché (Discord : 1 → 45 caractères). */
    TITLE: "Faire une offre",
    /** `custom_id` des champs — jamais de chaîne libre ailleurs. */
    FIELDS: {
        KAMAS: "kamas",
        TRADE: "trade",
        NOTE: "note",
    },
    /** Longueurs maximales miroir de §13.5 (validation à la soumission). */
    KAMAS_MAX_LENGTH: String(KAMAS_MAX).length,
    TRADE_MAX_LENGTH: 200,
    NOTE_MAX_LENGTH: 500,
} as const;

/**
 * Construit la modale d'offre d'une annonce.
 *
 * Le `custom_id` de la modale reprend **exactement** la forme des boutons
 * (`mkt:offer:<listingId>`) : la soumission (type 5) est donc reparsée par
 * `parseMarketCustomId()`, sans second format à maintenir.
 */
export function buildMarketOfferModal(listingId: string): MarketModalPayload {
    const field = (
        customId: string,
        label: string,
        placeholder: string,
        style: 1 | 2,
        maxLength: number
    ): MarketModalComponent => ({
        type: 1,
        components: [
            {
                type: 4,
                custom_id: customId,
                label,
                style,
                required: false,
                max_length: maxLength,
                placeholder,
            },
        ],
    });

    return {
        custom_id: `${MARKET_INTERACTION_PREFIX}:offer:${listingId}`,
        title: MARKET_OFFER_MODAL.TITLE,
        components: [
            field(MARKET_OFFER_MODAL.FIELDS.KAMAS, "Montant en kamas (facultatif)", "Ex : 45000000", 1, MARKET_OFFER_MODAL.KAMAS_MAX_LENGTH),
            field(MARKET_OFFER_MODAL.FIELDS.TRADE, "Troc proposé (facultatif)", "Objet ou lot proposé en échange", 2, MARKET_OFFER_MODAL.TRADE_MAX_LENGTH),
            field(MARKET_OFFER_MODAL.FIELDS.NOTE, "Message au vendeur (facultatif)", "Un mot pour le vendeur (dispo, négociation…)", 2, MARKET_OFFER_MODAL.NOTE_MAX_LENGTH),
        ],
    };
}

/**
 * Messages éphémères (§13.5) — **toutes** les issues d'un clic sont couvertes.
 *
 * Interdits : afficher un montant d'offre ou un pseudo d'acheteur (§13.7), ou
 * laisser un clic sans réponse visible.
 */
export const MARKET_EPHEMERAL = {
    /** `custom_id` inconnu / obsolète (vieux bouton, message bricolé). */
    UNKNOWN_ACTION: "❌ Cette action du Marché n'est plus valable.",
    /** Interaction hors serveur : la guilde ne peut pas être isolée (§16.2). */
    GUILD_REQUIRED: "⚠️ Utilise ce bouton depuis le serveur Discord de ta guilde.",
    /** Module `marche` inactif pour la guilde (`DEFAULT_MODULES` inclus). */
    MODULE_DISABLED: "🔒 Le Marché est désactivé sur ce serveur.",
    /** S4.3 → S4.5 : actions pas encore livrées, la fiche SigilOS prend le relais. */
    ACTION_PENDING: "🚧 Cette action arrivera bientôt directement sur Discord. En attendant, ouvre la fiche de l'annonce sur SigilOS :",
    /** S4.2 — réservation acceptée (§11.2 : l'échange se conclut en jeu). */
    RESERVE_SUCCESS: "✅ Annonce réservée ! Le vendeur sera prévenu — l'échange se conclut **en jeu**.",
    /** S4.2 — un vendeur ne réserve pas sa propre annonce (§11.2/D34). */
    RESERVE_OWN_LISTING: "❌ Tu ne peux pas réserver ta propre annonce.",
    /** S4.2 — annonce déjà `RESERVED`/`SOLD`/`EXPIRED`/`WITHDRAWN`. */
    RESERVE_UNAVAILABLE: "❌ Cette annonce n'est plus disponible.",
    /** S4.2 — §11.3 : quelqu'un a validé le verrou transactionnel avant. */
    RESERVE_CONFLICT: "❌ Cette annonce vient d'être réservée par quelqu'un d'autre.",
    /** S4.3 — un vendeur ne fait pas d'offre sur sa propre annonce (§11.2/D34). */
    OFFER_OWN_LISTING: "❌ Tu ne peux pas faire d'offre sur ta propre annonce.",
    /** S4.3 — annonce plus `ACTIVE` (déjà réservée / vendue / expirée / retirée). */
    OFFER_NOT_AVAILABLE: "❌ Cette annonce n'est plus disponible.",
    /** S4.3 — négociations coupées (réglage guilde ou annonce non négociable). */
    OFFER_DISABLED: "❌ Les négociations sont désactivées sur cette annonce.",
    /** Annonce absente ou appartenant à une autre guilde (§16.2). */
    LISTING_NOT_FOUND: "❌ Cette annonce est introuvable.",
    /** Membre sans profil SigilOS actif dans la guilde : refus explicite. */
    PROFILE_REQUIRED: "❌ Termine d'abord ton profil SigilOS dans cette guilde pour utiliser le Marché.",
    /** Échec technique inattendu : jamais de silence (§13.5). */
    GENERIC_ERROR: "❌ L'action a échoué, réessaie dans un instant.",
} as const;
