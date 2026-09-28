/**
 * Encart statique « zone » — tracé officiel de la sous-zone (worldmap.json)
 * projeté dans une fenêtre de tuiles, sans Leaflet.
 *
 * Référence mesurée : sous-zone 1 « Port de Madrestam » (monde 1,
 * tracé x 6→15 / y -10→2).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    isPlaceholderZoneShape,
    parseZoneShape,
    resolveSubAreaCenter,
    resolveZoneMinimap,
    zoneTileSize,
} from "@/lib/zone-minimap";
import type { MinimapWorld } from "@/lib/dungeon-minimap";

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

const WORLD_2: MinimapWorld = {
    id: 2,
    origineX: 1800,
    origineY: 1940,
    mapWidth: 380,
    mapHeight: 260,
    totalWidth: 4750,
    totalHeight: 3904,
    zoom: [1, 0.75, 0.5, 0.25],
};

const RAW_WORLDMAP = JSON.parse(readFileSync("public/game-data/worldmap.json", "utf8")) as {
    subareas: Array<{ id: number; name: string; shape?: number[] }>;
    maps: Array<{ id: number; x: number; y: number; subAreaId?: number | null; worldMap: number }>;
};

const subarea = (id: number) => RAW_WORLDMAP.subareas.find((s) => s.id === id)!;

const MAPS_BY_SUB_AREA_ID = (() => {
    const index = new Map<number, Array<{ x: number; y: number; worldMap: number }>>();
    for (const map of RAW_WORLDMAP.maps) {
        if (map.subAreaId == null) continue;
        if (!index.has(map.subAreaId)) index.set(map.subAreaId, []);
        index.get(map.subAreaId)!.push(map);
    }
    return index;
})();

const centerOf = (ids: number[]) =>
    resolveSubAreaCenter(ids, RAW_WORLDMAP.subareas, MAPS_BY_SUB_AREA_ID);

describe("parseZoneShape", () => {
    it("ignore les en-têtes de tête et garde les trois polygones du tracé", () => {
        const frame = parseZoneShape(subarea(1).shape);
        expect(frame).not.toBeNull();
        expect(frame!.polygons.map((p) => p.length)).toEqual([117, 5, 5]);
        expect(frame!.bounds).toEqual({ minX: 6, maxX: 15, minY: -10, maxY: 2 });
        expect(frame!.polygons[0][0]).toEqual({ x: 6, y: -4 });
    });

    it("sépare deux polygones sur valeur d'en-tête et ignore les tracés trop courts", () => {
        const frame = parseZoneShape([2000, 2000, 0, 0, 1, 0, 1, 1, 2000, 2000, 5, 5, 6, 5, 6, 6]);
        expect(frame).not.toBeNull();
        expect(frame!.polygons).toEqual([
            [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
            [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }],
        ]);
        // Un polygone de moins de trois points n'est jamais rendu.
        expect(parseZoneShape([0, 0, 1, 0, 2000, 2000])).toBeNull();
    });

    it("retourne null sans tracé exploitable", () => {
        expect(parseZoneShape(null)).toBeNull();
        expect(parseZoneShape([])).toBeNull();
        expect(parseZoneShape([1, 2, 3, 4])).toBeNull();
        expect(parseZoneShape([2000, 2000, 2000, 2000])).toBeNull();
    });
});

describe("resolveZoneMinimap — sous-zone 1 (Port de Madrestam)", () => {
    const minimap = resolveZoneMinimap(WORLD_1, subarea(1).shape);

    it("cadre la zone dans 3×3 tuiles à l'échelle 0.6", () => {
        expect(minimap).not.toBeNull();
        expect(minimap!.cols).toBe(3);
        expect(minimap!.rows).toBe(3);
        expect(minimap!.zoom).toBe(-2);
        expect(minimap!.widthPx).toBe(768);
        expect(minimap!.tiles.map((t) => t.tileUrl)).toEqual([
            "/game-data/tiles/w1/0.6/256.webp",
            "/game-data/tiles/w1/0.6/257.webp",
            "/game-data/tiles/w1/0.6/258.webp",
            "/game-data/tiles/w1/0.6/280.webp",
            "/game-data/tiles/w1/0.6/281.webp",
            "/game-data/tiles/w1/0.6/282.webp",
            "/game-data/tiles/w1/0.6/304.webp",
            "/game-data/tiles/w1/0.6/305.webp",
            "/game-data/tiles/w1/0.6/306.webp",
        ]);
        expect(minimap!.mapHref).toBe("/carte-du-monde?play=1&x=11&y=-4&zoom=-2&world=1");
    });

    it("projette le tracé dans la fenêtre (premier point mesuré 319.1,302)", () => {
        expect(minimap!.polygons).toHaveLength(3);
        expect(minimap!.polygons[0].startsWith("319.1,302 ")).toBe(true);
        const points = minimap!.polygons.join(" ").split(" ").map((p) => p.split(",").map(Number));
        for (const [x, y] of points) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(minimap!.widthPx);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(minimap!.heightPx);
        }
    });

    it("place l'icône au centre de la zone (centroïde mesuré 66,4 % / 46,4 %)", () => {
        expect(minimap!.focusLeftPct).toBeCloseTo(66.42, 1);
        expect(minimap!.focusTopPct).toBeCloseTo(46.43, 1);
    });

    it("retombe sur le centre fourni quand la zone n'a pas de tracé", () => {
        const fallback = resolveZoneMinimap(WORLD_1, null, { fallbackCenter: { x: 10, y: -4 } });
        expect(fallback).not.toBeNull();
        expect(fallback!.polygons).toEqual([]);
        expect(fallback!.focusLeftPct).toBeGreaterThanOrEqual(0);
        expect(fallback!.focusLeftPct).toBeLessThanOrEqual(100);
        expect(fallback!.focusTopPct).toBeGreaterThanOrEqual(0);
        expect(fallback!.focusTopPct).toBeLessThanOrEqual(100);
        expect(fallback!.cols).toBeLessThanOrEqual(5);
        expect(fallback!.rows).toBeLessThanOrEqual(3);
        // Sans tracé ni centre : aucun encart.
        expect(resolveZoneMinimap(WORLD_1, null)).toBeNull();
    });

    it("dézoome pour les très grandes zones sans jamais déformer la fenêtre", () => {
        const huge = resolveZoneMinimap(WORLD_1, [-60, -60, 60, -60, 60, 60, -60, 60]);
        expect(huge).not.toBeNull();
        expect(huge!.zoom).toBe(-4);
        expect(huge!.cols).toBe(5);
        expect(huge!.rows).toBe(3);
        expect(huge!.widthPx / huge!.heightPx).toBeCloseTo(5 / 3, 5);
    });

    it("taille de tuile : 256 px (monde 1) / 250 px (autres mondes)", () => {
        expect(zoneTileSize(1)).toBe(256);
        expect(zoneTileSize(2)).toBe(250);
        const incarnam = resolveZoneMinimap(WORLD_2, [0, 0, 1, 0, 1, 1, 0, 1]);
        expect(incarnam).not.toBeNull();
        expect(incarnam!.tiles.every((t) => t.tileUrl === null || t.tileUrl.startsWith("/game-data/tiles/w2/"))).toBe(true);
    });
});

describe("isPlaceholderZoneShape", () => {
    it("reconnaît le carré 1×1 collé à l'origine (9 sous-zones du fichier réel)", () => {
        expect(isPlaceholderZoneShape(parseZoneShape([0, 0, 1, 0, 1, 1, 0, 1]))).toBe(true);
        expect(isPlaceholderZoneShape(parseZoneShape(subarea(904).shape))).toBe(true); // Songes Infinis
        expect(isPlaceholderZoneShape(parseZoneShape(subarea(1125).shape))).toBe(true); // Dofus Games
    });

    it("laisse passer une vraie zone, même minuscule et proche de l'origine", () => {
        // Sous-zone 442 « Lac » : tracé réel x -2→1 / y -2→2 (41 points).
        expect(isPlaceholderZoneShape(parseZoneShape(subarea(442).shape))).toBe(false);
        expect(isPlaceholderZoneShape(parseZoneShape(subarea(1).shape))).toBe(false);
        expect(isPlaceholderZoneShape(null)).toBe(true);
    });
});

describe("resolveSubAreaCenter", () => {
    it("« Lac gelé » (615) : centroïde du tracé, PAS le tas (0, 0) de ses 94 maps", () => {
        // Mesure : 99 maps dont 94 en (0, 0) ; tracé x -72→-57 / y -61→-47.
        const center = centerOf([615]);
        expect(center).toEqual({ x: -65, y: -54, subAreaId: 615, source: "shape", worldId: 1 });
    });

    it("« Marécages sans fond » (233) : idem, 5 maps en (0, 0) ignorées", () => {
        expect(centerOf([233])).toEqual({ x: -8, y: 5, subAreaId: 233, source: "shape", worldId: 1 });
    });

    it("sans tracé : repli sur la première map positionnée", () => {
        // Sous-zone 461 « Arche d'Otomaï » : aucun tracé, 6 maps, toutes worldMap -1.
        expect(centerOf([461])).toEqual({ x: -55, y: -4, subAreaId: 461, source: "map", worldId: 1 });
    });

    it("le monde suit la sous-zone retenue (Frigost → monde 12 ici)", () => {
        const center = centerOf([788]); // Bastion des froides légions
        expect(center!.worldId).toBe(12);
        expect(center!.source).toBe("shape");
    });

    it("aucune position inventée : tracé sentinelle ou liste vide → null", () => {
        expect(centerOf([904])).toBeNull(); // Songes Infinis : carré sentinelle + 484 maps en (0, 0)
        expect(centerOf([])).toBeNull();
        expect(centerOf([999999])).toBeNull();
        expect(resolveSubAreaCenter(null, RAW_WORLDMAP.subareas, MAPS_BY_SUB_AREA_ID)).toBeNull();
    });

    it("priorité au tracé : première sous-zone AVEC tracé, sinon première map positionnée", () => {
        // 461 n'a pas de tracé → 233 gagne, même placée après.
        expect(centerOf([461, 233])!.subAreaId).toBe(233);
        expect(centerOf([233, 461])!.subAreaId).toBe(233);
        // Deux tracés : l'ordre de la liste décide.
        expect(centerOf([233, 1])!.subAreaId).toBe(233);
        expect(centerOf([1, 233])!.subAreaId).toBe(1);
    });
});

describe("robustesse sur le fichier réel", () => {
    it("toutes les sous-zones du monde 1 produisent un encart valide (borné 5×3)", () => {
        expect(RAW_WORLDMAP.subareas.length).toBeGreaterThan(500);
        for (const zone of RAW_WORLDMAP.subareas) {
            const minimap = resolveZoneMinimap(WORLD_1, zone.shape, { fallbackCenter: { x: 0, y: 0 } });
            expect(minimap).not.toBeNull();
            expect(minimap!.cols).toBeGreaterThanOrEqual(1);
            expect(minimap!.cols).toBeLessThanOrEqual(5);
            expect(minimap!.rows).toBeGreaterThanOrEqual(1);
            expect(minimap!.rows).toBeLessThanOrEqual(3);
            expect(minimap!.tiles).toHaveLength(minimap!.cols * minimap!.rows);
            expect(minimap!.tiles.every((t) => t.tileUrl === null || t.tileUrl.startsWith("/game-data/tiles/w1/"))).toBe(true);
            expect(minimap!.focusLeftPct).toBeGreaterThanOrEqual(0);
            expect(minimap!.focusLeftPct).toBeLessThanOrEqual(100);
            expect(minimap!.focusTopPct).toBeGreaterThanOrEqual(0);
            expect(minimap!.focusTopPct).toBeLessThanOrEqual(100);
        }
    });

    it("toutes les sous-zones à tracé réel : le centre tombe dans le tracé, jamais (0, 0)", () => {
        let checked = 0;
        for (const zone of RAW_WORLDMAP.subareas) {
            const frame = parseZoneShape(zone.shape);
            if (isPlaceholderZoneShape(frame)) continue; // tracé sentinelle : aucun centre
            const center = centerOf([zone.id]);
            expect(center, `sous-zone ${zone.id} (${zone.name})`).not.toBeNull();
            expect(center!.x, `x de la sous-zone ${zone.id}`).toBeGreaterThanOrEqual(frame!.bounds.minX - 1);
            expect(center!.x, `x de la sous-zone ${zone.id}`).toBeLessThanOrEqual(frame!.bounds.maxX + 1);
            expect(center!.y, `y de la sous-zone ${zone.id}`).toBeGreaterThanOrEqual(frame!.bounds.minY - 1);
            expect(center!.y, `y de la sous-zone ${zone.id}`).toBeLessThanOrEqual(frame!.bounds.maxY + 1);
            const boundsCoverOrigin = frame!.bounds.minX <= 0 && frame!.bounds.maxX >= 0
                && frame!.bounds.minY <= 0 && frame!.bounds.maxY >= 0;
            if (!boundsCoverOrigin) {
                expect([center!.x, center!.y], `sentinelle (0, 0) publiée pour la sous-zone ${zone.id}`).not.toEqual([0, 0]);
            }
            checked++;
        }
        expect(checked).toBeGreaterThan(300);
    });
});
