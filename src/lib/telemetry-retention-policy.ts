/**
 * Rétention de la télémétrie et du journal d'activité — **source unique**, pure
 * (sans Prisma, sans `"use server"`).
 *
 * Décision user (16/11/2026) :
 *   • `TelemetryEvent` → **90 j** : assez pour les tendances du God, assez court
 *     pour des données de navigation (`userName`, `path`, contenu d'événement) ;
 *   • `ServiceActivityLog` → **365 j** : un an d'historique de vie de guilde.
 *
 * Ces deux tables étaient les **dernières sans purge** : tout le reste est déjà
 * borné (audit 90/30 j, notifications God 90 j, comptes 365 j, tickets par
 * limites plateforme, médias et logs du marché 30/365 j).
 *
 * Consommée par le core serveur (`src/server/log-retention.ts`) **et** par le
 * janitor du VPS (`scripts/database-janitor.ts`, import relatif — il ne connaît
 * pas les alias `@/`), pour que la politique ne dérive jamais entre les deux.
 */

import { MS_PER_DAY } from "./audit-retention-policy";

/** Rétention par nature de journal (jours). */
export const LOG_RETENTION_DAYS = {
    /** Navigation : tendances courtes, données identifiantes. */
    TELEMETRY: 90,
    /** Vie de guilde : un an d'historique. */
    SERVICE_ACTIVITY: 365,
} as const;

/**
 * Taille du lot par passe. Le cron tourne 1×/j : un lot large évite des dizaines
 * de passes sans jamais charger une table entière dans une transaction.
 */
export const LOG_PURGE_BATCH_SIZE = 500;

/**
 * Budget de lots par passe. Borne la durée du cron et du janitor ; si `hasMore`
 * reste vrai plusieurs jours, le budget s'augmente **avec une mesure**, pas au hasard.
 */
export const LOG_PURGE_MAX_BATCHES = 10;

/** Date de coupure : « ce qui a été journalisé **avant** N jours ». */
export function logPurgeCutoff(now: Date, days: number): Date {
    return new Date(now.getTime() - days * MS_PER_DAY);
}

/**
 * Filtre de purge de la télémétrie. Fonction dédiée (et non un littéral partagé)
 * pour que les deux tables puissent diverger sans toucher l'autre.
 */
export function buildTelemetryPurgeWhere(cutoff: Date): { createdAt: { lt: Date } } {
    return { createdAt: { lt: cutoff } };
}

/** Filtre de purge du journal d'activité (la guilde est ajoutée par le core). */
export function buildServiceActivityPurgeWhere(cutoff: Date): { createdAt: { lt: Date } } {
    return { createdAt: { lt: cutoff } };
}
