import { describe, it, expect } from "vitest";
import {
    classifyGuildsFetchError,
    GUILD_LOOKUP_RETRY_DELAYS_MS,
    guildLookupRetryDelayMs,
    MAX_PORTAL_AUTO_RELOAD,
    isNavLockedDuringOnboarding,
    isOnboardingAllowedPath,
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

describe("onboarding-portal — reprise de la vérification des serveurs", () => {
    it("réessaie à 2 s, 4 s, 8 s puis 16 s (rafraîchissement serveur, pas un reload)", () => {
        expect(
            [0, 1, 2, 3].map((attempts) =>
                guildLookupRetryDelayMs({ needsReconnect: false, attempts })
            )
        ).toEqual([2000, 4000, 8000, 16000]);
    });

    it("coupe au plafond anti-tempête", () => {
        expect(
            guildLookupRetryDelayMs({ needsReconnect: false, attempts: MAX_PORTAL_AUTO_RELOAD })
        ).toBeNull();
        expect(
            guildLookupRetryDelayMs({ needsReconnect: false, attempts: MAX_PORTAL_AUTO_RELOAD + 10 })
        ).toBeNull();
    });

    it("aucune reprise quand seul un re-consentement répare (scope manquant)", () => {
        expect(guildLookupRetryDelayMs({ needsReconnect: true, attempts: 0 })).toBeNull();
        expect(guildLookupRetryDelayMs({ needsReconnect: true, attempts: 2 })).toBeNull();
    });

    it("le plafond EST le calendrier (une seule source)", () => {
        expect(MAX_PORTAL_AUTO_RELOAD).toBe(GUILD_LOOKUP_RETRY_DELAYS_MS.length);
    });
});

describe("onboarding-portal — verrou navigation + parcours sans échappatoire", () => {
    it("verrouille la nav pour un admin en onboarding incomplet", () => {
        expect(
            isNavLockedDuringOnboarding({ isOnboardingComplete: false, isSuperAdmin: false }),
        ).toBe(true);
    });

    it("déverrouille quand l'onboarding est complet", () => {
        expect(
            isNavLockedDuringOnboarding({ isOnboardingComplete: true, isSuperAdmin: false }),
        ).toBe(false);
    });

    it("God exempté du verrou (inspection)", () => {
        expect(
            isNavLockedDuringOnboarding({ isOnboardingComplete: false, isSuperAdmin: true }),
        ).toBe(false);
    });

    it("parcours : seules les pages /admin/* sont autorisées", () => {
        const gid = "123";
        expect(isOnboardingAllowedPath(`/dashboard/${gid}/admin/getting-started`, gid)).toBe(true);
        expect(isOnboardingAllowedPath(`/dashboard/${gid}/admin/settings`, gid)).toBe(true);
        expect(isOnboardingAllowedPath(`/dashboard/${gid}/admin/permissions`, gid)).toBe(true);
        expect(isOnboardingAllowedPath(`/dashboard/${gid}`, gid)).toBe(false);
        expect(isOnboardingAllowedPath(`/dashboard/${gid}/members`, gid)).toBe(false);
        expect(isOnboardingAllowedPath(`/dashboard/999/admin`, gid)).toBe(false);
    });
});
