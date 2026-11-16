/**
 * Janitor — le filtre des orphelins ne doit **jamais** emporter un visiteur.
 *
 * Le 16/11/2026, `scripts/database-janitor.ts` supprimait tout `User` sans
 * `UserProfile` depuis 7 jours : un compte visiteur (aucun profil de guilde, mais
 * un `PublicProfile`) était donc effacé au bout d'une semaine, contre la décision
 * D-V5 (365 j d'inactivité réelle). Ces cas verrouillent la règle pure et la
 * source du script.
 */

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { buildOrphanUserWhere } from "@/lib/account-retention-policy";

describe("buildOrphanUserWhere — les visiteurs sont protégés", () => {
    const cutoff = new Date("2026-11-09T04:00:00Z");

    it("exige l'absence de profil visiteur en plus de l'absence de profil de guilde", () => {
        const where = buildOrphanUserWhere(cutoff);
        expect(where.createdAt).toEqual({ lt: cutoff });
        expect(where.profiles).toEqual({ none: {} });
        expect(where.publicProfile).toEqual({ is: null });
    });

    it("un compte avec PublicProfile ne satisfait pas le filtre", () => {
        const where = buildOrphanUserWhere(cutoff);
        // La condition est explicite : `{ is: null }` ne matche pas un profil existant.
        expect(where.publicProfile.is).toBeNull();
    });
});

describe("scripts/database-janitor.ts — source", () => {
    it("utilise la règle pure au lieu de recopier le filtre", () => {
        const script = readFileSync("scripts/database-janitor.ts", "utf8");
        expect(script).toContain("buildOrphanUserWhere");
        // Le filtre historique (sans `publicProfile`) ne doit pas revenir.
        expect(script).not.toMatch(/profiles:\s*\{\s*none:\s*\{\s*\}\s*\}/);
    });

    it("ne journalise plus l'e-mail des comptes supprimés", () => {
        const script = readFileSync("scripts/database-janitor.ts", "utf8");
        expect(script).not.toContain("u.email");
    });
});

describe("God — panneau « comptes sans profil » (super-admin-actions)", () => {
    const source = readFileSync("src/server/actions/super-admin-actions.ts", "utf8");

    it("getGhostUsers et cleanupGhostUsers excluent les visiteurs", () => {
        // Deux requêtes de liste/purge : chacune doit porter `publicProfile: { is: null }`.
        const exclusions = source.match(/publicProfile: \{ is: null \}/g) ?? [];
        expect(exclusions.length).toBeGreaterThanOrEqual(2);
    });

    it("deleteGhostUser refuse un profil visiteur", () => {
        expect(source).toContain("Ce compte est un visiteur (profil public), pas un fantôme.");
    });

    it("ne journalise plus le pseudo ni le discordId dans le log de purge", () => {
        expect(source).not.toContain('MANUAL_GHOST_DELETE", userName');
    });
});
