"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * RECOMPILE TRIGGER: 2026-03-11 02:22
 * This file MUST be async because it is marked with "use server".
 */

// Super-admin Discord IDs (from environment) - Forced async
export async function getSuperAdminIds(): Promise<string[]> {
    const envVar = process.env.SUPER_ADMIN_IDS;
    if (!envVar) return [];
    return envVar.split(",").map(id => id.trim()).filter(Boolean);
}

/**
 * Check if a Discord ID belongs to a super-admin
 */
export async function isDiscordSuperAdmin(discordId: string): Promise<boolean> {
    const superAdminIds = await getSuperAdminIds();
    return superAdminIds.includes(discordId);
}

/**
 * Check if the current user is a super-admin (platform-level)
 */
export async function isSuperAdmin(): Promise<boolean> {
    const session = await auth();
    if (!session?.user?.id) return false;

    // Get Discord ID from session
    const account = await db.account.findFirst({
        where: { userId: session.user.id, provider: "discord" }
    });

    if (!account?.providerAccountId) return false;

    const superAdminIds = await getSuperAdminIds();
    return superAdminIds.includes(account.providerAccountId);
}

/**
 * Get all allowed guilds (platform whitelist)
 */
export async function getAllowedGuilds() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized: Super-admin access required");

    return db.allowedGuild.findMany({
        orderBy: { addedAt: "desc" }
    });
}

/**
 * Add a guild to the platform whitelist
 */
export async function addAllowedGuild(data: {
    discordGuildId: string;
    name?: string;
    tier?: string;
    notes?: string;
    expiresAt?: Date | null;
}) {
    const session = await auth();
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized: Super-admin access required");

    // Get super-admin's Discord ID
    const account = await db.account.findFirst({
        where: { userId: session!.user!.id, provider: "discord" }
    });

    if (!account?.providerAccountId) throw new Error("Discord account not found");

    // Check if already exists
    const existing = await db.allowedGuild.findUnique({
        where: { discordGuildId: data.discordGuildId }
    });

    if (existing) {
        throw new Error("Cette guilde est déjà dans la liste blanche");
    }

    const guild = await db.allowedGuild.create({
        data: {
            discordGuildId: data.discordGuildId,
            name: data.name || null,
            tier: data.tier || "BETA",
            notes: data.notes || null,
            expiresAt: data.expiresAt || null,
            addedBy: account.providerAccountId,
        }
    });

    revalidatePath("/god");
    return guild;
}

/**
 * Remove a guild from the platform whitelist
 */
export async function removeAllowedGuild(discordGuildId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized: Super-admin access required");

    await db.allowedGuild.delete({
        where: { discordGuildId }
    });

    revalidatePath("/god");
    return { success: true };
}

/**
 * Toggle guild active status
 */
export async function toggleGuildActive(discordGuildId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized: Super-admin access required");

    const guild = await db.allowedGuild.findUnique({
        where: { discordGuildId }
    });

    if (!guild) throw new Error("Guilde non trouvée");

    const updated = await db.allowedGuild.update({
        where: { discordGuildId },
        data: { isActive: !guild.isActive }
    });

    revalidatePath("/god");
    return updated;
}

/**
 * Get platform-wide statistics with trends
 */
export async function getPlatformStats() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized: Super-admin access required");

    // Get current stats
    const [
        totalGuildsCount,
        activeGuildsCount,
        totalUsersCount,
        totalProfilesCount,
        activeProfilesCount,
        totalMissionsCount
    ] = await Promise.all([
        db.guildConfig.count(), // Count actual guilds, not whitelist
        db.guildConfig.count({ where: { isActive: true } }),
        db.user.count(),
        db.userProfile.count(),
        db.userProfile.count({ where: { status: "ACTIVE" } }),
        db.mission.count()
    ]);

    // Get stats from 24h ago for trends
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
        guildsTrend,
        usersTrend,
        missionsTrend,
        weeklyActiveUsers
    ] = await Promise.all([
        db.guildConfig.count({ where: { createdAt: { gte: yesterday } } }),
        db.user.count({ where: { createdAt: { gte: yesterday } } }),
        db.mission.count({ where: { createdAt: { gte: yesterday } } }),
        db.auditLog.groupBy({
            by: ['actorUserId'],
            where: { createdAt: { gte: lastWeek } }
        }).then(res => res.length)
    ]);

    const retentionRate = totalUsersCount > 0 ? (activeProfilesCount / totalUsersCount) * 100 : 0;
    const density = totalGuildsCount > 0 ? totalProfilesCount / totalGuildsCount : 0;

    return {
        allowedGuilds: totalGuildsCount, // Renamed for compatibility
        guildsTrend,
        activeGuilds: activeGuildsCount,
        totalUsers: totalUsersCount,
        usersTrend,
        totalProfiles: totalProfilesCount,
        activeProfiles: activeProfilesCount,
        totalMissions: totalMissionsCount,
        missionsTrend,
        weeklyActiveUsers,
        retentionRate: Math.round(retentionRate),
        density: Number(density.toFixed(1))
    };
}


// In-memory cache for isGuildAllowed to reduce DB pressure
const guildAllowedCache = new Map<string, { allowed: boolean; expires: number }>();

/**
 * Check if a guild is allowed (for use in layouts/middleware)
 * This replaces the ALLOWED_GUILD_IDS env check
 */
export async function isGuildAllowed(discordGuildId: string): Promise<boolean> {
    const now = Date.now();
    const cached = guildAllowedCache.get(discordGuildId);
    if (cached && cached.expires > now) return cached.allowed;

    try {
        // Parallel fetch for better performance
        const [ban, allowed, config] = await Promise.all([
            db.platformBan.findUnique({ where: { discordId: discordGuildId } }),
            db.allowedGuild.findUnique({ where: { discordGuildId } }),
            db.guildConfig.findUnique({
                where: { discordGuildId },
                select: { isActive: true }
            })
        ]);

        // 1. Check Platform Bans (Highest Priority)
        let isAllowed = true;
        if (ban && ban.entityType === "GUILD") isAllowed = false;

        // 2. Check if guild is in the AllowedGuild whitelist
        if (isAllowed && (!allowed || !allowed.isActive)) isAllowed = false;

        // 3. If config exists, it MUST be active
        if (isAllowed && config && !config.isActive) isAllowed = false;

        // Cache for 1 minute
        guildAllowedCache.set(discordGuildId, { allowed: isAllowed, expires: now + 60000 });
        return isAllowed;
    } catch (e) {
        console.error(`[Security] Error checking guild status for ${discordGuildId}:`, e);
        // Fail closed for security, but allow if we have a stale cache? 
        // Better fail closed on DB error to be safe.
        return false;
    }
}
/**
 * CLEANUP JANITOR (GDPR & Hygiene)
 * Deletes users created > threshold ago with NO profile and NO critical data.
 * Default: 24h. Test Mode: 2 mins.
 */
export async function cleanupGhostUsers(isTestMode = false) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    // DATA LIFECYCLE MANAGEMENT
    // Production: 24h grace period
    // Testing: 2 minutes grace period
    const threshold = isTestMode ? 2 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - threshold);

    const superAdminIds = await getSuperAdminIds();

    // 1. Find candidates (Old users)
    const candidates = await db.user.findMany({
        where: {
            createdAt: { lt: cutoffDate },
            profiles: { none: {} } // No UserProfile
        },
        include: {
            accounts: true // To check Discord ID for Super Admin protection
        }
    });

    let deletedCount = 0;

    for (const user of candidates) {
        // SAFETY CHECK 1: Is Super Admin?
        const discordId = user.accounts[0]?.providerAccountId;
        if (discordId && superAdminIds.includes(discordId)) {
            continue; // Skip Super Admins
        }

        // SAFETY CHECK 2: Has created guild events? (Deep cleaning check)
        const hasEvents = await db.guildEvent.count({ where: { creatorId: user.id } });
        if (hasEvents > 0) continue;

        // Execute Delete
        await db.user.delete({ where: { id: user.id } });
        deletedCount++;
    }

    revalidatePath("/god");
    return { success: true, count: deletedCount, mode: isTestMode ? "TEST (2m)" : "PROD (24h)" };
}

/**
 * Get Ghost Users (No Profile) for Admin View
 */
export async function getGhostUsers() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return [];

    return db.user.findMany({
        where: {
            profiles: { none: {} } // ONLY users without any profile
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
            accounts: {
                select: { provider: true }
            }
        }
    });
}

/**
 * Get Platform Activity (Pulse) Stats for Charts
 * Combines new registrations and total audit log activity
 */
export async function getPlatformActivityStats() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return [];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch new users
    const users = await db.user.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true }
    });

    // Fetch all audit activity (engagement pulse)
    const logs = await db.auditLog.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true }
    });

    const statsMap = new Map<string, { users: number; pulse: number }>();

    // Initialize last 30 days
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        statsMap.set(d.toISOString().split("T")[0], { users: 0, pulse: 0 });
    }

    users.forEach((u) => {
        const dateKey = u.createdAt.toISOString().split("T")[0];
        if (statsMap.has(dateKey)) {
            const current = statsMap.get(dateKey)!;
            statsMap.set(dateKey, { ...current, users: current.users + 1 });
        }
    });

    logs.forEach((l) => {
        const dateKey = l.createdAt.toISOString().split("T")[0];
        if (statsMap.has(dateKey)) {
            const current = statsMap.get(dateKey)!;
            // Normalizing pulse (diving by 10 to keep scale coherent on chart)
            statsMap.set(dateKey, { ...current, pulse: current.pulse + 1 });
        }
    });

    return Array.from(statsMap.entries())
        .map(([date, data]) => ({
            date,
            users: data.users,
            pulse: Number(data.pulse.toFixed(1))
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Force Delete User (Admin Manual Action)
 */
export async function forceDeleteUser(userId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    // Prevent Admin Suicide
    const session = await auth();
    if (session?.user?.id === userId) {
        throw new Error("Cannot delete yourself");
    }

    try {
        // Cascade delete will handle relations if Schema is set up correctly,
        // but explicit clean up is safer/clearer or relying on Prisma onDelete: Cascade
        await db.user.delete({
            where: { id: userId }
        });

        revalidatePath("/god");
        return { success: true };
    } catch (error) {
        console.error("Delete Error:", error);
        return { success: false, error: "Deletion failed" };
    }
}
/**
 * PLANETARY ORPHAN CLEANUP
 * Removes UserProfile entries that are no longer linked to a valid User.
 * This can happen if a User was deleted bypassing Prisma's cascade or due to previous bugs.
 */
export async function cleanupOrphanedProfiles() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    // 1. Find all profile IDs
    const profiles = await db.userProfile.findMany({
        select: { id: true, userId: true }
    });

    // 2. Find all valid user IDs
    const users = await db.user.findMany({
        select: { id: true }
    });
    const userIds = new Set(users.map(u => u.id));

    // 3. Identify orphans
    const orphanIds = profiles
        .filter(p => !userIds.has(p.userId))
        .map(p => p.id);

    if (orphanIds.length === 0) {
        return { success: true, count: 0, message: "Aucun profil orphelin détecté." };
    }

    // 4. Delete orphans
    await db.userProfile.deleteMany({
        where: { id: { in: orphanIds } }
    });

    revalidatePath("/god");
    return { success: true, count: orphanIds.length, message: `${orphanIds.length} profils orphelins supprimés.` };
}

/**
 * [ADM-8] Platform-wide: Get all users who have requested account deletion
 * or have a scheduled deletion pending. Includes their guild profile(s) for context.
 * Super-admin only.
 */
export async function getPendingDeletionUsers() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized: Super-admin access required");

    const users = await db.user.findMany({
        where: {
            OR: [
                { deletionRequestedAt: { not: null } },
                { scheduledDeletion: { not: null } },
            ]
        },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            deletionRequestedAt: true,
            scheduledDeletion: true,
            createdAt: true,
            profiles: {
                select: {
                    id: true,
                    status: true,
                    pseudoDofus: true,
                    discordNickname: true,
                    archiveReason: true,
                    guild: {
                        select: { name: true, discordGuildId: true }
                    }
                }
            }
        },
        orderBy: { deletionRequestedAt: "desc" },
        take: 100
    });

    return users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        deletionRequestedAt: u.deletionRequestedAt?.toISOString() || null,
        scheduledDeletion: u.scheduledDeletion?.toISOString() || null,
        createdAt: u.createdAt.toISOString(),
        guilds: u.profiles.map(p => ({
            guildName: p.guild.name,
            discordGuildId: p.guild.discordGuildId,
            displayName: p.pseudoDofus || p.discordNickname || u.name || "Inconnu",
            profileStatus: p.status,
            archiveReason: p.archiveReason,
        }))
    }));
}

/**
 * Get OCR API Usage Statistics for /god page
 * Returns daily usage for the last 30 days and monthly totals
 */
export async function getOcrApiStats() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { daily: [], monthlyTotal: 0, todayTotal: 0 };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    // Get all usage records for last 30 days
    // Note: Using 'as any' due to Prisma client cache issue with new models
    const usageRecords = await (db as any).ocrApiUsage.findMany({
        where: { date: { gte: thirtyDaysAgo } },
        orderBy: { date: 'asc' }
    });

    // Group by date
    const dailyMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        dailyMap.set(d.toISOString().split('T')[0], 0);
    }

    let monthlyTotal = 0;
    let todayTotal = 0;

    usageRecords.forEach((record: { date: Date; count: number }) => {
        const dateKey = new Date(record.date).toISOString().split('T')[0];
        if (dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + record.count);
        }

        if (new Date(record.date) >= firstOfMonth) {
            monthlyTotal += record.count;
        }

        if (new Date(record.date).toISOString().split('T')[0] === today.toISOString().split('T')[0]) {
            todayTotal += record.count;
        }
    });

    return {
        daily: Array.from(dailyMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        monthlyTotal,
        todayTotal
    };
}
