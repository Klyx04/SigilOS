/**
 * Simulation tactique — **peinture de cases** (obstacles et trous posés par le joueur).
 *
 * Règle pure (testée) extraite de `SpellRangeGrid` le 23/10/2026 après la mesure suivante :
 *   · `paintedCells` était **global** alors que le plateau change de carte : peindre sur la
 *     carte A puis ouvrir la carte B laissait des cases en état, invisibles et hors grille ;
 *   · un **trou** n'était pas dessiné sur la carte réelle (`return null`) ⇒ « j'ai peint, il n'y
 *     a rien » (constat user).
 *
 * La peinture est donc **cloisonnée par carte** (`paintedByMap[mapId]`) et **bornée** à la grille
 * rendue. Le stockage historique (`paintedCells` à plat) est migré vers la carte courante à la
 * lecture, sans perte.
 */

export type PaintMode = "obstacle" | "hole";
export type PaintedCells = Record<string, PaintMode>;
export type PaintedByMap = Record<string, PaintedCells>;

/** Clé de la carte « vide » (grille libre 17×17) — même sentinelle que `selectedMapId`. */
export const PAINT_EMPTY_MAP_KEY = "empty";

const PAINT_MODES: readonly PaintMode[] = ["obstacle", "hole"];

function isPaintMode(value: unknown): value is PaintMode {
    return value === "obstacle" || value === "hole";
}

/** Clé de cloisonnement : une carte `null`/vide retombe sur la grille libre. */
export function mapPaintKey(mapId?: string | null): string {
    const key = typeof mapId === "string" ? mapId.trim() : "";
    return key.length > 0 ? key : PAINT_EMPTY_MAP_KEY;
}

/**
 * Cases peintes **d'une carte**, nettoyées : clés `"x,y"` de nombres entiers et valeurs connues.
 * Toute autre entrée est écartée (stockage local = entrée non fiable).
 */
export function readPaintedCells(byMap: unknown, mapId?: string | null): PaintedCells {
    if (!byMap || typeof byMap !== "object" || Array.isArray(byMap)) return {};
    const bucket = (byMap as Record<string, unknown>)[mapPaintKey(mapId)];
    if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) return {};

    const out: PaintedCells = {};
    for (const [rawKey, mode] of Object.entries(bucket as Record<string, unknown>)) {
        if (!isPaintMode(mode)) continue;
        const [rawX, rawY] = rawKey.split(",");
        const x = Number(rawX);
        const y = Number(rawY);
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) continue;
        out[`${x},${y}`] = mode;
    }
    return out;
}

/** Nombre de cases peintes (affiché dans le panneau « Vider (n) »). */
export function countPaintedCells(cells: PaintedCells | null | undefined): number {
    return cells ? Object.keys(cells).length : 0;
}

/**
 * Peint (ou efface) une case **de la carte courante**. Re-cliquer avec le même mode efface la
 * case ; cliquer avec l'autre mode la remplace. Les autres cartes ne sont jamais touchées.
 */
export function togglePaintedCell(
    byMap: PaintedByMap,
    mapId: string | null | undefined,
    x: number,
    y: number,
    mode: PaintMode,
): PaintedByMap {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return byMap;
    const key = mapPaintKey(mapId);
    const current = readPaintedCells(byMap, key);
    const next: PaintedCells = { ...current };

    if (next[`${x},${y}`] === mode) delete next[`${x},${y}`];
    else next[`${x},${y}`] = mode;

    return { ...byMap, [key]: next };
}

/** Vide la peinture **de la carte courante** (les autres cartes gardent la leur). */
export function clearPaintedCells(byMap: PaintedByMap, mapId?: string | null): PaintedByMap {
    return { ...byMap, [mapPaintKey(mapId)]: {} };
}

/**
 * Écarte les cases **hors de la grille rendue** : elles ne peuvent pas être dessinées, les garder
 * produirait exactement le symptôme « Vider (2) mais rien à l'écran ».
 */
export function sanitizePaintedCells(
    cells: PaintedCells | null | undefined,
    rows: number,
    cols: number,
): PaintedCells {
    if (!cells) return {};
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) return {};
    const out: PaintedCells = {};
    for (const [key, mode] of Object.entries(cells)) {
        if (!isPaintMode(mode)) continue;
        const [rawX, rawY] = key.split(",");
        const x = Number(rawX);
        const y = Number(rawY);
        if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        out[`${x},${y}`] = mode;
    }
    return out;
}

/**
 * Lit le stockage de simulation (localStorage) et rend la peinture **cloisonnée**.
 * Rétrocompatible : l'ancien champ plat `paintedCells` est rattaché à la carte courante.
 */
export function migrateStoredPaint(stored: unknown, mapId?: string | null): PaintedByMap {
    const key = mapPaintKey(mapId);
    const source = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};

    if (source.paintedByMap && typeof source.paintedByMap === "object" && !Array.isArray(source.paintedByMap)) {
        return source.paintedByMap as PaintedByMap;
    }

    const legacy = source.paintedCells;
    if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) return {};

    const migrated: PaintedCells = {};
    for (const [rawKey, mode] of Object.entries(legacy as Record<string, unknown>)) {
        if (!isPaintMode(mode)) continue;
        migrated[rawKey] = mode;
    }
    return { [key]: migrated };
}

/** Le mode de peinture est-il valide ? (garde d'entrée pour les panneaux) */
export function isPaintModeValue(value: unknown): value is PaintMode {
    return PAINT_MODES.includes(value as PaintMode);
}
