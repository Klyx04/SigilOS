/**
 * Registre des cartes tactiques siphonnées du client — point de corrélation
 * entre les simulations (`SpellRangeGrid`, fiches boss/monstres, overlays) et
 * les données de jeu à jour.
 *
 * Constat (client 3.6.11.15 local + Dofensive + Ankama_Fight.d2ui prouvé) : les simus
 * lisent les maps via Dofensive (local-first puis live), dont certaines sont absentes (les
 * layouts « Normal » `DungeonData`, inconnus de Dofensive) ou en dérive. Convention Dofus
 * prouvée : `allyCells` = cases défenseurs/monstres (glyphes BLEUS), `enemyCells` = cases
 * attaquants/joueurs (glyphes ROUGES).
 * Ce registre expose les layouts siphonnés (`fers-tyrannie.ts`,
 * `tour-solar.ts`) sous la forme `DofensiveMapData` / `DofensiveMapLite` :
 * - `applyClientMapFreshness` : remplace grille + placements par la version
 *   client quand la map est connue (même `id` Dofensive — contenu prouvé
 *   identique, garantie de fraîcheur) ;
 * - `getClientMapFull` : map `DungeonData` inconnue de Dofensive → donnée
 *   complète synthétisée (métadonnées minimales, jamais inventées au-delà) ;
 * - `withClientExtraMaps` : ajoute ces layouts à la liste d'un donjon pour
 *   les sélecteurs de salles.
 *
 * Pur (données statiques), testé (`tests/unit/client-maps-registry.test.ts`).
 */

import type { DofensiveMapData, DofensiveMapLite } from "@/lib/dofensive-api";
import {
    SERVITUDE_DUNGEON_ID,
    SERVITUDE_DUNGEON_NAME,
    SERVITUDE_ROOMS,
} from "./fers-tyrannie";
import {
    SOLAR_DUNGEON_ID,
    SOLAR_DUNGEON_NAME,
    SOLAR_ROOMS,
} from "./tour-solar";
import {
    DUNGEON_ID as TALKASHA_DUNGEON_ID,
    DUNGEON_NAME as TALKASHA_DUNGEON_NAME,
    ROOMS as TALKASHA_ROOMS,
} from "./tal-kasha";
import {
    DUNGEON_ID as SENTENCE_DUNGEON_ID,
    DUNGEON_NAME as SENTENCE_DUNGEON_NAME,
    ROOMS as SENTENCE_ROOMS,
} from "./sentence-balance";
import {
    DUNGEON_ID as TRONE_DUNGEON_ID,
    DUNGEON_NAME as TRONE_DUNGEON_NAME,
    ROOMS as TRONE_ROOMS,
} from "./trone-sang";
import {
    GARGA_DUNGEON_ID,
    GARGA_DUNGEON_NAME,
    GARGA_ROOMS,
} from "./gargandyas";
import type { TacticalRoom } from "./tactical-dungeon";

export const DOFUS_MAP_COLS = 14;
export const DOFUS_MAP_ROWS = 40;

interface RegistrySource {
    dungeonId: number;
    dungeonName: string;
    /** Index de la salle boss (marquage `isBoss` des extras). */
    bossRoomIndex: number;
    rooms: TacticalRoom[];
}

const SOURCES: RegistrySource[] = [
    { dungeonId: SERVITUDE_DUNGEON_ID, dungeonName: SERVITUDE_DUNGEON_NAME, bossRoomIndex: 5, rooms: SERVITUDE_ROOMS },
    { dungeonId: SOLAR_DUNGEON_ID, dungeonName: SOLAR_DUNGEON_NAME, bossRoomIndex: 5, rooms: SOLAR_ROOMS },
    { dungeonId: TALKASHA_DUNGEON_ID, dungeonName: TALKASHA_DUNGEON_NAME, bossRoomIndex: 5, rooms: TALKASHA_ROOMS },
    { dungeonId: SENTENCE_DUNGEON_ID, dungeonName: SENTENCE_DUNGEON_NAME, bossRoomIndex: 5, rooms: SENTENCE_ROOMS },
    { dungeonId: TRONE_DUNGEON_ID, dungeonName: TRONE_DUNGEON_NAME, bossRoomIndex: 5, rooms: TRONE_ROOMS },
    { dungeonId: GARGA_DUNGEON_ID, dungeonName: GARGA_DUNGEON_NAME, bossRoomIndex: 1, rooms: GARGA_ROOMS },
];

/** Grille `Cells[row][col]` Dofensive (0 = sol, 1 = trou, 2 = obstacle) depuis un layout siphonné. */
export function layoutToCells(
    layout: { blocked: number[]; holes: number[] },
    cols: number = DOFUS_MAP_COLS,
    rows: number = DOFUS_MAP_ROWS
): number[][] {
    const blocked = new Set(layout.blocked);
    const holes = new Set(layout.holes);
    const cells: number[][] = [];
    for (let r = 0; r < rows; r++) {
        const row: number[] = [];
        for (let c = 0; c < cols; c++) {
            const id = r * cols + c;
            row.push(blocked.has(id) ? 2 : holes.has(id) ? 1 : 0);
        }
        cells.push(row);
    }
    return cells;
}

interface IndexedLayout {
    source: RegistrySource;
    room: TacticalRoom;
    /** `normal` = base `DungeonData`, `alt` = layout Dofensive. */
    which: "normal" | "alt";
    mapId: number;
    red: number[];
    blue: number[];
    blocked: number[];
    holes: number[];
}

function buildIndex(): { byId: Map<number, IndexedLayout>; extras: { dungeonId: number; maps: DofensiveMapLite[] }[] } {
    const byId = new Map<number, IndexedLayout>();
    const extras: { dungeonId: number; maps: DofensiveMapLite[] }[] = [];
    for (const source of SOURCES) {
        const extraMaps: DofensiveMapLite[] = [];
        for (const room of source.rooms) {
            for (const variant of room.variants) {
                byId.set(variant.mapId, {
                    source,
                    room,
                    which: "alt",
                    mapId: variant.mapId,
                    red: variant.red,
                    blue: variant.blue,
                    blocked: variant.blocked,
                    holes: variant.holes,
                });
            }
            byId.set(room.mapId, {
                source,
                room,
                which: "normal",
                mapId: room.mapId,
                red: room.red,
                blue: room.blue,
                blocked: room.blocked,
                holes: room.holes,
            });
            extraMaps.push({
                id: room.mapId,
                name: `${source.dungeonName} - ${room.name} (Donjon)`,
                isBoss: room.index === source.bossRoomIndex,
                fromClient: true,
            });
        }
        extras.push({ dungeonId: source.dungeonId, maps: extraMaps });
    }
    return { byId, extras };
}

const INDEX = buildIndex();

/** Layout client connu pour ce `id` de map (normal ou alt), `undefined` sinon. */
export function getClientLayout(mapId: number): IndexedLayout | undefined {
    return INDEX.byId.get(mapId);
}

/**
 * Fraîcheur client : si la map est connue du registre, grille + placements
 * sont remplacés par la version siphonnée (métadonnées nom/sous-zone/donjon/
 * coordonnées conservées). Sinon la donnée est retournée inchangée.
 */
export function applyClientMapFreshness(data: DofensiveMapData): DofensiveMapData {
    const found = INDEX.byId.get(data.id);
    if (!found) return data;
    return {
        ...data,
        cells: layoutToCells(found),
        // Convention Dofus prouvée (Ankama_Fight.d2ui) : défenseurs/monstres sur les glyphes BLEUS (allyCells = found.blue),
        // attaquants/joueurs sur les glyphes ROUGES (enemyCells = found.red).
        allyCells: [...found.blue],
        enemyCells: [...found.red],
    };
}

/**
 * Map `DungeonData` inconnue de Dofensive (layouts « Normal ») : donnée
 * complète synthétisée depuis le siphon client. Métadonnées réduites au
 * mesuré (nom, donjon) — sous-zone et coordonnées à `null` (jamais inventées).
 * `null` si la map n'est pas au registre.
 */
export function getClientMapFull(mapId: number): DofensiveMapData | null {
    const found = INDEX.byId.get(mapId);
    if (!found || found.which !== "normal") return null;
    return {
        id: found.mapId,
        name: `${found.source.dungeonName} - ${found.room.name} (Donjon)`,
        subarea: null,
        dungeon: { id: found.source.dungeonId, name: found.source.dungeonName },
        isBossMap: found.room.index === found.source.bossRoomIndex,
        coordinates: null,
        cells: layoutToCells(found),
        allyCells: [...found.blue],
        enemyCells: [...found.red],
    };
}

/**
 * Layouts « Normal » à ajouter à la liste des maps d'un donjon (sélecteurs de
 * salles) : ceux déjà listés (les `alt`, connus de Dofensive) sont exclus.
 * Inchange les autres donjons (tableau d'origine retourné tel quel).
 */
export function withClientExtraMaps(
    dungeonId: number,
    maps: DofensiveMapLite[]
): DofensiveMapLite[] {
    const entry = INDEX.extras.find((e) => e.dungeonId === dungeonId);
    if (!entry) return maps;
    const known = new Set(maps.map((m) => m.id));
    const extra = entry.maps.filter((m) => !known.has(m.id));
    if (extra.length === 0) return maps;
    return [...maps, ...extra];
}
