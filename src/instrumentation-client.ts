/**
 * Instrumentation **client** (navigateur) — App Router.
 *
 * ⚠️ **Pourquoi ce fichier et plus `sentry.client.config.ts`** — mesure du 11/10/2026 :
 * `npm run build` tourne sous **Turbopack** (log CI : `▲ Next.js 16.3.8 (Turbopack)`),
 * et le SDK `@sentry/nextjs` v10 l'écrit lui-même :
 *   « DEPRECATION WARNING: … When using Turbopack `sentry.client.config.ts` will no
 *     longer work. … moving its content to `instrumentation-client.ts` ».
 * `instrumentation-client.ts` est le nom **supporté** (convention Next 15.3+, détecté
 * par Next **et** par le plugin Sentry) : c'est le seul qui fait réellement entrer le
 * SDK dans le bundle navigateur. Le fichier déprécié est **supprimé** — jamais deux
 * emplacements pour un même réglage.
 *
 * Réglages migrés à l'identique (aucune valeur changée), à une exception près,
 * documentée : `environment`.
 *
 * Session Replay : texte masqué + médias bloqués ⇒ aucune donnée personnelle ne part.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Only enable in production
    enabled: process.env.NODE_ENV === "production",

    // Performance monitoring
    tracesSampleRate: 0.1, // 10% of transactions

    // Session replay for debugging (optional, uses quota)
    replaysSessionSampleRate: 0.01, // 1% of sessions
    replaysOnErrorSampleRate: 0.1, // 10% of error sessions

    // Integrations
    integrations: [
        Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
        }),
    ],

    // Filter out noisy errors
    ignoreErrors: [
        // Browser extensions
        /^chrome-extension:\/\//,
        /^moz-extension:\/\//,
        // Network errors
        "NetworkError",
        "Failed to fetch",
        // User-caused
        "ResizeObserver loop",
    ],

    // Environment tag — distingue bêta et prod.
    // ⚠️ Dans le NAVIGATEUR, seules les variables `NEXT_PUBLIC_*` sont inlinées au build :
    // `process.env.SENTRY_ENVIRONMENT` y vaut `undefined` (mesure du 11/10/2026) ⇒ toutes
    // les erreurs du navigateur s'étiquetaient « production », bêta comprise. On lit donc
    // d'abord la variable **publique**, posée en `--build-arg` par le déploiement.
    environment:
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
        process.env.SENTRY_ENVIRONMENT ||
        process.env.NODE_ENV,
});

/**
 * Trace les **navigations** du routeur Next (App Router) côté client.
 * Export standard de `instrumentation-client.ts` : sans lui, passer d'un chapitre à
 * l'autre du guide ne produit aucune transaction (angle mort de la perf du guide).
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
