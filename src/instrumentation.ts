/**
 * Instrumentation Next.js (App Router).
 *
 * ⚠️ **Sans ce fichier, `sentry.server.config.ts` et `sentry.edge.config.ts` ne sont
 * JAMAIS chargés** (SDK Sentry v10 + `withSentryConfig` sans `instrumentation.ts`)
 * ⇒ **Sentry côté serveur inactif** : les erreurs d'authentification, de cron et de
 * server action n'atteignent jamais Sentry. C'est la cause de l'angle mort constaté
 * lors de l'incident du 06/10/2026 (panne d'auth silencieuse, cf. `docs/MAINTENANCE.md`).
 *
 * - `register()` charge la bonne config selon le runtime d'exécution ;
 * - `onRequestError` capture automatiquement les erreurs de requête (RSC, route
 *   handlers, server actions).
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("../sentry.server.config");
    }
    if (process.env.NEXT_RUNTIME === "edge") {
        await import("../sentry.edge.config");
    }
}

export const onRequestError = Sentry.captureRequestError;
