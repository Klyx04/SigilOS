"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { isGuildAllowed } from "./super-admin-actions";
import { logger } from "@/lib/logger";

export type GuardResult = {
    isAuthorized: boolean;
    error?: string;
    discordUserId?: string;
};

/**
 * Require the current user to be a Discord Administrator of the guild.
 * Checks: Owner OR Discord permission bit 0x8 (ADMINISTRATOR).
 * 
 * @param guildId - Discord Guild ID
 * @param context - Human-readable name of the action/page being accessed (for logging)
 * @returns GuardResult with authorization status
 */
export async function requireGuildAdmin(
    guildId: string, 
    context: string = "Accès Dashboard Admin",
    options: { allowOnboarding?: boolean } = {}
): Promise<GuardResult> {
    const session = await auth();
    if (!session?.user?.id) {
        return { isAuthorized: false, error: "Unauthorized" };
    }

    // Platform Guard: Is the guild allowed/active?
    if (!options.allowOnboarding) {
        const allowed = await isGuildAllowed(guildId);
        if (!allowed) {
            return { isAuthorized: false, error: "This guild is currently deactivated or banned." };
        }
    } else {
        const isBanned = await db.platformBan.findFirst({
            where: { discordId: guildId, entityType: "GUILD" }
        });
        if (isBanned) {
            return { isAuthorized: false, error: "This guild has been banned from SigilOS." };
        }
        const existingAllowed = await db.allowedGuild.findUnique({
            where: { discordGuildId: guildId }
        });
        if (existingAllowed && !existingAllowed.isActive) {
            return { isAuthorized: false, error: "This guild is currently deactivated." };
        }
    }

    const account = await db.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
        select: { providerAccountId: true }
    });

    if (!account) {
        return { isAuthorized: false, error: "No Discord account linked" };
    }

    const discordUserId = account.providerAccountId;

    // ─── Cache permission result for 30s (POSITIVE RESULTS ONLY) to avoid 3× Discord API calls per action ───
    // NEVER cache a negative result — doing so would lock out legitimate admins for 30s
    // if the Discord API temporarily fails, rate-limits, or returns a stale response.
    // SECURITY (F-13): TTL reduced from 60s → 30s so a revocation/bann propagates faster.
    const cacheKey = `guard:admin:${discordUserId}:${guildId}`;
    try {
        const { redis } = await import("@/lib/redis");
        if (redis.status === "ready") {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached) as { isAuthorized: boolean; discordUserId: string };
                // Only return from cache if it's a positive result
                if (parsed.isAuthorized) return parsed;
                // Negative cache hit: delete the stale rejection and re-check live
                await redis.del(cacheKey).catch(() => {});
            }
        }
    } catch { /* ignore cache errors, fall through to live check */ }

    try {
        const { fetchGuild, fetchGuildMember, fetchGuildRoles } = await import("@/server/discord");
        const { isSuperAdmin } = await import("./super-admin-actions");

        // Super-admin bypass (Platform God Mode)
        if (await isSuperAdmin()) return { isAuthorized: true, discordUserId };

        // Parallel fetch for performance (~3x faster)
        const [guildInfo, member, guildRoles] = await Promise.all([
            fetchGuild(guildId),
            fetchGuildMember(guildId, discordUserId),
            fetchGuildRoles(guildId, { excludeManaged: false })
        ]);

        // Check 1: Is Owner?
        if (guildInfo.owner_id === discordUserId) {
            const result = { isAuthorized: true, discordUserId };
            // Cache positive result
            try {
                const { redis } = await import("@/lib/redis");
                if (redis.status === "ready") await redis.set(cacheKey, JSON.stringify(result), "EX", 30);
            } catch { /* ignore */ }
            return result;
        }

        // Check 2: Is guild member?
        if (!member) {
            return { isAuthorized: false, error: "Not a member of this guild" };
        }

        // Check 3: Has Administrator Permission (0x8)?
        const memberRoles = guildRoles.filter((r: any) => member.roles.includes(r.id));
        const isAdmin = memberRoles.some((r: any) => (BigInt(r.permissions) & 0x8n) === 0x8n);

        if (!isAdmin) {
            // F-01: Discord API is the single source of truth — deny without a
            // redundant re-fetch. The previous "RBAC consistency fallback" re-called
            // getUserContext which re-fetches the SAME live Discord data, granting
            // nothing extra while contradicting the zero-trust principle.
            return { isAuthorized: false, error: "Admin permission required" };
        }

        const result = { isAuthorized: true, discordUserId };
        // Cache positive result for 30s
        try {
            const { redis } = await import("@/lib/redis");
            if (redis.status === "ready") await redis.set(cacheKey, JSON.stringify(result), "EX", 30);
        } catch { /* ignore */ }

        return result;
    } catch (error) {
        logger.error(`[Guard] Admin check failed for ${context}:`, { error: (error as Error).message });
        return { isAuthorized: false, error: "Permission check failed" };
    }
}

export type RbacManagementResult = GuardResult & {
    /**
     * "discord-admin" = propriétaire / permission native Discord 0x8 / God.
     * "delegated"     = détenteur de la permission RBAC `system:rbac` (Gestion des Accès).
     * Les détenteurs "delegated" ne peuvent PAS octroyer/révoquer system:god et system:rbac.
     */
    rbacLevel?: "discord-admin" | "delegated";
};

/**
 * Require the current user to be allowed to manage the RBAC matrix.
 *
 * Deux chemins sont acceptés :
 *  1. Discord Administrator (owner OU bit 0x8) — niveau "discord-admin".
 *  2. Délégation RBAC `system:rbac` (canManageRBAC) — niveau "delegated".
 *
 * Le niveau est renvoyé pour permettre aux appelants (ex. updateRBACMapping) d'appliquer
 * le garde-fou « les permissions sensibles restent réservées aux admins Discord ».
 *
 * @param guildId - Discord Guild ID
 * @param context - Human-readable name of the action/page being accessed (for logging)
 */
export async function requireRbacManagement(guildId: string, context: string = "Gestion des Permissions (RBAC)"): Promise<RbacManagementResult> {
    const session = await auth();
    if (!session?.user?.id) {
        return { isAuthorized: false, error: "Unauthorized" };
    }

    // Platform Guard: Is the guild allowed/active?
    const allowed = await isGuildAllowed(guildId);
    if (!allowed) {
        return { isAuthorized: false, error: "This guild is currently deactivated or banned." };
    }

    const account = await db.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
        select: { providerAccountId: true }
    });

    if (!account) {
        return { isAuthorized: false, error: "No Discord account linked" };
    }

    const discordUserId = account.providerAccountId;

    // ─── Cache permission result for 30s (POSITIVE RESULTS ONLY) ───
    const cacheKey = `guard:rbac:${discordUserId}:${guildId}`;
    try {
        const { redis } = await import("@/lib/redis");
        if (redis.status === "ready") {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached) as { isAuthorized: boolean; discordUserId: string; rbacLevel: "discord-admin" | "delegated" };
                if (parsed.isAuthorized) return parsed;
                await redis.del(cacheKey).catch(() => {});
            }
        }
    } catch { /* ignore cache errors, fall through to live check */ }

    const cachePositive = async (result: RbacManagementResult) => {
        try {
            const { redis } = await import("@/lib/redis");
            if (redis.status === "ready") await redis.set(cacheKey, JSON.stringify(result), "EX", 30);
        } catch { /* ignore */ }
    };

    try {
        const { isSuperAdmin } = await import("./super-admin-actions");
        if (await isSuperAdmin()) {
            const result: RbacManagementResult = { isAuthorized: true, discordUserId, rbacLevel: "discord-admin" };
            await cachePositive(result);
            return result;
        }

        // Chemin 1 — Admin Discord natif (owner ou bit 0x8). Réutilise requireGuildAdmin
        // (single source of truth Discord, zéro fallback RBAC redondant).
        const adminGuard = await requireGuildAdmin(guildId, context);
        if (adminGuard.isAuthorized && adminGuard.discordUserId) {
            const result: RbacManagementResult = { isAuthorized: true, discordUserId, rbacLevel: "discord-admin" };
            await cachePositive(result);
            return result;
        }

        // Chemin 2 — Délégation RBAC : détenteur de `system:rbac` (canManageRBAC).
        // Permet à une guilde de nommer un « successeur » qui gère les permissions
        // SigilOS sans détenir le rôle Discord Admin (continuité si l'admin disparaît).
        try {
            const { getUserContext } = await import("./user-actions");
            const userCtx = await getUserContext(guildId);
            if (userCtx.canManageRBAC) {
                const result: RbacManagementResult = { isAuthorized: true, discordUserId, rbacLevel: "delegated" };
                await cachePositive(result);
                return result;
            }
        } catch { /* RBAC fallback failed — proceed with denial */ }

        return { isAuthorized: false, error: "Admin permission required" };
    } catch (error) {
        logger.error(`[Guard] RBAC management check failed for ${context}:`, { error: (error as Error).message });
        return { isAuthorized: false, error: "Permission check failed" };
    }
}

/**
 * Require the current user to have access to guild configuration settings.
 * 
 * This is a LESS restrictive guard than requireGuildAdmin — it accepts:
 * 1. Discord Administrators (owner OR permission bit 0x8)
 * 2. Users with the RBAC permission "system:config" (Paramétrage Technique)
 * 
 * The RBAC fallback allows guild officers with delegated settings access
 * to modify configurations without needing the full Discord Admin toggle.
 * 
 * @param guildId - Discord Guild ID
 * @param context - Human-readable name of the action being accessed (for logging)
 * @returns GuardResult with authorization status
 */
export async function requireGuildConfigAccess(guildId: string, context: string = "Accès Configuration Guilde"): Promise<GuardResult> {
    const session = await auth();
    if (!session?.user?.id) {
        return { isAuthorized: false, error: "Unauthorized" };
    }

    // Platform Guard: Is the guild allowed/active?
    const allowed = await isGuildAllowed(guildId);
    if (!allowed) {
        return { isAuthorized: false, error: "This guild is currently deactivated or banned." };
    }

    const account = await db.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
        select: { providerAccountId: true }
    });

    if (!account) {
        return { isAuthorized: false, error: "No Discord account linked" };
    }

    const discordUserId = account.providerAccountId;

    // ─── Cache permission result for 30s (POSITIVE RESULTS ONLY) ───
    // SECURITY (F-13): TTL reduced from 60s → 30s.
    const cacheKey = `guard:config:${discordUserId}:${guildId}`;
    try {
        const { redis } = await import("@/lib/redis");
        if (redis.status === "ready") {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached) as { isAuthorized: boolean; discordUserId: string };
                if (parsed.isAuthorized) return parsed;
                await redis.del(cacheKey).catch(() => {});
            }
        }
    } catch { /* ignore cache errors */ }

    try {
        const { fetchGuild, fetchGuildMember, fetchGuildRoles } = await import("@/server/discord");
        const { isSuperAdmin } = await import("./super-admin-actions");

        // Super-admin bypass (Platform God Mode)
        if (await isSuperAdmin()) return { isAuthorized: true, discordUserId };

        // Parallel fetch for performance
        const [guildInfo, member, guildRoles] = await Promise.all([
            fetchGuild(guildId),
            fetchGuildMember(guildId, discordUserId),
            fetchGuildRoles(guildId, { excludeManaged: false })
        ]);

        // Check 1: Is Owner?
        if (guildInfo.owner_id === discordUserId) {
            const result = { isAuthorized: true, discordUserId };
            try {
                const { redis } = await import("@/lib/redis");
                if (redis.status === "ready") await redis.set(cacheKey, JSON.stringify(result), "EX", 30);
            } catch { /* ignore */ }
            return result;
        }

        // Check 2: Is guild member?
        if (!member) {
            return { isAuthorized: false, error: "Not a member of this guild" };
        }

        // Check 3: Has Administrator Permission (0x8)?
        const memberRoles = guildRoles.filter((r: any) => member.roles.includes(r.id));
        const isDiscordAdmin = memberRoles.some((r: any) => (BigInt(r.permissions) & 0x8n) === 0x8n);

        if (isDiscordAdmin) {
            const result = { isAuthorized: true, discordUserId };
            try {
                const { redis } = await import("@/lib/redis");
                if (redis.status === "ready") await redis.set(cacheKey, JSON.stringify(result), "EX", 30);
            } catch { /* ignore */ }
            return result;
        }

        // 🛡️ FALLBACK: Not a Discord admin — check RBAC for system:config permission.
        // This allows guild officers with delegated settings access via the RBAC matrix
        // to modify configurations without needing the full Discord Admin toggle.
        try {
            const { getUserContext } = await import("./user-actions");
            const userCtx = await getUserContext(guildId);
            if (userCtx.canViewSettings) {
                // User has system:config RBAC — authorized for config actions
                const result = { isAuthorized: true, discordUserId };
                try {
                    const { redis } = await import("@/lib/redis");
                    if (redis.status === "ready") await redis.set(cacheKey, JSON.stringify(result), "EX", 30);
                } catch { /* ignore */ }
                return result;
            }
        } catch { /* RBAC fallback failed — proceed with denial */ }

        return { isAuthorized: false, error: "Admin permission required" };
    } catch (error) {
        logger.error(`[Guard] Config access check failed for ${context}:`, { error: (error as Error).message });
        return { isAuthorized: false, error: "Permission check failed" };
    }
}

/**
 * Require the current user to be a member of the guild.
 * 
 * @param guildId - Discord Guild ID
 * @returns GuardResult with authorization status
 */
export async function requireGuildMember(guildId: string): Promise<GuardResult> {
    const session = await auth();
    if (!session?.user?.id) {
        return { isAuthorized: false, error: "Unauthorized" };
    }

    // Platform Guard: Is the guild allowed/active?
    const allowed = await isGuildAllowed(guildId);
    if (!allowed) {
        return { isAuthorized: false, error: "This guild is currently deactivated or banned." };
    }

    const account = await db.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
        select: { providerAccountId: true }
    });

    if (!account) {
        return { isAuthorized: false, error: "No Discord account linked" };
    }

    try {
        const { fetchGuildMember } = await import("@/server/discord");
        const member = await fetchGuildMember(guildId, account.providerAccountId);
        if (!member) {
            return { isAuthorized: false, error: "Not a member of this guild" };
        }

        return { isAuthorized: true, discordUserId: account.providerAccountId };
    } catch (error) {
        logger.error("[Guard] Member check failed:", { error: (error as Error).message });
        return { isAuthorized: false, error: "Permission check failed" };
    }
}