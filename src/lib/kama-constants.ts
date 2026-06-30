/**
 * Constantes des mécaniques kamas de guilde (Dofus)
 * Séparé des server actions pour éviter les imports côté client depuis "use server"
 */

/** Kamas par tranche */
export const KAMA_TRANCHE = 10_000;

/** Tranches max par semaine par compte */
export const KAMA_MAX_TRANCHES = 5;

/** Maximum de kamas par semaine = 50 000 */
export const KAMA_MAX_PER_WEEK = KAMA_TRANCHE * KAMA_MAX_TRANCHES;

/** Récompenses par tranche */
export const REWARDS_PER_TRANCHE = {
    xp: 100,        // Points d'activité
    guildatons: 10, // Guildatons
    guild_kamas: 10, // Kamas de guilde
} as const;

/** Maximum de guildatons par semaine par personne */
export const GUILDATONS_MAX_PER_WEEK = 300;
