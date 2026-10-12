import { describe, it, expect } from "vitest";
import {
    MARKET_COSMETIC_SUPERTYPE_IDS,
    MARKET_EQUIPMENT_SUPERTYPE_IDS,
    MARKET_FAMILY_BY_SUPERTYPE_ID,
    MARKET_ITEM_FAMILY_LABELS,
    marketListingKindForFamily,
    resolveMarketItemFamily,
    resolveMarketItemPolicy,
    type MarketItemFamily,
} from "@/lib/market/item-families";

/**
 * BUG-11 / T10 — familles d'objets du Marché (`debug.md` + décisions
 * user du 13/09). La table `superTypeId → famille` a été **vérifiée sur
 * DofusDB** (`api.dofusdb.fr/item-types`, 239 types) ; ce test fige les règles
 * produit pour qu'une évolution de l'API ne les casse pas en silence.
 */
describe("🧭 Marché — familles d'objets (BUG-11 / T10)", () => {
    it("range les familles ÉQUIPEMENTS demandées par le user dans `EQUIPMENT`", () => {
        const equipmentSuperTypes = [1, 2, 3, 4, 5, 7, 10, 11, 12, 13, 23, 69];
        for (const superTypeId of equipmentSuperTypes) {
            expect(resolveMarketItemFamily({ superTypeId })).toBe("EQUIPMENT");
        }
    });

    it("crée la catégorie dédiée COSMÉTIQUE (apparat 22, costume/épaulière 25)", () => {
        expect(resolveMarketItemFamily({ superTypeId: 22 })).toBe("COSMETIC");
        expect(resolveMarketItemFamily({ superTypeId: 25 })).toBe("COSMETIC");
    });

    it("range **tout le reste** dans `RESOURCES_OTHER` (défaut fail-safe)", () => {
        for (const superTypeId of [6, 9, 14, 15, 16, 17, 18, 19, 20, 26, 27, 70]) {
            expect(resolveMarketItemFamily({ superTypeId })).toBe("RESOURCES_OTHER");
        }
        expect(resolveMarketItemFamily({})).toBe("RESOURCES_OTHER");
        expect(resolveMarketItemFamily({ superTypeId: 9999, typeId: null })).toBe(
            "RESOURCES_OTHER"
        );
        // Cas réel vérifié : item 311 « Eau Potable » = type 228 / superType 9.
        expect(resolveMarketItemFamily({ typeId: 228, superTypeId: 9 })).toBe(
            "RESOURCES_OTHER"
        );
    });

    it("vend **brut** compagnon / Dofus / Trophée / Prysmaradite (aucune forge, aucune modif)", () => {
        const rawTypes = [
            { typeId: 169, superTypeId: 23 }, // Compagnon
            { typeId: 23, superTypeId: 13 }, // Dofus
            { typeId: 151, superTypeId: 13 }, // Trophée
            { typeId: 217, superTypeId: 13 }, // Prysmaradite
        ];
        for (const item of rawTypes) {
            const policy = resolveMarketItemPolicy(item);
            expect(policy.family).toBe("EQUIPMENT");
            expect(policy.raw).toBe(true);
            expect(policy.forgeAllowed).toBe(false);
            expect(policy.statEditorAllowed).toBe(false);
            expect(policy.lotAllowed).toBe(false);
        }
    });

    it("autorise les stats (et le légendaire) sur familiers & montiliers", () => {
        for (const typeId of [18, 121, 311, 331, 332, 333]) {
            const policy = resolveMarketItemPolicy({ typeId, superTypeId: 12 });
            expect(policy.statEditorAllowed).toBe(true);
            // Une rune de Transcendance n'a pas de sens sur un familier.
            expect(policy.forgeAllowed).toBe(false);
            expect(policy.lotAllowed).toBe(false);
        }
        expect(resolveMarketItemPolicy({ typeId: 18, superTypeId: 12 }).legendaryAllowed).toBe(true);
        expect(resolveMarketItemPolicy({ typeId: 121, superTypeId: 12 }).legendaryAllowed).toBe(true);
        // Une dragodinde n'est jamais « légendaire ».
        expect(resolveMarketItemPolicy({ typeId: 331, superTypeId: 12 }).legendaryAllowed).toBe(false);
    });

    it("vend l'équipement de percepteur brut, au détail **ou en lot**", () => {
        const policy = resolveMarketItemPolicy({ typeId: 273, superTypeId: 69 });
        expect(policy.family).toBe("EQUIPMENT");
        expect(policy.raw).toBe(true);
        expect(policy.forgeAllowed).toBe(false);
        expect(policy.statEditorAllowed).toBe(false);
        expect(policy.lotAllowed).toBe(true);
    });

    it("laisse la forge ouverte sur l'équipement classique (armes, coiffe, outils…)", () => {
        for (const item of [
            { typeId: 6, superTypeId: 2 }, // Épée
            { typeId: 20, superTypeId: 2 }, // Outil
            { typeId: 21, superTypeId: 2 }, // Pioche
            { typeId: 22, superTypeId: 2 }, // Faux
            { typeId: 114, superTypeId: 2 }, // Arme magique
            { typeId: 16, superTypeId: 10 }, // Chapeau
            { typeId: 82, superTypeId: 7 }, // Bouclier
        ]) {
            const policy = resolveMarketItemPolicy(item);
            expect(policy.forgeAllowed).toBe(true);
            expect(policy.statEditorAllowed).toBe(true);
            expect(policy.lotAllowed).toBe(false);
        }
    });

    it("autorise le **lot à quantité libre** sur Ressources / Autres seulement", () => {
        const resource = resolveMarketItemPolicy({ typeId: 228, superTypeId: 9 });
        expect(resource.lotAllowed).toBe(true);
        expect(resource.forgeAllowed).toBe(false);
        expect(resource.statEditorAllowed).toBe(false);

        const cosmetic = resolveMarketItemPolicy({ typeId: 199, superTypeId: 25 });
        expect(cosmetic.lotAllowed).toBe(false);
        expect(cosmetic.raw).toBe(true);
    });

    it("mappe chaque famille sur le type d'annonce existant (aucune migration)", () => {
        expect(marketListingKindForFamily("EQUIPMENT")).toBe("EQUIPMENT");
        expect(marketListingKindForFamily("COSMETIC")).toBe("EQUIPMENT");
        expect(marketListingKindForFamily("RESOURCES_OTHER")).toBe("RESOURCE");
    });

    it("garde la table cohérente (listes dérivées, aucun chevauchement)", () => {
        expect(MARKET_EQUIPMENT_SUPERTYPE_IDS).toEqual([1, 2, 3, 4, 5, 7, 10, 11, 12, 13, 23, 69]);
        expect(MARKET_COSMETIC_SUPERTYPE_IDS).toEqual([22, 25]);
        const overlap = MARKET_EQUIPMENT_SUPERTYPE_IDS.filter((id) =>
            MARKET_COSMETIC_SUPERTYPE_IDS.includes(id)
        );
        expect(overlap).toEqual([]);
        for (const [id, family] of Object.entries(MARKET_FAMILY_BY_SUPERTYPE_ID)) {
            expect(Number.isInteger(Number(id))).toBe(true);
            expect(Object.keys(MARKET_ITEM_FAMILY_LABELS)).toContain(family);
        }
    });

    it("expose des libellés uniques et lisibles (étape 1 de l'assistant)", () => {
        const labels = Object.values(MARKET_ITEM_FAMILY_LABELS) as MarketItemFamily[];
        expect(labels).toEqual(["Équipements", "Cosmétique", "Ressources / Autres"]);
        expect(labels).not.toContain("Équipement forgemagie");
        expect(labels).not.toContain("Lot de ressources");
    });
});
