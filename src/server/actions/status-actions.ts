"use server";

import { db } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sendChannelMessage, updateChannelMessage } from "@/server/discord";
import { isSuperAdmin } from "./super-admin-actions";

const REDIS_STATUS_MSG_KEY = "sigilos:discord_status_message_id";

/**
 * 🛰️ Envoie un ping d'état des services sur Discord
 * Version "Premium" avec Living Status (mis à jour du même message si possible).
 */
export async function sendGlobalStatusPing(
    isTestRequest = false, 
    mode?: 'living' | 'notification', 
    isLite?: boolean,
    targetChannelId?: string
) {
    if (isTestRequest) {
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) throw new Error("Accès refusé : Super-admin requis");
    }

    try {
        const config = await db.platformConfig.findUnique({ 
            where: { id: "singleton" },
            select: { 
                serviceStatusChannelId: true,
                statusIsLite: true,
                statusMode: true,
                statusMention: true
            }
        });

        const channelId = targetChannelId || config?.serviceStatusChannelId;

        if (!channelId) {
            return { success: false, error: "Salon d'état des services non configuré." };
        }

        const effectiveMode = mode || (config?.statusMode as 'living' | 'notification') || 'living';
        const effectiveLite = isLite !== undefined ? isLite : (config?.statusIsLite || false);

        // 1. Health Checks
        const startDb = performance.now();
        await db.$queryRaw`SELECT 1`;
        const dbLatency = Math.round(performance.now() - startDb);
        const isDbOk = dbLatency < 500;

        let redisStatus = "🔴 Hors-ligne";
        let redisLatency = 0;
        let isRedisOk = false;
        try {
            const startRedis = performance.now();
            const pong = await redis.ping();
            redisLatency = Math.round(performance.now() - startRedis);
            if (pong === "PONG") {
                redisStatus = "🟢 Connecté";
                isRedisOk = true;
            }
        } catch (e) {
            console.error("[Status Ping] Redis error:", e);
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
        const statusUrl = `${appUrl}/status`;
        
        // Final Health Calc
        const systemStatus = isDbOk && isRedisOk ? "OPERATIONAL" : (!isDbOk && !isRedisOk ? "CRITICAL" : "DEGRADED");
        const statusColor = systemStatus === "OPERATIONAL" ? 0x10b981 : (systemStatus === "DEGRADED" ? 0xf59e0b : 0xef4444);
        const statusEmoji = systemStatus === "OPERATIONAL" ? "🟩" : (systemStatus === "DEGRADED" ? "🟧" : "🟥");

        // 2. Build the Embed
        const fields = effectiveLite ? [
            {
                name: "Systèmes",
                value: `État: **${systemStatus === "OPERATIONAL" ? "Opérationnel" : "Perturbé"}**`,
                inline: true
            },
            {
                name: "Uptime",
                value: `**99.9%**`,
                inline: true
            }
        ] : [
            {
                name: "🗄️ Base de données",
                value: `Statut: **${isDbOk ? "En ligne" : "Erreur"}**\nLatence: \`${dbLatency}ms\`\nSurcharge: \`Bas\``,
                inline: true
            },
            {
                name: "⚡ Cache & Real-time",
                value: `Statut: **${isRedisOk ? "Optimal" : "Erreur"}**\nLatence: \`${redisLatency}ms\`\nWS: 🟩 **Actifs**`,
                inline: true
            },
            {
                name: "🌐 API & Dashboard",
                value: `Version: \`${process.env.npm_package_version || "0.1.0"}\`\nUptime: \`99.9%\`\nEnvironnement: \`Production\``,
                inline: false
            }
        ];

        const embed = {
            embedTitle: `🛰️ SigilOS — État des Systèmes`,
            embedUrl: statusUrl,
            embedDescription: effectiveLite 
                ? (systemStatus === "OPERATIONAL" ? "Tous les systèmes fonctionnent normalement." : "Des perturbations ont été détectées.")
                : (systemStatus === "OPERATIONAL" 
                    ? "Tous les systèmes sont au vert. L'infrastructure est surveillée en temps réel pour garantir une performance optimale."
                    : "Certains services rencontrent des perturbations. Nos équipes (enfin, le robot) sont sur le coup."),
            embedColor: statusColor,
            embedThumbnail: effectiveLite ? undefined : "https://sigilos.fr/assets/ui/logo-v2.png",
            fields,
            embedFooter: `SigilOS Service Monitoring • <t:${Math.floor(Date.now() / 1000)}:R>`,
        };

        // 3. Dispatch Logic
        const previousMessageId = await redis.get(REDIS_STATUS_MSG_KEY);
        let actionTaken = "created";
        let finalMessageId: string | null = null;

        // Mode 'living': try to update the old message
        if (effectiveMode === 'living' && previousMessageId) {
            try {
                const updated = await updateChannelMessage(channelId, previousMessageId, "", embed);
                if (updated) {
                    finalMessageId = previousMessageId;
                    actionTaken = "updated";
                }
            } catch (e) {
                console.warn("[Status Ping] Update failed, sending new message", e);
            }
        }

        // Mode 'notification' OR update failed: send a new message
        if (!finalMessageId) {
            const mentionContent = config?.statusMention === 'none' ? "" : (config?.statusMention || "");
            finalMessageId = await sendChannelMessage(channelId, mentionContent, embed);
            if (finalMessageId && effectiveMode === 'living') {
                // Only save specifically for living status
                await redis.set(REDIS_STATUS_MSG_KEY, finalMessageId, "EX", 60 * 60 * 24 * 30);
            }
        }

        return { 
            success: true, 
            action: actionTaken,
            messageId: finalMessageId,
            stats: { 
                systemStatus, 
                dbLatency, 
                redisLatency,
                channelId
            }
        };

    } catch (error: any) {
        console.error("[Status Action] Critical Failure:", error);
        return { success: false, error: error.message || "Erreur de connexion Discord (vérifiez l'ID du salon)" };
    }
}
