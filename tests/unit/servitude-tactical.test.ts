import { describe, it, expect } from "vitest";
import { dofusClassHead } from "@/lib/dofus-assets";
import { splitHoles, cellToScreen } from "@/lib/dofus-grid";
import {
    SERVITUDE_DUNGEON_ID,
    SERVITUDE_DUNGEON_NAME,
    SERVITUDE_EXIT_MAP_ID,
    SERVITUDE_MONSTERS,
    SERVITUDE_ROOMS,
    activeRoomLayout,
    autoPlaceMonsters,
    clampTeamSize,
    defaultRoomRoster,
    getServitudeRoom,
} from "@/lib/dungeons/fers-tyrannie";

describe("fers-tyrannie — données siphonnées du client (touche L)", () => {
    it("5 salles, indexes 1-5, mapIds du bundle world_775", () => {
        expect(SERVITUDE_ROOMS).toHaveLength(5);
        expect(SERVITUDE_ROOMS.map((r) => r.index)).toEqual([1, 2, 3, 4, 5]);
        expect(SERVITUDE_ROOMS.map((r) => r.mapId)).toEqual([
            203161600, 203162624, 203163648, 203164672, 203165696,
        ]);
        expect(SERVITUDE_DUNGEON_ID).toBe(118);
        expect(SERVITUDE_DUNGEON_NAME).toBe("Fers de la Tyrannie");
        expect(SERVITUDE_EXIT_MAP_ID).toBe(203165698);
    });

    it("8 rouges + 8 bleues par salle, cases 0-559, triées, disjointes", () => {
        for (const room of SERVITUDE_ROOMS) {
            expect(room.red).toHaveLength(8);
            expect(room.blue).toHaveLength(8);
            for (const id of [...room.red, ...room.blue, ...room.blocked]) {
                expect(Number.isInteger(id)).toBe(true);
                expect(id).toBeGreaterThanOrEqual(0);
                expect(id).toBeLessThan(560);
            }
            expect([...room.red].sort((a, b) => a - b)).toEqual(room.red);
            expect([...room.blue].sort((a, b) => a - b)).toEqual(room.blue);
            expect(new Set([...room.red, ...room.blue]).size).toBe(16);
        }
    });

    it("obstacles mesurés (los == 0 || nonWalkableDuringFight) : [64,68,85,68,39], disjoints des placements", () => {
        expect(SERVITUDE_ROOMS.map((r) => r.blocked.length)).toEqual([64, 68, 85, 68, 39]);
        for (const room of SERVITUDE_ROOMS) {
            const taken = new Set([...room.red, ...room.blue]);
            for (const b of room.blocked) expect(taken.has(b)).toBe(false);
            expect([...room.blocked].sort((a, b) => a - b)).toEqual(room.blocked);
        }
        expect(getServitudeRoom(5)?.blocked).toEqual([171, 184, 185, 187, 199, 201, 202, 215, 287, 300, 301, 310, 314, 316, 323, 328, 330, 343, 345, 357, 359, 372, 374, 386, 387, 391, 401, 405, 418, 447, 503, 513, 517, 526, 530, 544, 554, 555, 557]);
        // Les anciens bloqueurs de combat restent inclus (preview de combat).
        expect(getServitudeRoom(1)?.blocked).toEqual(expect.arrayContaining([252, 279]));
    });

    it("roster : 6 monstres grade 5, 1 boss, stats strictement positives", () => {
        expect(SERVITUDE_MONSTERS).toHaveLength(6);
        const bosses = SERVITUDE_MONSTERS.filter((m) => m.isBoss);
        expect(bosses).toHaveLength(1);
        expect(bosses[0].name).toBe("Servitude");
        for (const m of SERVITUDE_MONSTERS) {
            expect(m.name.length).toBeGreaterThan(0);
            expect(m.level).toBeGreaterThan(0);
            expect(m.lifePoints).toBeGreaterThan(0);
            expect(m.actionPoints).toBeGreaterThan(0);
            expect(m.movementPoints).toBeGreaterThan(0);
        }
    });

    it("compo par défaut : mobs seuls en 1-4, boss + mobs en 5", () => {
        for (const i of [1, 2, 3, 4]) {
            const roster = defaultRoomRoster(i);
            expect(roster).toHaveLength(5);
            expect(roster.includes(5955)).toBe(false);
        }
        const boss = defaultRoomRoster(5);
        expect(boss[0]).toBe(5955);
        expect(boss).toHaveLength(6);
    });

    it("getServitudeRoom : undefined hors 1-5", () => {
        expect(getServitudeRoom(1)?.mapId).toBe(203161600);
        expect(getServitudeRoom(0)).toBeUndefined();
        expect(getServitudeRoom(6)).toBeUndefined();
    });

    it("clampTeamSize : butin 1-8", () => {
        expect(clampTeamSize(4)).toBe(4);
        expect(clampTeamSize(0)).toBe(1);
        expect(clampTeamSize(-3)).toBe(1);
        expect(clampTeamSize(9)).toBe(8);
        expect(clampTeamSize(2.7)).toBe(2);
        expect(clampTeamSize(Number.NaN)).toBe(4);
        expect(clampTeamSize("x")).toBe(4);
    });

    it("monstres : portraits locaux par gfxId", () => {
        for (const m of SERVITUDE_MONSTERS) {
            expect(m.portrait).toBe(`/assets/dofus/monsters/${m.gfxId}.png`);
        }
        expect(SERVITUDE_MONSTERS.find((m) => m.isBoss)?.portrait).toBe("/assets/dofus/monsters/1958.png");
    });

    it("dofusClassHead : Head_<breed * 10 + genre>.png (client)", () => {
        expect(dofusClassHead(1)).toBe("/assets/dofus/classes/heads/Head_10.png");
        expect(dofusClassHead(1, 1)).toBe("/assets/dofus/classes/heads/Head_11.png");
        expect(dofusClassHead(15)).toBe("/assets/dofus/classes/heads/Head_150.png");
        expect(dofusClassHead(20, 1)).toBe("/assets/dofus/classes/heads/Head_201.png");
    });

    it("cellToScreen brick (même moteur que SpellRangeGrid) : quinconce 64×32", () => {
        // Ligne paire : pas de décalage ; ligne impaire : +1 demi-tuile.
        expect(cellToScreen(0, 0, 64, 32)).toEqual({ sx: 0, sy: 0 });
        expect(cellToScreen(1, 0, 64, 32)).toEqual({ sx: 64, sy: 0 });
        expect(cellToScreen(0, 1, 64, 32)).toEqual({ sx: 32, sy: 16 });
        // Les monstres (bleues 231/246) tombent au-dessus des joueurs (rouge 369).
        const blue = cellToScreen(7, 16, 64, 32);
        const red = cellToScreen(5, 26, 64, 32);
        expect(blue.sy).toBeLessThan(red.sy);
    });

    it("variantes : 1 par salle, rouges étendus, disjointes des placements", () => {
        const redCounts = [10, 9, 10, 10, 10];
        SERVITUDE_ROOMS.forEach((room, i) => {
            expect(room.variants).toHaveLength(1);
            const alt = room.variants[0];
            expect(alt.key).toBe("alt");
            expect(alt.red).toHaveLength(redCounts[i]);
            expect(alt.blue).toHaveLength(8);
            expect(new Set([...alt.red, ...alt.blue]).size).toBe(alt.red.length + 8);
            const taken = new Set([...alt.red, ...alt.blue]);
            for (const b of alt.blocked) expect(taken.has(b)).toBe(false);
        });
        // Salle 5 : deux placements possibles (8 vs 10 rouges).
        const s5 = getServitudeRoom(5);
        if (!s5) throw new Error("salle 5 manquante");
        expect(s5.red).toHaveLength(8);
        expect(s5.variants[0].mapId).toBe(203165702);
    });

    it("trous (mov == 0 && los == 1, noir) : mesurés par salle, disjoints de tout", () => {
        // Vérifié contre Dofensive (map 203165702 : 208/208) : 1 = trou, 2 = obstacle.
        expect(SERVITUDE_ROOMS.map((r) => r.holes.length)).toEqual([136, 158, 144, 155, 183]);
        expect(SERVITUDE_ROOMS.map((r) => r.variants[0].holes.length)).toEqual([222, 230, 229, 230, 208]);
        for (const room of SERVITUDE_ROOMS) {
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
        // Le trou isolé sous les rouges de la salle 1 (losange noir de la preview).
        expect(getServitudeRoom(1)?.holes).toContain(358);
    });

    it("activeRoomLayout : normal par défaut (sans doublon de nom), variante sur demande", () => {
        const s5 = getServitudeRoom(5);
        if (!s5) throw new Error("salle 5 manquante");
        const normal = activeRoomLayout(s5, "normal");
        expect(normal.mapId).toBe(203165696);
        expect(normal.label).toBe("Normal (8/8)");
        expect(activeRoomLayout(s5, "nope").mapId).toBe(203165696);
        const alt = activeRoomLayout(s5, "alt");
        expect(alt.mapId).toBe(203165702);
        expect(alt.red).toHaveLength(10);
        expect(alt.blocked).toHaveLength(33);
    });

    it("autoPlaceMonsters : monstres sur les bleus (défenseurs), dans l'ordre, tronqué à 8", () => {
        const room = getServitudeRoom(5);
        if (!room) throw new Error("salle 5 manquante");
        // Convention Dofus prouvée (Ankama_Fight.d2ui) : AllyCells (= nos blue) = monstres/défenseurs,
        // les joueurs/attaquants spawnent sur les rouges (enemyCells = nos red).
        const placed = autoPlaceMonsters(room, [5955, 5978, 5979]);
        expect(placed).toEqual([
            { cellId: 189, monsterId: 5955 },
            { cellId: 242, monsterId: 5978 },
            { cellId: 243, monsterId: 5979 },
        ]);
        expect(autoPlaceMonsters(room, Array.from({ length: 20 }, (_, i) => i))).toHaveLength(8);
        expect(autoPlaceMonsters(room, [])).toEqual([]);
    });

    it("splitHoles : vide connecté au bord (transparent) vs puisards enclavés (noir) — mesuré client 3.6.11.15", () => {
        const s1 = getServitudeRoom(1);
        if (!s1) throw new Error("salle 1 manquante");
        // Salle 1 : 136 `mov==0&&los==1` = 135 vides + puisard isolé 358.
        const r1 = splitHoles(s1.holes);
        expect(r1.voidCells).toHaveLength(135);
        expect(r1.pits).toEqual([358]);
        expect(new Set([...r1.voidCells, ...r1.pits]).size).toBe(s1.holes.length);
        // Salle 2 : 158 trous = 138 vides + 20 puisards (mesuré par siphon).
        const s2 = getServitudeRoom(2);
        if (!s2) throw new Error("salle 2 manquante");
        const r2 = splitHoles(s2.holes);
        expect(r2.pits).toHaveLength(20);
        expect(r2.voidCells).toHaveLength(138);
        expect(r2.pits).toContain(247);
        // Cas limites : vide, bordure seule, enclave seule.
        expect(splitHoles([])).toEqual({ voidCells: [], pits: [] });
        expect(splitHoles([0, 1, 559])).toEqual({ voidCells: [0, 1, 559], pits: [] });
        expect(splitHoles([358])).toEqual({ voidCells: [], pits: [358] });
        // Layout Dofensive (défaut de la simu, référence des fiches boss) :
        // salle 1 = 222 trous = 221 vides + puisard 358, comme Dofensive `Cells`.
        const alt1 = activeRoomLayout(s1, "alt");
        expect(alt1.mapId).toBe(203161606);
        const ra = splitHoles(alt1.holes);
        expect(ra.voidCells).toHaveLength(221);
        expect(ra.pits).toEqual([358]);
    });
});
