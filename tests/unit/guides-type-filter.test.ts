/**
 * Bonus 10/10/2026 — onglet Guides : **filtre par type** (Raids vs Guides),
 * dérivé du registre (options + compteurs calculés, jamais en dur).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { filterGuides, guideTypeCounts, guideTypeOf } from "@/lib/guides-filter";

const GUIDES = [
    { slug: "raid-gigalodon-dofus-guide", title: "Gigalodon", description: "Raid", category: "Raid de Guilde" },
    { slug: "raid-sanctuaire-jardins-eternels-dofus-guide", title: "Sanctuaire", description: "Raid", category: "Raid de Guilde" },
    { slug: "poids-runes-forgemagie-dofus", title: "Poids des runes", description: "Forge", category: "Forgemagie" },
    { slug: "creer-gerer-guilde-dofus-2026", title: "Créer sa guilde", description: "Guilde", category: "Gestion de Guilde" },
];

describe("guides — type dérivé du registre", () => {
    it("un slug branché overlay/studio est un Raid, les autres des Guides", () => {
        expect(guideTypeOf("raid-gigalodon-dofus-guide")).toBe("Raid");
        expect(guideTypeOf("poids-runes-forgemagie-dofus")).toBe("Guide");
        expect(guideTypeOf("slug-inconnu")).toBe("Guide");
    });

    it("les compteurs viennent des données", () => {
        expect(guideTypeCounts(GUIDES)).toEqual([
            { type: "Raid", count: 2 },
            { type: "Guide", count: 2 },
        ]);
        expect(guideTypeCounts([])).toEqual([]);
    });
});

describe("guides — filtre combiné (recherche + catégorie + type)", () => {    it("Tous par défaut : rien n'est masqué", () => {
        expect(filterGuides(GUIDES, { query: "", category: "all", type: "all" })).toHaveLength(4);
    });

    it("type Raid seul", () => {
        const rows = filterGuides(GUIDES, { query: "", category: "all", type: "Raid" });
        expect(rows.map((g) => g.slug)).toEqual([
            "raid-gigalodon-dofus-guide",
            "raid-sanctuaire-jardins-eternels-dofus-guide",
        ]);
    });

    it("type + catégorie + recherche se combinent", () => {
        expect(
            filterGuides(GUIDES, { query: "runes", category: "all", type: "Guide" })
        ).toHaveLength(1);
        expect(
            filterGuides(GUIDES, { query: "", category: "Forgemagie", type: "Raid" })
        ).toHaveLength(0);
    });
});

describe("guides — parité registre (jamais deux listes divergentes)", () => {
    it("les slugs Raid de la lib sont exactement ceux du registre d'overlays", () => {
        const lib = readFileSync("src/lib/guides-filter.ts", "utf8");
        const grid = readFileSync("src/components/ressources/GuidesGrid.tsx", "utf8");
        const libSlugs = [...lib.matchAll(/"([a-z0-9-]+-dofus-guide)"/g)].map((m) => m[1]).sort();
        const gridSlugs = [...grid.matchAll(/"([a-z0-9-]+-dofus-guide)"/g)].map((m) => m[1]).sort();
        expect(libSlugs.length).toBeGreaterThan(0);
        expect(gridSlugs).toEqual(libSlugs);
    });
});
