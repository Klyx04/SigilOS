/**
 * `dashboard-profile-summary` — la synthèse d'accueil ne charge que trois champs.
 *
 * Contrat de performance (B-3, 21/11/2026) : la page d'accueil n'utilise que
 * `hasSeenWelcome`, `availability` et `pseudoDofus`. Élargir ce `select` re-crée
 * les quatre lectures de `getUserProfile` (compte, skins, rôles accordés, services
 * actifs, candidature en attente).
 */
import { describe, expect, it } from "vitest";

import { DASHBOARD_PROFILE_SUMMARY_SELECT } from "@/lib/dashboard-profile-summary";

describe("synthèse de profil du dashboard", () => {
    it("ne sélectionne que les trois champs lus par l'accueil", () => {
        expect(Object.keys(DASHBOARD_PROFILE_SUMMARY_SELECT).sort()).toEqual([
            "availability",
            "hasSeenWelcome",
            "pseudoDofus",
        ]);
    });

    it("n'embarque aucune relation lourde de getUserProfile", () => {
        for (const relation of ["user", "skins", "roleGrants", "activeServices", "pendingSubmission"]) {
            expect(DASHBOARD_PROFILE_SUMMARY_SELECT).not.toHaveProperty(relation);
        }
    });
});
