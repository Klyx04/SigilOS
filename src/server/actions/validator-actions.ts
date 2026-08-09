"use server";
import { logger } from "@/lib/logger";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { checkGuildPermission, getUserContext } from "./user-actions";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * Fetches pending counts for validators with Redis caching.
 * Reduces DB load on every dashboard page render.
 */
export async function getValidatorStats(guildId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const cacheKey = `validator:stats:${guildId}:${session.user.id}`;

    try {
        // 1. Try Cache (30s TTL for validator stats)
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) return { success: true, data: JSON.parse(cached) };

        // 2. Permission Check (Optimized: we already have session here)
        // Use getUserContext which is cached in React per-request
        const user = await getUserContext(guildId);
        
        const isMissionOfficer = user.canManageMissions || user.canValidateMissions;
        const isStaffMgmt = user.canManageMembers;

        if (!isMissionOfficer && !isStaffMgmt) {
            return { success: true, data: { total: 0, hidden: true } };
        }

        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guild) return { success: false, error: "Guild not found" };

        // 3. Count Pending Items in Parallel
        const [pendingMissions, pendingAchievements, pendingKamas, pendingReactivations] = await Promise.all([
            isMissionOfficer
                ? db.submission.count({ where: { mission: { guildId: guild.id }, status: "PENDING" } })
                : 0,
            isStaffMgmt
                ? (db as any).achievementSubmission?.count({ where: { guildId: guild.id, status: "PENDING" } }).catch(() => 0) || 0
                : 0,
            (isMissionOfficer || isStaffMgmt) && (db as any).kamaDonation
                ? (db as any).kamaDonation.count({ where: { guildId: guild.id, status: "PENDING" } }).catch(() => 0)
                : Promise.resolve(0),
            isStaffMgmt
                ? db.userProfile.count({ where: { guildId: guild.id, reactivationRequestedAt: { not: null } } })
                : 0,
        ]);

        const data = {
            pendingMissions,
            pendingAchievements,
            pendingKamas,
            pendingReactivations,
            total: pendingMissions + pendingAchievements + pendingKamas + pendingReactivations,
            hidden: false
        };

        // 4. Store in Redis (30s TTL is enough to feel real-time but save the DB)
        await redis.set(cacheKey, JSON.stringify(data), "EX", 30).catch(() => {});

        return { success: true, data };
    } catch (error) {
        logger.error("[ValidatorStats] Error:", error);
        return { success: false, error: "Database error" };
    }
}
