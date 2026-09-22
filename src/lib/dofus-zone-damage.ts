/**
 * Dégâts DÉGRESSIFS des sorts de zone — **règle du jeu appliquée telle quelle**.
 *
 * Source (relevée le 21/09/2026, recopiée sans interprétation) :
 * `dofuspourlesnoobs.com/les-dommages.html` § « DÉGÂTS DE ZONE » —
 *
 *   « Dégâts réels = Dégâts finaux * (10-Eloignement)/10 »
 *   « L'éloignement est le nombre minimal de cases entre la case ciblée par le sort et le
 *     personnage qui subit les dégâts. Attention, la case ciblée n'est pas forcément le centre
 *     de la zone ! »
 *
 * Conséquences tenues ici :
 *   - l'origine de la dégressivité est la **case VISÉE** (et non le centre géométrique de la zone) ;
 *   - la dégressivité s'applique **par cible**, après le jet de dégâts (donc à chaque ligne
 *     d'élément : le total est la somme des lignes corrigées, exactement comme le jeu le fait
 *     avant les résistances du personnage) ;
 *   - `éloignement ≥ 10` ⇒ **0 dégât** (le facteur s'annule), jamais une valeur négative.
 *
 * ⚠️ Ce que ce module **ne simule pas** (données absentes : la grille tactique ne connaît ni les
 * résistances, ni les états, ni les caractéristiques du défenseur) : résistances fixes et en %,
 * dommages subis (Vulnérabilité/Bond…), Poisse/Brokle, coups critiques. Les jets affichés sont les
 * **jets réels du grade** (déjà calculés côté serveur) — aucune valeur n'est inventée.
 *
 * Module **PUR** (aucun IO, aucun React) : testable unitairement et réutilisable par la
 * simulation tactique comme par le simulateur de stuff.
 */

import { toLos, type DofusPos } from "@/lib/dofus-grid";
import type { SpellDamageLine } from "@/lib/dofus-spells";

/** Palier de la formule du jeu : au-delà, les dégâts de zone tombent à zéro. */
export const ZONE_FALLOFF_RANGE = 10;

/**
 * Facteur de dégâts pour un **éloignement** donné : `(10 − éloignement)/10`, borné à `[0, 1]`.
 * Un éloignement négatif ou inconnu ⇒ `1` (aucun malus : on n'invente rien).
 */
export function zoneFalloffFactor(offset: number): number {
    const d = Number.isFinite(offset) ? Math.floor(offset) : 0;
    if (d <= 0) return 1;
    if (d >= ZONE_FALLOFF_RANGE) return 0;
    return (ZONE_FALLOFF_RANGE - d) / ZONE_FALLOFF_RANGE;
}

/** Le même facteur en pourcentage entier (`80` = la cible garde 80 % des dégâts). */
export function zoneFalloffPercent(offset: number): number {
    return Math.round(zoneFalloffFactor(offset) * 100);
}

/**
 * Applique la dégressivité à une fourchette de dégâts (`floor` = « tronqués », convention Dofus).
 * Sans éloignement, la fourchette est retournée **inchangée** (aucun arrondi parasite).
 */
export function applyZoneFalloff(min: number, max: number, offset: number): { min: number; max: number } {
    const lo = Math.max(0, Math.floor(min));
    const hi = Math.max(lo, Math.floor(max));
    const factor = zoneFalloffFactor(offset);
    if (factor === 1) return { min: lo, max: hi };
    return { min: Math.floor(lo * factor), max: Math.floor(hi * factor) };
}

/** Lignes de dégâts (par élément) corrigées par la dégressivité, pour une cible donnée. */
export function zoneLinesAtOffset(lines: SpellDamageLine[], offset: number): SpellDamageLine[] {
    return lines.map((line) => {
        const { min, max } = applyZoneFalloff(line.min, line.max, offset);
        return { ...line, min, max };
    });
}

/** Total (toutes lignes confondues) corrigé par la dégressivité, pour une cible donnée. */
export function zoneTotalAtOffset(lines: SpellDamageLine[], offset: number): { min: number; max: number } {
    return zoneLinesAtOffset(lines, offset).reduce(
        (acc, line) => ({ min: acc.min + line.min, max: acc.max + line.max }),
        { min: 0, max: 0 }
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
