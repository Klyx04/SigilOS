/**
 * Verrou sur les mondes de la carte (`worlds.json` + `worldmap.json`).
 *
 * Les sous-mondes **19 « Mappemondes »** et **29 « Ecaflip City »** ont été
 * supprimés définitivement (27/09/2026) : ce sont des cartes de mise en page,
 * sans monde jouable, qui polluaient le sélecteur de monde et le panneau de
 * récolte. Plusieurs scripts de sync (`sync-worldmap*.ts`, `siphon-*.js`,
 * `sync-maps.ts`) régénèrent ces fichiers depuis DofusDB : ce test échoue si un
 * monde exclu revient, et rappelle la suppression des tuiles (`tiles/w19`,
 * `tiles/w29`) — jamais versionnées, à retirer aussi sur le VPS.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { DOFUS_WORLDS } from "@/lib/dofus-assets";

const EXCLUDED_WORLD_IDS = [19, 29];

const worlds = JSON.parse(readFileSync("public/game-data/worlds.json", "utf8")) as Array<{
    id: number;
    origineX?: number;
    origineY?: number;
    mapWidth?: number;
    mapHeight?: number;
    totalWidth?: number;
    zoom?: number[];
    name?: { fr?: string };
}>;

const worldmap = JSON.parse(readFileSync("public/game-data/worldmap.json", "utf8")) as {
    maps: Array<{ id: number; worldMap: number; subAreaId?: number | null }>;
    worlds?: Array<{ id: number }>;
};

describe("mondes de la carte", () => {
    it("les sous-mondes 19 (Mappemondes) et 29 (Ecaflip City) n'existent plus", () => {
        for (const id of EXCLUDED_WORLD_IDS) {
            expect(worlds.map((w) => w.id), `monde ${id} encore déclaré dans worlds.json`).not.toContain(id);
            expect(
                worldmap.maps.filter((m) => m.worldMap === id).length,
                `maps du monde ${id} encore présentes dans worldmap.json`,
            ).toBe(0);
        }
    });

    it("aucune map ne référence un monde non déclaré (hors -1 « souterrain »)", () => {
        const declared = new Set(worlds.map((w) => w.id));
        const orphans = [...new Set(worldmap.maps.map((m) => m.worldMap))].filter(
            (id) => id !== -1 && !declared.has(id),
        );
        expect(orphans, `mondes référencés par des maps mais absents de worlds.json : ${orphans.join(",")}`).toEqual([]);
    });

    it("chaque monde déclaré est exploitable par le moteur de tuiles", () => {
        for (const world of worlds) {
            expect(Number.isFinite(world.origineX), `origineX du monde ${world.id}`).toBe(true);
            expect(Number.isFinite(world.origineY), `origineY du monde ${world.id}`).toBe(true);
            expect(world.mapWidth, `mapWidth du monde ${world.id}`).toBeGreaterThan(0);
            expect(world.mapHeight, `mapHeight du monde ${world.id}`).toBeGreaterThan(0);
            expect(world.zoom?.length, `échelles du monde ${world.id}`).toBeGreaterThan(0);
        }
    });

    it("la liste statique DOFUS_WORLDS suit worlds.json (éditeur God)", () => {
        const declared = worlds.map((world) => world.id).sort((a, b) => a - b);
        const listed = DOFUS_WORLDS.map((world) => world.id).sort((a, b) => a - b);
        expect(listed).toEqual(declared);
    });

    it("le Temple Céleste (monde 41) est déclaré avec ses 3 cartes", () => {
        const temple = worlds.find((world) => world.id === 41);
        expect(temple?.name?.fr).toBe("Temple Céleste");
        expect(temple?.totalWidth).toBeGreaterThan(0);

        const maps = worldmap.maps.filter((map) => map.worldMap === 41);
        expect(maps.map((map) => map.id).sort((a, b) => a - b)).toEqual([
            241443329, 241444353, 241445377,
        ]);
        for (const map of maps) expect(map.subAreaId).toBe(446);
    });
});
