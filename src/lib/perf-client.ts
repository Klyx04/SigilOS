import type * as Sentry from "@sentry/nextjs";

/**
 * Client Sentry du **serveur**, enregistré au démarrage.
 *
 * Pourquoi : `Sentry.init()` pose le client sur le *default current scope* du SDK, mais
 * le rendu d'un layout RSC s'exécute dans un scope isolé qui n'en porte pas. `Sentry.getClient()`
 * y répond `undefined`, donc `startSpan` rend un span non enregistré (mesure du 20/11/2026 :
 * zéro span en bêta). On garde donc une référence au client rendu par `init`, partagée via
 * `globalThis` entre les bundles du serveur (instrumentation, RSC, actions).
 *
 * Rien de sensible ici : le client est déjà un singleton du SDK, et aucun secret n'est exposé.
 */
const REGISTERED_CLIENT_KEY = Symbol.for("sigilos.sentry.serverClient");

/** Type du client rendu par `Sentry.init` (non exporté nommément par `@sentry/nextjs`). */
type SentryClient = ReturnType<typeof Sentry.init>;

type GlobalWithSentryClient = typeof globalThis & {
    [REGISTERED_CLIENT_KEY]?: SentryClient;
};

export function registerSentryClient(client: SentryClient): void {
    if (!client) return;
    (globalThis as GlobalWithSentryClient)[REGISTERED_CLIENT_KEY] = client;
}

export function getRegisteredSentryClient(): SentryClient {
    return (globalThis as GlobalWithSentryClient)[REGISTERED_CLIENT_KEY];
}
