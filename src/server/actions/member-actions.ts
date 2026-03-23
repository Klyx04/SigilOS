"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { listGuildMembers, fetchGuildRoles } from "@/server/discord";
import { getUserContext } from "./user-actions";
import { ActionResponse } from "./user-actions";

export type MemberReconciliationData = {
    discordId: string;
    username: string;
    displayName: string;
    roles: string[];
    joinedAt: string | null;
    isBot: boolean;
    hasDashboardProfile: boolean;
    profileId?: string;
    ankamaId?: string | null;
};

export type RoleStats = {
    roleId: string;
    roleName: string;
    roleColor: number;
    totalDiscord: number;
    totalDashboard: number;
    unregistered: number;
};

export async function getMemberReconciliation(guildId: string): Promise<ActionResponse<{
    members: MemberReconciliationData[];
    stats: RoleStats[];
    authorizedRoles: string[];
}>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    if (!guildId) return { success: false, error: "ID de guilde manquant" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, rolesMapping: true }
        });

        if (!guild) return { success: false, error: "Guilde non configurée" };

        const [discordMembers, allRoles, dbProfiles] = await Promise.all([
            listGuildMembers(guildId, 1000) as Promise<any[]>,
            fetchGuildRoles(guildId, { excludeManaged: false }),
            db.userProfile.findMany({
                where: { guildId: guild.id, status: "ACTIVE" },
                select: { 
                    userId: true, 
                    id: true, 
                    ankamaId: true,
                    user: { 
                        select: { 
                            accounts: { 
                                where: { provider: "discord" }, 
                                select: { providerAccountId: true } 
                            } 
                        } 
                    } 
                }
            })
        ]);

        const roleMap = new Map(allRoles.map(r => [r.id, r]));
        const rolesMapping = (guild.rolesMapping as Record<string, string[]>) || {};
        
        // Roles that have at least one permission on the dashboard
        const authorizedRoleIds = Object.keys(rolesMapping).filter(rId => 
            Array.isArray(rolesMapping[rId]) && rolesMapping[rId].length > 0
        );

        // Map profiles by Discord ID
        const profileByDiscordId = new Map<string, { id: string, ankamaId?: string | null }>();
        dbProfiles.forEach(p => {
            const discordId = p.user.accounts[0]?.providerAccountId;
            if (discordId) profileByDiscordId.set(discordId, { id: p.id, ankamaId: p.ankamaId });
        });

        const reconciliation: MemberReconciliationData[] = discordMembers
            .filter((m: any) => !m.user.bot) // Exclude bots
            .filter((m: any) => m.roles.some((rId: string) => authorizedRoleIds.includes(rId))) // Only authorized roles
            .map((m: any) => ({
                discordId: m.user.id,
                username: m.user.username,
                displayName: m.nick || m.user.global_name || m.user.username,
                roles: m.roles,
                joinedAt: m.joined_at || null,
                isBot: !!m.user.bot,
                hasDashboardProfile: profileByDiscordId.has(m.user.id),
                profileId: profileByDiscordId.get(m.user.id)?.id,
                ankamaId: profileByDiscordId.get(m.user.id)?.ankamaId
            }));

        // Calculate Stats
        const stats: RoleStats[] = authorizedRoleIds.map((rId: string) => {
            const role = roleMap.get(rId);
            if (!role) return null;

            const discordInRole = reconciliation.filter(m => m.roles.includes(rId));
            const registeredInRole = discordInRole.filter(m => m.hasDashboardProfile);

            return {
                roleId: rId,
                roleName: role.name,
                roleColor: role.color,
                totalDiscord: discordInRole.length,
                totalDashboard: registeredInRole.length,
                unregistered: discordInRole.length - registeredInRole.length
            } as RoleStats;
        }).filter((s): s is RoleStats => s !== null);

        return {
            success: true,
            data: {
                members: reconciliation,
                stats: stats.sort((a, b) => b.totalDiscord - a.totalDiscord),
                authorizedRoles: authorizedRoleIds
            }
        };

    } catch (error) {
        console.error("[Member Actions] Reconciliation Error:", error);
        return { success: false, error: "Échec de la récupération des données" };
    }
}
