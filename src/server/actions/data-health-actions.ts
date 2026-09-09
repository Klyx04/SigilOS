'use server';

import { db } from '@/lib/prisma';
import { isSuperAdmin, canAccessBrick } from '@/server/actions/super-admin-actions';
import { logger } from '@/lib/logger';
import { getAssetStorageStats } from '@/lib/dofus-asset-siphon';
import { getAllCronStatuses } from '@/lib/cron-telemetry';
import {
    DATA_HEALTH_FRESH_MS,
    buildBossFicheGaps,
    type BossFicheGap,
    type DataHealthRow,
} from '@/lib/data-health';
import fs from 'fs';
import path from 'path';

export type { BossFicheGap, DataHealthRow };

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

async function canViewHealth(): Promise<boolean> {
    if (await isSuperAdmin()) return true;
    return canAccessBrick('game-data');
}

/** Dry-run BDD uniquement : aucune écriture, aucun appel externe. */
export async function checkBossFicheGaps(): Promise<ActionResponse<{ gaps: BossFicheGap[]; total: number; fresh: number }>> {
    if (!(await canViewHealth())) return { success: false, error: 'Accès non autorisé' };
    try {
        const [dungeons, statsRows] = await Promise.all([
            db.dungeon.findMany({ select: { bossName: true, name: true, level: true } }),
            db.monsterStat.findMany({ select: { monsterName: true, lastSyncedAt: true } }),
        ]);
        const gaps = buildBossFicheGaps(
            dungeons.map((d) => ({ bossName: d.bossName || d.name, name: d.name, level: d.level ?? null })),
            statsRows.map((r) => ({ monsterName: r.monsterName, lastSyncedAt: r.lastSyncedAt })),
            Date.now()
        );
        return { success: true, data: { gaps, total: dungeons.length, fresh: dungeons.length - gaps.length } };
    } catch (error) {
        logger.error('[checkBossFicheGaps] Erreur:', { error });
        return { success: false, error: 'Dry-run impossible' };
    }
}

function lastRunOf(statuses: { id: string; lastRun: string | null }[], id: string): string | null {
    return statuses.find((s) => s.id === id)?.lastRun ?? null;
}

/**
 * Vue d'ensemble "État des données" : agrégation LECTURE SEULE.
 * Chaque ligne dit source → cible, fraîcheur, couverture réelle, dernier run.
 */
export async function getDataHealthOverview(): Promise<
    ActionResponse<{ rows: DataHealthRow[]; generatedAt: string }>
> {
    if (!(await canViewHealth())) return { success: false, error: 'Accès non autorisé' };
    try {
        const [dungeons, statsRows, mapsRows, gameItemTotal, lastItem, statuses] = await Promise.all([
            db.dungeon.findMany({ select: { bossName: true, name: true, level: true } }),
            db.monsterStat.findMany({ select: { monsterName: true, lastSyncedAt: true } }),
            db.dofensiveMap.findMany({ select: { mapId: true, lastSyncedAt: true } }),
            db.gameItem.count({ where: { isDeprecated: false } }).catch(() => 0),
            db.gameItem.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }).catch(() => null),
            getAllCronStatuses().catch(() => [] as { id: string; lastRun: string | null }[]),
        ]);

        const now = Date.now();
        const gaps = buildBossFicheGaps(
            dungeons.map((d) => ({ bossName: d.bossName || d.name, name: d.name, level: d.level ?? null })),
            statsRows.map((r) => ({ monsterName: r.monsterName, lastSyncedAt: r.lastSyncedAt })),
            now
        );
        const freshCount = dungeons.length - gaps.length;
        const freshPct = dungeons.length > 0 ? Math.round((freshCount / dungeons.length) * 100) : null;

        const freshMaps = mapsRows.filter((m) => {
            const t = m.lastSyncedAt ? new Date(m.lastSyncedAt).getTime() : NaN;
            return Number.isFinite(t) && now - t <= DATA_HEALTH_FRESH_MS;
        }).length;

        let storage = { monstersCount: 0, itemsCount: 0, spellsCount: 0, totalCount: 0, totalSizeBytes: 0, totalSizeFormatted: '0 Mo' };
        try {
            const s = getAssetStorageStats();
            storage = {
                monstersCount: s.monsters.count,
                itemsCount: s.items.count,
                spellsCount: s.spells.count,
                totalCount: s.totalCount,
                totalSizeBytes: s.totalSizeBytes,
                totalSizeFormatted: s.totalSizeFormatted,
            };
        } catch {
            // FS illisible : compteurs à zéro, pas d'échec global.
        }

        let catalogue: { monsters: number; dungeons: number; sizeKb: number; mtime: string | null } = {
            monsters: 0,
            dungeons: 0,
            sizeKb: 0,
            mtime: null,
        };
        try {
            const filePath = path.join(process.cwd(), 'public', 'game-data', 'dungeon-monsters.json');
            const stat = fs.statSync(filePath);
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            catalogue = {
                monsters: Array.isArray(parsed?.monsters) ? parsed.monsters.length : 0,
                dungeons: Array.isArray(parsed?.dungeons) ? parsed.dungeons.length : 0,
                sizeKb: Math.round(stat.size / 1024),
                mtime: stat.mtime.toISOString(),
            };
        } catch {
            // Fichier absent : ligne "non généré", pas d'échec global.
        }

        let harvest = { label: '—' };
        try {
            const { getHarvestResourcesSummary } = await import('@/server/actions/game-data-actions');
            const res = await getHarvestResourcesSummary();
            if (res.success && res.data) {
                const d = res.data as { resources?: unknown[]; jobs?: unknown[]; spots?: unknown[] };
                harvest = {
                    label: `${d.resources?.length ?? 0} ressources · ${d.jobs?.length ?? 0} métiers · ${d.spots?.length ?? 0} spots`,
                };
            }
        } catch {
            // Lecture seule best-effort.
        }

        const expectedImages = Math.max(dungeons.length, 1);
        const imagesPct = Math.min(100, Math.round((storage.monstersCount / expectedImages) * 100));

        const rows: DataHealthRow[] = [
            {
                id: 'boss-fiches',
                dataset: 'Fiches boss',
                source: 'DofusDB /monsters + Dofensive sorts',
                cible: 'MonsterStat',
                fraicheur: `${freshCount}/${dungeons.length} fraîches (< 24 h)`,
                couverture: `${freshCount}/${dungeons.length} donjons`,
                couverturePct: freshPct,
                dernierRun: lastRunOf(statuses, 'sync_monster_stats'),
                goTab: 'siphon',
                goLabel: 'Onglet Siphon',
            },
            {
                id: 'maps',
                dataset: 'Maps combat',
                source: 'Dofensive /dungeons/preview + /maps',
                cible: 'DofensiveMap',
                fraicheur: `${freshMaps}/${mapsRows.length} fraîches (< 24 h)`,
                couverture: `${mapsRows.length} maps en BDD`,
                couverturePct: null,
                dernierRun: lastRunOf(statuses, 'sync_dofensive_maps'),
                goTab: 'siphon',
                goLabel: 'Onglet Siphon',
            },
            {
                id: 'images',
                dataset: 'Images WebP',
                source: 'DofusDB /img + proxy à la volée',
                cible: 'uploads/assets-dofus',
                fraicheur: null,
                couverture: `${storage.monstersCount}/${dungeons.length} boss · ${storage.itemsCount} items`,
                couverturePct: imagesPct,
                dernierRun: lastRunOf(statuses, 'sync_monster_stats'),
                goTab: 'siphon',
                goLabel: 'Siphonner manquants',
            },
            {
                id: 'items',
                dataset: 'Items BDD',
                source: 'DofusDB /items (manuel)',
                cible: 'GameItem',
                fraicheur: lastItem?.updatedAt ? `dernier item : ${lastItem.updatedAt.toISOString().slice(0, 10)}` : null,
                couverture: `${gameItemTotal} items non dépréciés`,
                couverturePct: null,
                dernierRun: null,
                goTab: 'items',
                goLabel: 'Onglet Items',
            },
            {
                id: 'catalogue',
                dataset: 'Catalogue JSON',
                source: 'DofusDB (manuel + cron)',
                cible: 'dungeon-monsters.json',
                fraicheur: catalogue.mtime ? `généré le ${catalogue.mtime.slice(0, 10)} (${catalogue.sizeKb} Ko)` : 'non généré',
                couverture: `${catalogue.dungeons} donjons · ${catalogue.monsters} monstres`,
                couverturePct: null,
                dernierRun: lastRunOf(statuses, 'sync_monster_stats'),
                goTab: 'siphon',
                goLabel: 'Régénérer',
            },
            {
                id: 'recoltables',
                dataset: 'Récoltables',
                source: 'JSON statique (lecture seule)',
                cible: 'harvest-resources.json',
                fraicheur: null,
                couverture: harvest.label,
                couverturePct: null,
                dernierRun: null,
                goTab: 'harvest',
                goLabel: 'Onglet Récoltables',
            },
            {
                id: 'stockage',
                dataset: 'Stockage',
                source: 'Disque + BDD',
                cible: '—',
                fraicheur: null,
                couverture: `${storage.totalCount} webp (${storage.totalSizeFormatted}) · ${statsRows.length} fiches · ${gameItemTotal} items`,
                couverturePct: null,
                dernierRun: null,
                goTab: 'siphon',
                goLabel: 'Détail Siphon',
            },
        ];

        return { success: true, data: { rows, generatedAt: new Date().toISOString() } };
    } catch (error) {
        logger.error('[getDataHealthOverview] Erreur:', { error });
        return { success: false, error: 'Vue ensemble indisponible' };
    }
}
