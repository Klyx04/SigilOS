"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { ProfileStatus } from "@prisma/client";
import { PresenceManager } from "@/lib/presence";

/**
 * Returns a list of users who have been active in the last X minutes.
 */
export async function getActivePresence(guildId: string, limit: number = 20) {
    const ACTIVE_THRESHOLD_MINUTES = 2;
    const threshold = new Date(Date.now() - ACTIVE_THRESHOLD_MINUTES * 60 * 1000);

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guildConfig) return { success: false, data: [], totalActive: 0 };

        // --- NEW REDIS-FIRST LOGIC ---
        const activeIds = await PresenceManager.getActiveUserIds(guildConfig.id);

        let activeUsers: any[] = [];
        let totalActive = activeIds.length;

        if (activeIds.length > 0) {
            // Find active profiles based on the IDs from Redis
            activeUsers = await db.userProfile.findMany({
                where: {
                    userId: { in: activeIds },
                    guildId: guildConfig.id,
                    status: ProfileStatus.ACTIVE
                },
                select: {
                    id: true,
                    discordNickname: true,
                    pseudoDofus: true,
                    lastActivityAt: true,
                    user: { select: { name: true, image: true } }
                },
                orderBy: { lastActivityAt: "desc" },
                take: limit
            });
        }

        // Falls back to Prisma only if Redis returned absolutely nothing but thresholds say otherwise?
        // Actually, Redis is now the source of truth for "active right now".
        if (totalActive === 0) {
            // Check Prisma as safety/fallback
            const threshold = new Date(Date.now() - 2 * 60 * 1000);
            totalActive = await db.userProfile.count({
                where: { guildId: guildConfig.id, lastActivityAt: { gte: threshold }, status: ProfileStatus.ACTIVE }
            });
            if (totalActive > 0) {
                activeUsers = await db.userProfile.findMany({
                    where: { guildId: guildConfig.id, lastActivityAt: { gte: threshold }, status: ProfileStatus.ACTIVE },
                    select: { id: true, discordNickname: true, pseudoDofus: true, lastActivityAt: true, user: { select: { name: true, image: true } } },
                    take: limit
                });
            }
        }

        return {
            success: true,
            totalActive,
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
 * Also emits LOGIN or NEW_MEMBER activity events when relevant.
 */
export async function updateHeartbeat(guildId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Unauthorized" };
        const userId = session.user.id;

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guildConfig) return { success: false };

        // Fetch current profile to detect login vs new_member
        const profile = await db.userProfile.findFirst({
            where: { guildId: guildConfig.id, userId, status: "ACTIVE" },
            select: {
                id: true,
                discordNickname: true,
                pseudoDofus: true,
                lastActivityAt: true,
                user: { select: { name: true, image: true } }
            }
        });

        const now = new Date();

        await db.userProfile.updateMany({
            where: { guildId: guildConfig.id, userId },
            data: { lastActivityAt: now }
        });

        return { success: true };
    } catch (error) {
        console.error("[Presence] Heartbeat failed:", error);
        return { success: false };
    }
}
