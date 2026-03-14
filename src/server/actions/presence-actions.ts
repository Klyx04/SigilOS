"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { ProfileStatus } from "@prisma/client";
import { PresenceManager } from "@/lib/presence";

/**
 * Returns a list of users who have been active in the last X minutes.
 */
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
 * Returns a list of users who have been active in the last X minutes.
 */
export const getActivePresence = cache(async (guildId: string, limit: number = 20) => {
    try {
        const internalId = await getInternalGuildId(guildId);
        if (!internalId) return { success: false, data: [], totalActive: 0 };

        // --- NEW REDIS-FIRST LOGIC ---
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

        // Falls back to Prisma only if Redis returned absolutely nothing but thresholds say otherwise?
        if (totalActive === 0) {
            const threshold = new Date(Date.now() - 2 * 60 * 1000);
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
});

/**
 * Updates the lastActivityAt timestamp for the current user/guild.
 * Throttles database writes to once every 10 minutes per user/guild.
 * Always updates Redis for real-time presence.
 */
export async function updateHeartbeat(guildId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Unauthorized" };
        const userId = session.user.id;

        const internalId = await getInternalGuildId(guildId);
        if (!internalId) return { success: false };

        // 1. ALWAYS update Redis (High-performance tracker)
        await PresenceManager.updatePresence(internalId, userId);

        // 2. THOROTTLE database writes (lastActivityAt)
        // We only update the DB if the last update was more than 10 minutes ago
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

        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const shouldUpdateDB = !profile.lastActivityAt || profile.lastActivityAt < tenMinutesAgo;

        if (shouldUpdateDB) {
            await db.userProfile.update({
                where: { id: profile.id },
                data: { lastActivityAt: new Date() }
            });
        }

        return { success: true };
    } catch (error) {
        console.error("[Presence] Heartbeat failed:", error);
        return { success: false };
    }
}
