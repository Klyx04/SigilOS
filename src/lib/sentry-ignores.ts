/**
 * Faux positifs Sentry — **source unique** des trois runtimes
 * (`src/instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`).
 *
 * 🐛 Pourquoi un module partagé (mesure du 11/10/2026) : le filtre
 * `UnrecognizedActionError` n'existait que dans la config **navigateur**. Or
 * `src/instrumentation.ts` expose `onRequestError = Sentry.captureRequestError` :
 * une Server Action inconnue **remonte côté serveur** ⇒ le filtre client ne
 * s'appliquait pas et l'issue atteignait **1 870 événements en 3 h**
 * (`/dashboard/:guildId/songes`) + **369** (`…/donjons-et-queues`). Le filtre doit
 * donc vivre **là où l'erreur est attrapée**, pas seulement là où elle naît.
 *
 * 🔒 Chaque entrée porte **sa mesure** : on ne fait pas taire une erreur « pour voir »,
 * on retire un bruit **mesuré**, non-produit, et on garde la trace sur `stderr`
 * (`docker logs`) quand c'est un avertissement de process.
 */

/** Filtres communs aux trois runtimes. */
export const COMMON_IGNORE_ERRORS: (string | RegExp)[] = [
    // Extensions de navigateur : jamais notre code.
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // Réseau coupé (mobile, onglet en veille) : cas utilisateur, pas un bug produit.
    "NetworkError",
    "Failed to fetch",
    // ⚠️ Mesure du 05/11/2026 (`JAVASCRIPT-NEXTJS-2J`, 2 événements, 0 utilisateur,
    // culprit `/dashboard/:guildId/services`) : `TypeError: Load failed` est le message
    // exact d'un `fetch` coupé dans **Safari/WebKit** — l'équivalent de « Failed to fetch »
    // (Chrome) déjà filtré. Même famille, même cause : réseau, pas code.
    "Load failed",
    // ⚠️ Mesure du 07/11/2026 (`JAVASCRIPT-NEXTJS-2K`, 1 événement, `/bestiaire`) :
    // `NotFoundError: Failed to execute 'removeChild' on 'Node'` — un nœud DOM retiré par
    // une **extension du navigateur** (traduction, bloqueur) entre deux rendus React.
    // Aucun de nos composants ne manipule le DOM hors React (`git grep` : zéro `removeChild`).
    /Failed to execute 'removeChild' on 'Node'/,
    // ⚠️ Mesure du 01/11/2026 (`JAVASCRIPT-NEXTJS-2E`, 2 événements en 7 min) : `TypeError:
    // network error` est le message exact d'un `fetch` coupé au niveau réseau. Les deux
    // événements tombent **pendant la recréation de `db-beta`** (déploiement bêta) sur
    // `/dashboard/:guildId/donjons-et-quetes` : la requête a été coupée, pas mal construite.
    // Regex **ancrée** : on ne fait pas taire un message qui contiendrait ces mots.
    /^network error$/i,
    // ⚠️ Mesure du 01/11/2026 (`JAVASCRIPT-NEXTJS-21`) : `Error: aborted` sur `POST /monitoring`
    // — c'est le **tunnel Sentry** lui-même : le navigateur annule la requête en quittant la
    // page. Rien de notre code ne produit cette annulation, et le tunnel n'est pas une route
    // métier (même famille que « The destination stream closed early », cf. filtre serveur).
    // ⚠️ Complément du 02/11/2026 : la **même** erreur apparaît sur `POST /dashboard/<id>` sous
    // la forme `ECONNRESET` (`abortIncoming` de Node, aucune frame applicative) — un Server
    // Action coupé par un client qui ferme l'onglet. C'est bien la valeur `aborted` qui est
    // comparée, donc ce filtre la couvre ; l'issue 21 est antérieure au filtre.
    /^aborted$/i,
    // Particularité connue de ResizeObserver, bruit standard du web.
    "ResizeObserver loop",
    // 🐛 Mesure du 11/10/2026 — **65 événements en 24 h** dans la config navigateur,
    // puis **1 870 + 369** en 3 h une fois mesuré côté serveur : `UnrecognizedActionError:
    // Server Action "…" was not found on the server`. Ce n'est pas un bug de notre code
    // mais le **décalage de build** d'un onglet resté ouvert pendant un déploiement (les
    // ids d'actions changent à chaque build). ⚠️ **Correction du 17/10/2026** : la phrase
    // « Next recharge la page tout seul » était **fausse** (vérifié dans `next@16.4.0` —
    // seul un `popstate` hérité recharge, voir `app-router.js`) : l'erreur remontait
    // jusqu'à la frontière d'erreur du module (« Section Indisponible ») et « Réessayer »
    // rejouait le **même** bundle périmé. La reprise vit désormais dans
    // `src/lib/stale-deployment.ts` (rechargement d'onglet, gardé contre les boucles) ;
    // le filtre reste — ce n'est toujours pas un défaut du produit.
    /UnrecognizedActionError/,
];

/** Filtres serveur/edge uniquement (bruit de process et d'optimiseur d'images). */
export const SERVER_IGNORE_ERRORS: (string | RegExp)[] = [
    // ⚠️ Avertissement de PROCESS Node, pas une erreur du produit : **113 événements en
    // 24 h**, tous sur `POST /<jeton aléatoire>/rush-sylvestre` — une URL qui n'existe
    // **pas** (404 sur la bêta, aucun rewrite correspondant dans le `Caddyfile`) : un
    // robot tape dans le vide et le runtime de streaming de Next s'avertit lui-même.
    // Côté dépôt, ce n'est pas nous : aucun module n'écoute `close` (`git grep`),
    // `redis` est un singleton et `src/proxy.ts` ne touche jamais au corps de la réponse.
    // ⚠️ On ne le **perd** pas : Node l'écrit sur `stderr` (visible dans `docker logs`) —
    // si notre propre code se mettait à fuir, le volume dans les logs exploserait.
    /MaxListenersExceededWarning/,
    // ⚠️ Mesure du 08/10/2026 : `PassThrough` du runtime Next
    // (`next/dist/compiled/next-server/app-page-turbo.runtime.prod`), **2 événements
    // en 24 h pour 4 utilisateurs**. C'est Next qui se plaint quand le **client coupe le
    // flux HTML** qu'il reçoit : fermeture d'onglet, navigation pendant un rendu en flux.
    // Aucune de nos routes ne ferme ce flux nous-mêmes ⇒ ce n'est pas un défaut du produit.
    // ⚠️ Mesure du 18/10/2026, confirmée le 07/11 (`JAVASCRIPT-NEXTJS-D`, 5 événements,
    // culprit `POST /dashboard/[guildId]/donjons-et-quetes`) : `DeprecationWarning` de
    // `pg` — « Calling client.query() when the client is already executing a query ».
    // C'est un **avertissement de dépendance**, pas un échec : aucune requête n'a été
    // perdue. Instruit le 12/10/2026 (7 formes d'appel testées, non reproduit côté code) ;
    // la montée en `pg@9` est suivie dans le ROADMAP, pas dans Sentry. Node continue de
    // l'écrire sur `stderr` (visible dans `docker logs`).
    /Calling client\.query\(\) when the client is already executing a query/,
    /The destination stream closed early/,
    // 🐛 Mesure du 11/10/2026 — 12 issues distinctes, **~64 événements chacune** :
    // `⨯ The requested resource isn't a valid image for /game-data/monsters/<slug>.webp
    // received null` (culprit `GET /_next/image`). Ces fichiers **n'existent pas sur le
    // disque** (mesure : `public/game-data/monsters` = 63 fichiers, `fuji-givrefoux.webp`,
    // `flasho.webp`, `amy-l-empoisonneuse.webp`, `ganos.webp`, `dremoan.webp` tous absents) :
    // l'optimiseur d'images de Next journalise en `console.error` une **image pas encore
    // siphonnée** — exactement le cas que le dépôt traite déjà comme **non-erreur** sur
    // `/api/uploads` (« un asset absent n'est pas une erreur »). La **cause racine** (les
    // icônes Unity 2x sont référencées en base avant d'être pré-chauffées) reste au
    // ROADMAP : filtrer le bruit ne remplace pas le pré-chauffage.
    /isn't a valid image/,
];

/**
 * Forme **structurelle** minimale d'un événement Sentry. Aucun import du SDK ici : ce module
 * est chargé par les trois runtimes (navigateur compris) et doit rester sans dépendance.
 */
export type SentryEventLike = {
    transaction?: string | null;
    request?: { url?: string | null } | null;
    exception?: { values?: Array<{ value?: string | null } | null> | null } | null;
};

/**
 * Événement émis par le **tunnel Sentry** lui-même (`tunnelRoute: "/monitoring"`,
 * `next.config.ts`).
 *
 * 🐛 Mesure du 12/11/2026 (`JAVASCRIPT-NEXTJS-2D`, 1 événement, statut « regressed ») :
 * `AggregateError` sur `POST /monitoring`, 0 utilisateur. Le tunnel ne sert qu'à relayer
 * les événements du navigateur : une erreur **dedans** ne peut produire qu'une boucle de
 * rétroaction (l'erreur du tunnel envoyée au tunnel), jamais une information produit.
 * On compare le **chemin exact** : une page métier dont l'URL contiendrait « monitoring »
 * n'est pas concernée.
 */
export function isSentryTunnelEvent(event: SentryEventLike): boolean {
    if (event.transaction === "POST /monitoring") return true;
    const url = event.request?.url;
    if (!url) return false;
    try {
        return new URL(url, "http://localhost").pathname === "/monitoring";
    } catch {
        return false;
    }
}

/**
 * Refus **attendu** d'une Server Action (garde d'authentification), pas un défaut produit.
 *
 * 🐛 Mesure du 08/11/2026 (`JAVASCRIPT-NEXTJS-2A`, 2 événements, 0 utilisateur) :
 * `Error: Non autorisé` levée par `getRushDungeonStates` (`optimized-guide-actions.ts`)
 * quand la session a expiré sur le guide public. Next journalise le `throw` en
 * `console.error` ⇒ Issue Sentry, alors que la réponse est un refus **voulu**
 * (fail-closed). Le message est **ancré** (`^Non autorisé\.?$`) : un message plus long
 * qui contiendrait ces mots reste remonté.
 */
export function isExpectedRefusalEvent(event: SentryEventLike): boolean {
    const value = event.exception?.values?.[0]?.value ?? "";
    return /^Non autorisé\.?$/.test(value);
}
