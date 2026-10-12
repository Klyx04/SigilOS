/**
 * Phase 5.4 — Test de contrat DofusDB : pin endpoints + champs critiques.
 * Un renommage côté source doit échouer explicitement (pas de dataset
 * partiel silencieux).
 */

import { describe, it, expect } from "vitest";

import {
    checkDungeonsContract,
    checkRacesContract,
    checkMonsterContract,
    assertDatasetContract,
} from "@/lib/dungeon-monsters-siphon";

const GOOD_DUNGEON = { id: 1, name: { fr: "Donjon" }, monsters: [1], bosses: [2] };
const GOOD_RACE = { id: 5, monsters: [1, 2] };
const GOOD_MONSTER = { id: 10, img: "https://api.dofusdb.fr/img/monsters/10.png", grades: [{ level: 1 }] };

describe("checkDungeonsContract", () => {
    it("accepte une page conforme", () => {
        expect(checkDungeonsContract([GOOD_DUNGEON])).toEqual([]);
    });

    it("rejette : vide, sans id, sans nom, sans listes", () => {
        expect(checkDungeonsContract([])).toHaveLength(1);
        expect(checkDungeonsContract(null)).toHaveLength(1);
        expect(checkDungeonsContract([{ name: { fr: "x" }, monsters: [] }])).toHaveLength(1);
        expect(checkDungeonsContract([{ id: 1, monsters: [] }])).toHaveLength(1);
        expect(checkDungeonsContract([{ id: 1, name: "x" }])).toHaveLength(1);
    });
});

describe("checkRacesContract", () => {
    it("accepte une page conforme", () => {
        expect(checkRacesContract([GOOD_RACE])).toEqual([]);
    });

    it("rejette : vide, sans id, sans monsters", () => {
        expect(checkRacesContract([])).toHaveLength(1);
        expect(checkRacesContract([{ monsters: [] }])).toHaveLength(1);
        expect(checkRacesContract([{ id: 1 }])).toHaveLength(1);
    });
});

describe("checkMonsterContract", () => {
    it("accepte un monstre conforme (img nullable)", () => {
        expect(checkMonsterContract(GOOD_MONSTER)).toEqual([]);
        expect(checkMonsterContract({ ...GOOD_MONSTER, img: null })).toEqual([]);
    });

    it("rejette : sans id, img non-chaîne, sans grades", () => {
        expect(checkMonsterContract({ img: "x", grades: [] })).toHaveLength(1);
        expect(checkMonsterContract({ id: 1, img: 42, grades: [] })).toHaveLength(1);
        expect(checkMonsterContract({ id: 1 })).toHaveLength(1);
        expect(checkMonsterContract(null)).toHaveLength(2);
    });
});

describe("assertDatasetContract", () => {
    it("passe sur échantillon conforme", () => {
        expect(() =>
            assertDatasetContract({ dungeons: [GOOD_DUNGEON], races: [GOOD_RACE], sampleMonster: GOOD_MONSTER })
        ).not.toThrow();
    });

    it("throw avec le détail sur champ renommé", () => {
        expect(() =>
            assertDatasetContract({
                dungeons: [{ identifier: 1, name: { fr: "x" }, monsters: [] }],
                races: [GOOD_RACE],
                sampleMonster: GOOD_MONSTER,
            })
        ).toThrow(/dungeons\[\]\.id/);
    });
});
