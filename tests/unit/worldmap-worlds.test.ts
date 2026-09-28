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

const EXCLUDED_WORLD_IDS = [19, 29];

const worlds = JSON.parse(readFileSync("public/game-data/worlds.json", "utf8")) as Array<{
    id: number;
    origineX?: number;
    origineY?: number;
    mapWidth?: number;
    mapHeight?: number;
    zoom?: number[];
    name?: { fr?: string };
}>;

const worldmap = JSON.parse(readFileSync("public/game-data/worldmap.json", "utf8")) as {
    maps: Array<{ worldMap: number }>;
    worlds: Array<{ id: number }>;
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
});
