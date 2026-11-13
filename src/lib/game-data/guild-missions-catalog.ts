import type { MissionCategoryType } from "@/lib/mission-config";
import rawData from "@/data/dofus-guild-missions.json";

export interface OfficialGuildMission {
    id: number;
    title: string;
    category: MissionCategoryType;
    superCategoryId: number;
    rank: number;
    level: number;
    activityPoints: number;
    guildTokens: number;
    objectiveText: string;
    monsterId: number | null;
    monsterName: string | null;
    monsterLevel: number | null;
    monsterImageUrl: string | null;
    dungeonId: number | null;
    dungeonName: string | null;
    subareaId: number | null;
    subareaName: string | null;
    mapId: number | null;
    targetCount: number | null;
    isSpecial: boolean;
    contextPreset: "VULKANIA" | "NOWEL" | "HALOUINE" | "PWAK" | "AUTRE" | null;
    searchTokens: string;
}

export interface MissionsCatalogData {
    version: string;
    extractedAt: string;
    totalMissions: number;
    breakdown: {
        byCategory: Record<string, number>;
        byRank: Record<string, number>;
    };
    missions: OfficialGuildMission[];
}

const catalog = rawData as unknown as MissionsCatalogData;

/**
 * Normalise un texte pour la recherche (minuscule, sans accents).
 */
export function normalizeSearchTerm(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

/**
 * Retourne toutes les missions officielles du catalogue.
 */
export function getAllOfficialMissions(): OfficialGuildMission[] {
    return catalog.missions;
}

/**
 * Recherche dans le catalogue officiel selon divers critères.
 */
export function searchOfficialGuildMissions(options: {
    query?: string;
    category?: MissionCategoryType;
    rank?: number;
    isSpecial?: boolean;
    contextPreset?: string;
    limit?: number;
}): OfficialGuildMission[] {
    const { query, category, rank, isSpecial, contextPreset, limit = 20 } = options;
    const cleanQuery = query ? normalizeSearchTerm(query) : "";

    let results = catalog.missions;

    if (isSpecial !== undefined) {
        results = results.filter(m => m.isSpecial === isSpecial);
    }

    if (category) {
        results = results.filter(m => m.category === category);
    }

    if (rank) {
        results = results.filter(m => m.rank === rank);
    }

    if (contextPreset && contextPreset !== "AUTRE") {
        results = results.filter(m => m.contextPreset === contextPreset);
    }

    if (cleanQuery) {
        results = results.filter(m => m.searchTokens.includes(cleanQuery));
    }

    return results.slice(0, limit);
}

/**
 * Trouve une mission par son ID officiel de jeu.
 */
export function getOfficialMissionById(id: number): OfficialGuildMission | undefined {
    return catalog.missions.find(m => m.id === id);
}

export interface DraftMissionMapped {
    title: string;
    category: MissionCategoryType;
    rank: number;
    xpReward: number;
    guildatonsReward: number;
    payload: Record<string, any>;
}

/**
 * Convertit une mission officielle du client en payload compatible avec l'éditeur de SigilOS.
 */
export function mapOfficialToDraftMission(mission: OfficialGuildMission): DraftMissionMapped {
    let payload: Record<string, any> = {};

    switch (mission.category) {
        case "DONJON":
            payload = {
                dungeonId: mission.dungeonId ? String(mission.dungeonId) : undefined,
                dungeonName: mission.dungeonName || mission.title,
                bossName: mission.monsterName || mission.title,
                level: mission.level,
                imageUrl: mission.monsterImageUrl || undefined,
                mapId: mission.mapId || undefined,
            };
            break;

        case "REGULATION":
            payload = {
                zoneId: mission.subareaId ? String(mission.subareaId) : "",
                zoneName: mission.subareaName || "",
                monsterId: mission.monsterId ? String(mission.monsterId) : undefined,
                monsterName: mission.monsterName || "",
                targetCount: mission.targetCount || 50,
                imageUrl: mission.monsterImageUrl || undefined,
            };
            break;

        case "ANOMALIE":
            payload = {
                type: "ZONE",
                levelRange: mission.level >= 190 ? "190-200" : "150-189",
                elixir: "aucun",
            };
            break;

        case "SONGES":
            // Détection du mode depuis le titre (Cauchemar II, Rêve, etc.)
            let difficulty: "Rêve" | "Paradoxe" | "Cauchemar" = "Cauchemar";
            if (mission.title.includes("Rêve")) difficulty = "Rêve";
            else if (mission.title.includes("Paradoxe")) difficulty = "Paradoxe";

            let songeLevel: "I" | "II" | "III" | "IV" = "II";
            if (mission.title.includes(" IV")) songeLevel = "IV";
            else if (mission.title.includes(" III")) songeLevel = "III";
            else if (mission.title.includes(" II")) songeLevel = "II";
            else if (mission.title.includes(" I")) songeLevel = "I";

            payload = {
                difficulty,
                level: songeLevel,
                tier: mission.rank,
            };
            break;

        case "EXPEDITION":
            payload = {
                dungeonId: mission.dungeonId ? String(mission.dungeonId) : "",
                dungeonName: mission.dungeonName || mission.title,
                bossName: mission.monsterName || mission.title,
                mode: mission.title.toLowerCase().includes("bravoure") ? "bravoure" : "audace",
                level: mission.level,
                imageUrl: mission.monsterImageUrl || undefined,
            };
            break;

        case "EVENT":
            payload = {
                eventType: mission.monsterId ? "MONSTRE_SPECIAL" : "DONJON",
                contextPreset: mission.contextPreset || "AUTRE",
                dungeonName: mission.dungeonName || (mission.monsterId ? undefined : mission.title),
                bossName: mission.monsterName || undefined,
                monsterId: mission.monsterId ? String(mission.monsterId) : undefined,
                monsterName: mission.monsterName || undefined,
                level: mission.level,
                imageUrl: mission.monsterImageUrl || undefined,
                targetCount: mission.targetCount || undefined,
                description: mission.objectiveText,
            };
            break;
    }

    return {
        title: mission.title,
        category: mission.category,
        rank: mission.rank,
        xpReward: mission.activityPoints,
        guildatonsReward: mission.guildTokens,
        payload: {
            ...payload,
            officialMissionId: mission.id,
            officialObjectiveText: mission.objectiveText,
        },
    };
}
