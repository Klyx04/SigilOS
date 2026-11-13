/**
 * Niveau de log des erreurs Auth.js — règle **pure**, testée.
 *
 * 🐛 Mesure du 20/10/2026 (`JAVASCRIPT-NEXTJS-20` et `JAVASCRIPT-NEXTJS-1Z`) : deux Issues
 * Sentry, **0 utilisateur**, `curl 8.7.1` sur Alpine, culprits `GET /api/auth/*` et
 * `GET /api/auth/v1/pin/verify`. Un scanner tape des chemins qui n'existent **pas** : Auth.js
 * ne sait pas identifier l'action et lève `UnknownAction` (`type: "UnknownAction"`,
 * message `Cannot parse action at …`, doc `errors.authjs.dev#unknownaction`).
 *
 * Ce n'est **pas** une panne produit (aucune session, aucune lecture de données, réponse 400),
 * mais `src/auth.ts` la journalisait en `logger.error` ⇒ `console.error` ⇒ **Issue Sentry**
 * (`captureConsoleIntegration({ levels: ["error"] })`). Le niveau était faux, pas le message :
 * on garde la ligne dans `docker logs` en `warn`, sans Issue.
 *
 * ⚠️ `error.name` n'est **pas** exploitable : `AuthError` le remplit avec
 * `this.constructor.name`, que le build de production **minifie** (mesuré : `"O"` dans le
 * contexte Sentry). On s'appuie donc sur `type` (chaîne littérale, jamais minifiée) et, en
 * repli, sur le fragment de message public.
 */
export function isUnknownAuthAction(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;

    const { type, message } = error as { type?: unknown; message?: unknown };
    if (type === "UnknownAction") return true;

    return (
        typeof message === "string" &&
        (message.includes("Cannot parse action at") ||
            message.includes("errors.authjs.dev#unknownaction"))
    );
}
