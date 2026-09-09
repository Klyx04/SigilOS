'use server';

import { db } from '@/lib/prisma';
import { isSuperAdmin, canAccessBrick } from '@/server/actions/super-admin-actions';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';
import {
    ASSET_DIRS,
    PUBLIC_ASSET_PATHS,
    getAssetStorageStats,
    siphonAndCompressImage,
    getLocalAssetUrl,
    getValidatedAssetUrl,
} from '@/lib/dofus-asset-siphon';
import { getDofensiveDungeonForBoss } from '@/server/actions/dofensive-actions';
import { getMonsterStats } from '@/server/actions/game-data-actions';
import { persistMonsterStat } from '@/lib/dofensive-sync';

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

// ─── Garde d'autorisation SuperAdmin / PIM ───────────────────────────────────
async function canManageSiphon(): Promise<boolean> {
    if (await isSuperAdmin()) return true;
    return canAccessBrick('game-data');
}

export interface SiphonDashboardStats {
    totalDungeons: number;
    totalMonsterStatsInDb: number;
    /** Donjons avec fiche < 24 h (vrai numérateur de couverture, cf. dry-run). */
    freshDungeons: number;
    totalDofensiveMapsInDb: number;
    storage: {
        monstersCount: number;
        monstersSizeBytes: number;
        itemsCount: number;
        spellsCount: number;
        totalCount: number;
        totalSizeBytes: number;
        totalSizeFormatted: string;
    };
}

export interface SiphonInventoryItem {
    id: number | string;
    name: string;
    type: 'boss' | 'monster' | 'map';
    dungeonName?: string;
    level?: number;
    hasDbStat: boolean;
    hasLocalImage: boolean;
    hasDofensiveMap: boolean;
    remoteImageUrl?: string | null;
    localImageUrl?: string | null;
    lastSyncedAt?: string | null;
}

/**
 * Récupère les métriques globales pour le tableau de bord d'autonomie.
 */
/**
 * Clé de matching fiche ↔ donjon (mêmes règles que l'inventaire + dry-run).
 */
export function bossMatchKey(s: string | null | undefined): string {
    const k = (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();
    if (k.includes('reine nyee')) return 'reine nyee';
    if (k.includes('dernier espoir') || k.includes('eliocalypse')) return 'servitude';
    return k;
}

const FRESH_MS = 24 * 60 * 60 * 1000;

export async function getSiphonDashboardStats(): Promise<ActionResponse<SiphonDashboardStats>> {
    try {
        const [dungeons, statsRows, totalDofensiveMapsInDb] = await Promise.all([
            db.dungeon.findMany({ select: { bossName: true, name: true } }),
            db.monsterStat.findMany({ select: { monsterName: true, lastSyncedAt: true } }),
            db.dofensiveMap.count(),
        ]);

        const storageStats = getAssetStorageStats();

        const freshByKey = new Map<string, number>();
        for (const r of statsRows) {
            const k = bossMatchKey(r.monsterName);
            if (!k) continue;
            const t = r.lastSyncedAt ? new Date(r.lastSyncedAt).getTime() : NaN;
            if (Number.isFinite(t)) freshByKey.set(k, t);
        }
        const now = Date.now();
        let freshDungeons = 0;
        for (const d of dungeons) {
            const t = freshByKey.get(bossMatchKey(d.bossName || d.name));
            if (t !== undefined && now - t <= FRESH_MS) freshDungeons++;
        }

        return {
            success: true,
            data: {
                totalDungeons: dungeons.length,
                totalMonsterStatsInDb: statsRows.length,
                freshDungeons,
                totalDofensiveMapsInDb,
                storage: {
                    monstersCount: storageStats.monsters.count,
                    monstersSizeBytes: storageStats.monsters.sizeBytes,
                    itemsCount: storageStats.items.count,
                    spellsCount: storageStats.spells.count,
                    totalCount: storageStats.totalCount,
                    totalSizeBytes: storageStats.totalSizeBytes,
                    totalSizeFormatted: storageStats.totalSizeFormatted,
                },
            },
        };
    } catch (error) {
        logger.error('[getSiphonDashboardStats] Erreur:', { error });
        return { success: false, error: 'Impossible de calculer les statistiques de siphon' };
    }
}

/**
 * Récupère l'inventaire filtrable des entités de donjon et monstres avec leur état de cache local.
 */
export async function getSiphonInventory(filters: {
    type?: 'all' | 'boss' | 'monster' | 'map';
    status?: 'all' | 'cached' | 'missing';
    search?: string;
    limit?: number;
    offset?: number;
} = {}): Promise<ActionResponse<{ items: SiphonInventoryItem[]; total: number }>> {
    try {
        const dungeons = await db.dungeon.findMany({
            orderBy: { level: 'asc' },
        });

        const monsterStatsRows = await db.monsterStat.findMany({
            select: { monsterId: true, monsterName: true, dungeonName: true, lastSyncedAt: true, stats: true },
        });
        const monsterStatsMap = new Map(monsterStatsRows.map((r) => [r.monsterName.toLowerCase(), r]));

        const dofensiveMaps = await db.dofensiveMap.findMany({
            select: { mapId: true, name: true, dungeonId: true },
        });
        const dofensiveMapSet = new Set(dofensiveMaps.map((m) => m.mapId));

        const items: SiphonInventoryItem[] = [];

        for (const dj of dungeons) {
            let bossKey = dj.bossName.toLowerCase().trim();
            if (bossKey.includes('reine nyee')) bossKey = 'reine nyee';
            if (bossKey.includes('dernier espoir') || bossKey.includes('eliocalypse')) bossKey = 'servitude';

            const statRow = monsterStatsMap.get(bossKey) || monsterStatsMap.get(dj.bossName.toLowerCase().trim());
            const statsData = (statRow?.stats as any) || null;

            let numericMonsterId: number | null = null;
            if (statRow?.monsterId && typeof statRow.monsterId === 'number') {
                numericMonsterId = statRow.monsterId;
            } else if (statsData?.id && typeof statsData.id === 'number') {
                numericMonsterId = statsData.id;
            } else if (dj.dofusdbId && typeof dj.dofusdbId === 'number') {
                numericMonsterId = dj.dofusdbId;
            }

            const itemIdentifier = numericMonsterId || dj.id;
            const remoteImg = statsData?.img || null;

            // Vérification de l'image locale sur disque
            const localImg = numericMonsterId ? getLocalAssetUrl('monsters', numericMonsterId, null) : null;
            const hasLocalImage = !!localImg;

            const hasDbStat = !!statRow;
            const hasDofensiveMap = dofensiveMaps.some(
                (m) => m.name.toLowerCase().includes(dj.name.toLowerCase()) || dj.name.toLowerCase().includes(m.name.toLowerCase())
            );

            items.push({
                id: itemIdentifier,
                name: dj.bossName,
                type: 'boss',
                dungeonName: dj.name,
                level: dj.level,
                hasDbStat,
                hasLocalImage,
                hasDofensiveMap,
                remoteImageUrl: remoteImg,
                localImageUrl: localImg,
                lastSyncedAt: statRow?.lastSyncedAt?.toISOString() || null,
            });
        }

        // Application des filtres
        let filtered = items;
        if (filters.search && filters.search.trim()) {
            const q = filters.search.toLowerCase().trim();
            filtered = filtered.filter(
                (i) => i.name.toLowerCase().includes(q) || (i.dungeonName && i.dungeonName.toLowerCase().includes(q))
            );
        }

        if (filters.status === 'cached') {
            filtered = filtered.filter((i) => i.hasDbStat && i.hasLocalImage);
        } else if (filters.status === 'missing') {
            filtered = filtered.filter((i) => !i.hasDbStat || !i.hasLocalImage);
        }

        const total = filtered.length;
        const offset = filters.offset || 0;
        const limit = filters.limit || 50;
        const paginated = filtered.slice(offset, offset + limit);

        return { success: true, data: { items: paginated, total } };
    } catch (error) {
        logger.error('[getSiphonInventory] Erreur:', { error });
        return { success: false, error: 'Erreur lors du chargement de l\'inventaire de siphon' };
    }
}

/**
 * Lance le siphonnage et la compression WebP d'un lot d'images de monstres.
 * Anti-flag / stealth : concurrency 2 max avec jitter poli.
 */
export async function triggerBatchAssetSiphonAction(
    targets: Array<{ id: number | string; name: string; dungeonName?: string; remoteUrl?: string }>,
    options: { forceRefresh?: boolean } = {}
): Promise<ActionResponse<{ siphoned: number; skipped: number; errors: number; details: string[] }>> {
    if (!(await canManageSiphon())) {
        return { success: false, error: 'Accès non autorisé' };
    }

    if (!Array.isArray(targets) || targets.length === 0) {
        return { success: false, error: 'Aucune cible sélectionnée' };
    }

    let siphoned = 0;
    let skipped = 0;
    let errors = 0;
    const details: string[] = [];

    // Traitement par lot avec concurrence limitée à 2 requêtes
    const queue = [...targets];
    const CONCURRENCY = 2;

    const worker = async () => {
        while (queue.length > 0) {
            const target = queue.shift();
            if (!target) break;

            const cleanName = typeof target.name === 'string' ? target.name.trim() : '';
            const cleanDungeon = typeof target.dungeonName === 'string' ? target.dungeonName.trim() : undefined;
            const isPureNumeric = typeof target.id === 'number' || (/^\d+$/.test(String(target.id).trim()));
            let monsterId = isPureNumeric ? parseInt(String(target.id).trim(), 10) : 0;
            // URL d'image réelle connue (prioritaire sur le pattern deviné :
            // l'ID logique ≠ toujours l'ID image, ex. Cadob 3220 → img 499).
            let knownImg: string | null = typeof target.remoteUrl === 'string' ? target.remoteUrl : null;

            try {
                // 1. Si on a un ID numérique, on interroge l'API DofusDB pour les stats
                if (monsterId > 0) {
                    try {
                        const directUrl = new URL('https://api.dofusdb.fr');
                        directUrl.pathname = `/monsters/${monsterId}`;
                        const directRes = await fetch(directUrl.toString(), {
                            headers: { 'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr; Game Asset Cache)' },
                            signal: AbortSignal.timeout(8_000),
                        });
                        if (directRes.ok) {
                            const data = await directRes.json();
                            await persistMonsterStat({ ...data, dungeonName: cleanDungeon });
                            if (!knownImg && typeof data?.img === 'string') knownImg = data.img;
                        }
                    } catch {}
                }

                // 2. Si ID non présent ou introuvable, résolution par nom via getMonsterStats
                if (monsterId === 0 && cleanName) {
                    const statsRes = await getMonsterStats(cleanName, cleanDungeon, options.forceRefresh);
                    if (statsRes.success && statsRes.data) {
                        const parsedFromStats = parseInt(String(statsRes.data.id).replace(/[^0-9]/g, ''), 10);
                        if (Number.isInteger(parsedFromStats) && parsedFromStats > 0) {
                            monsterId = parsedFromStats;
                        }
                        if (!knownImg) {
                            const sImg = (statsRes.data as { img?: unknown; imageUrl?: unknown }).img
                                ?? (statsRes.data as { imageUrl?: unknown }).imageUrl;
                            if (typeof sImg === 'string') knownImg = sImg;
                        }
                    }
                }

                if (monsterId === 0) {
                    skipped++;
                    details.push(`⊘ [${cleanName}] -> Ignoré (ID monstre introuvable)`);
                    continue;
                }

                // 3. Télécharger et compresser en WebP local
                const result = await siphonAndCompressImage(knownImg, 'monsters', monsterId, options.forceRefresh);

                if (result.success) {
                    siphoned++;
                    details.push(`✓ [${cleanName}] -> ${result.localUrl} (${Math.round((result.sizeBytes || 0) / 1024)} Ko)`);
                } else {
                    errors++;
                    details.push(`✗ [${cleanName}] -> Échec: ${result.error}`);
                }

                // 4. Siphoner également la map Dofensive associée
                if (cleanDungeon) {
                    await getDofensiveDungeonForBoss(cleanName, cleanDungeon);
                }
            } catch (err) {
                errors++;
                details.push(`✗ [${cleanName}] -> Exception: ${String(err)}`);
            }
        }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker());
    await Promise.all(workers);

    logger.info(`[asset-siphon] Siphon par lot terminé : ${siphoned} réussis, ${errors} erreurs.`);

    return {
        success: true,
        data: { siphoned, skipped, errors, details },
    };
}
