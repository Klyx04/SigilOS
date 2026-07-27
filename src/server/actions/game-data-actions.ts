'use server'

import { db } from "@/lib/prisma";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { getUserContext } from "@/server/actions/user-actions";
import fs from 'fs';
import path from 'path';
import { logger } from "@/lib/logger";

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
        logger.error('[getDungeons] Error:', { error });
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
        logger.error('[getZones] Error:', { error });
        return { success: false, error: 'Erreur lors du chargement des zones' };
    }
}

export async function getFamilyMonsters(familyId: string): Promise<ActionResponse<any[]>> {
    try {
        const monsters = await db.monster.findMany({ where: { familyId }, orderBy: { name: 'asc' } });
        return { success: true, data: monsters };
    } catch (error) {
        logger.error('[getFamilyMonsters] Error:', { error });
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
        logger.error('[searchDungeons] Error:', { error });
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
        logger.error('[getMonsterFamilies] Error:', { error });
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
        logger.error('[searchZones] Error:', { error });
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
        logger.error('[getDungeonsWithAchievements] Error:', { error });
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
        logger.error('[searchDungeonsAdvanced] Error:', { error });
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
        logger.error('[getEventZones] Error:', { error });
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
        const zone = await db.zone.upsert({
            where: data.id ? { id: data.id } : { name: data.name },
            update: payload,
            create: payload
        });
        return { success: true, data: zone };
    } catch (error) {
        logger.error('[upsertEventZone] Error:', { error });
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
        logger.error('[deleteEventZone] Error:', { error });
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
        logger.error('[linkFamilyToZone] Error:', { error });
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
        logger.error('[unlinkFamilyFromZone] Error:', { error });
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
        logger.error('[linkDungeonToZone] Error:', { error });
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
        logger.error('[unlinkDungeonFromZone] Error:', { error });
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
        logger.error('[toggleEventDungeon] Error:', { error });
        return { success: false, error: 'Erreur mise à jour donjon' };
    }
}

/** Get monsters and bounties for a specific zone */
export async function getZoneMonsters(zoneName: string): Promise<ActionResponse<{
    zoneName: string;
    normalMonsters: any[];
    avisDeRecherche: any[];
    families: any[];
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
        const families: any[] = [];

        zone.families.forEach(family => {
            const isAvis = family.name.toLowerCase().includes('avis de recherche');
            if (!isAvis) {
                families.push({
                    id: family.id,
                    name: family.name,
                    imageUrl: family.imageUrl,
                    monstersCount: family.monsters.length
                });
            }
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
                avisDeRecherche,
                families
            }
        };
    } catch (error) {
        logger.error('[getZoneMonsters] Error:', { error });
        return { success: false, error: 'Erreur chargement monstres' };
    }
}

/** Fetch bounties (Avis de recherche) for a specific zone from DofusDB */
export async function getBountiesForZone(zoneName: string): Promise<ActionResponse<any[]>> {
    try {
        const normalizedZone = zoneName.toLowerCase().trim();
        const unaccentedZone = normalizedZone.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const baseZone = unaccentedZone.replace(/^(cité d'|village d'|champs d'|forêt d'|prairies d'|bordure d'|massif d'|routes? d'|forêt |lac )/i, "").trim();

        const localBounties = await db.bounty.findMany({
            where: {
                OR: [
                    { zoneName: { contains: zoneName, mode: 'insensitive' } },
                    { zoneName: { contains: normalizedZone, mode: 'insensitive' } },
                    { zoneName: { contains: unaccentedZone, mode: 'insensitive' } },
                    { zoneName: { contains: baseZone, mode: 'insensitive' } },
                ]
            }
        });

        logger.debug(`[Bounties] Requested zone: "${zoneName}" -> normalized: "${normalizedZone}" -> base: "${baseZone}". Found local: ${localBounties.length}`);

        // 2. Fallback/Merge with DofusDB for dynamic data or missing entries
        const regionMapping: Record<string, string[]> = {
            'saharach': ['ali grothor', 'ka\'youloud', 'le khepricorne', 'simbadas'],
            'frigost': ['monsieur pingouin', 'mekamouth', 'bouflouth'],
            'pandala': ['le flib', 'marzwel le gobelin', 'musha l\'oni']
        };

        const response = await fetch(`https://api.dofusdb.fr/monsters?typeId=23&$limit=100&lang=fr`);
        const data = await response.json();
        const monsters = data.data || [];

        const regionKey = Object.keys(regionMapping).find(k => normalizedZone.includes(k));
        const regionalBounties = regionKey ? regionMapping[regionKey] : [];

        const externalFiltered = monsters.filter((m: any) => {
            const subAreaMatch = m.subareas && m.subareas.some((sa: any) =>
                sa.name.fr.toLowerCase().includes(normalizedZone) ||
                normalizedZone.includes(sa.name.fr.toLowerCase())
            );
            if (subAreaMatch) return true;
            if (regionalBounties.length > 0) {
                return regionalBounties.includes(m.name.fr.toLowerCase());
            }
            return false;
        });

        // 3. Merged result: prioritize localDB info (like guide links), but fix minimap images
        const merged = [...localBounties.map(b => {
            const dofusDbMatch = monsters.find((m: any) => m.name.fr.toLowerCase() === b.name.toLowerCase());
            let finalImage = b.imageUrl;

            if (finalImage && finalImage.startsWith('/images/bounties/') && dofusDbMatch) {
                finalImage = dofusDbMatch.img || `https://static.ankama.com/dofus/www/game/monsters/${dofusDbMatch.id}.png`;
            }

            return {
                id: b.id,
                name: b.name,
                imageUrl: finalImage,
                mapUrl: b.mapUrl || (b.imageUrl?.startsWith('/images/bounties/') ? b.imageUrl : null),
                level: b.level,
                subarea: b.zoneName,
                guideUrl: b.dpnlUrl,
                doplons: b.doplons,
                rewardType: b.rewardType,
                rewards: b.rewards,
                milice: b.milice,
                mechanics: b.mechanics
            };
        })];

        // Add external bounties that aren't in local DB yet
        externalFiltered.forEach((m: any) => {
            if (!merged.find(b => b.name.toLowerCase() === m.name.fr.toLowerCase())) {
                merged.push({
                    id: m.id,
                    name: m.name.fr,
                    imageUrl: m.img || `https://static.ankama.com/dofus/www/game/monsters/${m.id}.png`,
                    level: m.grades?.[0]?.level || 0,
                    subarea: m.subareas?.[0]?.name?.fr || "Région",
                    guideUrl: null,
                    doplons: 0,
                    rewardType: 'Doplon',
                    rewards: [],
                    milice: null,
                    mechanics: null,
                    mapUrl: null,
                });
            }
        });

        return { success: true, data: merged };
    } catch (error) {
        logger.error('[getBountiesForZone] Error:', { error });
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
        logger.error("[getMonsterStats] Local coordinate fetch error:", { error: err });
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

        // 1. Scan for triggered spell IDs
        const triggeredSpellIds: number[] = [];
        spellsArr.forEach(s => {
            const levelId = s.spellLevels?.length > 0 ? s.spellLevels[s.spellLevels.length - 1] : s.spellLevels?.[0];
            const level = spellLevelsMap[levelId];
            if (level && Array.isArray(level.effects)) {
                level.effects.forEach((eff: any) => {
                    if (eff.effectId === 1160 || eff.effectId === 2160 || eff.effectId === 2161) {
                        const tid = eff.diceNum || eff.value;
                        if (tid && typeof tid === 'number') {
                            triggeredSpellIds.push(tid);
                        }
                    }
                });
            }
        });

        // Deduplicate triggeredSpellIds and remove any that are already in spellIds
        const uniqueTriggeredIds = Array.from(new Set(triggeredSpellIds)).filter((id: number) => !spellIds.includes(id));
        const subSpellsMap: Record<number, { name: string, effects: any[] }> = {};

        // Also add main spells to subSpellsMap in case they trigger each other
        spellsArr.forEach(s => {
            const levelId = s.spellLevels?.length > 0 ? s.spellLevels[s.spellLevels.length - 1] : s.spellLevels?.[0];
            const level = spellLevelsMap[levelId];
            subSpellsMap[s.id] = {
                name: s.name?.fr || "Sort",
                effects: level?.effects || []
            };
        });

        if (uniqueTriggeredIds.length > 0) {
            try {
                // Fetch sub-spells
                const subSpellQuery = uniqueTriggeredIds.map((id: number) => `id[$in][]=${id}`).join('&');
                const subSpellsRes = await fetch(`https://api.dofusdb.fr/spells?${subSpellQuery}&$limit=50&lang=fr`, { cache: 'no-store' });
                if (subSpellsRes.ok) {
                    const subSpellsData = await subSpellsRes.json();
                    const subSpellsArr = subSpellsData.data || [];

                    // Fetch sub-spells levels
                    const subLevelsToFetch = subSpellsArr.flatMap((s: any) => {
                        const levels = s.spellLevels || [];
                        return levels.length > 0 ? levels[levels.length - 1] : null;
                    }).filter(Boolean);

                    if (subLevelsToFetch.length > 0) {
                        const subLevelQuery = subLevelsToFetch.map((id: any) => `id[$in][]=${id}`).join('&');
                        const subLevelRes = await fetch(`https://api.dofusdb.fr/spell-levels?${subLevelQuery}&$limit=50&lang=fr`, { cache: 'no-store' });
                        if (subLevelRes.ok) {
                            const subLevelData = await subLevelRes.json();
                            const subLevelsMap: Record<number, any> = {};
                            if (subLevelData && Array.isArray(subLevelData.data)) {
                                subLevelData.data.forEach((l: any) => {
                                    subLevelsMap[l.id] = l;
                                });
                            }

                            subSpellsArr.forEach((s: any) => {
                                const levelId = s.spellLevels?.length > 0 ? s.spellLevels[s.spellLevels.length - 1] : s.spellLevels?.[0];
                                const level = subLevelsMap[levelId];
                                subSpellsMap[s.id] = {
                                    name: s.name?.fr || "Effet secondaire",
                                    effects: level?.effects || []
                                };
                            });
                        }
                    }
                }
            } catch (err) {
                logger.error("[getMonsterStats] Failed to fetch triggered sub-spells:", { error: err });
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
        const parseEffects = (effects: any[], isSubSpell = false): string | null => {
            if (!effects || effects.length === 0) return null;
            return effects.map(eff => {
                const id = eff.effectId;
                const min = eff.diceNum || 0;
                const max = eff.diceSide || 0;
                let text = "";

                // Helper to scale damage
                const scale = (val: number, stat: number) => Math.floor(val * (1 + stat / 100));
                // Format a damage value: show single value when fixed (diceSide=0), range otherwise
                const dmg = (scaledMin: number, scaledMax: number) =>
                    scaledMax > 0 ? `${scaledMin}-${scaledMax}` : `${scaledMin}`;

                // Element-based direct damage IDs — effectElement: 1=Terre 2=Feu 3=Eau 4=Air 5+=Neutre
                const elementDamageIds = [91, 92, 93, 94, 95, 112, 113, 117];
                if (elementDamageIds.includes(id) && min > 0) {
                    const elem = eff.effectElement;
                    if (elem === 1)      text = `Dommages Terre : ${dmg(scale(min, monsterStats.earth),   scale(max, monsterStats.earth))}`;
                    else if (elem === 2) text = `Dommages Feu   : ${dmg(scale(min, monsterStats.fire),    scale(max, monsterStats.fire))}`;
                    else if (elem === 3) text = `Dommages Eau   : ${dmg(scale(min, monsterStats.water),   scale(max, monsterStats.water))}`;
                    else if (elem === 4) text = `Dommages Air   : ${dmg(scale(min, monsterStats.air),     scale(max, monsterStats.air))}`;
                    else                text = `Dommages Neutre : ${dmg(scale(min, monsterStats.neutral), scale(max, monsterStats.neutral))}`;
                // Vol de vie / classic steal-damage IDs
                } else if (id === 100) {
                    text = `Vol de vie Neutre : ${dmg(scale(min, monsterStats.neutral), scale(max, monsterStats.neutral))}`;
                } else if (id === 97) {
                    text = `Dommages Terre : ${dmg(scale(min, monsterStats.earth), scale(max, monsterStats.earth))}`;
                } else if (id === 96) {
                    text = `Dommages Eau : ${dmg(scale(min, monsterStats.water), scale(max, monsterStats.water))}`;
                } else if (id === 99) {
                    text = `Dommages Feu : ${dmg(scale(min, monsterStats.fire), scale(max, monsterStats.fire))}`;
                } else if (id === 98) {
                    text = `Dommages Air : ${dmg(scale(min, monsterStats.air), scale(max, monsterStats.air))}`;
                } else if (id === 6 || id === 8) {
                    text = `Attire de ${min} case${min > 1 ? "s" : ""}`;
                } else if (id === 5 || id === 4) {
                    text = `Repousse de ${min} case${min > 1 ? "s" : ""}`;
                } else if (id === 1103) {
                    const val = eff.value || min;
                    text = val > 0 ? `Repousse différée de ${val} case${val > 1 ? "s" : ""}` : `Repousse (effet différé)`;
                } else if (id === 753) {
                    text = `+${min} Tacle`;
                } else if (id === 754) {
                    text = `+${min} Tacle (buff)`;
                } else if (id === 132) {
                    text = `Immobilise la cible`;
                } else if (id === 293 || id === 294) {
                    text = `+${eff.diceSide || eff.value || 5} dégâts de base (Buff)`;
                } else if (id === 138 || id === 114) {
                    text = `+${min} Puissance`;
                } else if (id === 1160 || id === 2160 || id === 2161) {
                    if (isSubSpell) {
                        text = `Déclenche effet (Sort ID:${eff.diceNum || eff.value})`;
                    } else {
                        const triggeredId = eff.diceNum || eff.value;
                        const subSpell = subSpellsMap[triggeredId];
                        if (subSpell) {
                            const subEffectsParsed = parseEffects(subSpell.effects, true);
                            if (subEffectsParsed) {
                                text = `Déclenche ${subSpell.name} (${subEffectsParsed})`;
                            } else {
                                text = `Déclenche ${subSpell.name}`;
                            }
                        } else {
                            if (triggeredId === 5063) {
                                text = `Applique la Contamination (Vortex)`;
                            } else if (triggeredId === 6797) {
                                text = `Applique Appel des Fonds Marins`;
                            } else if (triggeredId === 3585) {
                                text = `Fraction de molaire : repousse les ennemis`;
                            } else if (triggeredId === 3587) {
                                text = `Liqueur de Fée Ling : soin ou malus tactique`;
                            } else {
                                text = `Déclenche un effet secondaire (Sort ID:${triggeredId})`;
                            }
                        }
                    }
                } else if (id === 623) {
                    text = `Invoque une entité`;
                } else if (id === 82) {
                    text = `Soigne : ${min}-${max} PV`;
                } else if (id === 1) {
                    text = `Transpose de ${min} cases`;
                } else if (id === 140) {
                    text = `Retrait PV directs : ${min}`;
                } else if (id === 126) {
                    text = `Retrait PV directs : ${min}`;
                } else if (id === 950 || id === 951 || id === 952) {
                    text = `Applique un État (Mécanique Boss)`;
                } else if (id === 168) {
                    text = `Retrait PA : ${min}`;
                } else if (id === 169) {
                    text = `Retrait PM : ${min}`;
                } else if (id === 174) {
                    text = `Retrait Portée : ${min}`;
                } else if (id === 160) {
                    text = `Téléporte la cible`;
                } else if (id === 121) {
                    text = `Dommages subis : +${min}%`;
                } else if (id === 1122) {
                    text = `Applique Érosion : +${min}%`;
                }

                // Prefix icons only for the top-level effects to keep nested sub-effects clean
                if (text && !isSubSpell) {
                    const elem = eff.effectElement;
                    if (elementDamageIds.includes(id)) {
                        if (elem === 1)      text = `🌿 ${text}`;
                        else if (elem === 2) text = `🔥 ${text}`;
                        else if (elem === 3) text = `💧 ${text}`;
                        else if (elem === 4) text = `🍃 ${text}`;
                        else                text = `⚪ ${text}`;
                    } else if (id === 100) text = `⚪ ${text}`;
                    else if (id === 97) text = `🌿 ${text}`;
                    else if (id === 96) text = `💧 ${text}`;
                    else if (id === 99) text = `🔥 ${text}`;
                    else if (id === 98) text = `🍃 ${text}`;
                    else if (id === 6 || id === 8) text = `🧲 ${text}`;
                    else if (id === 5 || id === 4 || id === 1103) text = `💥 ${text}`;
                    else if (id === 753 || id === 754) text = `🛡️ ${text}`;
                    else if (id === 132) text = `⛓️ ${text}`;
                    else if (id === 293 || id === 294) text = `✨ ${text}`;
                    else if (id === 138 || id === 114) text = `💪 ${text}`;
                    else if (id === 1160 || id === 2160 || id === 2161) text = `⚡ ${text}`;
                    else if (id === 623) text = `➕ ${text}`;
                    else if (id === 82) text = `💖 ${text}`;
                    else if (id === 1) text = `🏃 ${text}`;
                    else if (id === 140 || id === 126) text = `💀 ${text}`;
                    else if (id === 950 || id === 951 || id === 952) text = `🌀 ${text}`;
                    else if (id === 168 || id === 169 || id === 174) text = `📉 ${text}`;
                    else if (id === 160) text = `🏃 ${text}`;
                    else if (id === 121) text = `📉 ${text}`;
                    else if (id === 1122) text = `📉 ${text}`;
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
                        imageUrl: item?.img || `https://static.dofusdb.fr/items/illustr/${iconId}.png`,
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
        logger.error('[getMonsterStats] Error:', { error });
        return { success: false, error: 'Erreur DofusDB' };
    }
}

/** Update a bounty record — GOD mode only, no guild scope */
export async function updateGodBountyRecord(bountyId: string, data: {
    name?: string;
    level?: number;
    zoneName?: string;
    doplons?: number;
    rewardType?: string;
    rewards?: any;
    milice?: string;
    mechanics?: string;
    imageUrl?: string;
    mapUrl?: string;
    dpnlUrl?: string;
    position?: string;
}): Promise<ActionResponse> {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: 'Non autorisé — Super Admin uniquement' };

    try {
        await db.bounty.update({
            where: { id: bountyId },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.level !== undefined && { level: data.level }),
                ...(data.zoneName !== undefined && { zoneName: data.zoneName }),
                ...(data.doplons !== undefined && { doplons: data.doplons }),
                ...(data.rewardType !== undefined && { rewardType: data.rewardType }),
                ...(data.rewards !== undefined && { rewards: data.rewards }),
                ...(data.milice !== undefined && { milice: data.milice }),
                ...(data.mechanics !== undefined && { mechanics: data.mechanics }),
                ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
                ...(data.mapUrl !== undefined && { mapUrl: data.mapUrl }),
                ...(data.dpnlUrl !== undefined && { dpnlUrl: data.dpnlUrl }),
                ...(data.position !== undefined && { position: data.position }),
            }
        });
        return { success: true };
    } catch (error) {
        logger.error('[updateGodBountyRecord] Error:', { error });
        return { success: false, error: 'Erreur lors de la mise à jour de l\'avis' };
    }
}

/** Fetch quests from the Dofus module that are linked to a specific zone/subarea */
export async function getQuestsByZone(zoneName: string): Promise<ActionResponse<any[]>> {
    try {
        const normalized = zoneName.toLowerCase().trim();

        // Fetch quest entries where npcSubArea matches the zone name (fuzzy)
        const entries = await (db as any).dofusQuestEntry.findMany({
            where: {
                OR: [
                    { npcSubArea: { equals: zoneName, mode: 'insensitive' } },
                    { zone: { equals: zoneName, mode: 'insensitive' } },
                    { npcSubArea: { contains: zoneName, mode: 'insensitive' } },
                    { zone: { contains: zoneName, mode: 'insensitive' } },
                ]
            },
            select: {
                id: true,
                name: true,
                zone: true,
                npcSubArea: true,
                questType: true,
                posX: true,
                posY: true,
                isDungeon: true,
                isOptional: true,
                chain: {
                    select: {
                        sectionName: true,
                        dofus: {
                            select: {
                                id: true,
                                name: true,
                                nameShort: true,
                                imageUrl: true,
                                color: true,
                                slug: true,
                            }
                        }
                    }
                }
            },
            take: 50,
            orderBy: { zone: 'asc' },
        });

        return { success: true, data: entries };
    } catch (error) {
        console.error('[getQuestsByZone] Error:', error);
        return { success: false, error: 'Erreur lors de la récupération des quêtes' };
    }
}

/** Fetch quests and optimized guide sequences that match a specific [x, y] position */
export async function getQuestsAndGuidesByPosition(x: number, y: number): Promise<ActionResponse<{
    quests: any[];
    guides: any[];
}>> {
    try {
        // 1. Fetch quests at the exact position [x, y]
        const quests = await (db as any).dofusQuestEntry.findMany({
            where: {
                posX: x,
                posY: y
            },
            select: {
                id: true,
                name: true,
                zone: true,
                npcSubArea: true,
                questType: true,
                posX: true,
                posY: true,
                isDungeon: true,
                isOptional: true,
                chain: {
                    select: {
                        sectionName: true,
                        dofus: {
                            select: {
                                id: true,
                                name: true,
                                nameShort: true,
                                imageUrl: true,
                                color: true,
                                slug: true,
                            }
                        }
                    }
                }
            },
            take: 50
        });

        // 2. Fetch sequences with their milestones and guides to filter by mapPositions
        const sequences = await db.guideSequence.findMany({
            include: {
                milestone: {
                    include: {
                        guide: true
                    }
                }
            }
        });

        const guides: any[] = [];
        for (const seq of sequences) {
            if (!seq.mapPositions) continue;
            let positions: any[] = [];
            try {
                if (typeof seq.mapPositions === 'string') {
                    positions = JSON.parse(seq.mapPositions);
                } else if (Array.isArray(seq.mapPositions)) {
                    positions = seq.mapPositions as any[];
                }
            } catch (e) {
                continue;
            }

            if (!Array.isArray(positions)) continue;

            const hasMatch = positions.some(pos => {
                if (!pos) return false;
                const px = typeof pos.x === 'string' ? parseInt(pos.x, 10) : pos.x;
                const py = typeof pos.y === 'string' ? parseInt(pos.y, 10) : pos.y;
                return px === x && py === y;
            });

            if (hasMatch) {
                guides.push({
                    id: seq.id,
                    subGuideName: seq.subGuideName,
                    subGuideRef: seq.subGuideRef,
                    stepFrom: seq.stepFrom,
                    stepTo: seq.stepTo,
                    note: seq.note,
                    milestoneTitle: seq.milestone?.title,
                    milestoneSubtitle: seq.milestone?.subtitle,
                    guideName: seq.milestone?.guide?.name,
                    guideSlug: seq.milestone?.guide?.slug,
                });
            }
        }

        return { success: true, data: { quests, guides } };
    } catch (error) {
        console.error('[getQuestsAndGuidesByPosition] Error:', error);
        return { success: false, error: 'Erreur lors de la récupération des quêtes et guides' };
    }
}

export async function checkDungeonExists(name: string, dofusdbId?: number | null): Promise<ActionResponse<{ exists: boolean; dungeon?: any }>> {
    try {
        const queryName = name.trim();
        const clauses: any[] = [
            { name: { equals: queryName, mode: 'insensitive' } },
            { bossName: { equals: queryName, mode: 'insensitive' } }
        ];
        if (dofusdbId) {
            clauses.push({ dofusdbId: Number(dofusdbId) });
        }
        
        const dungeon = await db.dungeon.findFirst({
            where: {
                OR: clauses
            }
        });
        
        if (dungeon) {
            return { success: true, data: { exists: true, dungeon } };
        }
        return { success: true, data: { exists: false } };
    } catch (error) {
        logger.error('[checkDungeonExists] Error:', { error });
        return { success: false, error: 'Erreur lors de la vérification du donjon' };
    }
}

export async function createDungeonAction(
    guildId: string,
    data: {
        name: string;
        bossName: string;
        level: number;
        dofusdbId?: number | null;
        dpnlUrl?: string | null;
        dofuspourlesnoobsUrl?: string | null;
        dofensiveUrl?: string | null;
        imageUrl?: string | null;
    }
): Promise<ActionResponse<any>> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated) {
            return { success: false, error: "Non authentifié" };
        }
        if (!user.isAdmin) {
            return { success: false, error: "Accès refusé: Admin requis" };
        }
        
        // Input validation
        if (!data.name?.trim() || !data.bossName?.trim() || !data.level) {
            return { success: false, error: "Données du donjon incomplètes (nom, boss, niveau requis)" };
        }
        
        const existing = await db.dungeon.findUnique({
            where: {
                name_bossName: {
                    name: data.name.trim(),
                    bossName: data.bossName.trim()
                }
            }
        });
        
        if (existing) {
            return { success: false, error: "Ce donjon existe déjà." };
        }
        
        const dungeon = await db.dungeon.create({
            data: {
                name: data.name.trim(),
                bossName: data.bossName.trim(),
                level: Number(data.level),
                dofusdbId: data.dofusdbId ? Number(data.dofusdbId) : null,
                dpnlUrl: data.dpnlUrl || null,
                dofuspourlesnoobsUrl: data.dofuspourlesnoobsUrl || null,
                dofensiveUrl: data.dofensiveUrl || null,
                imageUrl: data.imageUrl || null,
            }
        });
        
        return { success: true, data: dungeon };
    } catch (error) {
        logger.error('[createDungeonAction] Error:', { error });
        return { success: false, error: 'Erreur lors de la création du donjon' };
    }
}

export async function updateDungeonNoobsUrl(
    guildId: string,
    dungeonName: string,
    dofusdbId: number | null,
    noobsUrlOrSlug: string
): Promise<ActionResponse<any>> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès refusé" };
    if (!ctx.isAdmin) return { success: false, error: "Admin requis" };

    try {
        const queryName = dungeonName.trim();
        const clauses: any[] = [
            { name: { equals: queryName, mode: 'insensitive' } },
            { bossName: { equals: queryName, mode: 'insensitive' } }
        ];
        if (dofusdbId) {
            clauses.push({ dofusdbId: Number(dofusdbId) });
        }

        let dungeon = await db.dungeon.findFirst({
            where: { OR: clauses }
        });

        // Format the URL properly: if it's just a slug, expand it. Otherwise keep it as is.
        let finalUrl = noobsUrlOrSlug.trim();
        if (finalUrl && !finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
            // It's a slug, build the full URL
            let slug = finalUrl;
            if (slug.endsWith(".html")) {
                slug = slug.substring(0, slug.length - 5);
            }
            finalUrl = `https://www.dofuspourlesnoobs.com/${slug}.html`;
        }

        if (!dungeon) {
            return { success: false, error: "Donjon introuvable dans la base de données. Le lien n'a pas pu être sauvegardé." };
        } else {
            dungeon = await db.dungeon.update({
                where: { id: dungeon.id },
                data: { dofuspourlesnoobsUrl: finalUrl || null }
            });
        }

        return { success: true, data: dungeon };
    } catch (error) {
        logger.error('[updateDungeonNoobsUrl] Error:', { error });
        return { success: false, error: 'Erreur lors de la mise à jour du lien' };
    }
}

// ─── Bounty / Archimonstre Search (for WorldMap) ──────────────────────

/** Shared: resolve subAreaIds + center coords + worldMapId from a zone name against worldmap.json */
function resolveZoneInWorldmap(
    zoneName: string | null,
    subareas: any[],
    mapsBySubAreaId: Map<number, any[]>,
    normalize: (s: string) => string
): { subAreaIds: number[]; centerX: number | null; centerY: number | null; worldMapId: number } {
    const subAreaIds: number[] = [];
    let centerX: number | null = null;
    let centerY: number | null = null;
    let worldMapId = 1;

    if (!zoneName || subareas.length === 0) return { subAreaIds, centerX, centerY, worldMapId };

    const normalizedZone = normalize(zoneName);

    // Strategy 1: exact match
    let matching = subareas.filter(sa => {
        const saName = typeof sa.name === 'string' ? sa.name : (sa.name?.fr || '');
        return normalize(saName) === normalizedZone;
    });
    // Strategy 2: partial
    if (matching.length === 0) {
        matching = subareas.filter(sa => {
            const saName = typeof sa.name === 'string' ? sa.name : (sa.name?.fr || '');
            const n = normalize(saName);
            return n.includes(normalizedZone) || normalizedZone.includes(n);
        });
    }
    matching.forEach(sa => subAreaIds.push(sa.id));

    if (subAreaIds.length > 0) {
        let bestMap: any = null;
        for (const saId of subAreaIds) {
            for (const m of mapsBySubAreaId.get(saId) || []) {
                if (!bestMap) { bestMap = m; continue; }
                const mOut = m.outdoor !== false;
                const bOut = bestMap.outdoor !== false;
                if (mOut && !bOut) { bestMap = m; continue; }
                const mW = m.worldMap === -1 ? 1 : m.worldMap;
                const bW = bestMap.worldMap === -1 ? 1 : bestMap.worldMap;
                if (mOut === bOut && mW > bW) { bestMap = m; }
            }
        }
        if (bestMap) {
            centerX = bestMap.x;
            centerY = bestMap.y;
            worldMapId = bestMap.worldMap === -1 ? 1 : bestMap.worldMap;
        }
    }

    return { subAreaIds, centerX, centerY, worldMapId };
}

/**
 * Search archimonstres/bounties by name for the worldmap.
 * Priority order :
 * 1. db.Archimonstre — données pre-synced depuis Metamob+DofusDB (zero réseau)
 * 2. db.Bounty       — avis de recherche seedés localement
 * 3. DofusDB API     — fallback si aucun résultat local (ex: DB non encore synced)
 */
export async function searchArchimonstresForMap(query: string): Promise<ActionResponse<Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    level: number;
    zoneName: string | null;
    subAreaIds: number[];
    centerX: number | null;
    centerY: number | null;
    worldMapId: number;
    source: 'local' | 'dofusdb';
}>>> {
    if (!query || query.trim().length < 2) return { success: true, data: [] };

    const normalize = (s: string) =>
        s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    try {
        // ── 1. Load worldmap.json once ──────────────────────────────
        let subareas: any[] = [];
        const mapsBySubAreaId = new Map<number, any[]>();
        try {
            const filePath = path.join(process.cwd(), 'public', 'game-data', 'worldmap.json');
            if (fs.existsSync(filePath)) {
                const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                subareas = raw.subareas || [];
                for (const m of (raw.maps || [])) {
                    if (m.subAreaId == null) continue;
                    if (!mapsBySubAreaId.has(m.subAreaId)) mapsBySubAreaId.set(m.subAreaId, []);
                    mapsBySubAreaId.get(m.subAreaId)!.push(m);
                }
            }
        } catch (err) {
            logger.error('[searchArchimonstresForMap] worldmap.json error:', { error: err });
        }

        // ── 2. Archimonstre table (priority — pre-synced from Metamob+DofusDB) ──
        const archiRows = await db.archimonstre.findMany({
            where: { name: { contains: query.trim(), mode: 'insensitive' } },
            take: 10,
            orderBy: { name: 'asc' },
        });

        const archiResults = archiRows.map(a => ({
            id: a.id,
            name: a.name,
            imageUrl: a.imageUrl,
            level: a.level,
            zoneName: a.zone,
            source: 'local' as const,
            subAreaIds: Array.isArray(a.subareaIds) ? (a.subareaIds as number[]) : [],
            centerX: a.centerX,
            centerY: a.centerY,
            worldMapId: a.worldMapId,
        }));

        const seenFromArchi = new Set(archiResults.map(r => normalize(r.name)));

        // ── 3. Bounty table (avis de recherche seedés) ───────────────────────
        const localBounties = await db.bounty.findMany({
            where: { name: { contains: query.trim(), mode: 'insensitive' } },
            take: 10,
            orderBy: { name: 'asc' },
            select: { id: true, name: true, imageUrl: true, level: true, zoneName: true }
        });

        const bountyResults = localBounties
            .filter(b => !seenFromArchi.has(normalize(b.name)))
            .map(b => ({
                id: b.id,
                name: b.name,
                imageUrl: b.imageUrl,
                level: b.level,
                zoneName: b.zoneName,
                source: 'local' as const,
                ...resolveZoneInWorldmap(b.zoneName, subareas, mapsBySubAreaId, normalize)
            }));

        const localResults = [...archiResults, ...bountyResults];

        // Build a subareaId → subarea lookup for DofusDB ID resolution
        const subareaById = new Map<number, any>();
        for (const sa of subareas) {
            if (sa.id != null) subareaById.set(sa.id, sa);
        }

        // ── 3. DofusDB fallback ────────────────────────────────────
        const seenNames = new Set(localResults.map(r => normalize(r.name)));
        const dofusDbResults: any[] = [];

        try {
            // Use (?i) inline flag — DofusDB rejects $options=i (not whitelisted)
            const encodedQuery = encodeURIComponent(`(?i)${query.trim()}`);
            const url = `https://api.dofusdb.fr/monsters?lang=fr&name.fr[$regex]=${encodedQuery}&$limit=10`;
            const resp = await fetch(url, {
                headers: { 'Accept': 'application/json' },
                cache: 'no-store'
            });

            if (resp.ok) {
                const json = await resp.json();
                const monsters: any[] = json.data || [];

                for (const m of monsters) {
                    const name: string = m.name?.fr || '';
                    if (!name || seenNames.has(normalize(name))) continue;
                    seenNames.add(normalize(name));

                    const imageUrl: string | null = m.img || null;
                    const level: number = m.grades?.[0]?.level ?? 0;

                    // DofusDB subareas = array of IDs [169, ...] — resolve via local worldmap
                    const rawSubareaIds: number[] = (m.subareas || [])
                        .map((s: any) => typeof s === 'number' ? s : s?.id)
                        .filter((id: any): id is number => typeof id === 'number');

                    let zoneName: string | null = null;
                    let centerX: number | null = null;
                    let centerY: number | null = null;
                    let worldMapId = 1;

                    if (rawSubareaIds.length > 0) {
                        // Get zone name from first matched subarea
                        const firstSa = subareaById.get(rawSubareaIds[0]);
                        if (firstSa) {
                            zoneName = typeof firstSa.name === 'string' ? firstSa.name : (firstSa.name?.fr || null);
                        }

                        // Find best map across all subarea IDs
                        let bestMap: any = null;
                        for (const saId of rawSubareaIds) {
                            for (const map of mapsBySubAreaId.get(saId) || []) {
                                if (!bestMap) { bestMap = map; continue; }
                                const mOut = map.outdoor !== false;
                                const bOut = bestMap.outdoor !== false;
                                if (mOut && !bOut) { bestMap = map; continue; }
                                const mW = map.worldMap === -1 ? 1 : map.worldMap;
                                const bW = bestMap.worldMap === -1 ? 1 : bestMap.worldMap;
                                if (mOut === bOut && mW > bW) { bestMap = map; }
                            }
                        }
                        if (bestMap) {
                            centerX = bestMap.x;
                            centerY = bestMap.y;
                            worldMapId = bestMap.worldMap === -1 ? 1 : bestMap.worldMap;
                        }
                    }

                    dofusDbResults.push({
                        id: `ddb-${m.id || normalize(name)}`,
                        name,
                        imageUrl,
                        level,
                        zoneName,
                        source: 'dofusdb',
                        subAreaIds: rawSubareaIds,
                        centerX,
                        centerY,
                        worldMapId,
                    });
                }
            } else {
                logger.error('[searchArchimonstresForMap] DofusDB non-ok:', { status: resp.status });
            }
        } catch (err) {
            logger.error('[searchArchimonstresForMap] DofusDB API error:', { error: err });
            // Fail silently – local results still returned
        }

        const combined = [...localResults, ...dofusDbResults].slice(0, 12);
        return { success: true, data: combined };

    } catch (error) {
        logger.error('[searchArchimonstresForMap] Error:', { error });
        return { success: false, error: 'Erreur lors de la recherche' };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIMONSTRES — Admin CRUD + Sync
// ─────────────────────────────────────────────────────────────────────────────

export async function getArchimonstres(filter?: { type?: string; search?: string }): Promise<ActionResponse<any[]>> {
    const admin = await isSuperAdmin();
    if (!admin) return { success: false, error: 'Accès refusé' };

    try {
        const where: any = {};
        if (filter?.type && filter.type !== 'all') where.type = filter.type;
        if (filter?.search) where.name = { contains: filter.search, mode: 'insensitive' };

        const rows = await db.archimonstre.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        return { success: true, data: rows };
    } catch (error: any) {
        logger.error('[getArchimonstres] Error:', {
            message: error?.message,
            code: error?.code,
            meta: error?.meta,
        });
        return { success: false, error: 'Erreur chargement' };
    }
}

export async function deleteArchimonstre(id: string): Promise<ActionResponse> {
    const admin = await isSuperAdmin();
    if (!admin) return { success: false, error: 'Accès refusé' };

    try {
        await db.archimonstre.delete({ where: { id } });
        return { success: true };
    } catch (error) {
        logger.error('[deleteArchimonstre] Error:', { error });
        return { success: false, error: 'Erreur suppression' };
    }
}

/**
 * Sync one-shot des archimonstres de la Quête Ocre depuis Metamob + DofusDB.
 *
 * Flow :
 * 1. Trouve un profil utilisateur lié à Metamob avec quest slug dans la DB
 * 2. Appelle l'endpoint zones de Metamob (/quests/{slug}/zones?monster_type_id=3)
 * 3. Pour chaque archimonstre, recherche dans DofusDB par nom pour obtenir subareaIds + image + level
 * 4. Résout les subareaIds → coordonnées worldmap via worldmap.json
 * 5. Upsert dans la table Archimonstre
 */
export async function syncOcreArchimonstres(guildId?: string): Promise<ActionResponse<{ synced: number; skipped: number }>> {
    const admin = await isSuperAdmin();
    if (!admin) return { success: false, error: 'Accès refusé' };

    try {
        // ── 1. Load worldmap.json ────────────────────────────────────────────
        const worldmapPath = path.join(process.cwd(), 'public', 'game-data', 'worldmap.json');
        const worldmapRaw = fs.readFileSync(worldmapPath, 'utf-8');
        const worldmap = JSON.parse(worldmapRaw);
        const subareas: any[] = worldmap.subareas || [];
        const allMaps: any[] = worldmap.maps || [];

        const subareaById = new Map<number, any>();
        for (const sa of subareas) { if (sa.id != null) subareaById.set(sa.id, sa); }

        const mapsBySubAreaId = new Map<number, any[]>();
        for (const m of allMaps) {
            if (m.subAreaId == null) continue;
            if (!mapsBySubAreaId.has(m.subAreaId)) mapsBySubAreaId.set(m.subAreaId, []);
            mapsBySubAreaId.get(m.subAreaId)!.push(m);
        }

        const normalize = (s: string) => s.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/['']/g, "'").trim();

        // ── 2. Find a linked Metamob profile with quest slug ─────────────────
        const profile = await db.userProfile.findFirst({
            where: {
                metamobPseudo: { not: null },
                metamobQuestSlug: { not: null },
                metamobVerified: true,
                ...(guildId ? { guild: { discordGuildId: guildId } } : {}),
            },
            select: { metamobPseudo: true, metamobQuestSlug: true, metamobApiKey: true },
        });

        if (!profile?.metamobQuestSlug) {
            return { success: false, error: 'Aucun profil Metamob lié trouvé avec un quest slug. Liez d\'abord un compte Metamob.' };
        }

        // ── 3. Fetch zones from Metamob ──────────────────────────────────────
        const slug = profile.metamobQuestSlug;
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (profile.metamobApiKey) {
            const { decrypt } = await import('@/lib/encryption');
            try { headers['Authorization'] = `Bearer ${decrypt(profile.metamobApiKey)}`; } catch { }
        }

        const zoneUrl = `https://www.metamob.fr/api/v1/quests/${encodeURIComponent(slug)}/zones?monster_type_id=3`;
        const zoneRes = await fetch(zoneUrl, { headers, signal: AbortSignal.timeout(30000) });
        if (!zoneRes.ok) {
            return { success: false, error: `Metamob zones API erreur ${zoneRes.status}. Vérifiez la clé API.` };
        }

        const zoneJson = await zoneRes.json();
        const zones: any[] = zoneJson.data || [];

        // Extract all archimonstres/boss with their zone/subzone
        const monstersToSync: Array<{ name: string; type: string; zone: string; subzone: string }> = [];
        for (const z of zones) {
            const zoneName: string = z.name?.fr || z.name || '';
            for (const sz of z.subzones || []) {
                const subzoneName: string = sz.name?.fr || sz.name || '';
                for (const m of sz.monsters || []) {
                    const nameFr: string = m.name?.fr || m.name || '';
                    // Metamob returns type as an object {id, name:{fr,en}} — extract the French label
                    const mtype: string = typeof m.type === 'string'
                        ? m.type
                        : (m.type?.name?.fr ?? m.type?.name?.en ?? 'archimonstre');
                    if (nameFr) {
                        monstersToSync.push({ name: nameFr, type: mtype, zone: zoneName, subzone: subzoneName });
                    }
                }
            }
        }

        if (monstersToSync.length === 0) {
            return { success: false, error: 'Aucun monstre trouvé dans la réponse Metamob zones. Vérifiez le slug de la quête.' };
        }

        // Deduplicate by name — some monsters appear in multiple zones in Metamob response
        // Keep first occurrence (first zone encountered = primary zone)
        const seen = new Set<string>();
        const uniqueMonsters = monstersToSync.filter(m => {
            if (seen.has(m.name)) return false;
            seen.add(m.name);
            return true;
        });

        // ── 4. For each monster, search DofusDB for subareaIds + image + level ──
        let synced = 0;
        let skipped = 0;
        const BATCH = 3; // reduce concurrency to avoid DofusDB timeouts

        for (let i = 0; i < uniqueMonsters.length; i += BATCH) {
            const batch = uniqueMonsters.slice(i, i + BATCH);
            await Promise.all(batch.map(async (monster) => {
                try {
                    // DofusDB search by exact name
                    const encoded = encodeURIComponent(`(?i)^${monster.name.trim()}$`);
                    const url = `https://api.dofusdb.fr/monsters?lang=fr&name.fr[$regex]=${encoded}&$limit=1`;
                    const resp = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });

                    let imageUrl: string | null = null;
                    let level = 0;
                    let dofusdbId: number | null = null;
                    let rawSubareaIds: number[] = [];

                    if (resp.ok) {
                        const json = await resp.json();
                        const m = json.data?.[0];
                        if (m) {
                            imageUrl = m.img || null;
                            level = m.grades?.[0]?.level ?? 0;
                            dofusdbId = m.id ?? null;
                            rawSubareaIds = (m.subareas || [])
                                .map((s: any) => typeof s === 'number' ? s : s?.id)
                                .filter((id: any): id is number => typeof id === 'number');
                        }
                    }

                    // Resolve worldmap coords from subareaIds
                    let centerX: number | null = null;
                    let centerY: number | null = null;
                    let worldMapId = 1;

                    if (rawSubareaIds.length > 0) {
                        let bestMap: any = null;
                        for (const saId of rawSubareaIds) {
                            for (const map of mapsBySubAreaId.get(saId) || []) {
                                if (!bestMap) { bestMap = map; continue; }
                                const mOut = map.outdoor !== false;
                                const bOut = bestMap.outdoor !== false;
                                if (mOut && !bOut) { bestMap = map; continue; }
                                const mW = map.worldMap === -1 ? 1 : map.worldMap;
                                const bW = bestMap.worldMap === -1 ? 1 : bestMap.worldMap;
                                if (mOut === bOut && mW > bW) { bestMap = map; }
                            }
                        }
                        if (bestMap) {
                            centerX = bestMap.x;
                            centerY = bestMap.y;
                            worldMapId = bestMap.worldMap === -1 ? 1 : bestMap.worldMap;
                        }
                    }

                    await db.archimonstre.upsert({
                        where: { name: monster.name },
                        update: {
                            type: monster.type,
                            imageUrl,
                            level,
                            dofusdbId,
                            zone: monster.zone || null,
                            subzone: monster.subzone || null,
                            subareaIds: rawSubareaIds,
                            worldMapId,
                            centerX,
                            centerY,
                        },
                        create: {
                            name: monster.name,
                            type: monster.type,
                            imageUrl,
                            level,
                            dofusdbId,
                            zone: monster.zone || null,
                            subzone: monster.subzone || null,
                            subareaIds: rawSubareaIds,
                            worldMapId,
                            centerX,
                            centerY,
                        },
                    });
                    synced++;
                } catch (err) {
                    logger.error('[syncOcreArchimonstres] Error for monster:', { name: monster.name, error: err });
                    skipped++;
                }
            }));

            // Small delay between batches to be nice to DofusDB
            if (i + BATCH < uniqueMonsters.length) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

        return { success: true, data: { synced, skipped } };

    } catch (error) {
        logger.error('[syncOcreArchimonstres] Error:', { error });
        return { success: false, error: 'Erreur lors de la synchronisation' };
    }
}
