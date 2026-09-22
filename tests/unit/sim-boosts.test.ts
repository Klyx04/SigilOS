/**
 * Gardes — **Lot 4 : règle de zone 3.6, jets critiques, boosts & malus**.
 *
 * 🎯 Demande user (22/09/2026, verbatim) : « quelle formule en 3.6 ? à toi de trouver sur internet »
 * · « j'aimerai voir en temps réel en passant sur la case les dégats infligés sur chaque entité moi
 * (crit ou non crit) » · « sur dofusbook aussi on peut ajouter des boost pour voir combien on tape
 * avec les boost que le perso a ou les malus quil peut mettre ».
 *
 * 🔍 Mesures (22/09/2026, `api.dofusdb.fr` — source du siphon) :
 *   ① `spell-levels/42413` (Éther) : `zoneDescr.damageDecreaseStepPercent: 10` +
 *      `maxDamageDecreaseApplyCount: 4` (bloc critique compris) ; échantillon de **1 200 niveaux /
 *      2 039 effets** → **2 023** effets en `10 | 4` ⇒ −10 %/case plafonné à −40 % (et non plus
 *      0 dégât à 10 cases) ;
 *   ② le jet critique est publié par la donnée (`criticalEffect` DofusDB, `GroupCriticalEffects`
 *      Dofensive) : Éther 15-17 Air → **18-20 Air** en coup critique ;
 *   ③ presets de boosts mesurés : Puissance (sort 13118, niveau 41312, effet 138 → +300 Puissance),
 *      Épée Divine (13110 / 41288 / effet 112 → +30 Dommages), Bond (13107 / 41279 / effet 1163 →
 *      « Dommages subis x115 % » sur les ennemis).
 *
 * 🛡️ Ce que ce test verrouille : ① les presets et leur provenance (aucune valeur inventée) ;
 * ② l'application des boosts au build (jamais de mutation) et le caractère **multiplicatif** des
 * `% Dommages subis` ; ③ l'agrégation des jets critiques (jamais une somme partielle) ;
 * ④ le câblage UI (badges par cible, panneau, fiche stuff) et les libellés FR **et** EN.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    computeSpellDamage,
    damageLinesFromEffects,
    spellEffectDetailsFromBuild,
    totalCritRange,
    type BuildStatsForSpells,
    type SpellBaseDamage,
} from "@/lib/dofus-spells";
import {
    BOOST_PRESETS,
    applyBoosts,
    applyDamageTakenToLines,
    applyDamageTakenToTotal,
    damageTakenPercentFromFactor,
    hasDamageBoost,
    targetDamageTakenFactor,
    type DamageBoost,
} from "@/lib/dofus-boosts";
import { damageRangeWithCrit } from "@/components/succes/SimulationDamageHud";
import { zoneTotalAtOffset } from "@/lib/dofus-zone-damage";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
    readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Version BRUTE (commentaires conservés) : la provenance mesurée doit rester citée. */
const BOOSTS_RAW = readFileSync("src/lib/dofus-boosts.ts", "utf8");
const PANEL = codeOf("src/components/succes/SimulationBoostPanel.tsx");
const SIM_TAB = codeOf("src/components/dofus/dofusbook-simulation-tab.tsx");
const GRID = codeOf("src/components/succes/SpellRangeGrid.tsx");
const DOFENSIVE_ACTIONS = codeOf("src/server/actions/dofensive-actions.ts");
const FR = codeOf("src/lib/i18n/locales/fr.ts");
const EN = codeOf("src/lib/i18n/locales/en.ts");

/** Build de test : Agilité 100, +10 dommages Air fixes, +20 % dommages Distance. */
const BUILD: BuildStatsForSpells = {
    elements: { fo: 0, in: 0, ch: 0, ag: 100, sa: 0, pu: 0 },
    damages: {
        neutre: 0, terre: 0, feu: 0, eau: 0, air: 10, general: 0,
        critique: 0, poussee: 0, armes: 0, sorts: 0, melee: 0, distance: 20,
    },
};

/** « Éther » grade 3 : 25-28 Air (normal) · 18-20 Air (critique) — valeurs DofusDB. */
const ETHER_G3: SpellBaseDamage[] = [{ min: 25, max: 28, element: "air", grade: 3 }];
const ETHER_G3_CRIT: SpellBaseDamage[] = [{ min: 18, max: 20, element: "air", grade: 3 }];

const preset = (id: string): DamageBoost => {
    const found = BOOST_PRESETS.find((b) => b.id === id);
    if (!found) throw new Error(`preset inconnu: ${id}`);
    return found;
};

describe("presets de boosts — valeurs MESURÉES sur DofusDB", () => {
    it("chaque preset cite son sort, son niveau et son effet DofusDB", () => {
        expect(preset("puissance").source).toEqual({
            spellId: 13118,
            spellLevelId: 41312,
            effectId: 138,
            characteristic: 25,
        });
        expect(preset("epee-divine").source).toEqual({
            spellId: 13110,
            spellLevelId: 41288,
            effectId: 112,
            characteristic: 16,
        });
        expect(preset("bond").source).toEqual({
            spellId: 13107,
            spellLevelId: 41279,
            effectId: 1163,
        });
        // La provenance mesurée reste écrite dans le module (aucune valeur « sortie de nulle part »).
        expect(BOOSTS_RAW).toMatch(/api\.dofusdb\.fr/);
        expect(BOOSTS_RAW).toMatch(/1163/);
    });

    it("Puissance = +300 Puissance, Épée Divine = +30 Dommages fixes, Bond = +15 % dommages subis", () => {
        expect(preset("puissance").caster).toEqual({ puissance: 300 });
        expect(preset("epee-divine").caster).toEqual({ dommagesGeneraux: 30 });
        expect(preset("bond").targetDamageTakenPercent).toBe(15);
        expect(preset("bond").caster).toBeUndefined();
    });
});

describe("application des boosts — build copié, jamais muté", () => {
    it("Puissance s'ajoute à la stat effective (jet ×(1 + (stat + Puissance)/100))", () => {
        const boosted = applyBoosts(BUILD, [preset("puissance")]);
        const [line] = spellEffectDetailsFromBuild(ETHER_G3, boosted, { kind: "distance" });
        // Agilité 100 + Puissance 300 ⇒ ×5 : floor(25×5)=125, +10 fixes = 135, ×1,20 = 162 (max 180).
        expect(line.damage).toEqual({ element: "air", min: 162, max: 180, decrease: null });
        // Le build d'origine n'a pas bougé (aucune mutation partagée entre les onglets).
        expect(BUILD.elements.pu).toBe(0);
    });

    it("les dommages FIXES et le `% Dommages finaux` sont appliqués au bon étage", () => {
        const fixed = applyBoosts(BUILD, [preset("epee-divine")]);
        const [line] = spellEffectDetailsFromBuild(ETHER_G3, fixed, { kind: "distance" });
        // floor(25×2)=50, +10 (build) +30 (Épée Divine) = 90, ×1,20 = 108 (max : 56+40=96 → 115).
        expect(line.damage).toEqual({ element: "air", min: 108, max: 115, decrease: null });

        // `% Dommages finaux` : en DERNIER, une seule fois — sur le jet normal ET sur le critique.
        const withFinaux = applyBoosts(BUILD, [{ id: "x", label: "x", caster: { pctFinaux: 20 } }]);
        const res = computeSpellDamage(ETHER_G3[0], withFinaux, "distance", 1.5, { min: 18, max: 20 });
        expect(res.theoMin).toBe(86); // floor(72 × 1,20)
        expect(res.theoMax).toBe(94); // floor(79,2) puis ×1,20 → floor(94,8)
        expect(res.critMin).toBe(66); // 55 × 1,20
        expect(res.critMax).toBe(72); // 60 × 1,20
    });

    it("aucun boost ⇒ build identique, et `hasDamageBoost` dit la vérité", () => {
        expect(applyBoosts(BUILD, [])).toBe(BUILD);
        expect(hasDamageBoost([])).toBe(false);
        expect(hasDamageBoost([{ id: "v", label: "v", caster: { puissance: 0 } }])).toBe(false);
        expect(hasDamageBoost([preset("bond")])).toBe(true);
    });
});

describe("malus de cible — les % dommages subis se MULTIPLIENT (règle du jeu)", () => {
    it("deux boosts à +15 % donnent ×1,3225 et non ×1,30", () => {
        const bond = preset("bond");
        expect(targetDamageTakenFactor([bond])).toBeCloseTo(1.15, 10);
        expect(targetDamageTakenFactor([bond, bond])).toBeCloseTo(1.3225, 10);
        expect(targetDamageTakenFactor([])).toBe(1);
    });

    it("le facteur tronque les jets normaux ET critiques, cible par cible", () => {
        const factor = targetDamageTakenFactor([preset("bond")]);
        const total = applyDamageTakenToTotal({ min: 72, max: 79, critMin: 55, critMax: 60 }, factor);
        expect(total).toEqual({ min: 82, max: 90, critMin: 63, critMax: 69 });
        const lines = applyDamageTakenToLines(
            [{ element: "air", min: 72, max: 79, lines: 1, crit: { min: 55, max: 60 } }],
            factor
        );
        expect([lines[0].min, lines[0].max]).toEqual([82, 90]);
        expect(lines[0].crit).toEqual({ min: 63, max: 69 });
        expect(damageTakenPercentFromFactor(factor)).toBe(15);
        expect(damageTakenPercentFromFactor(1)).toBe(0);
    });
});

describe("jets critiques — publiés par la donnée, jamais déduits du jet normal", () => {
    it("l'agrégation ne cumule le critique que si CHAQUE jet en porte un", () => {
        const both = damageLinesFromEffects([
            { damage: { element: "air", min: 10, max: 12, critMin: 15, critMax: 18 } },
            { damage: { element: "air", min: 5, max: 5, critMin: 8, critMax: 8 } },
        ]);
        expect(both.lines[0]).toEqual({
            element: "air",
            min: 15,
            max: 17,
            lines: 2,
            crit: { min: 23, max: 26 },
            decrease: null,
        });
        // Un seul jet sans critique ⇒ aucun total critique (jamais une somme partielle).
        const partial = damageLinesFromEffects([
            { damage: { element: "air", min: 10, max: 12, critMin: 15, critMax: 18 } },
            { damage: { element: "air", min: 5, max: 5 } },
        ]);
        expect(partial.lines[0].crit).toBeNull();
    });

    it("la dégressivité n'est conservée que si toutes les lignes la partagent", () => {
        const shared = damageLinesFromEffects([
            { damage: { element: "feu", min: 10, max: 10, decrease: { stepPercent: 10, maxApplyCount: 4 } } },
            { damage: { element: "feu", min: 5, max: 5, decrease: { stepPercent: 10, maxApplyCount: 4 } } },
        ]);
        expect(shared.lines[0].decrease).toEqual({ stepPercent: 10, maxApplyCount: 4 });
        const mixed = damageLinesFromEffects([
            { damage: { element: "feu", min: 10, max: 10, decrease: { stepPercent: 10, maxApplyCount: 4 } } },
            { damage: { element: "feu", min: 5, max: 5, decrease: { stepPercent: 25, maxApplyCount: 2 } } },
        ]);
        expect(mixed.lines[0].decrease).toBeNull();
    });

    it("le jet critique du grade remplace le multiplicateur 1,5 (Éther : 18-20)", () => {
        const [line] = spellEffectDetailsFromBuild(ETHER_G3, BUILD, {
            kind: "distance",
            critDamages: ETHER_G3_CRIT,
        });
        expect(line.damage).toEqual({
            element: "air",
            min: 72,
            max: 79,
            critMin: 55,
            critMax: 60,
            decrease: null,
        });
        // Un élément SANS jet critique publié ⇒ aucun critique affiché (le 1,5 n'est pas un jet).
        const [sansCrit] = spellEffectDetailsFromBuild(ETHER_G3, BUILD, {
            kind: "distance",
            critDamages: [{ min: 18, max: 20, element: "feu", grade: 3 }],
        });
        expect(sansCrit.damage).toEqual({ element: "air", min: 72, max: 79, decrease: null });
        expect(totalCritRange(damageLinesFromEffects([sansCrit]).lines)).toBeNull();
    });

    it("le total critique suit la dégressivité de la cible (60 % à 5 cases)", () => {
        const { lines } = damageLinesFromEffects(
            spellEffectDetailsFromBuild(ETHER_G3, BUILD, { kind: "distance", critDamages: ETHER_G3_CRIT })
        );
        expect(totalCritRange(lines)).toEqual({ min: 55, max: 60 });
        expect(zoneTotalAtOffset(lines, 5).critMax).toBe(36); // floor(60 × 0,6)
    });

    it("le serveur rattache les jets critiques Dofensive à leur ligne normale (payload v3)", () => {
        expect(DOFENSIVE_ACTIONS).toMatch(/attachCriticalDamage\(/);
        expect(DOFENSIVE_ACTIONS).toMatch(/GroupCriticalEffects/);
        // Appariement DANS L'ORDRE, par élément : chaque ligne reçoit SON jet, jamais la somme.
        expect(DOFENSIVE_ACTIONS).toMatch(/const crit = queue\[idx\];/);
        expect(DOFENSIVE_ACTIONS).toMatch(/used\.set\(element, idx \+ 1\);/);
    });
});

describe("câblage UI — badges par cible, panneau, fiche stuff", () => {
    it("la grille porte le facteur de dommages subis et l'applique aux cibles", () => {
        expect(GRID).toMatch(/damageTakenMultiplier\?: number;/);
        expect(GRID).toMatch(/applyDamageTakenToTotal\(zoneTotalAtOffset/);
        expect(GRID).toMatch(/damageTakenPercentFromFactor\(damageTakenMultiplier\)/);
        expect(GRID).toMatch(/damageTakenPercent=\{damageTakenPercent\}/);
    });

    it("la fiche stuff mémoïse le build boosté et transmet le facteur", () => {
        expect(SIM_TAB).toMatch(
            /const boostedBuild = useMemo\(\(\) => applyBoosts\(build, boosts\), \[build, boosts\]\);/
        );
        expect(SIM_TAB).toMatch(
            /const damageTakenMultiplier = useMemo\(\(\) => targetDamageTakenFactor\(boosts\), \[boosts\]\);/
        );
        expect(SIM_TAB).toMatch(/<SimulationBoostPanel value=\{boosts\} onChange=\{setBoosts\} \/>/);
        expect(SIM_TAB).toMatch(/damageTakenMultiplier=\{damageTakenMultiplier\}/);
        // Les sorts se recalculent sur le build BOOSTÉ (jamais sur l'original).
        expect(SIM_TAB).toMatch(/\}, \[classId, level, boostedBuild\]\);/);
    });

    it("le panneau ne calcule AUCUN dégât (il produit des boosts)", () => {
        expect(PANEL).toMatch(/BOOST_PRESETS\.map/);
        expect(PANEL).toMatch(/CUSTOM_ROWS/);
        expect(PANEL).not.toMatch(/computeSpellDamage/);
        expect(PANEL).toMatch(/aria-pressed=\{active\}/);
    });

    it("l'infobulle d'un badge montre les deux jets, forme du jeu", () => {
        expect(damageRangeWithCrit({ min: 146, max: 158 }, { min: 248, max: 259 })).toBe("146–158 (248–259)");
        expect(damageRangeWithCrit({ min: 10, max: 10 }, null)).toBe("10");
    });
});

describe("libellés — FR et EN", () => {
    it("les nouvelles clés existent dans les deux langues", () => {
        for (const locale of [FR, EN]) {
            expect(locale).toMatch(/damageCritShort: "/);
            expect(locale).toMatch(/damageOffsetShort: "/);
            expect(locale).toMatch(/damageHudCritNote: "/);
            expect(locale).toMatch(/damageHudTaken: "/);
            expect(locale).toMatch(/boosts: \{/);
            expect(locale).toMatch(/presetLabels: \{/);
            expect(locale).toMatch(/targetDamageTaken: "/);
        }
    });

    it("la règle affichée est celle de la 3.6 (l'ancienne formule n'est plus montrée)", () => {
        expect(FR).toMatch(/Règle du jeu 3.6/);
        expect(EN).toMatch(/Game rule 3\.6/);
        for (const locale of [FR, EN]) {
            expect(locale).not.toMatch(/10 − éloignement\)\/10/);
            expect(locale).not.toMatch(/10 − distance\)\/10/);
        }
    });
});
