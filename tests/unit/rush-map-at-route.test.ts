import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Route `GET /api/rush/map-at` — carte HD d'une position Rush.
 *
 * Trois contrats verrouillés ici :
 *  - la carte **imposée en God** (`mapId`) est prioritaire (elle était dans un
 *    commentaire : `mapParam` n'était jamais lu) ;
 *  - le **monde** demandé filtre la résolution (même case dans plusieurs mondes) ;
 *  - `(0,0)` ne rend **jamais** de carte, même avec un `mapId` valide.
 */

const existsSyncMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: existsSyncMock };
});

vi.mock("@/server/game/worldmap-data", () => ({
  getWorldmapData: () => ({
    maps: [
      { id: 10, x: 5, y: 5, worldMap: 1 },
      { id: 20, x: 5, y: 5, worldMap: 9 },
      { id: 160, x: -32, y: -58, worldMap: 1 },
    ],
  }),
}));

import { GET } from "@/app/api/rush/map-at/route";

const EXISTING = new Set(["5", "10", "20", "160"]);

function req(query: string) {
  return new NextRequest(`http://localhost/api/rush/map-at${query}`);
}

beforeEach(() => {
  existsSyncMock.mockReset();
  existsSyncMock.mockImplementation((path: unknown) => {
    const match = /hd_maps[\\/](\d+)\.webp$/.exec(String(path));
    return Boolean(match) && EXISTING.has(match![1]);
  });
});

describe("GET /api/rush/map-at — carte HD", () => {
  it("rend la carte imposée en God quand le WebP existe", async () => {
    const res = await GET(req("?x=-32&y=-58&world=1&mapId=5"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      mapId: 5,
      imageUrl: "/game-data/hd_maps/5.webp",
      source: "god",
    });
  });

  it("retombe sur la résolution (x,y) si la carte imposée manque", async () => {
    const res = await GET(req("?x=-32&y=-58&world=1&mapId=999"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, mapId: 160 });
  });

  it("respecte le monde demandé quand la case existe dans plusieurs mondes", async () => {
    const res = await GET(req("?x=5&y=5&world=9"));

    expect(await res.json()).toMatchObject({ ok: true, mapId: 20, worldId: 9 });
  });

  it("sans monde, garde la première carte (compatibilité)", async () => {
    const res = await GET(req("?x=5&y=5"));

    expect(await res.json()).toMatchObject({ ok: true, mapId: 10 });
  });

  it("ne rend jamais de carte pour (0,0), même imposée", async () => {
    const res = await GET(req("?x=0&y=0&mapId=5"));

    expect(res.status).toBe(404);
  });

  it("refuse une coordonnée non entière", async () => {
    const res = await GET(req("?x=abc&y=5"));

    expect(res.status).toBe(400);
  });

  it("renvoie 404 quand aucune carte n'existe", async () => {
    const res = await GET(req("?x=999&y=999"));

    expect(res.status).toBe(404);
  });
});
