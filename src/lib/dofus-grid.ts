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
// Dans les données Dofensive `Cells[row][col]` :
//   0 = sol (marchable) · 1 = case impossible / trou (noir, non marchable) ·
//   2 = case obstacle (bloc 3D, non marchable).
// Les cases de départ (AllyCells/EnemyCells) ne tombent que sur des 0.

export enum CellState {
    VOID = "VOID", // hors carte / valeur inconnue — noir, jamais utilisable
    HOLE = "HOLE", // case impossible / trou — noir, non marchable, ne bloque pas la LdV
    GROUND = "GROUND", // sol de combat — walkable
    OBSTACLE = "OBSTACLE", // case obstacle — bloc 3D, non marchable, bloque la LdV
    START_ALLY = "START_ALLY", // zone de placement allié
    START_ENEMY = "START_ENEMY", // zone de placement ennemi
}

export function stateFromValue(v: number): CellState {
    if (v === 0) return CellState.GROUND;
    if (v === 1) return CellState.HOLE; // case impossible / trou — noir
    if (v === 2) return CellState.OBSTACLE; // case obstacle — bloc 3D
    return CellState.VOID;
}

export function isWalkable(state: CellState): boolean {
    return state === CellState.GROUND || state === CellState.START_ALLY || state === CellState.START_ENEMY;
}

export function blocksLineOfSight(state: CellState): boolean {
    // Les obstacles (2) bloquent la LdV ET les déplacements ; les trous / cases
    // impossibles (1) bloquent seulement le passage (debug.md).
    return state === CellState.OBSTACLE || state === CellState.VOID;
}

/**
 * Classe la grille brute Dofensive (0/1/2) en états de case (CellState).
 *
 *   - 0 → GROUND (sol beige/ocre, marchable)
 *   - 1 → HOLE (case impossible / trou, rendue en noir, non marchable)
 *   - 2 → OBSTACLE (case obstacle, bloc 3D, non marchable, bloque la LdV)
 *
 * Les valeurs hors 0/1/2 (inconnues) deviennent VOID (noir). Pas d'heuristique de
 * voisinage : la sémantique vient directement des données Dofensive (les cases
 * impossibles = 1, les cases obstacles = 2 — cf. debug.md + retour user).
 */
export function classifyGrid(cells: number[][]): CellState[][] {
    const rows = cells.length;
    const cols = cells[0]?.length ?? 0;
    const states: CellState[][] = [];

    for (let r = 0; r < rows; r++) {
        const rowStates: CellState[] = [];
        for (let c = 0; c < cols; c++) {
            const v = cells[r]?.[c] ?? 1;
            rowStates.push(stateFromValue(v));
        }
        states.push(rowStates);
    }
    return states;
}

/** Hauteur visuelle d'un état (blocs 3D : 1 unité pour OBSTACLE, 0 sinon). */
export function elevationOf(state: CellState): number {
    return state === CellState.OBSTACLE ? 1 : 0;
}

/** (repère losange) → (col, row) — inverse de toLos. */
export function losToXY(u: number, v: number): DofusPos {
    const y = u + v;
    return { x: (u - v - (y % 2)) / 2, y };
}

// ── Zones d'effet (AoE) ──────────────────────────────────────────────────────
// Formes de zone Dofensive normalisées : Cercle, Croix/Perpend, Ligne, Cône,
// Rectangle, Point. La zone est centrée sur la CIBLE (case de portée), avec une
// orientation déduite caster → cible pour Ligne/Cône.

export interface SpellZoneInput {
    shape: "Cercle" | "Croix" | "Ligne" | "Cône" | "Perpend" | "Rectangle" | "Point" | "Inconnue";
    size: number;
    range: number;
}

/**
 * Cases touchées par une zone AoE centrée sur `target` (orientation caster → target
 * pour Ligne/Cône). Bornes de la grille (cols×rows) appliquées. Testable unitairement.
 */
export function spellZoneCells(opts: {
    zone: SpellZoneInput;
    target: DofusPos;
    caster: DofusPos;
    cols: number;
    rows: number;
}): DofusPos[] {
    const { zone, target, caster, cols, rows } = opts;
    const size = zone.size || 0;
    const out: DofusPos[] = [];
    const seen = new Set<string>();
    const add = (x: number, y: number) => {
        const xi = Math.round(x);
        const yi = Math.round(y);
        if (xi < 0 || xi >= cols || yi < 0 || yi >= rows) return;
        const k = `${xi},${yi}`;
        if (seen.has(k)) return;
        seen.add(k);
        out.push({ x: xi, y: yi });
    };
    add(target.x, target.y);

    const t = toLos(target.x, target.y);
    const c = toLos(caster.x, caster.y);

    switch (zone.shape) {
        case "Cercle":
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    if (distance(target, { x, y }) <= size) add(x, y);
                }
            }
            break;
        case "Croix":
        case "Perpend":
            for (let i = -size; i <= size; i++) {
                const p1 = losToXY(t.x + i, t.y);
                const p2 = losToXY(t.x, t.y + i);
                add(p1.x, p1.y);
                add(p2.x, p2.y);
            }
            break;
        case "Ligne": {
            const dU = t.x - c.x;
            const dV = t.y - c.y;
            if (dU !== 0 || dV !== 0) {
                for (let i = 1; i <= size; i++) {
                    const p = losToXY(t.x + i * dU, t.y + i * dV);
                    add(p.x, p.y);
                }
            }
            break;
        }
        case "Cône": {
            const dU = t.x - c.x;
            const dV = t.y - c.y;
            const dir = Math.hypot(dU, dV);
            if (dir >= 1) {
                const du = dU / dir;
                const dv = dV / dir;
                for (let y = 0; y < rows; y++) {
                    for (let x = 0; x < cols; x++) {
                        if (distance(target, { x, y }) > size) continue;
                        const p = toLos(x, y);
                        const cu = p.x - t.x;
                        const cv = p.y - t.y;
                        const n = Math.hypot(cu, cv);
                        if (n < 1) continue;
                        const dot = (cu * du + cv * dv) / n;
                        if (dot >= Math.cos(Math.PI / 3)) add(x, y); // cône 120°
                    }
                }
            }
            break;
        }
        case "Rectangle":
            for (let dy = -size; dy <= size; dy++) {
                for (let dx = -size; dx <= size; dx++) {
                    const p = losToXY(t.x + dx, t.y + dy);
                    add(p.x, p.y);
                }
            }
            break;
        default: // Point / Inconnue
            break;
    }
    return out;
}
