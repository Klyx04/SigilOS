import { describe, it, expect } from "vitest";
import {
    FM_DENSITY_CAP,
    FM_EFFECTS,
    FM_EFFECTS_BY_KEY,
    computeFmBudget,
    describeFmReadonly,
    fmDensity,
    getFmEffect,
    getFmStatus,
    maxOverFromRemaining,
    normalizeFmLabel,
    resolveFmEffectKey,
} from "@/lib/market/fm-effects";

/**
 * Module « Marché » — référentiel FM versionné (S2.12 / §12.8).
 * Ces tests verrouillent la grille de densités (donnée communautaire, jamais
 * dérivée de DofusDB) et l'étiquetage non bloquant des jets.
 */
describe("fm-effects — référentiel versionné", () => {
    it("expose les 52 lignes forgeables avec des clés/runes uniques", () => {
        expect(FM_EFFECTS).toHaveLength(52);
        expect(new Set(FM_EFFECTS.map((effect) => effect.key)).size).toBe(52);
        expect(new Set(FM_EFFECTS.map((effect) => effect.rune)).size).toBe(52);
        expect(FM_EFFECTS_BY_KEY.actionPoints.rune).toBe("Ga Pa");
        expect(getFmEffect("volumePoints")).toBeNull();
    });

    it("respecte maxOverSeul = ⌊101 / densité⌋ pour toutes les lignes", () => {
        for (const effect of FM_EFFECTS) {
            // Arme de chasse : propriété binaire d'arme, hors barème de densité.
            if (effect.key === "huntingWeapon") {
                expect(effect.maxOverStandalone).toBe(1);
                continue;
            }
            expect(effect.maxOverStandalone).toBe(
                Math.floor(FM_DENSITY_CAP / effect.unitWeight)
            );
        }
    });

    it("porte les densités communautaires de référence", () => {
        expect(getFmEffect("actionPoints")?.unitWeight).toBe(100);
        expect(getFmEffect("movementPoints")?.unitWeight).toBe(90);
        expect(getFmEffect("vitality")?.unitWeight).toBe(0.2);
        expect(getFmEffect("criticalHits")?.unitWeight).toBe(10);
        expect(getFmEffect("apReduction")?.unitWeight).toBe(7);
        expect(getFmEffect("meleeDamagePercent")?.unitWeight).toBe(15);
        expect(getFmEffect("waterResistancePercent")?.unitWeight).toBe(6);
        // PA/PM ne sont jamais « over » : on les ajoute (1 max), on ne les surforge pas.
        expect(getFmEffect("actionPoints")?.canOver).toBe(false);
        expect(getFmEffect("movementPoints")?.canOver).toBe(false);
        expect(getFmEffect("huntingWeapon")?.itemKind).toBe("weapon");
    });
});

describe("fm-effects — étiquetage (jamais bloquant, D34/D35)", () => {
    it("getFmStatus classe malus / exo / à vérifier / over / parfait / bon / faible", () => {
        const base = { nativeMin: 251, nativeMax: 300 };
        expect(getFmStatus({ ...base, currentValue: 300, isNativeEffect: true })).toBe("PARFAIT");
        expect(getFmStatus({ ...base, currentValue: 275, isNativeEffect: true })).toBe("BON");
        expect(getFmStatus({ ...base, currentValue: 251, isNativeEffect: true })).toBe("BON");
        expect(getFmStatus({ ...base, currentValue: 200, isNativeEffect: true })).toBe("FAIBLE");
        expect(getFmStatus({ ...base, currentValue: 350, isNativeEffect: true })).toBe("OVER");
        // 1 PA ajouté sur un anneau : jamais refusé, simplement étiqueté EXO.
        expect(
            getFmStatus({ currentValue: 1, nativeMin: null, nativeMax: null, isNativeEffect: false })
        ).toBe("EXO");
        // Plage native inconnue côté catalogue → à vérifier (pas un refus).
        expect(getFmStatus({ currentValue: 5, nativeMax: null, isNativeEffect: true })).toBe(
            "A_VERIFIER"
        );
        // Malus : le signe prime, natif ou modifié.
        expect(getFmStatus({ ...base, currentValue: -20, isNativeEffect: true })).toBe("MALUS");
        expect(getFmStatus({ currentValue: -10, nativeMax: null, isNativeEffect: false })).toBe(
            "MALUS"
        );
    });
});

describe("fm-effects — résolution vers une ligne FM", () => {
    it("normalise le « % » (préfixe) et les accents", () => {
        expect(normalizeFmLabel("Résistance Feu (%)")).toBe("% resistance feu");
        expect(normalizeFmLabel("% Résistance Feu")).toBe("% resistance feu");
        expect(normalizeFmLabel("Coups critiques")).toBe("coups critiques");
    });

    it("résout par characteristicId, par effectId, puis par libellé", () => {
        expect(resolveFmEffectKey({ characteristic: 11 })).toBe("vitality");
        expect(resolveFmEffectKey({ characteristic: 23 })).toBe("movementPoints");
        expect(resolveFmEffectKey({ effectId: 111 })).toBe("actionPoints");
        expect(resolveFmEffectKey({ label: "% Résistance Eau" })).toBe("waterResistancePercent");
        expect(resolveFmEffectKey({ label: "Résistance Eau (%)" })).toBe("waterResistancePercent");
        expect(resolveFmEffectKey({ label: "Vi" })).toBe("vitality");
        expect(resolveFmEffectKey({ label: "Do Per Ar" })).toBe("weaponDamagePercent");
        expect(resolveFmEffectKey({ label: "Ret Pme" })).toBe("mpReduction");
    });

    it("renvoie null pour une ligne hors jet FM", () => {
        expect(resolveFmEffectKey({ label: "Vol de vie" })).toBeNull();
        expect(resolveFmEffectKey({ effectId: 9_999_999 })).toBeNull();
        expect(resolveFmEffectKey({})).toBeNull();
    });

    it("describeFmReadonly explique les lignes en lecture seule", () => {
        expect(describeFmReadonly("Vol de vie")).toMatch(/Vol de vie/);
        expect(describeFmReadonly("Dégâts de l'arme")).toMatch(/arme/);
        expect(describeFmReadonly("Bonus de panoplie")).toMatch(/panoplie/);
        expect(describeFmReadonly("Vitalité")).toBeNull();
        expect(describeFmReadonly(null)).toBeNull();
    });
});

describe("fm-effects — budget de densité (101)", () => {
    it("un exo PM consomme 90 et laisse 11 de densité", () => {
        const pm = getFmEffect("movementPoints")!;
        const budget = computeFmBudget([{ unitWeight: pm.unitWeight, extraValue: 1 }]);
        expect(budget.cap).toBe(101);
        expect(budget.consumed).toBe(90);
        expect(budget.remaining).toBe(11);
        expect(budget.exceeded).toBe(false);
        // 11 de densité restante = +55 Vitalité (0,2/pt).
        expect(maxOverFromRemaining(getFmEffect("vitality")!, budget.remaining)).toBe(55);
        // …et 0 PA supplémentaire (100/pt).
        expect(maxOverFromRemaining(getFmEffect("actionPoints")!, budget.remaining)).toBe(0);
    });

    it("cumule overs et exos puis signale un dépassement sans bloquer", () => {
        const budget = computeFmBudget([
            { unitWeight: 90, extraValue: 1 }, // exo PM
            { unitWeight: 51, extraValue: 1 }, // over Portée
        ]);
        expect(budget.consumed).toBe(141);
        expect(budget.remaining).toBe(0);
        expect(budget.exceeded).toBe(true);
    });

    it("ignore les valeurs nulles/négatives (un malus ne consomme pas de densité)", () => {
        const budget = computeFmBudget([
            { unitWeight: 10, extraValue: 0 },
            { unitWeight: 10, extraValue: -5 },
        ]);
        expect(budget.consumed).toBe(0);
        expect(budget.remaining).toBe(101);
    });

    it("fmDensity arrondit sans erreur flottante", () => {
        expect(fmDensity(0.2, 55)).toBe(11);
        expect(fmDensity(0.1, 3)).toBe(0.3);
        expect(fmDensity(15, -6)).toBe(90);
    });
});
