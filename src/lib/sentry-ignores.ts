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
    // Particularité connue de ResizeObserver, bruit standard du web.
    "ResizeObserver loop",
    // 🐛 Mesure du 11/10/2026 — **65 événements en 24 h** dans la config navigateur,
    // puis **1 870 + 369** en 3 h une fois mesuré côté serveur : `UnrecognizedActionError:
    // Server Action "…" was not found on the server`. Ce n'est pas un bug de notre code
    // mais le **décalage de build** d'un onglet resté ouvert pendant un déploiement (les
    // ids d'actions changent à chaque build). Next recharge la page tout seul ⇒ l'erreur
    // est **transitoire et auto-réparée**.
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
