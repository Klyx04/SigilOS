// sentry.edge.config.ts
// This file configures Sentry for Edge runtime (middleware, edge API routes)

import * as Sentry from "@sentry/nextjs";
import { COMMON_IGNORE_ERRORS, SERVER_IGNORE_ERRORS } from "./src/lib/sentry-ignores";

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Only enable in production
    enabled: process.env.NODE_ENV === "production",

    // Performance monitoring
    tracesSampleRate: 0.05,

    // Environment tag — MÊME règle que le serveur et le client : `SENTRY_ENVIRONMENT`
    // prime (bêta vs prod). Mesure du 11/10/2026 : l'edge était le SEUL des trois
    // runtimes à ignorer la variable ⇒ une erreur du middleware s'étiquetait
    // « production » même sur la bêta.
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,

    // 🧹 Filtres d'entrée — **même source unique** que le serveur : l'edge est un
    // troisième runtime, il n'a aucune raison d'avoir sa propre liste.
    ignoreErrors: [...COMMON_IGNORE_ERRORS, ...SERVER_IGNORE_ERRORS],
});
