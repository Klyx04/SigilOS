import { describe, it, expect } from "vitest";
import { assertWsAuthPolicy } from "@/lib/ws-auth-policy";

/**
 * SEC-02 (audit 13/11/2026) — le serveur WebSocket est un process séparé qui
 * n'exécute pas `instrumentation.ts`. Il doit refuser lui-même le kill-switch
 * `WS_AUTH_ENABLED=false` en production.
 */
describe("politique d'authentification WebSocket", () => {
    it("refuse la production avec l'authentification désactivée", () => {
        expect(() => assertWsAuthPolicy("production", false)).toThrow(/interdit en production/);
    });

    it("accepte la production avec l'authentification active", () => {
        expect(() => assertWsAuthPolicy("production", true)).not.toThrow();
    });

    it("accepte le développement avec le kill-switch (usage local)", () => {
        expect(() => assertWsAuthPolicy("development", false)).not.toThrow();
        expect(() => assertWsAuthPolicy("test", false)).not.toThrow();
    });

    it("accepte un NODE_ENV absent (worker/cron)", () => {
        expect(() => assertWsAuthPolicy(undefined, false)).not.toThrow();
    });
});
