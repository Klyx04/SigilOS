// sentry.server.config.ts
// This file configures Sentry on the server side

import * as Sentry from "@sentry/nextjs";
import { COMMON_IGNORE_ERRORS, SERVER_IGNORE_ERRORS } from "./src/lib/sentry-ignores";

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

    // 🧹 Filtres d'entrée — **source unique partagée** (`src/lib/sentry-ignores.ts`) : les
    // mesures qui justifient chaque filtre y vivent, jamais dupliquées ici.
    ignoreErrors: [...COMMON_IGNORE_ERRORS, ...SERVER_IGNORE_ERRORS],

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
