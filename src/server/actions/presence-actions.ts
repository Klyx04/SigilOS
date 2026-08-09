"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { ProfileStatus } from "@prisma/client";
import { PresenceManager } from "@/lib/presence";
import { getDisplayName } from "@/lib/display-name";
import { cache } from "react";

// In-memory cache for internal guild IDs (5min TTL)
const guildIdCache = new Map<string, { id: string, expiresAt: number }>();

async function getInternalGuildId(discordGuildId: string): Promise<string | null> {
    const now = Date.now();
    const cached = guildIdCache.get(discordGuildId);
    if (cached && cached.expiresAt > now) return cached.id;

    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true }
    });

    if (guildConfig) {
        guildIdCache.set(discordGuildId, { id: guildConfig.id, expiresAt: now + 300_000 });
        return guildConfig.id;
    }
    return null;
}

/**
 * Returns a list of users who are online in the guild.
 * Flags users as AFK if they have been inactive > 15 minutes.
 */
export const getActivePresence = cache(async (guildId: string, limit: number = 20) => {
    try {
        const internalId = await getInternalGuildId(guildId);
        if (!internalId) return { success: false, data: [], totalActive: 0 };

        // --- REDIS-FIRST LOGIC ---
        const activeIds = await PresenceManager.getActiveUserIds(internalId);

        let activeUsers: any[] = [];
        let totalActive = activeIds.length;

        if (activeIds.length > 0) {
            // Find active profiles based on the IDs from Redis
            activeUsers = await db.userProfile.findMany({
                where: {
                    userId: { in: activeIds },
                    guildId: internalId,
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

        // Falls back to Prisma only if Redis returned absolutely nothing
        if (totalActive === 0) {
            const threshold = new Date(Date.now() - 15 * 60 * 1000);
            totalActive = await db.userProfile.count({
                where: { guildId: internalId, lastActivityAt: { gte: threshold }, status: ProfileStatus.ACTIVE }
            });
            if (totalActive > 0) {
                activeUsers = await db.userProfile.findMany({
                    where: { guildId: internalId, lastActivityAt: { gte: threshold }, status: ProfileStatus.ACTIVE },
                    select: { id: true, discordNickname: true, pseudoDofus: true, lastActivityAt: true, user: { select: { name: true, image: true } } },
                    take: limit
                });
            }
        }

        const now = Date.now();
        const AFK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

        return {
            success: true,
            totalActive,
            data: activeUsers.map(u => {
                const lastActiveDate = u.lastActivityAt ? new Date(u.lastActivityAt) : null;
                const diffMs = lastActiveDate ? (now - lastActiveDate.getTime()) : Infinity;
                const isAfk = diffMs > AFK_THRESHOLD_MS;

                return {
                    id: u.id,
                    name: getDisplayName(u),
                    image: u.user.image,
                    lastActive: u.lastActivityAt,
                    isAfk
                };
            })
        };
    } catch (error) {
        logger.error("[Presence] Failed to fetch active users:", error);
        return { success: false, data: [] };
    }
});

/**
 * Updates presence for current user.
 * Always updates Redis.
 * Only updates DB lastActivityAt if user is NOT AFK (actively interacting).
 */
export async function updateHeartbeat(guildId: string, isAfk: boolean = false) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Unauthorized" };
        const userId = session.user.id;

        const internalId = await getInternalGuildId(guildId);
        if (!internalId) return { success: false };

        // 1. ALWAYS update Redis (High-performance online tracker)
        await PresenceManager.updatePresence(internalId, userId);

        // 2. Update DB lastActivityAt ONLY IF USER IS NOT AFK
        // If user IS AFK, we preserve their last active interaction timestamp in DB
        if (!isAfk) {
            const profile = await db.userProfile.findUnique({
                where: { 
                    userId_guildId: {
                        userId,
                        guildId: internalId
                    }
                },
                select: { id: true, lastActivityAt: true }
            });

            if (!profile) return { success: false };

            // Throttle DB updates to once every 2 minutes for active users
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            const shouldUpdateDB = !profile.lastActivityAt || profile.lastActivityAt < twoMinutesAgo;

            if (shouldUpdateDB) {
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: { lastActivityAt: new Date() }
                });
            }
        }

        return { success: true };
    } catch (error) {
        logger.error("[Presence] Heartbeat failed:", error);
        return { success: false };
    }
}
