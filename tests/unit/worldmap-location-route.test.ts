/**
 * Route `GET /api/worldmap/location` — géométrie de zone pour les encarts
 * « Localisation ». Lecture réelle de `public/game-data/*.json` : le contrat
 * testé est celui que consomme `ZoneLocationCard`.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/worldmap/location/route";

const RAW_WORLDMAP = JSON.parse(readFileSync("public/game-data/worldmap.json", "utf8")) as {
    subareas: Array<{ id: number; name: string; shape?: number[] }>;
    maps: Array<{ id: number; subAreaId?: number | null }>;
};

function req(query: string) {
    return new NextRequest(`http://localhost/api/worldmap/location${query}`);
}

describe("GET /api/worldmap/location", () => {
    it("renvoie la zone demandée avec le tracé et le monde", async () => {
        const res = await GET(req("?zone=1&world=1"));
        expect(res.status).toBe(200);
        expect(res.headers.get("Cache-Control")).toContain("max-age=86400");

        const payload = await res.json();
        expect(payload.success).toBe(true);
        expect(payload.data.world.id).toBe(1);
        expect(payload.data.world.mapWidth).toBeGreaterThan(0);
        expect(payload.data.zones).toHaveLength(1);
        expect(payload.data.zones[0].id).toBe(1);
        expect(payload.data.zones[0].name).toBe(
            RAW_WORLDMAP.subareas.find((zone) => zone.id === 1)!.name
        );
        expect(Array.isArray(payload.data.zones[0].shape)).toBe(true);
        expect(payload.data.zones[0].shape.length).toBeGreaterThan(6);
    });

    it("résout la sous-zone d'une map (donjon) et déduplique les zones", async () => {
        const map = RAW_WORLDMAP.maps.find((entry) => Number.isInteger(entry.subAreaId));
        expect(map).toBeDefined();

        const res = await GET(req(`?map=${map!.id}&zone=${map!.subAreaId}&world=1`));
        const payload = await res.json();
        expect(payload.success).toBe(true);
        expect(payload.data.zones.map((zone: { id: number }) => zone.id)).toEqual([map!.subAreaId]);
    });

    it("fail-closed : aucune cible → 400, monde inconnu → 404", async () => {
        expect((await GET(req("?world=1"))).status).toBe(400);
        expect((await GET(req("?zone=0&world=1"))).status).toBe(400);
        expect((await GET(req("?zone=abc&world=1"))).status).toBe(400);
        expect((await GET(req("?zone=1&world=9999"))).status).toBe(404);
    });

    it("zone inconnue → aucune zone renvoyée (l'encart se masque)", async () => {
        const res = await GET(req("?zone=999999&world=1"));
        expect(res.status).toBe(200);
        const payload = await res.json();
        expect(payload.success).toBe(true);
        expect(payload.data.zones).toEqual([]);
    });

    it("monde des avis par défaut : world=1 quand le paramètre est absent", async () => {
        const payload = await (await GET(req("?zone=1"))).json();
        expect(payload.data.world.id).toBe(1);
    });
});
