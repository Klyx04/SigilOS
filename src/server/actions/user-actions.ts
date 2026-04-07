"use server";

import { auth } from "@/auth";
import { fetchGuildRoles, fetchGuild, fetchGuildMember } from "@/server/discord";
import { db } from "@/lib/prisma";
import { PERMISSIONS, type PermissionId } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { emitGuildActivity } from "./activity-actions";
import { PresenceManager } from "@/lib/presence";
import { isSuperAdmin, isGuildAllowed } from "@/server/actions/super-admin-actions";

// In-memory cache for user context paths that don't change often
// BUGFIX: Cache TTL réduit à 0 pour éviter les incohérences entre workers PM2/Docker.
// Le cache en Map() n'est pas partagé entre les processus Node — chaque worker a son état.
// React cache() (per-request) est suffisant pour éviter les requêtes redondantes dans un même render.
const configCache = new Map<string, { data: any, expiresAt: number }>();
const profileCache = new Map<string, { data: any, expiresAt: number }>();
const CACHE_TTL = 0; // Désactivé (0 = pas de cache inter-requêtes)

/**
 * Invalidate cache for a specific user in a specific guild
 */
export async function invalidateUserContextCache(userId: string, guildId?: string) {
    const profileCacheKey = `profile:${userId}:${guildId || ""}`;
    profileCache.delete(profileCacheKey);
}

/**
 * Invalidate cache for a whole guild configuration
 */
export async function invalidateGuildCache(guildId: string) {
    configCache.delete(`config:${guildId}`);
}

/**
 * Force a manual revalidation of the user context (clears caches)
 * Useful when a user just joined a Discord server.
 */
export async function revalidateUserContext(guildId?: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const userId = session.user.id;

    // 1. Clear In-memory caches
    const profileCacheKey = `profile:${userId}:${guildId || ""}`;
    profileCache.delete(profileCacheKey);

    // 2. Clear Discord cache (pattern based)
    const { invalidateDiscordCache } = await import("@/server/discord");
    invalidateDiscordCache(`member:${guildId || ""}:${userId}`);

    // 3. Clear Next.js tag-based cache (if any)
    revalidatePath(`/dashboard/${guildId || ""}`);

    return { success: true };
}

export type UserContext = {
    isAuthenticated: boolean;
    id?: string;
    name?: string;
    image?: string;
    roleName?: string;
    roleNames: string[];
    pseudo?: string;
    roleColor?: number;
    // Core Status & Section Visibility
    canViewDashboard: boolean;
    canViewPresentation: boolean;
    canViewWelcome: boolean;
    canViewStats: boolean;
    canViewDocs: boolean;
    canViewAdminDocs: boolean;
    canViewResources: boolean;
    canViewProfile: boolean;
    canManageMembers: boolean;
    // Modules
    canViewMissions: boolean;
    canManageMissions: boolean;
    canValidateMissions: boolean;
    canManageBonus: boolean;
    canViewRoster: boolean;
    canViewSonges: boolean;
    canCreateSonges: boolean;
    canJoinSonges: boolean;
    canViewOcre: boolean;
    canViewLadder: boolean;
    canSyncLadder: boolean;
    canViewQuests: boolean;
    canViewWorldmap: boolean;
    canViewFinder: boolean;
    canViewServices: boolean;
    canViewStuffGallery: boolean;
    canViewMiniGames: boolean;
    canViewPolls: boolean;
    canViewCalendar: boolean;
    canManageCalendar: boolean;
    canViewChat: boolean;
    canModerateChat: boolean;
    // Admin Tools
    canEditPresentation: boolean;
    canManageRelance: boolean;
    canManageRBAC: boolean;
    canViewSettings: boolean;
    canViewAuditLogs: boolean;
    // Global Access
    isAdmin: boolean;
    isDiscordAdmin: boolean;
    isSuperAdmin: boolean;
    isMember: boolean;
    // Data & Identity
    hasPseudoIssue: boolean;
    pseudoDofus?: string | null;
    ankamaId?: string | null;
    profileId?: string;
    guildName?: string;
    dofusServerId?: string | null;
    joinedAt?: string | null;
    guildId?: string;
    roles: string[];
    isCapacityFull?: boolean;
    scheduledDeletion?: string | null;
    createdAt?: string;
    metamobPseudo?: string | null;
    classe?: string | null;
    dofusLevel?: number | null;
    altPseudos?: any[] | null;
    newsBroadcastEnabled?: boolean;
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
        isDiscordAdmin: false,
        isSuperAdmin: false,
        isMember: false,
        canViewDashboard: false,
        canViewPresentation: false,
        canViewWelcome: false,
        canViewStats: false,
        canViewDocs: false,
        canViewAdminDocs: false,
        canViewResources: false,
        canViewProfile: false,
        canManageMembers: false,
        canViewMissions: false,
        canManageMissions: false,
        canValidateMissions: false,
        canManageBonus: false,
        canViewRoster: false,
        canViewSonges: false,
        canCreateSonges: false,
        canJoinSonges: false,
        canViewOcre: false,
        canViewLadder: false,
        canSyncLadder: false,
        canViewQuests: false,
        canViewWorldmap: false,
        canViewFinder: false,
        canViewServices: false,
        canViewStuffGallery: false,
        canViewMiniGames: false,
        canViewPolls: false,
        canViewCalendar: false,
        canManageCalendar: false,
        canViewChat: false,
        canModerateChat: false,
        canEditPresentation: false,
        canManageRelance: false,
        canManageRBAC: false,
        canViewSettings: false,
        canViewAuditLogs: false,
        hasPseudoIssue: false,
        roles: [],
        roleNames: [],
        newsBroadcastEnabled: true,
        metamobPseudo: null,
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
    if (!effectiveGuildId || !/^\d+$/.test(effectiveGuildId)) return { ...baseContext, ...authPartial };

    // --- SECURITY: SUPER ADMIN BYPASS ---
    const isGod = await isSuperAdmin();

    // 1. Get Guild Config for Mappings (with cache)
    const cacheKey = `config:${effectiveGuildId}`;
    let guildConfig = configCache.get(cacheKey)?.expiresAt && configCache.get(cacheKey)!.expiresAt > Date.now()
        ? configCache.get(cacheKey)!.data
        : null;

    if (!guildConfig) {
        guildConfig = await (db.guildConfig as any).findFirst({
            where: {
                OR: [
                    { id: effectiveGuildId },
                    { discordGuildId: effectiveGuildId }
                ]
            },
            select: {
                id: true,
                discordGuildId: true,
                rolesMapping: true,
                usersMapping: true,
                name: true,
                dofusServerId: true,
                welcomeEnabled: true,
                welcomeDashboardEnabled: true,
                welcomeDiscordEnabled: true,
                welcomeNotifyChannelId: true,
                welcomeMentionRoleId: true,
                welcomeMessageTemplate: true,
                welcomeDiscordMessageTemplate: true,
                welcomeBadgeName: true,
                newsBroadcastEnabled: true,
                modules: {
                    select: {
                        missions: true,
                        songes: true,
                        ocre: true,
                        ladder: true,
                        calendar: true,
                        services: true,
                        donjons: true,
                        docs: true,
                        profile: true,
                        roster: true,
                        stats: true,
                        presentation: true,
                        polls: true,
                        logs: true,
                        quests: true,
                        worldmap: true,
                        resources: true,
                        chat: true,
                        ladderSync: true,
                        minigames: true,
                    }
                }
            }
        });
        if (guildConfig) configCache.set(cacheKey, { data: guildConfig, expiresAt: Date.now() + CACHE_TTL });
    }

    const actualDiscordGuildId = guildConfig?.discordGuildId || effectiveGuildId;

    // --- SECURITY: DEEP WHITELIST CHECK ---
    const allowed = await isGuildAllowed(actualDiscordGuildId);

    // Only block if not allowed AND not a God
    if (!allowed && !isGod) {
        logger.warn(`[Security] Blocked access to unauthorized guild: ${actualDiscordGuildId}`);
        return { ...baseContext, isAuthenticated: false };
    }

    // 2. Get Discord ID — already stored in JWT token by auth.ts jwt() callback
    // This avoids a db.account.findFirst() on every single page load.
    let discordUserId = (session as any).user?.discordId as string | undefined;
    if (!discordUserId) {
        // Fallback: fetch from DB for old sessions created before discordId was stored in JWT
        const account = await db.account.findFirst({
            where: { userId: session.user.id, provider: "discord" },
            select: { providerAccountId: true }
        });
        if (!account) return { ...baseContext, ...authPartial };
        discordUserId = account.providerAccountId;
    }


    // --- PLATFORM SECURITY: BAN CHECK ---
    const platformBan = await db.platformBan.findUnique({
        where: { discordId: discordUserId }
    });
    if (platformBan && platformBan.entityType === "USER" && !isGod) {
        logger.warn(`[Security] Blocked access for PLATFORM BANNED user: ${discordUserId}`);
        return { ...baseContext, isAuthenticated: false };
    }

    // --- ENSURE USER PROFILE EXISTS ---
    const profileCacheKey = `profile:${session.user.id}:${guildConfig?.id || ""}`;
    let profile = profileCache.get(profileCacheKey)?.expiresAt && profileCache.get(profileCacheKey)!.expiresAt > Date.now()
        ? profileCache.get(profileCacheKey)!.data
        : null;

    if (!profile) {
        profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: guildConfig?.id || ""
                }
            }
        });
        if (profile) profileCache.set(profileCacheKey, { data: profile, expiresAt: Date.now() + CACHE_TTL });
    }

    const [member, guildInfo, allRoles] = await Promise.all([
        fetchGuildMember(actualDiscordGuildId, discordUserId),
        fetchGuild(actualDiscordGuildId).catch(() => null),
        fetchGuildRoles(actualDiscordGuildId, { excludeManaged: false }).catch(() => [])
    ]);

    let memberRoles: string[] = [];
    let myRoles: any[] = [];
    let roleColor = 0;
    let roleName = "Membre";
    let displayName = session.user.name || "Voyageur";

    if (member) {
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
            const hasAdminRole = myRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
            const isOwner = guildInfo && guildInfo.owner_id === discordUserId;

            if (hasAdminRole || isOwner) {
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

    // --- AUTO-ARCHIVE DETECTION (Legacy) ---
    // Note: We don't perform DB mutation here anymore to avoid "Mutation during render" errors.
    // The UI handles !member by blocking access. Actual DB archival happens via admin sync.
    if (guildConfig && !member && profile && profile.status === "ACTIVE") {
        if (!isGod) return {
            ...baseContext,
            isAuthenticated: true,
            isMember: false,
            isArchived: true,
            guildName: guildConfig?.name || "Serveur Inconnu",
            scheduledDeletion: null // Will be set upon actual archival via sync
        } as any;
    }


    // --- NON-MEMBER CHECK (Not on Discord and not already handled) ---
    if (!member) {
        return {
            ...baseContext,
            isAuthenticated: true,
            id: session.user.id,
            name: displayName,
            isMember: isGod, // Only Gods can see dashboards of guilds they aren't in
            isArchived: profile?.status === "ARCHIVED",
            isBanned: profile?.status === "BANNED",
            guildName: guildConfig?.name || "Serveur Inconnu",
            // If God, grant all perms even if not in Discord
            ...(isGod ? {
                isAdmin: true,
                canManageMembers: true,
                canViewStats: true,
                canViewMissions: true,
                canManageMissions: true,
                canValidateMissions: true,
                canManageBonus: true,
                canViewGameFeatures: true,
                canViewLadder: true,
                canSyncLadder: true,
                canViewOcre: true,
                canViewFinder: true,
                canViewSonges: true,
                canCreateSonges: true,
                canJoinSonges: true,
                canEditPresentation: true,
                canViewDocs: true,
                canViewAdminDocs: true,
                canViewCalendar: true,
                canManageCalendar: true,
                canViewChat: true,
                canModerateChat: true,
                canViewRoster: true,
                canViewQuests: true,
                canManageQuests: true,
                canViewWorldmap: true,
                canManageWorldmap: true,
                roleName: "Administrateur",
                roleColor: 0x5865F2,
            } : {})
        } as any;
    }

    // --- CAPACITY CHECK ---
    if (guildConfig && member) {
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

        // NOTE: Profile creation is DEFERRED until after the DASHBOARD_ACCESS gatekeeper below.
        // This prevents unauthorized Discord members from getting auto-provisioned profiles.
    }

    // 1. Roles & Admin check
    const rolesMapping = (guildConfig?.rolesMapping as Record<string, PermissionId[]>) || {};
    const individualMapping = (guildConfig?.usersMapping as Record<string, PermissionId[]>) || {};
    
    const hasDiscordAdminRole = myRoles.some(r => (BigInt(r.permissions || 0) & 0x8n) === 0x8n);
    const isOwner = guildInfo && guildInfo.owner_id === discordUserId;
    const hasDiscordAdmin = hasDiscordAdminRole || isOwner;
    
    // MASTER ADMIN: Must be checked against the USER'S OWN roles, not all guild roles
    const userHasAdminPermission = memberRoles.some(rId => {
        const perms = rolesMapping[rId];
        return perms && perms.includes(PERMISSIONS.ADMIN_FULL);
    });
    const isAdmin = userHasAdminPermission || hasDiscordAdmin || isGod;
    const isAdminFinal = isAdmin;

    // 2. Authorization Check (The Gatekeeper) — STRICT DENY-BY-DEFAULT
    // A role MUST have DASHBOARD_ACCESS explicitly to pass. No legacy fallback.
    const hasAuthorizedRole = memberRoles.some(rId => {
        const perms = rolesMapping[rId];
        if (!perms || perms.length === 0) return false;
        return perms.includes(PERMISSIONS.DASHBOARD_ACCESS);
    });
    const isAuthorizedMember = hasAuthorizedRole || isAdminFinal;

    if (!member || !isAuthorizedMember) {
        return {
            ...baseContext,
            isAuthenticated: true,
            id: session.user.id,
            name: displayName,
            isMember: isGod,
            guildName: guildConfig?.name || "Serveur Inconnu",
            canViewDashboard: false,
            error: !isGod ? "Vous n'avez pas de rôle autorisé." : undefined
        } as any;
    }

    // 3. User Profile Creation / Maintenance
    // Track whether the profile already existed to prevent welcome spam
    const profileAlreadyExisted = !!profile;
    if (guildConfig && member && isAuthorizedMember) {
        const now = new Date();
        const joinedAt = member.joined_at ? new Date(member.joined_at) : null;

        if (!profile) {
            try {
                profile = await db.userProfile.create({
                    data: {
                        userId: session.user.id,
                        guildId: guildConfig.id,
                        discordNickname: displayName,
                        discordRoleName: roleName,
                        discordRoleColor: roleColor,
                        discordJoinedAt: joinedAt,
                        discordCacheUpdatedAt: now,
                        lastActivityAt: now,
                    }
                });

                // Audit & Onboarding — ONLY on genuine first-time creation (not P2002 fallback)
                (async () => {
                   try {
                       const { createAuditLog } = await import("./audit-actions");
                       await createAuditLog({
                           guildId: actualDiscordGuildId,
                           actorUserId: "SYSTEM",
                           actorName: "Platform System",
                           action: "PLATFORM_ARRIVAL",
                           targetType: "PROFILE",
                           targetId: profile!.id,
                           metadata: { description: displayName },
                           newValue: { displayName, roleName, discordJoinedAt: joinedAt }
                       });
                       if (guildConfig.welcomeEnabled) {
                           const { sendWelcomeNotifications } = await import("@/server/actions/onboarding-actions");
                           await sendWelcomeNotifications(guildConfig, profile!.id, displayName);
                       }
                   } catch (e) {
                       console.error("[UserContext] Arrival processing error:", e);
                   }
                })();
            } catch (e: any) {
                if (e.code === 'P2002') {
                    // Profile already exists (race condition) — read it, do NOT re-send welcome
                    profile = await db.userProfile.findUnique({
                        where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } }
                    });
                }
            }
        } else {
            try { await PresenceManager.updatePresence(guildConfig.id, session.user.id); } catch { }
        }
    }

    // 4. Permissions Calculation
    const permissionSet = new Set<PermissionId>();
    memberRoles.forEach(rId => {
        const perms = rolesMapping[rId];
        if (perms) perms.forEach(p => permissionSet.add(p));
    });

    const personalPerms = individualMapping[discordUserId];
    if (personalPerms) personalPerms.forEach(p => permissionSet.add(p));

    const canViewWelcome = permissionSet.has(PERMISSIONS.BIENVENUE_VIEW) || isAdminFinal || (Object.keys(rolesMapping).length === 0);
    const canViewPresentation = true;
    const canEditPresentation = permissionSet.has(PERMISSIONS.PRESENTATION_EDIT) || isAdminFinal;
    const canViewStats = permissionSet.has(PERMISSIONS.STATS_VIEW) || isAdminFinal;
    const canViewDocs = permissionSet.has(PERMISSIONS.DOCS_VIEW) || isAdminFinal;
    const canViewAdminDocs = permissionSet.has(PERMISSIONS.DOCS_VIEW_ADMIN) || isAdminFinal;
    const canViewRoster = permissionSet.has(PERMISSIONS.MEMBER_VIEW_ALL) || isAdminFinal;
    const canManageMembers = permissionSet.has(PERMISSIONS.MEMBER_MANAGE) || isAdminFinal;
    const canViewMissions = permissionSet.has(PERMISSIONS.MISSIONS_VIEW) || isAdminFinal;
    const canManageMissions = permissionSet.has(PERMISSIONS.MISSIONS_MANAGE) || isAdminFinal;
    const canValidateMissions = permissionSet.has(PERMISSIONS.MISSIONS_VALIDATE) || isAdminFinal;
    const canManageBonus = permissionSet.has(PERMISSIONS.MISSIONS_MANAGE) || isAdminFinal;
    const canViewSonges = permissionSet.has(PERMISSIONS.SONGES_VIEW) || isAdminFinal;
    const canCreateSonges = permissionSet.has(PERMISSIONS.SONGES_CREATE) || isAdminFinal;
    const canJoinSonges = permissionSet.has(PERMISSIONS.SONGES_JOIN) || isAdminFinal;
    const canViewOcre = permissionSet.has(PERMISSIONS.OCRE_VIEW) || isAdminFinal;
    const canViewLadder = permissionSet.has(PERMISSIONS.LADDER_VIEW) || isAdminFinal;
    const canViewQuests = permissionSet.has(PERMISSIONS.QUESTS_VIEW) || isAdminFinal;
    const canViewWorldmap = permissionSet.has(PERMISSIONS.WORLDMAP_VIEW) || isAdminFinal;
    const canViewDJQuests = permissionSet.has(PERMISSIONS.DJ_QUESTS_VIEW) || isAdminFinal;
    const canViewServices = permissionSet.has(PERMISSIONS.SERVICES_VIEW) || isAdminFinal;
    const canViewMiniGames = permissionSet.has(PERMISSIONS.MINIGAMES_VIEW) || isAdminFinal;
    const canViewCalendar = permissionSet.has(PERMISSIONS.CALENDAR_VIEW) || isAdminFinal;
    const canManageCalendar = permissionSet.has(PERMISSIONS.CALENDAR_MANAGE) || isAdminFinal;
    const canViewChat = permissionSet.has(PERMISSIONS.CHAT_VIEW) || isAdminFinal;
    const canModerateChat = permissionSet.has(PERMISSIONS.CHAT_MODERATE) || isAdminFinal;
    const canViewPolls = permissionSet.has(PERMISSIONS.POLLS_VIEW) || isAdminFinal;
    const canManageRelance = permissionSet.has(PERMISSIONS.RELANCE_MANAGE) || permissionSet.has(PERMISSIONS.MEMBER_MANAGE) || isAdminFinal;
    const canManageRBAC = hasDiscordAdmin || isGod; // STRICT: Only Discord admins and God can manage RBAC
    const canViewSettings = permissionSet.has(PERMISSIONS.ADMIN_SETTINGS) || isAdminFinal;
    const canViewAuditLogs = permissionSet.has(PERMISSIONS.ADMIN_AUDIT) || isAdminFinal;

    const mod = (guildConfig as any)?.modules;
    const bypassModules = isGod || isAdminFinal;

    const applyModule = (moduleEnabled: any, perm: boolean): boolean =>
        !!(bypassModules ? perm : (moduleEnabled !== false) && perm);

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
        roleNames: memberRoles.map(rId => (guildInfo as any)?.roles.find((r: any) => r.id === rId)?.name || "Inconnu"),
        roleColor: isGod && roleColor === 0 ? 0x5865F2 : roleColor,
        canViewDashboard: true,
        canViewPresentation: !!applyModule(!!mod?.presentation, !!canViewPresentation),
        canViewWelcome: !!applyModule(!!(guildConfig?.welcomeEnabled && guildConfig?.welcomeDashboardEnabled), !!canViewWelcome),
        canViewStats: !!applyModule(!!mod?.stats, !!canViewStats),
        canViewDocs: !!applyModule(!!mod?.docs, !!canViewDocs),
        canViewAdminDocs: !!canViewAdminDocs,
        canViewResources: !!applyModule(!!mod?.resources, true),
        canViewProfile: !!applyModule(!!mod?.profile, true),
        canManageMembers: !!canManageMembers,
        canViewMissions: !!applyModule(!!mod?.missions, !!canViewMissions),
        canManageMissions: !!applyModule(!!mod?.missions, !!canManageMissions),
        canValidateMissions: !!applyModule(!!mod?.missions, !!canValidateMissions),
        canManageBonus: !!canManageBonus,
        canViewRoster: !!applyModule(!!mod?.roster, !!canViewRoster),
        canViewSonges: !!applyModule(!!mod?.songes, !!canViewSonges),
        canCreateSonges: !!applyModule(!!mod?.songes, !!canCreateSonges),
        canJoinSonges: !!applyModule(!!mod?.songes, !!canJoinSonges),
        canViewOcre: !!applyModule(!!mod?.ocre, !!canViewOcre),
        canViewLadder: !!applyModule(!!mod?.ladder, !!canViewLadder),
        canSyncLadder: !!applyModule(!!mod?.ladderSync, !!isAdminFinal),
        canViewQuests: !!applyModule(!!mod?.quests, !!canViewQuests),
        canViewWorldmap: !!applyModule(!!mod?.worldmap, !!canViewWorldmap),
        canViewFinder: !!applyModule(!!mod?.donjons, !!canViewDJQuests),
        canViewServices: !!applyModule(!!mod?.services, !!canViewServices),
        canViewStuffGallery: !!applyModule(!!mod?.gallery, true),
        canViewMiniGames: !!applyModule(!!mod?.minigames, !!canViewMiniGames),
        canViewPolls: !!applyModule(!!mod?.polls, !!canViewPolls),
        canViewCalendar: !!applyModule(!!mod?.calendar, !!canViewCalendar),
        canManageCalendar: !!applyModule(!!mod?.calendar, !!canManageCalendar),
        canViewChat: !!applyModule(!!mod?.chat, !!canViewChat),
        canModerateChat: !!applyModule(!!mod?.chat, !!canModerateChat),
        canEditPresentation: !!applyModule(!!mod?.presentation, !!canEditPresentation),
        canManageRelance: !!canManageRelance,
        canManageRBAC: !!canManageRBAC,
        canViewSettings: !!canViewSettings,
        canViewAuditLogs: !!canViewAuditLogs,
        isAdmin: !!isAdminFinal,
        isDiscordAdmin: !!(hasDiscordAdmin || isGod),
        isSuperAdmin: !!isGod,
        isMember: !!isAuthorizedMember,
        hasPseudoIssue: !profile?.pseudoDofus || profile.pseudoDofus.startsWith("Voyageur"),
        pseudoDofus: profile?.pseudoDofus,
        ankamaId: profile?.ankamaId,
        profileId: profile?.id,
        guildName: guildConfig?.name || "Serveur Inconnu",
        dofusServerId: guildConfig?.dofusServerId,
        joinedAt: member?.joined_at ? new Date(member.joined_at).toISOString() : null,
        guildId: effectiveGuildId,
        roles: memberRoles,
        isCapacityFull: false,
        scheduledDeletion: null,
        createdAt: profile?.createdAt?.toISOString() || null,
        newsBroadcastEnabled: guildConfig?.newsBroadcastEnabled || false,
        metamobPseudo: profile?.metamobPseudo,
        classe: profile?.classe,
        dofusLevel: profile?.dofusLevel,
        altPseudos: (profile?.altPseudos as any[]) || [],
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

import { unstable_cache } from "next/cache";

const getCachedDiscordGuilds = unstable_cache(
    async (accessToken: string) => {
        try {
            const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
                headers: { Authorization: `Bearer ${accessToken}` },
                next: { revalidate: 300 }
            });
            if (!res.ok) return { error: true, status: res.status, data: [] };
            const data = await res.json();
            return { error: false, status: 200, data };
        } catch (e) {
            return { error: true, status: 500, data: [] };
        }
    },
    ['discord-user-guilds-v1'],
    { revalidate: 30 } // 30 seconds (reduced from 300s to avoid Ctrl+F5 issues when joining/creating guilds)
);

export async function getGuildsSeparated() {
    const session = await auth();
    if (!session?.user?.id) return { active: [], pending: [], rateLimited: false };

    const userId = session.user.id;

    // 1. Get all guilds where the Bot is active (from DB)
    const activeConfigs = await db.guildConfig.findMany({
        where: { isActive: true },
        select: { discordGuildId: true, name: true, iconUrl: true }
    });

    const { verifyGuildAccessibility } = await import("@/server/discord");
    const allowedGuildsDB = await db.allowedGuild.findMany({
        where: { isActive: true },
        select: { discordGuildId: true }
    });
    const allowedIdsWhitelist = new Set(allowedGuildsDB.map(g => g.discordGuildId));

    const isAllowedForDeployment = (guildId: string) => allowedIdsWhitelist.has(guildId);

    const validatedActive = await Promise.all(
        activeConfigs.map(async (g) => {
            const isAccessible = await verifyGuildAccessibility(g.discordGuildId);
            return { ...g, isAccessible };
        })
    ).then(results => results.filter(r => r.isAccessible));

    const activeIds = new Set(validatedActive.map(g => g.discordGuildId));

    const account = await db.account.findFirst({
        where: { userId, provider: "discord" },
        select: { access_token: true }
    });

    if (!account?.access_token) return { active: [], pending: [], rateLimited: false };

    const { error, status, data: userGuildsData } = await getCachedDiscordGuilds(account.access_token);

    if (error) {
        const dbProfiles = await db.userProfile.findMany({
            where: { userId, status: "ACTIVE" },
            include: { guild: true }
        });
        const activeFromDb = dbProfiles
            .filter(p => allowedIdsWhitelist.has(p.guild.discordGuildId))
            .map(p => ({
                id: p.guild.discordGuildId,
                name: p.guild.name,
                icon: p.guild.iconUrl,
                isAdmin: false
            }));
        return { active: activeFromDb, pending: [], rateLimited: status === 429 };
    }

    const pendingCandidates: any[] = [];
    const userGuilds = userGuildsData as any[];

    for (const guild of userGuilds) {
        if (activeIds.has(guild.id)) continue;
        const perms = BigInt(guild.permissions);
        const isAdmin = (perms & 0x8n) === 0x8n;
        if ((isAdmin || guild.owner) && isAllowedForDeployment(guild.id)) {
            pendingCandidates.push({
                id: guild.id,
                name: guild.name,
                icon: guild.icon ? `https://discord.com/api/v10/icons/${guild.id}/${guild.icon}.png` : null
            });
        }
    }

    const pending = await Promise.all(pendingCandidates.map(async (g) => {
        const isBotPresent = await verifyGuildAccessibility(g.id);
        return { ...g, isBotPresent };
    }));

    const userGuildIds = new Set(userGuilds.map(ug => ug.id));
    const active = validatedActive
        .filter(g => userGuildIds.has(g.discordGuildId) && allowedIdsWhitelist.has(g.discordGuildId))
        .map(g => {
            const userGuild = userGuilds.find(ug => ug.id === g.discordGuildId);
            const perms = userGuild ? BigInt(userGuild.permissions) : 0n;
            return {
                id: g.discordGuildId,
                name: g.name,
                icon: g.iconUrl,
                isAdmin: userGuild?.owner || (perms & 0x8n) === 0x8n
            };
        });

    return { active, pending, rateLimited: false };
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
        // God-mode check (platform-level override)
        const { isDiscordSuperAdmin } = await import("./super-admin-actions");
        if (await isDiscordSuperAdmin(discordUserId)) return true;

        // 1. Get cached config
        const cacheKey = `config:${guildId}`;
        const cached = configCache.get(cacheKey);
        let guildConfig = cached?.expiresAt && cached.expiresAt > Date.now() ? cached.data : null;

        if (!guildConfig) {
            guildConfig = await (db.guildConfig as any).findFirst({
                where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
                select: { id: true, discordGuildId: true, rolesMapping: true, usersMapping: true }
            });
            if (guildConfig) configCache.set(cacheKey, { data: guildConfig, expiresAt: Date.now() + CACHE_TTL });
        }
        if (!guildConfig) return false;

        const actualGuildId = guildConfig.discordGuildId || guildId;

        // 2. Fetch member with caching
        const member = await fetchGuildMember(actualGuildId, discordUserId);
        if (!member) return false;

        // 3. Guild Owner bypass
        const guildInfo = await fetchGuild(actualGuildId).catch(() => null);
        if (guildInfo?.owner_id === discordUserId) return true;

        // 4. Discord Admin bypass - IMPORTANT: include managed roles for permission checks
        const guildRoles = await fetchGuildRoles(actualGuildId, { excludeManaged: false }).catch(() => []);
        const memberRoles = guildRoles.filter(r => member.roles.includes(r.id));
        const isDiscordAdmin = memberRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
        if (isDiscordAdmin) return true;

        // 5. Mapping check
        const mapping = (guildConfig.rolesMapping || {}) as Record<string, PermissionId[]>;
        const userMapping = (guildConfig.usersMapping || {}) as Record<string, PermissionId[]>;

        const allPerms = new Set<PermissionId>();
        member.roles.forEach((roleId: string) => {
            const perms = mapping[roleId];
            if (perms) perms.forEach((p: PermissionId) => allPerms.add(p));
        });

        const userPerms = userMapping[discordUserId];
        if (userPerms) userPerms.forEach((p: PermissionId) => allPerms.add(p));

        return allPerms.has(PERMISSIONS.ADMIN_FULL) || allPerms.has(permission);
    } catch (e) {
        console.error(`[PermissionCheck] Error for ${discordUserId} in ${guildId}:`, e);
        return false;
    }
}

export async function checkGuildPermission(
    session: any,
    guildId: string,
    permission: PermissionId
): Promise<{ allowed: boolean; error?: string }> {
    if (!session?.user?.id) return { allowed: false, error: "Unauthorized" };

    // OPTIM: Check session first to avoid DB query
    let providerAccountId = (session.user as any)?.discordId;

    if (!providerAccountId) {
        const account = await db.account.findFirst({
            where: { userId: session.user.id, provider: "discord" },
            select: { providerAccountId: true }
        });
        if (!account) return { allowed: false, error: "No Discord account linked" };
        providerAccountId = account.providerAccountId;
    }

    // Platform Guard: Is the guild allowed/active?
    const allowedPlatform = await isGuildAllowed(guildId);
    if (!allowedPlatform) return { allowed: false, error: "This guild is currently deactivated or banned." };

    const allowed = await internalCheckPermission(guildId, providerAccountId, permission);

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
        select: { id: true, name: true, ownerId: true }
    });

    if (!guildConfig) throw new Error("Guild not found");

    // SECURITY: Must be admin or have management/relance permissions to list all members
    const user = await getUserContext(guildId);
    if (!user.isAdmin && !user.canManageMembers && !user.canManageRelance) throw new Error("Forbidden: Admin access required");

    const members = await db.userProfile.findMany({
        where: { guildId: guildConfig.id },
        include: {
            user: {
                select: {
                    name: true,
                    image: true,
                    accounts: {
                        where: { provider: "discord" },
                        select: { providerAccountId: true, provider: true }
                    }
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    return {
        ownerId: guildConfig.ownerId,
        members: members.map(m => ({
            id: m.id,
            userId: m.userId,
            status: m.status as "ACTIVE" | "ARCHIVED" | "BANNED",
            createdAt: m.createdAt.toISOString(),
            updatedAt: m.updatedAt.toISOString(),
            archivedAt: m.archivedAt?.toISOString() || null,
            archiveReason: m.archiveReason,
            pseudoDofus: m.pseudoDofus,
            discordNickname: m.discordNickname,
            discordRoleName: m.discordRoleName,
            discordRoleColor: m.discordRoleColor,
            ankamaId: m.ankamaId,
            user: {
                name: m.user.name,
                image: m.user.image,
                accounts: m.user.accounts
            }
        }))
    };
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

    // 2. SECURITY: Must be guild admin (or God) to manually change member status
    const actor = await getUserContext(profile.guild.discordGuildId);
    if (!actor.isAdmin) throw new Error("Forbidden: Admin access required for manual status override");

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

    // 5. Audit & Activity
    const targetProfile = await db.userProfile.findUnique({
        where: { id: profileId },
        select: {
            discordNickname: true,
            pseudoDofus: true,
            user: { select: { name: true, image: true } }
        }
    });
    const targetName = targetProfile?.pseudoDofus || targetProfile?.discordNickname || targetProfile?.user?.name || profileId;

    if (!actor.isSuperAdmin) {
        const { createAuditLog } = await import("./audit-actions");
        await createAuditLog({
            guildId: profile.guild.discordGuildId,
            actorUserId: session.user.id as string,
            actorName: session.user.name || "Admin",
            action: status === "ACTIVE" ? "PROFILE_REACTIVATED" : status === "BANNED" ? "MEMBER_BANNED" : "PROFILE_ARCHIVED",
            targetType: "PROFILE",
            targetId: profileId,
            oldValue: { status: profile.status },
            newValue: { status },
            metadata: { description: targetName, reason: reason || "Manual Action" }
        });
    }

    revalidatePath(`/dashboard/${profile.guild.discordGuildId}/admin/settings`);

    // Emit activity feed event
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
    if (!actor.isAdmin) throw new Error("Forbidden: Admin access required for manual pseudo override");

    const updated = await db.userProfile.update({
        where: { id: profileId },
        data: { pseudoDofus }
    });

    // Audit log
    const { isSuperAdmin } = await import("@/server/actions/super-admin-actions");
    const isGod = await isSuperAdmin();

    if (!isGod) {
        const { createAuditLog } = await import("./audit-actions");
        const targetName = updated.pseudoDofus || updated.discordNickname || profileId;

        await createAuditLog({
            guildId: profile.guild.discordGuildId,
            actorUserId: session.user.id as string,
            actorName: session.user.name || "Admin",
            action: "MEMBER_PSEUDO_UPDATE",
            targetType: "PROFILE",
            targetId: profileId,
            oldValue: { pseudo: profile.pseudoDofus },
            newValue: { pseudo: pseudoDofus },
            metadata: { description: targetName }
        });
    }

    revalidatePath(`/dashboard/${profile.guild.discordGuildId}/admin/settings`);
    return { success: true, data: updated };
}

/**
 * Update a member's Ankama ID (Admin only)
 * Format: Name#1234 (max 50 chars before #, exactly 4 digits after #)
 */
export async function updateMemberAnkamaId(profileId: string, ankamaId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const profile = await db.userProfile.findUnique({
        where: { id: profileId },
        include: { guild: { select: { discordGuildId: true } } }
    });

    if (!profile) throw new Error("Profile not found");

    const actor = await getUserContext(profile.guild.discordGuildId);
    if (!actor.isAdmin) throw new Error("Forbidden: Admin access required for manual ID override");

    // Validation
    const ankamaIdRegex = /^[a-zA-Z0-9\-]{1,50}#[0-9]{4}$/;
    if (!ankamaIdRegex.test(ankamaId)) {
        throw new Error("Format ID Dofus invalide. Exemple : Nom#1234 (max 50 caractères avant le #, tiret autorisé, et exactement 4 chiffres après)");
    }

    const updated = await db.userProfile.update({
        where: { id: profileId },
        data: { ankamaId }
    });

    // Audit log
    const { isSuperAdmin } = await import("@/server/actions/super-admin-actions");
    const isGod = await isSuperAdmin();

    if (!isGod) {
        const { createAuditLog } = await import("./audit-actions");
        const targetName = updated.pseudoDofus || updated.discordNickname || profileId;

        await createAuditLog({
            guildId: profile.guild.discordGuildId,
            actorUserId: session.user.id as string,
            actorName: session.user.name || "Admin",
            action: "MEMBER_ANKAMA_ID_UPDATE",
            targetType: "PROFILE",
            targetId: profileId,
            oldValue: { ankamaId: profile.ankamaId },
            newValue: { ankamaId: ankamaId },
            metadata: { description: targetName }
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
