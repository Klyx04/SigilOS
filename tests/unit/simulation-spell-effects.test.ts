/**
 * Effets de sort **en simulation** — la poussée doit arriver jusqu'à la grille.
 *
 * 📏 Mesure du 23/10/2026 : « je prends Météore : c'est censé afficher la preview de poussée
 * non ? » — le siphon des sorts de classe ne gardait que les dégâts, donc
 * `classifySpellEffects` ne trouvait aucune poussée et la grille ne traçait rien.
 *
 * 🔒 Verrouillé ici : extraction des ids DofusDB (repousse/attire), fusion sans doublon de
 * dégâts, et le fait que le résultat soit **classifiable** (c'est ce que consomme la grille).
 */
import { describe, it, expect } from "vitest";

import {
    pushPullEffectsFromDofusDb,
    mergeSimulationEffectDetails,
    type SpellBaseDamage,
} from "@/lib/dofus-spells";
import { classifySpellEffects } from "@/lib/dofus-spell-effects";

const damageLine = {
    label: "Dommages Feu",
    duration: null,
    triggers: [] as string[],
    masks: [] as string[],
    damage: { element: "feu" as const, min: 20, max: 25 },
    pushDistance: null,
};

describe("pushPullEffectsFromDofusDb — ids officiels DofusDB", () => {
    it("reconnaît une repousse (4/5) et sa distance", () => {
        expect(pushPullEffectsFromDofusDb([{ effectId: 5, diceNum: 3 }])).toEqual([
            { label: "Repousse de 3", pushDistance: 3 },
        ]);
        expect(pushPullEffectsFromDofusDb([{ effectId: 4, diceNum: 1 }])).toEqual([
            { label: "Repousse de 1", pushDistance: 1 },
        ]);
    });

    it("reconnaît une attirance (6/8)", () => {
        expect(pushPullEffectsFromDofusDb([{ effectId: 6, diceNum: 2 }])).toEqual([
            { label: "Attire de 2", pushDistance: 2 },
        ]);
        expect(pushPullEffectsFromDofusDb([{ effectId: 8, diceNum: 4 }])).toEqual([
            { label: "Attire de 4", pushDistance: 4 },
        ]);
    });

    it("prend la distance de `zoneDescr.param1` quand `diceNum` est absent", () => {
        expect(pushPullEffectsFromDofusDb([{ effectId: 5, zoneDescr: { param1: 2 } }])).toEqual([
            { label: "Repousse de 2", pushDistance: 2 },
        ]);
    });

    it("ignore les autres effets et les distances nulles (aucune invention)", () => {
        expect(pushPullEffectsFromDofusDb([{ effectId: 91, diceNum: 30 }])).toEqual([]);
        expect(pushPullEffectsFromDofusDb([{ effectId: 5, diceNum: 0 }])).toEqual([]);
        expect(pushPullEffectsFromDofusDb(null)).toEqual([]);
    });
});

describe("mergeSimulationEffectDetails — dégâts du build + effets du sort", () => {
    it("ajoute la poussée du sort aux lignes de dégâts recalculées", () => {
        const merged = mergeSimulationEffectDetails([damageLine], {
            effectDetails: [
                { label: "Repousse de 3", duration: null, triggers: [], masks: [], damage: null, pushDistance: 3 },
            ],
        });

        expect(merged).toHaveLength(2);
        expect(merged[0]).toMatchObject({ label: "Dommages Feu" });
        expect(merged[1]).toMatchObject({ label: "Repousse de 3", pushDistance: 3 });

        // 🎯 L'acceptation réelle : la grille doit pouvoir classer cette poussée.
        const effects = classifySpellEffects(merged);
        const push = effects.find((e) => e.kind === "push");
        expect(push).toBeDefined();
        expect(push?.distance).toBe(3);
    });

    it("ne duplique jamais une ligne de dégâts (le build fait foi)", () => {
        const merged = mergeSimulationEffectDetails([damageLine], {
            effectDetails: [
                { label: "Dommages Feu", duration: null, triggers: [], masks: [], damage: { element: "feu", min: 10, max: 12 }, pushDistance: null },
            ],
        });
        expect(merged).toHaveLength(1);
        expect(merged[0].damage).toMatchObject({ min: 20, max: 25 });
    });

    it("garde la poussée d'une ligne mixte, sans ses dégâts", () => {
        const merged = mergeSimulationEffectDetails([damageLine], {
            effectDetails: [
                { label: "Dommages Feu + Repousse de 2", duration: null, triggers: [], masks: [], damage: { element: "feu", min: 99, max: 99 }, pushDistance: 2 },
            ],
        });
        const pushLine = merged.find((l) => l.pushDistance === 2);
        expect(pushLine).toBeDefined();
        expect(pushLine?.damage).toBeNull();
        // Aucun dégât supplémentaire n'entre dans la prévisu.
        expect(merged.filter((l) => l.damage)).toHaveLength(1);
    });

    it("déduplique et tolère un sort sans effet structuré", () => {
        const merged = mergeSimulationEffectDetails(
            [damageLine],
            { effectDetails: [{ label: "Repousse de 3", duration: null, triggers: [], masks: [], damage: null, pushDistance: 3 }] }
        );
        const twice = mergeSimulationEffectDetails(merged, {
            effectDetails: [{ label: "Repousse de 3", duration: null, triggers: [], masks: [], damage: null, pushDistance: 3 }],
        });
        expect(twice).toHaveLength(2);
        expect(mergeSimulationEffectDetails([damageLine], null)).toHaveLength(1);
        expect(mergeSimulationEffectDetails([damageLine], {})).toHaveLength(1);
    });
});


describe("glyphes & pièges — identifiés, jamais chiffrés au hasard", () => {
    it("classe un glyphe comme glyphe, même s'il retire des PA", () => {
        // Un glyphe peut aussi dire « retire 1 PA » : l'identité « glyphe » doit gagner, sinon
        // le badge affichait un effet PA et l'on perdait la nature au sol du sort.
        const effects = classifySpellEffects(["Glyphe : retire 1 PA aux cibles dans la zone"]);
        expect(effects.map((e) => e.kind)).toContain("glyph");
    });

    it("classe un piège comme piège", () => {
        const [effect] = classifySpellEffects(["Pose un piège sur la case visée"]);
        expect(effect.kind).toBe("trap");
    });

    it("ne confond pas un sort de dégâts classique avec un glyphe", () => {
        const kinds = classifySpellEffects([damageLine.label]).map((e) => e.kind);
        expect(kinds).not.toContain("glyph");
        expect(kinds).not.toContain("trap");
    });
});

describe("sorts à charge — détection depuis la description officielle", () => {
    /** Même expression que la fiche de simulation : une seule source, testée ici. */
    const chargeBased = (description: string) => /charge|torrent\s*[123]|glas/i.test(description);

    it("reconnaît Glas du Xelor et Torrent", () => {
        expect(chargeBased("Glas : en fonction du nombre de charges")).toBe(true);
        expect(chargeBased("Torrent 2")).toBe(true);
        expect(chargeBased("Torrent 3")).toBe(true);
    });

    it("laisse tranquille un sort sans charge", () => {
        expect(chargeBased("Météore : inflige des dommages Feu dans la zone")).toBe(false);
    });
});
