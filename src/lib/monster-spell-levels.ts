/**
 * Lot 6 « siphon spell-levels » — parsing PUR des niveaux de sorts DofusDB.
 *
 * Constat (Mureine 8333, 10/2026) : `spells/{id}.description` est vide à la
 * source, mais `monsters/{id}` + `spell-levels/{gradeId}` portent tout le
 * combat — dés, conditions de lancer, zones, passif de début de combat
 * (`startingSpellId`), drops à critères et paramètres d'aggro.
 *
 * Aucun import serveur : les fetchs vivent dans
 * `src/server/actions/monster-spell-actions.ts`, testés ici sur fixtures.
 */

export interface ScaledDamage {
    min: number;
    max: number;
}

/**
 * Dégâts calculés façon DofusDB : dés × (1 + stat/100).
 * Référence Mureine (stat 800) : 71-80 → 639-720 · 121-130 → 1089-1170 ·
 * 81-90 → 729-810. Borné fail-closed (nombres finis positifs).
 */
export function scaleDamageDice(min: number, max: number, stat: number): ScaledDamage | null {
    const lo = Math.floor(Number(min));
    const hi = Math.floor(Number(max));
    const st = Math.floor(Number(stat));
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(st)) return null;
    if (lo < 0 || hi < 0 || st < 0) return null;
    if (hi > 0 && hi < lo) return null;
    const factor = 1 + st / 100;
    const sMin = Math.floor(lo * factor);
    const sMax = hi > 0 ? Math.floor(hi * factor) : sMin;
    return { min: sMin, max: sMax };
}

export interface UnityDamageLine {
    min: number;
    max: number;
    element: string;
}

/**
 * Ligne brute Unity « 71 à 80 dommages Eau » → dés + élément.
 * `null` = pas une ligne de dégâts (jamais d'exception).
 */
export function parseUnityDamageLine(label: string): UnityDamageLine | null {
    const m = String(label ?? "").match(/(\d+)\s*(?:à|-)\s*(\d+)\s+dommages\s+(\S+)/i)
        ?? String(label ?? "").match(/(\d+)\s+dommages\s+(\S+)/i);
    if (!m) return null;
    if (m.length === 4) {
        return { min: Number(m[1]), max: Number(m[2]), element: m[3] };
    }
    return { min: Number(m[1]), max: Number(m[1]), element: m[2] };
}

const ELEMENT_STAT_KEY: Record<string, string> = {
    terre: "earth",
    feu: "fire",
    eau: "water",
    air: "air",
};

/**
 * « 71 à 80 dommages Eau » + stats du monstre → « 639 à 720 dommages Eau ».
 * Élément inconnu ou stats absentes ⇒ libellé d'origine (jamais inventé).
 */
export function scaleUnityDamageLine(
    label: string,
    stats: { earth?: number | null; fire?: number | null; water?: number | null; air?: number | null } | null | undefined
): string {
    const parsed = parseUnityDamageLine(label);
    if (!parsed || !stats) return label;
    const key = ELEMENT_STAT_KEY[parsed.element.toLowerCase()];
    const raw = key ? (stats as Record<string, unknown>)[key] : undefined;
    const stat = raw === null || raw === undefined ? NaN : Number(raw);
    if (!Number.isFinite(stat)) return label;
    const scaled = scaleDamageDice(parsed.min, parsed.max, stat);
    if (!scaled) return label;
    const range = scaled.max !== scaled.min ? `${scaled.min} à ${scaled.max}` : `${scaled.min}`;
    return `${range} dommages ${parsed.element}`;
}

/** `Invoque : 8334` → 8334 (`null` si absent). */
export function parseInvocationId(label: string): number | null {
    const m = String(label ?? "").match(/invoque\s*:\s*(\d+)/i);
    if (!m) return null;
    const id = Math.floor(Number(m[1]));
    return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * `Invoque : 8334` + annuaire → `Invoque : Murare`.
 * Sans nom résolu ⇒ libellé d'origine (le brut reste affiché, pas de vide).
 */
export function resolveInvocationLabel(label: string, lookup: (id: number) => string | null): string {
    const id = parseInvocationId(label);
    if (!id) return label;
    const name = lookup(id);
    if (!name) return label;
    return String(label).replace(/invoque\s*:\s*\d+/i, `Invoque : ${name}`);
}

export interface SpellLevelConditions {
    needTakenCell: boolean;
    needFreeCell: boolean;
    castTestLos: boolean;
    castInLine: boolean;
    castInDiagonal: boolean;
    rangeCanBeBoosted: boolean;
}

/** Conditions de lancer d'un niveau de sort (valeurs brutes DofusDB). */
export function parseSpellLevelConditions(level: any): SpellLevelConditions {
    const l = (level ?? {}) as Record<string, unknown>;
    return {
        needTakenCell: l.needTakenCell === true,
        needFreeCell: l.needFreeCell === true,
        castTestLos: l.castTestLos !== false,
        castInLine: l.castInLine === true,
        castInDiagonal: l.castInDiagonal === true,
        rangeCanBeBoosted: l.rangeCanBeBoosted === true,
    };
}

/** Libellés FR des conditions VRAIES (affichage fiche). */
export function describeSpellLevelConditions(conditions: SpellLevelConditions): string[] {
    const out: string[] = [];
    if (!conditions.castTestLos) out.push("Ne nécessite pas de ligne de vue");
    if (conditions.needTakenCell) out.push("Nécessite une cellule occupée");
    if (conditions.needFreeCell) out.push("Nécessite une cellule libre");
    if (conditions.castInLine) out.push("Lançable en ligne uniquement");
    if (conditions.castInDiagonal) out.push("Lançable en diagonale uniquement");
    return out;
}

/** Plage de drop DofusDB (`minPercentDrop`/`maxPercentDrop`), ex. 1 → 20 %. */
export function parseDropRange(drop: any): { min: number; max: number } | null {
    const d = (drop ?? {}) as Record<string, unknown>;
    const min = Number(d.minPercentDrop);
    const max = Number(d.maxPercentDrop);
    if (!Number.isFinite(min) && !Number.isFinite(max)) return null;
    return { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0 };
}
