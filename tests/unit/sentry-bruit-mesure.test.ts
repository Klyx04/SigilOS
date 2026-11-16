/**
 * Sentry — le tri du 16/11/2026 : un log n'est pas une exception, un bruit mesuré ne
 * devient pas une Issue, et un événement sans utilisateur ne peut pas être priorisé.
 *
 * Mesures (dashboard `sigilos`, projet `javascript-nextjs`, 14 j) :
 *  · `2F` / `2S` — `InvalidCheck` Auth.js (cookie PKCE/state expiré) journalisé en `error` ;
 *  · `2J` — `TypeError: Load failed` (fetch coupé, Safari) ;
 *  · `2K` — `removeChild` (extension navigateur) ;
 *  · `D` — `DeprecationWarning` `pg` (avertissement de dépendance, déjà instruit) ;
 *  · `2A` — `Error: Non autorisé` (refus de garde, fail-closed) ;
 *  · `2D` — `AggregateError` sur `POST /monitoring` (le tunnel Sentry lui-même) ;
 *  · **tous** les événements avaient `usersImpacted = 0`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
    describeAuthError,
    getAuthErrorType,
    isBenignAuthCallbackError,
} from "@/lib/auth-log-filter";
import { isExpectedRefusalEvent, isSentryTunnelEvent } from "@/lib/sentry-ignores";

const read = (rel: string) => readFileSync(rel, "utf8");

/** Retire les commentaires : la prose cite les messages à dessein. */
function codeSeul(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Forme d'une `AuthError` : `name` minifié, `type` littéral, cause dans `cause.err`. */
function authError(options: {
    type: string;
    message?: string;
    name?: string;
    cause?: { err?: unknown };
}): Error {
    const error = new Error(options.message ?? "") as Error & {
        type?: string;
        cause?: unknown;
    };
    error.name = options.name ?? "y"; // valeur mesurée en production (2S)
    error.type = options.type;
    if (options.cause) error.cause = options.cause;
    return error;
}

const invalidCheck = () =>
    authError({
        type: "InvalidCheck",
        message:
            "pkceCodeVerifier value could not be parsed. Read more at https://errors.authjs.dev#invalidcheck",
    });

describe("Sentry — un log n'est pas une exception (2F / 2S)", () => {
    it("① un cookie PKCE/state expiré est un cas utilisateur, pas une panne", () => {
        expect(isBenignAuthCallbackError(invalidCheck())).toBe(true);
        // Même cause, reconnue par le message public seul (type absent).
        expect(
            isBenignAuthCallbackError({
                message:
                    "state value could not be parsed. Read more at https://errors.authjs.dev#invalidcheck",
            })
        ).toBe(true);
    });

    it("② la cause réelle est lue dans `cause.err` d'un CallbackRouteError", () => {
        const wrapped = authError({
            type: "CallbackRouteError",
            message: "Read more at https://errors.authjs.dev#callbackrouteerror",
            cause: { err: invalidCheck() },
        });
        expect(isBenignAuthCallbackError(wrapped)).toBe(true);
    });

    it("③ un échec de callback sans cause connue reste une erreur (aucun masquage)", () => {
        for (const error of [
            authError({
                type: "CallbackRouteError",
                message: "Read more at https://errors.authjs.dev#callbackrouteerror",
            }),
            authError({ type: "AdapterError", message: "adapter_getUser failed" }),
            authError({ type: "OAuthCallbackError", message: "OAuth callback failed" }),
            new Error("fetch failed"),
            null,
        ]) {
            expect(isBenignAuthCallbackError(error)).toBe(false);
        }
    });

    it("④ le type Auth.js est journalisé même quand `name` est minifié, avec sa cause", () => {
        const wrapped = authError({
            type: "CallbackRouteError",
            message: "Read more at https://errors.authjs.dev#callbackrouteerror",
            cause: { err: invalidCheck() },
        });
        expect(getAuthErrorType(wrapped)).toBe("CallbackRouteError");
        const description = describeAuthError(wrapped);
        expect(description.type).toBe("CallbackRouteError");
        expect(description.causeType).toBe("InvalidCheck");
        expect(description.causeMessage).toContain("pkceCodeVerifier");
        // Message borné : une cause ne peut pas noyer le log.
        expect(description.causeMessage!.length).toBeLessThanOrEqual(300);
    });

    it("⑤ `src/auth.ts` dégrade AVANT le logger d'erreur et ne logge plus `error.name`", () => {
        const code = codeSeul(read("src/auth.ts"));
        const degradation = code.indexOf("if (isBenignAuthCallbackError(error))");
        const erreur = code.indexOf('logger.error(`[auth] ${description.type}');
        expect(degradation).toBeGreaterThanOrEqual(0);
        expect(erreur).toBeGreaterThan(degradation);
        expect(code.slice(degradation, erreur)).toContain("logger.warn(");
        expect(code).not.toContain("${error.name}");
    });
});

describe("Sentry — filtres de bruit mesurés", () => {
    it("⑥ les motifs mesurés sont déclarés, avec leur mesure", () => {
        const source = read("src/lib/sentry-ignores.ts");
        // 2J — fetch coupé dans Safari.
        expect(source).toContain('"Load failed"');
        // 2K — nœud DOM retiré par une extension.
        expect(source).toMatch(/Failed to execute 'removeChild' on 'Node'/);
        // D — DeprecationWarning pg.
        expect(source).toContain("Calling client");
        expect(source).toContain("already executing a query");
        expect(source).toContain("JAVASCRIPT-NEXTJS-2J");
        expect(source).toContain("JAVASCRIPT-NEXTJS-2K");
        expect(source).toContain("JAVASCRIPT-NEXTJS-D");
    });

    it("⑦ le tunnel Sentry est reconnu par son chemin EXACT (2D)", () => {
        expect(isSentryTunnelEvent({ transaction: "POST /monitoring" })).toBe(true);
        expect(
            isSentryTunnelEvent({ request: { url: "https://beta.sigilos.fr/monitoring" } })
        ).toBe(true);
        expect(isSentryTunnelEvent({ request: { url: "/monitoring?x=1" } })).toBe(true);
        // Une page métier n'est jamais confondue.
        expect(
            isSentryTunnelEvent({
                request: { url: "https://beta.sigilos.fr/dashboard/1/monitoring-joueurs" },
            })
        ).toBe(false);
        expect(isSentryTunnelEvent({})).toBe(false);
    });

    it("⑧ le refus « Non autorisé » est ancré : un message plus long reste remonté (2A)", () => {
        expect(
            isExpectedRefusalEvent({ exception: { values: [{ value: "Non autorisé" }] } })
        ).toBe(true);
        expect(
            isExpectedRefusalEvent({ exception: { values: [{ value: "Non autorisé." }] } })
        ).toBe(true);
        expect(
            isExpectedRefusalEvent({
                exception: { values: [{ value: "Non autorisé — jeton invalide" }] },
            })
        ).toBe(false);
        expect(isExpectedRefusalEvent({})).toBe(false);
    });

    it("⑨ le serveur applique les deux filtres dans `beforeSend`", () => {
        const code = codeSeul(read("sentry.server.config.ts"));
        expect(code).toContain("isSentryTunnelEvent(event)");
        expect(code).toContain("isExpectedRefusalEvent(event)");
        // Les filtres passent avant la purge des en-têtes et le `return event`.
        expect(code.indexOf("isSentryTunnelEvent(event)")).toBeLessThan(
            code.indexOf("return event;")
        );
    });
});

describe("Sentry — impact par utilisateur (identifiant opaque)", () => {
    it("⑩ le client rattache l'id interne, et seulement lui", () => {
        const sync = codeSeul(read("src/components/providers/sentry-user-sync.tsx"));
        expect(sync).toContain("Sentry.setUser(");
        expect(sync).toMatch(/userId \? \{ id: userId \} : null/);
        // Aucune donnée personnelle : ni e-mail, ni pseudo, ni identifiant Discord.
        expect(sync).not.toMatch(/email|username|discord/i);
        // Branché dans le provider qui reçoit la session du serveur.
        const provider = codeSeul(read("src/components/providers/auth-provider.tsx"));
        expect(provider).toContain("SentryUserSync");
        expect(provider).toContain("userId={session?.user?.id ?? null}");
    });
});

