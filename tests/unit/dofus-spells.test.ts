import { describe, it, expect } from "vitest";
import {
    computeSpellDamage,
    castsPerTarget,
    castsPerTurn,
    elementFromDofusdb,
    elementStatFor,
    fixedDamageForElement,
    percentDamageFor,
    spellDamageFromEffect,
    spellZoneFromDamages,
    spellZoneShapeFromLetter,
    pickGradeForLevel,
    applyCharLevelToSpells,
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

describe("castsPerTarget / castsPerTurn (limites de lancer Dofusbook)", () => {
    it("plafonne la cible au tour (min des deux quand les deux sont bornés)", () => {
        expect(castsPerTarget(2, 3)).toBe(2);
        expect(castsPerTarget(3, 2)).toBe(2);
        expect(castsPerTurn(3)).toBe(3);
    });

    it("retombe sur la seule borne définie", () => {
        expect(castsPerTarget(2, 0)).toBe(2);
        expect(castsPerTarget(0, 0)).toBeNull();
        expect(castsPerTurn(0)).toBeNull();
    });

    it("vaut 1 par cible quand seul le tour est plafonné (référence par lancer)", () => {
        expect(castsPerTarget(0, 3)).toBe(1);
    });
});

describe("spellZoneShapeFromLetter / spellZoneFromDamages (zones AoE DofusDB)", () => {
    it("mappe les gabarits Ankama (même convention que toAnomalyZone)", () => {
        expect(spellZoneShapeFromLetter("P")).toBe("Point");
        expect(spellZoneShapeFromLetter("+")).toBe("Point");
        expect(spellZoneShapeFromLetter("C")).toBe("Cercle");
        expect(spellZoneShapeFromLetter("X")).toBe("Croix");
        expect(spellZoneShapeFromLetter("L")).toBe("Ligne");
        expect(spellZoneShapeFromLetter("V")).toBe("Cône");
        expect(spellZoneShapeFromLetter("O")).toBe("Inconnue");
        expect(spellZoneShapeFromLetter("")).toBe("Inconnue");
    });

    it("retient la première vraie AoE (ex. Torrent Arcanique = 4× Cercle 2)", () => {
        const lines = [
            { zone: { shape: "C", size: 2 } },
            { zone: { shape: "C", size: 2 } },
        ];
        expect(spellZoneFromDamages(lines)).toEqual({ shape: "Cercle", size: 2 });
    });

    it("vaut Point quand toutes les lignes sont monocibles", () => {
        expect(spellZoneFromDamages([{ zone: { shape: "P", size: 1 } }])).toEqual({ shape: "Point", size: 0 });
        expect(spellZoneFromDamages([{ zone: null }])).toEqual({ shape: "Point", size: 0 });
    });

    it("vaut null sans ligne de dégâts (sort utilitaire)", () => {
        expect(spellZoneFromDamages([])).toBeNull();
    });
});

describe("pickGradeForLevel / applyCharLevelToSpells (grimoire persisté)", () => {
    const grades = [
        { grade: 1, minPlayerLevel: 1, apCost: 3, minRange: 1, maxRange: 4, criticalChance: 5, maxCastPerTurn: 2, maxCastPerTarget: 0, minCastInterval: 0, zone: null, damages: [] },
        { grade: 2, minPlayerLevel: 100, apCost: 3, minRange: 1, maxRange: 5, criticalChance: 5, maxCastPerTurn: 2, maxCastPerTarget: 0, minCastInterval: 0, zone: null, damages: [] },
        { grade: 3, minPlayerLevel: 150, apCost: 2, minRange: 1, maxRange: 6, criticalChance: 10, maxCastPerTurn: 3, maxCastPerTarget: 0, minCastInterval: 0, zone: null, damages: [] },
    ];

    it("sélectionne le grade accessible le plus élevé (sinon le 1er)", () => {
        expect(pickGradeForLevel(grades, 200)?.grade).toBe(3);
        expect(pickGradeForLevel(grades, 110)?.grade).toBe(2);
        expect(pickGradeForLevel(grades, 1)?.grade).toBe(1);
        expect(pickGradeForLevel([], 200)).toBeNull();
    });

    it("re-dérive les champs de tête sans muter le stocké", () => {
        const stored = [{ id: 1, name: "X", grade: 3, apCost: 2, maxRange: 6, grades }];
        const at110 = applyCharLevelToSpells(stored as any, 110);
        expect(at110[0].grade).toBe(2);
        expect(at110[0].maxRange).toBe(5);
        expect(at110[0].apCost).toBe(3);
        // Stocké intact (canonique niv. 200).
        expect(stored[0].grade).toBe(3);
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

    it("capture la zone de la ligne depuis zoneDescr (ex. Torrent Arcanique Cercle 2)", () => {
        const dmg = spellDamageFromEffect({
            effectId: 99, // dégât Feu
            effectElement: 2,
            diceNum: 2,
            diceSide: 2,
            grade: 1,
            zoneDescr: { shape: 67, param1: 2, param2: 0 }, // 'C' = Cercle, taille 2
        });
        expect(dmg?.zone).toEqual({ shape: "C", size: 2 });
    });

    it("vaut zone null sans zoneDescr (rétro-compatibilité)", () => {
        const dmg = spellDamageFromEffect({ effectId: 92, effectElement: 2, diceNum: 8, diceSide: 12 });
        expect(dmg?.zone).toBeNull();
    });

    it("ignore un effect qui n'est pas un dégât direct", () => {
        const dmg = spellDamageFromEffect({ effectId: 115, diceNum: 1, diceSide: 2 }); // % Critique
        expect(dmg).toBeNull();
    });

    it("ignore le soin (effectId 108 « soins ») — sinon le TOTAL est gonflé", () => {
        // Vérifié sur l'API DofusDB : 108 = « #1 à #2 soins Feu », pas un dégât.
        const dmg = spellDamageFromEffect({ effectId: 108, effectElement: 2, diceNum: 30, diceSide: 34 });
        expect(dmg).toBeNull();
    });

    it("ignore le bonus de Portée (effectId 117 « +PO ») — sinon ligne Neutre fantôme", () => {
        // Vérifié sur l'API DofusDB : 117 = « #1 à #2 Portée ». Avant fix, +2 PO
        // devenait une fausse ligne « Neutre 2–2 » calculée avec les stats puis sommée au TOTAL.
        const dmg = spellDamageFromEffect({ effectId: 117, effectElement: 0, diceNum: 2, diceSide: 0 });
        expect(dmg).toBeNull();
    });

    it("garde le dommage neutre sans élément (effectId 112 « Dommage »)", () => {
        const dmg = spellDamageFromEffect({ effectId: 112, effectElement: 0, diceNum: 5, diceSide: 8 });
        expect(dmg).not.toBeNull();
        expect(dmg?.min).toBe(5);
        expect(dmg?.max).toBe(8);
        expect(dmg?.element).toBe("neutre");
    });

    it("garde les vols (91-95) comme lignes de dégâts uniques", () => {
        // Mot Vampirique (Eniripsa) : 91/elem 3 = Vol Eau 27–30 + 90 = soin (exclu).
        const steal = spellDamageFromEffect({ effectId: 91, effectElement: 3, diceNum: 27, diceSide: 30 });
        expect(steal?.min).toBe(27);
        expect(steal?.max).toBe(30);
        expect(steal?.element).toBe("eau");
        expect(spellDamageFromEffect({ effectId: 90, effectElement: 5, diceNum: 12, diceSide: 0 })).toBeNull();
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
