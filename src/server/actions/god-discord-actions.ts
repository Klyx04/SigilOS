"use server";
import { logger } from "@/lib/logger";

import { isSuperAdmin } from "./super-admin-actions";
import { fetchChannel, fetchBotGuilds, fetchBotIdentity, leaveGuild } from "@/server/discord";
import { db } from "@/lib/prisma";

/**
 * Bornage (perf #21) : un appel Discord ne doit jamais bloquer le diagnostic
 * « Scan Accès » plus de quelques secondes.
 */
function withTimeout<T>(promise: Promise<T>, ms = 10_000): Promise<T> {
    promise.catch(() => {}); // évite unhandled rejection si le timeout gagne la course
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout (${ms}ms)`)), ms)),
    ]);
}

/**
 * Diagnostic tool for Discord Bot connectivity in God Dashboard
 */
export async function diagnoseDiscordConnectivity() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    const results: any = {
        token: { status: "CHECKING", message: "" },
        botIdentity: null,
        guilds: [],
        channels: {
            hub: { status: "N/A", message: "" },
            status: { status: "N/A", message: "" },
            alerts: { status: "N/A", message: "" },
        }
    };

    try {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
            results.token = { status: "ERROR", message: "DISCORD_BOT_TOKEN is missing from .env" };
            return { success: true, results };
        }

        // 1. Verify Token & Identity (borné 8s) — via la couche centrale (fetchBotIdentity).
        try {
            const botData = await withTimeout(fetchBotIdentity(), 8_000);
            results.token = { status: "OK", message: "Token valid" };
            results.botIdentity = { id: botData.id, username: botData.username };
        } catch (e: any) {
            results.token = { status: "ERROR", message: `Invalid Token (${e.message})` };
            return { success: true, results };
        }

        // 2. Fetch Guilds (borné 10s)
        try {
            results.guilds = await withTimeout(fetchBotGuilds(), 10_000);
        } catch (e: any) {
            results.guilds_error = e.message;
        }

        // 3. verify Configured Channels
        const config = await db.platformConfig.findUnique({ where: { id: "singleton" } });
        
        const checkChan = async (channelId: string | null) => {
            if (!channelId) return { status: "EMPTY", message: "Non configuré" };
            try {
                const chan = await withTimeout(fetchChannel(channelId), 8_000);
                if (!chan) return { status: "MISSING", message: "Introuvable (404)" };
                return { status: "OK", message: `${chan.name} (#${chan.id})` };
            } catch (e: any) {
                return { status: "ERROR", message: e.message };
            }
        };

        results.channels.hub = await checkChan(config?.hubChannelId || null);
        results.channels.status = await checkChan(config?.serviceStatusChannelId || null);
        results.channels.alerts = await checkChan(config?.godNotifyChannelId || null);

        // 4. Send a Discord Alert if requested/configured
        const targetAlertChannel = config?.godNotifyChannelId;
        if (targetAlertChannel) {
            const { sendChannelMessage } = await import("@/server/discord");
            await sendChannelMessage(targetAlertChannel, "", {
                embedTitle: "🔍 Diagnostic Connectivité SigilOS",
                embedDescription: `Audit terminé pour **${results.botIdentity?.username || "Bot Inconnu"}**.\n\n` +
                    `✅ **Token** : Valide\n` +
                    `📊 **Serveurs** : ${results.guilds.length}\n` +
                    `🔗 **Hub** : ${results.channels.hub.status}\n` +
                    `📡 **Status** : ${results.channels.status.status}\n` +
                    `🚨 **Alertes** : ${results.channels.alerts.status}`,
                embedColor: 0x6366f1,
                embedFooter: "SigilOS God Diagnostics • Rapport Automatique"
            }).catch(() => null);
        }

        return { success: true, results };

    } catch (error: any) {
        logger.error("[GodDiscordDiag] Critical Failure:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Scan for guilds where the bot is present but not on the allowlist
 */
export async function scanGhostGuilds() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const botGuilds = await fetchBotGuilds();
        const allowedGuilds = await db.allowedGuild.findMany({
            where: { isActive: true },
            select: { discordGuildId: true }
        });

        const allowedSet = new Set(allowedGuilds.map(g => g.discordGuildId));
        const ghosts = botGuilds.filter((g: any) => !allowedSet.has(g.id));

        return { success: true, ghosts };
    } catch (error: any) {
        logger.error("[GhostScan] Failure:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Force the bot to leave a specific guild
 */
export async function forceBotLeaveGuild(guildId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    // #223 — centralisé : leaveGuild via la couche anti-corruption (discordFetch).
    return leaveGuild(guildId);
}
