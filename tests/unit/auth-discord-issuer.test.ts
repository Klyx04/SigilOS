import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Garde — provider Discord : issuer OIDC **explicite** (RFC 9207).
 *
 * Mesuré le 06/10/2026 (incident prod + bêta) : Discord renvoie désormais un
 * paramètre `iss` dans la réponse OAuth. Auth.js v5 le compare à `provider.issuer`,
 * dont la valeur de repli est le placeholder « https://authjs.dev »
 * (`@auth/core/lib/actions/callback/oauth/callback.ts`) ⇒ **toute** connexion
 * échouait en `error=Configuration` (masque de `CallbackRouteError`).
 *
 * Déclarer l'issuer Discord est donc obligatoire ; ce test empêche de le retirer.
 */
describe("auth — provider Discord", () => {
    it("déclare l'issuer OIDC de Discord (sinon toutes les connexions cassent)", () => {
        const source = readFileSync("src/auth.ts", "utf8");
        expect(source).toMatch(/Discord\(\{[\s\S]*?issuer:\s*"https:\/\/discord\.com"/);
    });
});
