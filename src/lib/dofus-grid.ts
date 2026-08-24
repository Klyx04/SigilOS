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

/**
 * Calcule la distance de lancer entre deux cellules dans le repère losange (u, v).
 *
 * - Sort libre : distance Manhattan |du| + |dv|
 * - Sort en ligne pure (axes du===0 ou dv===0) : |du| + |dv| (qui vaut max(|du|, |dv|))
 * - Sort en diagonale pure (|du| === |dv|) : |du| (1 pas diagonal = 1 PO)
 * - Sort étoile (ligne ou diagonale) : si sur l'axe diagonal -> |du|, si sur l'axe cardinal -> |du|+|dv|
 */
export function getSpellRangeDistance(
    du: number,
    dv: number,
    castInLine: boolean,
    castInDiagonal: boolean
): number {
    const isLine = du === 0 || dv === 0;
    const isDiag = Math.abs(du) === Math.abs(dv);

    if (castInDiagonal && !castInLine) {
        return isDiag ? Math.abs(du) : -1;
    }
    if (castInLine && !castInDiagonal) {
        return isLine ? Math.abs(du) + Math.abs(dv) : -1;
    }
    if (castInLine && castInDiagonal) {
        if (isDiag) return Math.abs(du);
        if (isLine) return Math.abs(du) + Math.abs(dv);
        return -1;
    }
    // Sort libre
    return Math.abs(du) + Math.abs(dv);
}

/**
 * Tracé de ligne entre deux cellules dans le repère losange (Bresenham discret Dofus).
 * Renvoie la suite des cellules (col, row) traversées entre `from` (exclus) et `to` (exclus).
 */
export function getLosPath(from: DofusPos, to: DofusPos, isRealMap = true): DofusPos[] {
    const p0 = isRealMap ? toLos(from.x, from.y) : { x: from.x, y: from.y };
    const p1 = isRealMap ? toLos(to.x, to.y) : { x: to.x, y: to.y };

    const pts: DofusPos[] = [];
    const dx = Math.abs(p1.x - p0.x);
    const dy = Math.abs(p1.y - p0.y);
    const sx = p0.x < p1.x ? 1 : -1;
    const sy = p0.y < p1.y ? 1 : -1;
    let err = dx - dy;
    let u = p0.x;
    let v = p0.y;

    while (true) {
        if (u === p1.x && v === p1.y) break;
        if (!(u === p0.x && v === p0.y)) {
            const cell = isRealMap ? losToXY(u, v) : { x: u, y: v };
            pts.push(cell);
        }
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            u += sx;
        }
        if (e2 < dx) {
            err += dx;
            v += sy;
        }
    }
    return pts;
}

/**
 * Portée (PO) d'un sort Dofus entre deux cellules, dans le repère losange.
 */
export function castRangeDistance(a: DofusPos, b: DofusPos, hasDirectionConstraint: boolean): number {
    const la = toLos(a.x, a.y);
    const lb = toLos(b.x, b.y);
    const du = Math.abs(lb.x - la.x);
    const dv = Math.abs(lb.y - la.y);
    return hasDirectionConstraint ? Math.max(du, dv) : du + dv;
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

/** Distance entre deux cellules : Manhattan orthogonal si map libre, losange Dofus si map réelle. */
export function gridDistance(a: DofusPos, b: DofusPos, isRealMap = true): number {
    if (!isRealMap) {
        return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    }
    const la = toLos(a.x, a.y);
    const lb = toLos(b.x, b.y);
    return Math.abs(lb.x - la.x) + Math.abs(lb.y - la.y);
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
    isRealMap?: boolean;
}): DofusPos[] {
    const { zone, target, caster, cols, rows, isRealMap = true } = opts;
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

    if (!isRealMap) {
        // Grille libre orthogonale (17×17 damier isométrique)
        const dU = Math.sign(target.x - caster.x);
        const dV = Math.sign(target.y - caster.y);

        switch (zone.shape) {
            case "Cercle":
                for (let y = 0; y < rows; y++) {
                    for (let x = 0; x < cols; x++) {
                        if (Math.abs(x - target.x) + Math.abs(y - target.y) <= size) add(x, y);
                    }
                }
                break;
            case "Croix":
            case "Perpend":
                for (let i = -size; i <= size; i++) {
                    add(target.x + i, target.y);
                    add(target.x, target.y + i);
                }
                break;
            case "Ligne":
                if (dU !== 0 || dV !== 0) {
                    for (let i = 1; i <= size; i++) {
                        add(target.x + i * dU, target.y + i * dV);
                    }
                }
                break;
            case "Rectangle":
                for (let dy = -size; dy <= size; dy++) {
                    for (let dx = -size; dx <= size; dx++) {
                        add(target.x + dx, target.y + dy);
                    }
                }
                break;
            default:
                break;
        }
        return out;
    }

    // Map réelle brick (40×14)
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
                        if (dot >= Math.cos(Math.PI / 3)) add(x, y);
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
        default:
            break;
    }
    return out;
}

/**
 * Calcule l'attribution des positions des monstres selon le numéro de placement (1..N).
 * Règle Dofus (découverte communautaire) :
 * - sortedCells = cases monstres triées par cellId croissant (la plus haute / plus petit ID en premier).
 * - Boss = sortedCells[placementIndex - 1].
 * - Monstres suivants (mobs 2 à N) :
 *   1. La case choisie doit avoir un mob déjà placé à exactement 3 PO (distance Manhattan Dofus) et aucun mob plus proche (< 3 PO).
 *   2. Si aucune case ne respecte l'étape 1, augmenter de 1 PO (4 PO, 5 PO...).
 *   3. Si plusieurs cases respectent l'étape, choisir celle avec le plus petit cellId.
 *   4. Si cela dépasse la map sans trouver, tester 2 PO, puis 1 PO.
 */
export function computeMonsterPlacements(
    monsterCellIds: number[],
    placementIndex: number = 1
): { bossCell: number; otherMonsterCells: number[] } {
    if (!monsterCellIds || monsterCellIds.length === 0) {
        return { bossCell: 0, otherMonsterCells: [] };
    }
    const sorted = [...monsterCellIds].sort((a, b) => a - b);
    const pIdx = Math.max(0, Math.min(sorted.length - 1, placementIndex - 1));
    const bossCell = sorted[pIdx];

    const placedCells: number[] = [bossCell];
    const availableCells = sorted.filter((id) => id !== bossCell);

    while (availableCells.length > 0) {
        let bestCell: number | null = null;

        // Tester distances croissantes à partir de 3 PO jusqu'à 30 PO
        for (let targetDist = 3; targetDist <= 30; targetDist++) {
            const candidates = availableCells.filter((cellId) => {
                const cellPos = cellIdToXY(cellId);
                const dists = placedCells.map((pId) => distance(cellPos, cellIdToXY(pId)));
                const minDist = Math.min(...dists);
                return minDist === targetDist;
            });
            if (candidates.length > 0) {
                bestCell = Math.min(...candidates);
                break;
            }
        }

        // Si non trouvé (distances < 3 PO)
        if (bestCell === null) {
            for (const targetDist of [2, 1]) {
                const candidates = availableCells.filter((cellId) => {
                    const cellPos = cellIdToXY(cellId);
                    const dists = placedCells.map((pId) => distance(cellPos, cellIdToXY(pId)));
                    const minDist = Math.min(...dists);
                    return minDist === targetDist;
                });
                if (candidates.length > 0) {
                    bestCell = Math.min(...candidates);
                    break;
                }
            }
        }

        // Fallback ultime : premier ID dispo
        if (bestCell === null) {
            bestCell = availableCells[0];
        }

        placedCells.push(bestCell);
        const idx = availableCells.indexOf(bestCell);
        if (idx >= 0) availableCells.splice(idx, 1);
    }

    return {
        bossCell,
        otherMonsterCells: placedCells.slice(1),
    };
}

