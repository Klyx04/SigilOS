import { describe, it, expect } from "vitest";
import { organizeSpellDamageGroups, spellDamageFromEffect, type SpellBaseDamage, type SpellDamageResult } from "@/lib/dofus-spells";

describe("organizeSpellDamageGroups", () => {
    it("détecte les sorts à paliers multiples comme Tromperie et évite les totaux aberrants", () => {
        // Simulation des 16 lignes de Tromperie (4 paliers de 4 éléments)
        const dmgLines: SpellBaseDamage[] = [
            // Palier 1
            { min: 19, max: 20, element: "air", grade: 3 },
            { min: 19, max: 20, element: "eau", grade: 3 },
            { min: 19, max: 20, element: "feu", grade: 3 },
            { min: 19, max: 20, element: "terre", grade: 3 },
            // Palier 2
            { min: 28, max: 30, element: "air", grade: 3 },
            { min: 28, max: 30, element: "eau", grade: 3 },
            { min: 28, max: 30, element: "feu", grade: 3 },
            { min: 28, max: 30, element: "terre", grade: 3 },
        ];

        const results: SpellDamageResult[] = dmgLines.map((dmg) => ({
            baseMin: dmg.min,
            baseMax: dmg.max,
            theoMin: dmg.min * 10,
            theoMax: dmg.max * 10,
            critMin: dmg.min * 15,
            critMax: dmg.max * 15,
            elementStat: 100,
            critMult: 1.5,
            grade: 3,
        }));

        const groups = organizeSpellDamageGroups(dmgLines, results);
        expect(groups.length).toBe(2);
        expect(groups[0].tierLabel).toContain("Palier 1");
        expect(groups[0].isExclusive).toBe(true);
        expect(groups[0].items.length).toBe(4);

        expect(groups[1].tierLabel).toContain("Palier 2");
        expect(groups[1].isExclusive).toBe(true);
        expect(groups[1].items.length).toBe(4);
    });

    it("laisse les sorts standard à ligne unique ou bi-élément en mode cumulatif", () => {
        const dmgLines: SpellBaseDamage[] = [
            { min: 20, max: 25, element: "feu", grade: 1 },
            { min: 15, max: 20, element: "eau", grade: 1 },
        ];
        const results: SpellDamageResult[] = dmgLines.map((dmg) => ({
            baseMin: dmg.min,
            baseMax: dmg.max,
            theoMin: dmg.min * 5,
            theoMax: dmg.max * 5,
            critMin: dmg.min * 7,
            critMax: dmg.max * 7,
            elementStat: 100,
            critMult: 1.5,
            grade: 1,
        }));

        const groups = organizeSpellDamageGroups(dmgLines, results);
        expect(groups.length).toBe(1);
        expect(groups[0].isExclusive).toBe(false);
        expect(groups[0].items.length).toBe(2);
    });
});

describe("spellDamageFromEffect avec glyphes/pièges", () => {
    it("extrait correctement les dégâts d'un glyphe (ex. Terre Brûlée Féca)", () => {
        const eff = {
            effectId: 400, // Pose un glyphe
            formatted: "Pose un glyphe-aura (26 à 30 dommages Feu)",
            zoneDescr: { shape: 67, param1: 2 }, // Cercle 2
        };
        const dmg = spellDamageFromEffect(eff);
        expect(dmg).not.toBeNull();
        expect(dmg?.element).toBe("feu");
        expect(dmg?.min).toBe(26);
        expect(dmg?.max).toBe(30);
        expect(dmg?.zone?.shape).toBe("C");
        expect(dmg?.zone?.size).toBe(2);
    });
});
