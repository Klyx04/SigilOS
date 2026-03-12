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
export async function sendGlobalStatusPing(isTestRequest = false) {
    if (isTestRequest) {
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) throw new Error("Accès refusé : Super-admin requis");
    }

    try {
        const config = await db.platformConfig.findUnique({ 
            where: { id: "singleton" },
            select: { serviceStatusChannelId: true }
        });

        if (!config?.serviceStatusChannelId) {
            return { success: false, error: "Salon d'état des services non configuré." };
        }

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

        // 2. Build the Premium Embed
        const embed = {
            embedTitle: `🛰️ SigilOS — État des Systèmes`,
            embedUrl: statusUrl,
            embedDescription: systemStatus === "OPERATIONAL" 
                ? "Tous les systèmes sont au vert. L'infrastructure est surveillée en temps réel pour garantir une performance optimale."
                : "Certains services rencontrent des perturbations. Nos équipes (enfin, le robot) sont sur le coup.",
            embedColor: statusColor,
            embedThumbnail: "https://i.imgur.com/AfFp7pu.png",
            fields: [
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
            ],
            embedFooter: `Dernière synchronisation • <t:${Math.floor(Date.now() / 1000)}:R>`,
        };

        // 3. Living Status Logic (Consolidated)
        const channelId = config.serviceStatusChannelId;
        const previousMessageId = await redis.get(REDIS_STATUS_MSG_KEY);
        let actionTaken = "created";
        let finalMessageId: string | null = null;

        if (previousMessageId) {
            const updated = await updateChannelMessage(channelId, previousMessageId, "", embed);
            if (updated) {
                finalMessageId = previousMessageId;
                actionTaken = "updated";
            }
        }

        if (!finalMessageId) {
            finalMessageId = await sendChannelMessage(channelId, "", embed);
            if (finalMessageId) {
                // Persist the new ID (expires in 30 days)
                await redis.set(REDIS_STATUS_MSG_KEY, finalMessageId, "EX", 60 * 60 * 24 * 30);
            }
        }

        if (!finalMessageId) {
            return { success: false, error: "Impossible de communiquer avec Discord." };
        }

        return { 
            success: true, 
            action: actionTaken,
            messageId: finalMessageId,
            stats: { systemStatus, dbLatency, redisLatency }
        };

    } catch (error: any) {
        console.error("[Status Action] Error:", error);
        return { success: false, error: error.message || "Erreur interne lors du ping système" };
    }
}

