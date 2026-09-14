/**
 * Régression (14/09/2026, constat beta) — **« +15975 Effet »** sur la carte d'une
 * *Pestilence de Corruption* (`22412`), dans le bloc « Jet déclaré » et l'image OG.
 *
 * 📏 Cause **mesurée** (sonde `src/temp/_probe-effet-15975.mjs`, `api.dofusdb.fr`) :
 * `effectId` **1175** est un **porteur de capacité légendaire** — `diceNum` = id du
 * pouvoir (`15975` = « Nuée Pestilentielle »), `diceSide` = 1. DofusDB l'écarte
 * lui-même du tableau normalisé `effects` (**17** entrées brutes `possibleEffects`
 * / **16** `effects` sur `/items/22412`) ; notre siphon copiant la forme brute, la
 * ligne partait en déclaration puis s'affichait partout.
 *
 * Ce test verrouille la règle **pure** (une source de vérité) et sa portée :
 * siphon (`toNativeEffects`), lecture client (`enrichNativeEffects`), éditeur
 * (`buildNativeStatDrafts`) et lignes persistées (`isStatBearingStatRow`).
 */

import { describe, it, expect } from "vitest";
import {
    NON_STAT_EFFECT_IDS,
    buildNativeStatDrafts,
    enrichNativeEffects,
    isDisplayableNativeEffect,
    isNonStatNativeEffect,
    isStatBearingNativeEffect,
    isStatBearingStatRow,
    toNativeEffects,
    type MarketNativeEffect,
} from "@/lib/market/effects";

/** 17 lignes **brutes** DofusDB de `22412` (mesuré le 14/09/2026, base locale). */
const PESTILENCE_RAW = [
    { effectId: 125, baseEffectId: 5, diceNum: 351, diceSide: 400 },
    { effectId: 124, baseEffectId: 6, diceNum: 41, diceSide: 50 },
    { effectId: 138, baseEffectId: 22, diceNum: 61, diceSide: 70 },
    { effectId: 171, baseEffectId: 98, diceNum: 10, diceSide: 0 },
    { effectId: 182, baseEffectId: 23, diceNum: 2, diceSide: 0 },
    { effectId: 430, baseEffectId: 374, diceNum: 16, diceSide: 20 },
    { effectId: 422, baseEffectId: 365, diceNum: 16, diceSide: 20 },
    { effectId: 424, baseEffectId: 368, diceNum: 16, diceSide: 20 },
    { effectId: 426, baseEffectId: 370, diceNum: 16, diceSide: 20 },
    { effectId: 428, baseEffectId: 372, diceNum: 16, diceSide: 20 },
    { effectId: 214, baseEffectId: 74, diceNum: 3, diceSide: 5 },
    { effectId: 210, baseEffectId: 70, diceNum: 3, diceSide: 5 },
    { effectId: 211, baseEffectId: 71, diceNum: 3, diceSide: 5 },
    { effectId: 212, baseEffectId: 72, diceNum: 3, diceSide: 5 },
    { effectId: 753, baseEffectId: 344, diceNum: 16, diceSide: 20 },
    { effectId: 2803, baseEffectId: 450, diceNum: 3, diceSide: 5 },
    // 🧨 La ligne parasite : `diceNum` = **id du pouvoir légendaire**, pas un jet.
    { effectId: 1175, baseEffectId: 428, diceNum: 15975, diceSide: 1 },
];

/** Même item, forme **normalisée** (`nativeEffects`), 17 lignes dont le pouvoir. */
const PESTILENCE_NATIVE: MarketNativeEffect[] = PESTILENCE_RAW.map((fx) => ({
    effectId: fx.effectId,
    characteristic: null,
    from: fx.diceNum,
    to: fx.diceSide,
    category: null,
    elementId: null,
}));

describe("Règle pure — une ligne « pouvoir » n'est pas un jet", () => {
    it("identifie l'`effectId` 1175 (porteur de capacité légendaire)", () => {
        expect(NON_STAT_EFFECT_IDS).toContain(1175);
        expect(isNonStatNativeEffect({ effectId: 1175 })).toBe(true);
        expect(isNonStatNativeEffect({ effectId: 125 })).toBe(false);
        expect(isNonStatNativeEffect({ effectId: 2803 })).toBe(false);
    });

    it("`isDisplayableNativeEffect` compose les DEUX règles (métadonnée + pouvoir)", () => {
        // Métadonnée `0 → 0` (« Échangeable : ») : écartée depuis le 14/09.
        expect(isDisplayableNativeEffect({ effectId: 983, from: 0, to: 0 })).toBe(false);
        // Pouvoir légendaire : écarté ici.
        expect(isDisplayableNativeEffect({ effectId: 1175, from: 15975, to: 1 })).toBe(false);
        // Vraies stats : conservées (y compris valeur fixe et malus).
        expect(isDisplayableNativeEffect({ effectId: 125, from: 351, to: 400 })).toBe(true);
        expect(isDisplayableNativeEffect({ effectId: 182, from: 2, to: 0 })).toBe(true);
        expect(isDisplayableNativeEffect({ effectId: 171, from: -10, to: 0 })).toBe(true);
    });

    it("la règle « métadonnée » seule n'exclut pas 1175 (portées distinctes)", () => {
        expect(isStatBearingNativeEffect({ from: 15975, to: 1 })).toBe(true);
    });
});


describe("Siphon — `toNativeEffects` écarte la ligne pouvoir", () => {
    it("17 lignes brutes ⇒ 16 plages natives (aucune ligne 1175)", () => {
        const natives = toNativeEffects({ effects: PESTILENCE_RAW });
        expect(natives).toHaveLength(PESTILENCE_RAW.length - 1);
        expect(natives?.some((fx) => fx.effectId === 1175)).toBe(false);
        // Le reste est intact : la Mêlée (%) et les 15 autres lignes.
        expect(natives?.some((fx) => fx.effectId === 2803)).toBe(true);
        expect(natives?.find((fx) => fx.effectId === 125)).toMatchObject({ from: 351, to: 400 });
    });

    it("un item ne portant QUE le pouvoir ne produit aucune plage native", () => {
        expect(toNativeEffects({ effects: [PESTILENCE_RAW[16]] })).toBeNull();
    });
});

describe("Lecture client — `enrichNativeEffects` ne diffuse plus la ligne", () => {
    it("écarte 1175 et conserve les autres lignes", () => {
        const enriched = enrichNativeEffects(PESTILENCE_NATIVE, null);
        expect(enriched).not.toBeNull();
        expect(enriched).toHaveLength(PESTILENCE_NATIVE.length - 1);
        expect(enriched?.some((fx) => fx.effectId === 1175)).toBe(false);
        expect(enriched?.every((fx) => fx.from !== 15975)).toBe(true);
    });

    it("une liste réduite au pouvoir devient `null` (objet sans jet)", () => {
        expect(enrichNativeEffects([PESTILENCE_NATIVE[16]], null)).toBeNull();
    });
});

describe("Éditeur — `buildNativeStatDrafts` ne pré-remplit jamais un pouvoir", () => {
    it("16 lignes déclarables, aucune sur `effectId` 1175", () => {
        const drafts = buildNativeStatDrafts(PESTILENCE_NATIVE, null);
        expect(drafts).toHaveLength(PESTILENCE_NATIVE.length - 1);
        expect(drafts.some((draft) => draft.effectId === 1175)).toBe(false);
        expect(drafts.some((draft) => draft.actualValue === 15975)).toBe(false);
    });

    it("la Mêlée (%) reste déclarable (3 à 5, max natif)", () => {
        const drafts = buildNativeStatDrafts(PESTILENCE_NATIVE, null);
        expect(drafts.find((draft) => draft.effectId === 2803)).toMatchObject({
            naturalMin: 3,
            naturalMax: 5,
            actualValue: 5,
        });
    });
});

describe("Lignes persistées — `isStatBearingStatRow` (miroir, aucune migration)", () => {
    it("écarte une ligne 1175 déjà en base (annonce écrite avant la garde)", () => {
        expect(
            isStatBearingStatRow({
                effectId: 1175,
                naturalMin: 15975,
                naturalMax: 15975,
                actualValue: 15975,
            })
        ).toBe(false);
    });

    it("conserve les lignes légitimes (native, EXO, malus)", () => {
        expect(
            isStatBearingStatRow({ effectId: 2803, naturalMin: 3, naturalMax: 5, actualValue: 5 })
        ).toBe(true);
        expect(
            isStatBearingStatRow({ effectId: 101, naturalMin: null, naturalMax: null, actualValue: 1 })
        ).toBe(true);
        expect(
            isStatBearingStatRow({ effectId: 171, naturalMin: -10, naturalMax: 0, actualValue: -10 })
        ).toBe(true);
        // Métadonnée `0 → 0` (règle historique du matin) : toujours écartée.
        expect(
            isStatBearingStatRow({ effectId: 983, naturalMin: 0, naturalMax: 0, actualValue: 0 })
        ).toBe(false);
    });
});
