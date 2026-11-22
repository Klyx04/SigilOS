/**
 * Chargement **serveur** des données de carte du monde (`public/game-data/worldmap.json` +
 * `worlds.json`) — mises en cache process, **rechargées quand le fichier change**.
 *
 * Pourquoi serveur : la « capture de zone » d'une quête doit être résolue **une fois** pour
 * plusieurs surfaces (post du dashboard **et** image de l'embed Discord), sans que le navigateur
 * retélécharge 1,5 Mo de JSON à chaque ouverture de modale. Les fichiers sont servis tels quels
 * par le site (mêmes chemins), donc rien de spécifique au déploiement.
 *
 * ⚠️ `worldmap.json` est un fichier **porté par le serveur** (classe `SERVER_OWNED` du script de
 * déploiement) : on le lit, on ne l'écrit jamais.
 *
 * 🔁 Mesure du 22/11/2026 : le monde 41 (Temple Céleste) était bien dans `worldmap.json`, mais
 * la route `map-at` répondait **404** car le cache process datait d'avant le fichier. Le cache
 * est désormais invalidé par le **mtime** : un `sync-assets` ou une écriture God est pris en
 * compte au premier appel suivant, sans redémarrage.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import type { WorldmapData } from "@/lib/quest-minimap";

let worldmapCache: WorldmapData | null | undefined;
let worldmapMtimeMs: number | null = null;
let worldsCache: unknown[] | null | undefined;
let worldsMtimeMs: number | null = null;

/** Règle pure : le cache doit-il être relu ? */
export function shouldReloadCache(
    cachedMtimeMs: number | null,
    currentMtimeMs: number
): boolean {
    return cachedMtimeMs !== currentMtimeMs;
}

/** `worldmap.json` (maps + sous-zones) — `null` si le fichier est absent ou illisible. */
export function getWorldmapData(): WorldmapData | null {
    const file = join(process.cwd(), "public", "game-data", "worldmap.json");
    try {
        const mtimeMs = statSync(file).mtimeMs;
        if (worldmapCache !== undefined && !shouldReloadCache(worldmapMtimeMs, mtimeMs)) {
            return worldmapCache;
        }
        const raw = readFileSync(file, "utf8");
        worldmapCache = JSON.parse(raw) as WorldmapData;
        worldmapMtimeMs = mtimeMs;
    } catch {
        worldmapCache = null;
        worldmapMtimeMs = null;
    }
    return worldmapCache;
}

/** `worlds.json` (origine, dimensions, échelles, nom FR de chaque monde) — `[]` si absent. */
export function getWorldsData(): unknown[] {
    const file = join(process.cwd(), "public", "game-data", "worlds.json");
    try {
        const mtimeMs = statSync(file).mtimeMs;
        if (worldsCache !== undefined && !shouldReloadCache(worldsMtimeMs, mtimeMs)) {
            return worldsCache ?? [];
        }
        const raw = readFileSync(file, "utf8");
        const parsed = JSON.parse(raw);
        worldsCache = Array.isArray(parsed) ? parsed : [];
        worldsMtimeMs = mtimeMs;
    } catch {
        worldsCache = [];
        worldsMtimeMs = null;
    }
    return worldsCache;
}

