import { describe, it, expect } from "vitest";
import { splitHoles } from "@/lib/dofus-grid";
import {
    activeTacticalLayout,
    autoPlaceTactical,
    clampTacticalTeam,
} from "@/lib/dungeons/tactical-dungeon";
import {
    SOLAR_DUNGEON_ID,
    SOLAR_DUNGEON_NAME,
    SOLAR_MONSTERS,
    SOLAR_ROOMS,
    defaultSolarRoster,
    getSolarRoom,
    solarTactical,
} from "@/lib/dungeons/tour-solar";

describe("tour-solar — données siphonnées du client (donjon 109)", () => {
    it("5 salles, indexes 1-5, mapIds DungeonData du bundle world_717", () => {
        expect(SOLAR_ROOMS).toHaveLength(5);
        expect(SOLAR_ROOMS.map((r) => r.index)).toEqual([1, 2, 3, 4, 5]);
        expect(SOLAR_ROOMS.map((r) => r.mapId)).toEqual([
            187957506, 187957508, 187957248, 187957510, 187957512,
        ]);
        expect(SOLAR_DUNGEON_ID).toBe(109);
        expect(SOLAR_DUNGEON_NAME).toBe("Tour de Solar");
        expect(solarTactical.dungeonId).toBe(109);
        expect(solarTactical.rooms).toBe(SOLAR_ROOMS);
    });

    it("10 rouges + 10 bleues par salle, cases 0-559, triées, disjointes", () => {
        for (const room of SOLAR_ROOMS) {
            expect(room.red).toHaveLength(10);
            expect(room.blue).toHaveLength(10);
            for (const id of [...room.red, ...room.blue, ...room.blocked]) {
                expect(Number.isInteger(id)).toBe(true);
                expect(id).toBeGreaterThanOrEqual(0);
                expect(id).toBeLessThan(560);
            }
            expect([...room.red].sort((a, b) => a - b)).toEqual(room.red);
            expect([...room.blue].sort((a, b) => a - b)).toEqual(room.blue);
            expect(new Set([...room.red, ...room.blue]).size).toBe(20);
        }
    });

    it("obstacles mesurés (los == 0 || nonWalkableDuringFight) : [11,31,27,34,8], disjoints des placements", () => {
        expect(SOLAR_ROOMS.map((r) => r.blocked.length)).toEqual([11, 31, 27, 34, 8]);
        for (const room of SOLAR_ROOMS) {
            const taken = new Set([...room.red, ...room.blue]);
            for (const b of room.blocked) expect(taken.has(b)).toBe(false);
            expect([...room.blocked].sort((a, b) => a - b)).toEqual(room.blocked);
        }
        // Salle 1 : le layout client ajoute la case 177 (bloqueur de combat)
        // aux 10 obstacles Dofensive.
        expect(getSolarRoom(1)?.blocked).toEqual([177, 212, 285, 293, 299, 307, 313, 418, 425, 439, 454]);
    });

    it("roster : 6 monstres grade 5, 1 boss, stats strictement positives", () => {
        expect(SOLAR_MONSTERS).toHaveLength(6);
        const bosses = SOLAR_MONSTERS.filter((m) => m.isBoss);
        expect(bosses).toHaveLength(1);
        expect(bosses[0].name).toBe("Solar");
        for (const m of SOLAR_MONSTERS) {
            expect(m.name.length).toBeGreaterThan(0);
            expect(m.level).toBeGreaterThan(0);
            expect(m.lifePoints).toBeGreaterThan(0);
            expect(m.actionPoints).toBeGreaterThan(0);
            expect(m.movementPoints).toBeGreaterThan(0);
        }
    });

    it("compo par défaut : mobs seuls en 1-4, boss + mobs en 5", () => {
        for (const i of [1, 2, 3, 4]) {
            const roster = defaultSolarRoster(i);
            expect(roster).toHaveLength(5);
            expect(roster.includes(5100)).toBe(false);
        }
        const boss = defaultSolarRoster(5);
        expect(boss[0]).toBe(5100);
        expect(boss).toHaveLength(6);
    });

    it("getSolarRoom : undefined hors 1-5", () => {
        expect(getSolarRoom(1)?.mapId).toBe(187957506);
        expect(getSolarRoom(0)).toBeUndefined();
        expect(getSolarRoom(6)).toBeUndefined();
    });

    it("clampTacticalTeam : butin 1-8", () => {
        expect(clampTacticalTeam(4)).toBe(4);
        expect(clampTacticalTeam(0)).toBe(1);
        expect(clampTacticalTeam(9)).toBe(8);
        expect(clampTacticalTeam(Number.NaN)).toBe(4);
    });

    it("monstres : portraits locaux par gfxId", () => {
        for (const m of SOLAR_MONSTERS) {
            expect(m.portrait).toBe(`/assets/dofus/monsters/${m.gfxId}.png`);
        }
        expect(SOLAR_MONSTERS.find((m) => m.isBoss)?.portrait).toBe("/assets/dofus/monsters/1661.png");
    });

    it("variantes Dofensive : 1 par salle (maps 187959xxx), disjointes des placements", () => {
        const altMapIds = [187959554, 187959556, 187959296, 187959558, 187959560];
        const altBlocked = [10, 31, 20, 27, 14];
        SOLAR_ROOMS.forEach((room, i) => {
            expect(room.variants).toHaveLength(1);
            const alt = room.variants[0];
            expect(alt.key).toBe("alt");
            expect(alt.mapId).toBe(altMapIds[i]);
            expect(alt.red).toHaveLength(10);
            expect(alt.blue).toHaveLength(10);
            expect(alt.blocked).toHaveLength(altBlocked[i]);
            expect(new Set([...alt.red, ...alt.blue]).size).toBe(20);
            const taken = new Set([...alt.red, ...alt.blue]);
            for (const b of alt.blocked) expect(taken.has(b)).toBe(false);
        });
        // Salle 1 : mêmes placements que Dofensive `AllyCells`/`EnemyCells`.
        const s1 = getSolarRoom(1);
        if (!s1) throw new Error("salle 1 manquante");
        expect(s1.variants[0].red).toEqual([233, 262, 291, 320, 340, 349, 369, 398, 427, 456]);
        expect(s1.variants[0].blue).toEqual([172, 201, 227, 230, 256, 259, 288, 314, 317, 343]);
    });

    it("trous (mov == 0 && los == 1) : mesurés par salle, disjoints de tout", () => {
        expect(SOLAR_ROOMS.map((r) => r.holes.length)).toEqual([324, 321, 344, 335, 295]);
        expect(SOLAR_ROOMS.map((r) => r.variants[0].holes.length)).toEqual([325, 322, 351, 356, 290]);
        for (const room of SOLAR_ROOMS) {
            for (const layout of [{ red: room.red, blue: room.blue, blocked: room.blocked, holes: room.holes }, ...room.variants]) {
                const taken = new Set([...layout.red, ...layout.blue, ...layout.blocked]);
                for (const h of layout.holes) {
                    expect(taken.has(h)).toBe(false);
                    expect(h).toBeGreaterThanOrEqual(0);
                    expect(h).toBeLessThan(560);
                }
                expect([...layout.holes].sort((a, b) => a - b)).toEqual(layout.holes);
            }
        }
    });

    it("activeTacticalLayout : normal par défaut, variante Dofensive sur demande", () => {
        const s5 = getSolarRoom(5);
        if (!s5) throw new Error("salle 5 manquante");
        const normal = activeTacticalLayout(s5, "normal");
        expect(normal.mapId).toBe(187957512);
        expect(normal.label).toBe("Normal (10/10)");
        expect(activeTacticalLayout(s5, "nope").mapId).toBe(187957512);
        const alt = activeTacticalLayout(s5, "alt");
        expect(alt.mapId).toBe(187959560);
        expect(alt.red).toHaveLength(10);
        expect(alt.blocked).toHaveLength(14);
    });

    it("autoPlaceTactical : monstres sur les bleus (défenseurs), dans l'ordre, tronqué à 10", () => {
        const room = getSolarRoom(5);
        if (!room) throw new Error("salle 5 manquante");
        // Convention Dofus prouvée (Ankama_Fight.d2ui) : monstres = défenseurs = BLEU = room.blue.
        const placed = autoPlaceTactical(room, [5100, 5101, 5102]);
        expect(placed).toEqual([
            { cellId: 159, monsterId: 5100 },
            { cellId: 162, monsterId: 5101 },
            { cellId: 202, monsterId: 5102 },
        ]);
        expect(autoPlaceTactical(room, Array.from({ length: 20 }, (_, i) => i))).toHaveLength(10);
        expect(autoPlaceTactical(room, [])).toEqual([]);
    });

    it("splitHoles salle 1 : puisards enclavés identifiés (pas de noir plein)", () => {
        const s1 = getSolarRoom(1);
        if (!s1) throw new Error("salle 1 manquante");
        const r1 = splitHoles(s1.holes);
        expect(r1.pits).toHaveLength(20);
        expect(r1.voidCells).toHaveLength(304);
        expect(new Set([...r1.voidCells, ...r1.pits]).size).toBe(s1.holes.length);
        const alt1 = activeTacticalLayout(s1, "alt");
        expect(alt1.mapId).toBe(187959554);
        const ra = splitHoles(alt1.holes);
        expect(ra.pits).toContain(358);
        expect(new Set([...ra.voidCells, ...ra.pits]).size).toBe(alt1.holes.length);
    });
});
