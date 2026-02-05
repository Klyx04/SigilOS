import { MissionCategory } from "@prisma/client";

/**
 * Metadata for specific mission types (stored in Mission.payload JSON)
 */
export interface MissionPayload {
    dungeonName?: string;
    bossName?: string;
    monsterName?: string;
    quantity?: number;
    type?: "ZONE" | "BOSS" | string;
    levelRange?: string;
    difficulty?: string;
    songesLevel?: string;
    palier?: number;
    tier?: number;
    level?: string | number;
    mode?: string;
    description?: string;
    title?: string;
    missionTitle?: string;
}


export type { MissionCategory };
