"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserContext, ActionResponse } from "./user-actions";
import { z } from "zod";
import { createAuditLog } from "./audit-actions";
import { 
    sendChannelMessage, 
    updateChannelMessage, 
    deleteChannelMessage 
} from "@/server/discord";
import { revalidatePath } from "next/cache";

const BlacklistSchema = z.object({
    guildId: z.string(),
    content: z.string().min(1, "Le contenu ne peut pas être vide").refine(val => {
        const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
        return !urlRegex.test(val);
    }, "Les liens internet ne sont pas autorisés (Sécurité SigilOS)"),
});

export async function getBlacklistConfig(guildId: string): Promise<ActionResponse<{ blacklistChannelId: string | null }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin) return { success: false, error: "Accès refusé" };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { blacklistChannelId: true }
        });

        if (!config) return { success: false, error: "Configuration introuvable" };

        return { success: true, data: { blacklistChannelId: config.blacklistChannelId } };
    } catch (error) {
        console.error("[Blacklist Actions] Get Config Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Guild Configuration for Blacklist
 */
export async function updateBlacklistSettings(guildId: string, channelId: string | null): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin) return { success: false, error: "Permission Administrateur requise" };

    try {
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { blacklistChannelId: channelId }
        });

        await createAuditLog({
            guildId: guildId,
            actorUserId: session.user.id,
            actorName: ctx.name || "Admin",
            action: "CONFIG_UPDATED",
            targetType: "GUILD",
            targetId: guildId,
            newValue: { blacklistChannelId: channelId }
        });

        return { success: true };
    } catch (error) {
        console.error("[Blacklist Actions] Settings Update Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

/**
 * DASHBOARD -> DISCORD SYNC
 */
export async function addBlacklistEntry(rawData: z.infer<typeof BlacklistSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const validation = BlacklistSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: validation.error.errors[0].message };
    const { guildId, content } = validation.data;

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, blacklistChannelId: true }
        });

        if (!guild) return { success: false, error: "Guilde introuvable" };

        let discordMessageId: string | null = null;
        if (guild.blacklistChannelId) {
            try {
                discordMessageId = await sendChannelMessage(guild.blacklistChannelId, content, {
                    embedTitle: "🛡️ Signalement Blacklist",
                    embedColor: 0xef4444,
                    embedAuthor: {
                        name: `Ajouté par ${ctx.name || "Admin"}`,
                        iconUrl: ctx.image
                    },
                    embedFooter: "Sycnhoronisation SigilOS ⇆ Discord"
                });
            } catch (err) {
                console.error("[Blacklist] Discord sync failed:", err);
            }
        }

        const entry = await db.blacklistEntry.create({
            data: {
                guildId: guild.id,
                content: content.trim(),
                addedById: session.user.id,
                addedByName: ctx.name || "Admin",
                discordMessageId
            }
        });

        await createAuditLog({
            guildId: guild.id,
            actorUserId: session.user.id,
            actorName: ctx.name || "Admin",
            action: "CONFIG_UPDATED",
            targetType: "PROFILE",
            targetId: entry.id,
            metadata: { content, discordMessageId }
        });

        return { success: true };
    } catch (error: any) {
        console.error("[Blacklist Actions] Add Error Detail:", error);
        return { success: false, error: "Erreur lors de l'ajout: " + error.message };
    }
}

export async function editBlacklistEntry(guildId: string, entryId: string, content: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) return { success: false, error: "Permission requise" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, blacklistChannelId: true }
        });

        if (!guild) return { success: false, error: "Guilde introuvable" };

        const entry = await db.blacklistEntry.findUnique({
            where: { id: entryId }
        });

        if (!entry) return { success: false, error: "Entrée introuvable" };

        if (guild.blacklistChannelId && entry.discordMessageId) {
            try {
                await updateChannelMessage(guild.blacklistChannelId, entry.discordMessageId, content, {
                    embedTitle: "🛡️ Signalement Blacklist (Modifié)",
                    embedColor: 0xf59e0b,
                    embedAuthor: {
                        name: `Modifié par ${ctx.name || "Admin"}`,
                        iconUrl: ctx.image
                    }
                });
            } catch (err) {
                console.warn("[Blacklist] Discord edit sync failed:", err);
            }
        }

        await db.blacklistEntry.update({
            where: { id: entryId },
            data: { content: content.trim() }
        });

        return { success: true };
    } catch (error) {
        console.error("[Blacklist Actions] Edit Error:", error);
        return { success: false, error: "Erreur lors de la modification" };
    }
}

export async function deleteBlacklistEntry(guildId: string, entryId: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) return { success: false, error: "Permission requise" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, blacklistChannelId: true }
        });

        if (!guild) return { success: false, error: "Guilde introuvable" };

        const entry = await db.blacklistEntry.findFirst({
            where: { id: entryId, guildId: guild.id }
        });

        if (!entry) return { success: false, error: "Entrée introuvable" };

        if (guild.blacklistChannelId && entry.discordMessageId) {
            try {
                await deleteChannelMessage(guild.blacklistChannelId, entry.discordMessageId);
            } catch (err) {
                console.warn("[Blacklist] Discord delete sync failed:", err);
            }
        }

        await db.blacklistEntry.delete({
            where: { id: entryId }
        });

        return { success: true };
    } catch (error) {
        console.error("[Blacklist Actions] Delete Error:", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

export async function getBlacklistEntries(guildId: string, search?: string): Promise<ActionResponse<any[]>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) return { success: false, error: "Accès refusé" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guild) return { success: false, error: "Guilde introuvable" };

        const entries = await db.blacklistEntry.findMany({
            where: {
                guildId: guild.id,
                ...(search ? {
                    content: {
                        contains: search,
                        mode: 'insensitive'
                    }
                } : {})
            },
            orderBy: { createdAt: 'desc' }
        });

        return { success: true, data: entries };
    } catch (error) {
        console.error("[Blacklist Actions] Get Error:", error);
        return { success: false, error: "Erreur lors de la récupération" };
    }
}

/**
 * DISCORD -> DASHBOARD SYNC HANDLERS
 */
export async function handleDiscordBlacklistCreate(discordGuildId: string, message: any) {
    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true, blacklistChannelId: true }
        });

        if (!guild || guild.blacklistChannelId !== message.channel_id) return;

        // Skip if already exists (avoids loop)
        const existing = await db.blacklistEntry.findUnique({
            where: { discordMessageId: message.id }
        });
        if (existing) return;

        await db.blacklistEntry.create({
            data: {
                guildId: guild.id,
                content: message.content || "Contenu Discord",
                addedById: message.author.id,
                addedByName: message.author.global_name || message.author.username,
                discordMessageId: message.id
            }
        });
        revalidatePath(`/dashboard/${discordGuildId}/admin/members`);
    } catch (err) {
        console.error("[Blacklist Webhook] Create Error:", err);
    }
}

export async function handleDiscordBlacklistUpdate(discordGuildId: string, message: any) {
    try {
        const entry = await db.blacklistEntry.findUnique({
            where: { discordMessageId: message.id }
        });

        if (!entry) return;

        await db.blacklistEntry.update({
            where: { id: entry.id },
            data: { content: message.content || entry.content }
        });
        revalidatePath(`/dashboard/${discordGuildId}/admin/members`);
    } catch (err) {
        console.error("[Blacklist Webhook] Update Error:", err);
    }
}

export async function handleDiscordBlacklistDelete(discordGuildId: string, messageId: string) {
    try {
        const entry = await db.blacklistEntry.findUnique({
            where: { discordMessageId: messageId }
        });

        if (!entry) return;

        await db.blacklistEntry.delete({
            where: { id: entry.id }
        });
        revalidatePath(`/dashboard/${discordGuildId}/admin/members`);
    } catch (err) {
        console.error("[Blacklist Webhook] Delete Error:", err);
    }
}
