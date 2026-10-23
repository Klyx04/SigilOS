/**
 * Peinture de cases du simulateur — comportement de la règle pure.
 *
 * 🔒 Ce que ces verrous tiennent (mesure du 23/10/2026) :
 *  · la peinture est **cloisonnée par carte** (peindre sur A ne salit pas B) ;
 *  · re-cliquer efface, changer de mode remplace ;
 *  · une case **hors grille** est écartée (sinon « Vider (2) » sans rien à l'écran) ;
 *  · l'ancien stockage plat est migré sans perte ;
 *  · le rendu **surligne** les cases peintes (un trou noir sur fond noir ne montrait rien).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
    clearPaintedCells,
    countPaintedCells,
    mapPaintKey,
    migrateStoredPaint,
    readPaintedCells,
    sanitizePaintedCells,
    togglePaintedCell,
} from "@/lib/sim-paint";

describe("peinture de cases — cloisonnement par carte", () => {
    it("une carte vide tombe sur la clé « empty »", () => {
        expect(mapPaintKey(null)).toBe("empty");
        expect(mapPaintKey("   ")).toBe("empty");
        expect(mapPaintKey("map-42")).toBe("map-42");
    });

    it("peindre sur une carte ne touche pas l'autre", () => {
        let byMap = togglePaintedCell({}, "map-a", 3, 4, "obstacle");
        byMap = togglePaintedCell(byMap, "map-b", 0, 0, "hole");

        expect(readPaintedCells(byMap, "map-a")).toEqual({ "3,4": "obstacle" });
        expect(readPaintedCells(byMap, "map-b")).toEqual({ "0,0": "hole" });
        expect(readPaintedCells(byMap, "map-c")).toEqual({});
    });

    it("re-cliquer avec le même mode efface, avec l'autre mode remplace", () => {
        let byMap = togglePaintedCell({}, "map-a", 1, 1, "obstacle");
        byMap = togglePaintedCell(byMap, "map-a", 1, 1, "obstacle");
        expect(countPaintedCells(readPaintedCells(byMap, "map-a"))).toBe(0);

        byMap = togglePaintedCell(byMap, "map-a", 2, 2, "obstacle");
        byMap = togglePaintedCell(byMap, "map-a", 2, 2, "hole");
        expect(readPaintedCells(byMap, "map-a")["2,2"]).toBe("hole");
    });

    it("« Vider » ne vide que la carte courante", () => {
        let byMap = togglePaintedCell({}, "map-a", 1, 1, "hole");
        byMap = togglePaintedCell(byMap, "map-b", 2, 2, "hole");
        byMap = clearPaintedCells(byMap, "map-a");

        expect(readPaintedCells(byMap, "map-a")).toEqual({});
        expect(readPaintedCells(byMap, "map-b")).toEqual({ "2,2": "hole" });
    });
});

describe("peinture de cases — entrées non fiables", () => {
    it("ignore une case hors de la grille rendue", () => {
        const cells = { "0,0": "obstacle", "12,3": "hole", "-1,0": "hole" } as const;
        expect(sanitizePaintedCells(cells, 10, 10)).toEqual({ "0,0": "obstacle" });
        expect(sanitizePaintedCells(cells, 0, 0)).toEqual({});
    });

    it("écarte une valeur inconnue et une coordonnée non entière", () => {
        expect(readPaintedCells({ "map-a": { "1,1": "mur", "2,2": "hole", "a,b": "hole" } }, "map-a")).toEqual({
            "2,2": "hole",
        });
    });

    it("migre l'ancien stockage plat vers la carte courante", () => {
        const migrated = migrateStoredPaint({ paintedCells: { "3,3": "obstacle", "4,4": "x" } }, "map-a");
        expect(migrated).toEqual({ "map-a": { "3,3": "obstacle" } });
        expect(migrateStoredPaint(null, "map-a")).toEqual({});
    });

    it("relit le nouveau format tel quel", () => {
        const stored = { paintedByMap: { "map-a": { "1,2": "hole" } } };
        expect(migrateStoredPaint(stored, "map-a")).toEqual({ "map-a": { "1,2": "hole" } });
    });
});

describe("rendu — une case peinte reste visible", () => {
    const GRID = readFileSync(path.join(process.cwd(), "src/components/succes/SpellRangeGrid.tsx"), "utf8");

    it("surlligne toute case peinte, indépendamment du terrain", () => {
        // Constat user : « Vider (6) » et rien à l'écran (trou noir sur fond noir, ou hors sol).
        expect(GRID).toContain("Passe 3 — PEINTURE");
        expect(GRID).toContain("key={`paint-${key}`}");
        expect(GRID).toContain('strokeDasharray="4 3"');
        expect(GRID).toContain('stroke={hole ? "#ffffff" : "#ffcf5e"}');
    });

    it("une case peinte hors du sol d'origine est tout de même rendue", () => {
        expect(GRID).toContain("const isPaintedCell = (cc: number, rr: number) => !!paintedCells[`${cc},${rr}`];");
        expect(GRID).toContain("if (cellState(c, r) === CellState.VOID && !isPaintedCell(c, r)) continue;");
    });
});
