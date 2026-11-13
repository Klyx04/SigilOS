/**
 * Documentation « par module » — organisation pure (`@/lib/docs-modules`).
 *
 * Verrouille le rangement des fiches : ordre canonique des catégories,
 * groupement (inconnues en fin, triées), tri interne (order puis titre),
 * lien slug → route dashboard, et portée user/staff.
 */

import { describe, it, expect } from "vitest";
import {
    DOC_CATEGORY_ORDER,
    MODULE_ROUTES,
    MODULE_DOC_COVERAGE,
    getModuleRoute,
    groupDocsByCategory,
    docScopeOf,
    docCategoryForModule,
    missingModuleDocSlugs,
    missingDocStarterContent,
} from "@/lib/docs-modules";
import { MODULE_GROUPS } from "@/lib/module-catalog";

const doc = (over: Record<string, unknown> = {}) => ({
    id: "1",
    slug: "songes",
    title: "Songes",
    category: "Progression & Objectifs",
    order: 0,
    isPublished: true,
    accessLevel: "MEMBER",
    guildId: null,
    ...over,
});

describe("DOC_CATEGORY_ORDER — ordre canonique", () => {
    it("contient les 5 catégories dans l'ordre du hub", () => {
        expect([...DOC_CATEGORY_ORDER]).toEqual([
            "Progression & Objectifs",
            "Outils & Services",
            "Communauté & Guilde",
            "Administration & Staff",
            "Spécifications Techniques",
        ]);
    });
});

describe("groupDocsByCategory — rangement pur", () => {
    it("groupe dans l'ordre canonique et trie par order puis titre", () => {
        const groups = groupDocsByCategory([
            doc({ id: "a", slug: "marche", title: "Marché", category: "Outils & Services", order: 2 }),
            doc({ id: "b", slug: "songes", title: "Songes", category: "Progression & Objectifs", order: 0 }),
            doc({ id: "c", slug: "ladder", title: "Ladder", category: "Progression & Objectifs", order: 0 }),
        ]);
        expect(groups.map((g) => g.category)).toEqual([
            "Progression & Objectifs",
            "Outils & Services",
        ]);
        expect(groups[0].docs.map((d) => d.slug)).toEqual(["ladder", "songes"]);
    });

    it("relègue les catégories inconnues en fin, par ordre alphabétique", () => {
        const groups = groupDocsByCategory([
            doc({ id: "a", category: "Zeta" }),
            doc({ id: "b", category: "Alpha" }),
            doc({ id: "c", category: "Progression & Objectifs" }),
        ]);
        expect(groups.map((g) => g.category)).toEqual([
            "Progression & Objectifs",
            "Alpha",
            "Zeta",
        ]);
    });

    it("range la catégorie vide dans « Autres »", () => {
        const groups = groupDocsByCategory([doc({ id: "a", category: "" })]);
        expect(groups).toHaveLength(1);
        expect(groups[0].category).toBe("Autres");
    });
});

describe("getModuleRoute — slug vers route dashboard", () => {
    it("retrouve la route d'un module membre et d'un module staff", () => {
        expect(getModuleRoute("songes")).toEqual({ label: "Songes Infinis", href: "/songes" });
        expect(getModuleRoute("admin-logs")).toEqual({ label: "Logs d'Audit Staff", href: "/admin/logs" });
    });

    it("rend null pour un slug inconnu (jamais de lien inventé)", () => {
        expect(getModuleRoute("n-importe-quoi")).toBeNull();
    });

    it("ne contient que des routes dashboard relatives", () => {
        for (const [slug, route] of Object.entries(MODULE_ROUTES)) {
            expect(route.href.startsWith("/"), slug).toBe(true);
            expect(route.label.length, slug).toBeGreaterThan(0);
        }
    });
});

describe("docScopeOf — portée user / staff", () => {
    it("classe le staff par niveau d'accès ou par catégorie", () => {
        expect(docScopeOf({ category: "Outils & Services", accessLevel: "ADMIN" })).toBe("staff");
        expect(docScopeOf({ category: "Administration & Staff", accessLevel: "MEMBER" })).toBe("staff");
    });

    it("classe le reste en user", () => {
        expect(docScopeOf({ category: "Progression & Objectifs", accessLevel: "MEMBER" })).toBe("user");
        expect(docScopeOf({ category: "Outils & Services", accessLevel: "PUBLIC" })).toBe("user");
    });
});

describe("MODULE_DOC_COVERAGE — un module = une fiche (même vide)", () => {
    const moduleKeys = MODULE_GROUPS.flatMap((g) => g.modules.map((m) => m.key));

    it("couvre chaque clé de module (fiche membre et/ou staff, ou exemption motivée)", () => {
        for (const key of moduleKeys) {
            const coverage = MODULE_DOC_COVERAGE[key];
            expect(coverage, `module sans contrat doc : ${key}`).toBeDefined();
            const hasPage = !!coverage?.member || !!coverage?.staff;
            expect(hasPage || !!coverage?.exempt, `ni fiche ni exemption : ${key}`).toBe(true);
        }
    });

    it("ne mappe que des clés de modules réelles, avec des slugs valides et uniques", () => {
        const slugs: string[] = [];
        for (const [key, coverage] of Object.entries(MODULE_DOC_COVERAGE)) {
            expect(moduleKeys, `clé inconnue : ${key}`).toContain(key);
            for (const slug of [coverage.member, coverage.staff]) {
                if (!slug) continue;
                expect(slug, `slug invalide : ${slug}`).toMatch(/^[a-z0-9-]+$/);
                slugs.push(slug);
            }
        }
        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it("range les fiches staff en Administration & Staff, les membres par groupe", () => {
        expect(docCategoryForModule("songes", "staff")).toBe("Administration & Staff");
        expect(docCategoryForModule("songes", "member")).toBe("Progression & Objectifs");
        expect(docCategoryForModule("marche", "member")).toBe("Outils & Services");
        expect(docCategoryForModule("presentation", "member")).toBe("Communauté & Guilde");
    });
});

describe("missingModuleDocSlugs — pages de couverture manquantes (pur)", () => {
    it("rend une liste vide quand tout est couvert", () => {
        const all = Object.values(MODULE_DOC_COVERAGE).flatMap((c) => [c.member, c.staff].filter(Boolean));
        expect(missingModuleDocSlugs(all as string[])).toEqual([]);
    });

    it("liste les manquantes avec titre, catégorie et niveau d'accès", () => {
        const missing = missingModuleDocSlugs(["songes", "missions"]);
        const slugs = missing.map((m) => m.slug);
        expect(slugs).toContain("admin-songes");
        expect(slugs).toContain("admin-missions");
        expect(slugs).not.toContain("songes");
        const staff = missing.find((m) => m.slug === "admin-songes");
        expect(staff?.accessLevel).toBe("ADMIN");
        expect(staff?.category).toBe("Administration & Staff");
        const member = missing.find((m) => m.slug === "presentation");
        expect(member?.accessLevel).toBe("MEMBER");
    });

    it("ignore les slugs nuls (jamais de crash sur une base partielle)", () => {
        expect(() => missingModuleDocSlugs([null, undefined, "songes"])).not.toThrow();
    });
});

describe("missingDocStarterContent — amorce vide assumée", () => {
    it("annonce une page en cours de rédaction, sans faux contenu", () => {
        const html = missingDocStarterContent("Stats Guilde", "Stats Guilde", "member");
        expect(html).toContain("<h2>Stats Guilde</h2>");
        expect(html).toContain("en cours de rédaction");
        expect(html).not.toMatch(/^\s*#{1,3}\s/m);
        expect(html).not.toContain("@");
    });
});
