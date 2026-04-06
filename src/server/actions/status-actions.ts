"use server";

import { db } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sendChannelMessage, updateChannelMessage } from "@/server/discord";
import { isSuperAdmin } from "./super-admin-actions";

const REDIS_STATUS_MSG_KEY = process.env.NODE_ENV === "production" ? "sigilos:discord_status_message_id_prod" : "sigilos:discord_status_message_id_beta";

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

        let isRedisOk = false;
        let redisLatency = 0;
        try {
            const startRedis = performance.now();
            const pong = await redis.ping();
            redisLatency = Math.round(performance.now() - startRedis);
            isRedisOk = pong === "PONG";
        } catch (e) {
            console.error("[Status Ping] Redis error:", e);
        }

        // 2. Dynamic Info
        const isBeta = process.env.NEXT_PUBLIC_APP_URL?.includes("beta") || process.env.NODE_ENV !== "production";
        const envName = isBeta ? "Beta / Test" : "Production";
        
        // Calculate Uptime
        const uptimeSeconds = process.uptime();
        const uptimeDays = Math.floor(uptimeSeconds / (24 * 3600));
        const uptimeHours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
        const uptimeFormatted = uptimeDays > 0 ? `${uptimeDays}j ${uptimeHours}h` : `${uptimeHours}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`;

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
        const statusUrl = `${appUrl}/status`;
        
        // Final Health Calc
        const systemStatus = isDbOk && isRedisOk ? "OPERATIONAL" : (!isDbOk && !isRedisOk ? "CRITICAL" : "DEGRADED");
        const statusColor = systemStatus === "OPERATIONAL" ? 0x10b981 : (systemStatus === "DEGRADED" ? 0xf59e0b : 0xef4444);

        // 3. Build the Embed (Standard Pro)
        const fields = effectiveLite ? [
            {
                name: "Système",
                value: systemStatus === "OPERATIONAL" ? "✅ Opérationnel" : "⚠️ Perturbé",
                inline: true
            },
            {
                name: "Environnement",
                value: `\`${envName}\``,
                inline: true
            }
        ] : [
            {
                name: "📡 État des Services",
                value: systemStatus === "OPERATIONAL" ? "✅ Tous les systèmes sont opérationnels." : "⚠️ Certains services rencontrent des difficultés.",
                inline: false
            },
            {
                name: "🌍 Environnement",
                value: `\`${envName}\``,
                inline: true
            },
            {
                name: "📦 Version",
                value: `\`v${process.env.npm_package_version || "0.1.0"}\``,
                inline: true
            }
        ];

        const embed = {
            embedTitle: `🛰️ SigilOS — État des Systèmes`,
            embedUrl: statusUrl,
            embedDescription: !effectiveLite && systemStatus !== "OPERATIONAL" 
                ? "Nos équipes (enfin, le robot de maintenance) analysent actuellement l'incident."
                : undefined,
            embedColor: statusColor,
            embedThumbnail: effectiveLite ? undefined : "https://sigilos.fr/assets/ui/logo-v2.png",
            fields,
            embedFooter: `SigilOS Status • Mise à jour auto`,
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
