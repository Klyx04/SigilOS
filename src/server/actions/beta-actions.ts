'use server';

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { isSuperAdmin, isGuildAllowed } from "@/server/actions/super-admin-actions";

export type EligibilityResult = {
    status: "ACCESS_GRANTED_ADMIN" | "ACCESS_GRANTED_MEMBER" | "PROSPECT" | "VISITOR" | "NO_SESSION";
    guildName?: string;
    guildId?: string;
    reason?: string;
};

export async function checkEligibility(): Promise<EligibilityResult> {
    const session = await auth();

    if (!session?.user?.id) {
        return { status: "NO_SESSION" };
    }

    // 1. Get user's Discord Account ID with Retry Logic (Fix Race Condition)
    let account = await db.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
        select: { providerAccountId: true, access_token: true }
    });

    // If token is missing (race condition with signIn event), wait and retry once
    if (!account?.access_token) {
        console.log("[BetaCheck] Token missing, retrying in 500ms...");
        await new Promise(resolve => setTimeout(resolve, 500));
        account = await db.account.findFirst({
            where: { userId: session.user.id, provider: "discord" },
            select: { providerAccountId: true, access_token: true }
        });
    }

    if (!account?.providerAccountId || !account.access_token) {
        return { status: "NO_SESSION" };
    }

    try {
        // 2. Fetch ALL user's guilds from Discord
        const response = await fetch("https://discord.com/api/users/@me/guilds", {
            headers: { Authorization: `Bearer ${account.access_token}` },
            next: { revalidate: 60 } // Cache for 1 min to avoid spamming Discord
        });

        if (!response.ok) {
            console.error("[BetaCheck] Discord API Error:", response.status);
            return { status: "NO_SESSION" };
        }

        const userGuilds = await response.json() as Array<{
            id: string;
            name: string;
            permissions: string;
        }>;

        // 3. Fetch Whitelisted Guilds from DB
        const allowedGuilds = await db.allowedGuild.findMany({
            where: { isActive: true },
            select: { discordGuildId: true }
        });
        const allowedIds = new Set(allowedGuilds.map(g => g.discordGuildId));

        // 4. CHECK 1: ACCESS GRANTED (Is member of ANY allowed guild?)
        const memberGuild = userGuilds.find(g => allowedIds.has(g.id));

        if (memberGuild) {
            // Check if user is also Admin of this allowed guild
            const perms = BigInt(memberGuild.permissions);
            const isAdmin = (perms & 0x8n) === 0x8n || (perms & 0x20n) === 0x20n;

            return {
                status: isAdmin ? "ACCESS_GRANTED_ADMIN" : "ACCESS_GRANTED_MEMBER",
                guildName: memberGuild.name,
                guildId: memberGuild.id
            };
        }

        // 5. CHECK 2: PROSPECT (Is Admin of ANY non-allowed guild?)
        // Filter for Admin (0x8) or Manage Guild (0x20)
        const adminGuild = userGuilds.find(g => {
            const perms = BigInt(g.permissions);
            return (perms & 0x8n) === 0x8n || (perms & 0x20n) === 0x20n;
        });

        if (adminGuild) {
            return {
                status: "PROSPECT",
                guildName: adminGuild.name,
                guildId: adminGuild.id
            };
        }

        // 6. CHECK 3: VISITOR (Just a random user)
        return { status: "VISITOR" };

    } catch (error) {
        console.error("[BetaCheck] Exception:", error);
        return { status: "NO_SESSION" };
    }
}
