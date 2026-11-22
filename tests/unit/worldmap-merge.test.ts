import { describe, expect, it } from "vitest";

import {
  ExcludedWorldError,
  mergeSubworldData,
  type DofusDbMapPosition,
  type DofusDbSubarea,
  type WorldRecord,
  type WorldmapFile,
} from "@/lib/worldmap-merge";

/**
 * Intégration d'un sous-monde — le cas réel du **Temple Céleste** (monde 41,
 * DofusDB 23/06/2026) : 3 cartes dans la sous-zone 446, absentes de notre
 * `worldmap.json` du 16/04/2026.
 */

const WORLD: WorldRecord = {
  id: 41,
  name: { fr: "Temple Céleste" },
  origineX: -395,
  origineY: -555,
  mapWidth: 910,
  mapHeight: 660,
  totalWidth: 3763,
  totalHeight: 2263,
  zoom: [1, 0.75, 0.5, 0.25],
  visibleOnMap: true,
};

const MAPS: DofusDbMapPosition[] = [
  { id: 241443329, posX: 1, posY: 1, subAreaId: 446, worldMap: 41, outdoor: true },
  { id: 241444353, posX: 2, posY: 2, subAreaId: 446, worldMap: 41, outdoor: true },
  { id: 241445377, posX: 3, posY: 3, subAreaId: 446, worldMap: 41, outdoor: true },
];

const SUBAREA: DofusDbSubarea = {
  id: 446,
  name: { fr: "Temple Céleste" },
  areaId: 45,
  level: 1,
  shape: [-4, -3],
};

const EMPTY_WORLDMAP: WorldmapFile = { subareas: [], maps: [] };

describe("worldmap — intégration ciblée d'un sous-monde", () => {
  it("ajoute le monde, ses 3 cartes et sa sous-zone", () => {
    const { worlds, worldmap, report } = mergeSubworldData({
      worlds: [],
      worldmap: EMPTY_WORLDMAP,
      world: WORLD,
      maps: MAPS,
      subareas: [SUBAREA],
    });

    expect(report).toMatchObject({
      worldId: 41,
      worldName: "Temple Céleste",
      worldAdded: true,
      mapsAdded: 3,
      mapsAlreadyPresent: 0,
      subareasAdded: 1,
      conflicts: [],
    });
    expect(worlds).toEqual([WORLD]);
    expect(worldmap.maps.map((map) => map.id)).toEqual([241443329, 241444353, 241445377]);
    expect(worldmap.maps[0]).toMatchObject({ x: 1, y: 1, worldMap: 41, subAreaId: 446 });
    expect(worldmap.subareas).toEqual([
      { id: 446, name: "Temple Céleste", areaId: 45, level: 1, shape: [-4, -3] },
    ]);
  });

  it("est idempotent : un second passage n'ajoute rien", () => {
    const first = mergeSubworldData({
      worlds: [],
      worldmap: EMPTY_WORLDMAP,
      world: WORLD,
      maps: MAPS,
      subareas: [SUBAREA],
    });
    const second = mergeSubworldData({
      worlds: first.worlds,
      worldmap: first.worldmap,
      world: WORLD,
      maps: MAPS,
      subareas: [SUBAREA],
    });

    expect(second.report).toMatchObject({
      worldAdded: false,
      mapsAdded: 0,
      mapsAlreadyPresent: 3,
      subareasAdded: 0,
      conflicts: [],
    });
    expect(second.worlds).toHaveLength(1);
    expect(second.worldmap.maps).toHaveLength(3);
    expect(second.worldmap.subareas).toHaveLength(1);
  });

  it("refuse les mondes exclus 19 et 29", () => {
    for (const id of [19, 29]) {
      expect(() =>
        mergeSubworldData({
          worlds: [],
          worldmap: EMPTY_WORLDMAP,
          world: { id, name: { fr: "Exclu" } },
          maps: [],
          subareas: [],
        })
      ).toThrow(ExcludedWorldError);
    }
  });

  it("ne réécrit ni un monde existant, ni une sous-zone existante", () => {
    const existingWorld: WorldRecord = { id: 41, name: { fr: "Nom ajusté" }, totalHeight: 9999 };
    const existingSubarea = { id: 446, name: "Zone manuelle", areaId: 45, level: 1, shape: [1, 2] };
    const { worlds, worldmap, report } = mergeSubworldData({
      worlds: [existingWorld],
      worldmap: { subareas: [existingSubarea], maps: [] },
      world: WORLD,
      maps: MAPS,
      subareas: [SUBAREA],
    });

    expect(report.worldAdded).toBe(false);
    expect(report.subareasAdded).toBe(0);
    expect(worlds).toEqual([existingWorld]);
    expect(worldmap.subareas).toEqual([existingSubarea]);
  });

  it("signale un conflit de carte sans l'écraser", () => {
    const existingMap = { id: 241443329, x: 0, y: 0, subAreaId: 10, worldMap: 2 };
    const { worldmap, report } = mergeSubworldData({
      worlds: [],
      worldmap: { subareas: [], maps: [existingMap] },
      world: WORLD,
      maps: MAPS,
      subareas: [SUBAREA],
    });

    expect(report.mapsAdded).toBe(2);
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]).toContain("241443329");
    expect(worldmap.maps[0]).toEqual(existingMap);
  });

  it("refuse une carte dont le worldMap ne correspond pas au monde demandé", () => {
    const { worldmap, report } = mergeSubworldData({
      worlds: [],
      worldmap: EMPTY_WORLDMAP,
      world: WORLD,
      maps: [{ id: 999, posX: 1, posY: 1, subAreaId: 446, worldMap: 2 }],
      subareas: [],
    });

    expect(report.mapsAdded).toBe(0);
    expect(report.conflicts).toHaveLength(1);
    expect(worldmap.maps).toHaveLength(0);
  });
});
