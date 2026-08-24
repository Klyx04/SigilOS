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
} from '@/lib/dofus-asset-siphon';
import { getDofensiveDungeonForBoss } from '@/server/actions/dofensive-actions';
import { getMonsterStats } from '@/server/actions/game-data-actions';

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
    totalDofensiveMapsInDb: number;
    storage: {
        monstersCount: number;
        itemsCount: number;
        spellsCount: number;
        totalCount: number;
        totalSizeBytes: number;
        totalSizeFormatted: string;
    };
    autonomyScore: number; // 0 à 100%
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
export async function getSiphonDashboardStats(): Promise<ActionResponse<SiphonDashboardStats>> {
    try {
        const [totalDungeons, totalMonsterStatsInDb, totalDofensiveMapsInDb] = await Promise.all([
            db.dungeon.count(),
            db.monsterStat.count(),
            db.dofensiveMap.count(),
        ]);

        const storageStats = getAssetStorageStats();

        // Calcul du score d'autonomie (donjons pourvus de stats, maps et images locales)
        const expectedBossCount = Math.max(totalDungeons, 1);
        const statsRatio = Math.min(totalMonsterStatsInDb / expectedBossCount, 1);
        const mapsRatio = Math.min(totalDofensiveMapsInDb / expectedBossCount, 1);
        const imagesRatio = Math.min(storageStats.monsters.count / expectedBossCount, 1);

        const autonomyScore = Math.round(((statsRatio + mapsRatio + imagesRatio) / 3) * 100);

        return {
            success: true,
            data: {
                totalDungeons,
                totalMonsterStatsInDb,
                totalDofensiveMapsInDb,
                storage: {
                    monstersCount: storageStats.monsters.count,
                    itemsCount: storageStats.items.count,
                    spellsCount: storageStats.spells.count,
                    totalCount: storageStats.totalCount,
                    totalSizeBytes: storageStats.totalSizeBytes,
                    totalSizeFormatted: storageStats.totalSizeFormatted,
                },
                autonomyScore,
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
            const bossKey = dj.bossName.toLowerCase().trim();
            const statRow = monsterStatsMap.get(bossKey);
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

            try {
                // 1. Résolution des statistiques et de la véritable URL graphique DofusDB
                let remoteUrl = target.remoteUrl;
                let monsterId = target.id;

                // Toujours interroger getMonsterStats si l'URL est manquante ou suspecte
                const statsRes = await getMonsterStats(target.name, target.dungeonName, options.forceRefresh);
                if (statsRes.success && statsRes.data) {
                    remoteUrl = statsRes.data.img || remoteUrl;
                    monsterId = statsRes.data.id;
                }

                if (!remoteUrl || !remoteUrl.startsWith('http')) {
                    skipped++;
                    details.push(`⊘ [${target.name}] -> Ignoré (image DofusDB introuvable)`);
                    continue;
                }

                // 2. Télécharger et compresser en WebP local avec l'ID officiel du monstre
                const result = await siphonAndCompressImage(remoteUrl, 'monsters', monsterId, options.forceRefresh);

                if (result.success) {
                    siphoned++;
                    details.push(`✓ [${target.name}] -> ${result.localUrl} (${Math.round((result.sizeBytes || 0) / 1024)} Ko)`);
                } else {
                    errors++;
                    details.push(`✗ [${target.name}] -> Échec: ${result.error}`);
                }

                // 3. Siphoner également la map Dofensive associée
                if (target.dungeonName) {
                    await getDofensiveDungeonForBoss(target.name, target.dungeonName);
                }
            } catch (err) {
                errors++;
                details.push(`✗ [${target.name}] -> Exception: ${String(err)}`);
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
