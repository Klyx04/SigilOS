// sentry.server.config.ts
// This file configures Sentry on the server side

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Only enable in production
    enabled: process.env.NODE_ENV === "production",

    // Performance monitoring - lower rate for server
    tracesSampleRate: 0.05, // 5% of transactions

    // Environment tag — use SENTRY_ENVIRONMENT to distinguish beta vs prod
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,

    // Capture unhandled promise rejections
    integrations: [
        Sentry.captureConsoleIntegration({
            levels: ["error"], // Only capture console.error
        }),
    ],

    // 🧹 Filtres d'entrée — mesurés le 07/10/2026, jamais supposés.
    ignoreErrors: [
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
        // en 24 h pour 4 utilisateurs**, en régression. C'est Next qui se plaint quand le
        // **client coupe le flux HTML** qu'il reçoit : fermeture d'onglet, fermeture de la
        // fenêtre PiP, navigation pendant un rendu en flux. Aucune de nos routes ne ferme
        // ce flux nous-mêmes (aucun `PassThrough` dans `src/`) ⇒ ce n'est pas un défaut du
        // produit. Filtré ici, conservé sur `stderr` dans `docker logs`.
        /The destination stream closed early/,
    ],

    // Before sending, add extra context
    beforeSend(event) {
        // Remove sensitive data
        if (event.request?.headers) {
            delete event.request.headers["authorization"];
            delete event.request.headers["cookie"];
        }
        return event;
    },
});
