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
 * @returns GuardResult with authorization status
 */
export async function requireGuildAdmin(guildId: string): Promise<GuardResult> {
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
            return { isAuthorized: true, discordUserId };
        }

        // Check 2: Is guild member?
        if (!member) {
            return { isAuthorized: false, error: "Not a member of this guild" };
        }

        // Check 3: Has Administrator Permission (0x8)?
        const memberRoles = guildRoles.filter((r: any) => member.roles.includes(r.id));
        const isAdmin = memberRoles.some((r: any) => (BigInt(r.permissions) & 0x8n) === 0x8n);

        if (!isAdmin) {
            const { logAdminAccessDenied } = await import("./audit-actions");
            await logAdminAccessDenied(guildId, "ADMIN_GUARD_FAILURE");
            return { isAuthorized: false, error: "Admin permission required" };
        }

        return { isAuthorized: true, discordUserId };
    } catch (error) {
        console.error("[Guard] Admin check failed:", error);
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
