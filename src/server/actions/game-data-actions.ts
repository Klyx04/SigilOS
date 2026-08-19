'use server'

import { db } from "@/lib/prisma";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/ratelimit";
import { withCache } from "@/lib/cache";
import fs from 'fs';
import path from 'path';
import { logger } from "@/lib/logger";
import { sanitizeHtml } from "@/lib/security";

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

/**
 * 🛡️ Guard fail-closed (PIM sous-god) pour le module Données de Jeu.
 * Autorise super-admin OU un sous-god avec la brique "game-data" (scope game-data).
 * Sans ça, un sous-god légitime voyait des listes vides / erreurs "Non autorisé"
 * (#108 — passe sous-god).
 */
async function canAccessGameData(): Promise<boolean> {
    if (await isSuperAdmin()) return true;
    return canAccessBrick("game-data");
}

/**
 * 🛡️ Variante "Avis de Recherche" : la brique "game-data-bounties" ouvre le module
 * bounties même si le scope global game-data n'est pas actif (grant PIM ciblé).
 */
async function canAccessBounties(): Promise<boolean> {
    if (await isSuperAdmin()) return true;
    return (await canAccessBrick("game-data")) || (await canAccessBrick("game-data-bounties"));
}

// 🛡️ Trace une écriture God UNIQUEMENT pour un sous-god (qui/quoi/sur quoi).
// #108/#109 : les écritures des sous-gods du module Données de Jeu sont auditées
// avec l'opération et la cible (les super-admins passent par d'autres canaux).
async function logGameDataWrite(op: string, targetId?: string, metadata?: Record<string, any>) {
    try {
        const session = await auth();
        if (!session?.user?.id) return;
        if (await isSuperAdmin()) return;
        const { createGodAuditLog } = await import("@/server/actions/audit-actions");
        await createGodAuditLog({
            action: "GOD_GAME_DATA_UPDATE",
            targetType: "DATA_SYNC",
            targetId,
            metadata: { op, ...metadata },
        });
    } catch {
        // Non bloquant : ne jamais interrompre l'action applicative
    }
}

/** Filtres de recherche de la carte du monde (monstres/archis/boss). */
export type MapSearchFilter = 'all' | 'zones' | 'archis' | 'boss' | 'mobs' | 'ocre';

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

/**
 * #148 — Recherche de zones pour l'édition de quêtes God.
 * Fusionne les zones game-data LOCALES (déclarées à la main OU siphonnées DofusDB)
 * avec les zones DÉTECTÉES à la volée depuis l'API DofusDB (sous-zones + régions),
 * mises en cache Redis (TTL 6 h) pour ne pas marteler l'API.
 */
export async function searchZonesDetected(query: string = ""): Promise<ActionResponse<any[]>> {
    try {
        const q = query.trim();
        const localRes = await searchZones(q);
        const localZones = (localRes.success ? localRes.data : []) as any[];

        const detected: any[] = [];
        try {
            // Requête vide → liste de départ DofusDB (zones jamais vides même si la table locale est vide).
            const cacheKey = `gd:zones:detected:${q.length > 0 ? q.toLowerCase() : "all"}`;
            const fetched = await withCache(cacheKey, 6 * 60 * 60, async () => {
                const subLimit = q.length > 0 ? 8 : 20;
                const areaLimit = q.length > 0 ? 8 : 60;
                const nameFilter = q.length > 0 ? `&name.fr=${encodeURIComponent(q)}` : "";
                const [subRes, areaRes] = await Promise.all([
                    fetch(`https://api.dofusdb.fr/subareas?${nameFilter}&$limit=${subLimit}&lang=fr`, {
                        headers: { Accept: "application/json" },
                        signal: AbortSignal.timeout(10000),
                    }),
                    fetch(`https://api.dofusdb.fr/areas?${nameFilter}&$limit=${areaLimit}&lang=fr`, {
                        headers: { Accept: "application/json" },
                        signal: AbortSignal.timeout(10000),
                    }),
                ]);
                    const out: any[] = [];
                    const mapItem = (item: any) => {
                        const nameFr = typeof item.name === "string" ? item.name : (item.name?.fr || item.name?.en || "");
                        if (!nameFr || !nameFr.trim()) return null;
                        return {
                            name: nameFr.trim(),
                            level: typeof item.level === "number" && item.level > 0 ? item.level : 200,
                            source: "dofusdb",
                        };
                    };
                    if (subRes.ok) {
                        const sj = await subRes.json();
                        (sj?.data || []).forEach((it: any) => { const m = mapItem(it); if (m) out.push(m); });
                    }
                    if (areaRes.ok) {
                        const aj = await areaRes.json();
                        (aj?.data || []).forEach((it: any) => { const m = mapItem(it); if (m) out.push(m); });
                    }
                    return out;
                });
                detected.push(...(fetched || []));
            } catch {
                // DofusDB indisponible → on garde le local
            }

        const seen = new Set<string>();
        const merged = [...localZones, ...detected].filter((z: any) => {
            if (!z?.name) return false;
            const key = String(z.name).trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        return { success: true, data: merged.slice(0, 25) };
    } catch (error) {
        logger.error('[searchZonesDetected] Error:', { error });
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
    if (!(await canAccessGameData())) return { success: false, error: 'Non autorisé' };
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
    if (!(await canAccessGameData())) return { success: false, error: 'Non autorisé' };
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
    if (!(await canAccessGameData())) return { success: false, error: 'Non autorisé' };
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
    if (!(await canAccessGameData())) return { success: false, error: 'Non autorisé' };
    try {
        await db.zone.update({ where: { id: zoneId }, data: { families: { disconnect: { id: familyId } } } });
        return { success: true };
    } catch (error) {
        logger.error('[unlinkFamilyFromZone] Error:', { error });
        return { success: false, error: 'Erreur déliaison famille' };
    }
}

/**
 * 🧬 #144 — Association intelligente zones ↔ familles SANS faux positif.
 * Principe : un archimonstre/monstre siphonné porte sa zone (Metamob/DofusDB). On croise
 * `Archimonstre.zone|subzone` (nom EXACT de la zone game-data) avec `Monster.name`
 * (nom EXACT) pour remonter à la `MonsterFamily`. Aucun matching flou → aucun faux positif.
 * Soulage le God et rend les familles proposables dans les missions (Régulation).
 */
export async function autoAssociateAllZoneFamilies(): Promise<ActionResponse<{
    zonesScanned: number;
    familiesLinked: number;
    matches: { zoneName: string; familyName: string }[];
}>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Non autorisé' };

    try {
        const zones = await db.zone.findMany({
            select: { id: true, name: true, families: { select: { id: true } } },
            orderBy: { name: 'asc' },
        });

        const allArchis = await db.archimonstre.findMany({
            where: { OR: [{ zone: { not: null } }, { subzone: { not: null } }] },
            select: { zone: true, subzone: true, name: true },
        });

        // Index zone name → archimonstres (nom exact uniquement).
        const archisByZone = new Map<string, string[]>();
        for (const a of allArchis) {
            for (const zoneName of [a.zone, a.subzone]) {
                if (!zoneName) continue;
                const list = archisByZone.get(zoneName) ?? [];
                if (!list.includes(a.name)) list.push(a.name);
                archisByZone.set(zoneName, list);
            }
        }

        // Précharge les familles par nom de monstre (nom exact, un seul par famille).
        const allMonsters = await db.monster.findMany({ select: { name: true, familyId: true } });
        const familyByMonsterName = new Map<string, string>();
        for (const m of allMonsters) {
            if (!familyByMonsterName.has(m.name)) familyByMonsterName.set(m.name, m.familyId);
        }

        let familiesLinked = 0;
        const matches: { zoneName: string; familyName: string }[] = [];

        for (const zone of zones) {
            const monsterNames = archisByZone.get(zone.name) ?? [];
            if (monsterNames.length === 0) continue;

            const linkedIds = new Set(zone.families.map(f => f.id));
            const familyIdsToLink = new Set<string>();

            for (const name of monsterNames) {
                const fid = familyByMonsterName.get(name);
                if (fid && !linkedIds.has(fid)) familyIdsToLink.add(fid);
            }

            if (familyIdsToLink.size === 0) continue;

            const families = await db.monsterFamily.findMany({
                where: { id: { in: Array.from(familyIdsToLink) } },
                select: { id: true, name: true },
            });

            if (families.length === 0) continue;

            await db.zone.update({
                where: { id: zone.id },
                data: { families: { connect: families.map(f => ({ id: f.id })) } },
            });

            familiesLinked += families.length;
            for (const f of families) matches.push({ zoneName: zone.name, familyName: f.name });
        }

        logger.info(`[autoAssociateAllZoneFamilies] ${matches.length} familles liées sur ${zones.length} zones`);
        return { success: true, data: { zonesScanned: zones.length, familiesLinked, matches } };
    } catch (error) {
        logger.error('[autoAssociateAllZoneFamilies] Error:', { error });
        return { success: false, error: 'Erreur lors de l\'association automatique' };
    }
}

/** Link a dungeon to an event zone (also marks it as event dungeon) */
export async function linkDungeonToZone(zoneId: string, dungeonId: string): Promise<ActionResponse> {
    if (!(await canAccessGameData())) return { success: false, error: 'Non autorisé' };
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
    if (!(await canAccessGameData())) return { success: false, error: 'Non autorisé' };
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
    if (!(await canAccessGameData())) return { success: false, error: 'Non autorisé' };
    try {
        await db.dungeon.update({ where: { id: dungeonId }, data: { isEventDungeon: isEvent } });
        return { success: true };
    } catch (error) {
        logger.error('[toggleEventDungeon] Error:', { error });
        return { success: false, error: 'Erreur mise à jour donjon' };
    }
}

// ─── GameData Monsters (super-admin only) ─────────────────────

/** All "Monstre Spécial" game-data monsters (GOD page) */
export async function getGameDataMonsters(search = ""): Promise<ActionResponse<any[]>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Non autorisé' };
    try {
        const monsters = await db.gameDataMonster.findMany({
            where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
            orderBy: [{ level: 'asc' }, { name: 'asc' }],
            take: 200
        });
        return { success: true, data: monsters };
    } catch (error) {
        logger.error('[getGameDataMonsters] Error:', { error });
        return { success: false, error: 'Erreur chargement monstres spéciaux' };
    }
}

/** Search "Monstre Spécial" monsters — used by the AsyncCombobox in the mission flow */
export async function searchGameDataMonsters(query: string): Promise<ActionResponse<any[]>> {
    try {
        const monsters = await db.gameDataMonster.findMany({
            where: { name: { contains: query, mode: 'insensitive' } },
            orderBy: [{ level: 'asc' }, { name: 'asc' }],
            take: 20
        });
        return { success: true, data: monsters };
    } catch (error) {
        logger.error('[searchGameDataMonsters] Error:', { error });
        return { success: false, error: 'Erreur recherche monstres spéciaux' };
    }
}

/** Create or update a "Monstre Spécial" monster */
export async function upsertGameDataMonster(data: {
    id?: string;
    name: string;
    level?: number;
    zone?: string;
    imageUrl?: string;
    description?: string;
}): Promise<ActionResponse<any>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Non autorisé' };
    try {
        const name = data.name.trim();
        if (!name) return { success: false, error: 'Le nom du monstre est requis' };
        const payload = {
            name,
            level: data.level || 0,
            zone: data.zone?.trim() || null,
            imageUrl: data.imageUrl?.trim() || null,
            // SECURITY (F-11): sanitize free-text HTML description
            description: sanitizeHtml(data.description?.trim() ?? null, 5000) || null,
        };

        // Si un id est fourni → on le cherche (édition)
        // Sinon → on cherche par nom (création ou mise à jour d'un monstre existant du même nom)
        const existing = data.id
            ? await db.gameDataMonster.findUnique({ where: { id: data.id } })
            : await db.gameDataMonster.findFirst({ where: { name } });

        const monster = existing
            ? await db.gameDataMonster.update({ where: { id: existing.id }, data: payload })
            : await db.gameDataMonster.create({ data: payload });

        await logGameDataWrite(existing ? "update-game-data-monster" : "create-game-data-monster", monster?.id, { name });
        return { success: true, data: monster };
    } catch (error) {
        logger.error('[upsertGameDataMonster] Error:', { error });
        return { success: false, error: 'Erreur création/mise à jour du monstre' };
    }
}

/** Delete a "Monstre Spécial" monster */
export async function deleteGameDataMonster(monsterId: string): Promise<ActionResponse> {
    if (!(await canAccessGameData())) return { success: false, error: 'Non autorisé' };
    try {
        await db.gameDataMonster.delete({ where: { id: monsterId } });
        await logGameDataWrite("delete-game-data-monster", monsterId);
        return { success: true };
    } catch (error) {
        logger.error('[deleteGameDataMonster] Error:', { error });
        return { success: false, error: 'Erreur suppression du monstre' };
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
// #138 — cache mémoire 1h pour les fiches monstres (dofusdb externe, jusqu'à 5 requêtes/boss).
const monsterStatsCache = new Map<string, { data: any; expiresAt: number }>();
const MONSTER_STATS_TTL = 60 * 60 * 1000; // 1 h — data de jeu statique

export async function getMonsterStats(monsterName: string, dungeonName?: string): Promise<ActionResponse<any>> {
    // #138 — évite de re-frapper dofusdb à chaque sélection de donjon (la fiche est statique).
    const cacheKey = `${monsterName.trim().toLowerCase()}::${(dungeonName ?? "").toLowerCase()}`;
    const cached = monsterStatsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return { success: true, data: cached.data };
    }

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
                    .catch(logger.error)
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
                    .catch(logger.error)
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
            } catch (err) { logger.error("Fallback coordinate fetch error:", err); }
        }

        const resultData = {
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
        };
        monsterStatsCache.set(cacheKey, { data: resultData, expiresAt: Date.now() + MONSTER_STATS_TTL });
        return { success: true, data: resultData };
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
    if (!(await canAccessBounties())) return { success: false, error: 'Non autorisé' };

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
        await logGameDataWrite("update-bounty", bountyId, { name: data.name ?? null });
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
        logger.error('[getQuestsByZone] Error:', error);
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
        logger.error('[getQuestsAndGuidesByPosition] Error:', error);
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
 * Search archimonstres / boss / monstres for the worldmap, LOCAL-FIRST.
 *
 * Priority order (pensé multi-guilde / scale) :
 * 1. Table `db.Archimonstre` (catalogue pré-syncé Metamob + DofusDB) — zéro réseau, zéro Redis
 * 2. Table `db.Bounty` (avis de recherche seedés) — seulement pour les filtres all/boss
 * 3. Fallback DofusDB UNIQUEMENT si aucun résultat local, avec cache Redis global TTL 24h
 *    → UN SEUL appel réseau par terme de recherche pour TOUTE la plateforme
 * 4. Auto-heal : un monstre trouvé via DofusDB est inséré en local (isOcre=false)
 *    → la prochaine recherche du même terme est 100% locale pour tous
 *
 * Rate-limit par utilisateur pour protéger DofusDB en cas de spam.
 */
export async function searchArchimonstresForMap(
    query: string,
    filter: MapSearchFilter = 'all'
): Promise<ActionResponse<Array<{
    id: string;
    name: string;
    type: string;
    isOcre: boolean;
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
        // ── 0. Rate-limit per user (protège le fallback DofusDB en cas de spam) ──
        const session = await auth();
        const userId = session?.user?.id || 'anonymous';
        const limiter = await rateLimit(`map:search:${userId}:${filter}`, 30, 10_000); // 30 recherches / 10s
        if (!limiter.success) {
            return { success: false, error: "Trop de recherches. Réessaie dans quelques secondes." };
        }

        // Build the type/isOcre where clause based on the filter
        const buildLocalWhere = () => {
            const where: any = { name: { contains: query.trim(), mode: 'insensitive' } };
            switch (filter) {
                case 'archis': where.type = 'archimonstre'; break;
                case 'boss': where.type = 'boss'; break;
                case 'mobs': where.type = 'monstre'; break;
                case 'ocre': where.isOcre = true; break;
                // 'all' | 'zones' → no type restriction on archimonstres (zones is pure UI)
                default: break;
            }
            return where;
        };

        // ── 1. Load worldmap.json once (pour résolution zones des bounties & fallback) ──
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

        // ── 2. Archimonstre table (LOCAL-FIRST, filtrée par type/isOcre) ──
        const archiRows = await db.archimonstre.findMany({
            where: buildLocalWhere(),
            take: 10,
            orderBy: { name: 'asc' },
        });

        const archiResults = archiRows.map(a => ({
            id: a.id,
            name: a.name,
            type: a.type,
            isOcre: a.isOcre,
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

        // ── 3. Bounty table (avis de recherche) — seulement filtres all/boss ──
        let bountyResults: Array<any> = [];
        if (filter === 'all' || filter === 'boss') {
            const localBounties = await db.bounty.findMany({
                where: { name: { contains: query.trim(), mode: 'insensitive' } },
                take: 10,
                orderBy: { name: 'asc' },
                select: { id: true, name: true, imageUrl: true, level: true, zoneName: true }
            });

            bountyResults = localBounties
                .filter(b => !seenFromArchi.has(normalize(b.name)))
                .map(b => ({
                    id: b.id,
                    name: b.name,
                    type: 'boss',
                    isOcre: false,
                    imageUrl: b.imageUrl,
                    level: b.level,
                    zoneName: b.zoneName,
                    source: 'local' as const,
                    ...resolveZoneInWorldmap(b.zoneName, subareas, mapsBySubAreaId, normalize)
                }));
        }

        const localResults = [...archiResults, ...bountyResults];

        // Si on a des résultats locaux → réponse immédiate, AUCUN appel réseau
        if (localResults.length > 0) {
            return { success: true, data: localResults.slice(0, 12) };
        }

        // ── 4. Fallback DofusDB — UNIQUEMENT si zéro résultat local ──
        //       (filtres zones/ocre n'ont pas de sens en fallback DofusDB : on cherche tout)
        const seenNames = new Set(localResults.map(r => normalize(r.name)));
        const dofusDbResults: any[] = [];

        const cacheKey = `dofusdb:mapsearch:${normalize(query.trim())}:${filter}`;
        const fetchAndParse = async () => {
            try {
                // Use (?i) inline flag — DofusDB rejects $options=i (not whitelisted)
                const encodedQuery = encodeURIComponent(`(?i)${query.trim()}`);
                // Le filtre "boss" n'a de sens que sur les boss de donjon DofusDB (typeId=23)
                const bossOnly = filter === 'boss' ? `&typeId=23` : '';
                const url = `https://api.dofusdb.fr/monsters?lang=fr&name.fr[$regex]=${encodedQuery}${bossOnly}&$limit=10`;
                const resp = await fetch(url, {
                    headers: { 'Accept': 'application/json' },
                    cache: 'no-store'
                });
                if (!resp.ok) {
                    logger.error('[searchArchimonstresForMap] DofusDB non-ok:', { status: resp.status });
                    return [];
                }

                const json = await resp.json();
                const monsters: any[] = json.data || [];

                // Build subarea lookup for zone resolution
                const subareaById = new Map<number, any>();
                for (const sa of subareas) {
                    if (sa.id != null) subareaById.set(sa.id, sa);
                }

                const results: any[] = [];
                for (const m of monsters) {
                    const name: string = m.name?.fr || '';
                    if (!name || seenNames.has(normalize(name))) continue;
                    seenNames.add(normalize(name));

                    const imageUrl: string | null = m.img || null;
                    const level: number = m.grades?.[0]?.level ?? 0;
                    const dofusdbId: number | null = m.id ?? null;

                    // Type DofusDB : 23 = Boss de donjon → 'boss', sinon 'monstre'
                    const typeDofus = Number(m.typeId) === 23 ? 'boss' : 'monstre';

                    const rawSubareaIds: number[] = (m.subareas || [])
                        .map((s: any) => typeof s === 'number' ? s : s?.id)
                        .filter((id: any): id is number => typeof id === 'number');

                    let zoneName: string | null = null;
                    let centerX: number | null = null;
                    let centerY: number | null = null;
                    let worldMapId = 1;

                    if (rawSubareaIds.length > 0) {
                        const firstSa = subareaById.get(rawSubareaIds[0]);
                        if (firstSa) {
                            zoneName = typeof firstSa.name === 'string' ? firstSa.name : (firstSa.name?.fr || null);
                        }
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

                    results.push({
                        id: `ddb-${m.id || normalize(name)}`,
                        name,
                        type: typeDofus,
                        isOcre: false,
                        imageUrl,
                        level,
                        zoneName,
                        source: 'dofusdb' as const,
                        subAreaIds: rawSubareaIds,
                        centerX,
                        centerY,
                        worldMapId,
                        dofusdbId,
                    });

                    // ── AUTO-HEAL : insère le monstre en local pour les prochaines recherches ──
                    // Ignoré silencieusement si doublon (name,type) ou erreur Prisma
                    if (dofusdbId) {
                        try {
                            await db.archimonstre.upsert({
                                where: { name_type: { name, type: typeDofus } },
                                update: {
                                    imageUrl,
                                    level,
                                    dofusdbId,
                                    zone: zoneName || undefined,
                                    subareaIds: rawSubareaIds,
                                    worldMapId,
                                    centerX,
                                    centerY,
                                },
                                create: {
                                    name,
                                    type: typeDofus,
                                    isOcre: false,
                                    imageUrl,
                                    level,
                                    dofusdbId,
                                    zone: zoneName || undefined,
                                    subareaIds: rawSubareaIds,
                                    worldMapId,
                                    centerX,
                                    centerY,
                                },
                            });
                        } catch (upsertErr) {
                            logger.debug('[searchArchimonstresForMap] auto-heal upsert skipped:', { name, error: upsertErr });
                        }
                    }
                }
                return results;
            } catch (err) {
                logger.error('[searchArchimonstresForMap] DofusDB API error:', { error: err });
                return []; // Fail silently – return empty
            }
        };

        const cached = await withCache(cacheKey, 86_400, fetchAndParse); // TTL 24h, cache GLOBAL
        dofusDbResults.push(...(cached as any[]));

        return { success: true, data: dofusDbResults.slice(0, 12) };

    } catch (error) {
        logger.error('[searchArchimonstresForMap] Error:', { error });
        return { success: false, error: 'Erreur lors de la recherche' };
    }
}

/**
 * Retourne les premiers résultats d'un filtre (sans recherche texte) pour la barre
 * de filtres permanente de la carte. LOCAL-ONLY, zéro réseau.
 * Utilisé quand l'utilisateur clique sur une chip (ex: 🟡 Ocre) sans rien taper.
 */
export async function getArchimonstresByFilter(
    filter: MapSearchFilter
): Promise<ActionResponse<Array<{
    id: string;
    name: string;
    type: string;
    isOcre: boolean;
    imageUrl: string | null;
    level: number;
    zoneName: string | null;
    subAreaIds: number[];
    centerX: number | null;
    centerY: number | null;
    worldMapId: number;
    source: 'local';
}>>> {
    try {
        const where: any = {};
        switch (filter) {
            case 'archis': where.type = 'archimonstre'; break;
            case 'boss': where.type = 'boss'; break;
            case 'mobs': where.type = 'monstre'; break;
            case 'ocre': where.isOcre = true; break;
            case 'all': break;
            default: break; // 'zones' n'a pas de sens ici → retourne vide
        }

        // Pour 'all' sans texte on ne renvoie rien (les zones sont gérées par searchResults local)
        if (filter === 'all' || filter === 'zones') {
            return { success: true, data: [] };
        }

        const rows = await db.archimonstre.findMany({
            where,
            take: 20,
            orderBy: { name: 'asc' },
        });

        const results = rows.map(a => ({
            id: a.id,
            name: a.name,
            type: a.type,
            isOcre: a.isOcre,
            imageUrl: a.imageUrl,
            level: a.level,
            zoneName: a.zone,
            source: 'local' as const,
            subAreaIds: Array.isArray(a.subareaIds) ? (a.subareaIds as number[]) : [],
            centerX: a.centerX,
            centerY: a.centerY,
            worldMapId: a.worldMapId,
        }));

        return { success: true, data: results };
    } catch (error) {
        logger.error('[getArchimonstresByFilter] Error:', { error });
        return { success: false, error: 'Erreur chargement filtre' };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIMONSTRES — Admin CRUD + Sync
// ─────────────────────────────────────────────────────────────────────────────

export async function getArchimonstres(filter?: { type?: string; search?: string }): Promise<ActionResponse<any[]>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };

    try {
        const where: any = {};
        if (filter?.type && filter.type !== 'all') where.type = filter.type;
        if (filter?.search) where.name = { contains: filter.search, mode: 'insensitive' };

        // ⚠️ 5000+ monstres possibles dans le catalogue (syncWorldMonsters) — on limite la liste
        // pour ne pas freeze le panneau GOD. La recherche par nom (vitesse) reste fiable.
        // S` il y en a plus, on remonte les 500+ plus récents (le plus utile à voir).
        const rows = await db.archimonstre.findMany({
            where,
            orderBy: { updatedAt: 'desc' }, // les plus récents / resyncés d'abord
            take: 500,
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

const IGNORED_MONSTERS_PATH = path.join(process.cwd(), 'public', 'game-data', 'ignored-monsters.json');
const IGNORED_FAMILIES_PATH = path.join(process.cwd(), 'public', 'game-data', 'ignored-families.json');
const IGNORED_ZONES_PATH = path.join(process.cwd(), 'public', 'game-data', 'ignored-zones.json');

function getIgnoredMonsters(): { names: string[]; dofusdbIds: number[] } {
    try {
        if (fs.existsSync(IGNORED_MONSTERS_PATH)) {
            const raw = fs.readFileSync(IGNORED_MONSTERS_PATH, 'utf-8');
            const data = JSON.parse(raw);
            return {
                names: Array.isArray(data.names) ? data.names : [],
                dofusdbIds: Array.isArray(data.dofusdbIds) ? data.dofusdbIds : []
            };
        }
    } catch { }
    return { names: [], dofusdbIds: [] };
}

function addIgnoredMonster(name: string, dofusdbId?: number | null) {
    try {
        const current = getIgnoredMonsters();
        const namesSet = new Set(current.names.map(n => n.toLowerCase()));
        const idsSet = new Set(current.dofusdbIds);

        if (name && name.trim()) namesSet.add(name.trim().toLowerCase());
        if (typeof dofusdbId === 'number') idsSet.add(dofusdbId);

        const dir = path.dirname(IGNORED_MONSTERS_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(IGNORED_MONSTERS_PATH, JSON.stringify({
            names: Array.from(namesSet),
            dofusdbIds: Array.from(idsSet),
            updatedAt: new Date().toISOString()
        }, null, 2));
    } catch (e) {
        logger.error('[addIgnoredMonster] Error saving ignored monster:', { error: e });
    }
}

function isIgnoredMonster(name?: string | null, dofusdbId?: number | null): boolean {
    const ignored = getIgnoredMonsters();
    if (typeof dofusdbId === 'number' && ignored.dofusdbIds.includes(dofusdbId)) return true;
    if (name && ignored.names.includes(name.trim().toLowerCase())) return true;
    return false;
}

// --- Familles Exclues ---
function getIgnoredFamilies(): string[] {
    try {
        if (fs.existsSync(IGNORED_FAMILIES_PATH)) {
            const raw = fs.readFileSync(IGNORED_FAMILIES_PATH, 'utf-8');
            const data = JSON.parse(raw);
            return Array.isArray(data.names) ? data.names : [];
        }
    } catch { }
    return [];
}

export async function addIgnoredFamily(name: string) {
    try {
        const current = getIgnoredFamilies();
        const namesSet = new Set(current.map(n => n.toLowerCase()));
        if (name && name.trim()) namesSet.add(name.trim().toLowerCase());

        const dir = path.dirname(IGNORED_FAMILIES_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(IGNORED_FAMILIES_PATH, JSON.stringify({
            names: Array.from(namesSet),
            updatedAt: new Date().toISOString()
        }, null, 2));
    } catch (e) {
        logger.error('[addIgnoredFamily] Error:', { error: e });
    }
}

function isIgnoredFamily(name?: string | null): boolean {
    if (!name) return false;
    const ignored = getIgnoredFamilies();
    return ignored.includes(name.trim().toLowerCase());
}

export async function getIgnoredFamiliesAction(): Promise<ActionResponse<string[]>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };
    return { success: true, data: getIgnoredFamilies() };
}

export async function restoreIgnoredFamilyAction(name: string): Promise<ActionResponse> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };
    try {
        const current = getIgnoredFamilies();
        const names = current.filter(n => n.toLowerCase() !== name.trim().toLowerCase());
        fs.writeFileSync(IGNORED_FAMILIES_PATH, JSON.stringify({
            names,
            updatedAt: new Date().toISOString()
        }, null, 2));
        return { success: true };
    } catch (e: any) {
        logger.error('[restoreIgnoredFamilyAction] Error:', { error: e });
        return { success: false, error: 'Erreur lors de la restauration de la famille' };
    }
}

export async function clearAllIgnoredFamiliesAction(): Promise<ActionResponse> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };
    try {
        fs.writeFileSync(IGNORED_FAMILIES_PATH, JSON.stringify({
            names: [],
            updatedAt: new Date().toISOString()
        }, null, 2));
        return { success: true };
    } catch (e: any) {
        logger.error('[clearAllIgnoredFamiliesAction] Error:', { error: e });
        return { success: false, error: 'Erreur lors de la réinitialisation' };
    }
}

// --- Zones Exclues ---
function getIgnoredZones(): string[] {
    try {
        if (fs.existsSync(IGNORED_ZONES_PATH)) {
            const raw = fs.readFileSync(IGNORED_ZONES_PATH, 'utf-8');
            const data = JSON.parse(raw);
            return Array.isArray(data.names) ? data.names : [];
        }
    } catch { }
    return [];
}

export async function addIgnoredZone(name: string) {
    try {
        const current = getIgnoredZones();
        const namesSet = new Set(current.map(n => n.toLowerCase()));
        if (name && name.trim()) namesSet.add(name.trim().toLowerCase());

        const dir = path.dirname(IGNORED_ZONES_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(IGNORED_ZONES_PATH, JSON.stringify({
            names: Array.from(namesSet),
            updatedAt: new Date().toISOString()
        }, null, 2));
    } catch (e) {
        logger.error('[addIgnoredZone] Error:', { error: e });
    }
}

function isIgnoredZone(name?: string | null): boolean {
    if (!name) return false;
    const ignored = getIgnoredZones();
    return ignored.includes(name.trim().toLowerCase());
}

export async function getIgnoredZonesAction(): Promise<ActionResponse<string[]>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };
    return { success: true, data: getIgnoredZones() };
}

export async function restoreIgnoredZoneAction(name: string): Promise<ActionResponse> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };
    try {
        const current = getIgnoredZones();
        const names = current.filter(n => n.toLowerCase() !== name.trim().toLowerCase());
        fs.writeFileSync(IGNORED_ZONES_PATH, JSON.stringify({
            names,
            updatedAt: new Date().toISOString()
        }, null, 2));
        return { success: true };
    } catch (e: any) {
        logger.error('[restoreIgnoredZoneAction] Error:', { error: e });
        return { success: false, error: 'Erreur lors de la restauration de la zone' };
    }
}

export async function clearAllIgnoredZonesAction(): Promise<ActionResponse> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };
    try {
        fs.writeFileSync(IGNORED_ZONES_PATH, JSON.stringify({
            names: [],
            updatedAt: new Date().toISOString()
        }, null, 2));
        return { success: true };
    } catch (e: any) {
        logger.error('[clearAllIgnoredZonesAction] Error:', { error: e });
        return { success: false, error: 'Erreur lors de la réinitialisation' };
    }
}

export async function deleteArchimonstre(id: string): Promise<ActionResponse> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };

    try {
        const target = await db.archimonstre.findUnique({
            where: { id },
            select: { name: true, dofusdbId: true }
        });
        if (target) {
            addIgnoredMonster(target.name, target.dofusdbId);
        }
        await db.archimonstre.delete({ where: { id } });
        await logGameDataWrite("delete-archimonstre", id);
        return { success: true };
    } catch (error) {
        logger.error('[deleteArchimonstre] Error:', { error });
        return { success: false, error: 'Erreur suppression' };
    }
}

/**
 * 🗑️ Liste de toutes les créatures/boss blacklistées (supprimées).
 */
export async function getIgnoredMonstersAction(): Promise<ActionResponse<{ names: string[]; dofusdbIds: number[] }>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };
    return { success: true, data: getIgnoredMonsters() };
}

/**
 * ↺ Restaurer / Réintégrer une créature blacklistée.
 */
export async function restoreIgnoredMonsterAction(name: string, dofusdbId?: number): Promise<ActionResponse> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };

    try {
        const current = getIgnoredMonsters();
        const names = current.names.filter(n => n.toLowerCase() !== name.trim().toLowerCase());
        const dofusdbIds = typeof dofusdbId === 'number' 
            ? current.dofusdbIds.filter(id => id !== dofusdbId)
            : current.dofusdbIds;

        fs.writeFileSync(IGNORED_MONSTERS_PATH, JSON.stringify({
            names,
            dofusdbIds,
            updatedAt: new Date().toISOString()
        }, null, 2));

        return { success: true };
    } catch (e: any) {
        logger.error('[restoreIgnoredMonsterAction] Error:', { error: e });
        return { success: false, error: 'Erreur lors de la restauration' };
    }
}

/**
 * ♻️ Réinitialiser complètement la liste des créatures exclues.
 */
export async function clearAllIgnoredMonstersAction(): Promise<ActionResponse> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };

    try {
        fs.writeFileSync(IGNORED_MONSTERS_PATH, JSON.stringify({
            names: [],
            dofusdbIds: [],
            updatedAt: new Date().toISOString()
        }, null, 2));
        return { success: true };
    } catch (e: any) {
        logger.error('[clearAllIgnoredMonstersAction] Error:', { error: e });
        return { success: false, error: 'Erreur lors de la réinitialisation' };
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
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };

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
        // B2 — Détection de nouveautés Metamob : archis/boss Ocre absents localement
        const newOcreMonsters: { name: string; type: string; zone: string }[] = [];
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

                    if (isIgnoredMonster(monster.name, dofusdbId)) {
                        skipped++;
                        return;
                    }

                    const ocreType = monster.type.toLowerCase().includes('monstre') ? 'monstre' : monster.type;

                    // B2 — Détecter si c'est une nouvelle entrée Ocre (absent avant upsert)
                    const existingOcre = await db.archimonstre.findFirst({
                        where: { name: monster.name, type: ocreType },
                        select: { id: true },
                    });
                    if (!existingOcre) {
                        newOcreMonsters.push({ name: monster.name, type: ocreType, zone: monster.zone || '' });
                    }

                    await db.archimonstre.upsert({
                        where: { name_type: { name: monster.name, type: ocreType } },
                        update: {
                            isOcre: true,
                            type: ocreType,
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
                            type: ocreType,
                            isOcre: true,
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

        // B2 — Notifier les nouveaux archis/boss Ocre détectés (base panel GOD + Discord)
        if (newOcreMonsters.length > 0) {
            try {
                const { notifyGod } = await import('./god-notif-actions');
                const count = newOcreMonsters.length;
                const sample = newOcreMonsters.slice(0, 8)
                    .map(m => `• **${m.name}** (${m.type}${m.zone ? `, ${m.zone}` : ''})`)
                    .join('\n');
                const more = count > 8 ? `\n… et ${count - 8} autres` : '';
                await notifyGod({
                    title: '🟡 Nouveaux archis/boss Ocre détectés (Metamob)',
                    message: `**${count}** nouvel(le)(s) entrée(s) Ocre ajoutée(s) au catalogue local.\n\n${sample}${more}`,
                    type: 'SYSTEM',
                    success: true,
                    ping: false,
                    metadata: {
                        synced,
                        newCount: count,
                        source: 'metamob',
                    },
                });
            } catch (err) {
                logger.error('[syncOcreArchimonstres] Failed to dispatch new-ocre notification:', { error: err });
            }
        }

        return { success: true, data: { synced, skipped } };

    } catch (error) {
        logger.error('[syncOcreArchimonstres] Error:', { error });
        return { success: false, error: 'Erreur lors de la synchronisation' };
    }
}

/**
 * Sync le catalogue complet DofusDB (monstres normaux) en local.
 *
 * Pensé pour être appelé en boucle depuis le GOD (ArchimonstreManager) avec
 * progression : chaque appel traite un batch (batchSize), puis retourne
 * `nextSkip` + `total` + `done` pour afficher une barre de progression.
 *
 * - isOcre:false (les monstres normaux ne sont pas des archis Ocre)
 * - Résout monde/subarea/coords via worldmap.json
 * - Upsert par name_type (type:'monstre')
 * - Rate-limit: pas nécessaire (action super-admin, rare)
 */
export async function syncWorldMonsters(params?: { skip?: number; batchSize?: number }): Promise<ActionResponse<{
    synced: number;
    skipped: number;
    total: number;
    nextSkip: number;
    done: boolean;
}>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };

    const batchSize = params?.batchSize ?? 50;
    const skip = params?.skip ?? 0;

    try {
        // ── 1. Load worldmap.json une fois ────────────────────────────────
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

        // ── 2. Pagination DofusDB (UN batch par appel) ────────────────────
        const url = `https://api.dofusdb.fr/monsters?lang=fr&$limit=${batchSize}&$skip=${skip}`;
        const resp = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(30000)
        });
        if (!resp.ok) {
            return { success: false, error: `DofusDB API erreur ${resp.status}` };
        }

        const json = await resp.json();
        const monsters: any[] = json.data || [];
        const total = json.total || 0;

        if (monsters.length === 0) {
            return { success: true, data: { synced: 0, skipped: 0, total, nextSkip: skip, done: true } };
        }

        // ── 3. Pour chaque monstre : résoudre coords + upsert local ───────
        //  - Les boss de donjon DofusDB ont `typeId: 23` → type 'boss' (sinon 'monstre')
        //  - On NE TOUCHE PAS aux entrées déjà marquées `isOcre:true` ou de type 'archimonstre'
        //    (elles proviennent du sync Metamob/Quête Ocre et ont priorité)
        let synced = 0;
        let skipped = 0;
        // B2 — Détection de nouveautés DofusDB : monstres absents localement avant upsert.
        // On ne détecte que sur les syncs incrémentales (skip > 0) pour éviter le spam de
        // notifications lors d'une première sync complète (tout le catalogue serait "nouveau").
        const newMonsters: { id: number; name: string; type: string }[] = [];
        const isIncrementalSync = skip > 0;

        for (const monster of monsters) {
            try {
                const nameFr: string = monster.name?.fr || monster.name || '';
                if (!nameFr) { skipped++; continue; }
                const dofusdbId: number = monster.id;
                if (isIgnoredMonster(nameFr, dofusdbId)) { skipped++; continue; }
                const imageUrl: string | null = monster.img || null;
                const level = monster.grades?.[0]?.level ?? 0;

                // Détermination du type : DofusDB fournit isBoss: true pour les gardiens de donjon
                // et isMiniBoss: true pour les archimonstres.
                let dofusType: string = 'monstre';
                if (monster.isBoss === true || Number(monster.typeId) === 23) {
                    dofusType = 'boss';
                } else if (monster.isMiniBoss === true) {
                    dofusType = 'archimonstre';
                }

                const rawSubareaIds: number[] = (monster.subareas || [])
                    .map((s: any) => typeof s === 'number' ? s : s?.id)
                    .filter((id: any): id is number => typeof id === 'number');

                // Résoudre monde/subarea/coords via worldmap.json
                let centerX: number | null = null;
                let centerY: number | null = null;
                let worldMapId = 1;
                let zoneName: string | null = null;

                if (rawSubareaIds.length > 0) {
                    let bestMap: any = null;
                    for (const saId of rawSubareaIds) {
                        const sa = subareaById.get(saId);
                        if (sa) {
                            const saName = typeof sa.name === 'string' ? sa.name : (sa.name?.fr || '');
                            if (saName && !zoneName) zoneName = saName;
                        }
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

                // ── Lire l'entrée locale existante pour TOUS les types du même nom ──
                // Si elle est Ocre/archimonstre, on la préserve (juste coords/préservation), sinon
                // on ne crée que la ligne (monstre ou boss) pour ce nom.
                const existing = await db.archimonstre.findFirst({
                    where: { name: nameFr },
                    orderBy: { isOcre: 'desc' }, // priorité aux Ocre s'il y a doublon
                    select: { id: true, type: true, isOcre: true },
                });

                // B2 — Nouveau monstre du catalogue (aucune entrée locale) → à signaler (uniquement sync incrémentale)
                if (isIncrementalSync && !existing) {
                    newMonsters.push({ id: dofusdbId, name: nameFr, type: dofusType });
                }

                // Ligne Ocre ou archimonstre existante → on update ses coords/image SANS dégrader
                if (existing && (existing.isOcre || existing.type === 'archimonstre')) {
                    await db.archimonstre.update({
                        where: { id: existing.id },
                        data: {
                            imageUrl: imageUrl ?? undefined,
                            level: level || undefined,
                            dofusdbId,
                            zone: zoneName || undefined,
                            subareaIds: rawSubareaIds,
                            worldMapId,
                            centerX,
                            centerY,
                        },
                    });
                    synced++;
                    continue;
                }

                // Sinon (pas d'existant Ocre/archi) → gérer le doublon d'ancien type (même nom)
                // avant l'upsert propre sur (name, dofusType) pour respecter @@unique([name, type])
                const otherTypeRow = await db.archimonstre.findFirst({
                    where: { name: nameFr, type: { not: dofusType } },
                    select: { id: true },
                });
                if (otherTypeRow) {
                    await db.archimonstre.delete({ where: { id: otherTypeRow.id } });
                }

                await db.archimonstre.upsert({
                    where: { name_type: { name: nameFr, type: dofusType } },
                    update: {
                        isOcre: false, // le catalogue complet n'est jamais Ocre
                        type: dofusType,
                        imageUrl,
                        level,
                        dofusdbId,
                        zone: zoneName || null,
                        subzone: null,
                        subareaIds: rawSubareaIds,
                        worldMapId,
                        centerX,
                        centerY,
                    },
                    create: {
                        name: nameFr,
                        type: dofusType,
                        isOcre: false,
                        imageUrl,
                        level,
                        dofusdbId,
                        zone: zoneName || null,
                        subzone: null,
                        subareaIds: rawSubareaIds,
                        worldMapId,
                        centerX,
                        centerY,
                    },
                });
                synced++;
            } catch (err) {
                logger.error('[syncWorldMonsters] Error for monster:', { name: monster.name?.fr, error: err });
                skipped++;
            }
        }

        const nextSkip = skip + monsters.length;
        const done = nextSkip >= total;

        // B2 — Notifier les nouveautés détectées (base panel GOD + Discord)
        if (newMonsters.length > 0) {
            try {
                const { notifyGod } = await import('./god-notif-actions');
                const count = newMonsters.length;
                const sample = newMonsters.slice(0, 8)
                    .map(m => `• **${m.name}** (${m.type}${m.id ? `, #${m.id}` : ''})`)
                    .join('\n');
                const more = count > 8 ? `\n… et ${count - 8} autres` : '';
                await notifyGod({
                    title: '🧭 Nouveaux monstres DofusDB détectés',
                    message: `**${count}** nouvel(le)(s) entrée(s) ajoutée(s) au catalogue local lors de la sync.\n\n${sample}${more}\n\n> Référence : pas de ligne locale pré-existante (nouveau contenu du jeu).`,
                    type: 'SYSTEM',
                    success: true,
                    ping: false,
                    metadata: {
                        synced,
                        newCount: count,
                        batchStart: skip,
                    },
                });
            } catch (err) {
                logger.error('[syncWorldMonsters] Failed to dispatch new-monster notification:', { error: err });
            }
        }

        return {
            success: true,
            data: { synced, skipped, total, nextSkip, done }
        };

    } catch (error) {
        logger.error('[syncWorldMonsters] Error:', { error });
        return { success: false, error: 'Erreur lors de la synchronisation du catalogue' };
    }
}

/**
 * 👑 Synchronisation 1-clic dédiée de tous les Boss / Gardiens de donjon depuis DofusDB.
 */
export async function syncDofusBosses(): Promise<ActionResponse<{ synced: number; total: number }>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };

    try {
        const worldmapPath = path.join(process.cwd(), 'public', 'game-data', 'worldmap.json');
        let subareaById = new Map<number, any>();
        let mapsBySubAreaId = new Map<number, any[]>();
        if (fs.existsSync(worldmapPath)) {
            const worldmapRaw = fs.readFileSync(worldmapPath, 'utf-8');
            const worldmap = JSON.parse(worldmapRaw);
            for (const sa of worldmap.subareas || []) { if (sa.id != null) subareaById.set(sa.id, sa); }
            for (const m of worldmap.maps || []) {
                if (m.subAreaId == null) continue;
                if (!mapsBySubAreaId.has(m.subAreaId)) mapsBySubAreaId.set(m.subAreaId, []);
                mapsBySubAreaId.get(m.subAreaId)!.push(m);
            }
        }

        const bossesMap = new Map<number, any>();
        let skip = 0;
        let total = 1;
        while (skip < total) {
            const res = await fetch(`https://api.dofusdb.fr/monsters?$limit=50&$skip=${skip}&isBoss=true`, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(15000)
            });
            if (!res.ok) break;
            const json = await res.json();
            total = json.total || 0;
            const items = json.data || [];
            for (const item of items) {
                bossesMap.set(item.id, item);
            }
            if (items.length === 0) break;
            skip += items.length;
        }

        const bosses = Array.from(bossesMap.values());
        let synced = 0;

        for (const b of bosses) {
            const nameFr = b.name?.fr || b.name || '';
            if (!nameFr) continue;
            if (isIgnoredMonster(nameFr, b.id)) continue;

            const rawSubareaIds: number[] = (b.subareas || [])
                .map((s: any) => typeof s === 'number' ? s : s?.id)
                .filter((id: any): id is number => typeof id === 'number');

            let centerX: number | null = null;
            let centerY: number | null = null;
            let worldMapId = 1;
            let zoneName: string | null = null;

            if (rawSubareaIds.length > 0) {
                for (const saId of rawSubareaIds) {
                    const sa = subareaById.get(saId);
                    if (sa) {
                        const saName = typeof sa.name === 'string' ? sa.name : (sa.name?.fr || '');
                        if (saName && !zoneName) zoneName = saName;
                    }
                    for (const map of mapsBySubAreaId.get(saId) || []) {
                        if (map.x != null && map.y != null) {
                            centerX = map.x;
                            centerY = map.y;
                            worldMapId = map.worldMap === -1 ? 1 : map.worldMap;
                            break;
                        }
                    }
                }
            }

            // Supprimer une éventuelle entrée sous le type "monstre" pour éviter le conflit unique
            await db.archimonstre.deleteMany({
                where: { name: nameFr, type: { not: 'boss' } }
            });

            await db.archimonstre.upsert({
                where: { name_type: { name: nameFr, type: 'boss' } },
                update: {
                    imageUrl: b.img || null,
                    level: b.grades?.[0]?.level ?? 0,
                    dofusdbId: b.id,
                    zone: zoneName,
                    subareaIds: rawSubareaIds,
                    worldMapId,
                    centerX,
                    centerY
                },
                create: {
                    name: nameFr,
                    type: 'boss',
                    isOcre: false,
                    imageUrl: b.img || null,
                    level: b.grades?.[0]?.level ?? 0,
                    dofusdbId: b.id,
                    zone: zoneName,
                    subareaIds: rawSubareaIds,
                    worldMapId,
                    centerX,
                    centerY
                }
            });
            synced++;
        }

        return { success: true, data: { synced, total: bosses.length } };
    } catch (err: any) {
        logger.error('[syncDofusBosses] Error:', { error: err });
        return { success: false, error: 'Erreur lors de la synchronisation des Boss' };
    }
}

/**
 * 🌾 Résumé et statistiques des ressources récoltables et Zaaps (WorldMap / OptiFarm).
 */
export async function getHarvestResourcesSummary(): Promise<ActionResponse<{
    jobs: { id: number; name: string; icon: string; img: string; resourceCount: number; totalSpots: number }[];
    totalResources: number;
    totalSpots: number;
    zaapCount: number;
    lastUpdated: string;
}>> {
    if (!(await canAccessGameData())) return { success: false, error: "Non autorisé" };

    try {
        const harvestPath = path.join(process.cwd(), 'public', 'game-data', 'harvest-resources.json');
        const zaapsPath = path.join(process.cwd(), 'public', 'game-data', 'zaaps.json');

        if (!fs.existsSync(harvestPath)) {
            return { success: false, error: "Fichier harvest-resources.json introuvable" };
        }

        const harvestRaw = fs.readFileSync(harvestPath, 'utf8');
        const jobsData = JSON.parse(harvestRaw);

        let zaapCount = 0;
        if (fs.existsSync(zaapsPath)) {
            const zaapsRaw = fs.readFileSync(zaapsPath, 'utf8');
            const zaapsData = JSON.parse(zaapsRaw);
            zaapCount = Array.isArray(zaapsData) ? zaapsData.length : 0;
        }

        let totalResources = 0;
        let totalSpots = 0;

        const jobs = jobsData.map((job: any) => {
            const resCount = job.resources?.length || 0;
            const spotsSum = job.resources?.reduce((acc: number, r: any) => acc + (r.totalSpots || r.spots?.length || 0), 0) || 0;
            totalResources += resCount;
            totalSpots += spotsSum;
            return {
                id: job.id,
                name: job.name,
                icon: job.icon,
                img: job.img,
                resourceCount: resCount,
                totalSpots: spotsSum,
            };
        });

        const stats = fs.statSync(harvestPath);

        return {
            success: true,
            data: {
                jobs,
                totalResources,
                totalSpots,
                zaapCount,
                lastUpdated: stats.mtime.toISOString()
            }
        };
    } catch (err: any) {
        logger.error('[getHarvestResourcesSummary] Error:', { error: err });
        return { success: false, error: "Erreur lecture harvest-resources.json" };
    }
}

/**
 * 🛰️ Diagnostic de santé et test de connectivité en direct avec l'API DofusDB.
 */
export async function checkDofusDbApiHealth(): Promise<ActionResponse<{
    endpoints: { name: string; url: string; status: number; latencyMs: number; ok: boolean }[];
    allOk: boolean;
    timestamp: string;
}>> {
    if (!(await canAccessGameData())) return { success: false, error: "Non autorisé" };

    const testUrls = [
        { name: "Items & Récoltes", url: "https://api.dofusdb.fr/items?$limit=1" },
        { name: "Monstres & Boss", url: "https://api.dofusdb.fr/monsters?$limit=1" },
        { name: "Sous-zones & Coordonnées", url: "https://api.dofusdb.fr/subareas?$limit=1" },
        { name: "Donjons & Salles", url: "https://api.dofusdb.fr/dungeons?$limit=1" },
    ];

    const results = await Promise.all(
        testUrls.map(async (ep) => {
            const start = performance.now();
            try {
                const res = await fetch(ep.url, {
                    headers: { 'Accept': 'application/json', 'User-Agent': 'SigilOS-SyncEngine/2.0' },
                    signal: AbortSignal.timeout(6000)
                });
                const latencyMs = Math.round(performance.now() - start);
                return {
                    name: ep.name,
                    url: ep.url,
                    status: res.status,
                    latencyMs,
                    ok: res.ok
                };
            } catch (err: any) {
                const latencyMs = Math.round(performance.now() - start);
                return {
                    name: ep.name,
                    url: ep.url,
                    status: 0,
                    latencyMs,
                    ok: false
                };
            }
        })
    );

    const allOk = results.every(r => r.ok);

    return {
        success: true,
        data: {
            endpoints: results,
            allOk,
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * 🦎 Synchronisation automatique des Familles de Monstres depuis DofusDB (/monster-races).
 * Préserve les modifications manuelles tout en ajoutant les familles officielles manquantes.
 */
export async function syncMonsterFamiliesFromDofusDb(): Promise<ActionResponse<{ synced: number; total: number }>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };

    try {
        let skip = 0;
        let total = 1;
        let synced = 0;

        while (skip < total) {
            const res = await fetch(`https://api.dofusdb.fr/monster-races?$limit=50&$skip=${skip}`, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(15000)
            });
            if (!res.ok) break;
            const json = await res.json();
            total = json.total || 0;
            const items = json.data || [];
            if (items.length === 0) break;

            for (const item of items) {
                const nameFr = typeof item.name === 'string' ? item.name : (item.name?.fr || item.name?.en || '');
                if (!nameFr || !nameFr.trim()) continue;
                if (isIgnoredFamily(nameFr)) continue;

                await db.monsterFamily.upsert({
                    where: { name: nameFr.trim() },
                    update: {}, // Préserve les données manuelles existantes
                    create: {
                        name: nameFr.trim(),
                        level: null,
                    }
                });
                synced++;
            }
            skip += items.length;
        }

        await logGameDataWrite("sync-monster-families", `synced-${synced}`);
        return { success: true, data: { synced, total } };
    } catch (e: any) {
        logger.error('[syncMonsterFamiliesFromDofusDb] Error:', { error: e });
        return { success: false, error: 'Erreur lors de la synchronisation des familles' };
    }
}

/**
 * 🗺️ Synchronisation automatique des Zones & Sous-zones du Monde des Douze depuis DofusDB (/subareas & /areas).
 * Ingestion complète des 562+ sous-zones réelles avec leurs niveaux exacts et des macro-régions.
 * Préserve les zones custom et configurations existantes.
 */
export async function syncZonesFromDofusDb(): Promise<ActionResponse<{ synced: number; total: number }>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };

    try {
        let synced = 0;
        let totalProcessed = 0;

        // 1. Synchronisation des 562 Sous-Zones (lieux réels de présence : Montagne des Craqueleurs, Port de Madrestam...)
        let subSkip = 0;
        let subTotal = 1;

        while (subSkip < subTotal) {
            const res = await fetch(`https://api.dofusdb.fr/subareas?$limit=50&$skip=${subSkip}`, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(15000)
            });
            if (!res.ok) break;
            const json = await res.json();
            subTotal = json.total || 0;
            const items = json.data || [];
            if (items.length === 0) break;

            for (const item of items) {
                const nameFr = typeof item.name === 'string' ? item.name : (item.name?.fr || item.name?.en || '');
                if (!nameFr || !nameFr.trim()) continue;
                if (isIgnoredZone(nameFr)) continue;

                const lvl = typeof item.level === 'number' && item.level > 0 ? item.level : 200;

                await db.zone.upsert({
                    where: { name: nameFr.trim() },
                    update: {
                        // Met à jour le niveau officiel si présent
                        level: lvl
                    },
                    create: {
                        name: nameFr.trim(),
                        level: lvl,
                    }
                });
                synced++;
            }
            subSkip += items.length;
            totalProcessed = subTotal;
        }

        // 2. Synchronisation des 69 Grandes Régions (Amakna, Cania, Frigost...)
        let areaSkip = 0;
        let areaTotal = 1;

        while (areaSkip < areaTotal) {
            const res = await fetch(`https://api.dofusdb.fr/areas?$limit=50&$skip=${areaSkip}`, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(15000)
            });
            if (!res.ok) break;
            const json = await res.json();
            areaTotal = json.total || 0;
            const items = json.data || [];
            if (items.length === 0) break;

            for (const item of items) {
                const nameFr = typeof item.name === 'string' ? item.name : (item.name?.fr || item.name?.en || '');
                if (!nameFr || !nameFr.trim()) continue;
                if (isIgnoredZone(nameFr)) continue;

                await db.zone.upsert({
                    where: { name: nameFr.trim() },
                    update: {}, // Préserve les réglages existants
                    create: {
                        name: nameFr.trim(),
                        level: 200,
                    }
                });
                synced++;
            }
            areaSkip += items.length;
        }

        await logGameDataWrite("sync-zones", `synced-${synced}`);
        return { success: true, data: { synced, total: totalProcessed + areaTotal } };
    } catch (e: any) {
        logger.error('[syncZonesFromDofusDb] Error:', { error: e });
        return { success: false, error: 'Erreur lors de la synchronisation des zones et sous-zones' };
    }
}
