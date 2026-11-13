/**
 * Cache de contenu (`ContentCache`) — ce que le rafraîchissement du feed **remplace**.
 *
 * Le feed agrégé (actualités Ankama, DPLN, Twitch, YouTube) est une **image** : on
 * purge puis on réinsère. La purge et l'écriture doivent viser **exactement** les mêmes
 * lignes, sinon deux défauts apparaissent :
 *   1. une famille non purgée doit être mise à jour ligne par ligne (⇒ `upsert` dans une
 *      boucle = **N+1** détecté par Sentry, `JAVASCRIPT-NEXTJS-24`) ;
 *   2. une famille purgée mais non réinsérée disparaît de l'onglet.
 *
 * ⚠️ Le tag `Dofus-Changelog` (`type: "NEWS"`, `creatorId: "Dofus-Changelog"`) est
 * **volontairement exclu** : il a son propre cache 30 min et doit survivre aux
 * rafraîchissements du feed (cf. `api/resources/news/route.ts`).
 *
 * Règle pure (aucune I/O) → verrou `tests/unit/feed-cache-batch.test.ts`.
 */

/** Types de contenu dont le feed est propriétaire (réécrits à chaque rafraîchissement). */
export const FEED_CACHE_OWNED_TYPES = ["TWITCH", "YOUTUBE"] as const;

/** Créateurs agrégés par le feed, quel que soit leur `type`. */
export const FEED_CACHE_OWNED_CREATORS = ["Ankama", "DPLN"] as const;

/**
 * Filtre Prisma de la purge : **toutes** les familles que le feed réécrit, et elles
 * seules. C'est l'engagement « la purge couvre exactement ce qu'on réinsère » —
 * vérifié par `tests/unit/feed-cache-batch.test.ts`.
 */
export const FEED_CACHE_PURGE_WHERE: {
    OR: Array<{ type: { in: string[] } } | { creatorId: { in: string[] } }>;
} = {
    OR: [
        { type: { in: [...FEED_CACHE_OWNED_TYPES] } },
        { creatorId: { in: [...FEED_CACHE_OWNED_CREATORS] } },
    ],
};

/** `true` si la ligne peut être purgée par le rafraîchissement du feed. */
export function isFeedCacheRowOwned(type: string, creatorId: string): boolean {
    return (
        (FEED_CACHE_OWNED_TYPES as readonly string[]).includes(type) ||
        (FEED_CACHE_OWNED_CREATORS as readonly string[]).includes(creatorId)
    );
}

/** Clé d'unicité de la table (`@@unique([type, creatorId, url])`). */
export function feedCacheKey(row: { type: string; creatorId: string; url: string }): string {
    return `${row.type}\u0000${row.creatorId}\u0000${row.url}`;
}

/**
 * Déduplique un lot avant écriture : `createMany` n'accepte **pas** deux lignes de même
 * clé dans la même instruction (même avec `skipDuplicates`). La **dernière** occurrence
 * gagne — c'est la plus fraîche quand une source répète une URL dans son propre flux.
 */
export function dedupeFeedCacheRows<T extends { type: string; creatorId: string; url: string }>(
    rows: readonly T[]
): T[] {
    const byKey = new Map<string, T>();
    for (const row of rows) {
        byKey.set(feedCacheKey(row), row);
    }
    return [...byKey.values()];
}
