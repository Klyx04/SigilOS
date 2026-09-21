/**
 * Routes **historiques** du site, désormais mortes — nettoyage Search Console.
 *
 * Les fiches boss sont passées de `/boss/<cuid>` à `/boss/<slug>` (nom du boss). Les
 * anciennes URL répondaient **404** ; on répond désormais **410 Gone**, que Google traite
 * comme « supprimé définitivement » et retire **plus vite** de son index (constat GSC du
 * 21/09/2026 : ces URL traînaient dans « Explorée, actuellement non indexée »).
 *
 * ⚠️ Le motif est **purement syntaxique** (aucun accès base dans le proxy) et **strict** :
 * les identifiants observés en production font **exactement 24 caractères** (`c` + 23 en
 * base36 — mesuré sur les exemples remontés par GSC). Aucun slug de boss ne peut matcher :
 * une longueur pareille sans tiret, tout en minuscules/chiffres, n'existe pas dans nos
 * données (les slugs longs sont des noms composés, donc à tirets).
 */
const LEGACY_BOSS_ID_RE = /^\/boss\/c[a-z0-9]{23}$/;

/** `/boss/<cuid>` (identifiant historique) ⇒ true. Slug, `/boss` ou autre route ⇒ false. */
export function isLegacyBossIdPath(pathname: string): boolean {
    return LEGACY_BOSS_ID_RE.test(pathname);
}
