/**
 * Pagination de l'API DofusDB — **constantes et règle pures** (aucune dépendance : ce module
 * est importable côté client comme côté serveur, y compris par `game-items-cadence`).
 *
 * ⚠️ **Mesure du 24/09/2026** : l'API rend **50 lignes maximum par page**, quel que soit
 * `$limit` — vérifié un par un : `/items?$limit=100` → 50 · `/quests?$limit=500` → 50 ·
 * `/monsters?$limit=200` → 50 · `/effects?$limit=500` → 50 · `/characteristics?$limit=500` → 50.
 *
 * Corollaire à ne jamais oublier : **une page courte ne signifie PAS la fin** des données.
 * La fin se déduit du `total` annoncé par l'API et d'une page **vide** — jamais de
 * `data.length < limite demandée`. Deux siphons s'étaient fait piéger (items : la passe
 * complète s'arrêtait après 50 items ; quêtes : le comparateur ne voyait que 50 quêtes).
 */
export const DOFUSDB_PAGE_MAX = 50;

/**
 * Reste-t-il des pages à lire ? `true` tant qu'on n'a pas couvert le `total` distant.
 * `pageLength <= 0` (page vide) ⇒ `false`, et `total` inconnu ⇒ `false` (on ne boucle pas
 * à l'infini sur une API muette).
 */
export function hasMorePages(skip: number, pageLength: number, total: number | null | undefined): boolean {
    if (pageLength <= 0) return false;
    if (total === null || total === undefined || !Number.isFinite(total) || total <= 0) return false;
    return skip + pageLength < total;
}