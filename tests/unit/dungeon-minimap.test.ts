/**
 * Encart statique donjon — la tuile + le repère reprennent la formule du
 * renderer Leaflet (même banque, même grille, même index).
 *
 * Référence mesurée : Bouftou Royal (x:2, y:-34, monde 1).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveMinimapGrid, resolveMinimapLandscape, resolveMinimapTile, type MinimapWorld } from "@/lib/dungeon-minimap";

const WORLD_1: MinimapWorld = {
    id: 1,
    origineX: 6480,
    origineY: 4944,
    mapWidth: 69.5,
    mapHeight: 49.70000076293945,
    totalWidth: 10000,
    totalHeight: 8000,
    zoom: [1, 0.800000011920929, 0.6000000238418579, 0.4000000059604645, 0.20000000298023224],
};

describe("encart donjon — tuile et repère Bouftou Royal", () => {
    it("calcule la tuile w1/0.6/184 avec le repère à ~59,5 % / ~68,5 %", () => {
        const tile = resolveMinimapTile(WORLD_1, 2, -34);
        expect(tile?.tileUrl).toBe("/game-data/tiles/w1/0.6/184.webp");
        expect(tile?.leftPct).toBeCloseTo(59.47, 1);
        expect(tile?.topPct).toBeCloseTo(68.52, 1);
        expect(tile?.mapHref).toBe("/carte-du-monde?play=1&x=2&y=-34&zoom=-2&world=1");
    });

    it("le repère reste dans la tuile (0-100 %) et l'index dans la grille", () => {
        const tile = resolveMinimapTile(WORLD_1, 2, -34);
        expect(tile).not.toBeNull();
        expect(tile!.leftPct).toBeGreaterThanOrEqual(0);
        expect(tile!.leftPct).toBeLessThan(100);
        expect(tile!.topPct).toBeGreaterThanOrEqual(0);
        expect(tile!.topPct).toBeLessThan(100);
        // Grille 24×19 à l'échelle 0,6 : index 184/456 — jamais hors borne.
        expect(tile!.tileUrl).toMatch(/^\/game-data\/tiles\/w1\/0\.6\/\d+\.webp$/);
    });

    it("hors grille ou coordonnées invalides = null (encart masqué)", () => {
        expect(resolveMinimapTile(WORLD_1, 5000, 5000)).toBeNull();
        expect(resolveMinimapTile(WORLD_1, Number.NaN, -34)).toBeNull();
    });

    it("grille 3x3 centrée : tuile centrale 184, repère au centre", () => {
        const grid = resolveMinimapGrid(WORLD_1, 2, -34);
        expect(grid).not.toBeNull();
        expect(grid!.tiles).toHaveLength(9);
        expect(grid!.tiles.map((t) => t.tileUrl)).toEqual([
            "/game-data/tiles/w1/0.6/159.webp",
            "/game-data/tiles/w1/0.6/160.webp",
            "/game-data/tiles/w1/0.6/161.webp",
            "/game-data/tiles/w1/0.6/183.webp",
            "/game-data/tiles/w1/0.6/184.webp",
            "/game-data/tiles/w1/0.6/185.webp",
            "/game-data/tiles/w1/0.6/207.webp",
            "/game-data/tiles/w1/0.6/208.webp",
            "/game-data/tiles/w1/0.6/209.webp",
        ]);
        expect(grid!.leftPct).toBeCloseTo(53.2, 1);
        expect(grid!.topPct).toBeCloseTo(56.2, 1);
        expect(grid!.mapHref).toBe("/carte-du-monde?play=1&x=2&y=-34&zoom=-2&world=1");
    });

    it("grille hors grille = null", () => {
        expect(resolveMinimapGrid(WORLD_1, 5000, 5000)).toBeNull();
    });

    it("paysage 5x3 : 15 tuiles, repère dans la tuile centrale", () => {
        const grid = resolveMinimapLandscape(WORLD_1, 2, -34);
        expect(grid).not.toBeNull();
        expect(grid!.cols).toBe(5);
        expect(grid!.rows).toBe(3);
        expect(grid!.tiles).toHaveLength(15);
        expect(grid!.tiles.map((t) => t.tileUrl)).toEqual([
            "/game-data/tiles/w1/0.6/158.webp",
            "/game-data/tiles/w1/0.6/159.webp",
            "/game-data/tiles/w1/0.6/160.webp",
            "/game-data/tiles/w1/0.6/161.webp",
            "/game-data/tiles/w1/0.6/162.webp",
            "/game-data/tiles/w1/0.6/182.webp",
            "/game-data/tiles/w1/0.6/183.webp",
            "/game-data/tiles/w1/0.6/184.webp",
            "/game-data/tiles/w1/0.6/185.webp",
            "/game-data/tiles/w1/0.6/186.webp",
            "/game-data/tiles/w1/0.6/206.webp",
            "/game-data/tiles/w1/0.6/207.webp",
            "/game-data/tiles/w1/0.6/208.webp",
            "/game-data/tiles/w1/0.6/209.webp",
            "/game-data/tiles/w1/0.6/210.webp",
        ]);
        // Centre horizontal de la grille, milieu vertical : jamais au bord.
        expect(grid!.leftPct).toBeCloseTo(51.9, 1);
        expect(grid!.topPct).toBeCloseTo(56.2, 1);
    });

    it("reprend la formule du renderer (garde anti-dérive)", () => {
        const core = readFileSync("src/components/worldmap/leaflet-map-core.tsx", "utf8");
        expect(core).toContain("const index = coords.y * apiCols + coords.x + 1;");
        expect(core).toContain("Math.ceil((activeWorld.totalWidth * gridScale) / tileSize)");
    });
});
