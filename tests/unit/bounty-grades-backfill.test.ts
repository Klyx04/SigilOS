/**
 * 🐗 Avis — grades & drops relus depuis l'appel de liste (zéro appel en plus).
 *
 * Verrouille la cause du 28/09/2026 : le repli `{ id, name, spells: [] }` du
 * siphon n'a ni grades ni drops ⇒ barres vides + résistances à « 0 % ».
 */

import { describe, it, expect } from "vitest";
import { mapBountyDrops, mapBountyGrades } from "@/lib/bounty-grades";

const RAW_GRADES = [
    {
        level: 200,
        lifePoints: 5200,
        actionPoints: 12,
        movementPoints: 4,
        neutralResistance: 10,
        earthResistance: 15,
        fireResistance: -10,
        waterResistance: 0,
        airResistance: 5,
        wisdom: 200,
        strength: 150,
        intelligence: 0,
        chance: 0,
        agility: 80,
        paDodge: 20,
        pmDodge: 15,
        gradeXp: 12000,
    },
    { level: 190, lifePoints: 4800 },
];

describe("bounty-grades — grades de la liste au format fiche", () => {
    it("convertit PV/PA/PM, résistances et caracs (même forme que getMonsterStats)", () => {
        const mapped = mapBountyGrades(RAW_GRADES);
        expect(mapped).not.toBeNull();
        expect(mapped).toHaveLength(2);
        expect(mapped![0]).toMatchObject({
            level: 200,
            lifePoints: 5200,
            actionPoints: 12,
            movementPoints: 4,
            resists: { neutral: 10, earth: 15, fire: -10, water: 0, air: 5 },
        });
        expect(mapped![0].carac.wisdom).toBe(200);
        // Grade partiel : chiffres présents, zéros honnêtes ailleurs.
        expect(mapped![1]).toMatchObject({ level: 190, lifePoints: 4800, actionPoints: 0 });
    });

    it("accepte les alias pa/pm et refuse les grades fantômes", () => {
        const mapped = mapBountyGrades([{ level: 100, lifePoints: 1000, pa: 8, pm: 3 }]);
        expect(mapped![0].actionPoints).toBe(8);
        expect(mapped![0].movementPoints).toBe(3);
        expect(mapBountyGrades([{ level: 100 }])).toBeNull();
        expect(mapBountyGrades([{ lifePoints: 500 }])).toBeNull();
        expect(mapBountyGrades([])).toBeNull();
        expect(mapBountyGrades(null)).toBeNull();
        expect(mapBountyGrades("nimporte-quoi")).toBeNull();
    });
});

describe("bounty-grades — drops de la liste au format fiche", () => {
    const RAW_DROPS = [
        {
            objectId: 7350,
            percentDropForGrade1: 100,
            percentDropForGrade2: 100,
            percentDropForGrade3: 100,
            percentDropForGrade4: 100,
            percentDropForGrade5: 100,
        },
        { objectId: 1234, percentDropForGrade1: 0.007 },
    ];

    it("taux par grade + repli noms, formatés comme getMonsterStats", () => {
        const mapped = mapBountyDrops(RAW_DROPS, {
            7350: { nameFr: "Dofus Élémentaire", nameEn: "Elemental Dofus", img: "https://img/7350.png" },
        });
        expect(mapped).not.toBeNull();
        expect(mapped).toHaveLength(2);
        expect(mapped![0]).toMatchObject({
            objectId: 7350,
            name: "Dofus Élémentaire",
            nameEn: "Elemental Dofus",
            imageUrl: "https://img/7350.png",
            percent: 100,
        });
        expect(mapped![0].percentByGrade).toEqual([100, 100, 100, 100, 100]);
        // 0.007 % < 0.01 ⇒ 3 décimales, nom replié.
        expect(mapped![1].percent).toBe(0.007);
        expect(mapped![1].name).toBe("Objet #1234");
    });

    it("ignore les drops sans objectId et les entrées vides", () => {
        expect(mapBountyDrops([{ objectId: 0 }])).toBeNull();
        expect(mapBountyDrops([])).toBeNull();
        expect(mapBountyDrops(null)).toBeNull();
    });
});
