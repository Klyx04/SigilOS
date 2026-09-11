import { describe, it, expect } from "vitest";
import {
    CHAR_NAMES,
    BOOK_STAT_NAMES,
    STAT_ICON_SPECS,
    toNativeEffects,
    resolveNativeEffects,
    getStatLabel,
    resolveStatIconSpec,
    isPercentStat,
    formatStatValue,
    findNativeRange,
    isNativeEffect,
    buildNativeStatDrafts,
    EXO_EFFECT_PRESETS,
    buildExoStatDraft,
    type MarketNativeEffect,
} from "@/lib/market/effects";

/**
 * Module « Marché » — référentiel d'effets pur (S2.4 / S2.5bis).
 * Ces tests verrouillent le comportement du module partagé qui remplace les
 * maps historiquement enfermées dans `ItemSearchPanel`.
 */
describe("effects — référentiel pur", () => {
    it("CHAR_NAMES / BOOK_STAT_NAMES / STAT_ICON_SPECS exposent les tables partagées", () => {
        expect(CHAR_NAMES[11]).toBe("Vitalité");
        expect(BOOK_STAT_NAMES.vi).toBe("Vitalité");
        expect(STAT_ICON_SPECS["11"]).toEqual({ icon: "heart", color: "text-danger" });
    });

    it("getStatLabel priorise le référentiel data-driven", () => {
        expect(getStatLabel({ characteristic: 11 }, { 11: "Vitalité (base)" })).toBe("Vitalité (base)");
    });

    it("getStatLabel retombe sur int_name puis CHAR_NAMES puis « Effet »", () => {
        expect(getStatLabel({ int_name: "vi" })).toBe("Vitalité");
        expect(getStatLabel({ characteristic: 16 })).toBe("Force");
        expect(getStatLabel({ effectId: 999_999 })).toBe("Effet");
    });
});

describe("effects — parsing des effets natifs", () => {
    it("toNativeEffects mappe les formes tolérantes et filtre les ids invalides", () => {
        const result = toNativeEffects({
            effects: [
                { effectId: 96, characteristic: 16, from: 1, to: 3 },
                { int_id: 0, from: 1, to: 2 },
                { effectId: 10, characteristic: 11, from: 251, to: 300 },
            ],
        });
        expect(result).toHaveLength(2);
        expect(result?.[0]).toMatchObject({ effectId: 96, from: 1, to: 3 });
        expect(result?.[1]).toMatchObject({ effectId: 10, characteristic: 11 });
    });

    it("toNativeEffects renvoie null pour une entrée vide", () => {
        expect(toNativeEffects(null)).toBeNull();
        expect(toNativeEffects({ effects: [] })).toBeNull();
    });

    /**
     * S2.12 — filet de sécurité : les effets stockés AVANT l'ajout de la colonne
     * `nativeEffects` sont en forme BRUTE DofusDB (`diceNum`/`diceSide`). Sans
     * cette tolérance, l'éditeur FM afficherait « aucun effet natif ».
     * Valeurs réelles de l'Anneau du Cycloïde (cf. diagnostic B2).
     */
    it("toNativeEffects tolère la forme BRUTE DofusDB (diceNum/diceSide)", () => {
        const result = toNativeEffects({
            effects: [
                { effectId: 125, characteristic: 11, diceNum: 251, diceSide: 300 },
                { effectId: 96, characteristic: 16, diceNum: 31, diceSide: 40 },
                { effectId: 174, characteristic: 48, diceNum: 6, diceSide: 8 },
            ],
        });
        expect(result).toHaveLength(3);
        expect(result?.[0]).toMatchObject({ effectId: 125, from: 251, to: 300 });
        expect(result?.[1]).toMatchObject({ effectId: 96, from: 31, to: 40 });
        expect(result?.[2]).toMatchObject({ characteristic: 48, from: 6, to: 8 });
    });

    /**
     * S2.12 — filet centralisé utilisé par les lecteurs catalogue : la colonne
     * `nativeEffects` est prioritaire, sinon on dérive de `effects` bruts.
     */
    it("resolveNativeEffects privilégie la colonne, sinon dérive de `effects`", () => {
        const stored: MarketNativeEffect[] = [
            { effectId: 10, characteristic: 11, from: 1, to: 2, category: null, elementId: null },
        ];
        expect(resolveNativeEffects({ nativeEffects: stored, effects: null })).toEqual(stored);

        const derived = resolveNativeEffects({
            nativeEffects: null,
            effects: [{ effectId: 125, characteristic: 11, diceNum: 251, diceSide: 300 }],
        });
        expect(derived?.[0]).toMatchObject({ effectId: 125, from: 251, to: 300 });

        // Colonne vide ET effets illisibles → null (l'appelant retombe sur « libre »).
        expect(resolveNativeEffects({ nativeEffects: [], effects: [] })).toBeNull();
        expect(resolveNativeEffects(null)).toBeNull();
    });
});

describe("effects — plages natives (source serveur)", () => {
    const natives: MarketNativeEffect[] = [
        { effectId: 10, characteristic: 11, from: 251, to: 300, category: null, elementId: null },
        { effectId: 96, characteristic: 16, from: 1, to: 3, category: null, elementId: null },
    ];

    it("findNativeRange retrouve par effectId puis par characteristic", () => {
        expect(findNativeRange(natives, { effectId: 10 })).toEqual({ from: 251, to: 300 });
        expect(findNativeRange(natives, { effectId: 4242, characteristic: 16 })).toEqual({ from: 1, to: 3 });
        expect(findNativeRange(natives, { effectId: 4242, characteristic: 999 })).toBeNull();
    });

    it("isNativeEffect distingue natif et exo", () => {
        expect(isNativeEffect(natives, { effectId: 10 })).toBe(true);
        expect(isNativeEffect(natives, { effectId: 111, characteristic: 1 })).toBe(false);
    });

    it("buildNativeStatDrafts pré-remplit chaque ligne avec le max natif", () => {
        const drafts = buildNativeStatDrafts(natives);
        expect(drafts).toHaveLength(2);
        expect(drafts[0]).toMatchObject({ effectId: 10, label: "Vitalité", actualValue: 300, origin: "NATIVE" });
        expect(drafts[1]).toMatchObject({ effectId: 96, actualValue: 3 });
    });
});

describe("effects — exos & formatage", () => {
    it("EXO_EFFECT_PRESETS couvre PA / PM / PO / invocation", () => {
        expect(EXO_EFFECT_PRESETS.map((p) => p.key)).toEqual(["pa", "pm", "po", "invocation"]);
    });

    it("buildExoStatDraft construit une ligne EXO sans plage native", () => {
        const draft = buildExoStatDraft(EXO_EFFECT_PRESETS[0], 2);
        expect(draft).toMatchObject({ label: "PA", origin: "EXO", naturalMin: null, naturalMax: null, actualValue: 2 });
    });

    it("resolveStatIconSpec résout par id et par code court", () => {
        expect(resolveStatIconSpec(11)).toMatchObject({ icon: "heart" });
        expect(resolveStatIconSpec(null, "po")).toMatchObject({ icon: "eye" });
        expect(resolveStatIconSpec(999_999)).toBeNull();
    });

    it("isPercentStat détecte le symbole et le mot « pourcent »", () => {
        expect(isPercentStat("Résistance Feu (%)")).toBe(true);
        expect(isPercentStat("Pourcentage de dommages")).toBe(true);
        expect(isPercentStat("Vitalité")).toBe(false);
        expect(isPercentStat(null)).toBe(false);
    });

    it("formatStatValue signe et suffixe le « % » si nécessaire", () => {
        expect(formatStatValue(12)).toBe("+12");
        expect(formatStatValue(-3)).toBe("-3");
        expect(formatStatValue(12, "Résistance Eau (%)")).toBe("+12 %");
    });
});
