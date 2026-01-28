"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Super-admin Discord IDs (from environment)
function getSuperAdminIds(): string[] {
    const envVar = process.env.SUPER_ADMIN_IDS;
    if (!envVar) return [];
    return envVar.split(",").map(id => id.trim()).filter(Boolean);
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

    const superAdminIds = getSuperAdminIds();
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
 * Get platform-wide statistics
 */
export async function getPlatformStats() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized: Super-admin access required");

    const [
        allowedGuildsCount,
        activeGuildsCount,
        totalUsersCount,
        totalProfilesCount,
        activeProfilesCount,
        totalMissionsCount
    ] = await Promise.all([
        db.allowedGuild.count(),
        db.allowedGuild.count({ where: { isActive: true } }),
        db.user.count(),
        db.userProfile.count(),
        db.userProfile.count({ where: { status: "ACTIVE" } }),
        db.mission.count()
    ]);

    return {
        allowedGuilds: allowedGuildsCount,
        activeGuilds: activeGuildsCount,
        totalUsers: totalUsersCount,
        totalProfiles: totalProfilesCount,
        activeProfiles: activeProfilesCount,
        totalMissions: totalMissionsCount
    };
}

/**
 * Check if a guild is allowed (for use in layouts/middleware)
 * This replaces the ALLOWED_GUILD_IDS env check
 */
export async function isGuildAllowed(discordGuildId: string): Promise<boolean> {
    // First check if there are any allowed guilds in DB
    const count = await db.allowedGuild.count();

    // If no guilds in DB, fall back to env var (migration period)
    if (count === 0) {
        const envVar = process.env.ALLOWED_GUILD_IDS;
        if (envVar === undefined) return true; // Dev mode: all allowed
        const allowedIds = envVar.split(",").map(id => id.trim()).filter(Boolean);
        return allowedIds.includes(discordGuildId);
    }

    // Check database
    const guild = await db.allowedGuild.findUnique({
        where: { discordGuildId }
    });

    return !!guild && guild.isActive;
}
