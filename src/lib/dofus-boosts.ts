/**
 * **Boosts du lanceur** et **malus de la cible** — « combien je tape avec mes buffs ? ».
 *
 * 🎯 Demande user (22/09/2026, verbatim) : « sur dofusbook aussi on peut ajouter des boost pour
 * voir combien on tape avec les boost que le perso a ou les malus quil peut mettre etc ».
 *
 * Module **PUR** (aucun IO, aucun React) : il transforme un `BuildStatsForSpells` + une liste de
 * boosts choisis en un **build boosté** (et un facteur « dommages subis » pour la cible), sans
 * toucher au reste du calcul de dégâts (`computeSpellDamage`) : une seule source de vérité.
 *
 * 🔒 Provenance — aucune valeur inventée. Les presets sont **mesurés** sur `api.dofusdb.fr`
 * (22/09/2026) : sort → niveau → effet → valeur, chaque entrée citant ses ids DofusDB :
 *   · **Puissance** (sort `13118`, niveau `41312` = grade 3) : effet `138` « +300 Puissance »
 *     (`characteristic: 25`) pendant 3 tours ;
 *   · **Épée Divine** (sort `13110`, niveau `41288` = grade 3) : effet `112` « +30 Dommages »
 *     (`characteristic: 16`, durée 4 tours) ;
 *   · **Bond** (sort `13107`, niveau `41279` = grade 3) : effet `1163` « Dommages subis x115 % »
 *     appliqué aux **ennemis** de la zone (`targetMask: "A"`) ⇒ +15 % de dommages subis.
 *
 * Règle appliquée pour les malus de cible : les `% Dommages subis` **se multiplient** entre eux
 * (et non s'additionnent), comme la source du jeu le rappelle
 * (`dofuspourlesnoobs.com/les-dommages.html` § « DÉGÂTS FINAUX ») — d'où
 * `targetDamageTakenFactor()`, qui multiplie au lieu d'additionner.
 */

import type { BuildStatsForSpells, SpellDamageLine, SpellElementKey } from "@/lib/dofus-spells";

/** Deltas appliqués au **lanceur** (mêmes axes que `BuildStatsForSpells`). */
export interface BoostCasterDelta {
    /** Puissance (ajoutée à la caractéristique élémentaire par `computeSpellDamage`). */
    puissance?: number;
    /** `% Dommages` — sorts / mêlée / distance (le taux appliqué dépend de la portée du sort). */
    pctSorts?: number;
    pctMelee?: number;
    pctDistance?: number;
    /** Dommages FIXES, par élément (`Dommages Terre`, `Dommages Feu`…). */
    fixesParElement?: Partial<Record<SpellElementKey, number>>;
    /** `Dommages` général (ajoutés à chaque ligne). */
    dommagesGeneraux?: number;
    /** `Dommages Critiques` (ajoutés en coup critique uniquement). */
    dommagesCritiques?: number;
    /** `% Dommages finaux` (multiplicateur appliqué en dernier). */
    pctFinaux?: number;
}

/** Un boost sélectionnable : son libellé, sa provenance DofusDB, ses deltas et son malus cible. */
export interface DamageBoost {
    /** Identifiant stable (clé i18n du preset, ou `custom:<rang>`). */
    id: string;
    /** Libellé affiché (preset traduit, ou libellé saisi). */
    label: string;
    /** Provenance mesurée (absente pour une ligne personnalisée). */
    source?: {
        spellId: number;
        spellLevelId: number;
        /** Effet DofusDB (`effectId`) et sa caractéristique quand elle est documentée. */
        effectId: number;
        characteristic?: number;
    };
    /** Effets sur les dégâts infligés. */
    caster?: BoostCasterDelta;
    /** Malus subi par la **cible**, en `% Dommages subis` (multiplicatif). */
    targetDamageTakenPercent?: number;
}

/** Nombre fini (>= 0) ou 0 : un boost absent ne modifie rien. */
function num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * **Presets mesurés** (22/09/2026) — les trois boosts dont la valeur est vérifiable dans la
 * donnée DofusDB. Tout autre boost se saisit en « personnalisé » (aucune valeur inventée).
 */
export const BOOST_PRESETS: DamageBoost[] = [
    {
        id: "puissance",
        label: "Puissance (grade 3)",
        source: { spellId: 13118, spellLevelId: 41312, effectId: 138, characteristic: 25 },
        caster: { puissance: 300 },
    },
    {
        id: "epee-divine",
        label: "Épée Divine (grade 3)",
        source: { spellId: 13110, spellLevelId: 41288, effectId: 112, characteristic: 16 },
        caster: { dommagesGeneraux: 30 },
    },
    {
        id: "bond",
        label: "Bond (grade 3, ennemis)",
        source: { spellId: 13107, spellLevelId: 41279, effectId: 1163 },
        targetDamageTakenPercent: 15,
    },
];

/**
 * Applique les boosts « lanceur » à un build : puissance, `% Dommages`, dommages fixes (par
 * élément et généraux), dommages critiques et `% Dommages finaux` **s'additionnent** entre boosts
 * (même famille de bonus), et le build d'origine n'est **jamais modifié** (copie).
 */
export function applyBoosts(build: BuildStatsForSpells, boosts: DamageBoost[]): BuildStatsForSpells {
    if (boosts.length === 0) return build;
    const elements = { ...build.elements };
    const damages = { ...build.damages };

    for (const boost of boosts) {
        const caster = boost.caster;
        if (!caster) continue;
        elements.pu += num(caster.puissance);
        damages.sorts += num(caster.pctSorts);
        damages.melee += num(caster.pctMelee);
        damages.distance += num(caster.pctDistance);
        damages.general += num(caster.dommagesGeneraux);
        damages.critique += num(caster.dommagesCritiques);
        damages.finaux = num(damages.finaux) + num(caster.pctFinaux);
        for (const [element, value] of Object.entries(caster.fixesParElement ?? {})) {
            const key = element as SpellElementKey;
            damages[key] = num(damages[key]) + num(value);
        }
    }

    return { elements, damages };
}

/**
 * Facteur de **dommages subis** de la cible : les `% Dommages subis` se **multiplient** entre eux
 * (règle du jeu) ⇒ `Π (1 + p/100)`. Un boost sans malus de cible ⇒ `1` (aucun effet).
 */
export function targetDamageTakenFactor(boosts: DamageBoost[]): number {
    return boosts.reduce((factor, boost) => {
        const pct = num(boost.targetDamageTakenPercent);
        return pct > 0 ? factor * (1 + pct / 100) : factor;
    }, 1);
}

/** Applique le facteur « dommages subis » à une fourchette (troncature, convention Dofus). */
export function applyDamageTakenFactor(
    range: { min: number; max: number },
    factor: number
): { min: number; max: number } {
    if (!Number.isFinite(factor) || factor === 1 || factor <= 0) return range;
    return { min: Math.floor(range.min * factor), max: Math.floor(range.max * factor) };
}

/** Le même facteur, appliqué à des **lignes de dégâts** (jets normaux et critiques). */
export function applyDamageTakenToLines(lines: SpellDamageLine[], factor: number): SpellDamageLine[] {
    if (!Number.isFinite(factor) || factor === 1 || factor <= 0) return lines;
    return lines.map((line) => ({
        ...line,
        ...applyDamageTakenFactor({ min: line.min, max: line.max }, factor),
        crit: line.crit ? applyDamageTakenFactor(line.crit, factor) : line.crit ?? null,
    }));
}

/** Le même facteur, appliqué à un **total par cible** (jet normal + jet critique). */
export function applyDamageTakenToTotal(
    total: { min: number; max: number; critMin: number | null; critMax: number | null },
    factor: number
): { min: number; max: number; critMin: number | null; critMax: number | null } {
    if (!Number.isFinite(factor) || factor === 1 || factor <= 0) return total;
    const applied = applyDamageTakenFactor({ min: total.min, max: total.max }, factor);
    return {
        ...applied,
        critMin: total.critMin === null ? null : Math.floor(total.critMin * factor),
        critMax: total.critMax === null ? null : Math.floor(total.critMax * factor),
    };
}

/** `% Dommages subis` affichable à partir du facteur (`1.15` → `15`), arrondi à l'entier. */
export function damageTakenPercentFromFactor(factor: number): number {
    if (!Number.isFinite(factor) || factor <= 1) return 0;
    return Math.round((factor - 1) * 100);
}

/** `true` quand au moins un boost change réellement quelque chose (sinon : aucun affichage). */
export function hasDamageBoost(boosts: DamageBoost[]): boolean {
    return boosts.some((boost) => {
        if (num(boost.targetDamageTakenPercent) > 0) return true;
        const caster = boost.caster;
        if (!caster) return false;
        const flat = [
            caster.puissance,
            caster.pctSorts,
            caster.pctMelee,
            caster.pctDistance,
            caster.dommagesGeneraux,
            caster.dommagesCritiques,
            caster.pctFinaux,
        ];
        if (flat.some((v) => num(v) > 0)) return true;
        return Object.values(caster.fixesParElement ?? {}).some((v) => num(v) > 0);
    });
}

