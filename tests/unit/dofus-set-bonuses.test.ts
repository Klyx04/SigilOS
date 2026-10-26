/**
 * Bonus de panoplie — **règles officielles** (Dofus 3.7), mesurées sur les payloads réels.
 *
 * Source : doc « Comprendre les interactions d'équipement dans DOFUS » (25/10/2026) +
 * MàJ 3.7 du 06/10/2026 :
 *   · une panoplie est **active dès 2 pièces** ;
 *   · le **palier courant remplace** le précédent (les lignes ne s'additionnent pas) ;
 *   · un **même objet porté deux fois** ne compte que pour **une** pièce distincte ;
 *   · une seule **Prysmaradite** (elle partage le 1ᵉʳ emplacement Dofus/Trophée).
 */

import { describe, it, expect } from "vitest";
import { processDofusbookRawData } from "@/lib/dofusbook-utils";
import {
    isPrysmaraditeType,
    validatePrysmaraditeLimit,
} from "@/lib/dofus-variant-rules";

function buildWithSet(stuffItem: Record<string, number>) {
    return {
        stuff: {
            name: "Panoplie test",
            character_level: 200,
            stuffItem,
            stuffCarac: {},
            stuffFm: { fm: {} },
            stuffFmItem: {},
        },
        items: [
            { id: 10, name: "Anneau test", picture: 10, official: 10, level: 200, effects: [] },
            { id: 11, name: "Coiffe test", picture: 11, official: 11, level: 200, effects: [] },
            { id: 12, name: "Cape test", picture: 12, official: 12, level: 200, effects: [] },
        ],
        cloths: [
            {
                name: "Panoplie test",
                count_item: 3,
                items: [{ id: 10 }, { id: 11 }, { id: 12 }],
                // Deux paliers envoyés : le plus haut atteint **remplace** l'autre.
                effects: [
                    { count: 2, name: "fo", value: 10 },
                    { count: 3, name: "fo", value: 30 },
                ],
            },
        ],
    };
}

describe("bonus de panoplie — palier remplacé, pièces distinctes", () => {
    it("applique le palier le plus haut, sans additionner les paliers", () => {
        const data = processDofusbookRawData("1", buildWithSet({ a1: 10, a2: 11, ca: 12 }));

        expect(data.cloths?.[0].count).toBe(3);
        // 30 (palier 3) et non 40 (10 + 30).
        expect(data.elements.fo).toBe(30);
        expect(data.cloths?.[0].bonuses).toMatchObject({ fo: 30 });
    });

    it("ne compte qu'une pièce distincte quand le même objet est porté deux fois", () => {
        // Anneau 10 en a1 ET a2 + coiffe 11 ⇒ 2 pièces distinctes (pas 3).
        const data = processDofusbookRawData("1", buildWithSet({ a1: 10, a2: 10, ch: 11 }));

        expect(data.cloths?.[0].count).toBe(2);
        expect(data.elements.fo).toBe(10);
    });

    it("une panoplie à 1 seule pièce n'est pas active (règle 3.7)", () => {
        const data = processDofusbookRawData("1", buildWithSet({ a1: 10 }));

        expect(data.cloths ?? []).toHaveLength(0);
        expect(data.elements.fo).toBe(0);
    });
});

describe("Prysmaradites — une seule par personnage", () => {
    it("reconnaît le type (insensible à la casse)", () => {
        expect(isPrysmaraditeType("Prysmaradite")).toBe(true);
        expect(isPrysmaraditeType(" prysmaradite ")).toBe(true);
        expect(isPrysmaraditeType("Dofus")).toBe(false);
        expect(isPrysmaraditeType(null)).toBe(false);
    });

    it("accepte une Prysmaradite, refuse la deuxième", () => {
        expect(validatePrysmaraditeLimit(["Dofus", "Prysmaradite"]).ok).toBe(true);

        const refused = validatePrysmaraditeLimit(["Prysmaradite", "Dofus", "Prysmaradite"]);
        expect(refused.ok).toBe(false);
        if (!refused.ok) {
            expect(refused.violation.code).toBe("prysmaradite-limit");
            expect(refused.violation.message).toContain("Une seule Prysmaradite");
        }
    });
});
