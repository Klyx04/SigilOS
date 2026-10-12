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
import { buildBountyBestiaireEntry } from "@/lib/bounty-fiche";
import { resolveSubAreaCenter } from "@/lib/zone-minimap";
import { normalizeDofusAssetStoredUrl } from "@/lib/dofus-image-url";
import { NO_ACHIEVEMENT_CHALLENGE_SLUG } from "@/lib/dungeon-no-achievement";
import { sanitizeHtml } from "@/lib/security";
import { dofusDbFetch } from "@/lib/dofusdb-limiter";
import { diffFields, recordGameDataChanges } from "@/lib/game-data-changelog";
import { getDofensiveDungeonForBoss } from "@/server/actions/dofensive-actions";
import { resolveUniqueDungeonSlug } from "@/server/game/dungeon-slug";
import {
    getIgnoredFamilies,
    getIgnoredZones,
    isIgnoredFamily,
    isIgnoredZone,
    getHiddenMapZones,
    HIDDEN_MAP_ZONES_PATH,
    IGNORED_FAMILIES_PATH,
    IGNORED_ZONES_PATH,
} from "@/lib/game-data-ignores";
import { zoneNameKey } from "@/lib/zone-label";
import { syncZonesFromDofusDbCore } from "@/lib/zones-siphon";
import { syncMonsterFamiliesCore } from "@/lib/monster-families-siphon";
import { dofusdbFicheInit, getMonsterStats as getMonsterStatsCore, getLocalMonsterFiche, type MonsterFicheSource } from "@/lib/monster-stats-core";
import {
    listUnityMonsters,
    getUnityBestiary,
} from "@/lib/unity-bestiary";
import {
    searchNormalMonsters as searchNormalMonstersRule,
    listNormalMonsters,
    groupMonsterFamilies,
    monsterSpriteUrl,
    type MonsterFamilyFacet,
} from "@/lib/monster-fiche";
import {
    buildSubareaFamilies,
    subareaMonsterIds,
    subareaIdsForMonster,
} from "@/lib/subarea-monsters";
import { BOUNTY_RACE_IDS } from "@/lib/bounty";
import { slugifyBossName } from "@/lib/boss-slug";
import { excludedNormalMonsterKeys, listSiphonedNormalMonsterSlugs } from "@/server/game/normal-monster-scope";
import { monsterRaces, monsterSuperRaces } from "@/lib/monster-races";

const normStr = (s: string | null | undefined): string =>
    (s ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();

let localDungeonMonstersDataCache: {
    updatedAt: string;
    totalDungeons: number;
    totalMonsters: number;
    dungeons: any[];
    monsters: any[];
} | null = null;

function getLocalDungeonMonstersData() {
    if (localDungeonMonstersDataCache) return localDungeonMonstersDataCache;
    try {
        const filePath = path.join(process.cwd(), 'public', 'game-data', 'dungeon-monsters.json');
        if (fs.existsSync(filePath)) {
            localDungeonMonstersDataCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return localDungeonMonstersDataCache;
        }
    } catch (e) {
        logger.error("[getLocalDungeonMonstersData] Erreur lecture dungeon-monsters.json:", { error: e });
    }
    return null;
}

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
 *
 * 🛡️ Fusion **D-4** (28/09/2026) : les avis de recherche sont un **éditeur** de cette interface
 * (`game-data > Éditeurs > Avis de recherche`) ⇒ la brique ciblée `game-data-bounties` n'existe
 * plus : cette fonction est la seule garde (une règle, un nom — pas de variante qui diverge).
 */
async function canAccessGameData(): Promise<boolean> {
    if (await isSuperAdmin()) return true;
    return canAccessBrick("game-data");
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
            include: {
                monsters: true,
                zones: { select: { id: true, name: true } }
            },
            // 🐛 Mesure du 12/10/2026 : `take: 100` sur **249** familles ⇒ l'éditeur de zone
            // (God) affichait le **cuid brut** de toute famille dont le nom triait après le
            // 100ᵉ (constat user : « ces chaînes illisibles »). Une recherche reste bornée ;
            // une liste complète ne l'est plus (249 lignes, volume déjà maîtrisé ailleurs).
            take: filters.search ? 20 : undefined,
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
                    // ⚠️ 23/09/2026 — `dofusDbFetch` : ces 2 appels de la recherche de zones
                    // contournaient eux aussi le limiteur partagé (même famille que les 2 de
                    // `getMonsterStats`). Un seul chemin réseau poli pour tout le fichier.
                    dofusDbFetch(`https://api.dofusdb.fr/subareas?${nameFilter}&$limit=${subLimit}&lang=fr`, {
                        headers: { Accept: "application/json" },
                        signal: AbortSignal.timeout(10000),
                    }),
                    dofusDbFetch(`https://api.dofusdb.fr/areas?${nameFilter}&$limit=${areaLimit}&lang=fr`, {
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
        // « Donjon validé » retiré (11/10/2026) : ce pseudo-succès n'est plus publié à AUCUN
        // consommateur (hub Succès **et** « Mes Succès », qui compte `achievements.length` pour ses
        // totaux et ses « tranches complètes ») — même si une ligne résiduelle traîne en base avant
        // la purge (`scripts/succes-speciaux.ts retirer-donjon-valide`).
        const data = dungeons.map((dungeon) => ({
            ...dungeon,
            achievements: (dungeon.achievements ?? []).filter(
                (achievement: any) => achievement?.challenge?.slug !== NO_ACHIEVEMENT_CHALLENGE_SLUG
            ),
        }));
        return { success: true, data };
    } catch (error) {
        logger.error('[getDungeonsWithAchievements] Error:', { error });
        return { success: false, error: 'Erreur lors du chargement' };
    }
}

export interface BestiaireEntry {
    id: string;
    name: string;
    bossName: string;
    /** Segment d'URL publique (`/boss/<slug>`) — repli sur `id` s'il est absent. */
    slug?: string | null;
    level: number;
    imageUrl?: string | null;
    dofensiveUrl?: string | null;
    dpnlUrl?: string | null;
    dofusdbId?: number | null;
    dofensiveMonsterName?: string | null;
    dofensiveDungeonName?: string | null;
    isOcreQuest: boolean;
    /* 🎯 `bounty` = avis de recherche (chantier 16/09/2026) : ni donjon, ni titan, ni monstre de salle. */
    type: 'boss' | 'monstre' | 'titan' | 'anomalie' | 'bounty' | 'raid';
    /** 🎯 Filtre « Monstres » : famille officielle du monstre (« Monstres de quête », « Blops »…). */
    familyName?: string | null;
    /** 🎯 Filtre « Monstres » : `raceId` Ankama de la famille (2ᵉ niveau de filtre). */
    raceId?: number | null;
}

/**
 * Retourne la liste unifiée pour l'overlay Bestiaire :
 * - Boss de donjons
 * - Monstres réguliers (archis / monstres sauvages)
 * - Données nécessaires pour filtrer Boss Donjons, Monstres, Boss Ocre
 */
export async function getBestiaireCatalog(): Promise<ActionResponse<BestiaireEntry[]>> {
    try {
        const dungeons = await db.dungeon.findMany({
            orderBy: { level: 'asc' },
            select: {
                id: true,
                slug: true,
                name: true,
                bossName: true,
                level: true,
                imageUrl: true,
                dofensiveUrl: true,
                dpnlUrl: true,
                dofuspourlesnoobsUrl: true,
                dofusdbId: true,
                dofensiveMonsterName: true,
                dofensiveDungeonName: true,
                isOcreQuest: true,
                isAnomalyBoss: true,
                anomalyFamily: true,
                isRaidBoss: true,
            }
        });

        const bossEntries: BestiaireEntry[] = dungeons
            .filter(d => d && (d.bossName || d.name))
            .map(d => ({
                id: d.id,
                slug: d.slug,
                name: d.name,
                bossName: d.bossName || d.name,
                level: d.level ?? 0,
                imageUrl: d.imageUrl ?? null,
                dofensiveUrl: d.dofensiveUrl ?? null,
                dpnlUrl: d.dpnlUrl ?? d.dofuspourlesnoobsUrl ?? null,
                dofusdbId: d.dofusdbId ?? null,
                dofensiveMonsterName: d.dofensiveMonsterName ?? null,
                dofensiveDungeonName: d.dofensiveDungeonName ?? null,
                isOcreQuest: !!d.isOcreQuest,
                // 🐉 Boss de raid & 🌀 Boss d'anomalie : catégories dédiées
                type: d.isRaidBoss ? ('raid' as const) : d.isAnomalyBoss ? ('anomalie' as const) : ('boss' as const),
            }));

        // Fail-soft : le seed référence des visuels `/game-data/...` qui n'existent
        // pas forcément sur ce checkout (siphonés ailleurs). Une URL morte = 404
        // DevTools + case vide côté UI → on la neutralise, la carte bascule sur
        // le proxy `/api/assets-dofus` (jamais de 404) ou son placeholder.
        for (const e of bossEntries) {
            if (e.imageUrl?.startsWith('/game-data/')) {
                try {
                    if (!fs.existsSync(path.join(process.cwd(), 'public', e.imageUrl))) {
                        e.imageUrl = null;
                    }
                } catch {
                    e.imageUrl = null;
                }
            }
        }

        // Onglet "Monstres" = TOUS les monstres des familles et salles de boss de donjons.
        // Lu en local depuis public/game-data/dungeon-monsters.json (0ms, 100% autonome, zéro dépendance DofusDB).
        const localData = getLocalDungeonMonstersData();
        let monsterEntries: BestiaireEntry[] = [];

        if (localData?.monsters?.length) {
            const seenNames = new Set<string>();
            monsterEntries = localData.monsters
                .filter((m: any) => {
                    const k = normStr(m.name);
                    if (!k || seenNames.has(k)) return false;
                    seenNames.add(k);
                    return true;
                })
                .map((m: any) => ({
                    id: `mob-${m.id}`,
                    name: m.raceName || "Famille",
                    bossName: m.name,
                    level: m.level || 0,
                    imageUrl: m.imageUrl || null,
                    dofensiveUrl: null,
                    dpnlUrl: null,
                    dofusdbId: m.id || null,
                    dofensiveMonsterName: m.name,
                    dofensiveDungeonName: null,
                    isOcreQuest: false,
                    type: 'monstre' as const,
                }));
        }

        // Onglet "Titans" (Événements Krosmiques) — boss Ankama référencé via dofusdbId (ex. 8062).
        let titanEntries: BestiaireEntry[] = [];
        try {
            const titans = await db.titan.findMany({ orderBy: { level: 'asc' } });
            titanEntries = titans.map((t) => ({
                id: t.id,
                slug: t.slug,
                name: t.zone || "Titan",
                bossName: t.name,
                level: t.level ?? 0,
                imageUrl: t.imageUrl ?? null,
                dofensiveUrl: t.dofensiveUrl ?? null,
                dpnlUrl: t.dpnlUrl ?? t.dofuspourlesnoobsUrl ?? null,
                dofusdbId: t.dofusdbId ?? null,
                dofensiveMonsterName: t.name,
                dofensiveDungeonName: t.mapName ?? null,
                isOcreQuest: false,
                type: 'titan' as const,
            }));
        } catch (e) {
            logger.error('[getBestiaireCatalog] Erreur chargement titans:', { error: String(e) });
        }

        // 🎯 Avis de recherche (chantier « Avis de recherche ») — contenu 100 % SIPHONNÉ : seules
        // les lignes marquées `isBountyMonster` sortent ici (les 51 lignes historiques de la table
        // `Bounty` — archimonstres/boss de la carte du monde — ne sont JAMAIS servies comme avis).
        let bountyEntries: BestiaireEntry[] = [];
        try {
            const bounties = await db.bounty.findMany({
                where: { isBountyMonster: true },
                orderBy: [{ level: 'asc' }, { name: 'asc' }],
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    level: true,
                    imageUrl: true,
                    zoneName: true,
                    dpnlUrl: true,
                    dofusdbId: true,
                },
            });
            bountyEntries = bounties.map((b) => buildBountyBestiaireEntry(b as any));
        } catch (e) {
            logger.error('[getBestiaireCatalog] Erreur chargement avis de recherche:', { error: String(e) });
        }

        return { success: true, data: [...bossEntries, ...monsterEntries, ...titanEntries, ...bountyEntries] };
    } catch (error) {
        logger.error('[getBestiaireCatalog] Error:', { error });
        return { success: false, error: 'Erreur lors du chargement du bestiaire' };
    }
}

/**
 * Familles des monstres du bestiaire local : **référentiel complet** (`monster-races.json`,
 * 264 races + 35 super-races) complété, en repli, par les libellés portés par
 * `dungeon-monsters.json`. Sert de libellé d'appoint dans les listes **et** de 2ᵉ niveau de
 * filtre (une race sans libellé connu n'est jamais proposée — aucun nom inventé).
 */
let monsterRaceLabelsCache: Map<number, LocalMonsterRace> | null = null;

interface LocalMonsterRace {
    name: string;
    superRaceId: number | null;
    superRaceName: string | null;
}

function localMonsterRaces(): Map<number, LocalMonsterRace> {
    if (monsterRaceLabelsCache) return monsterRaceLabelsCache;
    const races = new Map<number, LocalMonsterRace>();
    const superRaces = monsterSuperRaces();

    // 1. Référentiel officiel (races + super-races).
    for (const [id, race] of monsterRaces()) {
        races.set(id, {
            name: race.name,
            superRaceId: race.superRaceId,
            superRaceName: race.superRaceId ? (superRaces.get(race.superRaceId) ?? null) : null,
        });
    }

    // 2. Repli : les libellés déjà siphonnés dans `dungeon-monsters.json` (si le référentiel
    //    manque sur un environnement, on garde les 132 familles des donjons).
    try {
        for (const m of getLocalDungeonMonstersData()?.monsters ?? []) {
            const id = Math.floor(Number(m?.raceId) || 0);
            const label = String(m?.raceName ?? '').trim();
            if (id > 0 && label && !races.has(id)) {
                races.set(id, { name: label, superRaceId: null, superRaceName: null });
            }
        }
    } catch (e) {
        logger.warn('[localMonsterRaces] Familles locales de repli indisponibles:', { error: String(e) });
    }

    monsterRaceLabelsCache = races;
    return races;
}

/**
 * Construit les lignes du bestiaire local avec leur famille connue (`raceId` → libellé) et
 * leur drapeau « a déjà sa fiche » (exclusions lues en base, **source unique**
 * `@/server/game/normal-monster-scope`). Une seule préparation pour la liste, la recherche
 * et les facettes de familles.
 */
async function normalMonsterRows() {
    const [excluded, races] = await Promise.all([
        excludedNormalMonsterKeys(),
        Promise.resolve(localMonsterRaces()),
    ]);
    return listUnityMonsters()
        .filter((m) => m && m.id > 0 && m.name)
        .map((m) => {
            const raceId = Math.floor(Number(m.raceId) || 0);
            const race = races.get(raceId) ?? null;
            return {
                monsterId: m.id,
                name: m.name,
                raceId,
                raceName: race?.name ?? null,
                superRaceId: race?.superRaceId ?? null,
                superRaceName: race?.superRaceName ?? null,
                level: Math.floor(Number(m.grades?.[0]?.level) || 0),
                isBoss: excluded.has(slugifyBossName(m.name)),
            };
        });
}

/**
 * Liste / recherche des **monstres normaux** — hors boss de donjon (dont raid et anomalie),
 * avis de recherche et titans. Source : le **bestiaire local du client**
 * (`public/game-data/unity-bestiary.json`, 5 129 monstres, versionné), zéro réseau et zéro
 * appel tiers ; seules les exclusions viennent de la base.
 *
 * 🎯 Demande user (11/10/2026) : l'onglet « Monstres » du Bestiaire ne trouvait que les
 * 800 monstres référencés par les familles de donjons (`dungeon-monsters.json`) ⇒
 * « piou » ne rendait rien. Ici, TOUT le bestiaire est couvert, avec un **2ᵉ niveau de
 * filtre** par famille (`familyId`) — dont « Monstres de quête » et « Monstres de quête
 * d'alignement », les deux familles réelles les plus peuplées (2 274 et 341 monstres).
 */
export async function searchNormalMonsters(
    query = '',
    limit = 60,
    familyId: number | null = null
): Promise<ActionResponse<BestiaireEntry[]>> {
    try {
        const rows = await normalMonsterRows();
        return {
            success: true,
            data: searchNormalMonstersRule(rows, query, limit, familyId).map((m) => ({
                id: `mob-${m.monsterId}`,
                slug: slugifyBossName(m.name),
                name: m.raceName || 'Monstre',
                bossName: m.name,
                level: m.level,
                imageUrl: `/api/assets-dofus/monsters/${m.monsterId}`,
                dofensiveUrl: null,
                dpnlUrl: null,
                dofusdbId: m.monsterId,
                dofensiveMonsterName: m.name,
                dofensiveDungeonName: null,
                isOcreQuest: false,
                type: 'monstre' as const,
                familyName: m.raceName,
                raceId: m.raceId,
            })),
        };
    } catch (error) {
        logger.error('[searchNormalMonsters] Error:', { error });
        return { success: false, error: 'Erreur lors du chargement des monstres' };
    }
}

/**
 * Facettes du **2ᵉ niveau de filtre** : les familles réelles des monstres normaux, avec leur
 * poids (`count`) et un monstre représentatif dont le sprite officiel sert d'icône (proxy
 * d'assets, jamais un asset inventé). Aucune catégorie n'est fabriquée : les noms de famille
 * sont ceux de DofusDB (`raceId` → libellé).
 */
export async function getNormalMonsterFamilies(): Promise<ActionResponse<MonsterFamilyFacet[]>> {
    try {
        const rows = await normalMonsterRows();
        const normal = listNormalMonsters(rows);
        return { success: true, data: groupMonsterFamilies(normal) };
    } catch (error) {
        logger.error('[getNormalMonsterFamilies] Error:', { error });
        return { success: false, error: 'Erreur lors du chargement des familles' };
    }
}

/** Une fiche de monstre **documentée** (siphonnée) listée par le sommaire `/bestiaire`. */
export interface BestiaryHubMonster {
    slug: string;
    name: string;
    /** Niveau du premier palier (`0` = non renseigné par le bestiaire local). */
    level: number;
    monsterId: number;
}

/** Famille du sommaire : ses fiches documentées, sous leur libellé officiel DofusDB. */
export interface BestiaryHubFamily {
    raceId: number;
    /** Libellé officiel de la race (« Blops », « Monstres de quête »…) ; `null` = famille inconnue. */
    name: string | null;
    superRaceName: string | null;
    monsters: BestiaryHubMonster[];
}

export interface BestiaryHubResponse {
    /** Nombre de fiches **documentées** (contenu siphonné, indexables/sitemap). */
    documented: number;
    /** Nombre d'espèces réellement **listées** dans le sommaire (toutes les espèces normales). */
    listed: number;
    /** Taille du bestiaire local du client (5 129) — pour dire « N sur M » sans mentir. */
    bestiarySize: number;
    families: BestiaryHubFamily[];
    /** Vrai si le sommaire est tronqué (garde-fou : jamais des milliers de liens d'un coup). */
    truncated: boolean;
}

/**
 * Garde-fou du sommaire. Relevé le 12/10/2026 (Lot D) : le sommaire liste désormais **toutes**
 * les espèces normales, pas seulement les fiches siphonnées. La borne reste au-dessus de la
 * taille du bestiaire local (5 129) pour ne rien cacher en pratique, tout en protégeant d'un
 * bestiaire anormalement gonflé.
 */
const BESTIARY_HUB_MAX_LINKS = 6000;

/**
 * Sommaire du **bestiaire** (page publique `/bestiaire`) : **toutes** les espèces de monstres
 * normales, groupées par famille officielle.
 *
 * 🎯 Demande user (11/10/2026 puis 12/10/2026) : « un hub `/bestiaire` : familles + fiches
 * siphonnées listées en HTML » puis **« il manque un paquet de monstres, les types de créatures
 * sont jamais complets »**. Le sommaire ne listait que les **58** fiches siphonnées ⇒ chaque
 * famille affichait « 1 fiche » et le sommaire paraissait vide. Il liste maintenant **toutes**
 * les espèces normales (source : bestiaire local du client, 5 129), sous leur libellé de famille
 * complet (`monster-races.json`, 264 races + 35 super-races).
 *
 * L'indexation reste **bornée** : les fiches auto-générées (sans contenu siphonné) sont servies
 * en `noindex, follow` (voir `/bestiaire/[slug]`) ; seules les fiches **documentées** vont au
 * sitemap (`listSiphonedNormalMonsterSlugs`, même source). Boss / avis / titans sont écartés
 * (ils ont leur URL `/boss/<slug>`).
 */
export async function getBestiaryHub(): Promise<ActionResponse<BestiaryHubResponse>> {
    try {
        const [documentedSlugs, rows] = await Promise.all([
            listSiphonedNormalMonsterSlugs(),
            normalMonsterRows(),
        ]);
        const documented = new Set(documentedSlugs.map((row) => row.slug));
        const all = listNormalMonsters(rows);
        const byFamily = new Map<number, BestiaryHubFamily>();
        let listed = 0;
        let documentedCount = 0;
        for (const monster of all) {
            const slug = slugifyBossName(monster.name);
            if (!slug) continue;
            // Toutes les espèces sont listées ; `documented` ne sert qu'au compteur « documentées ».
            if (documented.has(slug)) documentedCount += 1;
            const raceId = Math.floor(Number(monster.raceId) || 0);
            let family = byFamily.get(raceId);
            if (!family) {
                family = {
                    raceId,
                    name: monster.raceName ?? null,
                    superRaceName: monster.superRaceName ?? null,
                    monsters: [],
                };
                byFamily.set(raceId, family);
            }
            family.monsters.push({
                slug,
                name: monster.name,
                level: monster.level,
                monsterId: monster.monsterId,
            });
            listed += 1;
        }

        // Familles les plus fournies d'abord (jamais de famille vide : `byFamily` ne se remplit
        // qu'avec des monstres réels).
        const families = [...byFamily.values()].sort(
            (a, b) =>
                b.monsters.length - a.monsters.length ||
                (a.name ?? "").localeCompare(b.name ?? "", "fr")
        );
        let budget = BESTIARY_HUB_MAX_LINKS;
        let truncated = false;
        for (const family of families) {
            family.monsters.sort((a, b) => a.name.localeCompare(b.name, "fr"));
            if (family.monsters.length > budget) {
                family.monsters = family.monsters.slice(0, budget);
                truncated = true;
            }
            budget -= family.monsters.length;
        }

        return {
            success: true,
            data: { documented: documentedCount, listed, bestiarySize: all.length, families, truncated },
        };
    } catch (error) {
        logger.error('[getBestiaryHub] Error:', { error });
        return { success: false, error: 'Erreur lors du chargement du bestiaire' };
    }
}

/** Segment d'URL de la fiche OFFICIELLE d'une créature (donjon → avis → titan), sinon `null`. */
async function officialFicheSegmentForName(name: string): Promise<string | null> {
    const insensitive = { equals: name, mode: 'insensitive' as const };
    const [dungeon, bounty, titan] = await Promise.all([
        db.dungeon.findFirst({ where: { OR: [{ name: insensitive }, { bossName: insensitive }] }, select: { slug: true, id: true } }),
        db.bounty.findFirst({ where: { name: insensitive }, select: { slug: true, id: true } }),
        db.titan.findFirst({ where: { name: insensitive }, select: { slug: true, id: true } }),
    ]);
    const found = dungeon ?? bounty ?? titan;
    return found ? (found.slug || found.id) : null;
}

export interface MonsterFicheResponse {
    monsterId: number;
    name: string;
    source: MonsterFicheSource;
    /** Payload de fiche (grades, sorts, butin, encyclopédie, passif). */
    data: any;
    /** Fiche officielle DÉJÀ publiée (boss / avis / titan) ⇒ l'appelant y renvoie. */
    officialSegment: string | null;
}

/**
 * Fiche d'un monstre par **segment d'URL** (`/bestiaire/<slug>` ou son id Ankama).
 * Lecture **locale** uniquement (siphon puis bestiaire du client) : aucune source tiers
 * n'est appelée au rendu d'une page publique. `officialSegment` non nul ⇒ on redirige vers
 * la fiche officielle (jamais deux pages pour la même bête).
 */
export async function getMonsterFicheBySegment(segment: string): Promise<ActionResponse<MonsterFicheResponse>> {
    try {
        const key = decodeURIComponent(String(segment ?? '')).trim();
        if (!key) return { success: false, error: 'Monstre introuvable' };
        const fiche = await getLocalMonsterFiche(key);
        if (!fiche) return { success: false, error: 'Monstre introuvable' };
        return {
            success: true,
            data: { ...fiche, officialSegment: await officialFicheSegmentForName(fiche.name) },
        };
    } catch (error) {
        logger.error('[getMonsterFicheBySegment] Error:', { error });
        return { success: false, error: 'Erreur lors du chargement de la fiche' };
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
    subAreaId?: number; // Réservé pour usage futur (mapId lookup)
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
    archisWithZone: number;
    matches: { zoneName: string; familyName: string }[];
    /** Zones dont le nom correspond à une zone d'archimonstre (mesure « à jour ou non »). */
    matchedZones: number;
    /** Parmi elles, celles qui n'avaient **rien** à ajouter (déjà liées). */
    alreadyUpToDate: number;
}>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Non autorisé' };

    try {
        const norm = (s: string | null | undefined) =>
            (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

        const zones = await db.zone.findMany({
            select: { id: true, name: true, families: { select: { id: true } } },
            orderBy: { name: 'asc' },
        });

        const allArchis = await db.archimonstre.findMany({
            where: { OR: [{ zone: { not: null } }, { subzone: { not: null } }] },
            select: { zone: true, subzone: true, name: true },
        });

        // Index zone (normalisée) → monstres / archis présents
        const monstersByZone = new Map<string, string[]>();
        for (const a of allArchis) {
            for (const zoneName of [a.zone, a.subzone]) {
                if (!zoneName) continue;
                const key = norm(zoneName);
                const list = monstersByZone.get(key) ?? [];
                if (!list.includes(a.name)) list.push(a.name);
                monstersByZone.set(key, list);
            }
        }

        const archisWithZone = allArchis.length;

        // Précharge les familles
        const allFamilies = await db.monsterFamily.findMany({
            select: { id: true, name: true, monsters: { select: { id: true, name: true } } }
        });

        const familyByMonsterName = new Map<string, string>();
        const familyByName = new Map<string, string>();

        for (const f of allFamilies) {
            familyByName.set(norm(f.name), f.id);
            for (const m of f.monsters) {
                if (!familyByMonsterName.has(m.name)) familyByMonsterName.set(m.name, f.id);
            }
        }

        let familiesLinked = 0;
        let matchedZones = 0;
        let alreadyUpToDate = 0;
        const matches: { zoneName: string; familyName: string }[] = [];

        for (const zone of zones) {
            const zNorm = norm(zone.name);
            const monsterNames = monstersByZone.get(zNorm) ?? [];
            const linkedIds = new Set(zone.families.map(f => f.id));
            const familyIdsToLink = new Set<string>();
            // « Matchée » = son nom correspond à une zone d'archi (par nom de monstre) OU
            // contient un nom de famille. C'est CE compteur qui dit si le bouton est à jour.
            let matched = monsterNames.length > 0;

            // 1. Correspondance directe par nom de famille contenue dans la zone (ex: "Porkass" dans "Plaine des Porkass")
            for (const [fNorm, fId] of familyByName.entries()) {
                if (fNorm.length >= 4 && (zNorm.includes(fNorm) || fNorm.includes(zNorm))) {
                    matched = true;
                    if (!linkedIds.has(fId)) familyIdsToLink.add(fId);
                }
            }

            // 2. Correspondance par les monstres de la zone
            for (const name of monsterNames) {
                const fid = familyByMonsterName.get(name);
                if (fid && !linkedIds.has(fid)) familyIdsToLink.add(fid);
            }

            if (matched) {
                matchedZones++;
                if (familyIdsToLink.size === 0) alreadyUpToDate++;
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

        logger.info(
            `[autoAssociateAllZoneFamilies] ${matches.length} famille(s) liée(s) · ${matchedZones} zone(s) matchée(s) (${alreadyUpToDate} déjà à jour) sur ${zones.length}`,
        );
        return {
            success: true,
            data: { zonesScanned: zones.length, familiesLinked, archisWithZone, matches, matchedZones, alreadyUpToDate },
        };
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
export async function getZoneMonsters(zoneName: string, subAreaId?: number): Promise<ActionResponse<{
    zoneName: string;
    normalMonsters: any[];
    avisDeRecherche: any[];
    families: any[];
}>> {
    try {
        const norm = (s: string | null | undefined) =>
            (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const cleanArticle = (s: string) =>
            norm(s).replace(/^(le|la|les|l')\s+/, '').trim();

        const zNorm = norm(zoneName);
        const zClean = cleanArticle(zoneName);

        // ⓪ SOURCE SOUVERAINE (12/10/2026) : la sous-zone RÉELLE de la carte du monde.
        // `subarea-monsters.json` (siphon DofusDB `monsters[].subareas`, 445 sous-zones,
        // versionné) dit exactement quels monstres peuplent la sous-zone ⇒ plus aucune
        // résolution par nom (donc plus aucun faux positif « nom ressemblant ») et aucune
        // dépendance à la base : les familles viennent des référentiels locaux.
        if (subAreaId) {
            const { families: subFamilies, monsters: subMonsters } = buildSubareaFamilies(subAreaId);
            if (subMonsters.length > 0) {
                return {
                    success: true,
                    data: {
                        zoneName: zoneName || `Sous-zone ${subAreaId}`,
                        normalMonsters: subMonsters.map((m) => ({
                            id: m.id,
                            name: m.name,
                            imageUrl: m.imageUrl,
                            level: m.level,
                            familyName: m.raceName,
                            raceId: m.raceId,
                            // Aucune fiche lue en base : `monsterFicheHref` retombe alors sur
                            // `/bestiaire/<slug>` (LA fiche du monstre) — jamais d'URL inventée.
                            ficheSlug: null,
                            ficheKind: null,
                        })),
                        avisDeRecherche: [],
                        families: subFamilies.map((f) => ({
                            id: `subarea:${subAreaId}:${f.raceId}`,
                            name: f.name,
                            imageUrl: f.imageUrl,
                            level: f.level,
                            monstersCount: f.monsters.length,
                            superRaceName: f.superRaceName,
                        })),
                    },
                };
            }
        }

        // 1. Recherche par match EXACT de la zone (insensible casse et accents)
        // Évite le piège du 'contains' aveugle (ex: "Cimetière" qui résolvait "Cimetière des Torturés" !)
        let zone = await db.zone.findFirst({
            where: { name: { equals: zoneName, mode: 'insensitive' } },
            include: {
                families: {
                    include: {
                        monsters: true
                    }
                }
            }
        });

        // 2. Si pas trouvé par equals strict SQL, recherche parmi toutes les zones par équivalence normalisée ou sans article
        if (!zone) {
            const allZones = await db.zone.findMany({
                include: {
                    families: {
                        include: {
                            monsters: true
                        }
                    }
                }
            });

            // A. Match strict normalisé
            zone = allZones.find(z => norm(z.name) === zNorm) ?? null;

            // B. Match sans article (ex: "La Bourgade" <-> "Bourgade", "Le Cimetière" <-> "Cimetière")
            if (!zone) {
                zone = allZones.find(z => cleanArticle(z.name) === zClean) ?? null;
            }

            // C. Match de sous-zone explicite avec le meilleur recouvrement (plus petite différence de longueur)
            if (!zone) {
                const candidates = allZones.filter(z => {
                    const zNameNorm = norm(z.name);
                    return zNameNorm.includes(zNorm) || zNorm.includes(zNameNorm);
                });
                if (candidates.length > 0) {
                    // Trier par proximité de longueur pour éviter les faux positifs lointains
                    candidates.sort((a, b) => Math.abs(a.name.length - zoneName.length) - Math.abs(b.name.length - zoneName.length));
                    zone = candidates[0] ?? null;
                }
            }
        }

        const normalMonsters: any[] = [];
        const avisDeRecherche: any[] = [];
        const families: any[] = [];
        const seenFamilies = new Set<string>();
        const seenMonsters = new Set<string>();

        if (zone && zone.families.length > 0) {
            zone.families.forEach(family => {
                if (isIgnoredFamily(family.name)) return;
                const isAvis = family.name.toLowerCase().includes('avis de recherche');
                if (!isAvis && !seenFamilies.has(family.name)) {
                    seenFamilies.add(family.name);
                    families.push({
                        id: family.id,
                        name: family.name,
                        imageUrl: family.imageUrl,
                        level: family.level,
                        monstersCount: family.monsters.length
                    });
                }
                family.monsters.forEach(monster => {
                    if (isAvis) {
                        if (!seenMonsters.has(monster.name)) {
                            seenMonsters.add(monster.name);
                            avisDeRecherche.push(monster);
                        }
                    } else {
                        if (!seenMonsters.has(monster.name)) {
                            seenMonsters.add(monster.name);
                            normalMonsters.push({
                                ...monster,
                                familyName: family.name
                            });
                        }
                    }
                });
            });
        }

        // Si la zone n'a pas de familles liées (ou zone non déclarée dans Zone), auto-détection dynamique stricte
        // ATTENTION : Aucun faux positif ! Ne matcher que les familles dont le nom correspond
        // fidèlement à la zone (nom exact ou terminaison géographique spécifique)
        if (families.length === 0) {
            const candidateFamilies = await db.monsterFamily.findMany({
                include: { monsters: true }
            });

            for (const f of candidateFamilies) {
                if (isIgnoredFamily(f.name)) continue;
                const fNorm = norm(f.name);
                const isExact = fNorm === zNorm || cleanArticle(f.name) === zClean;

                // Match strict de sous-partie : le nom de zone mentionne explicitement la famille entière
                // ex: Zone "Plaine des Scarafeuilles" -> Famille "Scarafeuilles"
                // ex: Zone "Péninsule des gelées" -> Famille "Gelées"
                // On interdit le match si fNorm est trop court (< 5 lettres) pour éviter les faux positifs.
                const isGeographicSub = fNorm.length >= 5 && zNorm.endsWith(' ' + fNorm);

                if (isExact || isGeographicSub) {
                    if (!seenFamilies.has(f.name)) {
                        seenFamilies.add(f.name);
                        families.push({
                            id: f.id,
                            name: f.name,
                            imageUrl: f.imageUrl,
                            level: f.level,
                            monstersCount: f.monsters.length
                        });
                        f.monsters.forEach(m => {
                            if (!seenMonsters.has(m.name)) {
                                seenMonsters.add(m.name);
                                normalMonsters.push({ ...m, familyName: f.name });
                            }
                        });
                    }
                }
            }
        }

        // Fiche publiée de chaque monstre : on ne DEVINE jamais d'URL — un monstre n'a
        // de fiche que s'il est un **avis de recherche** (`Bounty`) ou le **boss d'un
        // donjon** (`Dungeon`). Les slugs sont lus en base et rapprochés par nom
        // normalisé (même clé que les familles) ⇒ « pas de fail » : un monstre sans
        // fiche publiée reste sans lien (aucun 404 fabriqué depuis son nom).
        if (normalMonsters.length > 0) {
            const [bountyRows, dungeonRows] = await Promise.all([
                db.bounty.findMany({ select: { name: true, slug: true } }),
                db.dungeon.findMany({ select: { bossName: true, slug: true } }),
            ]);
            const ficheByName = new Map<string, { slug: string; kind: 'boss' | 'bounty' }>();
            for (const d of dungeonRows) {
                if (d.slug && d.bossName) ficheByName.set(norm(d.bossName), { slug: d.slug, kind: 'boss' });
            }
            for (const b of bountyRows) {
                if (b.slug && b.name) ficheByName.set(norm(b.name), { slug: b.slug, kind: 'bounty' });
            }
            for (const monster of normalMonsters) {
                const fiche = ficheByName.get(norm(monster.name));
                monster.ficheSlug = fiche?.slug ?? null;
                monster.ficheKind = fiche?.kind ?? null;
            }
        }

        return {
            success: true,
            data: {
                zoneName: zone?.name || zoneName,
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

/**
 * Fetch bounties (Avis de recherche) for a specific zone — lecture **locale** (siphon).
 *
 * 🐛 Mesure du 27/09/2026 : cette action avait une 2ᵉ jambe (« enrichir l'image depuis DofusDB »)
 * qui interrogeait `monsters?typeId=23` — requête **morte** (`total: 0`, mesuré au `curl`) : elle
 * ne pouvait rien enrichir (`dofusDbMatch` restait toujours `undefined`) tout en coûtant un appel
 * réseau de 5 s dans un écran **public** (volet Worldmap). Supprimée : la ligne `Bounty` produite
 * par le siphon est la source de vérité, et l'image est publiée sous **une seule forme**, la forme
 * canonique du proxy d'assets (le chemin du cache disque `/uploads/assets-dofus/monsters/N.webp`
 * rend 404 ⇒ il n'est jamais publié, même règle que `buildBountyBestiaireEntry`).
 */
export async function getBountiesForZone(zoneName: string, subAreaId?: number): Promise<ActionResponse<any[]>> {
    try {
        const norm = (s: string | null | undefined) =>
            (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

        // ① SOURCE SOUVERAINE (12/10/2026) : l'appartenance d'un avis à une sous-zone est lue
        // dans le dataset `subarea-monsters.json` (races d'avis 32/90/127/147/156).
        //
        // 🐛 Cause racine du « Qil Bil dans Cimetière » : l'ancien filtre comparait des NOMS
        // avec un préfixe (`bNorm.startsWith(zNorm)`) ⇒ « cimetière » ⊂ « cimetière des
        // torturés » = faux positif. Comparer la sous-zone **réelle** supprime le problème par
        // construction (mesuré en base : Qil Bil → `subareaIds [61]`, Roub' Ignolles → `[6]`).
        if (subAreaId) {
            const avisRaceIds = new Set<number>(BOUNTY_RACE_IDS);
            const bestiary = getUnityBestiary();
            const candidates = subareaMonsterIds(subAreaId)
                .map((id) => bestiary[String(id)])
                .filter((m) => Boolean(m?.name) && avisRaceIds.has(Math.floor(Number(m?.raceId) || 0)));

            if (candidates.length === 0) return { success: true, data: [] };

            // La fiche (butin, mécanique, récompenses) vit en base : on y joint par
            // `dofusdbId` (clé de rattachement du siphon), jamais par le nom.
            const rows = await db.bounty.findMany({ where: { dofusdbId: { in: candidates.map((m) => m.id) } } });
            const byDofusDbId = new Map(rows.map((row) => [Math.floor(Number(row.dofusdbId) || 0), row]));

            return {
                success: true,
                data: candidates.map((monster) => {
                    const row = byDofusDbId.get(monster.id);
                    if (!row) {
                        // Avis réel de la zone sans fiche siphonnée : nom + sprite réels, pas de
                        // lien de fiche (`bountyId: null`) ⇒ l'UI n'ouvre rien, aucun 404.
                        return {
                            id: `subarea:${subAreaId}:${monster.id}`,
                            bountyId: null,
                            name: monster.name,
                            imageUrl: monsterSpriteUrl(monster.id),
                            level: 0,
                            subarea: null,
                            guideUrl: null,
                            doplons: 0,
                            rewardType: "Doplon",
                            rewards: [],
                            milice: null,
                            mechanics: null,
                        };
                    }
                    return {
                        id: row.id,
                        bountyId: row.id,
                        name: row.name,
                        imageUrl: normalizeDofusAssetStoredUrl("monsters", row.imageUrl, row.dofusdbId),
                        level: row.level,
                        subarea: row.zoneName,
                        guideUrl: row.dpnlUrl,
                        doplons: row.doplons,
                        rewardType: row.rewardType,
                        rewards: row.rewards,
                        milice: row.milice,
                        mechanics: row.mechanics,
                    };
                }),
            };
        }

        // ② Repli (aucune sous-zone fournie) : nom de zone **EXACT** sur les seuls avis
        // siphonnés (`isBountyMonster`) — jamais de préfixe, et les 83 lignes historiques
        // (archimonstres/boss) ne sont plus jamais servies comme avis.
        const zNorm = norm(zoneName);
        const localBounties = (await db.bounty.findMany({ where: { isBountyMonster: true } }))
            .filter((b) => Boolean(b.zoneName) && norm(b.zoneName) === zNorm);

        logger.debug(`[Bounties] Requested zone: "${zoneName}". Found local: ${localBounties.length}`);

        const merged = localBounties.map(b => ({
            id: b.id,
            bountyId: b.id,
            name: b.name,
            imageUrl: normalizeDofusAssetStoredUrl("monsters", b.imageUrl, b.dofusdbId),
            level: b.level,
            subarea: b.zoneName,
            guideUrl: b.dpnlUrl,
            doplons: b.doplons,
            rewardType: b.rewardType,
            rewards: b.rewards,
            milice: b.milice,
            mechanics: b.mechanics
        }));

        return { success: true, data: merged };
    } catch (error) {
        logger.error('[getBountiesForZone] Error:', { error });
        return { success: false, error: 'Erreur lors du chargement des avis de recherche' };
    }
}

/** Index `sous-zone → donjons` construit depuis `worldmap.json` (lu une fois par process). */
let dungeonLocationCache: { bySubAreaId: Map<number, { id: number; name: string; level: number }[]> } | null = null;

function loadDungeonLocationIndex() {
    if (dungeonLocationCache) return dungeonLocationCache;
    const bySubAreaId = new Map<number, { id: number; name: string; level: number }[]>();
    try {
        const filePath = path.join(process.cwd(), 'public', 'game-data', 'worldmap.json');
        if (fs.existsSync(filePath)) {
            const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            // La carte d'entrée d'un donjon porte sa sous-zone : c'est le seul lien RÉEL
            // entre un donjon et une zone (aucune recherche par nom, donc aucun faux positif).
            const subAreaByMapId = new Map<number, number>();
            for (const m of (raw.maps || [])) {
                const mapId = Math.floor(Number(m?.id) || 0);
                const subAreaId = Math.floor(Number(m?.subAreaId) || 0);
                if (mapId > 0 && subAreaId > 0) subAreaByMapId.set(mapId, subAreaId);
            }
            for (const dungeon of (raw.dungeons || [])) {
                const subAreaId = subAreaByMapId.get(Math.floor(Number(dungeon?.entranceMapId) || 0));
                if (!subAreaId) continue;
                const list = bySubAreaId.get(subAreaId) ?? [];
                list.push({
                    id: Math.floor(Number(dungeon?.id) || 0),
                    name: String(dungeon?.name ?? ''),
                    level: Math.floor(Number(dungeon?.optimalPlayerLevel) || 0),
                });
                bySubAreaId.set(subAreaId, list);
            }
        }
    } catch (error) {
        logger.error('[loadDungeonLocationIndex] worldmap.json error:', { error });
    }
    dungeonLocationCache = { bySubAreaId };
    return dungeonLocationCache;
}

/**
 * Donjons **réellement situés** dans une sous-zone de la carte du monde.
 *
 * 🎯 Demande user (12/10/2026) : « une map analysée, si elle est dans la zone d'un donjon,
 * on affiche bien “1 donjon” ou plusieurs si y en a plusieurs avec le nom et l'icône du dj ».
 *
 * 🐛 Mesure : l'ancien code appelait `searchDungeonsAdvanced({ query: zoneName })` — une
 * recherche **floue par nom**, pas les donjons de la zone. La vérité est dans `worldmap.json`
 * (`dungeons[].entranceMapId` → `maps[].subAreaId`, mesuré : 190 donjons sur 191 résolvent,
 * 128 sous-zones portent au moins un donjon). Le nom et le boss viennent de
 * `dungeon-monsters.json` (souverain, aucun appel réseau).
 */
export async function getDungeonsForSubArea(subAreaId?: number): Promise<ActionResponse<Array<{
    id: number;
    name: string;
    level: number;
    bossName: string | null;
    imageUrl: string | null;
}>>> {
    try {
        const id = Math.floor(Number(subAreaId) || 0);
        if (id <= 0) return { success: true, data: [] };

        const entries = loadDungeonLocationIndex().bySubAreaId.get(id) ?? [];
        if (entries.length === 0) return { success: true, data: [] };

        const localData = getLocalDungeonMonstersData();
        const byCleanName = new Map<string, any>();
        for (const dungeon of (localData?.dungeons ?? [])) {
            const key = String(dungeon?.cleanName ?? '');
            if (key) byCleanName.set(key, dungeon);
        }
        const clean = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

        return {
            success: true,
            data: entries.map((entry) => {
                const local = byCleanName.get(clean(entry.name));
                const boss = Array.isArray(local?.bosses) ? local.bosses[0] : null;
                return {
                    id: entry.id,
                    name: entry.name,
                    level: entry.level,
                    bossName: boss?.name ?? null,
                    imageUrl: boss?.imageUrl ?? null,
                };
            }),
        };
    } catch (error) {
        logger.error('[getDungeonsForSubArea] Error:', { error });
        return { success: false, error: 'Erreur lors du chargement des donjons de la zone' };
    }
}

// Cache court pour la famille (race DofusDB) d'un boss — 24 h.
const dungeonFamilyCache = new Map<string, { data: any; expiresAt: number }>();
const DUNGEON_FAMILY_TTL = 24 * 60 * 60 * 1000;

/**
 * ENVELOPPE — le CŒUR de la fiche monstre vit dans `src/lib/monster-stats-core.ts` (A1, 28/09/2026).
 * Cause racine mesurée du `ENOENT: /browser/default-stylesheet.css` des datasets d'arrière-plan :
 * les siphons `src/lib/{anomaly-boss,bounty}-siphon.ts` importaient cette action pour appeler
 * `getMonsterStats` ⇒ `@/lib/security` → `isomorphic-dompurify` → jsdom embarqué dans le bundle
 * worker, dont le `path.resolve(__dirname, …)` ne tombe plus juste une fois déployé en `/app/`.
 * Ici : délégation pure — nom, signature et chemin d'action INCHANGÉS (contrat des composants).
 */
export async function getMonsterStats(
    monsterName: string,
    dungeonName?: string,
    forceRefresh = false,
    monsterId?: number,
    locale: "fr" | "en" = "fr"
): Promise<ActionResponse<any>> {
    return getMonsterStatsCore(monsterName, dungeonName, forceRefresh, monsterId, locale);
}

/**
 * getDungeonMonsters — Récupère la famille (race DofusDB) du boss d'un donjon + les monstres associés.
 * Zéro saisie manuelle : tout est dérivé de `bossName` via l'API DofusDB (cache 24 h).
 * La liste renvoyée sert à afficher les « monstres de la salle » (accompagnateurs) dans la fiche boss.
 */
export async function getDungeonMonsters(
    bossName: string,
    dungeonName?: string
): Promise<ActionResponse<{ familyId: number | null; monsters: { id: number; name: string; imageUrl: string | null; isBoss: boolean }[] }>> {
    const cacheKey = `${bossName.trim().toLowerCase()}::${(dungeonName ?? "").toLowerCase()}`;
    const cached = dungeonFamilyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return { success: true, data: cached.data };
    }

    const localData = getLocalDungeonMonstersData();
    if (localData) {
        const bNorm = normStr(bossName);
        const dNorm = dungeonName ? normStr(dungeonName.replace(/\s*\(\d+\)$/, "")) : "";

        // 1. Recherche par correspondance donjon
        let matchedDungeon = localData.dungeons.find((d: any) => {
            if (dNorm && (d.cleanName === dNorm || d.cleanName.includes(dNorm) || dNorm.includes(d.cleanName))) {
                return true;
            }
            if (bNorm && d.bosses?.some((b: any) => normStr(b.name) === bNorm)) {
                return true;
            }
            return false;
        });

        if (!matchedDungeon && bNorm) {
            // Chercher par présence dans les monstres du donjon
            matchedDungeon = localData.dungeons.find((d: any) =>
                d.monsters?.some((m: any) => normStr(m.name) === bNorm)
            );
        }

        if (matchedDungeon) {
            // Fusionner les monstres du donjon et de la famille pour une complétude totale
            const mapById = new Map<number, { id: number; name: string; imageUrl: string | null; isBoss: boolean }>();

            // Priorité aux monstres du donjon (salles réelles)
            (matchedDungeon.monsters || []).forEach((m: any) => {
                mapById.set(m.id, {
                    id: m.id,
                    name: m.name,
                    imageUrl: m.imageUrl || null,
                    isBoss: !!m.isBoss,
                });
            });

            // Ajouter également les monstres de la famille si absents
            (matchedDungeon.familyMonsters || []).forEach((m: any) => {
                if (!mapById.has(m.id)) {
                    mapById.set(m.id, {
                        id: m.id,
                        name: m.name,
                        imageUrl: m.imageUrl || null,
                        isBoss: !!m.isBoss,
                    });
                }
            });

            const monsters = Array.from(mapById.values());
            if (monsters.length > 0) {
                const result = { familyId: matchedDungeon.raceId ?? null, monsters };
                dungeonFamilyCache.set(cacheKey, { data: result, expiresAt: Date.now() + DUNGEON_FAMILY_TTL });
                return { success: true, data: result };
            }
        }

        // 2. Recherche par monstre isolé dans localData.monsters
        if (bNorm) {
            const mob = localData.monsters.find((m: any) => normStr(m.name) === bNorm);
            if (mob?.raceId) {
                const famMobs = localData.monsters
                    .filter((m: any) => m.raceId === mob.raceId)
                    .map((m: any) => ({
                        id: m.id,
                        name: m.name,
                        imageUrl: m.imageUrl || null,
                        isBoss: !!m.isBoss,
                    }));
                if (famMobs.length > 0) {
                    const result = { familyId: mob.raceId, monsters: famMobs };
                    dungeonFamilyCache.set(cacheKey, { data: result, expiresAt: Date.now() + DUNGEON_FAMILY_TTL });
                    return { success: true, data: result };
                }
            }
        }
    }

    try {
        const searchRes = await dofusDbFetch(
            `https://api.dofusdb.fr/monsters?name.fr=${encodeURIComponent(bossName.trim())}&lang=fr&$limit=5`,
            dofusdbFicheInit()
        );
        if (!searchRes.ok) throw new Error('DofusDB search failed');
        const searchData = await searchRes.json();
        const bossHeader = searchData.data?.find((m: any) => m.name?.fr?.toLowerCase() === bossName.toLowerCase().trim()) || searchData.data?.[0];
        const race = bossHeader?.race ?? null;
        if (race) {
            const familyRes = await dofusDbFetch(
                `https://api.dofusdb.fr/monsters?race=${race}&lang=fr&$limit=50`,
                dofusdbFicheInit()
            );
            if (familyRes.ok) {
                const familyData = await familyRes.json();
                const monsters = (familyData.data || []).map((m: any) => ({
                    id: m.id,
                    name: m.name?.fr || 'Monstre',
                    imageUrl: m.img || null,
                    isBoss: !!m.isBoss,
                }));
                if (monsters.length > 0) {
                    const result = { familyId: race, monsters };
                    dungeonFamilyCache.set(cacheKey, { data: result, expiresAt: Date.now() + DUNGEON_FAMILY_TTL });
                    return { success: true, data: result };
                }
            }
        }

        // Fallback 1: via DofusDB Dungeons API si dungeonName fourni
        if (dungeonName && dungeonName.trim()) {
            try {
                const cleanDungeonQuery = dungeonName.replace(/\s*\(\d+\)$/, "").trim();
                const djRes = await dofusDbFetch(
                    `https://api.dofusdb.fr/dungeons?name.fr=${encodeURIComponent(cleanDungeonQuery)}&lang=fr&$limit=5`,
                    dofusdbFicheInit()
                );
                if (djRes.ok) {
                    const djData = await djRes.json();
                    const dj = djData.data?.[0];
                    if (dj && Array.isArray(dj.monsters) && dj.monsters.length > 0) {
                        const mobList: { id: number; name: string; imageUrl: string | null; isBoss: boolean }[] = [];
                        for (const mobId of dj.monsters) {
                            try {
                                const mRes = await dofusDbFetch(`https://api.dofusdb.fr/monsters/${mobId}?lang=fr`, dofusdbFicheInit());
                                if (mRes.ok) {
                                    const m = await mRes.json();
                                    mobList.push({
                                        id: m.id,
                                        name: m.name?.fr || 'Monstre',
                                        imageUrl: m.img || null,
                                        isBoss: !!m.isBoss,
                                    });
                                }
                            } catch {}
                        }
                        if (mobList.length > 0) {
                            const result = { familyId: null, monsters: mobList };
                            dungeonFamilyCache.set(cacheKey, { data: result, expiresAt: Date.now() + DUNGEON_FAMILY_TTL });
                            return { success: true, data: result };
                        }
                    }
                }
            } catch {}
        }

        // Fallback 2: via Dofensive preview
        if (dungeonName && dungeonName.trim()) {
            try {
                const dofDungeon = await getDofensiveDungeonForBoss(bossName, dungeonName);
                if (dofDungeon.success && dofDungeon.data?.monsters?.length) {
                    const monsters = dofDungeon.data.monsters.map((m, idx) => ({
                        id: m.id,
                        name: m.name,
                        imageUrl: null,
                        isBoss: idx === 0 || dofDungeon.data?.bossMonsterId === m.id,
                    }));
                    const result = { familyId: null, monsters };
                    dungeonFamilyCache.set(cacheKey, { data: result, expiresAt: Date.now() + DUNGEON_FAMILY_TTL });
                    return { success: true, data: result };
                }
            } catch {}
        }

        return { success: true, data: { familyId: null, monsters: [] } };
    } catch (error) {
        logger.error('[getDungeonMonsters] Error:', { error });
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
    if (!(await canAccessGameData())) return { success: false, error: 'Non autorisé' };

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

/**
 * Fetch quests from the Dofus module that are linked to a specific zone/subarea */
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
                // Slug public `/boss/<slug>` (nom du boss, suffixé si déjà pris).
                slug: await resolveUniqueDungeonSlug(data.bossName.trim()),
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

/**
 * Sous-zones d'une cible dont la **zone est nommée** : correspondance exacte sur
 * le nom de la sous-zone, sinon correspondance partielle (le nom saisi peut être
 * plus long ou plus court que celui de `worldmap.json`).
 */
function matchZoneSubAreaIds(
    zoneName: string | null,
    subareas: any[],
    normalize: (s: string) => string
): number[] {
    if (!zoneName || subareas.length === 0) return [];
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
    return matching.map(sa => sa.id);
}

/**
 * Position d'une cible à partir de ses sous-zones : **une seule règle** pour
 * tout le dépôt (`resolveSubAreaCenter` — centroïde du tracé officiel, repli sur
 * la première map positionnée, jamais le tas (0, 0) de `worldmap.json`).
 * Aucune sous-zone exploitable → aucun centre (jamais (0, 0) « par défaut »).
 */
function centerFromSubAreaIds(
    subAreaIds: number[],
    subareas: any[],
    mapsBySubAreaId: Map<number, any[]>
): { centerX: number | null; centerY: number | null; worldMapId: number } {
    const center = resolveSubAreaCenter(subAreaIds, subareas, mapsBySubAreaId);
    return center
        ? { centerX: center.x, centerY: center.y, worldMapId: center.worldId }
        : { centerX: null, centerY: null, worldMapId: 1 };
}

/**
 * Centre **stocké** d'une cible (colonne `centerX`/`centerY`) : le couple (0, 0)
 * y est le sentinelle « position inconnue » (507 lignes `Archimonstre` en base)
 * — il est recalculé depuis les sous-zones au lieu d'être publié tel quel.
 */
function readStoredCenter(
    centerX: number | null,
    centerY: number | null,
    worldMapId: number,
    subAreaIds: number[],
    subareas: any[],
    mapsBySubAreaId: Map<number, any[]>
): { centerX: number | null; centerY: number | null; worldMapId: number } {
    if (centerX !== 0 || centerY !== 0) return { centerX, centerY, worldMapId };
    return centerFromSubAreaIds(subAreaIds, subareas, mapsBySubAreaId);
}

/**
 * Zones **réelles** d'un monstre (donnée souveraine `subarea-monsters.json`) : chaque
 * sous-zone est nommée par `worldmap.json` et porte son centre calculé.
 *
 * 🎯 Demande user (12/10/2026) : « un archi a parfois plusieurs zones disponibles, il faut
 * afficher chaque zone dispo en dropdown ». La liste vient du **jeu** (les `subareas`
 * DofusDB d'un monstre), pas d'une supposition : un archimonstre EST un monstre (race 78).
 */
function monsterZoneEntries(
    monsterId: number | null | undefined,
    fallbackSubAreaIds?: number[] | null
): Array<{ subAreaId: number; name: string; centerX: number | null; centerY: number | null; worldMapId: number }> {
    const ids = subareaIdsForMonster(monsterId);
    const list = ids.length > 0 ? ids : (Array.isArray(fallbackSubAreaIds) ? fallbackSubAreaIds : []);
    if (list.length === 0) return [];

    const { subareas, mapsBySubAreaId } = loadWorldmapIndex();
    const byId = new Map<number, any>();
    for (const sub of subareas) byId.set(Math.floor(Number(sub?.id) || 0), sub);

    return list.map((subAreaId) => {
        const sub = byId.get(subAreaId);
        const rawName = sub?.name?.fr ?? (typeof sub?.name === 'string' ? sub.name : null);
        return {
            subAreaId,
            name: String(rawName ?? `Sous-zone ${subAreaId}`),
            ...centerFromSubAreaIds([subAreaId], subareas, mapsBySubAreaId),
        };
    });
}

/** Shared: resolve subAreaIds + center coords + worldMapId from a zone name against worldmap.json */
function resolveZoneInWorldmap(
    zoneName: string | null,
    subareas: any[],
    mapsBySubAreaId: Map<number, any[]>,
    normalize: (s: string) => string
): { subAreaIds: number[]; centerX: number | null; centerY: number | null; worldMapId: number } {
    const subAreaIds = matchZoneSubAreaIds(zoneName, subareas, normalize);
    return { subAreaIds, ...centerFromSubAreaIds(subAreaIds, subareas, mapsBySubAreaId) };
}

/** Index `worldmap.json` (sous-zones + maps groupées par sous-zone) — lu une fois par process. */
let worldmapIndexCache: { subareas: any[]; mapsBySubAreaId: Map<number, any[]> } | null = null;

function loadWorldmapIndex(): { subareas: any[]; mapsBySubAreaId: Map<number, any[]> } {
    if (worldmapIndexCache) return worldmapIndexCache;

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
    } catch (error) {
        logger.error('[loadWorldmapIndex] worldmap.json error:', { error });
    }

    worldmapIndexCache = { subareas, mapsBySubAreaId };
    return worldmapIndexCache;
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

        // ── 1. Index worldmap.json (zones des avis + fallback), mis en cache ──
        const { subareas, mapsBySubAreaId } = loadWorldmapIndex();

        // ── 2. Archimonstre table (LOCAL-FIRST, filtrée par type/isOcre) ──
        const archiRows = await db.archimonstre.findMany({
            where: buildLocalWhere(),
            take: 10,
            orderBy: { name: 'asc' },
        });

        const archiResults = archiRows.map(a => {
            const subAreaIds = Array.isArray(a.subareaIds) ? (a.subareaIds as number[]) : [];
            return {
                id: a.id,
                name: a.name,
                type: a.type,
                isOcre: a.isOcre,
                imageUrl: a.imageUrl,
                level: a.level,
                zoneName: a.zone,
                source: 'local' as const,
                subAreaIds,
                dofusdbId: a.dofusdbId ?? null,
                // Toutes les zones RÉELLES de la cible (dataset souverain) : le menu
                // déroulant du volet Archimonstres s'en sert pour proposer chaque zone.
                zones: monsterZoneEntries(a.dofusdbId, subAreaIds),
                ...readStoredCenter(a.centerX, a.centerY, a.worldMapId, subAreaIds, subareas, mapsBySubAreaId),
            };
        });

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
                // Le filtre "boss" interroge le drapeau `isBoss` de DofusDB.
                // 🐛 Mesure du 27/09/2026 : ce filtre posait `typeId=23` — requête **morte**
                // (`monsters?typeId=23` → `total: 0`) ⇒ la recherche « boss » du volet Worldmap ne
                // remontait **jamais** rien par le fallback DofusDB. Vérifié : `isBoss=true` renvoie
                // bien la cible attendue (`name.fr=(?i)qilby` → 1 entité, 0 avec `typeId=23`).
                const bossOnly = filter === 'boss' ? `&isBoss=true` : '';
                const url = `https://api.dofusdb.fr/monsters?lang=fr&name.fr[$regex]=${encodedQuery}${bossOnly}&$limit=10`;
                const resp = await dofusDbFetch(url, {
                    headers: { 'Accept': 'application/json' },
                    cache: 'no-store',
                    signal: AbortSignal.timeout(8_000),
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
                        ({ centerX, centerY, worldMapId } = centerFromSubAreaIds(rawSubareaIds, subareas, mapsBySubAreaId));
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

        // ⚠️ Le sentinelle (0, 0) est stocké en base (507 lignes mesurées) : il est
        // recalculé depuis les sous-zones, jamais publié tel quel.
        const { subareas, mapsBySubAreaId } = loadWorldmapIndex();

        const results = rows.map(a => {
            const subAreaIds = Array.isArray(a.subareaIds) ? (a.subareaIds as number[]) : [];
            return {
                id: a.id,
                name: a.name,
                type: a.type,
                isOcre: a.isOcre,
                imageUrl: a.imageUrl,
                level: a.level,
                zoneName: a.zone,
                source: 'local' as const,
                subAreaIds,
                dofusdbId: a.dofusdbId ?? null,
                // Toutes les zones RÉELLES de la cible : un archimonstre apparaît souvent dans
                // plusieurs sous-zones, et le volet doit pouvoir proposer chacune d'elles.
                zones: monsterZoneEntries(a.dofusdbId, subAreaIds),
                ...readStoredCenter(a.centerX, a.centerY, a.worldMapId, subAreaIds, subareas, mapsBySubAreaId),
            };
        });

        return { success: true, data: results };
    } catch (error) {
        logger.error('[getArchimonstresByFilter] Error:', { error });
        return { success: false, error: 'Erreur chargement filtre' };
    }
}

/**
 * Avis de recherche du panneau « Avis » de la carte du monde (public + interne) :
 * nom, visuel, niveau, zone de traque et **zone résolue** (les `subareaIds`
 * stockés en base font foi ; repli sur la résolution du nom contre
 * `worldmap.json`). LOCAL-ONLY, zéro réseau. `query` vide = toute la liste.
 */
export async function getBountiesForMap(query?: string): Promise<ActionResponse<Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    level: number;
    zoneName: string | null;
    subAreaIds: number[];
    centerX: number | null;
    centerY: number | null;
    worldMapId: number;
    dpnlUrl: string | null;
}>>> {
    const normalize = (s: string) =>
        s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    try {
        const term = String(query ?? '').trim();
        const rows = await db.bounty.findMany({
            where: {
                isBountyMonster: true,
                ...(term.length >= 2 ? { name: { contains: term, mode: 'insensitive' as const } } : {}),
            },
            select: {
                id: true,
                name: true,
                imageUrl: true,
                dofusdbId: true,
                level: true,
                zoneName: true,
                subareaIds: true,
                dpnlUrl: true,
            },
            orderBy: { name: 'asc' },
            take: 200,
        });

        const { subareas, mapsBySubAreaId } = loadWorldmapIndex();

        const results = rows.map((b) => {
            const stored = (Array.isArray(b.subareaIds) ? b.subareaIds : [])
                .map((value: unknown) => Math.floor(Number(value)))
                .filter((id: number) => Number.isInteger(id) && id > 0);
            // Les sous-zones STOCKÉES font foi : le centre est calculé sur elles
            // (et non sur le nom), sinon la carte se recentrait ailleurs que sur
            // la zone encadrée — voire sur le tas (0, 0) de `worldmap.json`.
            const subAreaIds = stored.length > 0 ? stored : matchZoneSubAreaIds(b.zoneName, subareas, normalize);
            return {
                id: b.id,
                name: b.name,
                imageUrl: normalizeDofusAssetStoredUrl("monsters", b.imageUrl, b.dofusdbId),
                level: b.level,
                zoneName: b.zoneName,
                subAreaIds,
                ...centerFromSubAreaIds(subAreaIds, subareas, mapsBySubAreaId),
                dpnlUrl: b.dpnlUrl,
            };
        });

        return { success: true, data: results };
    } catch (error) {
        logger.error('[getBountiesForMap] Error:', { error });
        return { success: false, error: 'Erreur chargement des avis' };
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

// --- Libellés masqués de la carte du monde (God → Données de jeu → Éditeurs → Zones) ---
//
// 🐛 Mesure du 11/10/2026 : ces libellés sont dessinés depuis `worldmap.json` (fichier
// statique lu par le navigateur), **jamais** depuis la table `Zone` — les exclusions
// ci-dessus n'avaient donc aucun effet visible sur la carte (demande user : « je peux
// les modifier / en supprimer depuis God ? »). Ici le God écrit la liste que le
// renderer lit : le retrait est immédiat et **siphon-proof** (aucun script de siphon
// n'écrit ce fichier, et `deploy-cd.sh` le préserve).

/** Écrit la liste (crée le dossier au besoin). Un échec remonte à l'appelant, jamais muet. */
function writeHiddenMapZones(names: string[]): void {
    const dir = path.dirname(HIDDEN_MAP_ZONES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(HIDDEN_MAP_ZONES_PATH, JSON.stringify({
        names,
        updatedAt: new Date().toISOString()
    }, null, 2));
}

/**
 * Le nom correspond-il à un libellé **réellement dessiné** (sous-zone de `worldmap.json`) ?
 * Sans ce contrôle, un « masquer » sur un nom mal orthographié n'aurait aucun effet visible
 * et le God croirait l'avoir fait : `worldmap.json` est la seule source des libellés.
 */
function isDrawnZoneLabel(name: string): boolean {
    const key = zoneNameKey(name);
    if (!key) return false;
    return loadWorldmapIndex().subareas.some((subArea) => {
        const label = typeof subArea?.name === 'string' ? subArea.name : subArea?.name?.fr;
        return zoneNameKey(label) === key;
    });
}
export async function getHiddenMapZonesAction(): Promise<ActionResponse<string[]>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };
    return { success: true, data: getHiddenMapZones() };
}

/**
 * Masque un libellé de zone sur la carte du monde (le nom **tel qu'il s'affiche**).
 * Idempotent : la même zone (accents/casse ignorés) remplace son entrée précédente.
 * `matched` dit si le nom correspond à un libellé réellement dessiné (`worldmap.json`) —
 * un nom mal orthographié est accepté mais signalé, jamais validé en silence.
 */
export async function hideMapZoneLabelAction(name: string): Promise<ActionResponse<{ names: string[]; matched: boolean }>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: 'Accès refusé' };
    const limiter = await rateLimit(`god:hide-map-zone:${userId}`, 30, 60_000);
    if (!limiter.success) return { success: false, error: 'Trop de modifications — réessayez dans une minute' };

    const label = String(name ?? '').trim();
    if (!label) return { success: false, error: 'Nom de zone requis' };
    try {
        const key = zoneNameKey(label);
        const names = [...getHiddenMapZones().filter(n => zoneNameKey(n) !== key), label]
            .sort((a, b) => a.localeCompare(b));
        const matched = isDrawnZoneLabel(label);
        writeHiddenMapZones(names);
        await logGameDataWrite('hide-map-zone-label', label, { total: names.length, matched });
        return { success: true, data: { names, matched } };
    } catch (e) {
        logger.error('[hideMapZoneLabelAction] Error:', { error: e });
        return { success: false, error: 'Erreur lors du masquage du libellé' };
    }
}

/** Réaffiche un libellé masqué — retourne la liste restante. */
export async function restoreHiddenMapZoneAction(name: string): Promise<ActionResponse<string[]>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: 'Accès refusé' };
    const limiter = await rateLimit(`god:hide-map-zone:${userId}`, 30, 60_000);
    if (!limiter.success) return { success: false, error: 'Trop de modifications — réessayez dans une minute' };

    try {
        const key = zoneNameKey(name);
        const names = getHiddenMapZones().filter(n => zoneNameKey(n) !== key);
        writeHiddenMapZones(names);
        await logGameDataWrite('restore-map-zone-label', String(name ?? '').trim(), { total: names.length });
        return { success: true, data: names };
    } catch (e) {
        logger.error('[restoreHiddenMapZoneAction] Error:', { error: e });
        return { success: false, error: 'Erreur lors du réaffichage du libellé' };
    }
}

export async function clearHiddenMapZonesAction(): Promise<ActionResponse<string[]>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: 'Accès refusé' };
    const limiter = await rateLimit(`god:hide-map-zone:${userId}`, 30, 60_000);
    if (!limiter.success) return { success: false, error: 'Trop de modifications — réessayez dans une minute' };

    try {
        writeHiddenMapZones([]);
        await logGameDataWrite('clear-map-zone-labels');
        return { success: true, data: [] };
    } catch (e) {
        logger.error('[clearHiddenMapZonesAction] Error:', { error: e });
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
        const zoneRes = await dofusDbFetch(zoneUrl, { headers, signal: AbortSignal.timeout(30000) });
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
                    const resp = await dofusDbFetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });

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
                        select: { id: true, imageUrl: true, level: true, dofusdbId: true, zone: true, isOcre: true },
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

                    // 🔍 Journal (fiches éditoriales Ocre) : nouvelle fiche ou détail du changement.
                    await recordGameDataChanges('ANOMALY_BOSSES', [
                        {
                            entityType: 'archimonstre',
                            entityId: existingOcre?.id ?? `ocre:${dofusdbId}`,
                            entityName: monster.name,
                            changeType: existingOcre ? 'MODIFIED' : 'NEW',
                            fields: existingOcre
                                ? diffFields(
                                      existingOcre as unknown as Record<string, unknown>,
                                      {
                                          imageUrl,
                                          level,
                                          dofusdbId,
                                          zone: monster.zone || null,
                                          isOcre: true,
                                      },
                                      ['imageUrl', 'level', 'dofusdbId', 'zone', 'isOcre'],
                                  )
                                : null,
                        },
                    ]);
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
        const resp = await dofusDbFetch(url, {
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
            const res = await dofusDbFetch(`https://api.dofusdb.fr/monsters?$limit=50&$skip=${skip}&isBoss=true`, {
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

            // 🔍 Image **avant** (fiche éditoriale « boss ») : permet de journaliser *quoi* a changé.
            const previousBoss = await db.archimonstre
                .findFirst({
                    where: { name: nameFr, type: 'boss' },
                    select: { id: true, imageUrl: true, level: true, dofusdbId: true, zone: true, centerX: true, centerY: true },
                })
                .catch(() => null);

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

            // 🔍 Journal (dataset ANOMALY_BOSSES = fiches monstres/boss) : création ou détail du change.
            await recordGameDataChanges('ANOMALY_BOSSES', [
                {
                    entityType: 'boss',
                    entityId: previousBoss?.id ?? `boss:${b.id}`,
                    entityName: nameFr,
                    changeType: previousBoss ? 'MODIFIED' : 'NEW',
                    fields: previousBoss
                        ? diffFields(
                              previousBoss as unknown as Record<string, unknown>,
                              {
                                  imageUrl: b.img || null,
                                  level: b.grades?.[0]?.level ?? 0,
                                  dofusdbId: b.id,
                                  zone: zoneName,
                                  centerX,
                                  centerY,
                              },
                              ['imageUrl', 'level', 'dofusdbId', 'zone', 'centerX', 'centerY'],
                          )
                        : null,
                },
            ]);
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
                const res = await dofusDbFetch(ep.url, {
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
 * 🦎 Synchronisation des familles de monstres et de leurs créatures (DofusDB).
 * Le CŒUR vit dans `src/lib/monster-families-siphon.ts` : il est donc exécutable
 * par la file d'arrière-plan (fermer l'onglet ne perd plus la passe).
 */
export async function syncMonsterFamiliesFromDofusDb(): Promise<ActionResponse<{ synced: number; total: number; monstersSynced?: number }>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };

    try {
        const result = await syncMonsterFamiliesCore();
        await logGameDataWrite("sync-monster-families", `families-${result.synced}_monsters-${result.monstersSynced}`);
        return { success: true, data: result };
    } catch (e: any) {
        logger.error('[syncMonsterFamiliesFromDofusDb] Error:', { error: e });
        return { success: false, error: 'Erreur lors de la synchronisation des familles' };
    }
}

/**
 * 🗺️ Synchronisation des zones & sous-zones du Monde des Douze (DofusDB `/subareas` & `/areas`).
 * Le CŒUR vit dans `src/lib/zones-siphon.ts` (exécutable en arrière-plan).
 */
export async function syncZonesFromDofusDb(): Promise<ActionResponse<{ synced: number; total: number }>> {
    if (!(await canAccessGameData())) return { success: false, error: 'Accès refusé' };

    try {
        const result = await syncZonesFromDofusDbCore();
        await logGameDataWrite("sync-zones", `synced-${result.synced}`);
        return { success: true, data: result };
    } catch (e: any) {
        logger.error('[syncZonesFromDofusDb] Error:', { error: e });
        return { success: false, error: 'Erreur lors de la synchronisation des zones et sous-zones' };
    }
}
