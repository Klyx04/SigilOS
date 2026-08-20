/**
 * Géométrie des maps de combat Dofus 3.
 *
 * Sources : format de données Dofensive (`Cells[40][14]`, cellIds 0-559) et
 * `TacticalMapRenderer` (E-bou, rendu Dofus 3 en quinconce).
 *
 * Une map de combat = 40 rangées × 14 positions. Convention validée sur données
 * réelles : `cellId → (col = cellId % 14, row = floor(cellId / 14))` place les
 * cases de départ (AllyCells/EnemyCells) sur des cellules libres (24/24 testé).
 *
 * Rendu « brick » (quinconce) : x = col*CW + (row%2)*CHW, y = row*CHH.
 * Distance Dofus = Manhattan dans le repère losange dérivé de cette position écran.
 */

export const DOFUS_MAP_WIDTH = 14; // positions par rangée
export const DOFUS_MAP_ROWS = 40; // rangées

export interface DofusPos {
    x: number;
    y: number;
}

/** cellId Dofus (0-559) → (col, row) dans Cells[row][col]. */
export function cellIdToXY(cellId: number): DofusPos {
    return { x: cellId % DOFUS_MAP_WIDTH, y: Math.floor(cellId / DOFUS_MAP_WIDTH) };
}

/** (col, row) → cellId Dofus (inverse de cellIdToXY). */
export function positionToCellId(pos: DofusPos): number {
    return pos.y * DOFUS_MAP_WIDTH + pos.x;
}

/** Position écran d'une cellule (grille en quinconce), tuiles de largeur cw / hauteur ch. */
export function cellToScreen(x: number, y: number, cw: number, ch: number): { sx: number; sy: number } {
    return { sx: x * cw + (y % 2) * (cw / 2), sy: y * (ch / 2) };
}

/** Repère losange (axes de déplacement Dofus) — la distance = Manhattan |dx|+|dy|. */
export function toLos(x: number, y: number): DofusPos {
    return { x: (y + 2 * x + (y % 2)) / 2, y: (y - 2 * x - (y % 2)) / 2 };
}

/** Distance de combat Dofus entre deux cellules (grille brick). */
export function distance(a: DofusPos, b: DofusPos): number {
    const la = toLos(a.x, a.y);
    const lb = toLos(b.x, b.y);
    return Math.abs(lb.x - la.x) + Math.abs(lb.y - la.y);
}

// ── États de case (cf. src/temp/debug.md) ───────────────────────────────────
// Dans les données Dofensive `Cells[row][col]` : 0 = sol, 1 = obstacle, 2 = case
// spéciale (sémantique exacte à confirmer — vérifiée ≠ cases de départ).
// Les cases de départ (alliés/ennemis) sont fournies séparément (AllyCells/EnemyCells).

export enum CellState {
    VOID = "VOID", // hors carte / noir — jamais utilisable
    HOLE = "HOLE", // trou dans le terrain — non franchissable
    GROUND = "GROUND", // sol de combat — walkable
    OBSTACLE = "OBSTACLE", // bloc 3D — non walkable, bloque la LoS
    SPECIAL = "SPECIAL", // case spéciale (marchable, marquée visuellement)
    START_ALLY = "START_ALLY", // zone de placement allié
    START_ENEMY = "START_ENEMY", // zone de placement ennemi
}

export function stateFromValue(v: number): CellState {
    if (v === 1) return CellState.OBSTACLE;
    if (v === 2) return CellState.SPECIAL;
    if (v === 0) return CellState.GROUND;
    return CellState.VOID;
}

export function isWalkable(state: CellState): boolean {
    return state === CellState.GROUND || state === CellState.SPECIAL || state === CellState.START_ALLY || state === CellState.START_ENEMY;
}

export function blocksLineOfSight(state: CellState): boolean {
    return state === CellState.OBSTACLE || state === CellState.VOID || state === CellState.HOLE;
}
