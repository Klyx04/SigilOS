/**
 * Map personnalisée du combat de Qilby (Anomalie Temporelle, bossId: 8131).
 *
 * Géométrie : 5 plateformes carrées de 5x5 cellules (1 centrale pour Qilby, 4 périphériques
 * pour les joueurs/alliés), séparées et entourées par du vide (cases trous = 1).
 *
 * Sémantique des cases :
 *   - 0 = sol marchable (les dalles des 5 plateformes)
 *   - 1 = trou / néant (bloque le déplacement de Qilby et des joueurs, mais laisse passer la LdV)
 *   - 2 = obstacle 3D plein (bloque déplacement + LdV)
 */

import { DOFUS_MAP_ROWS, DOFUS_MAP_WIDTH, losToXY, positionToCellId } from "@/lib/dofus-grid";
import type { DofensiveDungeonInfo, DofensiveMapData } from "@/lib/dofensive-api";

export const QILBY_MONSTER_ID = 8131;
export const QILBY_MAP_ID = 81310001;
export const QILBY_MAP_NAME = "Hauteurs de l'Inglorium";

export interface QilbyArenaData {
    cells: number[][];
    allyCells: number[];
    enemyCells: number[];
}

/**
 * Génère la grille de combat 40x14 pour l'arène de Qilby.
 *
 * Repère losange Dofus (voir `dofus-grid.ts`) :
 *  - screen (x, y) <-> losange (u, v) : y = u + v, x = (u - v - (y % 2)) / 2.
 *  - Un carré 5x5 en (u, v) couvre du +/-2 sur chaque axe, soit 5 de large
 *    et 9 de haut à l'écran. Deux îlots se recouvrent dès que leurs centres
 *    sont à <= 4 sur les DEUX axes : les centres ci-dessous sont donc écartés
 *    de 6 minimum sur au moins un axe (vérifié par test : 125 cases, 0 overlap).
 *  - Disposition « coins + centre » comme l'arène réelle (4 plateformes
 *    périphériques pour les alliés, îlot central pour Qilby).
 */
export function buildQilbyArena(): QilbyArenaData {
    const cells: number[][] = Array.from({ length: DOFUS_MAP_ROWS }, () =>
        Array.from({ length: DOFUS_MAP_WIDTH }, () => 1)
    );

    // Grille Dofus de combat : 14 colonnes (x = 0 à 13), 40 rangées (y = 0 à 39).
    // Conversion écran -> losange : u = (y + 2x + (y % 2)) / 2, v = (y - 2x - (y % 2)) / 2.
    // Îlot central à l'écran (6, 20), 4 îlots périphériques dans les coins.
    const islandCenters = {
        center: { u: 16, v: 4  }, // Îlot central (x=6, y=20) — Qilby
        northWest: { u: 6,  v: 2  }, // Haut-gauche (x=2, y=8)
        northEast: { u: 15, v: -7 }, // Haut-droite (x=11, y=8)
        southWest: { u: 18, v: 14 }, // Bas-gauche (x=2, y=32)
        southEast: { u: 27, v: 5  }, // Bas-droite (x=11, y=32)
    };

    const paintSquareIsland = (centerU: number, centerV: number): number[] => {
        const cellIds: number[] = [];
        for (let du = -2; du <= 2; du++) {
            for (let dv = -2; dv <= 2; dv++) {
                const pos = losToXY(centerU + du, centerV + dv);
                if (pos.y >= 0 && pos.y < DOFUS_MAP_ROWS && pos.x >= 0 && pos.x < DOFUS_MAP_WIDTH) {
                    cells[pos.y][pos.x] = 0; // sol marchable
                    cellIds.push(positionToCellId(pos));
                }
            }
        }
        return cellIds.sort((a, b) => a - b);
    };

    // Plateforme centrale : Qilby et ses accompagnateurs y sont confinés
    const enemyCells = paintSquareIsland(islandCenters.center.u, islandCenters.center.v);

    // 4 plateformes périphériques : zones de départ pour les alliés / joueurs
    const northWestCells = paintSquareIsland(islandCenters.northWest.u, islandCenters.northWest.v);
    const northEastCells = paintSquareIsland(islandCenters.northEast.u, islandCenters.northEast.v);
    const southWestCells = paintSquareIsland(islandCenters.southWest.u, islandCenters.southWest.v);
    const southEastCells = paintSquareIsland(islandCenters.southEast.u, islandCenters.southEast.v);

    const allyCells = [...northWestCells, ...northEastCells, ...southWestCells, ...southEastCells].sort((a, b) => a - b);

    return {
        cells,
        enemyCells,
        allyCells,
    };
}

/**
 * Construit l'objet DofensiveMapData complet pour le combat de Qilby.
 */
export function getQilbyCustomMapData(): DofensiveMapData {
    const arena = buildQilbyArena();
    return {
        id: QILBY_MAP_ID,
        name: QILBY_MAP_NAME,
        subarea: { id: 8131, name: "Anomalie Temporelle" },
        dungeon: { id: QILBY_MAP_ID, name: QILBY_MAP_NAME },
        isBossMap: true,
        coordinates: { x: 0, y: 0 },
        cells: arena.cells,
        allyCells: arena.allyCells,
        enemyCells: arena.enemyCells,
    };
}

/**
 * Informations de donjon / zone pour Qilby afin d'alimenter le sélecteur de map.
 */
export function getQilbyDungeonInfo(): DofensiveDungeonInfo {
    return {
        dungeonId: QILBY_MAP_ID,
        dungeonName: QILBY_MAP_NAME,
        maps: [
            {
                id: QILBY_MAP_ID,
                name: QILBY_MAP_NAME,
                isBoss: true,
            },
        ],
        monsters: [
            {
                id: QILBY_MONSTER_ID,
                name: "Qilby",
            },
        ],
        bossMonsterId: QILBY_MONSTER_ID,
    };
}

