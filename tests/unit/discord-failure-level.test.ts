/**
 * 1b#2 — **niveau de log d'un échec d'appel Discord** (mesure du 18/10/2026).
 *
 * `sentry.server.config.ts` active `captureConsoleIntegration({ levels: ["error"] })` : tout
 * `logger.error` (qui écrit sur `console.error`) devient une **Issue Sentry**. La couche
 * `src/server/discord.ts` journalisait 43 sites en « erreur », dont 27 `console.error` ⇒ un
 * 403 « permissions manquantes », un 404 « salon supprimé » ou un 429 « rate-limit »
 * produisaient une Issue. Ce n'est pas un défaut du produit : c'est de l'exploitation.
 *
 * 🔒 Verrouillé ici : 401 et erreurs **inconnues** restent en `error` (fail-loud), tout refus
 * Discord (4xx/5xx) et toute panne réseau connue passent en `warn`. Le contexte porte le
 * statut et le `code` Discord, jamais le corps brut (F-15).
 */
import { describe, expect, it } from "vitest";

import { DiscordApiError, describeDiscordFailure, discordFailureLevel } from "@/lib/discord-api-errors";

describe("discordFailureLevel — un refus Discord n'est pas un bug produit", () => {
    it("HTTP 401 (token invalide/reset) reste en `error`", () => {
        expect(discordFailureLevel(new DiscordApiError("token", 401))).toBe("error");
    });

    it.each([403, 404, 429, 500, 502, 503])(
        "HTTP %i passe en `warn` (permissions, salon supprimé, rate-limit, panne Discord)",
        (status) => {
            expect(discordFailureLevel(new DiscordApiError("refus", status))).toBe("warn");
        },
    );

    it("une panne réseau connue passe en `warn`", () => {
        expect(discordFailureLevel(Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }))).toBe(
            "warn",
        );
        expect(discordFailureLevel(Object.assign(new Error("x"), { code: "ENETUNREACH" }))).toBe("warn");
        expect(discordFailureLevel(new TypeError("fetch failed"))).toBe("warn");
        expect(discordFailureLevel(new Error("socket hang up"))).toBe("warn");
    });

    it("tout ce qui n'est pas reconnu reste en `error` (fail-loud)", () => {
        expect(discordFailureLevel(new ReferenceError("boom"))).toBe("error");
        expect(discordFailureLevel(new Error("Something unexpected"))).toBe("error");
        expect(discordFailureLevel(null)).toBe("error");
        expect(discordFailureLevel(undefined)).toBe("error");
        expect(discordFailureLevel({ status: "403" })).toBe("error");
    });

    it("le contexte porte le statut et le code, jamais le corps brut", () => {
        expect(describeDiscordFailure(new DiscordApiError("refus", 403, 50001))).toEqual({
            status: 403,
            code: 50001,
        });
        expect(describeDiscordFailure(new Error("réseau"))).toEqual({});
    });
});