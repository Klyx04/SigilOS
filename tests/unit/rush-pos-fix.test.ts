import { describe, expect, it } from "vitest";

import { planRushPosFix, type RushPosTag } from "@/lib/rush-pos-fix";

/**
 * Réparation des positions — cas réels mesurés le 22/11/2026.
 *  - Blessures de Guerre (24) : « Le jour le plus long » est en worldId 1 ;
 *  - Temple Céleste (41) : « Réponses à tout » est en worldId 1 ;
 *  - `Mort et renouveau` : carte absente de worldmap.json mais HD présente.
 */

const MAPS = new Map([
  [201588736, { id: 201588736, worldMap: 24 }],
  [241443329, { id: 241443329, worldMap: 41 }],
  [202899462, { id: 202899462, worldMap: 2 }],
  [88080662, { id: 88080662, worldMap: 1 }],
]);
const WORLD_IDS = new Set([1, 2, 24, 41]);
const HD = new Set([201588736, 241443329, 202899462, 999]);
const IMAGES = new Map<number, string | null>([
  [2111, "/game-data/hd_maps/201588736.webp"],
  [1631, "/game-data/hd_maps/241443329.webp"],
  [42, "/game-data/hd_maps/202899462.webp"],
  [43, "/game-data/hd_maps/999.webp"],
  [44, "/game-data/hd_maps/888.webp"],
]);

const tag = (overrides: Partial<RushPosTag> = {}): RushPosTag => ({
  type: "pos_tags",
  name: "[0,0]",
  allowZaap: true,
  ...overrides,
});

const plan = (tagValue: RushPosTag, questIds: number[]) =>
  planRushPosFix({
    tag: tagValue,
    questIds,
    imagesByQuest: IMAGES,
    mapById: MAPS,
    worldIds: WORLD_IDS,
    hdMapIds: HD,
  });

describe("positions Rush — réparation monde + carte", () => {
  it("corrige Blessures de Guerre : monde 1 → 24, carte 201588736", () => {
    const result = plan(tag({ worldId: 1 }), [2111]);

    expect(result).toMatchObject({
      status: "fix",
      worldId: 24,
      mapId: 201588736,
      questId: 2111,
    });
  });

  it("corrige Temple Céleste : monde 1 → 41, carte 241443329", () => {
    const result = plan(tag({ worldId: 1 }), [1631]);

    expect(result).toMatchObject({
      status: "fix",
      worldId: 41,
      mapId: 241443329,
    });
  });

  it("ajoute la carte quand le monde est déjà bon", () => {
    const result = plan(tag({ worldId: 41 }), [1631]);

    expect(result).toMatchObject({
      status: "fix",
      worldId: 41,
      mapId: 241443329,
    });
  });

  it("ne touche pas une position déjà alignée", () => {
    const result = plan(tag({ worldId: 24, mapId: 201588736 }), [2111]);

    expect(result.status).toBe("already");
  });

  it("pose seulement la carte quand elle est absente de worldmap.json mais HD présente", () => {
    const result = plan(tag({ worldId: 1 }), [43]);

    expect(result).toMatchObject({ status: "fix-map", mapId: 999, mapWorld: null });
  });

  it("ne corrige rien si ni worldmap ni HD ne connaissent la carte", () => {
    const result = plan(tag({ worldId: 1 }), [44]);

    expect(result.status).toBe("none");
  });

  it("refuse d'arbitrer plusieurs cartes différentes", () => {
    const result = plan(tag({ worldId: 1 }), [2111, 1631]);

    expect(result.status).toBe("ambiguous");
  });

  it("conserve les champs du tag (zaap manuel, nom)", () => {
    const result = plan(tag({ worldId: 1, name: "0,0", zaapX: 3, zaapY: 4 }), [2111]);

    expect(result.status).toBe("fix");
    expect(tag({ worldId: 1, name: "0,0", zaapX: 3, zaapY: 4 })).toMatchObject({
      zaapX: 3,
      zaapY: 4,
      name: "0,0",
    });
  });
});
