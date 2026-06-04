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

    // ─── Cache permission result for 60s to avoid 3× Discord API calls per action ───
    const cacheKey = `guard:admin:${discordUserId}:${guildId}`;
    try {
        const { redis } = await import("@/lib/redis");
        if (redis.status === "ready") {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached) as { isAuthorized: boolean; discordUserId: string };
                return parsed;
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
            // 🛡️ SECURITY: Only log as a security event for external/non-member users.
            // Guild members with partial permissions (validators, managers, etc.) legitimately
            // reach this check without being Discord admins — this is expected behavior.
            // We log ONLY external users (potential scanners/intruders) as a security event.
            // Note: logAdminAccessDenied itself also filters members as a defense-in-depth measure.
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
