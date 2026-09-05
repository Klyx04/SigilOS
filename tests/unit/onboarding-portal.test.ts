import { describe, it, expect } from "vitest";
import {
    classifyGuildsFetchError,
    shouldAutoReloadPortal,
    MAX_PORTAL_AUTO_RELOAD,
} from "@/lib/onboarding-gating";

/**
 * Correctifs boucle du portail (retest jeanmich58 05/09/2026) :
 * - l'échec Discord est classé (scope manquant / rate-limit / transitoire)
 *   au lieu d'un vide silencieux ;
 * - la re-vérification auto est plafonnée (anti-tempête 429) et coupée quand
 *   recharger ne sert à rien (scope manquant → re-consentement).
 */
describe("onboarding-portal — classification des erreurs Discord", () => {
    it("401/403 = SCOPE (re-consentement requis, pas de reload)", () => {
        expect(classifyGuildsFetchError(401)).toBe("SCOPE");
        expect(classifyGuildsFetchError(403)).toBe("SCOPE");
    });

    it("429 = RATE_LIMIT (backoff + reload plafonné)", () => {
        expect(classifyGuildsFetchError(429)).toBe("RATE_LIMIT");
    });

    it("le reste = TRANSIENT", () => {
        expect(classifyGuildsFetchError(500)).toBe("TRANSIENT");
        expect(classifyGuildsFetchError(502)).toBe("TRANSIENT");
        expect(classifyGuildsFetchError(0)).toBe("TRANSIENT");
    });
});

describe("onboarding-portal — plafond de re-vérification auto", () => {
    it("recharge en rate-limit sous le plafond", () => {
        expect(
            shouldAutoReloadPortal({ rateLimited: true, needsReconnect: false, attempts: 0 }),
        ).toBe(true);
        expect(
            shouldAutoReloadPortal({
                rateLimited: true,
                needsReconnect: false,
                attempts: MAX_PORTAL_AUTO_RELOAD - 1,
            }),
        ).toBe(true);
    });

    it("coupe au plafond (anti-tempête 429)", () => {
        expect(
            shouldAutoReloadPortal({
                rateLimited: true,
                needsReconnect: false,
                attempts: MAX_PORTAL_AUTO_RELOAD,
            }),
        ).toBe(false);
        expect(
            shouldAutoReloadPortal({
                rateLimited: true,
                needsReconnect: false,
                attempts: MAX_PORTAL_AUTO_RELOAD + 10,
            }),
        ).toBe(false);
    });

    it("jamais de reload si re-consentement requis, même en rate-limit", () => {
        expect(
            shouldAutoReloadPortal({ rateLimited: true, needsReconnect: true, attempts: 0 }),
        ).toBe(false);
    });

    it("jamais de reload sans rate-limit (état stable + bouton manuel)", () => {
        expect(
            shouldAutoReloadPortal({ rateLimited: false, needsReconnect: false, attempts: 0 }),
        ).toBe(false);
    });
});
