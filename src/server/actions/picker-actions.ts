"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";

// ---------------------------------------------------------------------------
// DUNGEON PICKER
// ---------------------------------------------------------------------------

export interface DungeonWithAchievements {
    id: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl: string | null;
    achievements: {
        id: string;
        points: number;
        challenge: {
            id: string;
            name: string;
            slug: string;
            iconUrl: string | null;
        };
    }[];
}

export async function searchDungeons(
    guildId: string,
    query?: string
): Promise<{ success: true; data: DungeonWithAchievements[] } | { success: false; error: string }> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember || !user.canViewServices) {
            return { success: false, error: "Accès refusé" };
        }

        const dungeons = await db.dungeon.findMany({
            where: query
                ? {
                    OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { bossName: { contains: query, mode: "insensitive" } },
                    ],
                }
                : undefined,
            include: {
                achievements: {
                    include: {
                        challenge: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                iconUrl: true,
                            },
                        },
                    },
                },
            },
            orderBy: { level: "asc" },
            take: 20,
        });

        return { success: true, data: dungeons as DungeonWithAchievements[] };
    } catch (error) {
        console.error("[searchDungeons]", error);
        return { success: false, error: "Erreur interne" };
    }
}

// ---------------------------------------------------------------------------
// QUEST PICKER
// ---------------------------------------------------------------------------

export interface GameQuestResult {
    id: string;
    name: string;
    category: string | null;
    levelMin: number | null;
    levelMax: number | null;
    imageUrl: string | null;
}

export async function searchGameQuests(
    query?: string
): Promise<{ success: true; data: GameQuestResult[] } | { success: false; error: string }> {
    try {
        // GameQuest is global data — no guild isolation needed
        const quests = await db.gameQuest.findMany({
            where: query
                ? { name: { contains: query, mode: "insensitive" } }
                : undefined,
            select: {
                id: true,
                name: true,
                category: true,
                levelMin: true,
                levelMax: true,
                imageUrl: true,
            },
            orderBy: { name: "asc" },
            take: 20,
        });

        return { success: true, data: quests };
    } catch (error) {
        console.error("[searchGameQuests]", error);
        return { success: false, error: "Erreur interne" };
    }
}
