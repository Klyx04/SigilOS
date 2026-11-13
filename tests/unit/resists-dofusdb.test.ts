/**
 * Résistances d'un grade — deux formes de payload, une seule lecture.
 *
 * 🐛 Mesure du 20/10/2026 : le Comte Harebourg (3416) affichait « — » sur les cinq
 * résistances. En base, `MonsterStat.stats.grades[].resists` valait `{}` ; DofusDB ne
 * sert pas `neutralResistance` mais `reductionNeutral` / `reductionEarth` / … (les % de
 * résistance du jeu). Les quatre autres boss de Frigost avaient la valeur : seul le
 * payload du Comte était concerné.
 */
import { describe, expect, it } from "vitest";

import { readGradeResists } from "@/lib/dofus-monster-grades";

describe("readGradeResists — résistances d'un grade", () => {
    it("① lit la forme de notre base (`resists`)", () => {
        expect(
            readGradeResists({ resists: { neutral: 14, earth: 27, fire: 16, water: 21, air: 25 } })
        ).toEqual({ neutral: 14, earth: 27, fire: 16, water: 21, air: 25 });
    });

    it("② replie sur les `reduction*` de DofusDB (valeurs réelles du Comte)", () => {
        expect(
            readGradeResists({
                reductionNeutral: 14,
                reductionEarth: 17,
                reductionFire: 16,
                reductionWater: 29,
                reductionAir: 25,
            })
        ).toEqual({ neutral: 14, earth: 17, fire: 16, water: 29, air: 25 });
    });

    it("③ replie même quand `resists` existe mais est vide", () => {
        expect(readGradeResists({ resists: {}, reductionNeutral: 14 })).toEqual({
            neutral: 14,
            earth: null,
            fire: null,
            water: null,
            air: null,
        });
    });

    it("④ ne fabrique jamais 0 % : aucune valeur exploitable ⇒ null", () => {
        expect(readGradeResists({})).toBeNull();
        expect(readGradeResists(null)).toBeNull();
        expect(readGradeResists({ resists: {} })).toBeNull();
    });
});
