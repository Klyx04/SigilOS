/**
 * Politique d'authentification du serveur WebSocket (SEC-02, audit 13/11/2026).
 *
 * `src/lib/env.ts` refuse déjà `WS_AUTH_ENABLED=false` en production pour le
 * process Next. Le serveur WS est un **process séparé** (`node ws-server.js`)
 * qui n'exécute pas `instrumentation.ts` : sans ce garde, le kill-switch
 * pouvait désactiver toute l'authentification WS sans être bloqué.
 *
 * Règle pure : lève une erreur (fail-closed) si la production tente de
 * démarrer avec l'authentification désactivée.
 */
export function assertWsAuthPolicy(
    nodeEnv: string | undefined,
    wsAuthEnabled: boolean,
): void {
    if (nodeEnv === "production" && !wsAuthEnabled) {
        throw new Error(
            "WS_AUTH_ENABLED=false est interdit en production — arrêt du serveur WebSocket.",
        );
    }
}
