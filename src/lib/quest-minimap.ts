/**
 * « Capture de zone » d'une quête — règles **PURES** (aucun IO, testables en unitaire).
 *
 * D'où vient le visuel (mesuré le 16/10/2026) :
 *  · **DofusDB n'expose aucune image de quête** (`/quests/{id}` : `/img/quests/153.png` → 404) ;
 *  · il expose en revanche `startPosition[].mapId` et, par objectif, la carte complète
 *    (`posX/posY`, `subAreaId`, `worldMap`) — c'est donc **notre** donnée qui porte le visuel ;
 *  · nous l'avons déjà, en local : `worldmap.json` (dépôt) contient **14 703** entrées
 *    `{ id, x, y, subAreaId, worldMap }` (`maps`) + les libellés de `subareas`, et
 *    `public/game-data/tiles/w{monde}/{échelle}/{index}.webp` sert les **15 530** tuiles.
 *
 * La carte de lancement est écrite par le siphon dans `GameQuest.imageUrl`
 * (`/game-data/hd_maps/{mapId}.webp`) : le `mapId` est donc **dans le chemin** — on l'en extrait
 * plutôt que d'ajouter une colonne (aucune migration, aucune donnée inventée).
 *
 * Le rendu (grille de tuiles + repère) reste `resolveMinimapLandscape` : **la même règle** que
 * l'encart de la fiche donjon et que la carte Leaflet, donc le repère tombe juste.
 */
import { resolveMinimapLandscape, type MinimapGrid, type MinimapWorld } from "./dungeon-minimap";
import { hasKnownGameCoords } from "./worldmap-tiles";

/** Entrée `maps` de `worldmap.json` (le sous-ensemble utile ici). */
export interface WorldmapEntry {
    id: number;
    x: number;
    y: number;
    subAreaId: number;
    worldMap: number;
}

/** Forme tolérante du fichier (il est écrit par le panneau God / les scripts de siphon). */
export interface WorldmapData {
    maps?: unknown;
    subareas?: unknown;
}

/** `mapId` d'une carte de quête, lu dans le chemin **que nous écrivons** (`hd_maps/{id}.webp`). */
export function questMapIdFromImageUrl(imageUrl: string | null | undefined): number | null {
    const match = /\/game-data\/hd_maps\/(\d+)\.webp$/.exec(String(imageUrl ?? "").trim());
    const id = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Entrée `maps` d'une map : sa **tuile** (x, y), sa sous-zone et son monde — `null` si inconnue. */
export function findWorldmapEntry(worldmap: WorldmapData | null | undefined, mapId: number | null): WorldmapEntry | null {
    if (!mapId || !Array.isArray(worldmap?.maps)) return null;
    for (const raw of worldmap.maps as Record<string, unknown>[]) {
        if (Number(raw?.id) !== mapId) continue;
        const entry: WorldmapEntry = {
            id: mapId,
            x: Number(raw.x),
            y: Number(raw.y),
            subAreaId: Number(raw.subAreaId),
            worldMap: Number(raw.worldMap),
        };
        // Jamais une position inventée : sans coordonnées exploitables, on ne situe rien.
        if (!Number.isFinite(entry.x) || !Number.isFinite(entry.y)) return null;
        return entry;
    }
    return null;
}

/** Libellé FR d'une sous-zone (`worldmap.json.subareas`) — `null` si absent. */
export function subAreaLabel(worldmap: WorldmapData | null | undefined, subAreaId: number | null): string | null {
    if (!subAreaId || !Array.isArray(worldmap?.subareas)) return null;
    for (const raw of worldmap.subareas as Record<string, unknown>[]) {
        if (Number(raw?.id) !== subAreaId) continue;
        const name = typeof raw.name === "string" ? raw.name.trim() : "";
        return name || null;
    }
    return null;
}

export interface QuestMinimap {
    /** Grille prête à rendre (tuiles + position du repère en %). */
    grid: MinimapGrid;
    /** Coordonnées de jeu de la map de lancement. */
    x: number;
    y: number;
    worldId: number;
    worldName: string | null;
    subAreaName: string | null;
}

/**
 * Capture de zone d'une quête : sa map de lancement située sur la carte du monde.
 * `null` dès qu'un maillon manque (map inconnue, monde absent, hors grille) — **jamais** un
 * visuel approximatif : l'appelant se contente alors du libellé.
 */
export function resolveQuestMinimap(
    worldmap: WorldmapData | null | undefined,
    worlds: unknown,
    mapId: number | null
): QuestMinimap | null {
    const entry = findWorldmapEntry(worldmap, mapId);
    if (!entry) return null;
    // Le couple (0, 0) de `worldmap.json` n'est **pas** un lieu : c'est le tas des maps sans
    // coordonnées (mesuré : 2 188 maps, dont 1 449 hors du tracé de leur propre zone). Situer une
    // quête là afficherait une zone arbitraire — on refuse, comme la worldmap le fait déjà.
    if (!hasKnownGameCoords(entry)) return null;
    if (!Array.isArray(worlds)) return null;

    // `worldMap: -1` = « hors monde » : la carte du Monde des Douze (1) est le repli maison,
    // exactement comme l'encart de la fiche donjon.
    const worldId = entry.worldMap === -1 ? 1 : entry.worldMap;
    const world = (worlds as MinimapWorld[]).find((w) => Number(w?.id) === worldId);
    if (!world) return null;

    const grid = resolveMinimapLandscape(world, entry.x, entry.y);
    if (!grid) return null;

    const name = (world as { name?: unknown }).name as { fr?: unknown } | undefined;
    return {
        grid,
        x: entry.x,
        y: entry.y,
        worldId,
        worldName: typeof name?.fr === "string" ? name.fr : null,
        subAreaName: subAreaLabel(worldmap, entry.subAreaId),
    };
}
