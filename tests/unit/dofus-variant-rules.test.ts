/**
 * Légalité d'une variante de stuff — règles pures, fail-closed.
 *
 * 🎯 Constat user du 25/10/2026 : « aujourd'hui on peut poser des items en variante n'importe
 * comment ». Ce verrou couvre ce qui est **décidable sans nouvelle donnée** : slot + type
 * d'objet, niveau ≤ build, aucun doublon (anneaux identiques compris).
 *
 * ⚠️ Non couvert ici (données absentes de `GameItem`, lot séparé **avec migration**) : armes à
 * deux mains vs bouclier (`twoHanded`), conditions d'objet (`criterions` DofusDB), règles de
 * panoplie (N pièces max).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
    effectiveSlotIds,
    slotAcceptsItemType,
    validateSavedVariants,
    validateVariantSlot,
} from "@/lib/dofus-variant-rules";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const item = (ankamaId: number, typeName: string, level = 200) => ({
    id: ankamaId,
    official: ankamaId,
    picture: ankamaId,
    name: `Objet ${ankamaId}`,
    level,
    typeName,
});

describe("slotAcceptsItemType — slot ↔ type d'objet", () => {
    it("accepte le type attendu du slot", () => {
        expect(slotAcceptsItemType("ch", "Chapeau")).toBe(true);
        expect(slotAcceptsItemType("a1", "Anneau")).toBe(true);
        expect(slotAcceptsItemType("d1", "Dofus")).toBe(true);
        expect(slotAcceptsItemType("d2", "Prysmaradite")).toBe(true);
    });

    it("refuse un type incompatible ou inconnu (fail-closed)", () => {
        expect(slotAcceptsItemType("ch", "Bouclier")).toBe(false);
        expect(slotAcceptsItemType("ce", "Cape")).toBe(false);
        expect(slotAcceptsItemType("ch", null)).toBe(false);
        expect(slotAcceptsItemType("inconnu", "Chapeau")).toBe(false);
    });

    it("tolère le libellé de slot des variantes historiques (sans type réel)", () => {
        expect(slotAcceptsItemType("d1", "Dofus / Trophée")).toBe(true);
        expect(slotAcceptsItemType("fa", "Familier / Monture")).toBe(true);
    });
});

describe("validateVariantSlot — niveau, doublon", () => {
    it("accepte un objet du bon type et du bon niveau", () => {
        expect(validateVariantSlot({
            slot: "ch",
            item: item(1, "Chapeau"),
            buildLevel: 200,
            occupiedIds: [],
        }).ok).toBe(true);
    });

    it("refuse un objet au-dessus du niveau du build", () => {
        const result = validateVariantSlot({
            slot: "ch",
            item: item(1, "Chapeau", 200),
            buildLevel: 150,
            occupiedIds: [],
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.violation.code).toBe("level-too-high");
    });

    it("refuse un doublon déjà équipé dans un autre slot", () => {
        const result = validateVariantSlot({
            slot: "a2",
            item: item(42, "Anneau"),
            buildLevel: 200,
            occupiedIds: [{ slot: "a1", id: 42 }],
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.violation.message).toContain("déjà équipé");
    });

    it("ignore le slot cible lui-même (on remplace son propre objet)", () => {
        expect(validateVariantSlot({
            slot: "a1",
            item: item(42, "Anneau"),
            buildLevel: 200,
            occupiedIds: [{ slot: "a1", id: 42 }],
        }).ok).toBe(true);
    });
});

describe("effectiveSlotIds / validateSavedVariants — variante complète", () => {
    it("fusionne stuff d'origine et variantes (la variante gagne)", () => {
        const ids = effectiveSlotIds(
            {
                ch: { id: 111, official: 111, picture: 1, name: "Base", level: 200 },
                ca: { id: 222, official: 222, picture: 2, name: "Cape", level: 200 },
            },
            { ch: { id: 999, official: 999, picture: 9, name: "Variante", level: 200 } },
        );

        expect(ids).toEqual([
            { slot: "ch", id: 999 },
            { slot: "ca", id: 222 },
        ]);
    });

    it("valide une variante légale", () => {
        const decision = validateSavedVariants({
            baseItems: { ch: { id: 111, official: 111, picture: 1, name: "Base", level: 200, typeName: "Chapeau" } },
            variants: { ce: { id: 333, official: 333, picture: 3, name: "Ceinture", level: 200, typeName: "Ceinture" } },
            buildLevel: 200,
        });

        expect(decision.ok).toBe(true);
    });

    it("refuse une variante qui duplique un objet du stuff d'origine", () => {
        const decision = validateSavedVariants({
            baseItems: { a1: { id: 111, official: 111, picture: 1, name: "Anneau", level: 200, typeName: "Anneau" } },
            variants: { a2: { id: 111, official: 111, picture: 1, name: "Anneau", level: 200, typeName: "Anneau" } },
            buildLevel: 200,
        });

        expect(decision.ok).toBe(false);
        if (!decision.ok) expect(decision.violation.code).toBe("duplicate-item");
    });
});

describe("branchement — serveur autoritaire, client indicatif", () => {
    it("`saveBuildVariant` refuse avant toute écriture", () => {
        const actions = read("src/server/actions/gallery-actions.ts");
        const start = actions.indexOf("export async function saveBuildVariant");
        // Fenêtre élargie le 25/10/2026 : validation (conditions, arme à deux mains, panoplies)
        // avant écriture — la garde porte sur le **corps** de l'écriture, pas sur sa position.
        const body = actions.slice(start, start + 9000);

        expect(body).toContain("validateSavedVariants({");
        expect(body).toContain("if (!decision.ok)");
        expect(body.indexOf("validateSavedVariants({")).toBeLessThan(body.indexOf("db.userProfile.update"));
    });

    it("la liste des objets proposeés masque ceux déjà équipés", () => {
        const modal = read("src/components/dofus/item-variant-modal.tsx");
        const preview = read("src/components/dofus/dofusbook-preview.tsx");

        expect(modal).toContain("unavailableIds?: number[]");
        expect(modal).toContain("déjà équipé(s) masqué(s)");
        expect(preview).toContain("unavailableIds={effectiveSlotIds(effectiveData?.items, variants)");
    });
});
