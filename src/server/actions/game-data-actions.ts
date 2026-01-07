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
            include: { monsters: true },
            orderBy: { level: 'asc' }
        });
        return { success: true, data: zones };
    } catch (error) {
        console.error('[getZones] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des zones' };
    }
}

/**
 * Get monsters for a specific zone
 */
export async function getZoneMonsters(zoneId: string): Promise<ActionResponse<any[]>> {
    try {
        const monsters = await db.monster.findMany({
            where: { zoneId },
            orderBy: { name: 'asc' }
        });
        return { success: true, data: monsters };
    } catch (error) {
        console.error('[getZoneMonsters] Error:', error);
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
            orderBy: { level: 'asc' },
            take: 20
        });
        return { success: true, data: dungeons };
    } catch (error) {
        console.error('[searchDungeons] Error:', error);
        return { success: false, error: 'Erreur lors de la recherche' };
    }
}
