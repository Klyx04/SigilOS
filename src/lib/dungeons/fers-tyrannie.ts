/**
 * Donjon « Fers de la Tyrannie » (id 118) — salles tactiques siphonnées du client.
 *
 * Provenance (mesurée, jamais supposée) :
 * - client Dofus Unity `3.6.11.15` (`StreamingAssets/version`, build du 10/09/2026),
 *   bundle `StreamingAssets/Content/Map/Data/mapdata_assets_world_775.bundle`
 *   (11 assets : 5 salles « Donjon » + 5 variantes + la sortie) ;
 * - `mapData.cellsData[560]` par salle : `red` / `blue` = placements de départ
 *   affichés par la preview touche `L` (**convention Dofus prouvée en jeu,
 *   capture combat Trône de Sang : `red` = monstres/défenseurs,
 *   `blue` = joueurs/attaquants**) ;
 * - **obstacles (gris de la preview `L`) = `los == 0 || nonWalkableDuringFight == 1`**
 *   (vérifié contre Dofensive `Cells` : la variante « Dofensive » de la salle 1
 *   donne exactement 20 cases `2` pour 20 `blocked`, 222 cases `1` pour 222
 *   `holes`, `AllyCells` = nos `blue`, `EnemyCells` = nos `red`) ;
 * - chaque salle a **2 layouts** : « Normal » (`DungeonData` 118) et « Dofensive »
 *   (celui qu'exposent Dofensive et les simulations de fiches boss — mis par
 *   défaut car c'est la référence déjà utilisée partout sur le site) ;
 * - monstres : `data_assets_monstersdataroot` (sous-zone 933, grade 5 = niveau max),
 *   noms résolus via `I18n/fr.bin`, portraits via
 *   `Picto/Monsters/monster_assets_2x.bundle` (`<gfxId>.png`) ;
 * - visuels de classes : `Picto/UI/class_assets_*.bundle`
 *   (`Head_<breedId * 10 + gender>.png`, voir `dofusClassHead`).
 *
 * ⚠️ Les positions changent parfois aux mises à jour du client : ce fichier est
 * l'**unique source** des placements Servitude — re-siphon via
 * `scripts/siphon-tactical-maps.py` (+ la version ci-dessus).
 *
 * Composition des salles : ni `DungeonData`, ni Dofensive, ni les scénarios de
 * combat ne donnent les monstres par salle et par butin (décidé côté serveurs
 * Ankama au lancement du combat). Le roster ci-dessous = le pool de la
 * sous-zone, modifiable dans l'UI — jamais une vérité serveur.
 *
 * Socle partagé : `tactical-dungeon.ts` (types + logique). Les exports
 * historiques (`ServitudeRoom`, `getServitudeRoom`, …) délèguent — ne jamais
 * dupliquer la logique ici.
 */
import type {
    TacticalDungeon,
    TacticalLayout,
    TacticalMonster,
    TacticalMonsterPlacement,
    TacticalRoom,
    TacticalRoomVariant,
} from "./tactical-dungeon";
import {
    activeTacticalLayout,
    autoPlaceTactical,
    clampTacticalTeam,
    defaultTacticalRoster,
    getTacticalRoom,
} from "./tactical-dungeon";

export const SERVITUDE_GAME_VERSION = "3.6.11.15";

export const SERVITUDE_DUNGEON_ID = 118;
export const SERVITUDE_DUNGEON_NAME = "Fers de la Tyrannie";
/** Map de sortie (0 placement, 39 obstacles) — hors combat, rappelée pour mémoire. */
export const SERVITUDE_EXIT_MAP_ID = 203165698;

/** Alias historique — voir `TacticalRoomVariant`. */
export type RoomVariant = TacticalRoomVariant;

/** Alias historique — voir `TacticalRoom`. */
export type ServitudeRoom = TacticalRoom;

export const SERVITUDE_ROOMS: ServitudeRoom[] = [
    {
        index: 1,
        mapId: 203161600,
        name: "Première salle",
        red: [369, 370, 382, 398, 399, 411, 427, 440],
        blue: [231, 246, 247, 259, 274, 275, 317, 318],
        blocked: [35, 48, 49, 62, 64, 75, 78, 89, 93, 102, 107, 116, 122, 129, 136, 143, 144, 150, 151, 156, 158, 163, 165, 170, 175, 180, 183, 189, 194, 197, 209, 210, 223, 224, 238, 251, 252, 253, 256, 265, 279, 301, 333, 339, 351, 352, 353, 366, 367, 379, 380, 445, 447, 457, 458, 461, 471, 474, 488, 501, 515, 528, 542, 555],
        holes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 94, 95, 96, 97, 98, 99, 100, 101, 108, 109, 110, 111, 112, 113, 114, 115, 123, 124, 125, 126, 127, 128, 137, 138, 139, 140, 141, 142, 152, 153, 154, 155, 166, 167, 168, 169, 181, 182, 195, 196, 358, 475, 489, 502, 503, 516, 517, 529, 530, 531, 543, 544, 545, 556, 557, 558, 559],
        variants: [
            {
                key: "alt",
                label: "Dofensive (10 rouges)",
                mapId: 203161606,
                red: [369, 370, 382, 398, 399, 410, 411, 427, 439, 440],
                blue: [231, 246, 247, 259, 274, 275, 317, 318],
                blocked: [150, 163, 175, 189, 251, 256, 265, 301, 333, 339, 351, 352, 353, 366, 367, 379, 445, 457, 458, 471],
                holes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 151, 152, 153, 154, 155, 156, 157, 158, 165, 166, 167, 168, 169, 170, 171, 172, 180, 181, 182, 183, 184, 185, 194, 195, 196, 197, 198, 199, 209, 210, 211, 212, 223, 224, 225, 226, 238, 239, 252, 253, 266, 279, 280, 358, 392, 420, 447, 461, 474, 475, 476, 488, 489, 490, 501, 502, 503, 504, 505, 515, 516, 517, 518, 519, 528, 529, 530, 531, 532, 533, 534, 538, 542, 543, 544, 545, 546, 547, 548, 551, 552, 555, 556, 557, 558, 559],
            },
        ],
    },
    {
        index: 2,
        mapId: 203162624,
        name: "Deuxième salle",
        red: [394, 395, 409, 422, 424, 436, 451, 452],
        blue: [285, 313, 314, 343, 356, 372, 400, 401],
        blocked: [35, 48, 49, 62, 64, 75, 78, 89, 92, 93, 102, 105, 107, 116, 119, 122, 129, 132, 136, 143, 144, 145, 146, 150, 151, 156, 158, 159, 163, 165, 170, 180, 183, 194, 197, 209, 210, 214, 223, 224, 238, 251, 252, 253, 265, 279, 383, 389, 403, 404, 417, 431, 444, 445, 447, 459, 461, 474, 488, 501, 504, 515, 518, 528, 533, 542, 547, 555],
        holes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 63, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 76, 77, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 90, 91, 94, 95, 96, 97, 98, 99, 100, 101, 103, 104, 108, 109, 110, 111, 112, 113, 114, 115, 117, 118, 123, 124, 125, 126, 127, 128, 130, 131, 137, 138, 139, 140, 141, 142, 152, 153, 154, 155, 166, 167, 168, 169, 181, 182, 195, 196, 247, 261, 274, 275, 289, 392, 469, 475, 483, 484, 489, 497, 502, 503, 516, 517, 529, 530, 531, 532, 543, 544, 545, 546, 556, 557, 558, 559],
        variants: [
            {
                key: "alt",
                label: "Dofensive (9 rouges)",
                mapId: 203162630,
                red: [394, 395, 409, 422, 423, 424, 436, 451, 452],
                blue: [285, 313, 314, 343, 356, 372, 400, 401],
                blocked: [92, 105, 119, 132, 146, 150, 159, 163, 214, 247, 251, 265, 383, 389, 403, 404, 417, 431, 445, 459],
                holes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 151, 152, 153, 154, 155, 156, 157, 158, 165, 166, 167, 168, 169, 170, 171, 172, 180, 181, 182, 183, 184, 185, 194, 195, 196, 197, 198, 199, 209, 210, 211, 212, 223, 224, 225, 226, 238, 239, 252, 253, 261, 266, 274, 275, 279, 280, 289, 335, 349, 363, 392, 444, 447, 461, 469, 474, 475, 476, 483, 484, 488, 489, 490, 497, 501, 502, 503, 504, 505, 515, 516, 517, 518, 519, 528, 529, 530, 531, 532, 533, 534, 542, 543, 544, 545, 546, 547, 548, 551, 555, 556, 557, 558, 559],
            },
        ],
    },
    {
        index: 3,
        mapId: 203163648,
        name: "Troisième salle",
        red: [341, 342, 343, 357, 383, 385, 398, 413],
        blue: [260, 275, 288, 290, 316, 330, 331, 332],
        blocked: [35, 48, 49, 62, 64, 75, 78, 89, 93, 102, 107, 116, 122, 129, 136, 143, 144, 150, 151, 156, 158, 163, 165, 170, 180, 183, 194, 197, 209, 210, 223, 224, 225, 228, 239, 242, 245, 251, 259, 265, 272, 279, 280, 286, 294, 299, 308, 309, 313, 323, 326, 338, 340, 347, 352, 353, 360, 361, 367, 368, 374, 376, 381, 387, 390, 391, 401, 405, 414, 419, 428, 441, 447, 455, 461, 468, 474, 488, 501, 515, 528, 532, 542, 546, 555],
        holes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 90, 94, 95, 96, 97, 98, 99, 100, 101, 103, 108, 109, 110, 111, 112, 113, 114, 115, 123, 124, 125, 126, 127, 128, 137, 138, 139, 140, 141, 142, 152, 153, 154, 155, 166, 167, 168, 169, 181, 182, 195, 196, 241, 380, 395, 475, 478, 489, 491, 492, 502, 503, 506, 516, 517, 529, 530, 531, 543, 544, 545, 556, 557, 558, 559],
        variants: [
            {
                key: "alt",
                label: "Dofensive (10 rouges)",
                mapId: 203163654,
                red: [341, 342, 343, 357, 383, 385, 398, 410, 413, 425],
                blue: [260, 275, 288, 290, 316, 330, 331, 332],
                blocked: [150, 163, 228, 242, 245, 251, 259, 265, 272, 286, 294, 299, 309, 313, 323, 326, 338, 340, 347, 352, 353, 360, 361, 367, 368, 374, 376, 381, 387, 390, 401, 405, 414, 419, 428, 441, 455, 468],
                holes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 151, 152, 153, 154, 155, 156, 157, 158, 165, 166, 167, 168, 169, 170, 171, 172, 180, 181, 182, 183, 184, 185, 194, 195, 196, 197, 198, 199, 209, 210, 211, 212, 223, 224, 225, 226, 238, 239, 241, 252, 253, 266, 279, 280, 308, 380, 391, 395, 447, 448, 461, 474, 475, 476, 478, 488, 489, 490, 491, 492, 501, 502, 503, 504, 505, 506, 515, 516, 517, 518, 519, 528, 529, 530, 531, 532, 533, 534, 536, 542, 543, 544, 545, 546, 547, 548, 549, 550, 555, 556, 557, 558, 559],
            },
        ],
    },
    {
        index: 4,
        mapId: 203164672,
        name: "Quatrième salle",
        red: [435, 449, 458, 463, 472, 478, 486, 499],
        blue: [255, 256, 271, 282, 301, 328, 345, 372],
        blocked: [35, 48, 49, 62, 64, 75, 78, 89, 90, 93, 102, 104, 107, 116, 122, 129, 135, 143, 144, 149, 156, 158, 163, 165, 170, 178, 179, 180, 183, 191, 192, 194, 197, 206, 209, 210, 223, 224, 238, 245, 251, 252, 253, 260, 265, 298, 312, 313, 326, 332, 347, 352, 367, 447, 461, 474, 483, 488, 497, 501, 504, 515, 518, 528, 533, 542, 547, 555],
        holes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 63, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 76, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 94, 95, 96, 97, 98, 99, 100, 101, 103, 108, 109, 110, 111, 112, 113, 114, 115, 123, 124, 125, 126, 127, 128, 136, 137, 138, 139, 140, 141, 142, 150, 151, 152, 153, 154, 155, 164, 166, 167, 168, 169, 181, 182, 195, 196, 279, 297, 311, 324, 325, 339, 340, 341, 353, 354, 368, 475, 489, 502, 503, 516, 517, 529, 530, 531, 532, 543, 544, 545, 546, 556, 557, 558, 559],
        variants: [
            {
                key: "alt",
                label: "Dofensive (10 rouges)",
                mapId: 203164678,
                red: [435, 436, 449, 457, 458, 463, 472, 478, 486, 499],
                blue: [255, 256, 271, 282, 301, 328, 345, 372],
                blocked: [135, 149, 150, 163, 164, 178, 179, 191, 192, 206, 245, 251, 260, 265, 297, 312, 326, 332, 340, 347, 352, 353, 367, 483, 497],
                holes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 151, 152, 153, 154, 155, 156, 157, 158, 165, 166, 167, 168, 169, 170, 171, 172, 180, 181, 182, 183, 184, 185, 194, 195, 196, 197, 198, 199, 209, 210, 211, 212, 223, 224, 225, 226, 238, 239, 252, 253, 266, 279, 280, 293, 298, 307, 308, 311, 313, 324, 325, 339, 341, 354, 368, 447, 461, 474, 475, 476, 488, 489, 490, 501, 502, 503, 504, 505, 515, 516, 517, 518, 519, 528, 529, 530, 531, 532, 533, 534, 542, 543, 544, 545, 546, 547, 548, 549, 550, 555, 556, 557, 558, 559],
            },
        ],
    },
    {
        index: 5,
        mapId: 203165696,
        name: "Cinquième salle (boss)",
        red: [263, 304, 306, 348, 411, 424, 455, 467],
        blue: [189, 242, 243, 245, 283, 284, 286, 326],
        blocked: [171, 184, 185, 187, 199, 201, 202, 215, 287, 300, 301, 310, 314, 316, 323, 328, 330, 343, 345, 357, 359, 372, 374, 386, 387, 391, 401, 405, 418, 447, 503, 513, 517, 526, 530, 544, 554, 555, 557],
        holes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 122, 123, 124, 125, 126, 127, 128, 129, 136, 137, 138, 139, 140, 141, 142, 143, 151, 152, 153, 154, 155, 156, 165, 166, 167, 168, 169, 170, 180, 181, 182, 183, 194, 195, 196, 197, 198, 209, 210, 211, 212, 216, 223, 224, 226, 230, 295, 309, 315, 324, 329, 338, 344, 356, 358, 367, 371, 373, 390, 404, 419, 433, 498, 504, 512, 518, 527, 531, 532, 533, 541, 545, 546, 547, 558, 559],
        variants: [
            {
                key: "alt",
                label: "Dofensive (10 rouges)",
                mapId: 203165702,
                red: [250, 263, 304, 306, 348, 411, 413, 437, 455, 467],
                blue: [189, 242, 243, 245, 271, 283, 284, 326],
                blocked: [171, 184, 185, 187, 199, 201, 202, 215, 259, 272, 273, 286, 288, 299, 302, 314, 317, 328, 331, 343, 346, 357, 360, 367, 372, 374, 380, 386, 387, 401, 405, 418, 486],
                holes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 122, 123, 124, 125, 126, 127, 128, 129, 136, 137, 138, 139, 140, 141, 142, 143, 151, 152, 153, 154, 155, 156, 165, 166, 167, 168, 169, 170, 180, 181, 182, 183, 194, 195, 196, 197, 198, 209, 210, 211, 212, 216, 223, 224, 226, 230, 287, 300, 301, 315, 316, 329, 330, 344, 345, 352, 356, 358, 359, 366, 371, 373, 381, 390, 391, 395, 404, 419, 420, 433, 438, 447, 448, 469, 476, 483, 490, 503, 504, 505, 517, 518, 519, 530, 531, 532, 533, 534, 541, 544, 545, 546, 547, 548, 551, 552, 554, 555, 557, 558, 559],
            },
        ],
    },
];

/** Alias historique — voir `TacticalMonster`. */
export type ServitudeMonster = TacticalMonster;

function monsterPortrait(gfxId: number): string {
    return `/assets/dofus/monsters/${gfxId}.png`;
}

/** Roster du donjon au grade 5 (stats mesurées, pas de théoriecraft). */
export const SERVITUDE_MONSTERS: ServitudeMonster[] = [
    {
        id: 5955,
        name: "Servitude",
        isBoss: true,
        gfxId: 1958,
        portrait: monsterPortrait(1958),
        level: 220,
        lifePoints: 31000,
        actionPoints: 11,
        movementPoints: 7,
        resistances: { neutral: 24, earth: 19, fire: 34, water: 29, air: 29 },
    },
    {
        id: 5978,
        name: "Tambourreau",
        isBoss: false,
        gfxId: 1960,
        portrait: monsterPortrait(1960),
        level: 212,
        lifePoints: 7800,
        actionPoints: 9,
        movementPoints: 4,
        resistances: { neutral: 20, earth: 25, fire: 15, water: 20, air: 25 },
    },
    {
        id: 5979,
        name: "Armécréante",
        isBoss: false,
        gfxId: 1961,
        portrait: monsterPortrait(1961),
        level: 212,
        lifePoints: 6000,
        actionPoints: 10,
        movementPoints: 6,
        resistances: { neutral: 20, earth: 30, fire: 30, water: 15, air: 20 },
    },
    {
        id: 5980,
        name: "Gentyran",
        isBoss: false,
        gfxId: 1962,
        portrait: monsterPortrait(1962),
        level: 212,
        lifePoints: 7200,
        actionPoints: 11,
        movementPoints: 5,
        resistances: { neutral: 30, earth: 25, fire: 20, water: 20, air: 30 },
    },
    {
        id: 5983,
        name: "Boularbin",
        isBoss: false,
        gfxId: 1964,
        portrait: monsterPortrait(1964),
        level: 212,
        lifePoints: 9600,
        actionPoints: 10,
        movementPoints: 6,
        resistances: { neutral: 30, earth: 30, fire: 30, water: 20, air: 20 },
    },
    {
        id: 5989,
        name: "Ecaptif",
        isBoss: false,
        gfxId: 1965,
        portrait: monsterPortrait(1965),
        level: 212,
        lifePoints: 8400,
        actionPoints: 8,
        movementPoints: 4,
        resistances: { neutral: 25, earth: 20, fire: 25, water: 30, air: 30 },
    },
];

/**
 * Composition par défaut d'une salle (modifiable dans l'UI) : les 5 mobs en
 * salles 1-4, boss + 5 mobs en salle 5. La compo réelle varie en jeu (butin,
 * salle) — c'est un point de départ, pas une vérité serveur.
 */
export function defaultRoomRoster(roomIndex: number): number[] {
    return defaultTacticalRoster(SERVITUDE_MONSTERS, roomIndex, 5);
}

/** Salle par index 1-5, `undefined` hors bornes (jamais d'exception). */
export function getServitudeRoom(index: number): ServitudeRoom | undefined {
    return getTacticalRoom(SERVITUDE_ROOMS, index);
}

/** Alias historique — voir `TacticalLayout`. */
export type ActiveRoomLayout = TacticalLayout;

/** Placement actif d'une salle (normal ou variante), jamais d'exception. */
export function activeRoomLayout(room: ServitudeRoom, variantKey: string): ActiveRoomLayout {
    return activeTacticalLayout(room, variantKey);
}

/** Butin : taille d'équipe bornée 1-8 (solo → 8 joueurs). */
export function clampTeamSize(n: unknown): number {
    return clampTacticalTeam(n);
}

/** Alias historique — voir `TacticalMonsterPlacement`. */
export type MonsterPlacement = TacticalMonsterPlacement;

/**
 * Pose auto des monstres sur les cases rouges (défenseurs), dans l'ordre
 * (premier monstre sur la plus petite case — même convention que
 * `computeMonsterPlacements` pour le boss). Tronque au nombre de cases
 * rouges. Les classes joueurs se posent sur les bleues.
 */
export function autoPlaceMonsters(room: ServitudeRoom, monsterIds: number[]): MonsterPlacement[] {
    return autoPlaceTactical(room, monsterIds);
}

/** Config du simulateur (`DungeonTactical`) — salles + roster + stockage isolé. */
export const servitudeTactical: TacticalDungeon = {
    key: "servitude",
    dungeonId: SERVITUDE_DUNGEON_ID,
    dungeonName: SERVITUDE_DUNGEON_NAME,
    gameVersion: SERVITUDE_GAME_VERSION,
    rooms: SERVITUDE_ROOMS,
    monsters: SERVITUDE_MONSTERS,
    defaultRoster: defaultRoomRoster,
    storageKey: "sigilos_servitude_sim_v3",
};
