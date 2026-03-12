'use server'

import { db } from "@/lib/prisma";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

// ─── Read-only lookups ───────────────────────────────────────

export async function getDungeons(): Promise<ActionResponse<any[]>> {
    try {
        const dungeons = await db.dungeon.findMany({ orderBy: { level: 'asc' } });
        return { success: true, data: dungeons };
    } catch (error) {
        console.error('[getDungeons] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des donjons' };
    }
}

export async function getZones(): Promise<ActionResponse<any[]>> {
    try {
        const zones = await db.zone.findMany({
            include: { families: true, dungeons: true },
            orderBy: { level: 'asc' }
        });
        return { success: true, data: zones };
    } catch (error) {
        console.error('[getZones] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des zones' };
    }
}

export async function getFamilyMonsters(familyId: string): Promise<ActionResponse<any[]>> {
    try {
        const monsters = await db.monster.findMany({ where: { familyId }, orderBy: { name: 'asc' } });
        return { success: true, data: monsters };
    } catch (error) {
        console.error('[getFamilyMonsters] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des monstres' };
    }
}

export async function searchDungeons(query: string): Promise<ActionResponse<any[]>> {
    try {
        const dungeons = await db.dungeon.findMany({
            where: { OR: [{ name: { contains: query, mode: 'insensitive' } }, { bossName: { contains: query, mode: 'insensitive' } }] },
            include: { achievements: { include: { challenge: true }, take: 5 } },
            orderBy: { level: 'asc' },
            take: 20
        });
        return { success: true, data: dungeons };
    } catch (error) {
        console.error('[searchDungeons] Error:', error);
        return { success: false, error: 'Erreur lors de la recherche' };
    }
}

export async function getMonsterFamilies(filters: { zoneId?: string; search?: string; } = {}): Promise<ActionResponse<any[]>> {
    try {
        const whereClause: any = {};
        if (filters.zoneId) whereClause.zones = { some: { id: filters.zoneId } };
        if (filters.search) whereClause.name = { contains: filters.search, mode: 'insensitive' };
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

/** Search zones — pass eventOnly=true to show only event zones */
export async function searchZones(query: string = "", eventOnly: boolean = false): Promise<ActionResponse<any[]>> {
    try {
        const where: any = { name: { contains: query, mode: 'insensitive' } };
        if (eventOnly) where.isEventZone = true;
        const zones = await db.zone.findMany({
            where,
            include: { families: true, dungeons: true },
            take: 20,
            orderBy: { name: 'asc' }
        });
        return { success: true, data: zones };
    } catch (error) {
        console.error('[searchZones] Error:', error);
        return { success: false, error: 'Erreur recherche zones' };
    }
}

export async function getDungeonsWithAchievements(): Promise<ActionResponse<any[]>> {
    try {
        const dungeons = await db.dungeon.findMany({
            include: { achievements: { include: { challenge: true } } },
            orderBy: { level: 'asc' }
        });
        return { success: true, data: dungeons };
    } catch (error) {
        console.error('[getDungeonsWithAchievements] Error:', error);
        return { success: false, error: 'Erreur lors du chargement' };
    }
}

/** Advanced dungeon search — supports event-only and zone filtering */
export async function searchDungeonsAdvanced(filters: {
    query?: string;
    minLevel?: number;
    maxLevel?: number;
    isExpedition?: boolean;
    isEventDungeon?: boolean;
    zoneId?: string;
}): Promise<ActionResponse<any[]>> {
    try {
        const where: any = {};
        if (filters.query) where.OR = [
            { name: { contains: filters.query, mode: 'insensitive' } },
            { bossName: { contains: filters.query, mode: 'insensitive' } }
        ];
        if (filters.minLevel !== undefined) where.level = { gte: filters.minLevel };
        if (filters.maxLevel !== undefined) where.level = { ...where.level, lte: filters.maxLevel };
        if (filters.isExpedition !== undefined) where.isExpedition = filters.isExpedition;
        if (filters.isEventDungeon !== undefined) where.isEventDungeon = filters.isEventDungeon;
        if (filters.zoneId) where.zones = { some: { id: filters.zoneId } };

        const dungeons = await db.dungeon.findMany({
            where,
            include: { achievements: { include: { challenge: true }, take: 10 } },
            orderBy: { level: 'asc' },
            take: 50
        });
        return { success: true, data: dungeons };
    } catch (error) {
        console.error('[searchDungeonsAdvanced] Error:', error);
        return { success: false, error: 'Erreur lors de la recherche' };
    }
}

// ─── Event Zone Management (super-admin only) ────────────────

/** All event zones with families + dungeons */
export async function getEventZones(): Promise<ActionResponse<any[]>> {
    try {
        const zones = await db.zone.findMany({
            where: { isEventZone: true },
            include: { families: { include: { monsters: { take: 3 } } }, dungeons: true },
            orderBy: { name: 'asc' }
        });
        return { success: true, data: zones };
    } catch (error) {
        console.error('[getEventZones] Error:', error);
        return { success: false, error: 'Erreur chargement zones événements' };
    }
}

/** Create or update an event zone */
export async function upsertEventZone(data: {
    id?: string;
    name: string;
    level: number;
    eventZoneKey: string;
    dpnlUrl?: string;
}): Promise<ActionResponse<any>> {
    if (!await isSuperAdmin()) return { success: false, error: 'Non autorisé' };
    try {
        const payload = { name: data.name, level: data.level || 1, eventZoneKey: data.eventZoneKey, dpnlUrl: data.dpnlUrl, isEventZone: true as const };
        const zone = data.id
            ? await db.zone.update({ where: { id: data.id }, data: payload })
            : await db.zone.create({ data: payload });
        return { success: true, data: zone };
    } catch (error) {
        console.error('[upsertEventZone] Error:', error);
        return { success: false, error: 'Erreur création/mise à jour de la zone' };
    }
}

/** Delete an event zone */
export async function deleteEventZone(zoneId: string): Promise<ActionResponse> {
    if (!await isSuperAdmin()) return { success: false, error: 'Non autorisé' };
    try {
        await db.zone.delete({ where: { id: zoneId } });
        return { success: true };
    } catch (error) {
        console.error('[deleteEventZone] Error:', error);
        return { success: false, error: 'Erreur suppression zone' };
    }
}

/** Link a monster family to an event zone */
export async function linkFamilyToZone(zoneId: string, familyId: string): Promise<ActionResponse> {
    if (!await isSuperAdmin()) return { success: false, error: 'Non autorisé' };
    try {
        await db.zone.update({ where: { id: zoneId }, data: { families: { connect: { id: familyId } } } });
        return { success: true };
    } catch (error) {
        console.error('[linkFamilyToZone] Error:', error);
        return { success: false, error: 'Erreur liaison famille' };
    }
}

/** Unlink a monster family from an event zone */
export async function unlinkFamilyFromZone(zoneId: string, familyId: string): Promise<ActionResponse> {
    if (!await isSuperAdmin()) return { success: false, error: 'Non autorisé' };
    try {
        await db.zone.update({ where: { id: zoneId }, data: { families: { disconnect: { id: familyId } } } });
        return { success: true };
    } catch (error) {
        console.error('[unlinkFamilyFromZone] Error:', error);
        return { success: false, error: 'Erreur déliaison famille' };
    }
}

/** Link a dungeon to an event zone (also marks it as event dungeon) */
export async function linkDungeonToZone(zoneId: string, dungeonId: string): Promise<ActionResponse> {
    if (!await isSuperAdmin()) return { success: false, error: 'Non autorisé' };
    try {
        await db.zone.update({ where: { id: zoneId }, data: { dungeons: { connect: { id: dungeonId } } } });
        await db.dungeon.update({ where: { id: dungeonId }, data: { isEventDungeon: true } });
        return { success: true };
    } catch (error) {
        console.error('[linkDungeonToZone] Error:', error);
        return { success: false, error: 'Erreur liaison donjon' };
    }
}

/** Unlink a dungeon from an event zone */
export async function unlinkDungeonFromZone(zoneId: string, dungeonId: string): Promise<ActionResponse> {
    if (!await isSuperAdmin()) return { success: false, error: 'Non autorisé' };
    try {
        await db.zone.update({ where: { id: zoneId }, data: { dungeons: { disconnect: { id: dungeonId } } } });
        return { success: true };
    } catch (error) {
        console.error('[unlinkDungeonFromZone] Error:', error);
        return { success: false, error: 'Erreur déliaison donjon' };
    }
}

/** Toggle isEventDungeon flag on a dungeon */
export async function toggleEventDungeon(dungeonId: string, isEvent: boolean): Promise<ActionResponse> {
    if (!await isSuperAdmin()) return { success: false, error: 'Non autorisé' };
    try {
        await db.dungeon.update({ where: { id: dungeonId }, data: { isEventDungeon: isEvent } });
        return { success: true };
    } catch (error) {
        console.error('[toggleEventDungeon] Error:', error);
        return { success: false, error: 'Erreur mise à jour donjon' };
    }
}

/** Get monsters and bounties for a specific zone */
export async function getZoneMonsters(zoneName: string): Promise<ActionResponse<{
    zoneName: string;
    normalMonsters: any[];
    avisDeRecherche: any[];
}>> {
    try {
        const zone = await db.zone.findFirst({
            where: { name: { contains: zoneName, mode: 'insensitive' } },
            include: {
                families: {
                    include: {
                        monsters: true
                    }
                }
            }
        });
        
        if (!zone) return { success: false, error: 'Zone introuvable' };
        
        const normalMonsters: any[] = [];
        const avisDeRecherche: any[] = [];
        
        zone.families.forEach(family => {
            const isAvis = family.name.toLowerCase().includes('avis de recherche');
            family.monsters.forEach(monster => {
                if (isAvis) avisDeRecherche.push(monster);
                else normalMonsters.push({ ...monster, familyName: family.name });
            });
        });
        
        return { 
            success: true, 
            data: { 
                zoneName: zone.name, 
                normalMonsters, 
                avisDeRecherche 
            } 
        };
    } catch (error) {
        console.error('[getZoneMonsters] Error:', error);
        return { success: false, error: 'Erreur chargement monstres' };
    }
}

/** Fetch bounties (Avis de recherche) for a specific zone from DofusDB */
export async function getBountiesForZone(zoneName: string): Promise<ActionResponse<any[]>> {
    try {
        // Broad regions mapping for elusive bounties
        const regionMapping: Record<string, string[]> = {
            'saharach': ['ali grothor', 'ka\'youloud', 'le khepricorne', 'simbadas'],
            'frigost': ['monsieur pingouin', 'mekamouth', 'bouflouth'],
            'pandala': ['le flib', 'marzwel le gobelin', 'musha l\'oni']
        };

        const response = await fetch(`https://api.dofusdb.fr/monsters?typeId=23&$limit=100&lang=fr`);
        if (!response.ok) throw new Error("Failed to fetch DofusDB");
        
        const data = await response.json();
        const monsters = data.data || [];
        
        const normalizedZone = zoneName.toLowerCase().trim();
        
        // Find if our zone belongs to a known region
        const regionKey = Object.keys(regionMapping).find(k => normalizedZone.includes(k));
        const regionalBounties = regionKey ? regionMapping[regionKey] : [];

        const filtered = monsters.filter((m: any) => {
             // 1. Direct subarea match
             const subAreaMatch = m.subareas && m.subareas.some((sa: any) => 
                sa.name.fr.toLowerCase().includes(normalizedZone) || 
                normalizedZone.includes(sa.name.fr.toLowerCase())
             );
             if (subAreaMatch) return true;

             // 2. Region keyword match (for Saharach, Frigost, etc)
             if (regionalBounties.length > 0) {
                 return regionalBounties.includes(m.name.fr.toLowerCase());
             }

             return false;
        });

        return { 
            success: true, 
            data: filtered.map((m: any) => ({
                id: m.id,
                name: m.name.fr,
                imageUrl: m.img || `https://static.ankama.com/dofus/www/game/monsters/${m.id}.png`,
                level: m.grades?.[0]?.level || 0,
                subarea: m.subareas?.[0]?.name?.fr || "Région"
            })) 
        };
    } catch (error) {
        console.error('[getBountiesForZone] Error:', error);
        return { success: false, error: 'Erreur lors de la récupération des avis' };
    }
}
