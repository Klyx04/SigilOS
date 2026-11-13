/**
 * Chargement **serveur** des données de carte du monde (`public/game-data/worldmap.json` +
 * `worlds.json`) — mises en cache process, comme le fait déjà le siphon de stats.
 *
 * Pourquoi serveur : la « capture de zone » d'une quête doit être résolue **une fois** pour
 * plusieurs surfaces (post du dashboard **et** image de l'embed Discord), sans que le navigateur
 * retélécharge 1,5 Mo de JSON à chaque ouverture de modale. Les fichiers sont servis tels quels
 * par le site (mêmes chemins), donc rien de spécifique au déploiement.
 *
 * ⚠️ `worldmap.json` est un fichier **porté par le serveur** (classe `SERVER_OWNED` du script de
 * déploiement) : on le lit, on ne l'écrit jamais.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { WorldmapData } from "@/lib/quest-minimap";

let worldmapCache: WorldmapData | null | undefined;
let worldsCache: unknown[] | null | undefined;

/** `worldmap.json` (maps + sous-zones) — `null` si le fichier est absent ou illisible. */
export function getWorldmapData(): WorldmapData | null {
    if (worldmapCache !== undefined) return worldmapCache;
    try {
        const raw = readFileSync(join(process.cwd(), "public", "game-data", "worldmap.json"), "utf8");
        worldmapCache = JSON.parse(raw) as WorldmapData;
    } catch {
        worldmapCache = null;
    }
    return worldmapCache;
}

/** `worlds.json` (origine, dimensions, échelles, nom FR de chaque monde) — `[]` si absent. */
export function getWorldsData(): unknown[] {
    if (worldsCache !== undefined) return worldsCache ?? [];
    try {
        const raw = readFileSync(join(process.cwd(), "public", "game-data", "worlds.json"), "utf8");
        const parsed = JSON.parse(raw);
        worldsCache = Array.isArray(parsed) ? parsed : [];
    } catch {
        worldsCache = [];
    }
    return worldsCache;
}
