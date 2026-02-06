"use server";

import { auth } from "@/auth";
import { fetchGuildRoles, fetchGuild } from "@/server/discord";
import { db } from "@/lib/prisma";
import { PERMISSIONS, type PermissionId } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

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
    isAdmin: boolean;
    isMember: boolean;
    guildName?: string;
    dofusServerId?: string | null;
    joinedAt?: Date | null;
};

export async function getUserContext(guildId?: string): Promise<UserContext> {
    const session = await auth();

    if (!session?.user?.id) {
        return { isAuthenticated: false, isAdmin: false, isMember: false, canViewMissions: false, canManageMissions: false, canValidateMissions: false, canViewRoster: false, canViewSonges: false, canCreateSonges: false, canJoinSonges: false, canViewArchis: false, canViewLadder: false, canEditPresentation: false, canViewCalendar: false, canManageCalendar: false };
    }

    const targetGuildId = guildId || process.env.DISCORD_GUILD_ID;
    if (!targetGuildId) return { isAuthenticated: true, isAdmin: false, isMember: false, canViewMissions: false, canManageMissions: false, canValidateMissions: false, canViewRoster: false, canViewSonges: false, canCreateSonges: false, canJoinSonges: false, canViewArchis: false, canViewLadder: false, canEditPresentation: false, canViewCalendar: false, canManageCalendar: false };

    // --- SECURITY: DEEP WHITELIST CHECK (Database-based) ---
    const { isGuildAllowed } = await import("@/server/actions/super-admin-actions");
    const allowed = await isGuildAllowed(targetGuildId);
    if (!allowed) {
        console.warn(`[Security] Blocked access to unauthorized guild: ${targetGuildId}`);
        return { isAuthenticated: false, isAdmin: false, isMember: false, canViewMissions: false, canManageMissions: false, canValidateMissions: false, canViewRoster: false, canViewSonges: false, canCreateSonges: false, canJoinSonges: false, canViewArchis: false, canViewLadder: false, canEditPresentation: false, canViewCalendar: false, canManageCalendar: false };
    }

    // 1. Get Guild Config for Mappings
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: targetGuildId },
        select: { id: true, rolesMapping: true, name: true, dofusServerId: true }
    });

    // 2. Fetch User's Roles from Discord
    // We need the Discord Provider Account ID, not the internal User ID
    const account = await db.account.findFirst({
        where: {
            userId: session.user.id,
            provider: "discord"
        },
        select: { providerAccountId: true }
    });

    if (!account) {
        // User has no connected discord account? Should happen rarely if logged in via Discord
        return { isAuthenticated: true, isAdmin: false, isMember: false, canViewMissions: false, canManageMissions: false, canValidateMissions: false, canViewRoster: false, canViewSonges: false, canCreateSonges: false, canJoinSonges: false, canViewArchis: false, canViewLadder: false, canEditPresentation: false, canViewCalendar: false, canManageCalendar: false };
    }

    const discordUserId = account.providerAccountId;

    // --- ENSURE USER PROFILE EXISTS ---
    // If user is logged in and in a valid guild, they should have a profile
    let profile = await db.userProfile.findUnique({
        where: {
            userId_guildId: {
                userId: session.user.id,
                guildId: guildConfig?.id || ""
            }
        }
    });

    // Profile creation/update will happen after we fetch Discord member data
    // to ensure discordJoinedAt is properly set

    // Parallelize Discord API calls for performance
    const token = process.env.DISCORD_BOT_TOKEN;

    const [memberRes, guildInfo, allRoles] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${targetGuildId}/members/${discordUserId}`, {
            headers: { Authorization: `Bot ${token}` },
            cache: 'no-store' // No cache - always check live membership status for security
        }),
        fetchGuild(targetGuildId).catch(() => null),
        fetchGuildRoles(targetGuildId, { excludeManaged: false }).catch(() => [])
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

        // Prioritize Server Nickname > Global Name > Username
        if (member.nick) {
            displayName = member.nick;
        } else if (member.user?.global_name) {
            displayName = member.user.global_name;
        } else if (member.user?.username) {
            displayName = member.user.username;
        }

        // Find user's roles in allRoles (which are sorted by position DESC)
        myRoles = allRoles.filter(r => memberRoles.includes(r.id));

        if (myRoles.length > 0) {
            const topRole = myRoles[0]; // First one is highest position
            roleName = topRole.name;
            roleColor = topRole.color;
        }

        // --- OVERRIDES ---
        // 1. Admin Override (if no specific role name was found or just "Membre")
        if (roleName === "Membre") {
            // Check for Administrator permission (0x8) in any role
            const isAdmin = myRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
            if (isAdmin) {
                roleName = "Administrateur";
                roleColor = 0x5865F2; // Discord Blurple
            }
        }
    }

    // --- AUTO-ARCHIVE: If user is no longer in Discord guild but has active profile ---
    // This handles the case where user left Discord but session is still valid
    if (guildConfig && !memberRes.ok && profile && profile.status === "ACTIVE") {
        // 404 = Member not found in guild = they left, were kicked, or banned
        if (memberRes.status === 404) {
            // Check if user is banned
            let isBanned = false;
            try {
                const banRes = await fetch(`https://discord.com/api/v10/guilds/${targetGuildId}/bans/${discordUserId}`, {
                    headers: { Authorization: `Bot ${token}` }
                });
                isBanned = banRes.ok; // 200 = banned, 404 = not banned
            } catch {
                // If ban check fails, assume not banned
            }

            if (isBanned) {
                console.log(`[UserContext] Member ${session.user.id} is BANNED from guild ${guildConfig.id}`);
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: {
                        status: "BANNED",
                        archivedAt: new Date(),
                        archiveReason: "BANNED",
                        // --- GDPR WIPE (Suppression des données lourdes) ---
                        pseudoDofus: "Utilisateur banni",
                        discordNickname: "Banni",
                        metamobPseudo: null,
                        metamobVerified: false,
                        altPseudos: Prisma.JsonNull,
                        availability: Prisma.JsonNull,
                        vacationStart: null,
                        vacationEnd: null,
                        vacationNotify: false,
                        succes: Prisma.JsonNull,
                        metiers: Prisma.JsonNull,
                        classeSecondaires: Prisma.JsonNull,
                        dofusBookLinks: Prisma.JsonNull,
                        lastActivityDesc: "Compte banni pour violation des règles du serveur. Données nettoyées."
                    }
                });
            } else {
                console.log(`[UserContext] Member ${session.user.id} left guild ${guildConfig.id}, archiving profile`);
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: {
                        status: "ARCHIVED",
                        archivedAt: new Date(),
                        archiveReason: "LEFT"
                    }
                });
            }

            // Return as non-member
            return { isAuthenticated: true, isAdmin: false, isMember: false, canViewMissions: false, canManageMissions: false, canValidateMissions: false, canViewRoster: false, canViewSonges: false, canCreateSonges: false, canJoinSonges: false, canViewArchis: false, canViewLadder: false, canEditPresentation: false, canViewCalendar: false, canManageCalendar: false };
        }
    }

    // --- ENSURE USER PROFILE EXISTS AND IS UP-TO-DATE ---
    // Now that we have member data, create or update the profile with Discord info
    if (guildConfig && memberRes.ok && member) {
        const joinedAt = member.joined_at ? new Date(member.joined_at) : null;
        const now = new Date();

        // If no profile or ARCHIVED, we use upsert to handle race conditions atomically
        if (!profile || profile.status === "ARCHIVED") {
            try {
                profile = await db.userProfile.upsert({
                    where: {
                        userId_guildId: {
                            userId: session.user.id,
                            guildId: guildConfig.id
                        }
                    },
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
                        status: "ACTIVE",
                        archivedAt: null,
                        archiveReason: null,
                        discordNickname: displayName,
                        discordRoleName: roleName,
                        discordRoleColor: roleColor,
                        discordJoinedAt: joinedAt || undefined,
                        discordCacheUpdatedAt: now,
                        lastActivityAt: now,
                    }
                });
                console.log(`[UserContext] Profile synchronized for ${session.user.id}`);
            } catch (e) {
                console.error("[UserContext] Failed to sync profile:", e);
                // Fallback: try to fetch it one last time if upsert failed weirdly
                if (!profile) {
                    profile = await db.userProfile.findUnique({
                        where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } }
                    });
                }
            }
        } else {
            // Profile exists and is ACTIVE. 
            // We keep the throttle logic (1 hour) to avoid unnecessary DB writes on every page load.
            const cacheAge = profile.discordCacheUpdatedAt
                ? now.getTime() - new Date(profile.discordCacheUpdatedAt).getTime()
                : Infinity;

            const shouldUpdateCache = cacheAge > 60 * 60 * 1000; // 1 hour

            // Always update lastActivityAt and fix missing discordJoinedAt
            const needsJoinedAtFix = !profile.discordJoinedAt && joinedAt;

            if (shouldUpdateCache || needsJoinedAtFix) {
                try {
                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: {
                            discordNickname: displayName,
                            discordRoleName: roleName,
                            discordRoleColor: roleColor,
                            discordJoinedAt: joinedAt || profile.discordJoinedAt, // Don't overwrite with null
                            discordCacheUpdatedAt: now,
                            lastActivityAt: now,
                        }
                    });
                } catch (e) {
                    console.error("[UserContext] Failed to update profile cache:", e);
                }
            } else {
                // Just update lastActivityAt for tracking
                try {
                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: { lastActivityAt: now }
                    });
                } catch {
                    // Silent fail for activity tracking
                }
            }
        }
    }

    // 3. Check Permissions
    const mapping = (guildConfig?.rolesMapping as Record<string, PermissionId[]>) || {};

    // Collect all perms from all roles
    const myPerms = new Set<PermissionId>();
    memberRoles.forEach(rId => {
        const perms = mapping[rId];
        if (perms) perms.forEach(p => myPerms.add(p));
    });


    // Fallback: If user has Discord "ADMINISTRATOR" permission (0x8), they are Admin.
    // This prevents lockout before roles are mapped.
    const hasDiscordAdmin = myRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
    const isAdmin = myPerms.has(PERMISSIONS.ADMIN_ACCESS) || hasDiscordAdmin;

    // Missions Permissions
    const canViewMissions = myPerms.has(PERMISSIONS.MISSIONS_VIEW) || isAdmin;
    const canManageMissions = myPerms.has(PERMISSIONS.MISSIONS_CREATE) || isAdmin;
    const canValidateMissions = myPerms.has(PERMISSIONS.MISSIONS_VALIDATE) || isAdmin;

    // Roster Permission
    const canViewRoster = myPerms.has(PERMISSIONS.PROFILE_VIEW_ALL) || isAdmin;

    // Songes Permissions
    const canViewSonges = myPerms.has(PERMISSIONS.SONGES_VIEW) || isAdmin;
    const canCreateSonges = myPerms.has(PERMISSIONS.SONGES_CREATE) || isAdmin;
    const canJoinSonges = myPerms.has(PERMISSIONS.SONGES_JOIN) || isAdmin;

    // Archis & Ladder Permissions
    const canViewArchis = myPerms.has(PERMISSIONS.ARCHIS_VIEW) || isAdmin;
    const canViewLadder = myPerms.has(PERMISSIONS.LADDER_VIEW) || isAdmin;

    // Presentation Permission
    const canEditPresentation = myPerms.has(PERMISSIONS.PRESENTATION_EDIT) || isAdmin;

    // Calendar Permissions
    const canViewCalendar = myPerms.has(PERMISSIONS.CALENDAR_VIEW) || isAdmin;
    const canManageCalendar = myPerms.has(PERMISSIONS.CALENDAR_MANAGE) || isAdmin;

    return {
        isAuthenticated: true,
        id: session.user.id,
        name: displayName,
        image: member?.user?.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUserId}/${member.user.avatar}.png`
            : member?.avatar
                ? `https://cdn.discordapp.com/guilds/${targetGuildId}/users/${discordUserId}/avatars/${member.avatar}.png`
                : session.user.image || undefined,
        roleName,
        roleColor,
        canViewMissions,
        canManageMissions,
        canValidateMissions,
        canViewRoster,
        canViewSonges,
        canCreateSonges,
        canJoinSonges,
        canViewArchis,
        canViewLadder,
        canEditPresentation,
        canViewCalendar,
        canManageCalendar,
        isAdmin,
        isMember: memberRes.ok,
        guildName: guildInfo?.name || guildConfig?.name || "Serveur Inconnu",
        dofusServerId: guildConfig?.dofusServerId,
        joinedAt: memberRes.ok && member?.joined_at ? new Date(member.joined_at) : null
    };
};

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

// ============================================
// PERMISSION HELPERS
// ============================================

async function internalCheckPermission(
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

    const allowed = await internalCheckPermission(guildId, account.providerAccountId, permission);

    if (allowed) return { allowed: true };
    return { allowed: false, error: "Insufficient Permissions" };
}
