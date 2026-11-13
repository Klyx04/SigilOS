import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveIsMember } from "@/lib/guild-membership";

/**
 * Dashboard — « Accès Restreint » fantôme (retour bêta : éjection du dashboard
 * en pleine navigation, débloquée par « Synchroniser »).
 *
 * 🔍 Cause racine mesurée : la projection finale de `getUserContext` valait
 * `isMember: !!member` (appel Discord LIVE uniquement). Un flake Discord
 * (rate-limit, timeout, 5xx) rendait `member = null` ⇒ mur « Vous devez être
 * membre du serveur Discord », mis en cache Redis 60 s. Le fall-through de
 * résilience ne contournait que le `return` précoce, jamais cette projection.
 *
 * 🛡️ Ce que ce test verrouille : ① la règle pure (repli BDD sur erreur API
 * avec profil ACTIF, refus sur 404) ; ② le câblage (la projection passe par la
 * règle, le God inspecte toujours) ; ③ aucun verdict `isMember: false` en cache
 * Redis (fini le lockout de 60 s après un flake d'une seconde).
 * Lecture seule (lib pure + fichiers), aucune base.
 */

const ACTIONS = "src/server/actions/user-actions.ts";

describe("isMember — règle pure de résilience", () => {
    it("membre vu par Discord → membre", () => {
        expect(
            resolveIsMember({ memberPresent: true, isGod: false, memberFetchFailed: false, hasKnownActiveProfile: false })
        ).toBe(true);
    });

    it("God → membre même sans appel Discord (inspection)", () => {
        expect(
            resolveIsMember({ memberPresent: false, isGod: true, memberFetchFailed: false, hasKnownActiveProfile: false })
        ).toBe(true);
    });

    it("erreur API + profil ACTIF connu → membre (repli BDD)", () => {
        expect(
            resolveIsMember({ memberPresent: false, isGod: false, memberFetchFailed: true, hasKnownActiveProfile: true })
        ).toBe(true);
    });

    it("404 sans erreur + profil ACTIF → NON membre (kick/départ réel)", () => {
        expect(
            resolveIsMember({ memberPresent: false, isGod: false, memberFetchFailed: false, hasKnownActiveProfile: true })
        ).toBe(false);
    });

    it("erreur API sans profil → NON membre (inconnu, fail-closed)", () => {
        expect(
            resolveIsMember({ memberPresent: false, isGod: false, memberFetchFailed: true, hasKnownActiveProfile: false })
        ).toBe(false);
    });

    it("inconnu total → NON membre", () => {
        expect(
            resolveIsMember({ memberPresent: false, isGod: false, memberFetchFailed: false, hasKnownActiveProfile: false })
        ).toBe(false);
    });
});

describe("isMember — câblage fail-closed", () => {
    it("la projection finale passe par la règle (fini le `!!member` nu)", () => {
        const src = readFileSync(ACTIONS, "utf8");
        expect(src).toContain("isMember: resolveIsMember({");
        expect(src).not.toMatch(/isMember: !!member,/);
    });

    it("aucun verdict `isMember: false` en cache Redis", () => {
        const src = readFileSync(ACTIONS, "utf8");
        expect(src).toContain("!finalContext.isMember");
    });

    it("le layout garde son mur sur non-membre réel (garde inchangée)", () => {
        const layout = readFileSync("src/app/dashboard/[guildId]/layout.tsx", "utf8");
        expect(layout).toContain("if (!user.isMember)");
        expect(layout).toContain("Accès Restreint");
    });
});
