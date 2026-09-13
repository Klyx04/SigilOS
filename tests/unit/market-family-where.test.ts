import { describe, it, expect } from "vitest";
import {
    MARKET_EQUIPMENT_TYPE_IDS,
    MARKET_COSMETIC_TYPE_IDS,
    resolveMarketItemFamily,
    resolveMarketItemPolicy,
} from "@/lib/market/item-families";
import { buildMarketFamilyWhere } from "@/lib/market/family-where";

/**
 * 🐞 **Régression beta du 13/09** — « on ne trouve rien dans le catalogue » :
 *   · le référentiel local a `superTypeId` = **NULL** partout (le siphon lisait
 *     un champ inexistant) et un `category` **heuristique faux** (« Bois » était
 *     classé `equipment`) ;
 *   · le premier filtre utilisait `NOT: { OR: [...] }` ⇒ en SQL, `NULL IN (...)`
 *     vaut `NULL`, donc `NOT NULL` = `NULL` : **toutes** les lignes étaient
 *     exclues (0 résultat pour « tremble », « glour », « eau potable »).
 *
 * Ces tests figent la correction : résolution par **`typeId`** (toujours
 * renseigné) et filtre **NULL-safe** (jamais de `NOT` sur une colonne nullable).
 */
describe("🐞 Marché — régression catalogue du 13/09 (familles & filtre)", () => {
    it("classe « Bois de Tremble » (typeId 38, superTypeId NULL) en Ressources / Autres", () => {
        // Cas réel relevé en base : typeId 38, superTypeId null, category 'equipment'.
        const policy = resolveMarketItemPolicy({
            typeId: 38,
            superTypeId: null,
            typeName: "Bois",
            category: "equipment",
        });
        expect(policy.family).toBe("RESOURCES_OTHER");
        expect(policy.lotAllowed).toBe(true);
        expect(policy.forgeAllowed).toBe(false);
        expect(policy.statEditorAllowed).toBe(false);
    });

    it("classe les équipements réels même sans `superTypeId` (typeId seul suffit)", () => {
        // Extraits du relevé : Chapeau 16, Cape 17, Amulette 1, Ceinture 10,
        // Bottes 11, Bouclier 82, Épée 6, Marteau 7.
        for (const [typeId, typeName] of [
            [16, "Chapeau"],
            [17, "Cape"],
            [1, "Amulette"],
            [10, "Ceinture"],
            [11, "Bottes"],
            [82, "Bouclier"],
            [6, "Épée"],
            [7, "Marteau"],
        ] as const) {
            const family = resolveMarketItemFamily({ typeId, superTypeId: null, typeName });
            expect(family, `${typeName} (typeId ${typeId})`).toBe("EQUIPMENT");
        }
    });

    it("classe le cosmétique par son `typeId` (apparat, costume, épaulière, ailes)", () => {
        for (const typeId of [246, 247, 248, 199, 299, 300]) {
            expect(resolveMarketItemFamily({ typeId, superTypeId: null })).toBe("COSMETIC");
        }
    });

    it("le filtre SQL d'une famille **ne contient aucun `NOT`** (logique ternaire NULL)", () => {
        const serialized = JSON.stringify(buildMarketFamilyWhere("RESOURCES_OTHER"));
        expect(serialized).not.toContain('"NOT"');
        // …et gère explicitement les colonnes nullable.
        expect(serialized).toContain('"typeId":null');
        expect(serialized).toContain('"superTypeId":null');
        expect(serialized).toContain("notIn");
    });

    it("le filtre ÉQUIPEMENT / COSMÉTIQUE est un OR de signaux positifs", () => {
        const equipment = buildMarketFamilyWhere("EQUIPMENT");
        expect(Array.isArray(equipment.OR)).toBe(true);
        const serialized = JSON.stringify(equipment);
        expect(serialized).toContain(`"in":${JSON.stringify(MARKET_EQUIPMENT_TYPE_IDS)}`.slice(0, 24));
        expect(serialized).not.toContain('"NOT"');

        const cosmetic = buildMarketFamilyWhere("COSMETIC");
        expect(Array.isArray(cosmetic.OR)).toBe(true);
        expect(JSON.stringify(cosmetic)).toContain(String(MARKET_COSMETIC_TYPE_IDS[0]));
    });
});
