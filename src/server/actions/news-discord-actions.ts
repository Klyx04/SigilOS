"use server";
import { logger } from "@/lib/logger";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { isSuperAdmin } from "./super-admin-actions";
import { getUserContext } from "./user-actions";
import { sendChannelMessage } from "@/server/discord";
import { revalidatePath } from "next/cache";
import { getAppBaseUrl } from "@/lib/utils";

export type DiscordNewsItem = {
    title: string;
    url: string;
    imageUrl?: string;
    description?: string;
    pubDate: string;
    category: string;
};

/**
 * Common Embed formatter for Dofus News/Changelogs
 */
function createNewsEmbed(item: DiscordNewsItem) {
    const isChangelog = item.category === "Changelog" || item.title.toLowerCase().includes("patch notes");
    
    return {
        embedTitle: item.title,
        embedUrl: item.url,
        embedColor: isChangelog ? 0x10b981 : 0x3b82f6, // Emerald for changelog, Blue for news
        embedDescription: item.description || "Consulter le détail de la mise à jour sur le site officiel de Dofus.",
        embedThumbnail: `${getAppBaseUrl()}/assets/ui/logo-v2.png`, // SigilOS Logo
        embedImage: item.imageUrl,
        embedFooter: `SigilOS · Actualités Dofus · ${new Date(item.pubDate).toLocaleDateString('fr-FR')}`,
        embedAuthor: {
            name: isChangelog ? "Dofus — Patch Notes" : "Dofus — Actualités",
            iconUrl: "https://static.ankama.com/ankama/cms/images/282/2026/01/21/1765851.jpg"
        }
    };
}

/**
 * Send a news item to a specific guild's system channel
 */
export async function sendNewsToDiscord(guildId: string, item: DiscordNewsItem) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    // Use the central security guard to check permissions
    const ctx = await getUserContext(guildId);

    if (!ctx.isMember) return { success: false, error: "Non membre de cette guilde" };
    if (!ctx.isAdmin && !ctx.isSuperAdmin) return { success: false, error: "Permissions insuffisantes (Admin requis)" };

    const config = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { systemNotifyChannelId: true, isActive: true }
    });

    if (!config || !config.isActive) return { success: false, error: "Configuration de guilde introuvable ou inactive" };

    const targetChannelId = config.systemNotifyChannelId;
    if (!targetChannelId) return { success: false, error: "Aucun salon de notifications système configuré" };

    try {
        const messageId = await sendChannelMessage(
            targetChannelId,
            "",
            createNewsEmbed(item)
        );

        if (!messageId) throw new Error("Erreur Discord API");

        return { success: true, messageId };
    } catch (error) {
        logger.error("[News Discord] Error sending to guild:", error);
        return { success: false, error: "Échec de l'envoi sur Discord" };
    }
}

/**
 * SuperAdmin Only: Broadcast a news item to ALL active guilds
 */
export async function broadcastNewsToAllGuilds(item: DiscordNewsItem) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    const guilds = await db.guildConfig.findMany({
        where: { isActive: true, systemNotifyChannelId: { not: null } },
        select: { discordGuildId: true, systemNotifyChannelId: true, name: true }
    });

    const results = {
        total: guilds.length,
        success: 0,
        failed: 0,
        errors: [] as string[]
    };

    const embed = createNewsEmbed(item);

    // Batch sending (serial to avoid brutal rate limits, though sendChannelMessage has retry logic)
    for (const guild of guilds) {
        try {
            const mid = await sendChannelMessage(guild.systemNotifyChannelId!, "", embed);
            if (mid) results.success++;
            else throw new Error(`API null response for ${guild.name}`);
        } catch (e) {
            results.failed++;
            results.errors.push(`${guild.name}: ${(e as Error).message}`);
        }
    }

    return { success: true, results };
}
/**
 * Get the name of the system notification channel for news broadcasts
 */
export async function getNewsTargetChannelName(guildId: string): Promise<{ success: boolean; channelName?: string }> {
    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { systemNotifyChannelId: true }
        });
        if (!config?.systemNotifyChannelId) return { success: false };

        const { getDiscordChannelInfo } = await import("@/server/actions/discord-actions");
        const chanRes = await getDiscordChannelInfo(guildId, config.systemNotifyChannelId);
        if (chanRes.success && chanRes.data) {
            return { success: true, channelName: chanRes.data.name };
        }
        return { success: false };
    } catch {
        return { success: false };
    }
}
