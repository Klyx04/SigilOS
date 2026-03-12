"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";

export async function getSigilKingLadder(guildId: string) {
    const session = await auth();
    if (!session?.user) return [];

    try {
        const ladder = await db.sigilKingRank.findMany({
            where: { guildId },
            orderBy: { bestScore: "desc" },
            take: 10,
        });
        return ladder;
    } catch (error) {
        console.error("[SigilKingActions] Error fetching ladder:", error);
        return [];
    }
}

export async function getSigilKingHistory(guildId: string, limit = 5) {
    const session = await auth();
    if (!session?.user) return [];

    try {
        const history = await db.sigilKingScore.findMany({
            where: { guildId },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
        return history;
    } catch (error) {
        console.error("[SigilKingActions] Error fetching history:", error);
        return [];
    }
}

export async function getSigilKingPlayerStats(guildId: string) {
    const session = await auth();
    if (!session?.user?.id) return null;

    try {
        const stats = await db.sigilKingRank.findUnique({
            where: {
                guildId_userId: {
                    guildId,
                    userId: session.user.id
                }
            }
        });
        return stats;
    } catch (error) {
        console.error("[SigilKingActions] Error fetching player stats:", error);
        return null;
    }
}
