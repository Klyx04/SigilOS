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
    canViewMissions: boolean;
    canViewRoster: boolean;
    isAdmin: boolean;
    isMember: boolean;
    guildName?: string;
};

export async function getUserContext(guildId?: string): Promise<UserContext> {
    const session = await auth();

    if (!session?.user?.id) {
        return { isAuthenticated: false, canManageProfile: false, isAdmin: false, isMember: false, canViewMissions: false, canViewRoster: false };
    }

    const targetGuildId = guildId || process.env.DISCORD_GUILD_ID;
    if (!targetGuildId) return { isAuthenticated: true, canManageProfile: false, isAdmin: false, isMember: false, canViewMissions: false, canViewRoster: false };

    // 1. Get Guild Config for Mappings
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: targetGuildId },
        select: { id: true, rolesMapping: true, name: true }
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
        return { isAuthenticated: true, canManageProfile: false, isAdmin: false, isMember: false, canViewMissions: false, canViewRoster: false };
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

    if (!profile && guildConfig) {
        console.log(`[UserContext] Auto-creating profile for user ${session.user.id} in guild ${guildConfig.id}`);
        try {
            profile = await db.userProfile.create({
                data: {
                    userId: session.user.id,
                    guildId: guildConfig.id,
                    // Basic defaults
                }
            });
        } catch (e) {
            console.error("[UserContext] Failed to auto-create profile:", e);
        }
    }

    // Parallelize Discord API calls for performance
    const token = process.env.DISCORD_BOT_TOKEN;

    const [memberRes, guildInfo, allRoles] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${targetGuildId}/members/${discordUserId}`, {
            headers: { Authorization: `Bot ${token}` },
            next: { revalidate: 60 } // Cache for 60s
        }),
        fetchGuild(targetGuildId).catch(() => null),
        fetchGuildRoles(targetGuildId, { excludeManaged: false }).catch(() => [])
    ]);

    let memberRoles: string[] = [];
    let myRoles: any[] = [];
    let roleColor = 0;
    let roleName = "Membre";

    if (memberRes.ok) {
        const member = await memberRes.json();
        memberRoles = member.roles;

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

    // View Permissions (Admin always sees everything)
    const canViewMissions = myPerms.has(PERMISSIONS.MISSIONS_VIEW) || isAdmin;
    const canViewRoster = myPerms.has(PERMISSIONS.PROFILE_VIEW_ALL) || isAdmin;

    return {
        isAuthenticated: true,
        name: session.user.name || "Voyageur",
        image: session.user.image || undefined,
        roleName,
        roleColor,
        canManageProfile,
        canViewMissions,
        canViewRoster,
        isAdmin,
        isMember: memberRes.ok,
        guildName: guildInfo?.name || guildConfig?.name || "Serveur Inconnu"
    };
};
