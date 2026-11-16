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

type AuthErrorLike = { type?: unknown; message?: unknown; cause?: unknown; err?: unknown };

function asErrorLike(value: unknown): AuthErrorLike | null {
    return value && typeof value === "object" ? (value as AuthErrorLike) : null;
}

function messageOf(error: AuthErrorLike): string {
    return typeof error.message === "string" ? error.message : "";
}

/**
 * Type Auth.js (**jamais minifié**) — `error.name`, lui, l'est : le SDK le remplit avec
 * `this.constructor.name`, que le build de production renomme (mesure du 15/11/2026 :
 * `authError: "y"` dans `JAVASCRIPT-NEXTJS-2S`). On lit donc `type`, chaîne littérale
 * posée par `AuthError` (`this.type = this.constructor.type`).
 */
export function getAuthErrorType(error: unknown): string {
    const { type } = asErrorLike(error) ?? {};
    return typeof type === "string" && type.length > 0 ? type : "Unknown";
}

/**
 * Cause réelle d'un échec de callback. `CallbackRouteError` **enveloppe** l'erreur
 * d'origine : `AuthError` la range dans `cause.err` (cf. `@auth/core/src/errors.ts`,
 * constructeur `super(undefined, { cause: { err: message, … } })`).
 */
function authErrorCause(error: unknown): AuthErrorLike | null {
    const outer = asErrorLike(error);
    const cause = asErrorLike(outer?.cause);
    const inner = asErrorLike(cause?.err);
    return inner ?? cause ?? null;
}

function isInvalidCheck(error: AuthErrorLike | null): boolean {
    if (!error) return false;
    if (error.type === "InvalidCheck") return true;
    const message = messageOf(error);
    return (
        message.includes("errors.authjs.dev#invalidcheck") ||
        message.includes("pkceCodeVerifier value could not be parsed") ||
        message.includes("state value could not be parsed")
    );
}

/**
 * Échec de callback **côté utilisateur**, pas une panne produit.
 *
 * 🐛 Mesure du 05/11/2026 (`JAVASCRIPT-NEXTJS-2F`, 1 événement) puis du 15/11/2026
 * (`JAVASCRIPT-NEXTJS-2S`, 1 événement) : `InvalidCheck` — cookie PKCE/state absent,
 * expiré ou ouvert dans un autre navigateur — journalisé en `error` ⇒ Issue Sentry.
 * Auth.js le classe lui-même en `InvalidCheck` (doc `errors.authjs.dev#invalidcheck`) :
 * la reconnexion suffit, aucune donnée n'est lue ni écrite.
 *
 * ⚠️ On ne dégrade **que** cette cause, reconnue par son `type` ou son message public :
 * un `CallbackRouteError` sans cause identifiable (adapter, configuration, réseau)
 * reste une **erreur**.
 */
export function isBenignAuthCallbackError(error: unknown): boolean {
    return isInvalidCheck(asErrorLike(error)) || isInvalidCheck(authErrorCause(error));
}

/**
 * Description **bornée** et sans donnée personnelle, pour les logs. Le message de la
 * cause est tronqué : un `CallbackRouteError` peut envelopper une réponse OAuth.
 */
export function describeAuthError(error: unknown): {
    type: string;
    causeType?: string;
    causeMessage?: string;
} {
    const description: { type: string; causeType?: string; causeMessage?: string } = {
        type: getAuthErrorType(error),
    };
    const cause = authErrorCause(error);
    if (cause) {
        const causeType = typeof cause.type === "string" ? cause.type : undefined;
        const causeMessage = messageOf(cause).slice(0, 300);
        if (causeType) description.causeType = causeType;
        if (causeMessage) description.causeMessage = causeMessage;
    }
    return description;
}
