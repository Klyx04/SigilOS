import { describe, it, expect } from "vitest";
import {
    computeSpellDamage,
    elementFromDofusdb,
    elementStatFor,
    fixedDamageForElement,
    percentDamageFor,
    spellDamageFromEffect,
    statsFromDofusdb,
    applyBuild,
    type BuildStatsForSpells,
} from "@/lib/dofus-spells";

// Build de test : un personnage mono-intelligence (Feu), Puissance 100.
const build: BuildStatsForSpells = {
    elements: { fo: 0, in: 300, ch: 0, ag: 0, sa: 0, pu: 100 },
    damages: {
        neutre: 0, terre: 0, feu: 50, eau: 0, air: 0,
        general: 0, critique: 0, poussee: 0,
        armes: 0, sorts: 20, melee: 0, distance: 0,
    },
};

describe("elementFromDofusdb", () => {
    it("mappe les ids DofusDB vers les éléments Dofus", () => {
        expect(elementFromDofusdb(1)).toBe("terre");
        expect(elementFromDofusdb(2)).toBe("feu");
        expect(elementFromDofusdb(3)).toBe("eau");
        expect(elementFromDofusdb(4)).toBe("air");
        expect(elementFromDofusdb(5)).toBe("neutre");
        expect(elementFromDofusdb(null)).toBe("neutre");
    });
});

describe("elementStatFor", () => {
    it("retourne la bonne stat élémentaire", () => {
        expect(elementStatFor(build.elements, "terre")).toBe(0);
        expect(elementStatFor(build.elements, "feu")).toBe(300);
        expect(elementStatFor(build.elements, "neutre")).toBe(0);
    });
});

describe("fixedDamageForElement", () => {
    it("retourne la ligne de dommages fixes de l'élément", () => {
        expect(fixedDamageForElement(build.damages, "feu")).toBe(50);
        expect(fixedDamageForElement(build.damages, "neutre")).toBe(0);
    });
});

describe("percentDamageFor", () => {
    it("additionne % Do Sorts + % Mêlée/Distance (sans le plateau « Dommages »)", () => {
        const d = build.damages;
        expect(percentDamageFor(d, "sorts")).toBe(20);
        expect(percentDamageFor(d, "melee")).toBe(20);
        expect(percentDamageFor(d, "distance")).toBe(20);
        // `general` est un bonus FIXE (plateau), pas un % : il n'est pas ajouté ici.
        expect(percentDamageFor({ ...d, general: 30 }, "sorts")).toBe(20);
        expect(percentDamageFor({ ...d, melee: 10 }, "melee")).toBe(30);
    });
});

describe("statsFromDofusdb", () => {
    it("décode la map de caractéristiques DofusDB (stuffs/{id}) en stats de build", () => {
        const b = statsFromDofusdb({
            "10": 450, "11": 4535, "12": 410, "13": 1000, "14": 500, "15": 550, "25": 350,
            "16": 5, "88": 85, "89": 100, "90": 130, "91": 90, "92": 85,
            "84": 0, "86": 39, "120": 0, "122": 0, "123": 0, "125": 0,
        });
        expect(b.elements.fo).toBe(450);
        expect(b.elements.in).toBe(550);
        expect(b.elements.ch).toBe(1000);
        expect(b.elements.ag).toBe(500);
        expect(b.elements.pu).toBe(350);
        expect(b.damages.terre).toBe(85);
        expect(b.damages.feu).toBe(100);
        expect(b.damages.eau).toBe(130);
        expect(b.damages.air).toBe(90);
        expect(b.damages.neutre).toBe(85);
        expect(b.damages.general).toBe(5); // « Dommages » (plateau, id 16)
        expect(b.damages.sorts).toBe(0);   // % Do Sorts (id 123)
        expect(b.damages.melee).toBe(0);   // % Do Mêlée (id 125)
        expect(b.damages.distance).toBe(0);// % Do Distance (id 120)
        expect(b.damages.armes).toBe(0);   // % Do Armes (id 122)
    });

    it("retourne 0 pour les ids absents", () => {
        const b = statsFromDofusdb({ "25": 100 });
        expect(b.elements.fo).toBe(0);
        expect(b.elements.pu).toBe(100);
        expect(b.damages.eau).toBe(0);
    });
});

describe("applyBuild", () => {
    it("applique la stat + Puissance au jet, ajoute les dommages fixes, puis applique le %dommages", () => {
        // Base 60, Intel 300, Puissance 100 -> Stat effective = 400 (x5.0)
        // Dégâts bruts = floor(60 * 5.0) + 50 = 300 + 50 = 350
        // Dégâts finaux = floor(350 * 1.2) = 420
        expect(applyBuild(60, 300, 50, 20, 100)).toBe(420);
    });
});

describe("computeSpellDamage", () => {
    it("calcule dégâts théoriques non-crit et critique", () => {
        const res = computeSpellDamage(
            { min: 50, max: 70, element: "feu", grade: 6 },
            build,
            "distance",
            1.5
        );
        // stat 300 + puiss 100 → ×5.0 ; fixe 50 ; %do dist = 20 (×1.2)
        // min: (floor(50×5.0)+50)×1.2 = (250+50)×1.2 = 360
        // max: (floor(70×5.0)+50)×1.2 = (350+50)×1.2 = 480
        expect(res.baseMin).toBe(50);
        expect(res.baseMax).toBe(70);
        expect(res.elementStat).toBe(300);
        expect(res.theoMin).toBe(360);
        expect(res.theoMax).toBe(480);
        expect(res.critMin).toBe(540); // 360 * 1.5
        expect(res.critMax).toBe(720); // 480 * 1.5
    });

    it("calcule exactement le cas Huppermage lvl 110 sur Déluge grade 2 (conforme Dofusbook / DofusDB)", () => {
        const hupperBuild: BuildStatsForSpells = {
            elements: { fo: 80, in: 90, ch: 710, ag: 15, sa: 195, pu: 250 },
            damages: {
                neutre: 6, terre: 6, feu: 7, eau: 33, air: 0,
                general: 44, critique: 10, poussee: 0,
                armes: 0, sorts: 0, melee: 0, distance: 0,
            },
        };

        // Déluge Grade 2 : Base 22-24 Eau, Crit 26-29 Eau
        const res = computeSpellDamage(
            { min: 22, max: 24, element: "eau", grade: 2 },
            hupperBuild,
            "distance",
            1.5,
            { min: 26, max: 29 }
        );

        // Non-crit : floor(22 * 10.60) + 77 = 233 + 77 = 310
        // Non-crit max : floor(24 * 10.60) + 77 = 254 + 77 = 331
        expect(res.theoMin).toBe(310);
        expect(res.theoMax).toBe(331);

        // Crit : floor(26 * 10.60) + 77 + 10 = 275 + 87 = 362
        // Crit max : floor(29 * 10.60) + 77 + 10 = 307 + 87 = 394
        expect(res.critMin).toBe(362);
        expect(res.critMax).toBe(394);
    });
});

describe("spellDamageFromEffect", () => {
    it("extrait min/max depuis diceNum/diceSide (effect DofusDB dégât)", () => {
        const dmg = spellDamageFromEffect({
            effectId: 92, // dégât Feu
            effectElement: 2,
            diceNum: 8,
            diceSide: 12,
            grade: 3,
        });
        expect(dmg).not.toBeNull();
        expect(dmg?.min).toBe(8);
        expect(dmg?.max).toBe(12);
        expect(dmg?.element).toBe("feu");
    });

    it("ignore un effect qui n'est pas un dégât direct", () => {
        const dmg = spellDamageFromEffect({ effectId: 115, diceNum: 1, diceSide: 2 }); // % Critique
        expect(dmg).toBeNull();
    });

    it("tolère le format formatted « 10 à 18 »", () => {
        const dmg = spellDamageFromEffect({ effectId: 91, effectElement: 1, formatted: "Dommages Terre : 10 à 18" });
        expect(dmg?.min).toBe(10);
        expect(dmg?.max).toBe(18);
        expect(dmg?.element).toBe("terre");
    });

    it("retourne null pour un effect vide", () => {
        expect(spellDamageFromEffect(null)).toBeNull();
        expect(spellDamageFromEffect({})).toBeNull();
    });
});
