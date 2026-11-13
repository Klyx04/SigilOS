"use server";

import { fetchChannel, fetchGuildChannels, fetchGuildRoles } from "@/server/discord";
import { getUserContext } from "./user-actions";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { canUserViewChannel } from "@/lib/discord-channel-permissions";

export async function getDiscordChannelInfo(guildId: string, channelId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

    // F-PREVIEW-002 : rate-limit fail-closed avant l'appel réseau.
    // Note : UserContext.id est optionnel (id?: string) → fallback "anon" pour
    // éviter une clé de ratelimit à "undefined" quand l'utilisateur n'a pas de profil.
    const allowed = await rateLimit(`discord-channel:${guildId}:${ctx.id || "anon"}`, 20, 60_000);
    if (!allowed.success) return { success: false, error: "Trop de requêtes, réessaie dans quelques secondes" };

    try {
        const channel = await fetchChannel(channelId);
        if (!channel) return { success: false, error: "Channel not found" };

        // F-PREVIEW-001 : rejeter un salon d'une autre guilde (guild isolation multi-tenant)
        if (channel.guild_id && channel.guild_id !== guildId) {
            return { success: false, error: "Channel not in this guild" };
        }

        return {
            success: true,
            data: {
                id: channel.id,
                name: channel.name,
                type: channel.type
            }
        };
    } catch (error) {
        logger.error("[getDiscordChannelInfo]", { error: (error as Error).message, guildId, channelId });
        return { success: false, error: "Failed to fetch channel info" };
    }
}

export async function getGuildChannelsAction(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

    // F-PREVIEW-002 : rate-limit fail-closed avant l'appel réseau.
    const allowed = await rateLimit(`guild-channels:${guildId}:${ctx.id || "anon"}`, 10, 60_000);
    if (!allowed.success) return { success: false, error: "Trop de requêtes, réessaie dans quelques secondes" };

    try {
        const channels = await fetchGuildChannels(guildId);

        // 🔒 Sécurité & Confidentialité : un utilisateur ne doit voir dans le sélecteur
        // QUE les salons auxquels son compte Discord a réellement accès (VIEW_CHANNEL).
        // Seuls les administrateurs Discord ou SuperAdmins voient tous les salons.
        if (ctx.isDiscordAdmin || ctx.isSuperAdmin) {
            return {
                success: true,
                data: channels.map(c => ({ id: c.id, name: c.name, type: c.type }))
            };
        }

        const roles = await fetchGuildRoles(guildId, { excludeManaged: false });
        const channelsById = new Map(channels.map(c => [c.id, c]));

        const visibleChannels = channels.filter(channel => {
            const parent = channel.parent_id ? channelsById.get(channel.parent_id) : null;
            return canUserViewChannel({
                guildId,
                channel,
                userRoleIds: ctx.roles || [],
                userId: ctx.id,
                guildRoles: roles,
                parentChannel: parent,
            });
        });

        return {
            success: true,
            data: visibleChannels.map(c => ({ id: c.id, name: c.name, type: c.type }))
        };
    } catch (error) {
        logger.error("[getGuildChannelsAction]", { error: (error as Error).message, guildId });
        return { success: false, error: "Failed to fetch guild channels" };
    }
}