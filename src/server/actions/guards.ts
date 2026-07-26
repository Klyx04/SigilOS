"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { isGuildAllowed } from "./super-admin-actions";

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
export async function requireGuildAdmin(guildId: string, context: string = "Accès Dashboard Admin"): Promise<GuardResult> {
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

    // ─── Cache permission result for 60s (POSITIVE RESULTS ONLY) to avoid 3× Discord API calls per action ───
    // NEVER cache a negative result — doing so would lock out legitimate admins for 60s
    // if the Discord API temporarily fails, rate-limits, or returns a stale response.
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
                if (redis.status === "ready") await redis.set(cacheKey, JSON.stringify(result), "EX", 60);
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
            // 🛡️ FALLBACK: Discord API says "not admin" — but before returning a denial,
            // check the RBAC local cache (user context) as a safety net.
            // This prevents false rejections when the Discord API is temporarily
            // inconsistent (e.g. role propagation delay, rate-limit stale data).
            // Security: the RBAC already verified Discord admin bit during getUserContext,
            // so this is not a bypass — it's a consistency fallback.
            try {
                const { getUserContext } = await import("./user-actions");
                const userCtx = await getUserContext(guildId);
                if (userCtx.isDiscordAdmin) {
                    // RBAC confirms this user IS a Discord admin — honor the local state
                    // and return authorized.
                    const result = { isAuthorized: true, discordUserId };
                    // Cache positive result for 60s
                    try {
                        const { redis } = await import("@/lib/redis");
                        if (redis.status === "ready") await redis.set(cacheKey, JSON.stringify(result), "EX", 60);
                    } catch { /* ignore */ }
                    return result;
                }
            } catch { /* RBAC fallback also failed — proceed with Discord result */ }

            return { isAuthorized: false, error: "Admin permission required" };
        }

        const result = { isAuthorized: true, discordUserId };
        // Cache positive result for 60s
        try {
            const { redis } = await import("@/lib/redis");
            if (redis.status === "ready") await redis.set(cacheKey, JSON.stringify(result), "EX", 60);
        } catch { /* ignore */ }

        return result;
    } catch (error) {
        console.error(`[Guard] Admin check failed for ${context}:`, error);
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

    // ─── Cache permission result for 60s (POSITIVE RESULTS ONLY) ───
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
                if (redis.status === "ready") await redis.set(cacheKey, JSON.stringify(result), "EX", 60);
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
                if (redis.status === "ready") await redis.set(cacheKey, JSON.stringify(result), "EX", 60);
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
                    if (redis.status === "ready") await redis.set(cacheKey, JSON.stringify(result), "EX", 60);
                } catch { /* ignore */ }
                return result;
            }
        } catch { /* RBAC fallback failed — proceed with denial */ }

        return { isAuthorized: false, error: "Admin permission required" };
    } catch (error) {
        console.error(`[Guard] Config access check failed for ${context}:`, error);
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
        console.error("[Guard] Member check failed:", error);
        return { isAuthorized: false, error: "Permission check failed" };
    }
}