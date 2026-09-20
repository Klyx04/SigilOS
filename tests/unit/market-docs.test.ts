/**
 * Module « Marché » — test de la **documentation** (S8.22 / §19.1 et docs/RULES.md).
 *
 * Vérifie que la fiche membre `marche` et la fiche admin `admin-marche` sont à
 * jour, en catégorie « Outils & Services » / « Administration & Staff », que les
 * **2 permissions** du module sont documentées, et que le contenu respecte le
 * standard anti-AI-slop : HTML sémantique, **aucun nom de rôle Discord en dur**,
 * aucun identifiant de guilde.
 */

import { describe, it, expect } from "vitest";
import { OFFICIAL_DOCS } from "@/lib/docs-catalog";

const MARKET_DOC = OFFICIAL_DOCS.find((doc) => doc.slug === "marche");
const ADMIN_MARKET_DOC = OFFICIAL_DOCS.find((doc) => doc.slug === "admin-marche");
const ALL_CONTENT = OFFICIAL_DOCS.map((doc) => doc.content).join("\n");

describe("market doc — fiche membre « marche » (S8.22)", () => {
    it("existe en catégorie « Outils & Services » pour les membres", () => {
        expect(MARKET_DOC).toBeDefined();
        expect(MARKET_DOC?.category).toBe("Outils & Services");
        expect(MARKET_DOC?.accessLevel).toBe("MEMBER");
    });

    it("documente la forge réelle, le troc, les icônes de stats et « Mon espace »", () => {
        const content = MARKET_DOC?.content ?? "";
        expect(content).toContain("Transcendance");
        expect(content.toLowerCase()).toContain("élément de frappe");
        expect(content).toContain("Troc accepté");
        expect(content).toContain("Kamas uniquement");
        expect(content).toContain("icône officielle");
        expect(content).toContain("Mon espace");
        expect(content).toContain("market:trade");
    });

    it("reste du HTML sémantique (pas de Markdown brut non parsé)", () => {
        const content = MARKET_DOC?.content ?? "";
        expect(content).toContain("<h2>");
        expect(content).toContain("<p>");
        expect(content).not.toMatch(/^\s*##\s/m);
        expect(content).not.toMatch(/\*\*[^*]+\*\*/);
    });
});

describe("market doc — fiche admin « admin-marche » (S8.22)", () => {
    it("existe en catégorie « Administration & Staff » pour les admins", () => {
        expect(ADMIN_MARKET_DOC).toBeDefined();
        expect(ADMIN_MARKET_DOC?.category).toBe("Administration & Staff");
        expect(ADMIN_MARKET_DOC?.accessLevel).toBe("ADMIN");
    });

    it("documente les 2 permissions du module", () => {
        const content = ADMIN_MARKET_DOC?.content ?? "";
        expect(content).toContain("market:trade");
        expect(content).toContain("market:moderate");
    });

    it("ne cite aucun rôle Discord en dur ni identifiant de guilde", () => {
        const content = ADMIN_MARKET_DOC?.content ?? "";
        for (const forbidden of ["@Membre", "@Officier", "@Admin", "@Staff", "@Modérateur", "@everyone", "@here"]) {
            expect(content, `rôle en dur interdit : ${forbidden}`).not.toContain(forbidden);
        }
        // Aucun snowflake Discord dans la documentation.
        expect(content).not.toMatch(/\d{15,}/);
    });
});

describe("market doc — les 2 permissions sont documentées dans le catalogue", () => {
    it("`market:trade` et `market:moderate` apparaissent dans les docs officielles", () => {
        expect(ALL_CONTENT).toContain("market:trade");
        expect(ALL_CONTENT).toContain("market:moderate");
    });

    it("aucune fiche officielle ne cite un rôle Discord en dur", () => {
        for (const doc of OFFICIAL_DOCS) {
            for (const forbidden of ["@Membre", "@Officier", "@Modérateur", "@Staff"]) {
                expect(doc.content, `${doc.slug} contient ${forbidden}`).not.toContain(forbidden);
            }
        }
    });
});
