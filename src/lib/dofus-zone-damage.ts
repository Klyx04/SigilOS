/**
 * Dégâts DÉGRESSIFS des sorts de zone — **règle du jeu 3.6, paramétrée par l'effet**.
 *
 * Sources (relevées le 22/09/2026) :
 *  ① **donnée DofusDB** (`api.dofusdb.fr`, source du siphon) — chaque EFFET porte, dans son
 *     `zoneDescr`, `damageDecreaseStepPercent` (perte par case d'éloignement) et
 *     `maxDamageDecreaseApplyCount` (nombre maximal d'applications). Mesures :
 *       · `spell-levels/42413` (Éther) → `damageDecreaseStepPercent: 10`, `maxDamageDecreaseApplyCount: 4`
 *         (le bloc critique porte la même paire) ;
 *       · échantillon de **1 200 niveaux / 2 039 effets** → **2 023** effets en `10 | 4`, 4 sans
 *         dégressivité, 1 cas isolé ⇒ la paire est le réglage par défaut de l'effet.
 *  ② **formule historique**, recopiée sans interprétation
 *     (`dofuspourlesnoobs.com/les-dommages.html` § « DÉGÂTS DE ZONE ») :
 *
 *       « Dégâts réels = Dégâts finaux * (10-Eloignement)/10 »
 *       « L'éloignement est le nombre minimal de cases entre la case ciblée par le sort et le
 *         personnage qui subit les dégâts. Attention, la case ciblée n'est pas forcément le
 *         centre de la zone ! »
 *
 *  ③ La donnée 3.6 est la **même règle, plafonnée** : `1 − 10 %·d` ≡ `(10 − d)/10` pour `d ≤ 4`
 *     (les deux formules coïncident), et au-delà de `maxApplyCount` applications la perte ne
 *     grandit plus (−40 % pour Éther) là où l'ancienne formule atteignait −100 % à 10 cases.
 *
 * Formule appliquée :
 *
 *     d      = éloignement (nb minimal de cases entre la case VISÉE et la cible)
 *     perte  = min(d, maxApplyCount) × stepPercent / 100
 *     dégâts = troncature(dégâts × (1 − perte))     // jamais négatifs
 *
 * Conséquences tenues ici :
 *   - l'origine de la dégressivité est la **case VISÉE** (et non le centre géométrique de la zone) ;
 *   - elle s'applique **par cible** et **par ligne** (chaque ligne porte éventuellement SA
 *     dégressivité, `SpellDamageLine.decrease` — défaut mesuré sinon) ;
 *   - les jets **normaux et critiques** subissent la même perte (le jeu affiche les deux) ;
 *   - une dégressivité nulle (`0 %` par case, mesurée sur 4 effets) ⇒ **aucun malus**.
 *
 * ⚠️ Ce que ce module **ne simule pas** (données absentes : la grille tactique ne connaît ni les
 * résistances, ni les états, ni les caractéristiques du défenseur) : résistances fixes et en %,
 * dommages subis non fournis par l'utilisateur, Poisse/Brokle, érosion. Les jets affichés sont les
 * **jets réels du grade** (déjà calculés côté serveur ou via `computeSpellDamage`) — aucune valeur
 * n'est inventée.
 *
 * Module **PUR** (aucun IO, aucun React) : testable unitairement et réutilisable par la
 * simulation tactique comme par le simulateur de stuff.
 */

import { toLos, type DofusPos } from "@/lib/dofus-grid";
import type { SpellDamageLine, ZoneDamageDecrease } from "@/lib/dofus-spells";

/**
 * Dégressivité par défaut d'un effet — **mesurée**, jamais choisie : `10 %` par case,
 * `4` applications au maximum (⇒ plafond −40 %), valeur portée par 2 023 des 2 039 effets de
 * l'échantillon DofusDB du 22/09/2026.
 */
export const ZONE_DAMAGE_DECREASE_DEFAULT: ZoneDamageDecrease = { stepPercent: 10, maxApplyCount: 4 };

/** Dégressivité exploitable : entiers ≥ 0, sinon le défaut mesuré. */
function safeDecrease(decrease?: ZoneDamageDecrease | null): ZoneDamageDecrease {
    const step = Number(decrease?.stepPercent);
    const max = Number(decrease?.maxApplyCount);
    if (!Number.isFinite(step) || !Number.isFinite(max)) return ZONE_DAMAGE_DECREASE_DEFAULT;
    if (step <= 0 || max <= 0) return { stepPercent: 0, maxApplyCount: 0 };
    return { stepPercent: step, maxApplyCount: Math.floor(max) };
}

/**
 * Facteur de dégâts pour un **éloignement** donné, borné à `[0, 1]` :
 * `1 − min(éloignement, maxApplyCount) × stepPercent/100`.
 * Un éloignement négatif ou inconnu ⇒ `1` (aucun malus : on n'invente rien) ;
 * une dégressivité nulle ⇒ `1` (le sort ne perd rien avec la distance).
 */
export function zoneFalloffFactor(offset: number, decrease?: ZoneDamageDecrease | null): number {
    const { stepPercent, maxApplyCount } = safeDecrease(decrease);
    if (stepPercent <= 0 || maxApplyCount <= 0) return 1;
    const d = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
    if (d <= 0) return 1;
    return Math.max(0, 1 - (Math.min(d, maxApplyCount) * stepPercent) / 100);
}

/** Le même facteur en pourcentage entier (`60` = la cible garde 60 % des dégâts). */
export function zoneFalloffPercent(offset: number, decrease?: ZoneDamageDecrease | null): number {
    return Math.round(zoneFalloffFactor(offset, decrease) * 100);
}

/**
 * Applique la dégressivité à une fourchette de dégâts (`floor` = « tronqués », convention Dofus).
 * Sans éloignement (ou sans perte), la fourchette est retournée **inchangée** (aucun arrondi parasite).
 */
export function applyZoneFalloff(
    min: number,
    max: number,
    offset: number,
    decrease?: ZoneDamageDecrease | null
): { min: number; max: number } {
    const lo = Math.max(0, Math.floor(min));
    const hi = Math.max(lo, Math.floor(max));
    const factor = zoneFalloffFactor(offset, decrease);
    if (factor === 1) return { min: lo, max: hi };
    return { min: Math.floor(lo * factor), max: Math.floor(hi * factor) };
}

/**
 * Lignes de dégâts (par élément) corrigées par la dégressivité, pour une cible donnée.
 * Chaque ligne utilise **sa** dégressivité (`line.decrease`), le défaut mesuré sinon ; le jet
 * critique de la ligne subit **le même facteur** (le jeu frappe les deux pareil).
 */
export function zoneLinesAtOffset(lines: SpellDamageLine[], offset: number): SpellDamageLine[] {
    return lines.map((line) => {
        const decrease = line.decrease ?? null;
        const { min, max } = applyZoneFalloff(line.min, line.max, offset, decrease);
        const crit = line.crit ? applyZoneFalloff(line.crit.min, line.crit.max, offset, decrease) : null;
        return { ...line, min, max, crit };
    });
}

/**
 * Total (toutes lignes confondues) corrigé par la dégressivité, pour une cible donnée.
 * `critMin`/`critMax` valent `null` quand aucune ligne ne publie de jet critique : jamais une
 * fourchette inventée à partir du jet normal.
 */
export function zoneTotalAtOffset(
    lines: SpellDamageLine[],
    offset: number
): { min: number; max: number; critMin: number | null; critMax: number | null } {
    if (!lines || lines.length === 0) return { min: 0, max: 0, critMin: null, critMax: null };
    return zoneLinesAtOffset(lines, offset).reduce(
        (acc, line) => ({
            min: acc.min + line.min,
            max: acc.max + line.max,
            // Le cumul critique démarre à 0 (« toutes les lignes vues en ont un ») et se casse dès
            // qu'une ligne n'en publie pas : le total passe alors à `null` (jamais une somme partielle).
            critMin: line.crit && acc.critMin !== null ? acc.critMin + line.crit.min : null,
            critMax: line.crit && acc.critMax !== null ? acc.critMax + line.crit.max : null,
        }),
        { min: 0, max: 0, critMin: 0, critMax: 0 } as {
            min: number;
            max: number;
            critMin: number | null;
            critMax: number | null;
        }
    );
}

/**
 * Éloignement entre la **case visée** et une cible : nombre minimal de cases du jeu
 * (mouvement 4 directions ⇒ Manhattan dans le repère losange pour une vraie map, coordonnées
 * directes pour la grille libre — même convention que le reste de la simulation).
 */
export function zoneOffsetBetween(anchor: DofusPos, target: DofusPos, isRealMap: boolean): number {
    const a = isRealMap ? toLos(anchor.x, anchor.y) : { x: anchor.x, y: anchor.y };
    const b = isRealMap ? toLos(target.x, target.y) : { x: target.x, y: target.y };
    return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}
