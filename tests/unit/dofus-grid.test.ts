import { describe, it, expect } from "vitest";
import {
    CellState,
    blocksLineOfSight,
    cellIdToXY,
    cellToScreen,
    classifyGrid,
    distance,
    elevationOf,
    isWalkable,
    losToXY,
    positionToCellId,
    spellZoneCells,
    stateFromValue,
    toLos,
} from "@/lib/dofus-grid";

describe("dofus-grid — géométrie des maps Dofus 3 (TacticalMapRenderer/Dofensive)", () => {
    it("cellIdToXY : col = id % 14, row = floor(id / 14)", () => {
        expect(cellIdToXY(0)).toEqual({ x: 0, y: 0 });
        expect(cellIdToXY(13)).toEqual({ x: 13, y: 0 });
        expect(cellIdToXY(14)).toEqual({ x: 0, y: 1 });
        expect(cellIdToXY(207)).toEqual({ x: 11, y: 14 }); // case de départ réelle (Prison d'ambre)
        expect(cellIdToXY(559)).toEqual({ x: 13, y: 39 });
    });

    it("positionToCellId est l'inverse de cellIdToXY", () => {
        for (const id of [0, 13, 14, 207, 328, 559]) {
            const p = cellIdToXY(id);
            expect(positionToCellId(p)).toBe(id);
        }
    });

    it("cellToScreen : quinconce (rangées impaires décalées de la moitié)", () => {
        expect(cellToScreen(0, 0, 64, 32)).toEqual({ sx: 0, sy: 0 });
        // rangée paire : x = col*64 ; rangée impaire : +32
        expect(cellToScreen(1, 0, 64, 32)).toEqual({ sx: 64, sy: 0 });
        expect(cellToScreen(1, 1, 64, 32)).toEqual({ sx: 64 + 32, sy: 16 });
        // deux rangées consécutives au même col : décalage de +32 en x, +16 en y
        const a = cellToScreen(3, 4, 64, 32);
        const b = cellToScreen(3, 5, 64, 32);
        expect(b.sx - a.sx).toBe(32);
        expect(b.sy - a.sy).toBe(16);
    });

    it("distance Dofus : voisins verticaux = 1, colonnes éloignées = cohérent", () => {
        expect(distance({ x: 7, y: 20 }, { x: 7, y: 21 })).toBe(1);
        expect(distance({ x: 7, y: 20 }, { x: 7, y: 20 })).toBe(0);
        expect(distance({ x: 0, y: 0 }, { x: 13, y: 39 })).toBeGreaterThan(0);
    });

    it("toLos : le repère losange place les voisins verticaux à distance 1", () => {
        // (7,20) et (7,21) : même colonne, rangées consécutives → |dx|+|dy| = 1
        const a = toLos(7, 20);
        const b = toLos(7, 21);
        expect(Math.abs(b.x - a.x) + Math.abs(b.y - a.y)).toBe(1);
    });
});

describe("dofus-grid — états de case (VOID/HOLE/GROUND/OBSTACLE)", () => {
    it("stateFromValue : 0 = sol, 1 = case impossible/trou (HOLE), 2 = obstacle (OBSTACLE), sinon void", () => {
        expect(stateFromValue(0)).toBe(CellState.GROUND);
        expect(stateFromValue(1)).toBe(CellState.HOLE); // case impossible / trou → noir
        expect(stateFromValue(2)).toBe(CellState.OBSTACLE); // case obstacle → bloc 3D
        expect(stateFromValue(5)).toBe(CellState.VOID);
    });

    it("isWalkable : sol et zones de départ walkables, obstacle/trou/void non", () => {
        expect(isWalkable(CellState.GROUND)).toBe(true);
        expect(isWalkable(CellState.START_ALLY)).toBe(true);
        expect(isWalkable(CellState.START_ENEMY)).toBe(true);
        expect(isWalkable(CellState.OBSTACLE)).toBe(false);
        expect(isWalkable(CellState.VOID)).toBe(false);
        expect(isWalkable(CellState.HOLE)).toBe(false);
    });

    it("blocksLineOfSight : obstacle (2) et void bloquent, un trou / case impossible (1) non (debug.md)", () => {
        expect(blocksLineOfSight(CellState.OBSTACLE)).toBe(true); // « bloque la LdV et les déplacements »
        expect(blocksLineOfSight(CellState.VOID)).toBe(true);
        expect(blocksLineOfSight(CellState.HOLE)).toBe(false); // « bloque le passage » uniquement
        expect(blocksLineOfSight(CellState.GROUND)).toBe(false);
    });

    it("classifyGrid : 0 = sol, 1 = case impossible/trou (noir), 2 = case obstacle (3D)", () => {
        const grid = [
            [1, 1, 1, 1, 1, 1],
            [1, 0, 0, 2, 0, 1],
            [1, 0, 1, 0, 0, 1],
            [1, 0, 0, 2, 0, 1],
            [1, 1, 1, 1, 1, 1],
        ];
        const s = classifyGrid(grid);
        expect(s[1][1]).toBe(CellState.GROUND); // sol
        expect(s[1][3]).toBe(CellState.OBSTACLE); // 2 → case obstacle (bloc 3D)
        expect(s[3][3]).toBe(CellState.OBSTACLE);
        expect(s[2][2]).toBe(CellState.HOLE); // 1 intérieur → case impossible (noir)
        expect(s[0][0]).toBe(CellState.HOLE); // cadre 1 → case impossible (noir)
        expect(s[0][3]).toBe(CellState.HOLE);
        expect(s[4][5]).toBe(CellState.HOLE);
        expect(elevationOf(CellState.OBSTACLE)).toBe(1);
        expect(elevationOf(CellState.GROUND)).toBe(0);
    });

    it("classifyGrid : l'anneau central de la salle du boss Servitude (2 = obstacles 3D, 1 internes = noir)", () => {
        // Motif réel observé dans la salle du boss (Fers de la Tyrannie, debug.md) : l'anneau
        // de « 2 » devient des obstacles 3D homogènes, les « 1 » internes restent du noir.
        const grid = [
            [0, 0, 0, 0, 0, 0],
            [0, 0, 2, 1, 2, 0],
            [0, 2, 1, 1, 2, 0],
            [0, 2, 1, 1, 2, 0],
            [0, 0, 2, 1, 2, 0],
            [0, 0, 0, 0, 0, 0],
        ];
        const s = classifyGrid(grid);
        expect(s[1][2]).toBe(CellState.OBSTACLE); // l'anneau = obstacles 3D
        expect(s[1][4]).toBe(CellState.OBSTACLE);
        expect(s[2][1]).toBe(CellState.OBSTACLE);
        expect(s[2][4]).toBe(CellState.OBSTACLE);
        expect(s[3][1]).toBe(CellState.OBSTACLE);
        expect(s[4][2]).toBe(CellState.OBSTACLE);
        expect(s[1][3]).toBe(CellState.HOLE); // les « 1 » internes = noir
        expect(s[2][2]).toBe(CellState.HOLE);
        expect(s[2][3]).toBe(CellState.HOLE);
        expect(s[1][0]).toBe(CellState.GROUND);
    });
});

describe("dofus-grid — repère losange inverse + zones d'effet (AoE)", () => {
    it("losToXY est l'inverse de toLos", () => {
        for (const [x, y] of [[0, 0], [7, 20], [7, 21], [13, 39], [5, 12], [0, 1]] as const) {
            const los = toLos(x, y);
            const back = losToXY(los.x, los.y);
            expect(back.x).toBe(x);
            expect(back.y).toBe(y);
        }
    });

    it("spellZoneCells — Cercle taille 1 : cible + voisins à distance ≤1, pas plus", () => {
        const cells = spellZoneCells({
            zone: { shape: "Cercle", size: 1, range: 0 },
            target: { x: 7, y: 20 },
            caster: { x: 7, y: 14 },
            cols: 14,
            rows: 40,
        });
        expect(cells).toContainEqual({ x: 7, y: 20 }); // la cible
        expect(cells).toContainEqual({ x: 7, y: 21 }); // voisin vertical (distance 1)
        expect(cells).not.toContainEqual({ x: 7, y: 22 }); // distance 2 exclue
    });

    it("spellZoneCells — Croix : axes losange à travers la cible", () => {
        const cells = spellZoneCells({
            zone: { shape: "Croix", size: 1, range: 0 },
            target: { x: 7, y: 20 },
            caster: { x: 7, y: 14 },
            cols: 14,
            rows: 40,
        });
        expect(cells).toContainEqual({ x: 7, y: 20 });
        expect(cells).toContainEqual({ x: 7, y: 21 });
        expect(cells).toContainEqual({ x: 7, y: 19 });
        expect(cells.length).toBeGreaterThan(1);
    });

    it("spellZoneCells — bornes de la grille respectées (pas de coordonnées hors-map)", () => {
        const cells = spellZoneCells({
            zone: { shape: "Cercle", size: 5, range: 0 },
            target: { x: 0, y: 0 },
            caster: { x: 0, y: 0 },
            cols: 5,
            rows: 5,
        });
        expect(cells.length).toBeGreaterThan(0);
        for (const c of cells) {
            expect(c.x).toBeGreaterThanOrEqual(0);
            expect(c.x).toBeLessThan(5);
            expect(c.y).toBeGreaterThanOrEqual(0);
            expect(c.y).toBeLessThan(5);
        }
    });
});
