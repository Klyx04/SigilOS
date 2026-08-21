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

import type {
    DofensiveSpellCombat,
    DofensiveSpellZone,
    DofensiveZoneShape,
} from "@/lib/dofensive-spells";
import { dofensiveFetch, norm, toSafeId } from "@/lib/dofensive-fetch";
import { getLocalDofensiveDungeon, getLocalDofensiveMap, persistDofensiveMap } from "@/lib/dofensive-sync";

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

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

    // Local-first (siphon local, chantier 2) : donjon déjà synchronisé en base →
    // zéro appel réseau Dofensive (les maps/monstres/boss y sont stockés).
    try {
        const local = await getLocalDofensiveDungeon(bossName, dungeonName);
        if (local) return { success: true, data: local };
    } catch {
        // Fallback live ci-dessous
    }

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
    const bossId = toSafeId(boss?.Id);
    if (bossId) {
        const monRaw = await dofensiveFetch<any>(`/monsters/${bossId}?lang=fr`, `dofensive-monster-${bossId}`);
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
            bossMonsterId: bossId,
        },
    };
}

/** Charge une map réelle Dofensive (grille d'obstacles + cases de départ) — local-first. */
export async function getDofensiveMap(mapId: number | string): Promise<ActionResponse<DofensiveMapData>> {
    const id = toSafeId(mapId);
    if (!id) return { success: false, error: "ID de map invalide" };

    // 1. Essai local-first (PostgreSQL)
    try {
        const local = await getLocalDofensiveMap(id);
        if (local) return { success: true, data: local };
    } catch {
        // Fallback live ci-dessous
    }

    // 2. Fetch live Dofensive
    const raw = await dofensiveFetch<any>(`/maps/${id}?lang=fr`, `dofensive-map-${id}`);
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) return { success: false, error: "Map introuvable chez Dofensive" };

    const cells: number[][] = Array.isArray(item.Cells)
        ? item.Cells.map((row: any) => (Array.isArray(row) ? row.map((v: any) => Number(v) || 0) : []))
        : [];

    const data: DofensiveMapData = {
        id: item.Id as number,
        name: String(item.Name ?? ""),
        subarea: item.Subarea ? { id: item.Subarea.Id as number, name: String(item.Subarea.Name ?? "") } : null,
        dungeon: item.Dungeon ? { id: item.Dungeon.Id as number, name: String(item.Dungeon.Name ?? "") } : null,
        isBossMap: !!item.IsBossMap,
        coordinates: item.Coordinates ? { x: item.Coordinates.X as number, y: item.Coordinates.Y as number } : null,
        cells,
        allyCells: Array.isArray(item.AllyCells) ? item.AllyCells.map((v: any) => Number(v)) : [],
        enemyCells: Array.isArray(item.EnemyCells) ? item.EnemyCells.map((v: any) => Number(v)) : [],
    };

    // Auto-persistance locale en arrière-plan (self-healing)
    persistDofensiveMap(data).catch(() => {});

    return { success: true, data };
}

/** Charge un monstre Dofensive (maps préférées + donjons + sorts). */
export async function getDofensiveMonster(monsterId: number): Promise<ActionResponse<DofensiveMonsterData>> {
    const id = toSafeId(monsterId);
    if (!id) return { success: false, error: "ID de monstre invalide" };

    const raw = await dofensiveFetch<any>(`/monsters/${id}?lang=fr`, `dofensive-monster-${id}`);
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

// ─── Sorts Dofensive (données de combat riches) ─────────────────────────────
// Dofensive expose /spells/{id} avec les données de combat PAR GRADE (ActionPoints,
// MinRange/Range, CastInLine/CastInDiagonal/CastLineOfSight, MaxCastPerTurn,
// MinCastInterval, StateCriteria, zone AoE des effets). Source de vérité pour la
// simulation (bien plus fiable que les spell-levels DofusDB incomplets).
// Types partagés (client-safe) : src/lib/dofensive-spells.ts.

/** Normalise la zone AoE d'un effet Dofensive (shape déduite du nom FR + taille/portée). */
function normalizeZone(zone: any): DofensiveSpellZone | null {
    if (!zone || typeof zone !== "object") return null;
    const size = Math.max(0, Number(zone.Size) || 0);
    const range = Math.max(0, Number(zone.Range) || 0);
    const lower = String(zone.Name ?? "").toLowerCase();
    let shape: DofensiveZoneShape = "Inconnue";
    if (lower.includes("cercle")) shape = "Cercle";
    else if (lower.includes("ligne")) shape = "Ligne";
    else if (lower.includes("croix")) shape = "Croix";
    else if (lower.includes("cône") || lower.includes("cone")) shape = "Cône";
    else if (lower.includes("perpend")) shape = "Perpend";
    else if (lower.includes("rect")) shape = "Rectangle";
    else if (lower.includes("cellule") || lower.includes("proximité") || lower.includes("point")) shape = "Point";
    if (shape === "Inconnue" && size <= 0) shape = "Point";
    return { shape, size, range };
}

/**
 * Formate un nom d'effet Dofensive (template FR) : remplace `#N` par la valeur du
 * paramètre N et résout les conditionnels `{A|B}` (A si présent, sinon B sans `~`).
 * Ex. "#1{ à #2|~2} dommages Eau" + [101, 110] → "101 à 110 dommages Eau".
 */
function renderEffectName(name: any, params: any[] | undefined): string {
    let s = String(name ?? "");
    s = s.replace(/\{([^}|]*)\|([^}]*)\}/g, (_m, a: string, b: string) => (a.trim() ? a : b.replace(/^~/, "")));
    s = s.replace(/#(\d+)/g, (_m, n: string) => {
        const p = Array.isArray(params) ? params[Number(n) - 1] : undefined;
        return p && p.Name !== undefined && p.Name !== null ? String(p.Name) : "";
    });
    return s.replace(/\s+/g, " ").trim();
}

/**
 * Charge les sorts de combat d'un monstre Dofensive (AP, portée, LdV, ligne/diagonale,
 * cooldown, max cast, zone AoE). Grade = dernier niveau (le plus haut), cohérent avec
 * la fiche boss. Anti-SSRF : l'ID est validé avant toute construction d'URL.
 */
export async function getDofensiveSpells(
    monsterId: number,
    gradeLevel?: number
): Promise<ActionResponse<DofensiveSpellCombat[]>> {
    const id = toSafeId(monsterId);
    if (!id) return { success: false, error: "ID de monstre invalide" };

    const monRaw = await dofensiveFetch<any>(`/monsters/${id}?lang=fr`, `dofensive-monster-${id}`);
    const mon = Array.isArray(monRaw) ? monRaw[0] : monRaw;

    // Ordre affiché par Dofensive : sort de démarrage (StartingSpell du Grade) EN PREMIER,
    // puis la liste Spells. Ex. Fuji Givrefoux : Instinct maternel (2676) + ses 3 sorts.
    const spellIds: number[] = [];
    const pushId = (v: any) => {
        const n = toSafeId(v);
        if (n && !spellIds.includes(n)) spellIds.push(n);
    };
    if (Array.isArray(mon?.Grades)) {
        for (const g of mon.Grades) pushId(g?.StartingSpell?.Id);
    }
    if (Array.isArray(mon?.Spells)) {
        for (const s of mon.Spells) pushId(s?.Id);
    }
    if (spellIds.length === 0) return { success: false, error: "Aucun sort Dofensive" };

    const results: (DofensiveSpellCombat | null)[] = await Promise.all(
        spellIds.map(async (sid): Promise<DofensiveSpellCombat | null> => {
            const raw = await dofensiveFetch<any>(`/spells/${sid}?lang=fr`, `dofensive-spell-${sid}`);
            const spell = Array.isArray(raw) ? raw[0] : raw;
            if (!spell) return null;
            const levels: any[] = Array.isArray(spell.Levels) ? spell.Levels : [];
            // Sélectionne le niveau correspondant au grade demandé ou le grade maximum
            const targetIdx = typeof gradeLevel === "number" && gradeLevel >= 1 && gradeLevel <= levels.length
                ? gradeLevel - 1
                : levels.length - 1;
            const level = levels[targetIdx] ?? levels[levels.length - 1] ?? levels[0];
            if (!level) return null;
            const firstGroup = level.GroupEffects?.[0];
            const firstEffect = firstGroup?.Effects?.[0];
            const effects: string[] = Array.isArray(firstGroup?.Effects)
                ? firstGroup.Effects.slice(0, 6)
                      .map((e: any) => renderEffectName(e?.Name, Array.isArray(e?.Parameters) ? e.Parameters : undefined))
                      .filter(Boolean)
                : [];
            return {
                id: Number(spell.Id ?? sid),
                name: String(spell.Name ?? ""),
                // Icône officielle Dofensive (CDN, image/webp) — distincte par sort.
                imageUrl: `https://cdn.static.dofensive.com/dofensive/spells/${sid}`,
                apCost: Number(level.ActionPoints) || 0,
                minRange: Number(level.MinRange) || 0,
                range: Number(level.Range) || 0,
                castTestLos: level.CastLineOfSight ?? true,
                castInLine: level.CastInLine ?? false,
                castInDiagonal: level.CastInDiagonal ?? false,
                criticalChance: Number(level.CriticalProbability) || 0,
                // 0 = pas de restriction (ne PAS forcer à 1 : afficherait un mauvais « 1×/tour »).
                maxCastPerTurn: Number(level.MaxCastPerTurn) || 0,
                maxCastPerTarget: Number(level.MaxCastPerTarget) || 0,
                minCastInterval: Number(level.MinCastInterval) || 0,
                effects,
                zone: normalizeZone(firstEffect?.Zone),
            };
        })
    );

    const spells = results.filter((s): s is DofensiveSpellCombat => s !== null);
    if (spells.length === 0) return { success: false, error: "Sorts Dofensive vides" };
    return { success: true, data: spells };
}

/**
 * Résout l'ID Dofensive d'un monstre (via son donjon, cache 24 h) puis charge ses
 * sorts de combat. Utilitaire pour la fiche boss quand on ne connaît que le nom.
 */
export async function getBossDofensiveSpells(
    monsterName: string,
    dungeonName?: string,
    gradeLevel?: number
): Promise<ActionResponse<DofensiveSpellCombat[]>> {
    const dungeon = await getDofensiveDungeonForBoss(monsterName, dungeonName);
    const monsterId = dungeon.success ? toSafeId(dungeon.data?.bossMonsterId) : null;
    if (!monsterId) return { success: false, error: "Monstre Dofensive introuvable" };
    return getDofensiveSpells(monsterId, gradeLevel);
}

