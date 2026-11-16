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

/**
 * Filtre des **comptes orphelins** du janitor (script VPS, 04h00) — règle pure.
 *
 * ⚠️ **Correctif du 16/11/2026** : le janitor supprimait tout `User` sans
 * `UserProfile` depuis plus de 7 jours. Un **visiteur** (compte sans guilde) n'a
 * *aucun* `UserProfile` — il n'a qu'un `PublicProfile`. Il était donc supprimé au
 * bout de 7 jours, avec ses données, alors que la décision **D-V5** est de **365 j**
 * d'inactivité réelle (`ORPHAN_ACCOUNT_RETENTION_DAYS`, via `lastSeenAt`). Le filtre
 * exclut désormais explicitement tout compte qui porte un `PublicProfile` :
 * la purge des visiteurs reste celle de `account-retention`, pas celle du janitor.
 */
export type OrphanUserWhere = {
    /** Comptes créés avant la coupure. */
    createdAt: { lt: Date };
    /** Aucun profil de guilde (les visiteurs n'en ont pas : voir `publicProfile`). */
    profiles: { none: Record<string, never> };
    /** Aucun profil visiteur non plus : c'est ce qui protège l'espace visiteur. */
    publicProfile: { is: null };
};

export function buildOrphanUserWhere(cutoff: Date): OrphanUserWhere {
    return {
        createdAt: { lt: cutoff },
        profiles: { none: {} },
        publicProfile: { is: null },
    };
}

/** Décision **D-V5** : 365 jours d'inactivité réelle (`User.lastSeenAt`). */
export const ORPHAN_ACCOUNT_RETENTION_DAYS = 365;



/** Bornes de sûreté du noyau (une valeur aberrante ne peut ni vider la base ni ne rien faire). */
export const ORPHAN_RETENTION_MIN_DAYS = 30;
export const ORPHAN_RETENTION_MAX_DAYS = 3650;

/** Durée effective : la valeur demandée, bornée ; sinon la décision D-V5. */
export function resolveOrphanRetentionDays(requested?: number | null): number {
    if (requested === undefined || requested === null) return ORPHAN_ACCOUNT_RETENTION_DAYS;
    return Math.min(ORPHAN_RETENTION_MAX_DAYS, Math.max(ORPHAN_RETENTION_MIN_DAYS, requested));
}
