/**
 * Espace visiteur — politique de rétention des comptes orphelins (**D-V5**, 06/11/2026).
 *
 * Décision user (verbatim) : « 365 jrs pour tous ». Une seule durée, aucun cas particulier
 * (ni « 90 j », ni « visiteurs seulement »). Le cron `account-retention` purge les comptes
 * sans profil ACTIVE dont `lastSeenAt` est plus vieux que cette durée.
 *
 * ⚠️ Une durée plus **courte** passée explicitement par un appelant God reste honorée :
 * cette constante est le **défaut**, pas un plancher.
 */

export const ORPHAN_ACCOUNT_RETENTION_DAYS = 365;

/** Bornes de sûreté du noyau (une valeur aberrante ne peut ni vider la base ni ne rien faire). */
export const ORPHAN_RETENTION_MIN_DAYS = 30;
export const ORPHAN_RETENTION_MAX_DAYS = 3650;

/** Durée effective : la valeur demandée, bornée ; sinon la décision D-V5. */
export function resolveOrphanRetentionDays(requested?: number | null): number {
    if (requested === undefined || requested === null) return ORPHAN_ACCOUNT_RETENTION_DAYS;
    return Math.min(ORPHAN_RETENTION_MAX_DAYS, Math.max(ORPHAN_RETENTION_MIN_DAYS, requested));
}
