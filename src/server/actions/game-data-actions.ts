'use server'

import { db } from "@/lib/prisma";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import fs from 'fs';
import path from 'path';

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
export async function getMonsterStats(monsterName: string, dungeonName?: string): Promise<ActionResponse<any>> {
    let coordinates = null;
    
    // Attempt local coordinate lookup first (very fast and reliable)
    try {
        const filePath = path.join(process.cwd(), 'public', 'game-data', 'worldmap.json');
        if (fs.existsSync(filePath)) {
            const worldMapData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            
            // 1. Try to find the dungeon by name if provided
            let dungeonInfo = null;
            if (dungeonName) {
                const searchName = dungeonName.toLowerCase().replace("défi du ", "").trim();
                dungeonInfo = worldMapData.dungeons?.find((d: any) => 
                    d.name.toLowerCase().includes(searchName) || 
                    searchName.includes(d.name.toLowerCase())
                );
            }
            
            // 2. If no dungeon match, try to find monster subarea coordinate from file
            const entranceMapId = dungeonInfo?.entranceMapId || dungeonInfo?.mapId;
            if (entranceMapId) {
                const mapNode = worldMapData.maps?.find((m: any) => m.id === entranceMapId);
                if (mapNode) {
                    coordinates = { 
                        x: mapNode.x, 
                        y: mapNode.y, 
                        worldMapId: mapNode.worldMap === -1 ? 1 : mapNode.worldMap 
                    };
                }
            }
        }
    } catch (err) {
        console.error("[getMonsterStats] Local coordinate fetch error:", err);
    }

    try {
        // Search for the monster - search by name.fr
        const searchRes = await fetch(
            `https://api.dofusdb.fr/monsters?name.fr=${encodeURIComponent(monsterName.trim())}&lang=fr&$limit=5`,
            { cache: 'no-store' }
        );
        if (!searchRes.ok) throw new Error("DofusDB search failed");
        
        const searchData = await searchRes.json();
        // Try to find exact match or take first
        const monsterHeader = searchData.data?.find((m: any) => m.name.fr.toLowerCase() === monsterName.toLowerCase().trim()) || searchData.data?.[0];
        
        if (!monsterHeader) return { success: false, error: 'Monstre non trouvé' };

        // Fetch FULL details
        const fullRes = await fetch(
            `https://api.dofusdb.fr/monsters/${monsterHeader.id}?lang=fr`,
            { cache: 'no-store' }
        );
        if (!fullRes.ok) throw new Error("DofusDB details failed");
        const monster = await fullRes.json();

        // Get items and spells mappings in parallel
        const rawDropObjectIds = monster.drops?.map((d: any) => d.objectId) || [];
        const dropObjectIds = Array.from(new Set(rawDropObjectIds)); // Deduplicate
        
        const allSpellIds = [...(monster.spells || [])];
        monster.grades?.forEach((g: any) => {
            if (g.startingSpellId) allSpellIds.push(g.startingSpellId);
        });
        const spellIds = Array.from(new Set(allSpellIds));
        
        const itemsMap: Record<number, any> = {};
        let spellsArr: any[] = [];
        
        const fetchPromises = [];
        
        // Chunk items fetch by 40 to prevent any URI length limits or DofusDB $limit=50 truncations
        for (let i = 0; i < dropObjectIds.length; i += 40) {
            const chunk = dropObjectIds.slice(i, i + 40);
            const queryQuery = chunk.map((id: unknown) => `id[$in][]=${id}`).join('&');
            fetchPromises.push(
                fetch(`https://api.dofusdb.fr/items?${queryQuery}&$limit=50&lang=fr`, { cache: 'no-store' })
                    .then(res => res.json())
                    .then(data => {
                        if (data && Array.isArray(data.data)) {
                            data.data.forEach((it: any) => { itemsMap[it.id] = it; });
                        }
                    })
                    .catch(console.error)
            );
        }
        
        if (spellIds.length > 0) {
            const spellQuery = spellIds.map((id: unknown) => `id[$in][]=${id}`).join('&');
            fetchPromises.push(
                fetch(`https://api.dofusdb.fr/spells?${spellQuery}&$limit=50&lang=fr`, { cache: 'no-store' })
                    .then(res => res.json())
                    .then(data => { 
                        if (data && Array.isArray(data.data)) {
                            spellsArr = data.data; 
                        }
                    })
                    .catch(console.error)
            );
        }

        await Promise.all(fetchPromises);
        
        // Fetch spell levels details AFTER we have spells data
        const spellLevelsMap: Record<number, any> = {};
        if (spellsArr.length > 0) {
            const requestedLevels = spellsArr.flatMap(s => {
                const levels = s.spellLevels || [];
                // Use the last level for bosses as they are high level
                return levels.length > 0 ? levels[levels.length - 1] : null;
            }).filter(Boolean);
            
            if (requestedLevels.length > 0) {
                const levelQuery = requestedLevels.map((id: unknown) => `id[$in][]=${id}`).join('&');
                const levelRes = await fetch(`https://api.dofusdb.fr/spell-levels?${levelQuery}&$limit=50&lang=fr`, { cache: 'no-store' });
                if (levelRes.ok) {
                    const levelData = await levelRes.json();
                    if (levelData && Array.isArray(levelData.data)) {
                        levelData.data.forEach((l: any) => { 
                            spellLevelsMap[l.id] = l;
                        });
                    }
                }
            }
        }

        // Final monster grade for scaling calculations
        const g5 = monster.grades?.[monster.grades.length - 1] || {};
        const monsterStats = {
            earth: g5.strength || 0,
            water: g5.chance || 0,
            fire: g5.intelligence || 0,
            air: g5.agility || 0,
            neutral: g5.strength || 0
        };

        // Mapping effect types for description with Stat Scaling
        const parseEffects = (effects: any[]) => {
            if (!effects || effects.length === 0) return null;
            return effects.map(eff => {
                const id = eff.effectId;
                const min = eff.diceNum || 0;
                const max = eff.diceSide || 0;
                let text = "";
                
                // Helper to scale damage
                const scale = (val: number, stat: number) => Math.floor(val * (1 + stat / 100));
                
                // Real Dofus Damage & Utility IDs mapping
                if (id === 100) {
                    text = `⚪ Dommages Neutre : ${scale(min, monsterStats.neutral)}-${scale(max, monsterStats.neutral)}`;
                } else if (id === 97) {
                    text = `🌿 Dommages Terre : ${scale(min, monsterStats.earth)}-${scale(max, monsterStats.earth)}`;
                } else if (id === 96) {
                    text = `💧 Dommages Eau : ${scale(min, monsterStats.water)}-${scale(max, monsterStats.water)}`;
                } else if (id === 99) {
                    text = `🔥 Dommages Feu : ${scale(min, monsterStats.fire)}-${scale(max, monsterStats.fire)}`;
                } else if (id === 98) {
                    text = `🍃 Dommages Air : ${scale(min, monsterStats.air)}-${scale(max, monsterStats.air)}`;
                } else if (id === 6 || id === 8) {
                    text = `🧲 Attire de ${min} case${min > 1 ? "s" : ""}`;
                } else if (id === 5 || id === 4) {
                    text = `💥 Repousse de ${min} case${min > 1 ? "s" : ""}`;
                } else if (id === 293 || id === 294) {
                    text = `✨ +${eff.diceSide || eff.value || 5} dégâts de base (Buff)`;
                } else if (id === 138 || id === 114) {
                    text = `💪 +${min} Puissance`;
                } else if (id === 1160 || id === 2160 || id === 2161) {
                    const triggeredId = eff.diceNum || eff.value;
                    // Specialized mapping for famous bosses like Vortex (5063)
                    if (triggeredId === 5063) {
                        text = `⚡ Applique la Contamination (Vortex)`;
                    } else if (triggeredId === 6797) {
                        text = `⚡ Applique Appel des Fonds Marins`;
                    } else if (triggeredId === 3585) {
                        text = `⚡ Fraction de molaire : repousse les ennemis`;
                    } else if (triggeredId === 3587) {
                        text = `⚡ Liqueur de Fée Ling : soin ou malus tactique`;
                    } else {
                        text = `⚡ Déclenche un effet secondaire (Sort ID:${triggeredId})`;
                    }
                } else if (id === 623) {
                    text = `➕ Invoque une entité`;
                } else if (id === 82) {
                    text = `💖 Soigne : ${min}-${max} PV`;
                } else if (id === 1) {
                    text = `🏃 Transpose de ${min} cases`;
                } else if (id === 140) {
                    text = `💀 Retrait PV directs : ${min}`;
                } else if (id === 126) {
                    text = `💀 Retrait PV directs : ${min}`;
                } else if (id === 950 || id === 951 || id === 952) {
                    text = `🌀 Applique un État (Mécanique Boss)`;
                } else if (id === 168) {
                    text = `📉 Retrait PA : ${min}`;
                } else if (id === 169) {
                    text = `📉 Retrait PM : ${min}`;
                } else if (id === 174) {
                    text = `📉 Retrait Portée : ${min}`;
                } else if (id === 160) {
                    text = `🏃 Téléporte la cible`;
                } else if (id === 121) {
                    text = `📉 Dommages subis : +${min}%`;
                }
                
                return text;
            }).filter(Boolean).join(" | ");
        };
        
        // Fallback to subarea lookup via local file if coordinates is still null
        if (!coordinates && monster.subareas?.length > 0) {
            try {
                const filePath = path.join(process.cwd(), 'public', 'game-data', 'worldmap.json');
                if (fs.existsSync(filePath)) {
                    const worldMapData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    const firstMapInSubarea = worldMapData.maps?.find((m: any) => 
                        m.subAreaId === monster.subareas[0]
                    );
                    if (firstMapInSubarea) {
                        coordinates = { 
                            x: firstMapInSubarea.x, 
                            y: firstMapInSubarea.y, 
                            worldMapId: firstMapInSubarea.worldMap === -1 ? 1 : firstMapInSubarea.worldMap 
                        };
                    }
                }
            } catch (err) { console.error("Fallback coordinate fetch error:", err); }
        }
        
        return {
            success: true,
            data: {
                id: monster.id,
                name: monster.name.fr,
                imageUrl: monster.img || `https://static.ankama.com/dofus/www/game/monsters/${monster.id}.png`,
                coordinates,
                grades: monster.grades.map((g: any, idx: number) => ({
                    level: g.level,
                    lifePoints: g.lifePoints,
                    actionPoints: g.pa || g.actionPoints,
                    movementPoints: g.pm || g.movementPoints,
                    resists: {
                        neutral: g.neutralResistance,
                        earth: g.earthResistance,
                        fire: g.fireResistance,
                        water: g.waterResistance,
                        air: g.airResistance
                    }
                })),
                drops: monster.drops?.map((d: any) => {
                    const item = itemsMap[d.objectId];
                    const iconId = item?.iconId || d.objectId;
                    const rawPercent = d.percentDropForGrade5 || d.percentDropForGrade1 || d.minPercentDrop || d.percent || 0;
                    const formattedPercent = parseFloat(rawPercent.toFixed(3));
                    return {
                        objectId: d.objectId,
                        name: item?.name?.fr || "Objet",
                        imageUrl: `https://api.dofusdb.fr/img/items/${iconId}.png`,
                        percent: formattedPercent
                    };
                }) || [],
                spells: spellsArr.map(s => {
                    const levelId = s.spellLevels?.length > 0 ? s.spellLevels[s.spellLevels.length - 1] : s.spellLevels?.[0];
                    const level = spellLevelsMap[levelId] || {};
                    const effectDesc = parseEffects(level.effects);
                    
                    // Priority for images: 
                    // 1. s.img (sometimes relative)
                    // 2. static.ankama.com
                    // 3. dofusdb.fr/img/spells/sort_{iconId}.png (last resort usually works)
                    let spellImg = s.img;
                    if (!spellImg && s.iconId) {
                        spellImg = `https://api.dofusdb.fr/img/spells/sort_${s.iconId}.png`;
                    }
                    if (spellImg && spellImg.startsWith('/')) {
                        spellImg = `https://api.dofusdb.fr${spellImg}`;
                    }

                    return {
                        id: s.id,
                        name: s.name?.fr || "Sort",
                        imageUrl: spellImg,
                        description: s.description?.fr || effectDesc || "Ce sort possède des mécaniques tactiques spécifiques au boss.",
                        apCost: level.apCost || level.paCost || 0,
                        minRange: level.minRange || 0,
                        range: level.range || level.maxRange || 0,
                        castTestLos: level.castTestLos ?? true,
                        castInLine: level.castInLine ?? false,
                        castInDiagonal: level.castInDiagonal ?? false
                    };
                })
            }
        };
    } catch (error) {
        console.error('[getMonsterStats] Error:', error);
        return { success: false, error: 'Erreur DofusDB' };
    }
}
