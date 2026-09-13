import { describe, it, expect } from "vitest";
import {
    FM_CHARACTERISTIC_KEYS,
    FM_CHARACTERISTIC_LABELS,
    FM_DENSITY_CAP,
    FM_EFFECTS,
    FM_EFFECTS_BY_KEY,
    FM_EFFECT_ID_KEYS,
    FM_READONLY_EXCEPTIONS,
    FM_TRANSCENDENCE_LABEL,
    FM_TRANSCENDENCE_PALIERS,
    FM_TRANSCENDENCE_SEUILS,
    computeFmBudget,
    computeItemWeight,
    describeFmReadonly,
    fmDensity,
    fmTranscendenceFamily,
    fmTranscendencePalierFor,
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

/**
 * S8.2 (D40) — Transcendance : libellé d'effet, seuils de pose, et exception
 * « arme de chasse » au filet de lecture seule.
 */
describe("fm-effects — transcendance (S8.2)", () => {
    it("expose le libellé d'effet officiel et les 3 paliers", () => {
        expect(FM_TRANSCENDENCE_LABEL).toBe("Empêche les futures forgemagies");
        expect([...FM_TRANSCENDENCE_PALIERS]).toEqual(["Ta", "PaTa", "RaTa"]);
    });

    it("décline des seuils décroissants Ta ≥ PaTa ≥ RaTa pour chaque famille", () => {
        for (const [family, seuils] of Object.entries(FM_TRANSCENDENCE_SEUILS)) {
            expect(seuils.Ta).toBeGreaterThan(seuils.PaTa);
            expect(seuils.PaTa).toBeGreaterThan(seuils.RaTa);
            expect(seuils.RaTa).toBeGreaterThan(0);
            expect(family.length).toBeGreaterThan(0);
        }
    });

    it("range un libellé d'effet dans la bonne famille de seuils", () => {
        expect(fmTranscendenceFamily("Agilité")).toBe("simple");
        expect(fmTranscendenceFamily("Vitalité")).toBe("simple");
        expect(fmTranscendenceFamily("Pods")).toBe("extended");
        expect(fmTranscendenceFamily("Initiative")).toBe("extended");
        expect(fmTranscendenceFamily("Dommages Feu")).toBe("elementalDamage");
        expect(fmTranscendenceFamily("Dommages Neutre")).toBe("elementalDamage");
        expect(fmTranscendenceFamily("Dommages Mêlée (%)")).toBe("percent");
        expect(fmTranscendenceFamily("Résistance % Terre")).toBe("percent");
        expect(fmTranscendenceFamily("Retrait PA")).toBe("retAndDodge");
        expect(fmTranscendenceFamily("Esquive PM")).toBe("retAndDodge");
        // Inconnu → null (jamais de famille inventée).
        expect(fmTranscendenceFamily("Nawak")).toBeNull();
        expect(fmTranscendenceFamily(null)).toBeNull();
    });

    it("déduit le palier posable le plus fort pour un jet donné", () => {
        // Agilité (simple) : 61 / 41 / 21.
        expect(fmTranscendencePalierFor("Agilité", 10)).toBe("RaTa");
        expect(fmTranscendencePalierFor("Agilité", 30)).toBe("PaTa");
        expect(fmTranscendencePalierFor("Agilité", 50)).toBe("Ta");
        // Au-delà du seuil le plus permissif : aucune rune de Transcendance.
        expect(fmTranscendencePalierFor("Agilité", 62)).toBeNull();
        // Pods (étendues) : 301 / 204 / 105.
        expect(fmTranscendencePalierFor("Pods", 120)).toBe("PaTa");
        // Dommages élémentaires : 8 / 5 / 3.
        expect(fmTranscendencePalierFor("Dommages Feu", 4)).toBe("PaTa");
        // Un libellé hors référentiel ou un jet non fini → null.
        expect(fmTranscendencePalierFor("Nawak", 1)).toBeNull();
        expect(fmTranscendencePalierFor("Agilité", Number.NaN)).toBeNull();
    });

    it("marque la ligne de Transcendance comme lecture seule", () => {
        expect(describeFmReadonly(FM_TRANSCENDENCE_LABEL)).toMatch(/transcend/i);
        expect(describeFmReadonly("Empêche les futures forgemagies")).toMatch(/transcend/i);
    });

    it("exempte l'arme de chasse du filet de lecture seule", () => {
        expect(FM_READONLY_EXCEPTIONS.length).toBeGreaterThan(0);
        // « Arme de chasse » est forgeable : contient « arme » mais ne doit pas être
        // capturée par le motif « Dégâts de l'arme ».
        expect(describeFmReadonly("Arme de chasse")).toBeNull();
        expect(describeFmReadonly("Chasse")).toBeNull();
        // Le motif générique reste actif pour les vrais dégâts d'arme.
        expect(describeFmReadonly("Dégâts de l'arme")).toMatch(/arme/);
    });
});

/**
 * S8.5 — les libellés **gabarits** du siphon `/effects` (« Effet 63 », « }{ soins »)
 * ne doivent jamais être interprétés comme une ligne FM : mieux vaut `null`
 * (ligne hors référentiel) qu'une clé inventée.
 */
describe("fm-effects — gabarits ignorés (S8.5)", () => {
    it("refuse un libellé-gabarit même si la caractéristique est connue", () => {
        // « Vitalité » via la caractéristique 11 … mais le libellé est un gabarit :
        // on refuse quand même (le libellé ment sur ce qu'il désigne).
        expect(resolveFmEffectKey({ characteristic: 11, label: "Effet 63" })).toBeNull();
        expect(resolveFmEffectKey({ effectId: 125, label: "}{ soins" })).toBeNull();
        expect(resolveFmEffectKey({ label: "  " })).toBeNull();
    });

    it("résout normalement un libellé valide (non-régression)", () => {
        expect(resolveFmEffectKey({ characteristic: 11 })).toBe("vitality");
        expect(resolveFmEffectKey({ label: "Vitalité" })).toBe("vitality");
        expect(resolveFmEffectKey({ label: "Vi" })).toBe("vitality");
        // Sans libellé du tout, la résolution par ids reste active.
        expect(resolveFmEffectKey({ characteristic: 10 })).toBe("strength");
    });
});

/**
 * Correction 13/09 (2ᵉ passe, constat user) — **les libellés de la table
 * d'infobulle** (`CHAR_NAMES`, cf. `market-effects.test.ts`) doivent tous
 * résoudre leur ligne FM. Sans cela `analyzeLine()` renvoie `null` et la ligne
 * est **retirée** de l'éditeur de jet : c'est exactement ce qui manquait sur la
 * Cape de Glourdorak (`115`, `176`, `418`, `421`).
 */
describe("fm-effects — libellés d'infobulle résolus (13/09)", () => {
    it("résout les 4 lignes natives disparues de l'éditeur", () => {
        expect(resolveFmEffectKey({ effectId: 115, label: "Critique (%)" })).toBe("criticalHits");
        expect(resolveFmEffectKey({ effectId: 176, label: "Prospection" })).toBe("prospecting");
        expect(resolveFmEffectKey({ effectId: 418, label: "Dommages Critiques" })).toBe("criticalDamage");
        expect(resolveFmEffectKey({ effectId: 421, label: "Résistance Critiques" })).toBe("criticalResistance");
    });

    it("résout aussi la série de pénalités (même libellé, signe à part)", () => {
        expect(resolveFmEffectKey({ effectId: 419, label: "Dommages Critiques" })).toBe("criticalDamage");
        expect(resolveFmEffectKey({ effectId: 423, label: "Dommages Terre" })).toBe("earthDamage");
        expect(resolveFmEffectKey({ effectId: 410, label: "Retrait PA" })).toBe("apReduction");
        expect(resolveFmEffectKey({ effectId: 413, label: "Retrait PM" })).toBe("mpReduction");
        expect(resolveFmEffectKey({ effectId: 414, label: "Dommages Poussée" })).toBe("pushbackDamage");
        expect(resolveFmEffectKey({ effectId: 416, label: "Résistance Poussée" })).toBe("pushbackResistance");
        expect(resolveFmEffectKey({ effectId: 174, label: "Initiative" })).toBe("initiative");
        expect(resolveFmEffectKey({ effectId: 138, label: "Puissance" })).toBe("power");
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

describe("fm-effects — S4.0a : la Portée n'est jamais « over » (D38)", () => {
    it("refuse l'over de Portée (2 PO = 102 > 101) mais autorise l'exo", () => {
        const range = getFmEffect("range")!;
        expect(range.canOver).toBe(false);
        expect(range.canExo).toBe(true);
        // La règle est **arithmétique** : deux points de Portée dépassent le plafond,
        // un seul point (exo ou natif) reste dans le budget.
        expect(fmDensity(range.unitWeight, 2)).toBe(102);
        expect(fmDensity(range.unitWeight, 2)).toBeGreaterThan(FM_DENSITY_CAP);
        expect(fmDensity(range.unitWeight, 1)).toBeLessThanOrEqual(FM_DENSITY_CAP);
    });

    it("verrouille PA / PM (jamais over) et le plafond des Invocations", () => {
        expect(getFmEffect("actionPoints")!.canOver).toBe(false);
        expect(getFmEffect("movementPoints")!.canOver).toBe(false);
        // Invocations : 3 max (3 × 30 = 90 ≤ 101) → over possible sous le plafond.
        const summons = getFmEffect("summons")!;
        expect(summons.canOver).toBe(true);
        expect(fmDensity(summons.unitWeight, summons.maxOverStandalone)).toBeLessThanOrEqual(
            FM_DENSITY_CAP
        );
    });
});

describe("fm-effects — S4.0b : mapping des caractéristiques vérifié (D39)", () => {
    it("aligne exactement le mapping et les libellés vérifiés", () => {
        expect(Object.keys(FM_CHARACTERISTIC_KEYS).map(Number).sort((a, b) => a - b)).toEqual(
            Object.keys(FM_CHARACTERISTIC_LABELS).map(Number).sort((a, b) => a - b)
        );
    });

    it("ne pointe que vers des lignes FM existantes", () => {
        for (const key of Object.values(FM_CHARACTERISTIC_KEYS)) {
            expect(FM_EFFECTS_BY_KEY[key]).toBeDefined();
        }
    });

    it("résout chaque id ET son libellé DofusDB vers la même ligne FM", () => {
        for (const [rawId, key] of Object.entries(FM_CHARACTERISTIC_KEYS)) {
            const id = Number(rawId);
            expect(resolveFmEffectKey({ characteristic: id })).toBe(key);
            expect(resolveFmEffectKey({ label: FM_CHARACTERISTIC_LABELS[id] })).toBe(key);
        }
    });

    it("porte les corrections de l'audit §12.8.4 (ids mesurés le 11/09/2026)", () => {
        expect(FM_CHARACTERISTIC_KEYS[10]).toBe("strength");
        expect(FM_CHARACTERISTIC_KEYS[11]).toBe("vitality");
        expect(FM_CHARACTERISTIC_KEYS[16]).toBe("damage");
        expect(FM_CHARACTERISTIC_KEYS[26]).toBe("summons");
        expect(FM_CHARACTERISTIC_KEYS[27]).toBe("apDodge");
        expect(FM_CHARACTERISTIC_KEYS[28]).toBe("mpDodge");
        expect(FM_CHARACTERISTIC_KEYS[33]).toBe("earthResistancePercent");
        expect(FM_CHARACTERISTIC_KEYS[34]).toBe("fireResistancePercent");
        expect(FM_CHARACTERISTIC_KEYS[35]).toBe("waterResistancePercent");
        expect(FM_CHARACTERISTIC_KEYS[36]).toBe("airResistancePercent");
        expect(FM_CHARACTERISTIC_KEYS[37]).toBe("neutralResistancePercent");
        expect(FM_CHARACTERISTIC_KEYS[40]).toBe("pods");
        expect(FM_CHARACTERISTIC_KEYS[44]).toBe("initiative");
        expect(FM_CHARACTERISTIC_KEYS[48]).toBe("prospecting");
        expect(FM_CHARACTERISTIC_KEYS[49]).toBe("heals");
        expect(FM_CHARACTERISTIC_KEYS[50]).toBe("reflectDamage");
        expect(FM_CHARACTERISTIC_KEYS[82]).toBe("apReduction");
        expect(FM_CHARACTERISTIC_KEYS[83]).toBe("mpReduction");
        expect(FM_CHARACTERISTIC_KEYS[84]).toBe("pushbackDamage");
        expect(FM_CHARACTERISTIC_KEYS[86]).toBe("criticalDamage");
        expect(FM_CHARACTERISTIC_KEYS[88]).toBe("earthDamage");
        expect(FM_CHARACTERISTIC_KEYS[89]).toBe("fireDamage");
        expect(FM_CHARACTERISTIC_KEYS[90]).toBe("waterDamage");
        expect(FM_CHARACTERISTIC_KEYS[91]).toBe("airDamage");
        expect(FM_CHARACTERISTIC_KEYS[92]).toBe("neutralDamage");
    });

    it("retire les ids hors FM ou inexistants (aucun id non vérifié)", () => {
        // 51/52 = Perte d'énergie / Points d'honneur · 80 = aggro JcJ ·
        // 93 = max bombes · 141 = Sorts (%) · 112/114 = effectId / 404.
        for (const removed of [51, 52, 80, 93, 112, 114, 141]) {
            expect(FM_CHARACTERISTIC_KEYS[removed]).toBeUndefined();
            expect(FM_CHARACTERISTIC_LABELS[removed]).toBeUndefined();
        }
    });

    it("verrouille les effectIds FM canoniques (exos PA/PM/PO/Invocations)", () => {
        expect(FM_EFFECT_ID_KEYS).toEqual({
            111: "actionPoints",
            117: "range",
            128: "movementPoints",
            182: "summons",
        });
        // Recoupement DofusDB : chaque effectId porte la caractéristique correspondante.
        expect(FM_CHARACTERISTIC_KEYS[1]).toBe(FM_EFFECT_ID_KEYS[111]);
        expect(FM_CHARACTERISTIC_KEYS[19]).toBe(FM_EFFECT_ID_KEYS[117]);
        expect(FM_CHARACTERISTIC_KEYS[23]).toBe(FM_EFFECT_ID_KEYS[128]);
        expect(FM_CHARACTERISTIC_KEYS[26]).toBe(FM_EFFECT_ID_KEYS[182]);
    });
});

describe("fm-effects — S4.0c : Pods gelés (Q15, capture rune manquante)", () => {
    it("gèle la densité historique 0,1/pt et son over max 1010", () => {
        // Tant que la capture de la rune n'est pas fournie (0,1 / 0,25 / 0,025),
        // le plan interdit de trancher ⇒ ce test verrouille la valeur **actuelle**.
        const pods = getFmEffect("pods")!;
        expect(pods.unitWeight).toBe(0.1);
        expect(pods.maxOverStandalone).toBe(1010);
        expect(fmDensity(pods.unitWeight, pods.maxOverStandalone)).toBe(FM_DENSITY_CAP);
    });
});

describe("fm-effects — S4.0d : poids total d'un objet (Anneau du Cycloïde, id 14092)", () => {
    // Jets réels DofusDB : Vita 251-300 · Fo/Ine/Age 31-40 · Ini 201-300 ·
    // Do Neutre/Terre/Feu/Air 7-10 · %Ré Eau 6-8 · Tacle 4-6 (§12.8.4).
    const ringWeight = (j: {
        vita: number;
        fo: number;
        ine: number;
        age: number;
        ini: number;
        dmg: number;
        resEau: number;
        tac: number;
    }) =>
        computeItemWeight(
            (
                [
                    ["vitality", j.vita],
                    ["strength", j.fo],
                    ["intelligence", j.ine],
                    ["agility", j.age],
                    ["initiative", j.ini],
                    ["neutralDamage", j.dmg],
                    ["earthDamage", j.dmg],
                    ["fireDamage", j.dmg],
                    ["airDamage", j.dmg],
                    ["waterResistancePercent", j.resEau],
                    ["tackle", j.tac],
                ] as const
            ).map(([key, value]) => ({ unitWeight: getFmEffect(key)!.unitWeight, value }))
        );

    it("retrouve les poids mesurés : 482 parfait · 355,3 minimum · plafond 583", () => {
        const perfect = ringWeight({
            vita: 300,
            fo: 40,
            ine: 40,
            age: 40,
            ini: 300,
            dmg: 10,
            resEau: 8,
            tac: 6,
        });
        const minimal = ringWeight({
            vita: 251,
            fo: 31,
            ine: 31,
            age: 31,
            ini: 201,
            dmg: 7,
            resEau: 6,
            tac: 4,
        });
        expect(perfect).toBe(482);
        expect(minimal).toBe(355.3);
        // Plafond FM = poids parfait + 101 (exo PM → 572, exo PA → 582).
        expect(perfect + FM_DENSITY_CAP).toBe(583);
        expect(perfect + getFmEffect("movementPoints")!.unitWeight).toBe(572);
        expect(perfect + getFmEffect("actionPoints")!.unitWeight).toBe(582);
    });

    it("est additif, conserve le signe (un malus allège) et tolère les valeurs non finies", () => {
        expect(
            computeItemWeight([
                { unitWeight: 0.2, value: 100 },
                { unitWeight: 1, value: 50 },
            ])
        ).toBe(70);
        expect(computeItemWeight([{ unitWeight: 1, value: -10 }])).toBe(-10);
        expect(
            computeItemWeight([
                { unitWeight: 1, value: 10 },
                { unitWeight: Number.NaN, value: 10 },
                { unitWeight: 1, value: Number.POSITIVE_INFINITY },
            ])
        ).toBe(10);
        expect(computeItemWeight([])).toBe(0);
    });
});

