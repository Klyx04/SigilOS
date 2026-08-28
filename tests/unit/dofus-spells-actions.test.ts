import { describe, it, expect, vi, beforeEach } from "vitest";
import { getClassSpells } from "@/server/actions/dofus-spells-actions";
import * as dofusdbFetchModule from "@/lib/dofusdb-fetch";

// Mock du module de transport : on contrôle la "donnée DofusDB" sans réseau.
vi.mock("@/lib/dofusdb-fetch", () => ({
    dofusdbFetch: vi.fn(),
}));

const mockedDofusdbFetch = dofusdbFetchModule.dofusdbFetch as unknown as ReturnType<typeof vi.fn>;

// Un sort de classe (Cra) : name/description en objets L10n, img, spellLevels.
const CRA_SPELL = {
    id: 10591,
    name: { fr: "Flèche Magique", en: "Magic Arrow" },
    description: { fr: "Inflige des dommages Feu." },
    img: "https://api.dofusdb.fr/img/spells/sort_10591.png",
    spellLevels: [100001],
};

// Le breed Cra (DofusDB) liant la classe à ses sorts via `breedSpellsId`.
const CRA_BREED = {
    id: 9,
    shortName: { fr: "Crâ" },
    breedSpellsId: [10591],
};

// Le niveau résolu du grade max : dégâts 8-12 Feu (effectId 92 = dégât Feu).
// Champs réels DofusDB (`range`, `criticalHitProbability`, `grade`, `previewZones`).
const CRA_LEVEL = {
    id: 100001,
    grade: 6,
    apCost: 3,
    minRange: 8,
    range: 24,
    criticalHitProbability: 5,
    previewZones: [{ size: 1, range: 24 }],
    effects: [
        { effectId: 92, effectElement: 2, diceNum: 8, diceSide: 12 },
    ],
};

describe("getClassSpells — onglet Sorts (dofusbook)", () => {
    beforeEach(() => {
        mockedDofusdbFetch.mockReset();
    });

    it("refuse une classe hors bornes sans appel réseau", async () => {
        const res = await getClassSpells(0);
        expect(res.success).toBe(false);
        expect(mockedDofusdbFetch).not.toHaveBeenCalled();
    });

    it("résout les sorts via /breeds (breedSpellsId) puis /spells + /spell-levels", async () => {
        mockedDofusdbFetch.mockImplementation((path: string) => {
            if (path.startsWith("/breeds?")) {
                return Promise.resolve([CRA_BREED]);
            }
            if (path.startsWith("/spells?")) {
                return Promise.resolve([CRA_SPELL]);
            }
            if (path.startsWith("/spell-levels?")) {
                return Promise.resolve([CRA_LEVEL]);
            }
            return Promise.resolve([]);
        });

        const res = await getClassSpells(9);
        expect(res.success).toBe(true);
        expect(res.data?.classId).toBe(9);
        expect(res.data?.className).toBe("Crâ"); // rempli via getClassName

        const spell = res.data?.spells[0];
        expect(spell?.id).toBe(10591);
        expect(spell?.name).toBe("Flèche Magique"); // L10n résolu
        expect(spell?.imageUrl).toBe("https://api.dofusdb.fr/img/spells/sort_10591.png"); // img → imageUrl
        expect(spell?.apCost).toBe(3);
        expect(spell?.maxRange).toBe(24); // `range` DofusDB → maxRange
        expect(spell?.criticalChance).toBe(5); // `criticalHitProbability`
        expect(spell?.grade).toBe(6); // `grade` DofusDB (alias level)

        // Dégât direct extrait (effectId 92, diceNum 8, diceSide 12, élement Feu).
        expect(spell?.damages).toHaveLength(1);
        expect(spell?.damages[0]).toMatchObject({ min: 8, max: 12, element: "feu", grade: 6 });

        // Les variantes (grades) accessibles sont exposées pour le sélecteur « 1 2 3 ».
        expect(spell?.grades).toHaveLength(1);
        expect(spell?.grades?.[0].grade).toBe(6);
        expect(spell?.grades?.[0].damages[0]).toMatchObject({ min: 8, max: 12, element: "feu", grade: 6 });
    });

    it("retourne une liste vide (pas d'erreur) si aucune donnée DofusDB", async () => {
        mockedDofusdbFetch.mockResolvedValue([]);
        const res = await getClassSpells(9);
        expect(res.success).toBe(true);
        expect(res.data?.spells).toHaveLength(0);
    });
});
