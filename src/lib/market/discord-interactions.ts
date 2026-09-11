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

/** Préfixe de toutes les interactions du marché (cf. `DISCORD_PERM_MAP.mkt`). */
export const MARKET_INTERACTION_PREFIX = "mkt";

/** Actions portées par les boutons de l'annonce (§13.3). */
export type MarketInteractionAction = "reserve" | "offer" | "contact";

/** `custom_id` du marché une fois validé. */
export type MarketCustomId = {
    action: MarketInteractionAction;
    listingId: string;
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
    /** S4.2 → S4.5 : actions pas encore livrées, la fiche SigilOS prend le relais. */
    ACTION_PENDING: "🚧 Cette action arrivera bientôt directement sur Discord. En attendant, ouvre la fiche de l'annonce sur SigilOS :",
} as const;
