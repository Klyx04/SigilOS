/**
 * Scan externe sur `/api/auth/*` — un cas normal ne doit pas devenir une Issue Sentry.
 *
 * Mesure du 20/10/2026 : `JAVASCRIPT-NEXTJS-20` (`GET /api/auth/*`) et
 * `JAVASCRIPT-NEXTJS-1Z` (`GET /api/auth/v1/pin/verify`), **1 événement chacun**,
 * **0 utilisateur**, user-agent `curl 8.7.1` sur Alpine. Auth.js ne reconnaît pas
 * l'action (chemin inexistant) et lève `UnknownAction`.
 *
 * ⚠️ En production, `error.name` vaut **`"O"`** (nom de classe minifié) : la détection
 * doit s'appuyer sur `type` (chaîne littérale) ou le message public. Ce test verrouille
 * les deux, et le fait que `src/auth.ts` journalise ce cas en `warn` **avant** le `error`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { isUnknownAuthAction } from "@/lib/auth-log-filter";

const AUTH_SOURCE = readFileSync("src/auth.ts", "utf8");

/** Retire les commentaires : la prose cite `logger.error` à dessein. */
function codeSeul(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("Action Auth.js inconnue — classée en warn, jamais en Issue", () => {
    it("① le message réellement observé en bêta est reconnu (même avec un nom minifié)", () => {
        expect(
            isUnknownAuthAction({
                name: "O",
                message:
                    "Cannot parse action at /api/auth/v1/pin/verify. Read more at https://errors.authjs.dev#unknownaction",
            })
        ).toBe(true);
    });

    it("② `type: \"UnknownAction\"` suffit — la chaîne littérale survit à la minification", () => {
        expect(isUnknownAuthAction({ type: "UnknownAction", message: "" })).toBe(true);
    });

    it("③ une vraie panne de configuration reste une erreur (pas de masquage)", () => {
        for (const error of [
            { type: "Configuration", message: "There is a problem with the server configuration." },
            { type: "MissingCSRF", message: "CSRF token was missing" },
            { type: "OAuthCallbackError", message: "OAuth callback failed" },
            new Error("fetch failed"),
        ]) {
            expect(isUnknownAuthAction(error)).toBe(false);
        }
    });

    it("④ une valeur qui n'est pas une erreur ne déclenche jamais le filtre", () => {
        for (const value of [null, undefined, "Cannot parse action at /x", 42, true]) {
            expect(isUnknownAuthAction(value)).toBe(false);
        }
    });

    it("⑤ `src/auth.ts` branche la règle et sort AVANT le logger d'erreur", () => {
        const code = codeSeul(AUTH_SOURCE);
        expect(code).toContain('from "@/lib/auth-log-filter"');
        expect(code).toContain("isUnknownAuthAction(error)");

        const garde = code.indexOf("if (isUnknownAuthAction(error))");
        const erreur = code.indexOf('logger.error(`[auth] ${error.name}');
        expect(garde).toBeGreaterThanOrEqual(0);
        expect(erreur).toBeGreaterThan(garde);
        // Le cas filtré reste visible dans `docker logs` (warn), il ne disparaît pas.
        expect(code.slice(garde, erreur)).toContain("logger.warn(");
    });
});
