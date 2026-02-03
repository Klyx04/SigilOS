// sentry.server.config.ts
// This file configures Sentry on the server side

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Only enable in production
    enabled: process.env.NODE_ENV === "production",

    // Performance monitoring - lower rate for server
    tracesSampleRate: 0.05, // 5% of transactions

    // Environment tag
    environment: process.env.NODE_ENV,

    // Capture unhandled promise rejections
    integrations: [
        Sentry.captureConsoleIntegration({
            levels: ["error"], // Only capture console.error
        }),
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
