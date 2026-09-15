"use server";

/**
 * Actions serveur « boss d'anomalie » (Gardiens des anomalies temporelles) — LECTURES.
 *
 * Elles ne contactent JAMAIS une API à l'exécution : tout vient du **siphon** local
 * (`MonsterStat.stats.anomaly` + `DofensiveMap`) avec un repli déterministe sur la
 * **map par défaut** (exigence produit : jamais de carte vide, même pour Qilby qui
 * n'est pas exposé par Dofensive).
 */
import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { DB_READABLE, getLocalDofensiveMap } from "@/lib/dofensive-sync";
import type { DofensiveDungeonInfo } from "@/server/actions/dofensive-actions";
import { ANOMALY_MAP_FALLBACK_LABEL, ANOMALY_RACE_ID, DEFAULT_ANOMALY_MAP, anomalyCompanionHint, buildAnomalyMonsterPool, type AnomalyMonsterRef } from "@/lib/anomaly-boss";

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

/**
 * Monstre d'un combat d'anomalie (co-gardien de la carte ou monstre de l'anomalie).
 * `isCompanion` = accompagnateur tiré au hasard (Briko/Bruto/Gromo) — jamais un gardien.
 */
export interface AnomalyFamilyMonster {
    id: number;
    name: string;
    imageUrl: string | null;
    isBoss: boolean;
    isCompanion?: boolean;
    level?: number | null;
    raceName?: string | null;
}

/** Charge la fiche locale (`MonsterStat`) d'un gardien par son nom (null si absente). */
async function loadAnomalyStat(monsterName: string): Promise<any | null> {
    if (!DB_READABLE) return null;
    const name = String(monsterName ?? "").trim();
    if (!name) return null;
    try {
        const row = await db.monsterStat.findFirst({
            where: { monsterName: { equals: name, mode: "insensitive" } },
            orderBy: { lastSyncedAt: "desc" },
        });
        return (row?.stats as any) ?? null;
    } catch (error) {
        logger.warn("[anomaly-boss-actions] loadAnomalyStat échec:", { error: String(error) });
        return null;
    }
}

/**
 * Carte de combat d'un gardien d'anomalie, au format `DofensiveDungeonInfo` (donc consommable
 * par la fiche boss et la simulation SANS code spécifique).
 *
 * Résolution : `Dungeon.anomalyMapId` (passé par la fiche) > `MonsterStat.anomaly.mapId` >
 * première `preferredMaps` siphonnée > **map par défaut**. `dungeonId` est un identifiant
 * synthétique NÉGATIF (jamais de collision avec un vrai donjon Dofensive).
 */
export async function getAnomalyBossBattleMap(
    monsterName: string,
    anomalyMapId?: number | null
): Promise<ActionResponse<DofensiveDungeonInfo>> {
    const name = String(monsterName ?? "").trim();
    if (!name) return { success: false, error: "Nom de gardien manquant" };

    try {
        const stats = await loadAnomalyStat(name);
        const anomaly: any = stats?.anomaly ?? null;
        const preferred: any[] = Array.isArray(stats?.preferredMaps) ? stats.preferredMaps : [];

        const candidate = Number(anomalyMapId) || Math.floor(Number(anomaly?.mapId) || 0)
            || Math.floor(Number(preferred[0]?.id) || 0);
        const mapId = Number.isFinite(candidate) && candidate > 0 ? Math.floor(candidate) : DEFAULT_ANOMALY_MAP.id;

        const localMap = await getLocalDofensiveMap(mapId);
        const mapName = localMap?.name
            || String(anomaly?.mapName ?? "")
            || String(preferred[0]?.name ?? "")
            || DEFAULT_ANOMALY_MAP.name
            || ANOMALY_MAP_FALLBACK_LABEL;

        const family: any[] = Array.isArray(anomaly?.family) ? anomaly.family : [];
        const monsters: { id: number; name: string }[] = family
            .map((f) => ({ id: Math.floor(Number(f?.id) || 0), name: String(f?.name ?? "").trim() }))
            .filter((m) => m.id > 0 && m.name.length > 0);

        // 🌀 Monstres de l'anomalie (accompagnateurs) : le combat est « 1 gardien + 3 d'entre eux »,
        // donc ils font partie du pool de la simulation au même titre que les co-gardiens.
        const companions: AnomalyMonsterRef[] = (Array.isArray(anomaly?.companions) ? anomaly.companions : [])
            .map((c: any) => ({
                id: Math.floor(Number(c?.id) || 0),
                name: String(c?.name ?? "").trim(),
                level: Number.isFinite(Number(c?.level)) ? Number(c.level) : null,
                isBoss: false,
                raceId: Number.isFinite(Number(c?.raceId)) ? Number(c.raceId) : null,
                raceName: c?.raceName ? String(c.raceName) : null,
            }))
            .filter((c: AnomalyMonsterRef) => c.id > 0 && c.name.length > 0);

        const selfId = Math.floor(Number(stats?.id) || 0);
        const selfName = String(stats?.name ?? name);
        const self = selfId > 0 ? { id: selfId, name: selfName } : null;

        return {
            success: true,
            data: {
                dungeonId: -mapId,
                dungeonName: mapName,
                maps: [{ id: mapId, name: mapName, isBoss: true }],
                monsters: buildAnomalyMonsterPool(monsters, companions, self).map((m) => ({ id: m.id, name: m.name })),
                bossMonsterId: selfId > 0 ? selfId : null,
            },
        };
    } catch (error) {
        logger.warn("[getAnomalyBossBattleMap] échec:", { error: String(error) });
        return { success: false, error: "Carte de combat indisponible" };
    }
}

/**
 * « Monstres de salle » d'une anomalie = les autres gardiens de la MÊME carte (siphonnés dans
 * `MonsterStat.anomaly.family`) **+ les monstres de l'anomalie** (accompagnateurs Briko/Bruto/
 * Gromo, `anomaly.companions` : 3 tirés au hasard à l'ouverture). Même format que
 * `getDungeonMonsters` pour un branchement direct dans la fiche boss.
 */
export async function getAnomalyBossFamily(monsterName: string): Promise<ActionResponse<{
    familyId: number | null;
    monsters: AnomalyFamilyMonster[];
    companions: AnomalyFamilyMonster[];
    companionHint: string | null;
}>> {
    const name = String(monsterName ?? "").trim();
    if (!name) return { success: false, error: "Nom de gardien manquant" };

    try {
        const stats = await loadAnomalyStat(name);
        const toMember = (m: any): AnomalyFamilyMonster => {
            const id = Math.floor(Number(m?.id) || 0);
            return {
                id,
                name: String(m?.name ?? "").trim(),
                // Le proxy local sert toujours 200 (siphon disque > DofusDB > placeholder).
                imageUrl: `/api/assets-dofus/monsters/${id}`,
                isBoss: !!m?.isBoss,
                level: Number.isFinite(Number(m?.level)) ? Number(m.level) : null,
                raceName: m?.raceName ? String(m.raceName) : null,
            };
        };

        const family: any[] = Array.isArray(stats?.anomaly?.family) ? stats.anomaly.family : [];
        const companions: any[] = Array.isArray(stats?.anomaly?.companions) ? stats.anomaly.companions : [];

        const monsters: AnomalyFamilyMonster[] = family
            .map(toMember)
            .filter((m) => m.id > 0 && m.name.length > 0);
        const companionsMembers: AnomalyFamilyMonster[] = companions
            .map((c) => ({ ...toMember(c), isCompanion: true, isBoss: false }))
            .filter((m) => m.id > 0 && m.name.length > 0);

        if (monsters.length === 0 && companionsMembers.length === 0) {
            return { success: true, data: { familyId: ANOMALY_RACE_ID, monsters: [], companions: [], companionHint: null } };
        }
        return {
            success: true,
            data: {
                familyId: Number(stats?.anomaly?.familyId) || Number(stats?.anomaly?.raceId) || ANOMALY_RACE_ID,
                monsters: [...monsters, ...companionsMembers],
                companions: companionsMembers,
                companionHint: companionsMembers.length > 0 ? anomalyCompanionHint(companionsMembers.length) : null,
            },
        };
    } catch (error) {
        logger.warn("[getAnomalyBossFamily] échec:", { error: String(error) });
        return { success: false, error: "Famille indisponible" };
    }
}
