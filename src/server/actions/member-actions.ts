"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { listGuildMembers, fetchGuildRoles, sendChannelMessage } from "@/server/discord";
import { getUserContext } from "./user-actions";
import { ActionResponse } from "./user-actions";
import { z } from "zod";
import { createAuditLog } from "./audit-actions";
import { redis } from "@/lib/redis";

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
    discordMessageCountWeekly?: number;
    discordVoiceTimeWeekly?: number;
    discordMessageCountMonthly?: number;
    discordVoiceTimeMonthly?: number;
    discordMessageCountTotal?: number;
    discordVoiceTimeTotal?: number;
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
                    discordMessageCountWeekly: true,
                    discordVoiceTimeWeekly: true,
                    discordMessageCountMonthly: true,
                    discordVoiceTimeMonthly: true,
                    discordMessageCountTotal: true,
                    discordVoiceTimeTotal: true,
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
        const profileByDiscordId = new Map<string, { id: string, ankamaId?: string | null, discordMessageCountWeekly: number, discordVoiceTimeWeekly: number, discordMessageCountMonthly: number, discordVoiceTimeMonthly: number, discordMessageCountTotal: number, discordVoiceTimeTotal: number }>();
        dbProfiles.forEach(p => {
            const discordId = p.user.accounts[0]?.providerAccountId;
            if (discordId) profileByDiscordId.set(discordId, { 
                id: p.id, 
                ankamaId: p.ankamaId,
                discordMessageCountWeekly: p.discordMessageCountWeekly || 0,
                discordVoiceTimeWeekly: p.discordVoiceTimeWeekly || 0,
                discordMessageCountMonthly: p.discordMessageCountMonthly || 0,
                discordVoiceTimeMonthly: p.discordVoiceTimeMonthly || 0,
                discordMessageCountTotal: p.discordMessageCountTotal || 0,
                discordVoiceTimeTotal: p.discordVoiceTimeTotal || 0
            });
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
                ankamaId: profileByDiscordId.get(m.user.id)?.ankamaId,
                discordMessageCountWeekly: profileByDiscordId.get(m.user.id)?.discordMessageCountWeekly || 0,
                discordVoiceTimeWeekly: profileByDiscordId.get(m.user.id)?.discordVoiceTimeWeekly || 0,
                discordMessageCountMonthly: profileByDiscordId.get(m.user.id)?.discordMessageCountMonthly || 0,
                discordVoiceTimeMonthly: profileByDiscordId.get(m.user.id)?.discordVoiceTimeMonthly || 0,
                discordMessageCountTotal: profileByDiscordId.get(m.user.id)?.discordMessageCountTotal || 0,
                discordVoiceTimeTotal: profileByDiscordId.get(m.user.id)?.discordVoiceTimeTotal || 0
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

const RosterReportSchema = z.object({
    guildId: z.string(),
    roleId: z.string(),
    channelId: z.string(),
    showMissingNames: z.boolean().default(true),
});

/**
 * Envoie un rapport d'audit d'inscription sur Discord.
 * Compare les membres Discord ayant un rôle spécifique avec les profils Dashboard actifs.
 */
export async function sendRosterAuditReport(rawData: z.infer<typeof RosterReportSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const validation = RosterReportSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, roleId, channelId, showMissingNames } = validation.data;

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) return { success: false, error: "Permission requise" };

    // --- RATE LIMITING (15 min per role) ---
    const rateLimitKey = `audit_report_ratelimit:${guildId}:${roleId}`;
    const lastSentStr = await redis.get(rateLimitKey);
    const lastSent = lastSentStr ? parseInt(lastSentStr, 10) : null;
    const nowTs = Date.now();
    const COOLDOWN = 15 * 60 * 1000; // 15 minutes

    if (lastSent && (nowTs - lastSent < COOLDOWN)) {
        const remainingMin = Math.ceil((COOLDOWN - (nowTs - lastSent)) / 60000);
        return { success: false, error: `Rapport déjà envoyé récemment. Réessayez dans ${remainingMin} min.` };
    }

    try {
        // 1. Récupérer les données de réconciliation
        const recon = await getMemberReconciliation(guildId);
        if (!recon.success || !recon.data) return { success: false, error: recon.error };

        const { members, stats } = recon.data;
        const roleStats = stats.find(s => s.roleId === roleId);

        if (!roleStats) return { success: false, error: "Statistiques introuvables pour ce rôle" };

        // 2. Identifier les manquants
        const missing = members
            .filter(m => m.roles.includes(roleId) && !m.hasDashboardProfile)
            .map(m => m.displayName || m.username);

        const totalInRole = roleStats.totalDiscord;
        const registered = roleStats.totalDashboard;
        const percent = totalInRole > 0 ? Math.round((registered / totalInRole) * 100) : 0;

        // Barre de progression visuelle (Format Premium)
        const filled = "🟩".repeat(Math.round(percent / 10));
        const empty = "⬜".repeat(10 - Math.round(percent / 10));

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
        const dashboardUrl = `${appUrl}/dashboard/${guildId}`;

        // 3. Construction des champs visuels (colonnes)
        const fields: any[] = [];
        
        if (missing.length > 0) {
            if (missing.length <= 45) {
                // Construction en 3 colonnes pour une meilleure lisibilité
                const columnSize = Math.ceil(missing.length / 3);
                const col1 = missing.slice(0, columnSize).join("\n") || "-";
                const col2 = missing.slice(columnSize, columnSize * 2).join("\n") || "-";
                const col3 = missing.slice(columnSize * 2).join("\n") || "-";

                fields.push(
                    { name: "👥 Absence (1/3)", value: `\`\`\`\n${col1}\n\`\`\``, inline: true },
                    { name: "👥 Absence (2/3)", value: `\`\`\`\n${col2}\n\`\`\``, inline: true },
                    { name: "👥 Absence (3/3)", value: `\`\`\`\n${col3}\n\`\`\``, inline: true }
                );
            } else {
                // Trop de monde : On liste les 21 premiers et on met un résumé
                const preview = missing.slice(0, 21);
                const col1 = preview.slice(0, 7).join("\n");
                const col2 = preview.slice(7, 14).join("\n");
                const col3 = preview.slice(14, 21).join("\n");

                fields.push(
                    { name: "⚠️ Top Absences", value: `\`\`\`\n${col1}\n\`\`\``, inline: true },
                    { name: "---", value: `\`\`\`\n${col2}\n\`\`\``, inline: true },
                    { name: "---", value: `\`\`\`\n${col3}\n\`\`\``, inline: true }
                );
                
                fields.push({ 
                    name: "📌 Note", 
                    value: `*Et **${missing.length - 21} autres membres** ne sont pas encore inscrits sur le Dashboard.*`,
                    inline: false 
                });
            }
        }

        const description = [
            `📈 **Progression des inscriptions : ${percent}%**`,
            `${filled}${empty}`,
            "",
            `✅ **Validés** : ${registered} membres`,
            `⚠️ **En attente** : ${roleStats.unregistered} membres`,
            `👥 **Total Discord** : ${totalInRole} membres`,
            "",
            "*Consultez la liste complète et gérez les relances sur le Dashboard SigilOS via le bouton ci-dessous.*"
        ].join("\n");

        await sendChannelMessage(channelId, "", {
            embedTitle: `Rapport d'Audit — ${roleStats.roleName}`,
            embedDescription: description,
            embedColor: roleStats.roleColor || 0x5865F2,
            embedFooter: `SigilOS Audit • Rapport déclenché par ${ctx.name}`,
            fields,
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 5,
                            label: "Accéder au Dashboard",
                            url: dashboardUrl,
                            emoji: { name: "🔗" }
                        }
                    ]
                }
            ]
        });

        // Appliquer le rate limit
        await redis.set(rateLimitKey, nowTs.toString(), "EX", 900); // Expirer après 15 min

        // 4. Audit Log
        const { createAuditLog } = await import("./audit-actions");
        await createAuditLog({
            guildId,
            actorUserId: session.user.id,
            actorName: ctx.name || "Admin",
            action: "ADMIN_ROSTER_AUDIT_SENT",
            targetType: "GUILD",
            targetId: guildId,
            metadata: { 
                roleId, 
                roleName: roleStats.roleName, 
                channelId,
                total: totalInRole,
                registered
            }
        });

        return { success: true };
    } catch (error) {
        console.error("[sendRosterAuditReport] Error:", error);
        return { success: false, error: "Erreur lors de l'envoi du rapport" };
    }
}
/**
 * Manual trigger from Dashboard
 * Automatically finds the system notification channel
 */
export async function sendManualRosterReport(guildId: string, roleId: string): Promise<ActionResponse> {
    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { systemNotifyChannelId: true }
        });

        if (!guild?.systemNotifyChannelId) {
            return { success: false, error: "Aucun salon de notifications système configuré dans Paramètres > Salons." };
        }

        return await sendRosterAuditReport({ 
            guildId, 
            roleId, 
            channelId: guild.systemNotifyChannelId,
            showMissingNames: true 
        });
    } catch (error) {
        console.error("[sendManualRosterReport] Error:", error);
        return { success: false, error: "Échec du déclenchement manuel" };
    }
}
