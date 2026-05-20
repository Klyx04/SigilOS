"use server";

import { fetchChannel, fetchGuildChannels } from "@/server/discord";
import { getUserContext } from "./user-actions";

export async function getDiscordChannelInfo(guildId: string, channelId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

    try {
        const channel = await fetchChannel(channelId);
        if (!channel) return { success: false, error: "Channel not found" };
        
        return { 
            success: true, 
            data: {
                id: channel.id,
                name: channel.name,
                type: channel.type
            } 
        };
    } catch (error) {
        console.error("[getDiscordChannelInfo]", error);
        return { success: false, error: "Failed to fetch channel info" };
    }
}

export async function getGuildChannelsAction(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

    try {
        const channels = await fetchGuildChannels(guildId);
        return { success: true, data: channels };
    } catch (error) {
        console.error("[getGuildChannelsAction]", error);
        return { success: false, error: "Failed to fetch guild channels" };
    }
}
