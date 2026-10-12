/**
 * Arène du titan « Gargandyas » — « Salle du Graogarm » (map 237241609).
 *
 * Provenance (mesurée, jamais supposée) : `PreferredMaps` Dofensive du monstre
 * 8062 recoupée dans le client Dofus Unity `3.6.11.15` (bundle
 * `StreamingAssets/Content/Map/Data/mapdata_assets_world_905.bundle`) :
 * `mapData.cellsData[560]` — 4 rouges (spawn du titan : 1 occupée en jeu),
 * 1 bleue (joueurs — arène resserrée, mesurée telle quelle),
 * 6 obstacles (`los == 0 || nonWalkableDuringFight`), 342 trous.
 * Monstre : `data_assets_monstersdataroot` (id 8062, grade unique),
 * portrait `Picto/Monsters/monster_assets_2x.bundle` (`2513.png`).
 * Donjon Dofensive : « Temple de Gargandyas » (id synthétique -1001).
 *
 * Socle partagé : `tactical-dungeon.ts` (types + logique).
 */
import type { TacticalDungeon, TacticalMonster, TacticalRoom } from "./tactical-dungeon";
import { defaultTacticalRoster, getTacticalRoom } from "./tactical-dungeon";

export const GARGA_GAME_VERSION = "3.6.11.15";

export const GARGA_DUNGEON_ID = -1001;
export const GARGA_DUNGEON_NAME = "Temple de Gargandyas";

export const GARGA_ROOMS: TacticalRoom[] = [
    {
        index: 1,
        mapId: 237241609,
        name: "Salle du Graogarm",
        red: [393, 450, 479, 509],
        blue: [316],
        blocked: [254, 338, 352, 385, 400, 498],
        holes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 215, 216, 217, 218, 219, 220, 222, 223, 224, 225, 230, 231, 232, 233, 234, 235, 236, 237, 238, 244, 245, 246, 247, 248, 249, 250, 251, 252, 259, 260, 261, 262, 263, 264, 265, 273, 274, 275, 276, 277, 278, 279, 285, 288, 289, 290, 291, 292, 293, 298, 302, 303, 304, 305, 306, 307, 317, 318, 319, 320, 321, 331, 332, 333, 334, 335, 346, 347, 348, 349, 360, 361, 362, 363, 375, 376, 377, 389, 390, 391, 404, 405, 418, 419, 433, 444, 447, 448, 454, 461, 462, 467, 474, 475, 476, 477, 488, 489, 490, 491, 501, 502, 503, 504, 505, 506, 515, 516, 517, 518, 519, 520, 528, 529, 530, 531, 532, 533, 534, 535, 542, 543, 544, 545, 546, 547, 548, 549, 555, 556, 557, 558, 559],
        variants: [],
    },
];

function monsterPortrait(gfxId: number): string {
    return `/assets/dofus/monsters/${gfxId}.png`;
}

/** Le titan seul (grade unique mesuré, pas de théoriecraft). */
export const GARGA_MONSTERS: TacticalMonster[] = [
    {
        id: 8062,
        name: "Gargandyas",
        isBoss: true,
        gfxId: 2513,
        portrait: monsterPortrait(2513),
        level: 200,
        lifePoints: 100000,
        actionPoints: 30,
        movementPoints: 0,
        resistances: { neutral: 0, earth: 0, fire: 0, water: 0, air: 0 },
    },
];

/** Composition par défaut : le titan seul. */
export function defaultGargaRoster(_roomIndex: number): number[] {
    return defaultTacticalRoster(GARGA_MONSTERS, 1, 1);
}

/** Salle unique, `undefined` hors 1 (jamais d'exception). */
export function getGargaRoom(index: number): TacticalRoom | undefined {
    return getTacticalRoom(GARGA_ROOMS, index);
}

/** Config du simulateur (`DungeonTactical`). */
export const gargaTactical: TacticalDungeon = {
    key: "gargandyas",
    dungeonId: GARGA_DUNGEON_ID,
    dungeonName: GARGA_DUNGEON_NAME,
    gameVersion: GARGA_GAME_VERSION,
    rooms: GARGA_ROOMS,
    monsters: GARGA_MONSTERS,
    defaultRoster: defaultGargaRoster,
    storageKey: "sigilos_garga_sim_v1",
};
