/**
 * SYNC INTELLIGENTE — siphon local des données Dofensive / DofusDB (chantier 2).
 *
 * Objectif : ne plus dépendre des API externes en direct. Les données de jeu
 * (maps de combat, donjons, fiches monstres) sont copiées dans PostgreSQL via des
 * crons quotidiens (`/api/cron/sync-dofensive-maps`, `/api/cron/sync-monster-stats`),
 * avec `versionHash` (détection des écarts) + `lastSyncedAt` (péremption 24 h).
 *
 * Les actions serveur (dofensive-actions / game-data-actions) deviennent
 * « local-first » : elles lisent d'abord la table locale et ne rafraîchissent
 * que si la donnée est absente ou périmée (> 24 h).
 *
 * Sémantique des cases (NE PAS INVERSER) : `0` = sol marchable · `1` = case
 * impossible/trou (noir, ne bloque pas la LdV) · `2` = case obstacle (bloc 3D,
 * bloque la LdV). Mapping direct, aucune heuristique de voisinage.
 */
import { createHash } from "node:crypto";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { dofensiveFetch, norm } from "@/lib/dofensive-fetch";
import type { DofensiveSpellCombat } from "@/lib/dofensive-spells";
import type { DofensiveDungeonInfo, DofensiveMapData } from "@/server/actions/dofensive-actions";

export const SYNC_TTL = 24 * 60 * 60 * 1000; // 24 h — donnée de jeu statique
/** Les tests vitest ne doivent jamais toucher PostgreSQL (les stubs fetch font foi). */
export const DB_READABLE = process.env.VITEST !== "true";

/** Hash déterministe (JSON trié) — détection de changement entre deux syncs. */
export function hashPayload(payload: unknown): string {
    const json = stableStringify(payload);
    return createHash("sha256").update(json).digest("hex").slice(0, 16);
}

function stableStringify(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (typeof value === "object") {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record)
            .sort()
            .map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}

export function isFresh(lastSyncedAt: Date | string | null | undefined): boolean {
    if (!lastSyncedAt) return false;
    const t = typeof lastSyncedAt === "string" ? new Date(lastSyncedAt).getTime() : lastSyncedAt.getTime();
    return Number.isFinite(t) && Date.now() - t < SYNC_TTL;
}

/** Normalisation des noms de monstre (minuscules, sans accents) pour les lookups robustes. */
export function normName(s: string): string {
    return norm(s);
}

/**
 * Lecture locale **hors contrôle de fraîcheur** (Lot 1 « stale-while-offline »).
 *
 * `stale = true` ⇒ la ligne **EXISTE** mais dépasse le TTL : elle doit être **servie**
 * (datée côté UI — Lot 6), jamais transformée en absence. Sinon une péremption devient une
 * **bascule live silencieuse** : c'est la cause racine de la panne du 15/09/2026 (crontab
 * cassé ⇒ données > 24 h ⇒ `null` ⇒ appel live ⇒ panne amont = panne utilisateur).
 *
 * `null` ⇒ **aucune** ligne en base : seul cas où un repli live est légitime.
 */
export interface LocalStaleResult<T> {
    data: T;
    lastSyncedAt: Date | null;
    stale: boolean;
}

/** Emballage commun : `stale` = ligne présente mais plus vieille que `SYNC_TTL`. */
export function toStaleResult<T>(data: T, lastSyncedAt: Date | string | null | undefined): LocalStaleResult<T> {
    const at = lastSyncedAt
        ? (typeof lastSyncedAt === "string" ? new Date(lastSyncedAt) : lastSyncedAt)
        : null;
    return {
        data,
        lastSyncedAt: at instanceof Date && !Number.isNaN(at.getTime()) ? at : null,
        stale: !isFresh(lastSyncedAt),
    };
}

/**
 * Garde partagée des sorts locaux : ne servir QUE des sorts de combat Dofensive
 * (`apCost` numérique + `effects` tableau) — jamais un payload DofusDB brut.
 */
export function pickCombatSpells(spells: unknown): DofensiveSpellCombat[] | null {
    if (!Array.isArray(spells) || spells.length === 0) return null;
    const combat = spells.filter((s: any) => s && typeof s?.apCost === "number" && Array.isArray(s?.effects));
    return combat.length > 0 ? (combat as DofensiveSpellCombat[]) : null;
}


// ─── Local-first getters (utilisés par les actions) ─────────────────────────

/** Lit une map Dofensive SANS contrôle de fraîcheur (Lot 1) — `null` si la ligne est absente. */
export async function getLocalDofensiveMapAny(mapId: number): Promise<LocalStaleResult<DofensiveMapData> | null> {
    if (!DB_READABLE) return null;
    try {
        const row = await db.dofensiveMap.findUnique({ where: { mapId } });
        if (!row) return null;
        const subarea = (row.subarea as { id: number; name: string } | null) ?? null;
        const coords = (row.coords as { x: number; y: number } | null) ?? null;
        return toStaleResult<DofensiveMapData>(
            {
                id: row.mapId,
                name: row.name,
                subarea,
                dungeon: row.dungeonId ? { id: row.dungeonId, name: row.name } : null,
                isBossMap: row.isBossMap,
                coordinates: coords,
                cells: row.cells as number[][],
                allyCells: row.allyCells as number[],
                enemyCells: row.enemyCells as number[],
            },
            row.lastSyncedAt
        );
    } catch (error) {
        logger.warn("[dofensive-sync] getLocalDofensiveMapAny échec:", { error: String(error) });
        return null;
    }
}

/** Lit une map Dofensive dans PostgreSQL (null si absente/périmée ou DB KO). */
export async function getLocalDofensiveMap(mapId: number): Promise<DofensiveMapData | null> {
    const hit = await getLocalDofensiveMapAny(mapId);
    return hit && !hit.stale ? hit.data : null;
}

/** Persiste une map après un fetch live (self-healing). Fire-and-forget côté appelant. */
export async function persistDofensiveMap(data: DofensiveMapData): Promise<void> {
    if (!DB_READABLE) return;
    try {
        await db.dofensiveMap.upsert({
            where: { mapId: data.id },
            create: {
                mapId: data.id,
                name: data.name,
                dungeonId: data.dungeon?.id ?? null,
                subarea: data.subarea ?? undefined,
                coords: data.coordinates ?? undefined,
                cells: data.cells,
                allyCells: data.allyCells,
                enemyCells: data.enemyCells,
                isBossMap: data.isBossMap,
                versionHash: hashPayload(data),
                lastSyncedAt: new Date(),
            },
            update: {
                name: data.name,
                dungeonId: data.dungeon?.id ?? null,
                subarea: data.subarea ?? undefined,
                coords: data.coordinates ?? undefined,
                cells: data.cells,
                allyCells: data.allyCells,
                enemyCells: data.enemyCells,
                isBossMap: data.isBossMap,
                versionHash: hashPayload(data),
                lastSyncedAt: new Date(),
            },
        });
    } catch (error) {
        logger.warn("[dofensive-sync] persistDofensiveMap échec:", { error: String(error) });
    }
}

/**
 * Siphonne UNE map Dofensive par ID (fetch + persistance locale) — utilisé par le siphon des
 * boss d'anomalie : leurs cartes de combat ne figurent dans AUCUN donjon (`PreferredMaps` du
 * monstre), donc `syncDofensiveMaps` ne les couvre pas. `force` ignore le cache mémoire/DB.
 * Fail-closed : toute erreur réseau renvoie false (la donnée précédente reste servie).
 */
export async function siphonDofensiveMapById(mapId: number, force = false): Promise<boolean> {
    if (!DB_READABLE) return false;
    const id = Number(mapId);
    if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) return false;
    try {
        if (!force) {
            const existing = await db.dofensiveMap.findUnique({ where: { mapId: id } });
            if (existing && isFresh(existing.lastSyncedAt)) return true;
        }
        const raw = await dofensiveFetch<any>(`/maps/${id}?lang=fr`, `sync-anomaly-map-${id}`, true);
        const item = Array.isArray(raw) ? raw[0] : raw;
        if (!item) return false;
        const data = normalizeMapItem(item);
        const hash = hashPayload(data);
        await db.dofensiveMap.upsert({
            where: { mapId: id },
            create: {
                mapId: data.id,
                name: data.name,
                dungeonId: data.dungeon?.id ?? null,
                subarea: data.subarea ?? undefined,
                coords: data.coordinates ?? undefined,
                cells: data.cells,
                allyCells: data.allyCells,
                enemyCells: data.enemyCells,
                isBossMap: data.isBossMap,
                versionHash: hash,
                lastSyncedAt: new Date(),
            },
            update: {
                name: data.name,
                dungeonId: data.dungeon?.id ?? null,
                subarea: data.subarea ?? undefined,
                coords: data.coordinates ?? undefined,
                cells: data.cells,
                allyCells: data.allyCells,
                enemyCells: data.enemyCells,
                isBossMap: data.isBossMap,
                versionHash: hash,
                lastSyncedAt: new Date(),
            },
        });
        return true;
    } catch (error) {
        logger.warn("[dofensive-sync] siphonDofensiveMapById échec:", { error: String(error) });
        return false;
    }
}

/** Lit un donjon Dofensive local SANS contrôle de fraîcheur (Lot 1) — `null` si aucun hit. */
export async function getLocalDofensiveDungeonAny(
    bossName: string,
    dungeonName?: string
): Promise<LocalStaleResult<DofensiveDungeonInfo> | null> {
    if (!DB_READABLE || !bossName) return null;
    try {
        const key = norm(bossName);
        const rows = await db.dofensiveDungeon.findMany();
        const hits = rows.filter((r) => {
            const monsters = r.monsters as { id: number; name: string }[];
            return Array.isArray(monsters) && monsters.some((m) => norm(String(m.name ?? "")) === key);
        });
        if (hits.length === 0) return null;

        let hit = hits[0];
        if (dungeonName && dungeonName.trim()) {
            const dk = norm(dungeonName);
            hit = hits.find((r) => norm(r.name).includes(dk)) ?? hits[0];
        }

        const monsters = (hit.monsters as { id: number; name: string }[]) ?? [];
        return toStaleResult<DofensiveDungeonInfo>(
            {
                dungeonId: hit.dungeonId,
                dungeonName: hit.name,
                maps: ((hit.maps as { id: number; name: string; isBoss?: boolean }[]) ?? []).map((m) => ({
                    id: m.id,
                    name: m.name,
                    isBoss: !!m.isBoss,
                })),
                monsters,
                bossMonsterId: hit.bossMonsterId,
            },
            hit.lastSyncedAt
        );
    } catch (error) {
        logger.warn("[dofensive-sync] getLocalDofensiveDungeonAny échec:", { error: String(error) });
        return null;
    }
}

/** Lit un donjon Dofensive (local) et cherche le boss — null si absent/périmé. */
export async function getLocalDofensiveDungeon(
    bossName: string,
    dungeonName?: string
): Promise<DofensiveDungeonInfo | null> {
    const hit = await getLocalDofensiveDungeonAny(bossName, dungeonName);
    return hit && !hit.stale ? hit.data : null;
}

/** Lit une fiche monstre locale par nom SANS contrôle de fraîcheur (Lot 1) — `null` si absente. */
export async function getLocalMonsterStatAny(monsterName: string): Promise<LocalStaleResult<any> | null> {
    if (!DB_READABLE || !monsterName) return null;
    try {
        const row = await db.monsterStat.findFirst({
            where: { monsterName: { equals: monsterName, mode: "insensitive" } },
            orderBy: { lastSyncedAt: "desc" },
        });
        if (!row) return null;
        return toStaleResult<any>(row.stats, row.lastSyncedAt);
    } catch (error) {
        logger.warn("[dofensive-sync] getLocalMonsterStatAny échec:", { error: String(error) });
        return null;
    }
}

/** Lit une fiche monstre locale par nom normalisé — null si absente/périmée. */
export async function getLocalMonsterStat(monsterName: string): Promise<any | null> {
    const hit = await getLocalMonsterStatAny(monsterName);
    return hit && !hit.stale ? hit.data : null;
}

/**
 * Lit les sorts de combat Dofensive d'un monstre SANS contrôle de fraîcheur (Lot 1).
 * `null` si la ligne est absente **ou** si elle ne contient pas de sorts de combat
 * exploitables (un payload DofusDB brut ne suffit pas : la simulation exige `apCost`).
 */
export async function getLocalDofensiveSpellsAny(
    monsterId: number
): Promise<LocalStaleResult<DofensiveSpellCombat[]> | null> {
    if (!DB_READABLE || !Number.isFinite(monsterId) || monsterId <= 0) return null;
    try {
        const row = await db.monsterStat.findUnique({ where: { monsterId } });
        if (!row) return null;
        const combat = pickCombatSpells((row.stats as any)?.spells);
        if (!combat) return null;
        return toStaleResult<DofensiveSpellCombat[]>(combat, row.lastSyncedAt);
    } catch (error) {
        logger.warn("[dofensive-sync] getLocalDofensiveSpellsAny échec:", { error: String(error) });
        return null;
    }
}

/**
 * Lit les sorts de combat Dofensive (fusionnés) d'un monstre depuis `MonsterStat.stats.spells`.
 * Retourne null si absent/périmé OU si les sorts stockés ne sont pas du « combat »
 * (champ `apCost` + `effects` présents — un simple payload DofusDB ne suffit pas).
 */
export async function getLocalDofensiveSpells(monsterId: number): Promise<DofensiveSpellCombat[] | null> {
    const hit = await getLocalDofensiveSpellsAny(monsterId);
    return hit && !hit.stale ? hit.data : null;
}

/**
 * Lit les sorts de combat LOCAUX d'un monstre par son NOM (normalisé) — utilisé par les
 * boss d'ANOMALIE : ils n'appartiennent à aucun donjon Dofensive, donc `getBossDofensiveSpells`
 * ne peut pas résoudre leur ID via un donjon. Le siphon (cron `sync-monster-stats`) stocke
 * leurs sorts de combat dans `MonsterStat.stats.spells` → lecture locale, zéro appel réseau.
 * Retourne null si absent/périmé OU si les sorts stockés ne sont pas des sorts de combat.
 */
export async function getLocalDofensiveSpellsByName(monsterName: string): Promise<DofensiveSpellCombat[] | null> {
    const name = String(monsterName ?? "").trim();
    if (!DB_READABLE || !name) return null;
    try {
        const row = await db.monsterStat.findFirst({
            where: { monsterName: { equals: name, mode: "insensitive" } },
            orderBy: { lastSyncedAt: "desc" },
        });
        if (!row || !isFresh(row.lastSyncedAt)) return null;
        const spells = (row.stats as any)?.spells;
        if (!Array.isArray(spells) || spells.length === 0) return null;
        const combat = spells.filter(
            (s: any) => s && typeof s?.apCost === "number" && Array.isArray(s?.effects)
        );
        return combat.length > 0 ? (combat as DofensiveSpellCombat[]) : null;
    } catch (error) {
        logger.warn("[dofensive-sync] getLocalDofensiveSpellsByName échec:", { error: String(error) });
        return null;
    }
}

/** Persiste la fiche monstre après un fetch live (self-healing). */
export async function persistMonsterStat(data: any): Promise<void> {
    if (!DB_READABLE || !data) return;
    try {
        const monsterId = Number(data.id);
        if (!Number.isFinite(monsterId) || monsterId <= 0) return;
        const name = String(data.name ?? "");
        if (!name) return;
        await db.monsterStat.upsert({
            where: { monsterId },
            create: {
                monsterId,
                monsterName: name,
                dungeonName: data.dungeonName ?? null,
                stats: data,
                versionHash: hashPayload(data),
                lastSyncedAt: new Date(),
            },
            update: {
                monsterName: name,
                dungeonName: data.dungeonName ?? null,
                stats: data,
                versionHash: hashPayload(data),
                lastSyncedAt: new Date(),
            },
        });
    } catch (error) {
        logger.warn("[dofensive-sync] persistMonsterStat échec:", { error: String(error) });
    }
}

// ─── Crons de sync ───────────────────────────────────────────────────────────

const CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    const queue = [...items];
    const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
        while (queue.length > 0) {
            const item = queue.shift()!;
            results.push(await fn(item));
        }
    });
    await Promise.all(workers);
    return results;
}

/** Convertit une valeur en entier positif (ou null). */
function toInt(v: unknown): number | null {
    const n = Number(v);
    return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
}

/** Normalise une map brute Dofensive (mêmes champs que getDofensiveMap). */
function normalizeMapItem(item: any): DofensiveMapData {
    const cells: number[][] = Array.isArray(item.Cells)
        ? item.Cells.map((row: any) => (Array.isArray(row) ? row.map((v: any) => Number(v) || 0) : []))
        : [];
    return {
        id: Number(item.Id) || 0,
        name: String(item.Name ?? ""),
        subarea: item.Subarea ? { id: Number(item.Subarea.Id), name: String(item.Subarea.Name ?? "") } : null,
        dungeon: item.Dungeon ? { id: Number(item.Dungeon.Id), name: String(item.Dungeon.Name ?? "") } : null,
        isBossMap: !!item.IsBossMap,
        coordinates: item.Coordinates ? { x: Number(item.Coordinates.X), y: Number(item.Coordinates.Y) } : null,
        cells,
        allyCells: Array.isArray(item.AllyCells) ? item.AllyCells.map((v: any) => Number(v)) : [],
        enemyCells: Array.isArray(item.EnemyCells) ? item.EnemyCells.map((v: any) => Number(v)) : [],
    };
}

/**
 * Cron `sync-dofensive-maps` : `/dungeons/preview` + `/maps/{id}` → tables
 * `DofensiveDungeon` + `DofensiveMap` (hash → update auto si changement, sinon on
 * ne réécrit que `lastSyncedAt`). Maps fraîches (< 24 h) sautées (anti-ratelimit).
 */
export async function syncDofensiveMaps(): Promise<SyncResult> {
    const result: SyncResult = { synced: 0, unchanged: 0, skippedFresh: 0, errors: [] };
    if (!DB_READABLE) return result;

    const dungeons = await dofensiveFetch<any[]>("/dungeons/preview?lang=fr", "sync-dungeons-preview", true);
    if (!Array.isArray(dungeons)) {
        result.errors.push("Dofensive dungeons/preview indisponible");
        return result;
    }

    // 1. Donjons + leurs maps (lite) + monstres → DofensiveDungeon.
    const allMaps: { dungeonId: number; mapId: number; isBoss: boolean }[] = [];
    for (const d of dungeons) {
        const dungeonId = toInt(d?.Id);
        if (!dungeonId) continue;
        const monsters: { id: number; name: string }[] = Array.isArray(d.Monsters)
            ? d.Monsters.map((m: any) => ({ id: Number(m?.Id) || 0, name: String(m?.Name ?? "") })).filter((m: { id: number; name: string }) => m.id > 0)
            : [];
        const liteMaps: { id: number; name: string; isBoss: boolean }[] = Array.isArray(d.Maps)
            ? d.Maps.map((m: any) => ({ id: Number(m?.Id) || 0, name: String(m?.Name ?? "") })).filter((m: { id: number; name: string }) => m.id > 0)
            : [];
        const boss = monsters.find((m) => norm(m.name) === norm(String(d.Name ?? "")));
        const payload = {
            dungeonId,
            name: String(d.Name ?? ""),
            maps: liteMaps,
            monsters,
            bossMonsterId: boss?.id ?? (monsters[0]?.id ?? null),
        };
        for (const m of liteMaps) allMaps.push({ dungeonId, mapId: m.id, isBoss: !!m.isBoss });

        try {
            const existing = await db.dofensiveDungeon.findUnique({ where: { dungeonId } });
            const hash = hashPayload({ maps: liteMaps, monsters });
            if (existing && existing.versionHash === hash) {
                result.unchanged++;
                if (isFresh(existing.lastSyncedAt)) {
                    result.skippedFresh++;
                } else {
                    await db.dofensiveDungeon.update({ where: { dungeonId }, data: { lastSyncedAt: new Date() } });
                }
            } else {
                await db.dofensiveDungeon.upsert({
                    where: { dungeonId },
                    create: { ...payload, versionHash: hash, lastSyncedAt: new Date() },
                    update: { ...payload, versionHash: hash, lastSyncedAt: new Date() },
                });
                result.synced++;
            }
        } catch (error) {
            result.errors.push(`Donjon ${dungeonId}: ${String(error)}`);
        }
    }

    // 2. Maps complètes (`/maps/{id}` → grille Cells réelle) — fraîches sautées.
    const mapJobs = allMaps.map((m) => async () => {
        try {
            const existing = await db.dofensiveMap.findUnique({ where: { mapId: m.mapId } });
            if (existing && isFresh(existing.lastSyncedAt)) {
                result.skippedFresh++;
                return;
            }
            const raw = await dofensiveFetch<any>(`/maps/${m.mapId}?lang=fr`, `sync-map-${m.mapId}`, true);
            const item = Array.isArray(raw) ? raw[0] : raw;
            if (!item) {
                result.errors.push(`Map ${m.mapId} introuvable`);
                return;
            }
            const data = normalizeMapItem(item);
            const hash = hashPayload(data);
            if (existing && existing.versionHash === hash) {
                result.unchanged++;
                await db.dofensiveMap.update({ where: { mapId: m.mapId }, data: { lastSyncedAt: new Date() } });
                return;
            }
            await db.dofensiveMap.upsert({
                where: { mapId: m.mapId },
                create: {
                    mapId: data.id,
                    name: data.name,
                    dungeonId: data.dungeon?.id ?? m.dungeonId ?? null,
                    subarea: data.subarea ?? undefined,
                    coords: data.coordinates ?? undefined,
                    cells: data.cells,
                    allyCells: data.allyCells,
                    enemyCells: data.enemyCells,
                    isBossMap: data.isBossMap || m.isBoss,
                    versionHash: hash,
                    lastSyncedAt: new Date(),
                },
                update: {
                    name: data.name,
                    dungeonId: data.dungeon?.id ?? m.dungeonId ?? null,
                    subarea: data.subarea ?? undefined,
                    coords: data.coordinates ?? undefined,
                    cells: data.cells,
                    allyCells: data.allyCells,
                    enemyCells: data.enemyCells,
                    isBossMap: data.isBossMap || m.isBoss,
                    versionHash: hash,
                    lastSyncedAt: new Date(),
                },
            });
            result.synced++;
        } catch (error) {
            result.errors.push(`Map ${m.mapId}: ${String(error)}`);
        }
    });

    await mapWithConcurrency(mapJobs, CONCURRENCY, (job) => job());
    return result;
}

export interface SyncResult {
    synced: number;
    unchanged: number;
    skippedFresh: number;
    errors: string[];
}

// ─── Audit système (crons — pas de session utilisateur) ─────────────────────

/**
 * Écrit un log God (`isGodLog:true`, invisible des logs de guilde) depuis un cron
 * qui n'a PAS de session utilisateur. `actorUserId`/`actorName` sont des valeurs
 * système (contrainte NOT NULL du modèle AuditLog).
 */
export async function createSystemAuditLog(metadata: {
    action?: string;
    targetType?: string;
    targetId?: string;
    [k: string]: unknown;
}): Promise<void> {
    if (!DB_READABLE) return;
    try {
        await db.auditLog.create({
            data: {
                actorUserId: "system-cron",
                actorName: "Système (Cron)",
                action: String(metadata.action ?? "SYSTEM_CONFIG_UPDATE"),
                targetType: String(metadata.targetType ?? "SYSTEM_GOD"),
                targetId: String(metadata.targetId ?? null),
                metadata: { ...metadata, source: "CRON", timestamp: new Date().toISOString() },
                isGodLog: true,
            },
        });
    } catch (error) {
        logger.warn("[dofensive-sync] createSystemAuditLog échec:", { error: String(error) });
    }
}

// ─── Vérificateur de liens multi-sources (HEAD) ─────────────────────────────

export interface LinkCheckResult {
    url: string;
    ok: boolean;
    status: number | null;
    error?: string;
}

/** HEAD sur chaque URL (concurrence 6) → statut. Fail-closed : réseau KO → ok:false. */
export async function checkExternalLinks(urls: string[]): Promise<LinkCheckResult[]> {
    const unique = [...new Set(urls.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)))];
    const batches: LinkCheckResult[][] = [];
    for (let i = 0; i < unique.length; i += 6) {
        const batch = await Promise.all(
            unique.slice(i, i + 6).map(async (url): Promise<LinkCheckResult> => {
                try {
                    const res = await fetch(url, {
                        method: "HEAD",
                        redirect: "follow",
                        signal: AbortSignal.timeout(10_000),
                    });
                    return { url, ok: res.ok, status: res.status };
                } catch (error) {
                    return { url, ok: false, status: null, error: String(error) };
                }
            })
        );
        batches.push(batch);
    }
    return batches.flat();
}
