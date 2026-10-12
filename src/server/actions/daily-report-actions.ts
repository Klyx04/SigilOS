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
        const now = new Date();
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                id: true,
                name: true,
                systemNotifyChannelId: true,
            }
        });

        if (!config?.systemNotifyChannelId) {
            return { success: false, error: "Canal de notification système non configuré pour cette guilde." };
        }

        // 1. Nouveaux membres validés dans les dernières 24h
        const newMembers = await db.userProfile.findMany({
            where: {
                guildId: config.id,
                status: "ACTIVE",
                createdAt: { gte: yesterday }
            },
            select: { pseudoDofus: true, discordNickname: true }
        });

        // 2. Départs / Archivages récents dans les dernières 24h
        const archivedMembers = await db.userProfile.findMany({
            where: {
                guildId: config.id,
                status: "ARCHIVED",
                updatedAt: { gte: yesterday }
            },
            select: { pseudoDofus: true, discordNickname: true }
        });

        // 3. Absences déclarées pour la semaine ou en cours
        const currentAbsences = await db.userProfile.findMany({
            where: {
                guildId: config.id,
                status: "ACTIVE",
                vacationEnd: { gte: now }
            },
            select: { pseudoDofus: true, discordNickname: true, vacationEnd: true }
        });

        // 4. Tickets de support ouverts
        const openTicketsCount = await (db as any).ticket?.count?.({
            where: {
                guildId: config.id,
                status: "OPEN"
            }
        }).catch(() => 0) || 0;

        // 5. Missions / Validations en attente
        const pendingProofsCount = await (db as any).proof?.count?.({
            where: {
                mission: { guildId: config.id },
                status: "PENDING"
            }
        }).catch(() => 0) || 0;

        // RÈGLE « DATA OR NOTHING » : Si aucun événement à signaler, on ne poste rien
        const hasData = newMembers.length > 0 || 
                        archivedMembers.length > 0 || 
                        currentAbsences.length > 0 || 
                        openTicketsCount > 0 || 
                        pendingProofsCount > 0;

        if (!hasData) {
            logger.info(`[Daily Report] Aucun événement staff pour la guilde ${config.name} (${guildId}) — message sauté.`);
            return { success: true, messageId: null, skipped: true };
        }

        const { getAppBaseUrl } = await import("@/lib/utils");
        const dashboardUrl = `${getAppBaseUrl()}/dashboard/${guildId}`;

        const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

        // Roster section
        if (newMembers.length > 0 || archivedMembers.length > 0) {
            const lines: string[] = [];
            if (newMembers.length > 0) {
                const names = newMembers.map(m => `\`${m.pseudoDofus || m.discordNickname}\``).join(", ");
                lines.push(`✅ **${newMembers.length} arrivée(s)** : ${names}`);
            }
            if (archivedMembers.length > 0) {
                const names = archivedMembers.map(m => `\`${m.pseudoDofus || m.discordNickname}\``).join(", ");
                lines.push(`🚪 **${archivedMembers.length} départ(s) / archivage(s)** : ${names}`);
            }
            fields.push({
                name: "👥 Mouvements du Roster",
                value: lines.join("\n"),
                inline: false
            });
        }

        // Absences
        if (currentAbsences.length > 0) {
            const list = currentAbsences.slice(0, 5).map(m => {
                const endStr = m.vacationEnd ? ` (jusqu'au ${m.vacationEnd.toLocaleDateString("fr-FR")})` : "";
                return `• \`${m.pseudoDofus || m.discordNickname}\`${endStr}`;
            }).join("\n");
            fields.push({
                name: `🏖️ Absences en cours (${currentAbsences.length})`,
                value: list,
                inline: false
            });
        }

        // Modération & Vigilance
        if (openTicketsCount > 0 || pendingProofsCount > 0) {
            const lines: string[] = [];
            if (openTicketsCount > 0) {
                lines.push(`🚨 **${openTicketsCount}** ticket(s) support ouvert(s)`);
            }
            if (pendingProofsCount > 0) {
                lines.push(`⏳ **${pendingProofsCount}** preuve(s) de mission à valider`);
            }
            fields.push({
                name: "⚠️ Vigilance & Modération",
                value: lines.join("\n"),
                inline: false
            });
        }

        const embed = {
            embedTitle: `🛡️ Rapport Staff — ${config.name}`,
            embedUrl: dashboardUrl,
            embedDescription: `Événements récents nécessitant l'attention du staff.\n[Accéder au Dashboard Staff ➡️](${dashboardUrl})`,
            embedColor: 0x3b82f6, // Info blue
            embedThumbnail: "https://sigilos.fr/assets/ui/logo-v2.png",
            fields,
            embedFooter: `SigilOS • Rapport Staff du ${new Date().toLocaleDateString('fr-FR')}`,
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
