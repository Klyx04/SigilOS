'use server'

/**
 * Couche serveur — API Dofensive (dofensive.com/api/dofus2/bestiary).
 *
 * Dofensive expose (publiquement, JSON sans clé) exactement ce qu'il faut pour la
 * simulation de fiche boss façon « DoMaGE » :
 *   - /dungeons/preview  → donjons + leurs maps (nommées) + leurs monstres (lien boss→maps)
 *   - /maps/{id}         → map réelle : grille `cells` (0=sol marchable,
 *                          1=case impossible/trou, 2=case obstacle 3D), cases de
 *                          départ `allyCells` / `enemyCells` (cellIds Dofus)
 *   - /monsters/{id}     → monstre : PreferredMaps, Dungeons, Spells
 *
 * Proxy + cache mémoire 24 h (donnée de jeu statique) — même pattern que
 * monsterStatsCache dans game-data-actions.ts. Fail-closed : toute erreur réseau
 * renvoie { success: false } et le client garde son fallback local.
 */

import { logger } from "@/lib/logger";

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

const DOFENSIVE_BASE = "https://dofensive.com/api/dofus2/bestiary";
const DOFENSIVE_HEADERS = {
    Accept: "application/json",
    "User-Agent": "SigilOS/1.0 (+https://sigilos.fr)",
};

const dofensiveCache = new Map<string, { data: unknown; expiresAt: number }>();
const DOFENSIVE_TTL = 24 * 60 * 60 * 1000; // 24 h — data de jeu statique

function norm(s: string): string {
    return String(s ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

async function dofensiveFetch<T>(path: string, key: string): Promise<T | null> {
    const cached = dofensiveCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data as T;

    try {
        const res = await fetch(`${DOFENSIVE_BASE}${path}`, {
            headers: DOFENSIVE_HEADERS,
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`Dofensive HTTP ${res.status}`);
        const json = (await res.json()) as { Data?: unknown; Errors?: unknown[] };
        const data = json?.Data ?? null;
        if (data !== null && data !== undefined) {
            dofensiveCache.set(key, { data, expiresAt: Date.now() + DOFENSIVE_TTL });
        }
        return data as T;
    } catch (error) {
        logger.error(`[dofensive] ${key} — fetch failed:`, { error });
        return null;
    }
}

// ─── Types exposés (camelCase normalisé) ────────────────────────────────────

export interface DofensiveMapLite {
    id: number;
    name: string;
    /** true si c'est une map de combat du boss (PreferredMaps du monstre). */
    isBoss?: boolean;
}

export interface DofensiveDungeonInfo {
    dungeonId: number;
    dungeonName: string;
    maps: DofensiveMapLite[];
    monsters: { id: number; name: string }[];
    bossMonsterId: number | null;
}

export interface DofensiveMapData {
    id: number;
    name: string;
    subarea: { id: number; name: string } | null;
    dungeon: { id: number; name: string } | null;
    isBossMap: boolean;
    coordinates: { x: number; y: number } | null;
    /** Grille 2D : cells[row][col] — 0 = sol (marchable), 1 = case impossible/trou, 2 = case obstacle (3D). */
    cells: number[][];
    /** cellIds Dofus des cases de départ alliés (convention : col = id / rows, row = id % rows). */
    allyCells: number[];
    /** cellIds Dofus des cases de départ ennemis / boss. */
    enemyCells: number[];
}

export interface DofensiveMonsterData {
    id: number;
    name: string;
    preferredMaps: DofensiveMapLite[];
    dungeons: { id: number; name: string }[];
    spells: { id: number; name: string }[];
}

// ─── Actions ────────────────────────────────────────────────────────────────

/**
 * Trouve le donjon Dofensive dont la liste de monstres contient `bossName`
 * (matching normalisé : minuscules, sans accents). Retourne les maps du donjon
 * (les « salles ») + les monstres de la famille + l'id du boss.
 *
 * Ambiguïté multi-donjons (ex. « Servitude » présent dans 2 donjons) :
 *  - si `dungeonName` est fourni, on le matche d'abord (nom de donjon normalisé) ;
 *  - sinon on préfère le donjon où le boss est en tête de liste `Monsters`.
 */
export async function getDofensiveDungeonForBoss(
    bossName: string,
    dungeonName?: string
): Promise<ActionResponse<DofensiveDungeonInfo>> {
    if (!bossName || !bossName.trim()) return { success: false, error: "Nom de boss manquant" };

    const dungeons = await dofensiveFetch<any[]>(
        "/dungeons/preview?lang=fr",
        "dofensive-dungeons-preview"
    );
    if (!Array.isArray(dungeons)) return { success: false, error: "Dofensive indisponible" };

    const key = norm(bossName);
    const hits = dungeons.filter((d) =>
        Array.isArray(d?.Monsters) && d.Monsters.some((m: any) => norm(String(m?.Name ?? "")) === key)
    );

    let hit: any | undefined;
    if (dungeonName && dungeonName.trim()) {
        const dk = norm(dungeonName);
        hit = hits.find((d) => norm(String(d?.Name ?? "")).includes(dk));
    }
    if (!hit && hits.length > 1) {
        // Préfère le donjon où le boss est en tête de liste (probable boss principal).
        const ranked = hits
            .map((d) => ({ d, idx: d.Monsters.findIndex((m: any) => norm(String(m?.Name ?? "")) === key) }))
            .filter((r) => r.idx === 0);
        if (ranked.length > 0) hit = ranked[0].d;
    }
    if (!hit) hit = hits[0];
    if (!hit) return { success: false, error: `Aucun donjon Dofensive pour « ${bossName} »` };

    const boss = Array.isArray(hit.Monsters)
        ? hit.Monsters.find((m: any) => norm(String(m?.Name ?? "")) === key)
        : null;

    const dungeonMaps: DofensiveMapLite[] = Array.isArray(hit.Maps)
        ? hit.Maps.map((m: any) => ({ id: m.Id as number, name: String(m.Name ?? "") }))
        : [];

    // Marque les maps de combat du boss (PreferredMaps du monstre) pour les
    // mettre en avant dans le sélecteur de map.
    let bossMapIds: number[] = [];
    if (boss?.Id) {
        const monRaw = await dofensiveFetch<any>(`/monsters/${boss.Id}?lang=fr`, `dofensive-monster-${boss.Id}`);
        const mon = Array.isArray(monRaw) ? monRaw[0] : monRaw;
        if (mon && Array.isArray(mon.PreferredMaps)) {
            bossMapIds = mon.PreferredMaps.map((m: any) => Number(m.Id));
        }
    }

    return {
        success: true,
        data: {
            dungeonId: hit.Id as number,
            dungeonName: String(hit.Name ?? bossName),
            maps: dungeonMaps.map((m) => ({ ...m, isBoss: bossMapIds.includes(m.id) })),
            monsters: Array.isArray(hit.Monsters)
                ? hit.Monsters.map((m: any) => ({ id: m.Id as number, name: String(m.Name ?? "") }))
                : [],
            bossMonsterId: boss?.Id ?? null,
        },
    };
}

/** Charge une map réelle Dofensive (grille d'obstacles + cases de départ). */
export async function getDofensiveMap(mapId: number | string): Promise<ActionResponse<DofensiveMapData>> {
    const raw = await dofensiveFetch<any>(`/maps/${mapId}?lang=fr`, `dofensive-map-${mapId}`);
    // /maps/{id} → Data: [{ ...map }] (tableau à un élément), comme les autres endpoints.
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) return { success: false, error: "Map introuvable chez Dofensive" };

    const cells: number[][] = Array.isArray(item.Cells)
        ? item.Cells.map((row: any) => (Array.isArray(row) ? row.map((v: any) => Number(v) || 0) : []))
        : [];

    return {
        success: true,
        data: {
            id: item.Id as number,
            name: String(item.Name ?? ""),
            subarea: item.Subarea ? { id: item.Subarea.Id as number, name: String(item.Subarea.Name ?? "") } : null,
            dungeon: item.Dungeon ? { id: item.Dungeon.Id as number, name: String(item.Dungeon.Name ?? "") } : null,
            isBossMap: !!item.IsBossMap,
            coordinates: item.Coordinates ? { x: item.Coordinates.X as number, y: item.Coordinates.Y as number } : null,
            cells,
            allyCells: Array.isArray(item.AllyCells) ? item.AllyCells.map((v: any) => Number(v)) : [],
            enemyCells: Array.isArray(item.EnemyCells) ? item.EnemyCells.map((v: any) => Number(v)) : [],
        },
    };
}

/** Charge un monstre Dofensive (maps préférées + donjons + sorts). */
export async function getDofensiveMonster(monsterId: number): Promise<ActionResponse<DofensiveMonsterData>> {
    const raw = await dofensiveFetch<any>(`/monsters/${monsterId}?lang=fr`, `dofensive-monster-${monsterId}`);
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) return { success: false, error: "Monstre introuvable chez Dofensive" };

    return {
        success: true,
        data: {
            id: item.Id as number,
            name: String(item.Name ?? ""),
            preferredMaps: Array.isArray(item.PreferredMaps)
                ? item.PreferredMaps.map((m: any) => ({ id: m.Id as number, name: String(m.Name ?? "") }))
                : [],
            dungeons: Array.isArray(item.Dungeons)
                ? item.Dungeons.map((d: any) => ({ id: d.Id as number, name: String(d.Name ?? "") }))
                : [],
            spells: Array.isArray(item.Spells)
                ? item.Spells.map((s: any) => ({ id: s.Id as number, name: String(s.Name ?? "") }))
                : [],
        },
    };
}

