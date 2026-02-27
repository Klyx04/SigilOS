"use server";

import { auth } from "@/auth";
import { fetchGuildRoles, fetchGuild } from "@/server/discord";
import { db } from "@/lib/prisma";
import { PERMISSIONS, type PermissionId } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { emitGuildActivity } from "./activity-actions";

export type UserContext = {
    isAuthenticated: boolean;
    id?: string;
    name?: string;
    image?: string;
    roleName?: string;
    roleColor?: number;
    canViewMissions: boolean;
    canManageMissions: boolean;
    canValidateMissions: boolean;
    canManageBonus: boolean;
    canViewRoster: boolean;
    // Songes Permissions
    canViewSonges: boolean;
    canCreateSonges: boolean;
    canJoinSonges: boolean;
    // Module Permissions
    canViewArchis: boolean;
    canViewLadder: boolean;
    // Presentation Permission
    canEditPresentation: boolean;
    // Calendar Permissions
    canViewCalendar: boolean;
    canManageCalendar: boolean;
    canViewAdminDocs: boolean;
    canManageMembers: boolean;
    canViewDashboard: boolean;
    canViewPresentation: boolean;
    canViewStats: boolean;
    canViewServices: boolean;
    canCreateServices: boolean;
    canViewFinder: boolean;
    canViewPolls: boolean;
    canManagePolls: boolean;
    canViewDocs: boolean;
    canViewProfile: boolean;
    // Coming Soon Permissions
    canViewQuests: boolean;
    canManageQuests: boolean;
    canViewWorldmap: boolean;
    canManageWorldmap: boolean;
    canViewResources: boolean;
    canManageResources: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    isMember: boolean;
    profileId?: string;
    guildName?: string;
    dofusServerId?: string | null;
    joinedAt?: string | null;
    guildId?: string;
    isCapacityFull?: boolean;
    scheduledDeletion?: string | null;
};

export type ActionResponse<T = any> = {
    success: boolean;
    error?: string;
    data?: T;
};

/**
 * Centralized Multi-Tenant Security Guard
 * Ensures a user actually belongs to a guild before allowing any action.
 * Returns the UserProfile if valid, throws/returns error otherwise.
 */
export async function validateGuildOwnership(userId: string, discordGuildId: string) {
    const profile = await db.userProfile.findFirst({
        where: {
            userId,
            guild: { discordGuildId },
            status: "ACTIVE"
        },
        select: { id: true, guildId: true }
    });

    if (!profile) {
        logger.error(`[Security] Deep Isolation Violation: User ${userId} tried to access guild ${discordGuildId}`);
        throw new Error("Violation d'isolation multi-tenant. Action bloquée.");
    }

    return profile;
}

import { cache } from "react";

/**
 * Main function to fetch the user context for a specific guild.
 * USES REACT CACHE to avoid redundant Discord/DB calls in a single request.
 */
export const getUserContext = cache(async (targetGuildId?: string): Promise<UserContext> => {
    return _getUserContext(targetGuildId);
});

async function _getUserContext(targetGuildId?: string): Promise<UserContext> {
    const session = await auth();

    // Default context for non-authenticated or base cases
    const baseContext: UserContext = {
        isAuthenticated: !!session?.user?.id,
        isAdmin: false,
        isSuperAdmin: false,
        isMember: false,
        isCapacityFull: false,
        canViewMissions: false,
        canManageMissions: false,
        canValidateMissions: false,
        canManageBonus: false,
        canViewRoster: false,
        canViewSonges: false,
        canCreateSonges: false,
        canJoinSonges: false,
        canViewArchis: false,
        canViewPolls: false,
        canManagePolls: false,
        canViewLadder: false,
        canEditPresentation: false,
        canViewCalendar: false,
        canManageCalendar: false,
        canViewAdminDocs: false,
        canViewPresentation: false,
        canViewDashboard: false,
        canViewStats: false,
        canViewServices: false,
        canCreateServices: false,
        canViewFinder: false,
        canViewDocs: false,
        canViewProfile: false,
        canManageMembers: false,
        canViewQuests: false,
        canManageQuests: false,
        canViewWorldmap: false,
        canManageWorldmap: false,
        canViewResources: false,
        canManageResources: false,
    };

    if (!session?.user?.id) return { ...baseContext, isAuthenticated: false };

    // Common data for authenticated users (to avoid crashes in TopNav/NotificationBell)
    const authPartial = {
        isAuthenticated: true,
        id: session.user.id,
        name: session.user.name || "Voyageur",
        image: session.user.image || undefined,
    };

    const effectiveGuildId = targetGuildId || process.env.DISCORD_GUILD_ID;
    if (!effectiveGuildId) return { ...baseContext, ...authPartial };

    // --- SECURITY: SUPER ADMIN BYPASS ---
    const { isSuperAdmin } = await import("@/server/actions/super-admin-actions");
    const isGod = await isSuperAdmin();

    // 1. Get Guild Config for Mappings (Try Internal ID first, then Discord ID)
    const guildConfig = await db.guildConfig.findFirst({
        where: {
            OR: [
                { id: effectiveGuildId },
                { discordGuildId: effectiveGuildId }
            ]
        },
        select: { id: true, discordGuildId: true, rolesMapping: true, name: true, dofusServerId: true }
    }) as any;

    const actualDiscordGuildId = guildConfig?.discordGuildId || effectiveGuildId;

    // --- SECURITY: DEEP WHITELIST CHECK (Database-based) ---
    const { isGuildAllowed } = await import("@/server/actions/super-admin-actions");
    const allowed = await isGuildAllowed(actualDiscordGuildId);

    // Only block if not allowed AND not a God
    if (!allowed && !isGod) {
        logger.warn(`[Security] Blocked access to unauthorized guild: ${actualDiscordGuildId}`);
        return { ...baseContext, isAuthenticated: false };
    }

    // 2. Fetch User's Roles from Discord
    const account = await db.account.findFirst({
        where: {
            userId: session.user.id,
            provider: "discord"
        },
        select: { providerAccountId: true }
    });

    if (!account) return { ...baseContext, ...authPartial };

    const discordUserId = account.providerAccountId;

    // --- PLATFORM SECURITY: BAN CHECK ---
    const platformBan = await db.platformBan.findUnique({
        where: { discordId: discordUserId }
    });
    if (platformBan && platformBan.entityType === "USER" && !isGod) {
        logger.warn(`[Security] Blocked access for PLATFORM BANNED user: ${discordUserId}`);
        return { ...baseContext, isAuthenticated: false };
    }

    // --- ENSURE USER PROFILE EXISTS ---
    let profile = await db.userProfile.findUnique({
        where: {
            userId_guildId: {
                userId: session.user.id,
                guildId: guildConfig?.id || ""
            }
        }
    });

    const token = process.env.DISCORD_BOT_TOKEN;
    const [memberRes, guildInfo, allRoles] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${effectiveGuildId}/members/${discordUserId}`, {
            headers: { Authorization: `Bot ${token}` },
            cache: 'no-store'
        }).catch(() => ({ ok: false, status: 500 } as Response)),
        fetchGuild(effectiveGuildId).catch(() => null),
        fetchGuildRoles(effectiveGuildId, { excludeManaged: false }).catch(() => [])
    ]);

    let memberRoles: string[] = [];
    let myRoles: any[] = [];
    let roleColor = 0;
    let roleName = "Membre";
    let displayName = session.user.name || "Voyageur";
    let member: any = null;

    if (memberRes.ok) {
        member = await memberRes.json();
        memberRoles = member.roles;
        if (member.nick) displayName = member.nick;
        else if (member.user?.global_name) displayName = member.user.global_name;
        else if (member.user?.username) displayName = member.user.username;

        myRoles = allRoles.filter(r => memberRoles.includes(r.id));
        if (myRoles.length > 0) {
            const topRole = myRoles[0];
            roleName = topRole.name;
            roleColor = topRole.color;
        }

        if (roleName === "Membre") {
            const isAdmin = myRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
            if (isAdmin) {
                roleName = "Administrateur";
                roleColor = 0x5865F2;
            }
        }
    }

    // ── SECURITY: Block ARCHIVED and BANNED — they cannot self-reactivate even if they re-join Discord ──
    if (profile?.status === "ARCHIVED" && !isGod) {
        return {
            ...baseContext,
            isAuthenticated: true,
            id: session.user.id,
            name: displayName,
            image: session.user.image || undefined,
            isMember: false,
            guildName: guildConfig?.name || "Serveur Inconnu",
            isArchived: true,
            scheduledDeletion: profile.scheduledDeletion?.toISOString() || null
        } as any;
    }

    if (profile?.status === "BANNED" && !isGod) {
        return {
            ...baseContext,
            isAuthenticated: true,
            id: session.user.id,
            name: displayName,
            image: session.user.image || undefined,
            isMember: false,
            guildName: guildConfig?.name || "Serveur Inconnu",
            isBanned: true,
            scheduledDeletion: profile.scheduledDeletion?.toISOString() || null
        } as any;
    }

    // --- AUTO-ARCHIVE ---
    if (guildConfig && !memberRes.ok && profile && profile.status === "ACTIVE") {
        if (memberRes.status === 404) {
            // Member left or was kicked from Discord -> Auto-archive on platform
            const scheduledDeletion = new Date();
            scheduledDeletion.setDate(scheduledDeletion.getDate() + 30); // 30 days retention

            await db.userProfile.update({
                where: { id: profile.id },
                data: {
                    status: "ARCHIVED",
                    archivedAt: new Date(),
                    archiveReason: "LEFT_GUILD",
                    scheduledDeletion
                }
            });

            if (!isGod) return {
                ...baseContext,
                isAuthenticated: true,
                isMember: false,
                isArchived: true,
                guildName: guildConfig?.name || "Serveur Inconnu",
                scheduledDeletion: scheduledDeletion.toISOString()
            } as any;
        }
    }

    // --- NON-MEMBER CHECK (Not on Discord and not already handled) ---
    if (!memberRes.ok) {
        return {
            ...baseContext,
            isAuthenticated: true,
            id: session.user.id,
            name: displayName,
            isMember: isGod, // Only Gods can see dashboards of guilds they aren't in
            isArchived: profile?.status === "ARCHIVED",
            isBanned: profile?.status === "BANNED",
            // If God, grant all perms even if not in Discord
            ...(isGod ? {
                isAdmin: true,
                canViewMissions: true,
                canManageMissions: true,
                canValidateMissions: true,
                canManageBonus: true,
                canViewRoster: true,
                canViewSonges: true,
                canCreateSonges: true,
                canJoinSonges: true,
                canViewArchis: true,
                canViewPolls: true,
                canManagePolls: true,
                canViewLadder: true,
                canEditPresentation: true,
                canViewCalendar: true,
                canManageCalendar: true,
                canViewAdminDocs: true,
                canViewDashboard: true,
                canViewPresentation: true,
                canViewStats: true,
                canViewServices: true,
                canCreateServices: true,
                canViewFinder: true,
                canViewProfile: true,
                canManageMembers: true,
                canViewQuests: true,
                canManageQuests: true,
                canViewWorldmap: true,
                canManageWorldmap: true,
                canViewResources: true,
                canManageResources: true,
                roleName: "Administrateur",
                roleColor: 0x5865F2,
            } : {})
        } as any;
    }

    // --- CAPACITY CHECK ---
    if (guildConfig && memberRes.ok && member) {
        if (!profile || profile.status !== "ACTIVE") {
            const activeMemberCount = await db.userProfile.count({
                where: { guildId: guildConfig.id, status: "ACTIVE" }
            });
            const maxMembers = (guildConfig as any).maxMembers || 350;

            if (activeMemberCount >= maxMembers) {
                return {
                    ...baseContext,
                    isAuthenticated: true,
                    id: session.user.id,
                    name: displayName,
                    isMember: true,
                    isCapacityFull: true
                };
            }
        }

        // Upsert Profile — only for brand new members (no profile yet)
        const now = new Date();
        const joinedAt = member.joined_at ? new Date(member.joined_at) : null;

        if (!profile) {
            // NEW MEMBER — first time on the platform
            try {
                profile = await db.userProfile.upsert({
                    where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } },
                    create: {
                        userId: session.user.id,
                        guildId: guildConfig.id,
                        discordNickname: displayName,
                        discordRoleName: roleName,
                        discordRoleColor: roleColor,
                        discordJoinedAt: joinedAt,
                        discordCacheUpdatedAt: now,
                        lastActivityAt: now,
                    },
                    update: {
                        // If profile exists but was somehow missed, only update Discord cache — NOT status
                        discordNickname: displayName,
                        discordRoleName: roleName,
                        discordRoleColor: roleColor,
                        discordJoinedAt: joinedAt || undefined,
                        discordCacheUpdatedAt: now,
                        lastActivityAt: now,
                    }
                });
            } catch (e) {
                if (!profile) {
                    profile = await db.userProfile.findUnique({
                        where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } }
                    });
                }
            }
        } else {
            // EXISTING ACTIVE member — just refresh Discord cache + heartbeat
            try {
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: {
                        lastActivityAt: now,
                        discordNickname: displayName,
                        discordRoleName: roleName,
                        discordRoleColor: roleColor,
                        discordCacheUpdatedAt: now,
                    }
                });
            } catch { }
        }
    }

    // 3. Permissions
    const mapping = (guildConfig?.rolesMapping as Record<string, PermissionId[]>) || {};
    const myPerms = new Set<PermissionId>();
    memberRoles.forEach(rId => {
        const perms = mapping[rId];
        if (perms) perms.forEach(p => myPerms.add(p));
    });

    const hasDiscordAdmin = myRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
    const isAdmin = myPerms.has(PERMISSIONS.ADMIN_ACCESS) || hasDiscordAdmin;

    const canViewMissions = myPerms.has(PERMISSIONS.MISSIONS_VIEW) || isAdmin;
    const canManageMissions = myPerms.has(PERMISSIONS.MISSIONS_CREATE) || isAdmin;
    const canValidateMissions = myPerms.has(PERMISSIONS.MISSIONS_VALIDATE) || isAdmin;
    const canManageBonus = myPerms.has(PERMISSIONS.BONUS_MANAGE) || isAdmin;
    const canViewRoster = myPerms.has(PERMISSIONS.PROFILE_VIEW_ALL) || isAdmin;
    const canViewSonges = myPerms.has(PERMISSIONS.SONGES_VIEW) || isAdmin;
    const canCreateSonges = myPerms.has(PERMISSIONS.SONGES_CREATE) || isAdmin;
    const canJoinSonges = myPerms.has(PERMISSIONS.SONGES_JOIN) || isAdmin;
    const canViewArchis = myPerms.has(PERMISSIONS.ARCHIS_VIEW) || isAdmin;
    const canViewLadder = myPerms.has(PERMISSIONS.LADDER_VIEW) || isAdmin;
    const canEditPresentation = myPerms.has(PERMISSIONS.PRESENTATION_EDIT) || isAdmin;
    const canViewCalendar = myPerms.has(PERMISSIONS.CALENDAR_VIEW) || isAdmin;
    const canManageCalendar = myPerms.has(PERMISSIONS.CALENDAR_MANAGE) || isAdmin;
    const canViewAdminDocs = myPerms.has(PERMISSIONS.DOCS_VIEW_ADMIN) || isAdmin;
    const canViewDashboard = myPerms.has(PERMISSIONS.DASHBOARD_VIEW) || isAdmin;
    const canViewPresentation = myPerms.has(PERMISSIONS.PRESENTATION_VIEW) || isAdmin;
    const canViewStats = myPerms.has(PERMISSIONS.STATS_VIEW) || isAdmin;
    const canViewServices = myPerms.has(PERMISSIONS.SERVICES_VIEW) || isAdmin;
    const canCreateServices = myPerms.has(PERMISSIONS.SERVICES_CREATE) || isAdmin;
    const canViewFinder = myPerms.has(PERMISSIONS.FINDER_VIEW) || isAdmin;
    const canViewProfile = myPerms.has(PERMISSIONS.PROFILE_VIEW) || isAdmin;
    const canManageMembers = myPerms.has(PERMISSIONS.MEMBER_MANAGE) || isAdmin;
    const canViewPolls = myPerms.has(PERMISSIONS.POLLS_VIEW) || isAdmin;
    const canManagePolls = myPerms.has(PERMISSIONS.POLLS_MANAGE) || isAdmin;
    // Coming Soon
    const canViewQuests = myPerms.has(PERMISSIONS.QUESTS_VIEW) || isAdmin;
    const canManageQuests = myPerms.has(PERMISSIONS.QUESTS_MANAGE) || isAdmin;
    const canViewWorldmap = myPerms.has(PERMISSIONS.WORLDMAP_VIEW) || isAdmin;
    const canManageWorldmap = myPerms.has(PERMISSIONS.WORLDMAP_MANAGE) || isAdmin;
    const canViewResources = myPerms.has(PERMISSIONS.RESOURCES_VIEW) || isAdmin;
    const canManageResources = myPerms.has(PERMISSIONS.RESOURCES_MANAGE) || isAdmin;

    const isAdminFinal = isAdmin || isGod;

    return {
        isAuthenticated: true,
        id: session.user.id,
        name: displayName,
        image: member?.user?.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUserId}/${member.user.avatar}.png`
            : member?.avatar
                ? `https://cdn.discordapp.com/guilds/${effectiveGuildId}/users/${discordUserId}/avatars/${member.avatar}.png`
                : session.user.image || undefined,
        roleName: isGod && roleName === "Membre" ? "Administrateur" : roleName,
        roleColor: isGod && roleColor === 0 ? 0x5865F2 : roleColor,
        canViewMissions: canViewMissions || isGod,
        canManageMissions: canManageMissions || isGod,
        canValidateMissions: canValidateMissions || isGod,
        canManageBonus: canManageBonus || isGod,
        canViewRoster: canViewRoster || isGod,
        canViewSonges: canViewSonges || isGod,
        canCreateSonges: canCreateSonges || isGod,
        canJoinSonges: canJoinSonges || isGod,
        canViewArchis: canViewArchis || isGod,
        canViewPolls: canViewPolls || isGod,
        canManagePolls: canManagePolls || isGod,
        canViewLadder: canViewLadder || isGod,
        canEditPresentation: canEditPresentation || isGod,
        canViewCalendar: canViewCalendar || isGod,
        canManageCalendar: canManageCalendar || isGod,
        canViewAdminDocs: canViewAdminDocs || isGod,
        canManageMembers: canManageMembers || isGod,
        canViewDashboard: canViewDashboard || isGod,
        canViewPresentation: canViewPresentation || isGod,
        canViewStats: canViewStats || isGod,
        canViewServices: canViewServices || isGod,
        canCreateServices: canCreateServices || isGod,
        canViewFinder: canViewFinder || isGod,
        canViewDocs: true, // Open access as requested
        canViewProfile: canViewProfile || isGod,
        canViewQuests: canViewQuests || isGod,
        canManageQuests: canManageQuests || isGod,
        canViewWorldmap: canViewWorldmap || isGod,
        canManageWorldmap: canManageWorldmap || isGod,
        canViewResources: canViewResources || isGod,
        canManageResources: canManageResources || isGod,
        isAdmin: isAdminFinal,
        isSuperAdmin: isGod,
        isMember: true,
        isCapacityFull: false,
        profileId: profile?.id,
        guildName: guildConfig?.name || "Serveur Inconnu",
        dofusServerId: guildConfig?.dofusServerId,
        joinedAt: memberRes.ok && member?.joined_at ? new Date(member.joined_at).toISOString() : null,
        guildId: effectiveGuildId
    };
}

/**
 * Get all guilds where the user has an active profile.
 * Used for the guild switcher (multi-tenant support).
 */
export async function getUserGuilds() {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        const profiles = await db.userProfile.findMany({
            where: {
                userId: session.user.id,
                status: "ACTIVE"
            },
            include: {
                guild: {
                    select: {
                        discordGuildId: true,
                        name: true,
                        iconUrl: true
                    }
                }
            },
            orderBy: {
                guild: {
                    name: 'asc'
                }
            }
        });

        return profiles.map(p => ({
            id: p.guild.discordGuildId,
            name: p.guild.name,
            iconUrl: p.guild.iconUrl
        }));
    } catch (error) {
        console.error("Error fetching user guilds:", error);
        return [];
    }
}

export async function searchGuildMembers(
    discordGuildId: string,
    query: string
): Promise<ActionResponse<any[]>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const { requireGuildMember } = await import("./guards");
    const guard = await requireGuildMember(discordGuildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error };

    if (!query || query.length < 2) return { success: true, data: [] };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guild not found" };

        const members = await db.userProfile.findMany({
            where: {
                guildId: guildConfig.id,
                status: "ACTIVE",
                OR: [
                    { discordNickname: { contains: query, mode: "insensitive" } },
                    { pseudoDofus: { contains: query, mode: "insensitive" } },
                    { user: { name: { contains: query, mode: "insensitive" } } }
                ]
            },
            take: 10,
            select: {
                id: true,
                discordNickname: true,
                pseudoDofus: true,
                user: {
                    select: {
                        image: true,
                        name: true
                    }
                }
            }
        });

        const formatted = members.map(m => ({
            id: m.id,
            name: m.pseudoDofus || m.discordNickname || m.user.name || "Inconnu",
            subtitle: m.discordNickname !== m.pseudoDofus ? m.discordNickname : undefined,
            image: m.user.image
        }));

        return { success: true, data: formatted };
    } catch (error) {
        console.error("Search Members Error:", error);
        return { success: false, error: "Search failed" };
    }
}

// ============================================
// PERMISSION HELPERS
// ============================================

export async function internalCheckPermission(
    guildId: string,
    discordUserId: string,
    permission: PermissionId
): Promise<boolean> {
    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return false;

        const { fetchGuildMember, fetchGuildRoles, fetchGuild } = await import("@/server/discord");
        const member = await fetchGuildMember(guildId, discordUserId);
        if (!member) return false;

        const guildInfo = await fetchGuild(guildId);
        if (guildInfo.owner_id === discordUserId) return true;

        const guildRoles = await fetchGuildRoles(guildId);
        const memberRoles = guildRoles.filter(r => member.roles.includes(r.id));
        const isDiscordAdmin = memberRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
        if (isDiscordAdmin) return true;

        const mapping = (guildConfig.rolesMapping || {}) as Record<string, PermissionId[]>;

        // Collect all permissions from all roles  
        const allPerms = new Set<PermissionId>();
        member.roles.forEach((roleId: string) => {
            const perms = mapping[roleId];
            if (perms) perms.forEach((p: PermissionId) => allPerms.add(p));
        });

        // ADMIN_ACCESS grants all permissions (fallback)
        if (allPerms.has(PERMISSIONS.ADMIN_ACCESS)) return true;

        // Check specific permission
        return allPerms.has(permission);
    } catch (e) {
        console.error(`[InternalPermissionCheck] Error for ${discordUserId}: `, e);
        return false;
    }
}

export async function checkGuildPermission(
    session: any,
    guildId: string,
    permission: PermissionId
): Promise<{ allowed: boolean; error?: string }> {
    if (!session?.user?.id) return { allowed: false, error: "Unauthorized" };

    const account = await db.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
        select: { providerAccountId: true }
    });
    if (!account) return { allowed: false, error: "No Discord account linked" };

    // Platform Guard: Is the guild allowed/active?
    const { isGuildAllowed } = await import("./super-admin-actions");
    const allowedPlatform = await isGuildAllowed(guildId);
    if (!allowedPlatform) return { allowed: false, error: "This guild is currently deactivated or banned." };

    const allowed = await internalCheckPermission(guildId, account.providerAccountId, permission);

    if (allowed) return { allowed: true };
    return { allowed: false, error: "Insufficient Permissions" };
}

/**
 * Get detailed member statistics for a guild (Admin/God view)
 */
export async function getGuildMemberStats(guildId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const { requireGuildMember } = await import("./guards");
    const guard = await requireGuildMember(guildId);
    if (!guard.isAuthorized) throw new Error(guard.error || "Prohibited");

    // 1. Get Guild Config (for maxMembers)
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { maxMembers: true, id: true }
    });

    if (!guildConfig) throw new Error("Guild not found");

    // 2. Count by status
    const [active, archived, banned] = await Promise.all([
        db.userProfile.count({ where: { guildId: guildConfig.id, status: "ACTIVE" } }),
        db.userProfile.count({ where: { guildId: guildConfig.id, status: "ARCHIVED" } }),
        db.userProfile.count({ where: { guildId: guildConfig.id, status: "BANNED" } })
    ]);

    return {
        active,
        archived,
        banned,
        total: active + archived + banned,
        maxMembers: (guildConfig as any).maxMembers || 350
    };
}

/**
 * Get all members for a guild with filtered profiles
 */
export async function getGuildMembers(guildId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true, name: true }
    });

    if (!guildConfig) throw new Error("Guild not found");

    // SECURITY: Must be admin to list all members with detailed status
    const user = await getUserContext(guildId);
    if (!user.isAdmin) throw new Error("Forbidden: Admin access required");

    const members = await db.userProfile.findMany({
        where: { guildId: guildConfig.id },
        include: {
            user: {
                select: {
                    name: true,
                    image: true,
                    accounts: {
                        where: { provider: "discord" },
                        select: { providerAccountId: true }
                    }
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    // Return only the fields needed by MemberManagementTable
    // (avoid spreading the full Prisma object which contains non-serializable JsonValue symbols)
    return members.map(m => ({
        id: m.id,
        userId: m.userId,
        status: m.status as "ACTIVE" | "ARCHIVED" | "BANNED",
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        archivedAt: m.archivedAt?.toISOString() || null,
        archiveReason: m.archiveReason,
        pseudoDofus: m.pseudoDofus,
        discordNickname: m.discordNickname,
        user: {
            name: m.user.name,
            image: m.user.image,
            accounts: m.user.accounts
        }
    }));
}

/**
 * Manually update a member's status (Archive/Reactivate/Ban)
 */
export async function updateMemberProfileStatus(
    profileId: string,
    status: "ACTIVE" | "ARCHIVED" | "BANNED",
    reason?: string
) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    // 1. Get profile to find guildId
    const profile = await db.userProfile.findUnique({
        where: { id: profileId },
        include: { guild: { select: { discordGuildId: true } } }
    });

    if (!profile) throw new Error("Profile not found");

    // 2. SECURITY: Check if actor is Admin of THIS guild
    const actor = await getUserContext(profile.guild.discordGuildId);
    if (!actor.isAdmin) throw new Error("Forbidden: Admin access required");

    // 3. Prevent self-archiving if last admin (optional check, better stay safe)
    if (status !== "ACTIVE" && profile.userId === session.user.id) {
        throw new Error("Vous ne pouvez pas modifier votre propre statut (Protection anti-lockout)");
    }

    // 4. Update with retention policy
    const scheduledDeletion = status === "ACTIVE"
        ? null
        : status === "BANNED"
            ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h for BANNED
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d for ARCHIVED

    const updated = await db.userProfile.update({
        where: { id: profileId },
        data: {
            status,
            archivedAt: status !== "ACTIVE" ? new Date() : null,
            archiveReason: status !== "ACTIVE" ? (reason || "MANUAL_ADMIN_ACTION") : null,
            scheduledDeletion
        }
    });

    // 5. Audit Log (SKIP IF SUPER-ADMIN for stealth)
    const { isSuperAdmin } = await import("@/server/actions/super-admin-actions");
    const isGod = await isSuperAdmin();

    if (!isGod) {
        await db.auditLog.create({
            data: {
                guildId: profile.guildId,
                actorUserId: session.user.id as string,
                actorName: session.user.name || "Admin",
                action: `MEMBER_STATUS_${status}`,
                targetType: "PROFILE",
                targetId: profileId,
                oldValue: { status: profile.status } as any,
                newValue: { status } as any,
                metadata: { reason: reason || "No reason" } as any
            }
        });
    }

    revalidatePath(`/dashboard/${profile.guild.discordGuildId}/admin/settings`);

    // Emit activity feed event
    const targetProfile = await db.userProfile.findUnique({
        where: { id: profileId },
        select: { discordNickname: true, pseudoDofus: true, user: { select: { name: true, image: true } } }
    });
    const targetName = targetProfile?.pseudoDofus || targetProfile?.discordNickname || targetProfile?.user?.name || "Membre";
    const activityType = status === "BANNED" ? "BANNED" : status === "ARCHIVED" ? "ARCHIVED" : "UNARCHIVED";
    await emitGuildActivity(
        profile.guildId,
        activityType,
        targetName,
        targetProfile?.user?.image ?? null,
        reason ? { reason } : undefined
    ).catch(() => { });

    return updated;
}

/**
 * Update a member's Dofus pseudo (Admin only)
 */
export async function updateMemberPseudo(profileId: string, pseudoDofus: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const profile = await db.userProfile.findUnique({
        where: { id: profileId },
        include: { guild: { select: { discordGuildId: true } } }
    });

    if (!profile) throw new Error("Profile not found");

    const actor = await getUserContext(profile.guild.discordGuildId);
    if (!actor.isAdmin) throw new Error("Forbidden: Admin access required");

    const updated = await db.userProfile.update({
        where: { id: profileId },
        data: { pseudoDofus }
    });

    // Audit log
    const { isSuperAdmin } = await import("@/server/actions/super-admin-actions");
    const isGod = await isSuperAdmin();

    if (!isGod) {
        await db.auditLog.create({
            data: {
                guildId: profile.guildId,
                actorUserId: session.user.id as string,
                actorName: session.user.name || "Admin",
                action: "MEMBER_PSEUDO_UPDATE",
                targetType: "PROFILE",
                targetId: profileId,
                oldValue: { pseudo: profile.pseudoDofus } as any,
                newValue: { pseudo: pseudoDofus } as any,
            }
        });
    }

    revalidatePath(`/dashboard/${profile.guild.discordGuildId}/admin/settings`);
    return { success: true, data: updated };
}

export async function getDiscordRolesAction(guildId: string) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    // Security: Must be admin to access role configuration settings
    const user = await getUserContext(guildId);
    if (!user.isAdmin) return { success: false, error: "Forbidden: Admin access required" };

    try {
        const roles = await fetchGuildRoles(guildId, { excludeManaged: true });
        return {
            success: true,
            data: roles.map(r => ({
                id: r.id,
                name: r.name,
                color: r.color
            }))
        };
    } catch (error) {
        console.error("Get Discord Roles Error:", error);
        return { success: false, error: "Erreur lors de la récupération des rôles" };
    }
}
