import { describe, it, expect } from "vitest";
import {
    scaleDamageDice,
    scaleUnityDamageLine,
    parseInvocationId,
    resolveInvocationLabel,
    parseSpellLevelConditions,
    describeSpellLevelConditions,
    parseDropRange,
} from "@/lib/monster-spell-levels";
import {
    COMBAT_SPELLS_PAYLOAD_VERSION,
    mergeDofensiveSpells,
} from "@/lib/dofensive-spells";
import { pickDofensiveMonsterIdStrict } from "@/lib/dofensive-boss";

/**
 * Lot 6 « sorts étrangers » — garde fail-closed + siphon spell-levels.
 *
 * Vérités terrain (DofusDB, Mureine 8333, stat 800) :
 * 71-80 → 639-720 · 121-130 → 1089-1170 · 81-90 → 729-810.
 */
describe("lot 6 — dégâts calculés dés × stats", () => {
    it("formule validée sur les 3 sorts de la Mureine", () => {
        expect(scaleDamageDice(71, 80, 800)).toEqual({ min: 639, max: 720 });
        expect(scaleDamageDice(121, 130, 800)).toEqual({ min: 1089, max: 1170 });
        expect(scaleDamageDice(81, 90, 800)).toEqual({ min: 729, max: 810 });
    });

    it("fail-closed : négatifs, NaN, max < min", () => {
        expect(scaleDamageDice(-1, 80, 800)).toBeNull();
        expect(scaleDamageDice(71, 80, -5)).toBeNull();
        expect(scaleDamageDice(Number.NaN, 80, 800)).toBeNull();
        expect(scaleDamageDice(90, 80, 800)).toBeNull();
    });

    it("lignes Unity → gammes calculées", () => {
        const stats = { earth: 800, fire: 800, water: 800, air: 800 };
        expect(scaleUnityDamageLine("71 à 80 dommages Eau", stats)).toBe("639 à 720 dommages Eau");
        expect(scaleUnityDamageLine("121 à 130 dommages Terre", stats)).toBe("1089 à 1170 dommages Terre");
        // Élément inconnu / stats absentes ⇒ origine intacte (jamais inventé).
        expect(scaleUnityDamageLine("71 à 80 dommages Glace", stats)).toBe("71 à 80 dommages Glace");
        expect(scaleUnityDamageLine("71 à 80 dommages Eau", null)).toBe("71 à 80 dommages Eau");
        expect(scaleUnityDamageLine("Invoque : 8334", stats)).toBe("Invoque : 8334");
    });
});

describe("lot 6 — invocations résolues, jamais d'id nu", () => {
    it("parse + résolution via annuaire injecté", () => {
        expect(parseInvocationId("Invoque : 8334")).toBe(8334);
        expect(parseInvocationId("71 à 80 dommages Eau")).toBeNull();
        expect(resolveInvocationLabel("Invoque : 8334", (id) => (id === 8334 ? "Murare" : null))).toBe(
            "Invoque : Murare"
        );
        // Sans nom résolu ⇒ brut d'origine (pas de vide).
        expect(resolveInvocationLabel("Invoque : 8334", () => null)).toBe("Invoque : 8334");
    });
});

describe("lot 6 — conditions de lancer", () => {
    it("Disperssssion (niveau 84765) : sans LdV + cellule occupée", () => {
        const conditions = parseSpellLevelConditions({
            needTakenCell: true,
            needFreeCell: false,
            castTestLos: false,
            castInLine: false,
            castInDiagonal: false,
        });
        expect(describeSpellLevelConditions(conditions)).toEqual([
            "Ne nécessite pas de ligne de vue",
            "Nécessite une cellule occupée",
        ]);
    });

    it("défauts sûrs sur niveau vide", () => {
        expect(describeSpellLevelConditions(parseSpellLevelConditions(null))).toEqual([]);
        expect(describeSpellLevelConditions(parseSpellLevelConditions({}))).toEqual([]);
    });
});

describe("lot 6 — drops à critères", () => {
    it("fragment Mureine : 1 → 20 %", () => {
        expect(parseDropRange({ minPercentDrop: 1, maxPercentDrop: 20 })).toEqual({ min: 1, max: 20 });
        expect(parseDropRange({})).toBeNull();
    });
});

describe("lot 6 — garde d'appartenance Dofensive", () => {
    const dbSpells = [{ id: 32239 }, { id: 32240 }, { id: 32241 }];
    const foreign = [
        { id: 99991, name: "Rouge et Noir" },
        { id: 99992, name: "Négativisme" },
    ];

    it("résolution stricte : jamais de repli boss étranger", () => {
        const monsters = [
            { id: 111, name: "Autre Boss" },
            { id: 222, name: "Sbire" },
        ];
        expect(pickDofensiveMonsterIdStrict(monsters, "Mureine")).toBeNull();
        expect(pickDofensiveMonsterIdStrict(monsters, "Autre Boss")).toBe(111);
        expect(pickDofensiveMonsterIdStrict(monsters, "sbire")).toBe(222);
        expect(pickDofensiveMonsterIdStrict([], "Mureine")).toBeNull();
    });

    it("fusion : sorts étrangers écartés quand l'ensemble légitime est fourni", () => {
        const merged = mergeDofensiveSpells(dbSpells as any, foreign as any, [32239, 32240, 32241]);
        // Les étrangers sont écartés, les sorts DB légitimes restent.
        expect(merged.map((s: any) => s.id)).toEqual([32239, 32240, 32241]);
    });

    it("fusion : comportement historique sans ensemble (aucune régression)", () => {
        const merged = mergeDofensiveSpells(dbSpells as any, foreign as any);
        expect(merged.map((s: any) => s.id)).toEqual([99991, 99992, 32239, 32240, 32241]);
    });

    it("fusion : le passif légitime survit à la garde", () => {
        const passive = [{ id: 32242, name: "Impératrice" }];
        const merged = mergeDofensiveSpells(dbSpells as any, passive as any, [32239, 32240, 32241, 32242]);
        expect(merged.map((s: any) => s.id)).toEqual([32242, 32239, 32240, 32241]);
    });

    it("version du payload : v5 (réparation des lignes antérieures)", () => {
        expect(COMBAT_SPELLS_PAYLOAD_VERSION).toBe(5);
    });
});
