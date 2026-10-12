/**
 * Module « Songes » — test de la **documentation** (standard anti-AI-slop,
 * même règle que `market-docs.test.ts`).
 *
 * Vérifie que la fiche membre `songes` est à jour, en catégorie
 * « Progression & Objectifs », que le contenu est du HTML sémantique
 * (aucun Markdown brut non parsé), sans rôle Discord en dur ni identifiant,
 * et qu'il raconte le vrai module : étages 1 à 26, équipe de 4, barème
 * de contribution 1/2/3, mockups versionnés.
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { OFFICIAL_DOCS } from "@/lib/docs-catalog";

const SONGES_DOC = OFFICIAL_DOCS.find((doc) => doc.slug === "songes");

describe("songes doc — fiche membre « songes »", () => {
    it("existe en catégorie « Progression & Objectifs » pour les membres", () => {
        expect(SONGES_DOC).toBeDefined();
        expect(SONGES_DOC?.category).toBe("Progression & Objectifs");
        expect(SONGES_DOC?.accessLevel).toBe("MEMBER");
    });

    it("reste du HTML sémantique (pas de Markdown brut non parsé)", () => {
        const content = SONGES_DOC?.content ?? "";
        expect(content).toContain("<h2>");
        expect(content).toContain("<p>");
        expect(content).not.toMatch(/^\s*#{1,3}\s/m);
        expect(content).not.toMatch(/\*\*[^*]+\*\*/);
        expect(content).not.toContain("| ---");
    });

    it("raconte le vrai module (pas d'étages 200+, pas de partage de butin)", () => {
        const content = SONGES_DOC?.content ?? "";
        expect(content).toContain("26");
        expect(content).not.toMatch(/200 à 400|400\+|Étage 285/);
        expect(content).toContain("4");
        expect(content).toContain("Rêve");
        expect(content).toContain("Paradoxe");
        expect(content).toContain("Cauchemar");
        expect(content).toContain("Choisir ma classe");
        expect(content).toContain("ne distribue pas de butin");
    });

    it("documente le barème de contribution 1/2/3 et la clôture", () => {
        const content = SONGES_DOC?.content ?? "";
        expect(content).toContain("1 point");
        expect(content).toContain("2 points");
        expect(content).toContain("3 points");
        expect(content).toContain("Terminée");
    });

    it("référence des mockups qui existent vraiment sur le disque", () => {
        const content = SONGES_DOC?.content ?? "";
        const srcs = Array.from(content.matchAll(/<img[^>]+src="([^"]+)"/g)).map((m) => m[1]);
        expect(srcs.length).toBeGreaterThan(0);
        for (const src of srcs) {
            expect(src.startsWith("/"), `src local attendu : ${src}`).toBe(true);
            expect(
                existsSync(join(process.cwd(), "public", src)),
                `mockup manquant sur le disque : ${src}`
            ).toBe(true);
        }
    });

    it("ne cite aucun rôle Discord en dur ni identifiant de guilde", () => {
        const content = SONGES_DOC?.content ?? "";
        for (const forbidden of ["@Membre", "@Officier", "@Admin", "@Staff", "@Modérateur", "@everyone", "@here"]) {
            expect(content, `rôle en dur interdit : ${forbidden}`).not.toContain(forbidden);
        }
        // Aucun snowflake Discord dans la documentation.
        expect(content).not.toMatch(/\d{15,}/);
    });
});
