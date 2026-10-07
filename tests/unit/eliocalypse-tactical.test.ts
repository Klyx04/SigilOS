import { describe, it, expect } from "vitest";
import { splitHoles } from "@/lib/dofus-grid";
import {
    activeTacticalLayout,
    autoPlaceTactical,
} from "@/lib/dungeons/tactical-dungeon";
import {
    DUNGEON_ID as TK_ID,
    DUNGEON_NAME as TK_NAME,
    MONSTERS as TK_MONSTERS,
    ROOMS as TK_ROOMS,
    defaultRoster as defaultTkRoster,
    getRoom as getTkRoom,
    tactical as talkashaTactical,
} from "@/lib/dungeons/tal-kasha";
import {
    DUNGEON_ID as SB_ID,
    DUNGEON_NAME as SB_NAME,
    MONSTERS as SB_MONSTERS,
    ROOMS as SB_ROOMS,
    defaultRoster as defaultSbRoster,
    getRoom as getSbRoom,
    tactical as sentenceTactical,
} from "@/lib/dungeons/sentence-balance";
import {
    DUNGEON_ID as TS_ID,
    DUNGEON_NAME as TS_NAME,
    MONSTERS as TS_MONSTERS,
    ROOMS as TS_ROOMS,
    defaultRoster as defaultTsRoster,
    getRoom as getTsRoom,
    tactical as troneTactical,
} from "@/lib/dungeons/trone-sang";
import {
    GARGA_DUNGEON_ID,
    GARGA_DUNGEON_NAME,
    GARGA_MONSTERS,
    GARGA_ROOMS,
    defaultGargaRoster,
    gargaTactical,
    getGargaRoom,
} from "@/lib/dungeons/gargandyas";

describe("batch Eliocalypse — données siphonnées du client (donjons 103/119/120)", () => {
    it("Tal Kasha (103) : 5 salles 12/12, variantes Dofensive, 6 monstres", () => {
        expect(TK_ID).toBe(103);
        expect(TK_NAME).toBe("Chambre de Tal Kasha");
        expect(TK_ROOMS.map((r) => r.mapId)).toEqual([
            176160768, 176161792, 176162816, 176163840, 176164864,
        ]);
        expect(TK_ROOMS.map((r) => r.blocked.length)).toEqual([42, 42, 59, 64, 28]);
        for (const room of TK_ROOMS) {
            expect(room.red).toHaveLength(12);
            expect(room.blue).toHaveLength(12);
            expect(new Set([...room.red, ...room.blue]).size).toBe(24);
            const taken = new Set([...room.red, ...room.blue]);
            for (const b of room.blocked) expect(taken.has(b)).toBe(false);
        }
        expect(TK_ROOMS.map((r) => r.variants[0].mapId)).toEqual([
            176160772, 176161796, 176162820, 176163844, 176164868,
        ]);
        expect(TK_ROOMS.map((r) => r.variants[0].red.length)).toEqual([12, 12, 12, 12, 11]);
        expect(TK_MONSTERS).toHaveLength(6);
        expect(TK_MONSTERS.filter((m) => m.isBoss).map((m) => m.name)).toEqual(["Tal Kasha"]);
        expect(TK_MONSTERS.find((m) => m.isBoss)?.portrait).toBe("/assets/dofus/monsters/1547.png");
        expect(defaultTkRoster(1)).toHaveLength(5);
        expect(defaultTkRoster(1)).not.toContain(4744);
        expect(defaultTkRoster(5)[0]).toBe(4744);
        expect(getTkRoom(0)).toBeUndefined();
        expect(talkashaTactical.key).toBe("talkasha");
        // Convention Dofus prouvée (Ankama_Fight.d2ui) : monstres = défenseurs = BLEU = room.blue.
        const placed = autoPlaceTactical(getTkRoom(5)!, [4744, 4739, 4740]);
        expect(placed).toEqual([
            { cellId: 259, monsterId: 4744 },
            { cellId: 261, monsterId: 4739 },
            { cellId: 262, monsterId: 4740 },
        ]);
        const s1 = getTkRoom(1)!;
        const parts = splitHoles(s1.holes);
        expect(new Set([...parts.voidCells, ...parts.pits]).size).toBe(s1.holes.length);
    });

    it("Sentence de la Balance (119) : 5 salles 8/8, variantes Dofensive, boss Misère", () => {
        expect(SB_ID).toBe(119);
        expect(SB_NAME).toBe("Sentence de la Balance");
        expect(SB_ROOMS.map((r) => r.mapId)).toEqual([
            203423744, 203424768, 203425792, 203426816, 203427840,
        ]);
        expect(SB_ROOMS.map((r) => r.blocked.length)).toEqual([84, 36, 47, 62, 50]);
        for (const room of SB_ROOMS) {
            expect(room.red).toHaveLength(8);
            expect(room.blue).toHaveLength(8);
            expect(new Set([...room.red, ...room.blue]).size).toBe(16);
        }
        expect(SB_ROOMS.map((r) => r.variants[0].mapId)).toEqual([
            203423750, 203424774, 203425798, 203426822, 203427846,
        ]);
        expect(SB_MONSTERS).toHaveLength(6);
        expect(SB_MONSTERS.filter((m) => m.isBoss).map((m) => m.name)).toEqual(["Misère"]);
        expect(SB_MONSTERS.find((m) => m.isBoss)?.portrait).toBe("/assets/dofus/monsters/1966.png");
        expect(defaultSbRoster(5)[0]).toBe(5990);
        expect(getSbRoom(6)).toBeUndefined();
        expect(sentenceTactical.key).toBe("sentence");
        // Convention Dofus : monstres = défenseurs = BLEU = room.blue.
        const placed = autoPlaceTactical(getSbRoom(5)!, [5990, 5991]);
        expect(placed).toEqual([
            { cellId: 157, monsterId: 5990 },
            { cellId: 238, monsterId: 5991 },
        ]);
        expect(autoPlaceTactical(getSbRoom(5)!, Array.from({ length: 20 }, (_, i) => i))).toHaveLength(8);
    });

    it("Trône de Sang (120) : 5 salles 8/8, variantes Dofensive, boss Guerre", () => {
        expect(TS_ID).toBe(120);
        expect(TS_NAME).toBe("Trône de Sang");
        expect(TS_ROOMS.map((r) => r.mapId)).toEqual([
            202375168, 202376192, 202377216, 202378240, 202379264,
        ]);
        expect(TS_ROOMS.map((r) => r.blocked.length)).toEqual([61, 71, 60, 57, 60]);
        for (const room of TS_ROOMS) {
            expect(room.red).toHaveLength(8);
            expect(room.blue).toHaveLength(8);
            expect(new Set([...room.red, ...room.blue]).size).toBe(16);
        }
        expect(TS_ROOMS.map((r) => r.variants[0].mapId)).toEqual([
            202375174, 202376198, 202377222, 202378246, 202379270,
        ]);
        expect(TS_MONSTERS).toHaveLength(6);
        expect(TS_MONSTERS.filter((m) => m.isBoss).map((m) => m.name)).toEqual(["Guerre"]);
        expect(TS_MONSTERS.find((m) => m.isBoss)?.portrait).toBe("/assets/dofus/monsters/1985.png");
        expect(defaultTsRoster(5)[0]).toBe(6014);
        expect(getTsRoom(0)).toBeUndefined();
        expect(troneTactical.key).toBe("trone");
        const placed = autoPlaceTactical(getTsRoom(5)!, [6014, 6021]);
        // Convention Dofus : monstres = défenseurs = BLEU = room.blue (premier sur la plus petite case).
        expect(placed).toEqual([
            { cellId: 244, monsterId: 6014 },
            { cellId: 257, monsterId: 6021 },
        ]);
        const alt5 = activeTacticalLayout(getTsRoom(5)!, "alt");
        expect(alt5.mapId).toBe(202379270);
        expect(alt5.blue).toEqual([217, 230, 246, 272, 273, 275, 301, 317]);
    });

    it("Gargandyas (arène titan, 1 salle) : 4 rouges / 1 bleue, titan seul", () => {
        expect(GARGA_DUNGEON_ID).toBe(-1001);
        expect(GARGA_DUNGEON_NAME).toBe("Temple de Gargandyas");
        expect(GARGA_ROOMS).toHaveLength(1);
        const room = getGargaRoom(1)!;
        expect(room.mapId).toBe(237241609);
        expect(room.red).toEqual([393, 450, 479, 509]);
        expect(room.blue).toEqual([316]);
        expect(room.blocked).toEqual([254, 338, 352, 385, 400, 498]);
        expect(room.variants).toEqual([]);
        expect(GARGA_MONSTERS).toHaveLength(1);
        expect(GARGA_MONSTERS[0].name).toBe("Gargandyas");
        expect(GARGA_MONSTERS[0].portrait).toBe("/assets/dofus/monsters/2513.png");
        expect(defaultGargaRoster(1)).toEqual([8062]);
        expect(getGargaRoom(2)).toBeUndefined();
        expect(gargaTactical.key).toBe("gargandyas");
        // Le titan spawne sur sa case de monstre (bleue = défenseur), comme en jeu.
        expect(autoPlaceTactical(room, [8062])).toEqual([{ cellId: 316, monsterId: 8062 }]);
    });
});
