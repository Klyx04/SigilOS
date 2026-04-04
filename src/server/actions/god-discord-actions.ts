"use server";

import { isSuperAdmin } from "./super-admin-actions";
import { fetchChannel, fetchBotGuilds } from "@/server/discord";
import { db } from "@/lib/prisma";

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

        // 1. Verify Token & Identity
        const meRes = await fetch("https://discord.com/api/v10/users/@me", {
            headers: { Authorization: `Bot ${token}` }
        });

        if (!meRes.ok) {
            results.token = { status: "ERROR", message: `Invalid Token (API returned ${meRes.status})` };
            return { success: true, results };
        }

        const botData = await meRes.json();
        results.token = { status: "OK", message: "Token valid" };
        results.botIdentity = { id: botData.id, username: botData.username };

        // 2. Fetch Guilds
        try {
            results.guilds = await fetchBotGuilds();
        } catch (e: any) {
            results.guilds_error = e.message;
        }

        // 3. verify Configured Channels
        const config = await db.platformConfig.findUnique({ where: { id: "singleton" } });
        
        const checkChan = async (channelId: string | null) => {
            if (!channelId) return { status: "EMPTY", message: "Non configuré" };
            try {
                const chan = await fetchChannel(channelId);
                if (!chan) return { status: "MISSING", message: "Introuvable (404)" };
                return { status: "OK", message: `${chan.name} (#${chan.id})` };
            } catch (e: any) {
                return { status: "ERROR", message: e.message };
            }
        };

        results.channels.hub = await checkChan(config?.hubChannelId || null);
        results.channels.status = await checkChan(config?.serviceStatusChannelId || null);
        results.channels.alerts = await checkChan(config?.godNotifyChannelId || null);

        return { success: true, results };

    } catch (error: any) {
        console.error("[GodDiscordDiag] Critical Failure:", error);
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
        console.error("[GhostScan] Failure:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Force the bot to leave a specific guild
 */
export async function forceBotLeaveGuild(guildId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const token = process.env.DISCORD_BOT_TOKEN;
        const res = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}`, {
            method: "DELETE",
            headers: { Authorization: `Bot ${token}` }
        });

        if (res.status === 204) {
            return { success: true };
        } else {
            const err = await res.json().catch(() => ({}));
            return { success: false, error: err.message || `Discord API returned ${res.status}` };
        }
    } catch (error: any) {
        console.error("[ForceLeave] Failure:", error);
        return { success: false, error: error.message };
    }
}
