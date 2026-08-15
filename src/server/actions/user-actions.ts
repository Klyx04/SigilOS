"use server";

import { auth } from "@/auth";
import { fetchGuildRoles, fetchGuild, fetchGuildMember, invalidateDiscordCache } from "@/server/discord";
import { db } from "@/lib/prisma";
import { PERMISSIONS, type PermissionId } from "@/lib/permissions";
import { DEFAULT_MODULES } from "@/lib/module-types";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { type AuditLogEntry, logAction } from "./audit-actions";
import { emitGuildActivity } from "./activity-actions";
import { getDisplayName, getGameDisplayName } from "@/lib/display-name";
import { PresenceManager } from "@/lib/presence";
import { isSuperAdmin, isGuildAllowed } from "@/server/actions/super-admin-actions";

import { redis } from "@/lib/redis";

// In-memory cache for configs and user context
const configCache = new Map<string, { data: any, expiresAt: number }>();
const profileCache = new Map<string, { data: any, expiresAt: number }>();
const CACHE_TTL = 60; // 60 seconds — must stay short so role revocations propagate quickly
// I-02: Bound the in-memory caches to prevent unbounded growth (OOM risk in prod).
// Simple manual LRU (Map preserves insertion order) — no external dependency needed.
const MAX_CACHE_ENTRIES = 500;

/** Evict expired entries, then if still over capacity evict the oldest (LRU). */
function setBoundedCache(map: Map<string, { data: any, expiresAt: number }>, key: string, value: { data: any, expiresAt: number }) {
    // 1. Opportunistic sweep of expired entries
    const now = Date.now();
    for (const [k, v] of map) {
        if (now > v.expiresAt) map.delete(k);
    }
    // 2. If still at/over capacity, evict the oldest entries (Map iterates in insertion order)
    while (map.size >= MAX_CACHE_ENTRIES) {
        const oldest = map.keys().next();
        if (oldest.done) break;
        map.delete(oldest.value);
    }
    map.set(key, value);
}

/**
 * Invalidate cache for a specific user in a specific guild.
 * Handles both the in-memory profile cache (uses DB UUID) 
 * and the Redis context cache (uses Discord Guild ID).
 */
export async function invalidateUserContextCache(userId: string, guildId: string, discordGuildId?: string) {
    // 1. Clear In-memory profile cache (covers both internal UUID and Discord ID mapping)
    profileCache.delete(`profile:${userId}:${guildId}`);
    if (discordGuildId) profileCache.delete(`profile:${userId}:${discordGuildId}`);

    // 2. Clear Redis context cache (covers both potential key types)
    await redis.del(`user:ctx:${userId}:${guildId}`).catch(() => { });
    if (discordGuildId) await redis.del(`user:ctx:${userId}:${discordGuildId}`).catch(() => { });
}

/**
 * Invalidate cache for a whole guild configuration.
 * Clears BOTH Redis AND in-memory config cache to prevent stale rolesMapping.
 */
export async function invalidateGuildCache(guildId: string) {
    // 1. Redis cache
    await redis.del(`config:${guildId}`).catch(() => { });
    // 2. In-memory configCache — CRITICAL: without this, the stale rolesMapping
    //    persists in the Node.js process for up to 60s after an RBAC update,
    //    causing noRolesConfigured=true even when roles ARE configured.
    configCache.delete(`config:${guildId}`);
}

/**
 * Flush ALL user context caches for an entire guild.
 * MUST be called after any RBAC change so stale permissions
 * don't persist in Redis across all members.
 *
 * Uses SCAN to avoid blocking Redis with KEYS *.
 */
export async function flushGuildUserContextCache(discordGuildId: string) {
    try {
        // Pattern covers both key formats: user:ctx:{userId}:{discordGuildId} and user:ctx:{userId}:{internalId}
        const pattern = `user:ctx:*:${discordGuildId}`;
        let cursor = "0";
        do {
            const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis.del(...keys).catch(() => { });
            }
        } while (cursor !== "0");
    } catch (e) {
        logger.error("[RBAC] flushGuildUserContextCache failed:", e);
    }
}

/**
 * Force a manual revalidation of the user context (clears caches)
 * Useful when a user just joined a Discord server.
 */
export async function revalidateUserContext(guildId?: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const userId = session.user.id;
    // discordId (snowflake Discord) porté par la session depuis auth.ts → utilisée pour
    // purger le cache membre (clé `member:{guildId}:{discordId}`). Assertion typée étroite
    // (le champ est ajouté dynamiquement à la session, absent du type NextAuth).
    const discordUserId = (session as unknown as { user?: { discordId?: string } }).user?.discordId;

    // 1. Clear in-memory + Redis context caches.
    //    ⚠️ Clés différentes : le cache profil mémoire est clé sur l'ID INTERNE de
    //    guildConfig (`profile:{userId}:{guildConfig.id}`), le cache Redis `user:ctx`
    //    sur l'ID DISCORD. On résout l'id interne pour purger la bonne clé profil,
    //    et on passe l'id Discord en 3ᵉ arg (couvre Redis + l'autre forme de clé).
    let internalGuildId = guildId || "";
    if (guildId) {
        try {
            const config = await db.guildConfig.findFirst({
                where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
                select: { id: true }
            });
            if (config?.id) internalGuildId = config.id;
        } catch { /* non bloquant */ }
    }
    await invalidateUserContextCache(userId, internalGuildId, guildId);

    // 2. Clear Discord member/roles cache.
    //    ⚠️ CRITIQUE : fetchGuildMember stocke les RÔLES sous
    //    `member:{guildId}:{discordId}` (snowflake Discord). Utiliser
    //    `session.user.id` (UUID interne) ne matche jamais la clé → le rôle
    //    fraîchement octroyé restait ignoré jusqu'au TTL 15s. La bonne identité est
    //    `session.user.discordId`, alignée sur l'invalidation faite à la création de
    //    profil (voir getUserContext → invalidateDiscordCache(`member:...:${discordUserId}`)).
    if (discordUserId && guildId) {
        try {
            const { invalidateDiscordCache } = await import("@/server/discord");
            invalidateDiscordCache(`member:${guildId}:${discordUserId}`);
            invalidateDiscordCache(`roles:${guildId}`);
        } catch { /* non bloquant */ }
    }

    // 3. Revalidate all relevant paths so the sidebar guild switcher picks up
    //    the newly created UserProfile on the very first connection.
    //    Without this, getUserGuilds() returns [] until a hard refresh because
    //    the profile is created during render and the layout cache is stale.
    revalidatePath(`/dashboard/${guildId || ""}`, "layout");
    revalidatePath("/", "layout"); // Invalidate root layout (guild switcher data)

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
    canManualSyncLadder: boolean;
    canViewQuests: boolean;
    canViewWorldmap: boolean;
    canViewFinder: boolean;
    canViewServices: boolean;
    canViewStuffGallery: boolean;
    canViewMiniGames: boolean;
    canViewPolls: boolean;
    canViewCalendar: boolean;
    canManageCalendar: boolean;
    canManageRaid: boolean;
    canJoinRaid: boolean;
    canEditVacation: boolean;
    // Admin Tools
    canEditPresentation: boolean;
    canManageRelance: boolean;
    canManageRBAC: boolean;
    canManagePoints: boolean;
    canViewSettings: boolean;
    canViewAuditLogs: boolean;
    // Global Access
    isAdmin: boolean;
    isFirstAdminForGuild?: boolean;
    isDiscordAdmin: boolean;
    isSuperAdmin: boolean;
    isMember: boolean;
    // Data & Identity
    hasPseudoIssue: boolean;
    /** true si le membre a déjà sélectionné ≥1 activité (bloc « Activités & Contenu préféré »). */
    hasPreferredActivities: boolean;
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
    pinnedNavItems?: string[];
    hiddenNavItems?: string[];
    newsBroadcastEnabled?: boolean;
    hasPendingReactivation?: boolean;
    isOnboardingComplete: boolean;
    missionVitrineMode?: boolean;
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
    if (!session?.user?.id) return { isAuthenticated: false } as any;

    const guildId = targetGuildId || process.env.DISCORD_GUILD_ID || "";
    const redisKey = `user:ctx:${session.user.id}:${guildId}`;

    // 1. Try Redis Cache first
    try {
        const cached = await redis.get(redisKey);
        if (cached) {
            const data = JSON.parse(cached);
            // Verify session integrity (optional but safe)
            if (data.id === session.user.id) return data;
        }
    } catch (e) {
        logger.error("[UserContext] Redis fetch error:", e);
    }

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
        canManualSyncLadder: false,
        canViewQuests: false,
        canViewWorldmap: false,
        canViewFinder: false,
        canViewServices: false,
        canViewStuffGallery: false,
        canViewMiniGames: false,
        canViewPolls: false,
        canViewCalendar: false,
        canManageCalendar: false,
        canManageRaid: false,
        canJoinRaid: false,
        canEditVacation: false,
        canEditPresentation: false,
        canManageRelance: false,
        canManageRBAC: false,
        canManagePoints: false,
        canViewSettings: false,
        canViewAuditLogs: false,
        hasPseudoIssue: false,
        hasPreferredActivities: false,
        roles: [],
        roleNames: [],
        newsBroadcastEnabled: true,
        metamobPseudo: null,
        isOnboardingComplete: true,
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
        guildConfig = await db.guildConfig.findFirst({
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
                missionVitrineMode: true,
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
                        gallery: true,
                        ladderSync: true,
                        manualLadderSync: true,
                        minigames: true,
                    }
                }
            }
        });
        if (guildConfig) setBoundedCache(configCache, cacheKey, { data: guildConfig, expiresAt: Date.now() + CACHE_TTL });
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

    // --- GUILD-SCOPED BAN CHECK (GuildMemberBan / tombstone) — F-01 ---
    // Fail-closed : un membre banni OU supprimé par un admin reste exclu du dashboard
    // même si son UserProfile a été purgé (il ne peut PAS être ré-provisionné
    // automatiquement au prochain accès). Vérifié AVANT la création de profil.
    if (guildConfig && !isGod && discordUserId) {
        const guildBan = await db.guildMemberBan.findUnique({
            where: { guildId_discordId: { guildId: guildConfig.id, discordId: discordUserId } },
            select: { id: true, reason: true }
        }).catch(() => null);
        if (guildBan) {
            logger.warn(`[Security] Blocked access for GUILD-BANNED user ${discordUserId} in guild ${guildConfig.id} (${guildBan.reason})`);
            return {
                ...baseContext,
                isAuthenticated: true,
                id: session.user.id,
                name: session.user.name || "Voyageur",
                image: session.user.image || undefined,
                isMember: false,
                isBanned: true,
                guildName: guildConfig?.name || "Serveur Inconnu",
            } as any;
        }
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
        if (profile) setBoundedCache(profileCache, profileCacheKey, { data: profile, expiresAt: Date.now() + CACHE_TTL });
    }

    let memberFetchFailed = false;
    const [member, guildInfo, allRoles] = await Promise.all([
        fetchGuildMember(actualDiscordGuildId, discordUserId).catch((err) => {
            // Discord API error (rate-limit, network, 5xx) — NOT a "member not found" case.
            // We must NOT block the user: they are likely still a valid member.
            logger.error("[UserContext] fetchGuildMember failed (Discord API error):", err?.message || err);
            memberFetchFailed = true;
            return null; // Treated as unknown, NOT as "absent"
        }),
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
            scheduledDeletion: profile.scheduledDeletion?.toISOString() || null,
            hasPendingReactivation: !!profile.reactivationRequestedAt
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

    // --- SERVER DELETED vs MEMBER KICKED DETECTION ---
    // If guildInfo is null AND member is null AND no Discord API error:
    // → the Discord server itself was deleted (the bot can't see the guild either)
    // If guildInfo exists but member is null:
    // → the user personally left/was kicked from the server (but server exists)
    // IMPORTANT: If memberFetchFailed (Discord API error, rate-limit, etc.) we skip this block
    // entirely to avoid false positives that would block legitimate admins/members.
    if (!memberFetchFailed && guildConfig && !member && profile && profile.status === "ACTIVE") {
        const isServerDeleted = !guildInfo;
        if (!isGod) {
            if (isServerDeleted) {
                // Server was deleted — force sign-out by returning isServerDeleted: true
                // The dashboard layout will handle the specific message + signout
                return {
                    ...baseContext,
                    isAuthenticated: true,
                    isMember: false,
                    isServerDeleted: true,
                    guildName: guildConfig?.name || "Serveur Inconnu",
                } as any;
            }
            // User left/was kicked — show "archived" as before
            return {
                ...baseContext,
                isAuthenticated: true,
                isMember: false,
                isArchived: true,
                guildName: guildConfig?.name || "Serveur Inconnu",
                scheduledDeletion: null,
            } as any;
        }
    }


    // --- NON-MEMBER CHECK (Not on Discord and not already handled) ---
    // RESILIENCE: If fetchGuildMember failed due to Discord API issue (rate-limit, timeout),
    // but the user has an active profile in the DB, we trust the DB and don't block them.
    if (!member && profile && profile.status === "ACTIVE" && memberFetchFailed) {
        // Discord API errored, but DB says user is active — trust DB, fall through to RBAC
        logger.warn(`[UserContext] Discord API error for known active member ${discordUserId} — falling back to DB`);
    } else if (!member) {
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
                canManageRaid: true,
                canJoinRaid: true,
                canEditVacation: true,
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
    // Chantier #72 — kill-switch God « Membres Spécifiques » : quand la plateforme
    // désactive les permissions individuelles, usersMapping est TOTALEMENT ignoré
    // (fail-closed). Aucune permission individuelle ne s'applique.
    const { getRbacUsersMappingEnabled } = await import("@/lib/platform-rbac");
    const rbacUsersMappingEnabled = await getRbacUsersMappingEnabled();
    const individualMapping = rbacUsersMappingEnabled
        ? ((guildConfig?.usersMapping as Record<string, PermissionId[]>) || {})
        : {};

    const isRbacConfigured = Object.values(rolesMapping).some(perms =>
        Array.isArray(perms) && (
            perms.includes("dashboard:login" as PermissionId) ||
            perms.includes("dashboard:access" as PermissionId) ||
            perms.includes(PERMISSIONS.DASHBOARD_LOGIN)
        )
    );
    // Onboarding complet = serveur de jeu configuré (dofusServerId) ET rôles & permissions (RBAC).
    // Cohérent avec onboarding-actions.ts (2 étapes obligatoires).
    const isOnboardingComplete = isRbacConfigured && !!guildConfig?.dofusServerId;

    const hasDiscordAdminRole = myRoles.some(r => (BigInt(r.permissions || 0) & 0x8n) === 0x8n);
    const isOwner = guildInfo && guildInfo.owner_id === discordUserId;
    const hasDiscordAdmin = hasDiscordAdminRole || isOwner;

    // MASTER ADMIN: Must be checked against the USER'S OWN roles, not all guild roles
    const userHasAdminPermission = memberRoles.some(rId => {
        const perms = rolesMapping[rId];
        return perms && perms.includes(PERMISSIONS.SYSTEM_GOD);
    }) || individualMapping[discordUserId]?.includes(PERMISSIONS.SYSTEM_GOD);

    const isAdmin = userHasAdminPermission || hasDiscordAdmin || isGod;
    const isAdminFinal = isAdmin;

    // ── Tour admin : flag "premier admin de la guilde" (source de vérité serveur, atomique) ──
    // Seul le TOUT PREMIER admin NON-God qui ouvre le Dashboard de CETTE guilde reçoit
    // le tour des modules (une seule fois). Un God ne "consomme" jamais ce flag.
    // updateMany conditionnel (!=update() unique) : si firstAdminViewAt IS NULL → ce code
    // le pose (count===1 => c'est le premier) ; sinon count===0 => un autre est déjà passé.
    // Fail-closed : si la BDD échoue, on n'accorde PAS le tour.
    let isFirstAdminForGuild = false;
    if (isAdminFinal && !isGod && guildConfig) {
        try {
            const firstAdminResult = await db.guildConfig.updateMany({
                where: { id: guildConfig.id, firstAdminViewAt: null } as any,
                data: { firstAdminViewAt: new Date() }
            });
            isFirstAdminForGuild = firstAdminResult.count > 0;
        } catch (err) {
            logger.error("[Tour Admin] Échec de la pose du flag premier admin", { guildId, error: err });
            isFirstAdminForGuild = false;
        }
    }

    // 2. Authorization Check (The Gatekeeper) — STRICT DENY-BY-DEFAULT
    // A role MUST have DASHBOARD_LOGIN explicitly to pass. No legacy fallback.
    const hasAuthorizedRole = memberRoles.some(rId => {
        const perms = rolesMapping[rId];
        if (!perms || perms.length === 0) return false;
        return perms.includes(PERMISSIONS.DASHBOARD_LOGIN) || perms.includes(PERMISSIONS.COMMUNITY_ACCESS);
    }) || individualMapping[discordUserId]?.some(p => p === PERMISSIONS.DASHBOARD_LOGIN || p === PERMISSIONS.COMMUNITY_ACCESS);

    // SECURITY FIX (fail-open RBAC):
    // Previously, `memberFetchFailed` alone granted access to ANY authenticated user
    // even without a DB profile (the case `!member && memberFetchFailed` fell through
    // the gate below). An attacker could provoke a Discord API failure (rate-limit)
    // to bypass the role check entirely.
    //
    // Conservative fix: keep the resilience fallback ONLY when the user provably
    // has an ACTIVE profile in this guild in the DB (known member). A random
    // authenticated user with no profile now gets DENIED.
    const hasKnownActiveProfile = !!profile && profile.status === "ACTIVE";
    const isAuthorizedMember = hasAuthorizedRole || isAdminFinal || (memberFetchFailed && hasKnownActiveProfile);

    if (!member && !memberFetchFailed || !isAuthorizedMember) {
        return {
            ...baseContext,
            isAuthenticated: true,
            id: session.user.id,
            name: displayName,
            isMember: !!member || isGod,
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

                // Invalidation du cache membre/rôles Discord pour que le rôle
                // octroyé au membre soit pris en compte immédiatement (évite le
                // cache 15s périmé qui retardait l'accès d'un nouvel arrivant).
                try {
                    invalidateDiscordCache(`member:${actualDiscordGuildId}:${discordUserId}`);
                    invalidateDiscordCache(`roles:${actualDiscordGuildId}`);
                } catch { /* non bloquant */ }

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
                        logger.error("[UserContext] Arrival processing error:", e);
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
            // SYNC DISCORD IDENTITY TO DB (Avoid stale nicknames in other modules like Polls)
            if (profile.discordNickname !== displayName) {
                try {
                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: { discordNickname: displayName }
                    });
                } catch (e) {
                    logger.error("[getUserContext] Failed to sync discordNickname:", e);
                }
            }

            try { await PresenceManager.updatePresence(guildConfig.id, session.user.id); } catch { }
        }
    }

    // 4. Permissions Calculation
    const LEGACY_MAPPING: Record<string, PermissionId> = {
        "dashboard:access": PERMISSIONS.DASHBOARD_LOGIN,
        "bienvenue:view": PERMISSIONS.DASHBOARD_LOGIN,
        "resources:view": PERMISSIONS.DASHBOARD_LOGIN,
        "docs:view": PERMISSIONS.DASHBOARD_LOGIN,
        "profile:view_all": PERMISSIONS.COMMUNITY_ACCESS,
        "polls:view": PERMISSIONS.COMMUNITY_ACCESS,
        "calendar:view": PERMISSIONS.COMMUNITY_ACCESS,
        "chat:view": PERMISSIONS.COMMUNITY_ACCESS,
        "chat:moderate": PERMISSIONS.COMMUNITY_MOD,
        "calendar:manage": PERMISSIONS.COMMUNITY_MOD,
        "missions:view": PERMISSIONS.MISSIONS_PLAY,
        "missions:manage": PERMISSIONS.MISSIONS_OFFICER,
        "missions:validate": PERMISSIONS.MISSIONS_OFFICER,
        "game:ocre_view": PERMISSIONS.GAME_VIEW,
        "game:ladder_view": PERMISSIONS.GAME_VIEW,
        "game:quests_view": PERMISSIONS.GAME_VIEW,
        "game:worldmap_view": PERMISSIONS.GAME_VIEW,
        "game:minigames_view": PERMISSIONS.GAME_VIEW,
        "songes:view": PERMISSIONS.GAME_OPERATIONS,
        "songes:create": PERMISSIONS.GAME_OPERATIONS,
        "songes:join": PERMISSIONS.GAME_OPERATIONS,
        "game:services_view": PERMISSIONS.GAME_OPERATIONS,
        "game:dj_quests_view": PERMISSIONS.GAME_OPERATIONS,
        "admin:member_manage": PERMISSIONS.STAFF_MEMBER_MGMT,
        "admin:relance_manage": PERMISSIONS.STAFF_MEMBER_MGMT,
        "admin:member_vacation_edit": PERMISSIONS.STAFF_MEMBER_MGMT,
        "presentation:edit": PERMISSIONS.STAFF_CONTENT,
        "docs:view_admin": PERMISSIONS.STAFF_CONTENT,
        "admin:audit": PERMISSIONS.STAFF_AUDIT,
        // NOTE: l'ancienne permission "stats:view" n'est PAS remappée vers STAFF_AUDIT.
        // La page Stats Guilde dépend de DASHBOARD_LOGIN (canViewStats) — mapper ici
        // octroyait par accident l'accès Audit Logs à tout rôle legacy "stats:view".
        "admin:settings": PERMISSIONS.SYSTEM_CONFIG,
        "admin:full": PERMISSIONS.SYSTEM_GOD,
    };

    const permissionSet = new Set<PermissionId>();
    memberRoles.forEach(rId => {
        const perms = rolesMapping[rId];
        if (perms) perms.forEach(p => {
            permissionSet.add(p as PermissionId);
            if (LEGACY_MAPPING[p]) permissionSet.add(LEGACY_MAPPING[p]);
        });
    });

    const personalPerms = individualMapping[discordUserId];
    if (personalPerms) personalPerms.forEach(p => {
        permissionSet.add(p as PermissionId);
        if (LEGACY_MAPPING[p]) permissionSet.add(LEGACY_MAPPING[p]);
    });

    const noRolesConfigured = Object.keys(rolesMapping).length === 0;

    const canViewWelcome = permissionSet.has(PERMISSIONS.DASHBOARD_LOGIN) || isAdminFinal || noRolesConfigured;
    const canViewPresentation = permissionSet.has(PERMISSIONS.PRESENTATION_VIEW) || isAdminFinal || noRolesConfigured;
    const canEditPresentation = permissionSet.has(PERMISSIONS.STAFF_CONTENT) || isAdminFinal;
    // Stats Guilde = même RBAC que la page guilde (DASHBOARD_LOGIN), pas lié aux Audit Logs
    const canViewStats = permissionSet.has(PERMISSIONS.DASHBOARD_LOGIN) || isAdminFinal || noRolesConfigured;
    const canViewDocs = permissionSet.has(PERMISSIONS.DASHBOARD_LOGIN) || isAdminFinal;
    const canViewAdminDocs = permissionSet.has(PERMISSIONS.STAFF_CONTENT) || isAdminFinal;
    const canViewRoster = permissionSet.has(PERMISSIONS.COMMUNITY_ACCESS) || isAdminFinal;
    const canManageMembers = permissionSet.has(PERMISSIONS.STAFF_MEMBER_MGMT) || isAdminFinal;
    const canManagePoints = permissionSet.has(PERMISSIONS.POINTS_MANAGE) || isAdminFinal;
    const canViewMissions = permissionSet.has(PERMISSIONS.MISSIONS_PLAY) || isAdminFinal;
    const canManageMissions = permissionSet.has(PERMISSIONS.MISSIONS_OFFICER) || isAdminFinal;
    const canValidateMissions = permissionSet.has(PERMISSIONS.MISSIONS_OFFICER) || isAdminFinal;
    const canManageBonus = permissionSet.has(PERMISSIONS.MISSIONS_OFFICER) || isAdminFinal;
    const canViewSonges = permissionSet.has(PERMISSIONS.GAME_OPERATIONS) || isAdminFinal;
    const canCreateSonges = permissionSet.has(PERMISSIONS.GAME_OPERATIONS) || isAdminFinal;
    const canJoinSonges = permissionSet.has(PERMISSIONS.GAME_OPERATIONS) || isAdminFinal;
    const canViewOcre = permissionSet.has(PERMISSIONS.GAME_VIEW) || isAdminFinal;
    // #66bis : la Galerie Stuff appartient à "Encyclopédie de jeu" (GAME_VIEW) uniquement.
    // Avant : COMMUNITY_ACCESS suffisait (chevauchement non documenté). Décision produit 16/08.
    const canViewStuffGallery = permissionSet.has(PERMISSIONS.GAME_VIEW) || isAdminFinal;
    const canViewLadder = permissionSet.has(PERMISSIONS.GAME_VIEW) || isAdminFinal;
    const canViewQuests = permissionSet.has(PERMISSIONS.GAME_VIEW) || isAdminFinal;
    const canViewWorldmap = permissionSet.has(PERMISSIONS.GAME_VIEW) || isAdminFinal;
    const canViewDJQuests = permissionSet.has(PERMISSIONS.GAME_OPERATIONS) || isAdminFinal;
    const canViewServices = permissionSet.has(PERMISSIONS.GAME_OPERATIONS) || isAdminFinal;
    const canViewMiniGames = permissionSet.has(PERMISSIONS.GAME_VIEW) || isAdminFinal;
    const canViewCalendar = permissionSet.has(PERMISSIONS.COMMUNITY_ACCESS) || isAdminFinal;
    const canManageCalendar = permissionSet.has(PERMISSIONS.COMMUNITY_MOD) || isAdminFinal;
    const canManageRaid = permissionSet.has(PERMISSIONS.RAID_OFFICER) || isAdminFinal;
    const canJoinRaid = permissionSet.has(PERMISSIONS.RAID_MEMBER) || isAdminFinal;
    const canEditVacation = permissionSet.has(PERMISSIONS.STAFF_MEMBER_MGMT) || isAdminFinal;
    const canViewPolls = permissionSet.has(PERMISSIONS.COMMUNITY_ACCESS) || isAdminFinal;
    const canManageRelance = permissionSet.has(PERMISSIONS.STAFF_MEMBER_MGMT) || isAdminFinal;
    const canManageRBAC = permissionSet.has(PERMISSIONS.SYSTEM_RBAC) || hasDiscordAdmin || isGod;
    const canViewSettings = permissionSet.has(PERMISSIONS.SYSTEM_CONFIG) || isAdminFinal;
    const canViewAuditLogs = permissionSet.has(PERMISSIONS.STAFF_AUDIT) || isAdminFinal;

    // BUGFIX: Fall back to DEFAULT_MODULES when no GuildModules record exists in DB.
    // Without this, mod = null → !!mod?.X = false → applyModule(false, perm) = false for ALL non-admins.
    const mod = (guildConfig as any)?.modules ?? DEFAULT_MODULES;
    const bypassModules = isGod || isAdminFinal;

    const applyModule = (moduleEnabled: any, perm: boolean): boolean =>
        !!(bypassModules ? perm : (moduleEnabled !== false) && perm);

    const finalContext = {
        isAuthenticated: true,
        id: session.user.id,
        name: displayName,
        image: member?.user?.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUserId}/${member.user.avatar}.png`
            : member?.avatar
                ? `https://cdn.discordapp.com/guilds/${effectiveGuildId}/users/${discordUserId}/avatars/${member.avatar}.png`
                : session.user.image || undefined,
        roleName: isGod && roleName === "Membre" ? "Administrateur" : roleName,
        roleNames: memberRoles.map(rId => (guildInfo as any)?.roles?.find((r: any) => r.id === rId)?.name || "Inconnu"),
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
        canViewLadder: !!applyModule(!!mod?.ladder, !!canViewLadder) && !!guildConfig?.dofusServerId,
        canSyncLadder: !!applyModule(!!mod?.ladderSync, !!isAdminFinal),
        canManualSyncLadder: !!(isGod || mod?.manualLadderSync),
        canViewQuests: !!applyModule(!!mod?.quests, !!canViewQuests),
        canViewWorldmap: !!applyModule(!!mod?.worldmap, !!canViewWorldmap),
        canViewFinder: !!applyModule(!!mod?.donjons, !!canViewDJQuests),
        canViewServices: !!applyModule(!!mod?.services, !!canViewServices),
        canViewStuffGallery: !!applyModule(!!mod?.gallery, !!canViewStuffGallery),
        canViewMiniGames: !!applyModule(!!mod?.minigames, !!canViewMiniGames),
        canViewPolls: !!applyModule(!!mod?.polls, !!canViewPolls),
        canViewCalendar: !!applyModule(!!mod?.calendar, !!canViewCalendar),
        canManageCalendar: !!applyModule(!!mod?.calendar, !!canManageCalendar),
        canManageRaid: !!applyModule(!!mod?.calendar, !!canManageRaid),
        canJoinRaid: !!applyModule(!!mod?.calendar, !!canJoinRaid),
        canEditVacation: !!canEditVacation,
        canViewDJQuests: !!applyModule(!!mod?.donjons, !!canViewDJQuests),
        canEditPresentation: !!applyModule(!!mod?.presentation, !!canEditPresentation),
        canManageRelance: !!canManageRelance,
        canManageRBAC: !!canManageRBAC,
        canManagePoints: !!canManagePoints,
        canViewSettings: !!canViewSettings,
        canViewAuditLogs: !!canViewAuditLogs,
        isAdmin: !!isAdminFinal,
        isFirstAdminForGuild,
        isDiscordAdmin: !!(hasDiscordAdmin || isGod),
        isSuperAdmin: !!isGod,
        isMember: !!member,
        hasPseudoIssue: !profile?.pseudoDofus || profile.pseudoDofus.startsWith("Voyageur"),
        hasPreferredActivities: !!((profile?.preferredActivities as string[])?.length),
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
        pinnedNavItems: profile?.pinnedNavItems || [],
        hiddenNavItems: profile?.hiddenNavItems || [],
        isOnboardingComplete: !!isOnboardingComplete,
        missionVitrineMode: !!guildConfig?.missionVitrineMode,
    };

    if (!isOnboardingComplete && !isGod) {
        finalContext.canViewPresentation = false;
        finalContext.canViewStats = false;
        finalContext.canViewDocs = false;
        finalContext.canViewAdminDocs = false;
        finalContext.canViewResources = false;
        finalContext.canViewProfile = false;
        finalContext.canManageMembers = false;
        finalContext.canViewMissions = false;
        finalContext.canManageMissions = false;
        finalContext.canValidateMissions = false;
        finalContext.canManageBonus = false;
        finalContext.canViewRoster = false;
        finalContext.canViewSonges = false;
        finalContext.canCreateSonges = false;
        finalContext.canJoinSonges = false;
        finalContext.canViewOcre = false;
        finalContext.canViewLadder = false;
        finalContext.canSyncLadder = false;
        finalContext.canManualSyncLadder = false;
        finalContext.canViewQuests = false;
        finalContext.canViewWorldmap = false;
        finalContext.canViewFinder = false;
        finalContext.canViewServices = false;
        finalContext.canViewStuffGallery = false;
        finalContext.canViewMiniGames = false;
        finalContext.canViewPolls = false;
        finalContext.canViewCalendar = false;
        finalContext.canManageCalendar = false;
        finalContext.canManageRaid = false;
        finalContext.canJoinRaid = false;
        finalContext.canEditVacation = false;
        finalContext.canViewDJQuests = false;
        finalContext.canEditPresentation = false;
        finalContext.canManageRelance = false;
        finalContext.canManagePoints = false;
        finalContext.canViewAuditLogs = false;
    }

    // Store in Redis before returning.
    // SECURITY/UX: ne JAMAIS mettre en cache un contexte "refusé" (guilde non
    // autorisée OU rôle insuffisant) : sinon un rôle octroyé resterait ignoré
    // jusqu'à expiration du TTL (latence "il faut attendre" après l'octroi).
    const isDeniedContext = !finalContext.isAuthenticated || !finalContext.canViewDashboard;
    if (!isDeniedContext) {
        await redis.set(redisKey, JSON.stringify(finalContext), "EX", CACHE_TTL).catch(() => { });
    }

    return finalContext;
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
        logger.error("Error fetching user guilds:", error);
        return [];
    }
}

import { unstable_cache } from "next/cache";

const getCachedDiscordGuilds = async (accessToken: string) => {
    try {
        const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
            headers: { Authorization: `Bearer ${accessToken}` },
            next: { revalidate: 30 }
        });
        if (!res.ok) return { error: true, status: res.status, data: [] };
        const data = await res.json();
        return { error: false, status: 200, data };
    } catch (e) {
        return { error: true, status: 500, data: [] };
    }
};

/**
 * Item du portail multi-guilde (getGuildsSeparated).
 * `hasAccess` = le membre a déjà franchi le gatekeeper RBAC (profil ACTIVE) OU est
 * admin Discord. `accessLabel` est un libellé HONNÊTE : un candidat (sans profil,
 * sans rôle autorisé) voit « Rôle d'accès requis » — jamais « Accès Membre ».
 */
export type GuildPortalItem = {
    id: string;
    name: string;
    icon: string | null;
    isAdmin: boolean;
    hasAccess: boolean;
    accessLabel: string;
};

export async function getGuildsSeparated(): Promise<{
    active: GuildPortalItem[];
    pending: Array<{ id: string; name: string; icon: string | null }>;
    rateLimited: boolean;
}> {
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
        select: { discordGuildId: true, isActive: true }
    });
    const allowedIdsWhitelist = new Set(allowedGuildsDB.map(g => g.discordGuildId));

    // Also fetch ALL allowed guilds (including inactive) to detect "deleted by GOD" status
    const allAllowedGuilds = await db.allowedGuild.findMany({
        select: { discordGuildId: true, isActive: true, name: true }
    });
    const allowedGuildStatusMap = new Map(allAllowedGuilds.map(g => [g.discordGuildId, { isActive: g.isActive, name: g.name }]));

    // BUGFIX: isAllowedForDeployment must check that the allowedGuild is ACTIVE, not just exists
    const isAllowedForDeployment = (guildId: string) => {
        const status = allowedGuildStatusMap.get(guildId);
        return status ? status.isActive : false;
    };

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
                isAdmin: false,
                hasAccess: true,
                accessLabel: "Membre Actif",
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

    // Get statuses from DB to filter out BANNED/ARCHIVED
    const userProfiles = await db.userProfile.findMany({
        where: { userId },
        select: { status: true, guild: { select: { discordGuildId: true } } }
    });
    const statusMap = new Map(userProfiles.map(p => [p.guild.discordGuildId, p.status]));

    const active = validatedActive
        .filter(g => {
            const inDiscord = userGuildIds.has(g.discordGuildId);
            const status = statusMap.get(g.discordGuildId);
            return inDiscord && allowedIdsWhitelist.has(g.discordGuildId) && (status === "ACTIVE" || status === undefined);
        })
        .map(g => {
            const userGuild = userGuilds.find(ug => ug.id === g.discordGuildId);
            const perms = userGuild ? BigInt(userGuild.permissions) : 0n;
            const isAdmin = userGuild?.owner || (perms & 0x8n) === 0x8n;
            const status = statusMap.get(g.discordGuildId);
            // Libellé HONNÊTE : un profil n'existe QUE si le membre a déjà franchi le
            // gatekeeper RBAC (DASHBOARD_LOGIN / admin Discord / mapping). Un membre
            // sans profil (ex. candidat) n'a donc PAS encore accès → on affiche
            // "Rôle d'accès requis" au lieu de mentir avec "Accès Membre"/"Membre Actif".
            const hasAccess = isAdmin || status === "ACTIVE";
            const accessLabel = hasAccess
                ? isAdmin ? "Administrateur" : "Membre Actif"
                : "Rôle d'accès requis";
            return {
                id: g.discordGuildId,
                name: g.name,
                icon: g.iconUrl,
                isAdmin,
                hasAccess,
                accessLabel,
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
            name: getGameDisplayName(m),
            subtitle: m.discordNickname !== m.pseudoDofus ? m.discordNickname : undefined,
            image: m.user.image
        }));

        return { success: true, data: formatted };
    } catch (error) {
        logger.error("Search Members Error:", error);
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
            if (guildConfig) setBoundedCache(configCache, cacheKey, { data: guildConfig, expiresAt: Date.now() + CACHE_TTL });
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

        return allPerms.has(PERMISSIONS.SYSTEM_CONFIG) || allPerms.has(permission);
    } catch (e) {
        logger.error(`[PermissionCheck] Error for ${discordUserId} in ${guildId}:`, e);
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
        select: {
            id: true,
            userId: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            archivedAt: true,
            archiveReason: true,
            pseudoDofus: true,
            discordNickname: true,
            discordRoleName: true,
            discordRoleColor: true,
            ankamaId: true,
            discordMessageCountWeekly: true,
            discordVoiceTimeWeekly: true,
            scheduledDeletion: true,
            vacationStart: true,
            vacationEnd: true,
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
            discordMessageCountWeekly: m.discordMessageCountWeekly,
            discordVoiceTimeWeekly: m.discordVoiceTimeWeekly,
            scheduledDeletion: m.scheduledDeletion?.toISOString() || null,
            vacationStart: m.vacationStart?.toISOString() || null,
            vacationEnd: m.vacationEnd?.toISOString() || null,
            user: {
                name: getDisplayName(m),
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
    reason?: string,
    durationMonths?: number,
    adminMessage?: string
): Promise<{ success: boolean; error?: string; data?: any }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const res = await internalUpdateMemberProfileStatus(profileId, status, reason, durationMonths, adminMessage, session.user.id);
        if (res && 'error' in res) {
            return res as any;
        }
        return { success: true, data: res };
    } catch (e: any) {
        logger.error("[updateMemberProfileStatus] Unexpected error:", e);
        return { success: false, error: e?.message || "Erreur interne" };
    }
}

/**
 * Internal version of status update (for Discord hooks or system actions)
 * Bypasses auth() but requires profileId and actorUserId
 */
export async function internalUpdateMemberProfileStatus(
    profileId: string,
    status: "ACTIVE" | "ARCHIVED" | "BANNED",
    reason?: string,
    durationMonths?: number,
    adminMessage?: string,
    actorUserId?: string
) {
    // 1. Get profile to find guildId
    const profile = await db.userProfile.findUnique({
        where: { id: profileId },
        include: {
            guild: { select: { discordGuildId: true, name: true } },
            user: { include: { accounts: { where: { provider: "discord" } } } }
        }
    });

    if (!profile) throw new Error("Profile not found");

    // 2. SECURITY: Check if called from a session or internally
    // If actorUserId is provided, we assume the caller handled security
    if (!actorUserId) {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Unauthorized" };
        actorUserId = session.user.id;
    }

    // 3. 🔒 Prevent self-ban/self-archive — admin cannot lock themselves out
    if (status !== "ACTIVE" && profile.userId === actorUserId) {
        return { success: false, error: "Vous ne pouvez pas modifier votre propre statut (Protection anti-lockout)" };
    }

    // 4. 🔒 Prevent banning/archiving the Discord guild OWNER
    // Fetch the guild owner to make sure we're not targeting them
    try {
        const guildOwnerCheck = await db.guildConfig.findFirst({
            where: {
                OR: [
                    { id: profile.guildId },
                    { discordGuildId: profile.guild?.discordGuildId || "" }
                ]
            },
            select: { ownerId: true }
        });
        const targetDiscordId = profile.user?.accounts?.find((a: any) => a.provider === "discord")?.providerAccountId;
        if (guildOwnerCheck?.ownerId && targetDiscordId && guildOwnerCheck.ownerId === targetDiscordId && status !== "ACTIVE") {
            return { success: false, error: "Le propriétaire du serveur Discord ne peut pas être banni ou archivé depuis SigilOS." };
        }
    } catch { /* non-blocking: skip owner check on error */ }

    // 4. Update with retention policy
    let scheduledDeletion = null;
    if (status === "ARCHIVED") {
        const days = durationMonths ? durationMonths * 30.5 : 30;
        scheduledDeletion = new Date(Date.now() + Math.floor(days * 24 * 60 * 60 * 1000));
    } else if (status === "BANNED") {
        scheduledDeletion = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const updated = await db.userProfile.update({
        where: { id: profileId },
        data: {
            status,
            archivedAt: status !== "ACTIVE" ? new Date() : null,
            archiveReason: status !== "ACTIVE" ? (reason || "MANUAL_ADMIN_ACTION") : null,
            archiveDuration: durationMonths || (status === "ARCHIVED" ? 1 : null),
            scheduledDeletion,
            reactivationRequestedAt: null,
            reactivationRequestReason: null
        }
    });

    // Invalidate Redis cache
    await invalidateUserContextCache(updated.userId, profile.guild.discordGuildId);

    // ── F-01 : Tombstone guild-scopé — le ban persiste même si le profil est purgé plus tard ──
    const banDiscordId = profile.user?.accounts?.find((a: any) => a.provider === "discord")?.providerAccountId;
    if (banDiscordId) {
        try {
            if (status === "BANNED") {
                await db.guildMemberBan.upsert({
                    where: { guildId_discordId: { guildId: profile.guildId, discordId: banDiscordId } },
                    create: {
                        guildId: profile.guildId,
                        discordId: banDiscordId,
                        reason: reason || "MEMBER_BANNED",
                        bannedBy: actorUserId ?? "system",
                        bannedByName: "Admin"
                    },
                    update: {
                        reason: reason || "MEMBER_BANNED",
                        liftedAt: null,
                        liftedBy: null,
                        liftedByName: null
                    }
                });
            } else if (status === "ACTIVE") {
                await db.guildMemberBan.updateMany({
                    where: { guildId: profile.guildId, discordId: banDiscordId, liftedAt: null },
                    data: { liftedAt: new Date(), liftedBy: actorUserId ?? "system", liftedByName: "Admin" }
                });
            }
        } catch (banErr) {
            logger.error("[GuildMemberBan] sync after status update failed:", banErr);
        }
    }

    // 5. Audit & Activity
    // ── Chantier #31 : ban/archive → fermer le contenu publié (posts DJ + runs songes + embeds Discord)
    if (status === "BANNED" || status === "ARCHIVED") {
        try {
            const { closeMemberPublishedContent } = await import("./lifecycle-actions");
            await closeMemberPublishedContent(
                profile.guild?.discordGuildId || profile.guildId,
                profileId,
                profile.userId,
                status === "BANNED" ? (reason || "MEMBER_BANNED") : "MEMBER_ARCHIVED"
            );
        } catch (closeErr) {
            logger.error("[closeMemberPublishedContent] after status update failed:", closeErr);
        }
    }

    const targetProfile = await db.userProfile.findUnique({
        where: { id: profileId },
        select: {
            discordNickname: true,
            pseudoDofus: true,
            user: { select: { name: true, image: true } }
        }
    });
    const targetName = targetProfile?.pseudoDofus || targetProfile?.discordNickname || targetProfile?.user?.name || profileId;

    await logAction({
        guildId: profile.guild.discordGuildId,
        action: status === "ACTIVE" ? "PROFILE_REACTIVATED" : status === "BANNED" ? "MEMBER_BANNED" : "PROFILE_ARCHIVED",
        targetType: "PROFILE",
        targetId: profileId,
        oldValue: { status: profile.status },
        newValue: { status },
        metadata: {
            operation: "MEMBER_STATUS_UPDATE",
            description: targetName,
            reason: reason || "Manual Action",
            adminMessage
        }
    });

    // 6. Send Discord DM for reactivation decisions
    if (reason === "REACTIVATION_APPROVED" || reason === "REACTIVATION_REJECTED") {
        const discordId = profile.user?.accounts?.[0]?.providerAccountId;
        if (discordId) {
            const { sendDirectMessage } = await import("@/server/discord");

            const dmTitle = status === "ACTIVE"
                ? `✅ Réintégration Acceptée — ${profile.guild.name}`
                : `❌ Réintégration Refusée — ${profile.guild.name}`;

            const dmColor = status === "ACTIVE" ? 0x10b981 : 0xef4444;

            let dmDesc = status === "ACTIVE"
                ? `Bonne nouvelle ! Ta demande de réintégration a été **acceptée** par le staff.\nTu as de nouveau accès à toutes les fonctionnalités du dashboard SigilOS.`
                : `Ta demande de réintégration a malheureusement été **refusée** par le staff.`;

            if (adminMessage) {
                dmDesc += `\n\n**📝 Message du staff :**\n> *${adminMessage}*`;
            }

            if (status === "ACTIVE") {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
                dmDesc += `\n\n**🔗 [Accéder au Dashboard](${appUrl}/dashboard/${profile.guild.discordGuildId})**`;
            }

            await sendDirectMessage(discordId, "", {
                embedTitle: dmTitle,
                embedColor: dmColor,
                embedDescription: dmDesc
            }).catch(err => logger.error("Failed to send DM", err));
        }
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

    const targetName = updated.pseudoDofus || updated.discordNickname || profileId;

    const oldPseudo = profile.pseudoDofus || "aucun";
    await logAction({
        guildId: profile.guild.discordGuildId,
        action: "MEMBER_PSEUDO_UPDATE",
        targetType: "PROFILE",
        targetId: profileId,
        oldValue: { pseudo: profile.pseudoDofus },
        newValue: { pseudo: pseudoDofus },
        metadata: {
            operation: "MEMBER_PSEUDO_UPDATE",
            description: `Pseudo Dofus de ${targetName} modifié : "${oldPseudo}" → "${pseudoDofus}"`
        }
    });

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

    const targetName = updated.pseudoDofus || updated.discordNickname || profileId;

    const oldAnkama = profile.ankamaId || "aucun";
    await logAction({
        guildId: profile.guild.discordGuildId,
        action: "MEMBER_ANKAMA_ID_UPDATE",
        targetType: "PROFILE",
        targetId: profileId,
        oldValue: { ankamaId: profile.ankamaId },
        newValue: { ankamaId: ankamaId },
        metadata: {
            operation: "MEMBER_ANKAMA_ID_UPDATE",
            description: `ID Dofus (Ankama) de ${targetName} modifié : "${oldAnkama}" → "${ankamaId}"`
        }
    });

    revalidatePath(`/dashboard/${profile.guild.discordGuildId}/admin/settings`);
    return { success: true, data: updated };
}

export async function getDiscordRolesAction(guildId: string, options?: { ignoreWhitelist?: boolean, context?: "calendar" | "dj" | "songes" | "polls" | "missions" | "legacy" | "raid" }) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    // Security: Must be member to fetch guild roles (for finder/songes)
    const user = await getUserContext(guildId);
    if (!user.isMember) return { success: false, error: "Forbidden: Member access required" };

    try {
        const [roles, guildConfig] = await Promise.all([
            fetchGuildRoles(guildId, { excludeManaged: true }),
            db.guildConfig.findUnique({
                where: { discordGuildId: guildId },
                select: { allowedPingRoleIds: true, calendarPingRoleIds: true, raidPingRoleIds: true, djPingRoleIds: true, songesPingRoleIds: true, pollsPingRoleIds: true, missionPingRoleIds: true }
            })
        ]);

        let filteredRoles = roles;

        // Apply whitelist filtering (strict-whitelist-by-default for EVERYONE — members AND admins).
        // The whitelist is bypassed ONLY when explicitly requested (ignoreWhitelist: true in the
        // admin settings panels via PingRolesSelector). In creation modals (calendar/raid/songes/dj),
        // admins must see exactly the same whitelisted roles as any member. Fail-closed.
        const shouldIgnoreWhitelist = options?.ignoreWhitelist === true;
        if (!shouldIgnoreWhitelist) {
            let allowedIds: string[] = [];
            if (options?.context === "calendar") allowedIds = guildConfig?.calendarPingRoleIds || [];
            else if (options?.context === "raid") allowedIds = guildConfig?.raidPingRoleIds || [];
            else if (options?.context === "dj") allowedIds = guildConfig?.djPingRoleIds || [];
            else if (options?.context === "songes") allowedIds = guildConfig?.songesPingRoleIds || [];
            else if (options?.context === "polls") allowedIds = guildConfig?.pollsPingRoleIds || [];
            else if (options?.context === "missions") allowedIds = guildConfig?.missionPingRoleIds || [];
            else allowedIds = guildConfig?.allowedPingRoleIds || [];

            filteredRoles = roles.filter(r => allowedIds.includes(r.id));
        }

        return {
            success: true,
            roles: filteredRoles.map(r => ({
                id: r.id,
                name: r.name,
                color: r.color
            }))
        };
    } catch (error) {
        logger.error("Get Discord Roles Error:", error);
        return { success: false, error: "Erreur lors de la récupération des rôles" };
    }
}

/**
 * Compte le nombre de membres Discord UNIQUES qui seront pingés pour une
 * combinaison de rôles. Une personne peut porter plusieurs rôles sélectionnés
 * → on déduplique par ID de membre. Fail-closed : auth membre requise.
 * Appelé une fois à l'ouverture d'une modale de création (coût Discord).
 */
export async function countPingedMembers(
    guildId: string,
    roleIds: string[]
): Promise<ActionResponse<{ count: number }>> {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const user = await getUserContext(guildId);
    if (!user.isMember) return { success: false, error: "Forbidden: Member access required" };

    try {
        const { listGuildMembers } = await import("@/server/discord");
        const members = (await listGuildMembers(guildId)).map((m: any) => ({
            id: m?.user?.id || "",
            roles: Array.isArray(m?.roles) ? m.roles : [],
        }));

        const roleSet = new Set(roleIds);
        const uniqueIds = new Set<string>();
        for (const m of members) {
            if (!m.id) continue;
            if (m.roles.some((r: string) => roleSet.has(r))) {
                uniqueIds.add(m.id);
            }
        }

        return { success: true, data: { count: uniqueIds.size } };
    } catch (error) {
        logger.error("[countPingedMembers] failed", error);
        return { success: false, error: "Erreur lors du calcul du ping" };
    }
}

/**
 * Update the whitelist of allowed Discord roles for pings (Admin only)
 */
export async function updateAllowedPingRolesAction(guildId: string, roleIds: string[], context: "calendar" | "dj" | "songes" | "polls" | "missions" | "legacy" | "raid" = "legacy") {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Forbidden: Admin access required" };

    try {
        const data: any = {};
        if (context === "calendar") data.calendarPingRoleIds = roleIds;
        else if (context === "raid") data.raidPingRoleIds = roleIds;
        else if (context === "dj") data.djPingRoleIds = roleIds;
        else if (context === "songes") data.songesPingRoleIds = roleIds;
        else if (context === "polls") data.pollsPingRoleIds = roleIds;
        else if (context === "missions") data.missionPingRoleIds = roleIds;
        else data.allowedPingRoleIds = roleIds;

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data
        });

        await logAction({
            guildId,
            action: "SETTINGS_UPDATED",
            targetType: "CONFIG",
            targetId: guildId,
            newValue: { roleIds },
            metadata: { description: `Mise à jour de la liste blanche des pings (${roleIds.length} rôles)` }
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        logger.error("Update Allowed Ping Roles Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour des rôles autorisés" };
    }
}
