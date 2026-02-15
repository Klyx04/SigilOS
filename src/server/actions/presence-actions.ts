"use server";

import { db } from "@/lib/prisma";

/**
 * Returns a list of users who have been active in the last X minutes.
 */
export async function getActivePresence(guildId: string, limit: number = 20) {
    const ACTIVE_THRESHOLD_MINUTES = 15;
    const threshold = new Date(Date.now() - ACTIVE_THRESHOLD_MINUTES * 60 * 1000);

    try {
        const activeUsers = await db.userProfile.findMany({
            where: {
                guildId,
                lastActivityAt: {
                    gte: threshold
                }
            },
            select: {
                id: true,
                discordNickname: true,
                pseudoDofus: true,
                lastActivityAt: true,
                user: {
                    select: {
                        name: true,
                        image: true
                    }
                }
            },
            orderBy: {
                lastActivityAt: "desc"
            },
            take: limit
        });

        return {
            success: true,
            data: activeUsers.map(u => ({
                id: u.id,
                name: u.discordNickname || u.pseudoDofus || u.user.name || "Inconnu",
                image: u.user.image,
                lastActive: u.lastActivityAt
            }))
        };
    } catch (error) {
        console.error("[Presence] Failed to fetch active users:", error);
        return { success: false, data: [] };
    }
}

/**
 * Updates the lastActivityAt timestamp for the current user/guild.
 */
export async function updateHeartbeat(guildId: string, userId: string) {
    try {
        await db.userProfile.updateMany({
            where: {
                guildId,
                userId
            },
            data: {
                lastActivityAt: new Date()
            }
        });
        return { success: true };
    } catch (error) {
        console.error("[Presence] Heartbeat failed:", error);
        return { success: false };
    }
}
