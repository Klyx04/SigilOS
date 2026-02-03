// sentry.client.config.ts
// This file configures Sentry on the client (browser) side

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

    // Environment tag
    environment: process.env.NODE_ENV,
});
