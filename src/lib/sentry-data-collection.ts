/**
 * Collecte de données Sentry — **profil fermé**, source unique des trois runtimes.
 *
 * Mesure du 09/11/2026 (migration `@sentry/nextjs` **10 → 11**) : le SDK v11 remplace
 * `sendDefaultPii` par `dataCollection`, et **ses défauts collectent beaucoup plus** —
 * `userInfo`, `cookies`, `httpHeaders`, `httpBodies` (les quatre sens), `urlQueryParams`,
 * `databaseQueryData` et `stackFrameVariables` sont tous à `true` (lus dans
 * `@sentry/core/build/types/types/datacollection.d.ts`).
 *
 * Jusqu'ici nous n'envoyions rien de tout cela (`sendDefaultPii` absent) : laisser les
 * défauts v11 serait donc une **régression de confidentialité** sur un produit public
 * (aucun identifiant, cookie, jeton ni corps de requête ne doit partir — `docs/SECURITY.md`).
 *
 * On garde ce qui sert à corriger (message, pile, contexte de code) et on ferme tout ce qui
 * peut porter un secret ou une donnée personnelle. Une exception à rouvrir consciemment :
 * `frameContextLines` (contexte de code) reste au défaut, il ne porte pas de donnée.
 */
/** Les quatre sens de collecte de corps exposés par le SDK (union littérale, sans import). */
type HttpBodyTarget = "incomingRequest" | "outgoingRequest" | "incomingResponse" | "outgoingResponse";

export const SENTRY_DATA_COLLECTION = {
    /** Aucun `user.*` rempli automatiquement (pas d'identifiant Discord, pas d'e-mail). */
    userInfo: false,
    /** Jamais de cookie (session, `__cf_bm`, etc.). */
    cookies: false,
    /** Jamais d'en-têtes bruts (`Authorization`, `Cookie`, `CF-Ray`…). */
    httpHeaders: false,
    /** Aucun corps de requête ni de réponse. */
    httpBodies: [] as HttpBodyTarget[],
    /** Aucun paramètre d'URL (ids et jetons y traînent). */
    urlQueryParams: false,
    /** Pas de paramètres liés des requêtes SQL. */
    databaseQueryData: false,
    /** Pas de valeurs de variables locales (elles contiennent des jetons). */
    stackFrameVariables: false,
    /** Intégrations non utilisées : fermées explicitement, pas par défaut. */
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false },
};
