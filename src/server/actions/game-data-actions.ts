'use server'

import { db } from "@/lib/prisma";

/**
 * Game Data Actions
 * Fetches reference data (dungeons, zones, monsters) for mission forms.
 * These are read-only, no permission check needed.
 */

// --- Types ---

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

// --- Actions ---

/**
 * Get all dungeons for selection
 */
export async function getDungeons(): Promise<ActionResponse<any[]>> {
    try {
        const dungeons = await db.dungeon.findMany({
            orderBy: { level: 'asc' }
        });
        return { success: true, data: dungeons };
    } catch (error) {
        console.error('[getDungeons] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des donjons' };
    }
}

/**
 * Get all zones with their monsters for selection
 */
export async function getZones(): Promise<ActionResponse<any[]>> {
    try {
        const zones = await db.zone.findMany({
            include: {
                families: true,
                dungeons: true
            },
            orderBy: { level: 'asc' }
        });
        return { success: true, data: zones };
    } catch (error) {
        console.error('[getZones] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des zones' };
    }
}

/**
 * Get monsters for a specific family
 */
export async function getFamilyMonsters(familyId: string): Promise<ActionResponse<any[]>> {
    try {
        const monsters = await db.monster.findMany({
            where: { familyId },
            orderBy: { name: 'asc' }
        });
        return { success: true, data: monsters };
    } catch (error) {
        console.error('[getFamilyMonsters] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des monstres' };
    }
}

/**
 * Search dungeons by name (for autocomplete)
 */
export async function searchDungeons(query: string): Promise<ActionResponse<any[]>> {
    try {
        const dungeons = await db.dungeon.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { bossName: { contains: query, mode: 'insensitive' } }
                ]
            },
            include: {
                achievements: {
                    include: { challenge: true },
                    take: 5
                }
            },
            orderBy: { level: 'asc' },
            take: 20
        });
        return { success: true, data: dungeons };
    } catch (error) {
        console.error('[searchDungeons] Error:', error);
        return { success: false, error: 'Erreur lors de la recherche' };
    }
}

/**
 * Get all monster families (for mission forms)
 */
export async function getMonsterFamilies(filters: {
    zoneId?: string;
    search?: string;
} = {}): Promise<ActionResponse<any[]>> {
    try {
        const whereClause: any = {};

        if (filters.zoneId) {
            whereClause.zones = { some: { id: filters.zoneId } };
        }

        if (filters.search) {
            whereClause.name = { contains: filters.search, mode: 'insensitive' };
        }

        const families = await db.monsterFamily.findMany({
            where: whereClause,
            include: { monsters: true },
            take: filters.search ? 20 : 100,
            orderBy: { name: 'asc' }
        });
        return { success: true, data: families };
    } catch (error) {
        console.error('[getMonsterFamilies] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des familles' };
    }
}

/**
 * Search zones by name
 */
export async function searchZones(query: string = ""): Promise<ActionResponse<any[]>> {
    try {
        const zones = await db.zone.findMany({
            where: {
                name: { contains: query, mode: 'insensitive' }
            },
            include: {
                families: true,
                dungeons: true
            },
            take: 20,
            orderBy: { name: 'asc' }
        });
        return { success: true, data: zones };
    } catch (error) {
        console.error('[searchZones] Error:', error);
        return { success: false, error: 'Erreur recherche zones' };
    }
}

/**
 * Get dungeons with their achievements (for mission forms)
 */
export async function getDungeonsWithAchievements(): Promise<ActionResponse<any[]>> {
    try {
        const dungeons = await db.dungeon.findMany({
            include: {
                achievements: {
                    include: { challenge: true }
                }
            },
            orderBy: { level: 'asc' }
        });
        return { success: true, data: dungeons };
    } catch (error) {
        console.error('[getDungeonsWithAchievements] Error:', error);
        return { success: false, error: 'Erreur lors du chargement' };
    }
}

/**
 * Search dungeons with advanced filters
 */
export async function searchDungeonsAdvanced(filters: {
    query?: string;
    minLevel?: number;
    maxLevel?: number;
    isExpedition?: boolean;
}): Promise<ActionResponse<any[]>> {
    try {
        const where: any = {};

        if (filters.query) {
            where.OR = [
                { name: { contains: filters.query, mode: 'insensitive' } },
                { bossName: { contains: filters.query, mode: 'insensitive' } }
            ];
        }

        if (filters.minLevel !== undefined) {
            where.level = { gte: filters.minLevel };
        }
        if (filters.maxLevel !== undefined) {
            where.level = { ...where.level, lte: filters.maxLevel };
        }
        if (filters.isExpedition !== undefined) {
            where.isExpedition = filters.isExpedition;
        }

        const dungeons = await db.dungeon.findMany({
            where,
            include: {
                achievements: {
                    include: { challenge: true },
                    take: 10
                }
            },
            orderBy: { level: 'asc' },
            take: 50
        });

        return { success: true, data: dungeons };
    } catch (error) {
        console.error('[searchDungeonsAdvanced] Error:', error);
        return { success: false, error: 'Erreur lors de la recherche' };
    }
}

