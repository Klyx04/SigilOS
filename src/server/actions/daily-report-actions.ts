"use server";

import { db } from "@/lib/prisma";
import { sendChannelMessage } from "@/server/discord";
import { isSuperAdmin } from "./super-admin-actions";
import { getMemberReconciliation } from "./member-actions";
import { getPlatformStats } from "./super-admin-actions";

/**
 * 📊 Envoie un rapport quotidien détaillé sur Discord.
 * Contrairement au Status Ping qui met à jour un message existant, 
 * celui-ci envoie un NOUVEAU message pour générer une notification.
 */
export async function sendDailySummaryReport(guildId: string, isManual = false) {
    if (isManual) {
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) throw new Error("Accès refusé");
    }

    try {
        // En 2026, on veut du visuel et de la data utile.
        const [config, stats, reconciliation] = await Promise.all([
            db.guildConfig.findUnique({
                where: { discordGuildId: guildId },
                select: { 
                    name: true, 
                    systemNotifyChannelId: true,
                    _count: { select: { profiles: true } }
                }
            }),
            getPlatformStats(),
            getMemberReconciliation(guildId)
        ]);

        if (!config?.systemNotifyChannelId) {
            return { success: false, error: "Canal de notification système non configuré pour cette guilde." };
        }

        const unregisteredCount = reconciliation.success 
            ? reconciliation.data!.members.filter(m => !m.hasDashboardProfile).length 
            : 0;

        const { getAppBaseUrl } = await import("@/lib/utils");
        const dashboardUrl = `${getAppBaseUrl()}/dashboard/${guildId}/admin/members`;

        const embed = {
            embedTitle: `📅 Rapport Quotidien — ${config.name}`,
            embedUrl: dashboardUrl,
            embedDescription: `Voici le résumé de l'activité du serveur pour ces dernières 24 heures.\n[Gérer les Membres et l'Audit ➡️](${dashboardUrl})`,
            embedColor: 0x9333ea, // Purple
            embedThumbnail: "https://sigilos.fr/assets/ui/logo-v2.png",
            fields: [
                {
                    name: "👥 AUDIT MEMBRES",
                    value: `Inscrits: **${config._count.profiles}**\nNon-identifiés: **${unregisteredCount}** ⚠️`,
                    inline: true
                },
                {
                    name: "🛰️ INFRASTRUCTURE",
                    value: `Systèmes: **OPÉRATIONNELS**\nUptime: \`${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m\``,
                    inline: true
                },
                {
                    name: "📈 ACTIVITÉ GLOBALE",
                    value: `Utilisateurs actifs: **${stats.weeklyActiveUsers}** (semaine)\nMissions en cours: **${stats.totalMissions}**`,
                    inline: false
                }
            ],
            embedFooter: `SigilOS Intelligence Artificielle • Rapport du ${new Date().toLocaleDateString('fr-FR')}`,
        };

        const messageId = await sendChannelMessage(config.systemNotifyChannelId, "", embed);

        if (!messageId) {
            return { success: false, error: "Échec de l'envoi sur Discord." };
        }

        return { success: true, messageId };

    } catch (error: any) {
        console.error("[Daily Report] Error:", error);
        return { success: false, error: error.message || "Erreur lors de la génération du rapport" };
    }
}
