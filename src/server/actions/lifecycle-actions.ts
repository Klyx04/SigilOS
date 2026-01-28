/**
 * Member Lifecycle Actions
 * Server actions for managing archived profiles and RGPD compliance
 */

"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";

// Retention periods in days
const RETENTION_DAYS = {
    LEFT: 90,    // Voluntary departure: 90 days
    KICKED: 30,  // Kicked by admin: 30 days
    BANNED: 0,   // Already anonymized immediately
    GDPR_REQUEST: 0 // Immediate deletion on GDPR request
};

/**
 * Cleanup expired archived profiles
 * Should be called by a cron job (e.g., daily)
 */
export async function cleanupExpiredProfiles(discordGuildId: string) {
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isAdmin) {
        return { success: false, error: "Unauthorized" };
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true }
    });

    if (!guild) {
        return { success: false, error: "Guild not found" };
    }

    const now = new Date();
    let deletedCount = 0;

    // Process each retention type
    for (const [reason, days] of Object.entries(RETENTION_DAYS)) {
        if (days === 0) continue; // Skip immediate deletion types (already handled)

        const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        const result = await db.userProfile.deleteMany({
            where: {
                guildId: guild.id,
                status: "ARCHIVED",
                archiveReason: reason,
                archivedAt: { lt: cutoffDate }
            }
        });

        deletedCount += result.count;
        if (result.count > 0) {
            console.log(`[Lifecycle] Deleted ${result.count} ${reason} profiles older than ${days} days`);
        }
    }

    return { success: true, deletedCount };
}

/**
 * Reactivate a profile when a member returns to the Discord
 * Called automatically in getUserContext when detecting a returning archived member
 */
export async function reactivateProfile(userId: string, guildInternalId: string) {
    const result = await db.userProfile.updateMany({
        where: {
            userId,
            guildId: guildInternalId,
            status: "ARCHIVED" // Only reactivate if archived, not if banned
        },
        data: {
            status: "ACTIVE",
            archivedAt: null,
            archiveReason: null
        }
    });

    if (result.count > 0) {
        console.log(`[Lifecycle] Reactivated profile for returning member ${userId}`);
    }

    return result.count > 0;
}

/**
 * Get archived profiles for admin review
 */
export async function getArchivedProfiles(discordGuildId: string) {
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isAdmin) {
        return { success: false, error: "Unauthorized", profiles: [] };
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true }
    });

    if (!guild) {
        return { success: false, error: "Guild not found", profiles: [] };
    }

    const profiles = await db.userProfile.findMany({
        where: {
            guildId: guild.id,
            status: { in: ["ARCHIVED", "BANNED"] }
        },
        orderBy: { archivedAt: "desc" },
        take: 50
    });

    return { success: true, profiles };
}

/**
 * Handle GDPR deletion request (Right to be Forgotten)
 * User can request deletion of their own data
 */
export async function handleGdprDeletionRequest(discordGuildId: string) {
    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isAuthenticated || !ctx.id) {
        return { success: false, error: "Unauthorized" };
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true }
    });

    if (!guild) {
        return { success: false, error: "Guild not found" };
    }

    // Delete the user's profile for this guild
    const result = await db.userProfile.deleteMany({
        where: {
            userId: ctx.id,
            guildId: guild.id
        }
    });

    console.log(`[GDPR] User ${ctx.id} requested deletion. Removed ${result.count} profile(s)`);

    return { success: true, deleted: result.count > 0 };
}
