"use server";

import { auth } from "@/auth";
import { fetchGuildRoles, fetchGuild } from "@/server/discord";
import { db } from "@/lib/prisma";
import { PERMISSIONS, type PermissionId } from "@/lib/permissions";

export type UserContext = {
    isAuthenticated: boolean;
    name?: string;
    image?: string;
    roleName?: string;
    roleColor?: number;
    canManageProfile: boolean;
    isAdmin: boolean;
};

export async function getUserContext(guildId?: string): Promise<UserContext> {
    const session = await auth();

    if (!session?.user?.id) {
        return { isAuthenticated: false, canManageProfile: false, isAdmin: false };
    }

    const targetGuildId = guildId || process.env.DISCORD_GUILD_ID;
    if (!targetGuildId) return { isAuthenticated: true, canManageProfile: false, isAdmin: false };

    // 1. Get Guild Config for Mappings
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: targetGuildId },
        select: { rolesMapping: true }
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
        return { isAuthenticated: true, canManageProfile: false, isAdmin: false };
    }

    const discordUserId = account.providerAccountId;

    // Placeholder for Member Fetching (Implementing logic directly here for MVP if discord.ts lacks it, 
    // ideally should be in discord.ts)
    const token = process.env.DISCORD_BOT_TOKEN;
    const memberRes = await fetch(`https://discord.com/api/v10/guilds/${targetGuildId}/members/${discordUserId}`, {
        headers: { Authorization: `Bot ${token}` },
        next: { revalidate: 0 } // No cache for debugging
    });

    let memberRoles: string[] = [];
    let myRoles: any[] = []; // Store full role objects for debug
    let roleColor = 0;
    let roleName = "Membre";


    const guildInfo = await fetchGuild(targetGuildId).catch(() => null);

    if (memberRes.ok) {
        const member = await memberRes.json();
        memberRoles = member.roles;

        // Show ALL roles for hierarchy display, not just filtered ones
        const allRoles = await fetchGuildRoles(targetGuildId, { excludeManaged: false });

        // Find user's roles in allRoles (which are sorted by position DESC)
        myRoles = allRoles.filter(r => memberRoles.includes(r.id));

        if (myRoles.length > 0) {
            const topRole = myRoles[0]; // First one is highest position
            roleName = topRole.name;
            roleColor = topRole.color;
        }

        // --- OVERRIDES ---
        // 1. Owner Override
        if (guildInfo && guildInfo.owner_id === discordUserId) {
            roleName = "Empereur"; // Custom title for Server Owner
            roleColor = 0xFFD700; // Gold color
        }
        // 2. Admin Override (if no specific role name was found or just "Membre")
        else if (roleName === "Membre") {
            // Check for Administrator permission (0x8) in any role
            const isAdmin = myRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
            if (isAdmin) {
                roleName = "Administrateur";
                roleColor = 0x5865F2; // Discord Blurple
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

    const canManageProfile = myPerms.has(PERMISSIONS.PROFILE_UPDATE_SELF);

    // Fallback: If user has Discord "ADMINISTRATOR" permission (0x8), they are Admin.
    // This prevents lockout before roles are mapped.
    const hasDiscordAdmin = myRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
    const isAdmin = myPerms.has(PERMISSIONS.ADMIN_ACCESS) || hasDiscordAdmin;

    return {
        isAuthenticated: true,
        name: session.user.name || "Voyageur",
        image: session.user.image || undefined,
        roleName,
        roleColor,
        canManageProfile,
        isAdmin
    };
};
