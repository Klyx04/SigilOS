import { describe, it, expect } from "vitest";
import {
    CellState,
    cellIdToXY,
    cellToScreen,
    distance,
    isWalkable,
    positionToCellId,
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

describe("dofus-grid — états de case (VOID/HOLE/GROUND/OBSTACLE/SPECIAL)", () => {
    it("stateFromValue : 0 = sol, 1 = obstacle, 2 = spécial, sinon void", () => {
        expect(stateFromValue(0)).toBe(CellState.GROUND);
        expect(stateFromValue(1)).toBe(CellState.OBSTACLE);
        expect(stateFromValue(2)).toBe(CellState.SPECIAL);
        expect(stateFromValue(5)).toBe(CellState.VOID);
    });

    it("isWalkable : sol et spécial walkables, obstacle non", () => {
        expect(isWalkable(CellState.GROUND)).toBe(true);
        expect(isWalkable(CellState.SPECIAL)).toBe(true);
        expect(isWalkable(CellState.OBSTACLE)).toBe(false);
        expect(isWalkable(CellState.VOID)).toBe(false);
        expect(isWalkable(CellState.HOLE)).toBe(false);
    });
});
