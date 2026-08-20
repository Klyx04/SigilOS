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
// Dans les données Dofensive `Cells[row][col]` : 0 = sol, 1 = obstacle, 2 = trou
// (case impossible, noir). Les cases de départ (alliés/ennemis) sont fournies
// séparément (AllyCells/EnemyCells) et ne tombent que sur des 0.

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
    if (v === 2) return CellState.HOLE; // trou dans le terrain — case impossible (noir)
    if (v === 0) return CellState.GROUND;
    return CellState.VOID;
}

export function isWalkable(state: CellState): boolean {
    return state === CellState.GROUND || state === CellState.SPECIAL || state === CellState.START_ALLY || state === CellState.START_ENEMY;
}

export function blocksLineOfSight(state: CellState): boolean {
    return state === CellState.OBSTACLE || state === CellState.VOID || state === CellState.HOLE;
}

/**
 * Classe la grille brute Dofensive (0/1/2) en états de case (CellState).
 *
 * Distinction VOID vs OBSTACLE : un « 1 » est un **OBSTACLE** (bloc 3D) s'il est
 * réellement *entouré* de sol (≥ 4 voisins GROUND/SPECIAL sur 8) — c'est-à-dire un
 * mur/bloc isolé à l'intérieur de l'arène. Sinon c'est un **VOID** (case impossible :
 * cadre hors-carte, jamais concernée → rendue en noir, sans tuile ni grille).
 */
export function classifyGrid(cells: number[][]): CellState[][] {
    const rows = cells.length;
    const cols = cells[0]?.length ?? 0;
    const isGround = (v: number | undefined) => v === 0 || v === 2;
    const states: CellState[][] = [];

    for (let r = 0; r < rows; r++) {
        const rowStates: CellState[] = [];
        for (let c = 0; c < cols; c++) {
            const v = cells[r]?.[c] ?? 1;
            if (v === 1) {
                let groundNeighbors = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                        if (isGround(cells[nr]?.[nc])) groundNeighbors++;
                    }
                }
                rowStates.push(groundNeighbors >= 4 ? CellState.OBSTACLE : CellState.VOID);
            } else {
                rowStates.push(stateFromValue(v));
            }
        }
        states.push(rowStates);
    }
    return states;
}

/** Hauteur visuelle d'un état (blocs 3D : 1 unité pour OBSTACLE, 0 sinon). */
export function elevationOf(state: CellState): number {
    return state === CellState.OBSTACLE ? 1 : 0;
}
