'use server';

import { db } from '@/lib/prisma';
import { isSuperAdmin, canAccessBrick } from '@/server/actions/super-admin-actions';
import { logger } from '@/lib/logger';
import { siphonAndCompressImage } from '@/lib/dofus-asset-siphon';
import crypto from 'crypto';

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

// ─── Garde d'autorisation SuperAdmin / PIM ───────────────────────────────────
async function canManageGameItems(): Promise<boolean> {
    if (await isSuperAdmin()) return true;
    return canAccessBrick('game-data');
}

export interface GameItemSearchResult {
    id: string;
    ankamaId: number;
    name: string;
    level: number;
    typeName: string;
    category: string;
    description: string | null;
    effects: any | null;
    recipe: any | null;
    hasRecipe: boolean;
    iconUrl: string | null;
}

/**
 * 🔍 Recherche 100% Locale ultra-rapide (Local-First).
 * Utilisée par l'Encyclopédie, le module Services/Métiers et Prêts/Coffre.
 */
export async function searchLocalGameItems(
    query: string,
    category: 'all' | 'equipment' | 'resources' | 'consumables' | 'cosmetics' = 'all',
    limit = 20
): Promise<ActionResponse<GameItemSearchResult[]>> {
    try {
        const cleanQuery = (query || '').trim();
        if (cleanQuery.length < 2) {
            return { success: true, data: [] };
        }

        const safeLimit = Math.min(Math.max(limit, 1), 50);

        const where: any = {
            isDeprecated: false,
            name: {
                contains: cleanQuery,
                mode: 'insensitive',
            },
        };

        if (category !== 'all') {
            where.category = category;
        }

        const items = await db.gameItem.findMany({
            where,
            take: safeLimit,
            orderBy: [{ level: 'desc' }, { name: 'asc' }],
            select: {
                id: true,
                ankamaId: true,
                name: true,
                level: true,
                typeName: true,
                category: true,
                description: true,
                effects: true,
                recipe: true,
                hasRecipe: true,
                iconUrl: true,
            },
        });

        return { success: true, data: items };
    } catch (error: any) {
        logger.error('[searchLocalGameItems] Error:', { error: error?.message, query });
        return { success: false, error: 'Erreur lors de la recherche', data: [] };
    }
}

/**
 * 📄 Récupère la fiche détaillée d'un item par son ankamaId en local
 */
export async function getLocalGameItemDetails(ankamaId: number): Promise<ActionResponse<GameItemSearchResult | null>> {
    try {
        if (!ankamaId || isNaN(ankamaId) || ankamaId <= 0) {
            return { success: false, error: 'ID invalide' };
        }

        const item = await db.gameItem.findUnique({
            where: { ankamaId },
            select: {
                id: true,
                ankamaId: true,
                name: true,
                level: true,
                typeName: true,
                category: true,
                description: true,
                effects: true,
                recipe: true,
                hasRecipe: true,
                iconUrl: true,
            },
        });

        return { success: true, data: item };
    } catch (error: any) {
        logger.error('[getLocalGameItemDetails] Error:', { error: error?.message, ankamaId });
        return { success: false, error: 'Erreur récupération item' };
    }
}

/**
 * 📊 Statistiques de la base d'items et du siphon WebP
 */
export async function getGameItemsStats(): Promise<
    ActionResponse<{
        totalItems: number;
        totalWithRecipe: number;
        totalWebpImages: number;
        byCategory: Record<string, number>;
        lastUpdated: string | null;
    }>
> {
    if (!(await canManageGameItems())) {
        return { success: false, error: 'Non autorisé' };
    }

    try {
        const [total, withRecipe, categoriesGroup, lastItem] = await Promise.all([
            db.gameItem.count({ where: { isDeprecated: false } }),
            db.gameItem.count({ where: { isDeprecated: false, hasRecipe: true } }),
            db.gameItem.groupBy({
                by: ['category'],
                _count: { id: true },
                where: { isDeprecated: false },
            }),
            db.gameItem.findFirst({
                orderBy: { updatedAt: 'desc' },
                select: { updatedAt: true },
            }),
        ]);

        const byCategory: Record<string, number> = {};
        for (const cat of categoriesGroup) {
            byCategory[cat.category] = cat._count.id;
        }

        return {
            success: true,
            data: {
                totalItems: total,
                totalWithRecipe: withRecipe,
                totalWebpImages: total,
                byCategory,
                lastUpdated: lastItem?.updatedAt ? lastItem.updatedAt.toISOString() : null,
            },
        };
    } catch (error: any) {
        logger.error('[getGameItemsStats] Error:', { error: error?.message });
        return { success: false, error: 'Erreur statistiques' };
    }
}

/**
 * 🔄 Siphon par lot d'items depuis DofusDB avec détection différentielle (Hash)
 */
export async function siphonGameItemsBatch(skip = 0, limit = 50): Promise<
    ActionResponse<{
        inserted: number;
        updated: number;
        totalProcessed: number;
        hasMore: boolean;
        nextSkip: number;
    }>
> {
    if (!(await canManageGameItems())) {
        return { success: false, error: 'Non autorisé' };
    }

    try {
        const safeLimit = Math.min(Math.max(limit, 10), 100);
        const url = `https://api.dofusdb.fr/items?$limit=${safeLimit}&$skip=${skip}`;

        const res = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)',
            },
            signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) {
            return { success: false, error: `DofusDB a renvoyé HTTP ${res.status}` };
        }

        const json = await res.json();
        const rawItems: any[] = Array.isArray(json?.data) ? json.data : [];
        const totalInDofusDB = Number(json?.total ?? 0);

        if (rawItems.length === 0) {
            return {
                success: true,
                data: { inserted: 0, updated: 0, totalProcessed: 0, hasMore: false, nextSkip: skip },
            };
        }

        let inserted = 0;
        let updated = 0;

        for (const raw of rawItems) {
            const ankamaId = Number(raw.id);
            if (!ankamaId || isNaN(ankamaId) || ankamaId <= 0) continue;

            const name = typeof raw.name?.fr === 'string' ? raw.name.fr : String(raw.name || 'Objet');
            const level = Number(raw.level || 1);
            const typeId = raw.typeId ? Number(raw.typeId) : null;
            const typeName = typeof raw.type?.name?.fr === 'string' ? raw.type.name.fr : 'Équipement';
            const description = typeof raw.description?.fr === 'string' ? raw.description.fr : null;
            const effects = Array.isArray(raw.possibleEffects)
                ? raw.possibleEffects
                : Array.isArray(raw.effects)
                ? raw.effects
                : null;
            const hasRecipe = Boolean(raw.hasRecipe || raw.is_recipe_item);

            // Déterminer la catégorie principale
            let category = 'equipment';
            const typeLower = typeName.toLowerCase();
            if (typeLower.includes('ressource') || typeLower.includes('matière') || typeLower.includes('alliage')) {
                category = 'resources';
            } else if (typeLower.includes('consommable') || typeLower.includes('potion') || typeLower.includes('pain') || typeLower.includes('viande')) {
                category = 'consumables';
            } else if (typeLower.includes('apparat') || typeLower.includes('cosmétique') || typeLower.includes('montilier') || typeLower.includes('costume')) {
                category = 'cosmetics';
            }

            // Calcul du Hash MD5 pour détecter les modifications réelles
            const hashPayload = JSON.stringify({ name, level, typeName, effects, hasRecipe });
            const dataHash = crypto.createHash('md5').update(hashPayload).digest('hex');

            const existing = await db.gameItem.findUnique({
                where: { ankamaId },
                select: { id: true, dataHash: true },
            });

            const localIconUrl = `/uploads/assets-dofus/items/${ankamaId}.webp`;

            if (!existing) {
                await db.gameItem.create({
                    data: {
                        ankamaId,
                        name,
                        level,
                        typeId,
                        typeName,
                        category,
                        description,
                        effects: effects as any,
                        hasRecipe,
                        iconUrl: localIconUrl,
                        dataHash,
                        isDeprecated: false,
                    },
                });
                inserted++;

                // Siphon WebP de l'image en asynchrone non-bloquant
                const remoteImg = raw.imgset?.[0]?.sd || raw.imgset?.[0]?.icon || raw.img;
                siphonAndCompressImage(remoteImg, 'items', ankamaId).catch(() => {});
            } else if (existing.dataHash !== dataHash) {
                await db.gameItem.update({
                    where: { ankamaId },
                    data: {
                        name,
                        level,
                        typeId,
                        typeName,
                        category,
                        description,
                        effects: effects as any,
                        hasRecipe,
                        iconUrl: localIconUrl,
                        dataHash,
                        isDeprecated: false,
                    },
                });
                updated++;
            }
        }

        const nextSkip = skip + rawItems.length;
        const hasMore = nextSkip < totalInDofusDB && rawItems.length === safeLimit;

        return {
            success: true,
            data: {
                inserted,
                updated,
                totalProcessed: rawItems.length,
                hasMore,
                nextSkip,
            },
        };
    } catch (error: any) {
        logger.error('[siphonGameItemsBatch] Error:', { error: error?.message, skip, limit });
        return { success: false, error: `Erreur lors du siphon: ${error?.message}` };
    }
}
