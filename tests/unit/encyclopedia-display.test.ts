import { describe, expect, it } from "vitest";
import {
    decodeDropCriterions,
    formatDropRate,
    normalizeEncyclopediaCategory,
    resolveEncyclopediaBlocks,
    resolveEncyclopediaMetaChips,
} from "@/lib/ressources/encyclopedia-display";

describe("encyclopedia-display — filtre souverain par type", () => {
    it("accepte les 4 seaux locaux + all", () => {
        expect(normalizeEncyclopediaCategory("equipment")).toBe("equipment");
        expect(normalizeEncyclopediaCategory("resources")).toBe("resources");
        expect(normalizeEncyclopediaCategory("consumables")).toBe("consumables");
        expect(normalizeEncyclopediaCategory("cosmetics")).toBe("cosmetics");
        expect(normalizeEncyclopediaCategory("all")).toBe("all");
    });

    it("retombe sur all hors allowlist (fail-closed, jamais de filtre inventé)", () => {
        expect(normalizeEncyclopediaCategory("armes")).toBe("all");
        expect(normalizeEncyclopediaCategory("")).toBe("all");
        expect(normalizeEncyclopediaCategory(undefined)).toBe("all");
        expect(normalizeEncyclopediaCategory(null)).toBe("all");
        expect(normalizeEncyclopediaCategory(42)).toBe("all");
    });
});

describe("encyclopedia-display — masquage des blocs vides", () => {
    it("fragment sans effet ni recette (cas Glourdorak) : aucun bloc", () => {
        expect(
            resolveEncyclopediaBlocks({
                effectsCount: 0,
                hasRecipeFlag: false,
                hasRecipeData: false,
                loadingRecipe: false,
            }),
        ).toEqual({ showEffects: false, showRecipe: false });
    });

    it("effets présents + recette connue : les deux blocs", () => {
        expect(
            resolveEncyclopediaBlocks({
                effectsCount: 3,
                hasRecipeFlag: true,
                hasRecipeData: true,
                loadingRecipe: false,
            }),
        ).toEqual({ showEffects: true, showRecipe: true });
    });

    it("recette en cours de chargement : le bloc reste (spinner, pas de vide)", () => {
        expect(
            resolveEncyclopediaBlocks({
                effectsCount: 0,
                hasRecipeFlag: true,
                hasRecipeData: false,
                loadingRecipe: true,
            }),
        ).toEqual({ showEffects: false, showRecipe: true });
    });

    it("drapeau inconnu (undefined) : on tente la recette au lieu de masquer", () => {
        expect(
            resolveEncyclopediaBlocks({
                effectsCount: 0,
                hasRecipeFlag: undefined,
                hasRecipeData: false,
                loadingRecipe: false,
            }),
        ).toEqual({ showEffects: false, showRecipe: true });
    });
});

describe("encyclopedia-display — chips de métas (poids, panoplie, jamais de prix)", () => {
    it("fragment Glourdorak (1 pod, sans panoplie) : 1 chip", () => {
        expect(resolveEncyclopediaMetaChips({ realWeight: 1, itemSetName: null })).toEqual([
            { key: "weight", label: "1 pod" },
        ]);
    });

    it("pluriel des pods + panoplie rognée", () => {
        expect(
            resolveEncyclopediaMetaChips({ realWeight: 5, itemSetName: "  Panoplie du Katcheur  " }),
        ).toEqual([
            { key: "weight", label: "5 pods" },
            { key: "set", label: "Panoplie du Katcheur" },
        ]);
    });

    it("rien de connu : aucun chip, jamais de « inconnu »", () => {
        expect(resolveEncyclopediaMetaChips({})).toEqual([]);
        expect(resolveEncyclopediaMetaChips({ realWeight: 0, itemSetName: "   " })).toEqual([]);
    });
});

describe("encyclopedia-display — taux de drop (grades DofusDB)", () => {
    it("grades homogènes 0,8 % (fragment Glourdorak sur Drosérâle)", () => {
        expect(formatDropRate([0.800000011920929, 0.800000011920929, 0.800000011920929, 0.800000011920929, 0.800000011920929])).toBe(
            "0,8 %",
        );
    });

    it("grades hétérogènes : fourchette min – max", () => {
        expect(formatDropRate([12, 12, 5, 12, 12])).toBe("5 % – 12 %");
    });

    it("aucune valeur : null, jamais un faux 0 %", () => {
        expect(formatDropRate([])).toBeNull();
        expect(formatDropRate([0, -1, NaN])).toBeNull();
    });
});

describe("encyclopedia-display — conditions de drop (criterions)", () => {
    it("Mt=0&Ms=0 mesuré = Hors donjon + Hors arène", () => {
        expect(decodeDropCriterions("Mt=0&Ms=0", true)).toEqual(["Hors donjon", "Hors arène"]);
    });

    it("code inconnu : rendu tel quel, jamais inventé", () => {
        expect(decodeDropCriterions("ZZ=3", true)).toEqual(["ZZ=3"]);
    });

    it("sans criterions : rien", () => {
        expect(decodeDropCriterions("", false)).toEqual([]);
        expect(decodeDropCriterions("Mt=0", false)).toEqual([]);
    });
});
