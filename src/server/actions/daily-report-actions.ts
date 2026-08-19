"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { auth } from "@/auth";
import { sendChannelMessage } from "@/server/discord";
import { isSuperAdmin } from "./super-admin-actions";

/**
 * 📊 Envoie un rapport quotidien détaillé sur Discord.
 * Contrairement au Status Ping qui met à jour un message existant,
 * celui-ci envoie un NOUVEAU message pour générer une notification.
 *
 * 🔧 FIX (session 3, chantier #77) : cette action ne dépend plus de la session
 * (`getPlatformStats`/`getMemberReconciliation` exigeaient un scope God basé sur
 * `auth()` → le worker BullMQ (aucune session) échouait avec « Unauthorized:
 * God scope required » → le rapport n'arrivait JAMAIS, sans log d'erreur).
 * Les statistiques sont désormais calculées en requêtes directes scopées guilde.
 *
 * 🔒 FIX (chantier #147) : deux planificateurs coexistent (route `/api/cron/daily-summary`
 * + job BullMQ `daily-summary` dans `metamob-worker.ts`) → le rapport partait en DOUBLE.
 * Déduplication Redis quotidienne par guilde sur les envois AUTOMATIQUES uniquement
 * (le bouton manuel "Envoyer maintenant" envoie toujours).
 */
export async function sendDailySummaryReport(guildId: string, isManual = false) {
    if (isManual) {
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) throw new Error("Accès refusé");
    } else {
        // 🔒 SÉCURITÉ (IDOR) : le chemin AUTO est légitime pour le worker BullMQ (SANS session)
        // et la route cron (protégée par secret). Un utilisateur connecté NON-God ne doit pas
        // pouvoir déclencher l'envoi du rapport d'une guilde quelconque.
        const session = await auth();
        if (session?.user?.id) {
            const isAdmin = await isSuperAdmin();
            if (!isAdmin) throw new Error("Accès refusé");
        }

        // #147 : une seule émission automatique par jour et par guilde (anti-doublon).
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
        const key = `daily-report:${guildId}:${today}`;
        try {
            const claimed = await redis.set(key, "1", "EX", 86_400, "NX");
            if (claimed !== "OK") {
                logger.info(`[Daily Report] Déjà envoyé aujourd'hui pour ${guildId} (${today}) — skip anti-doublon.`);
                return { success: true, messageId: null, skipped: true };
            }
        } catch (e) {
            // Redis indisponible → on laisse passer (degraded, pas de blocage).
            logger.warn("[Daily Report] Redis indisponible, pas de déduplication:", e);
        }
    }

    try {
        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [config, weeklyActiveUsers] = await Promise.all([
            db.guildConfig.findUnique({
                where: { discordGuildId: guildId },
                select: {
                    name: true,
                    systemNotifyChannelId: true,
                    _count: { select: { profiles: true } }
                }
            }),
            db.userProfile.count({
                where: {
                    guild: { discordGuildId: guildId },
                    status: "ACTIVE",
                    lastSeen: { gte: lastWeek },
                }
            })
        ]);

        if (!config?.systemNotifyChannelId) {
            return { success: false, error: "Canal de notification système non configuré pour cette guilde." };
        }

        const { getAppBaseUrl } = await import("@/lib/utils");
        const dashboardUrl = `${getAppBaseUrl()}/dashboard/${guildId}/admin/members`;

        const embed = {
            embedTitle: `📋 Rapport de guilde — ${config.name}`,
            embedUrl: dashboardUrl,
            embedDescription: `Résumé de l'activité de la guilde sur les dernières 24 heures.\n[Gérer les membres et l'audit ➡️](${dashboardUrl})`,
            embedColor: 0x10b981, // Emerald
            embedThumbnail: "https://sigilos.fr/assets/ui/logo-v2.png",
            fields: [
                {
                    name: "👥 Membres",
                    value: `Inscrits sur SigilOS: **${config._count.profiles}**`,
                    inline: true
                },
                {
                    name: "⚙️ Services",
                    value: "Tous les services sont opérationnels.",
                    inline: true
                },
                {
                    name: "📈 Activité (7 jours)",
                    value: `Membres actifs: **${weeklyActiveUsers}**`,
                    inline: false
                }
            ],
            embedFooter: `SigilOS • Rapport du ${new Date().toLocaleDateString('fr-FR')}`,
        };

        const messageId = await sendChannelMessage(config.systemNotifyChannelId, "", embed);

        if (!messageId) {
            return { success: false, error: "Échec de l'envoi sur Discord." };
        }

        return { success: true, messageId };

    } catch (error: any) {
        logger.error("[Daily Report] Error:", error);
        return { success: false, error: error.message || "Erreur lors de la génération du rapport" };
    }
}
