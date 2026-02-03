// sentry.edge.config.ts
// This file configures Sentry for Edge runtime (middleware, edge API routes)

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Only enable in production
    enabled: process.env.NODE_ENV === "production",

    // Performance monitoring
    tracesSampleRate: 0.05,

    // Environment tag
    environment: process.env.NODE_ENV,
});
