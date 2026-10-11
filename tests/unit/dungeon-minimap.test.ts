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

/** Monde 9 — grille 6×5 à l'échelle 0,5 (Rat Noir : centre en colonne 0). */
const WORLD_9: MinimapWorld = {
    id: 9,
    origineX: 7454,
    origineY: -5652,
    mapWidth: 257,
    mapHeight: 182,
    totalWidth: 2840,
    totalHeight: 2162,
    zoom: [1, 0.75, 0.5, 0.25],
};

/** Monde 36 — grille 4×4 à l'échelle 0,5 : plus petite que la fenêtre 5×3. */
const WORLD_36: MinimapWorld = {
    id: 36,
    origineX: 1568,
    origineY: -2665,
    mapWidth: 183,
    mapHeight: 130,
    totalWidth: 1842,
    totalHeight: 1585,
    zoom: [1, 0.75, 0.5, 0.25],
};

describe("encart donjon — tuile et repère Bouftou Royal", () => {
    it("calcule la tuile w1/0.6/184 avec le repère à ~96,9 % / ~87 %", () => {
        const tile = resolveMinimapTile(WORLD_1, 2, -34);
        expect(tile?.tileUrl).toBe("/game-data/tiles/w1/0.6/184.webp");
        expect(tile?.leftPct).toBeCloseTo(96.9, 1);
        expect(tile?.topPct).toBeCloseTo(86.97, 1);
        expect(tile?.mapHref).toBe("/carte-du-monde?play=1&x=2&y=-34&zoom=-2&world=1");
    });

    it("le repère reste dans la tuile (0-100 %) et l'index dans la grille", () => {
        const tile = resolveMinimapTile(WORLD_1, 2, -34);
        expect(tile).not.toBeNull();
        expect(tile!.leftPct).toBeGreaterThanOrEqual(0);
        expect(tile!.leftPct).toBeLessThan(100);
        expect(tile!.topPct).toBeGreaterThanOrEqual(0);
        expect(tile!.topPct).toBeLessThan(100);
        // Grille 24×20 à l'échelle 0,6 (tuile 250 px) : index 184 — jamais hors borne.
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
        expect(grid!.leftPct).toBeCloseTo(65.63, 1);
        expect(grid!.topPct).toBeCloseTo(62.32, 1);
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
        expect(grid!.leftPct).toBeCloseTo(59.38, 1);
        expect(grid!.topPct).toBeCloseTo(62.32, 1);
    });

    // ── Bords de monde : la fenêtre est ROGNÉE dans la grille ─────────────────
    // Avant, une tuile hors grille était demandée telle quelle (404) et rendue
    // en aplat « océan » : mesuré le 11/10/2026, 21 donjons sur 109 (12 mondes).
    // Ces deux cas figent le rognage (glissement) et le rétrécissement.

    it("monde 9 : fenêtre glissée dans la grille 6×5, aucune tuile hors grille", () => {
        const grid = resolveMinimapLandscape(WORLD_9, -28, 37);
        expect(grid).not.toBeNull();
        expect(grid!.cols).toBe(5);
        expect(grid!.rows).toBe(3);
        expect(grid!.tiles.map((t) => t.tileUrl)).toEqual([
            "/game-data/tiles/w9/0.5/7.webp",
            "/game-data/tiles/w9/0.5/8.webp",
            "/game-data/tiles/w9/0.5/9.webp",
            "/game-data/tiles/w9/0.5/10.webp",
            "/game-data/tiles/w9/0.5/11.webp",
            "/game-data/tiles/w9/0.5/13.webp",
            "/game-data/tiles/w9/0.5/14.webp",
            "/game-data/tiles/w9/0.5/15.webp",
            "/game-data/tiles/w9/0.5/16.webp",
            "/game-data/tiles/w9/0.5/17.webp",
            "/game-data/tiles/w9/0.5/19.webp",
            "/game-data/tiles/w9/0.5/20.webp",
            "/game-data/tiles/w9/0.5/21.webp",
            "/game-data/tiles/w9/0.5/22.webp",
            "/game-data/tiles/w9/0.5/23.webp",
        ]);
        // Le donjon n'est plus centré (il est au bord) mais reste dans la fenêtre.
        expect(grid!.leftPct).toBeCloseTo(15.46, 1);
        expect(grid!.topPct).toBeCloseTo(44.87, 1);
    });

    it("monde 36 : grille 4×4 plus petite que la fenêtre ⇒ elle rétrécit (4×3)", () => {
        const grid = resolveMinimapLandscape(WORLD_36, -2, 25);
        expect(grid).not.toBeNull();
        expect(grid!.cols).toBe(4);
        expect(grid!.rows).toBe(3);
        expect(grid!.tiles).toHaveLength(12);
        expect(grid!.tiles.map((t) => t.tileUrl)).toEqual([
            "/game-data/tiles/w36/0.5/1.webp",
            "/game-data/tiles/w36/0.5/2.webp",
            "/game-data/tiles/w36/0.5/3.webp",
            "/game-data/tiles/w36/0.5/4.webp",
            "/game-data/tiles/w36/0.5/5.webp",
            "/game-data/tiles/w36/0.5/6.webp",
            "/game-data/tiles/w36/0.5/7.webp",
            "/game-data/tiles/w36/0.5/8.webp",
            "/game-data/tiles/w36/0.5/9.webp",
            "/game-data/tiles/w36/0.5/10.webp",
            "/game-data/tiles/w36/0.5/11.webp",
            "/game-data/tiles/w36/0.5/12.webp",
        ]);
    });

    it("reprend la formule du renderer (garde anti-dérive)", () => {
        const core = readFileSync("src/components/worldmap/leaflet-map-core.tsx", "utf8");
        expect(core).toContain("const index = coords.y * apiCols + coords.x + 1;");
        expect(core).toContain("Math.ceil((activeWorld.totalWidth * gridScale) / tileSize)");
        // Pas de tuile = `WORLDMAP_TILE_SIZE` partout, et **aucun** facteur de
        // calibration appliqué au monde 1 : le x1.024 (256/250) étirait la carte de
        // 2,4 % face à la grille des coordonnées et faisait demander une colonne
        // fantôme (41×33 au lieu de 40×32).
        expect(core).toContain("const tileSize = WORLDMAP_TILE_SIZE;");
        expect(core).not.toMatch(/\*\s*1\.024/);
    });
});
