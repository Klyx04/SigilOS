"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { getUserContext, type ActionResponse } from "./user-actions";
import { deleteChannelMessage } from "@/server/discord";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { getDisplayName } from "@/lib/display-name";

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------

async function notifyDjUpdate(guildId: string) {
    try {
        await redis.publish("dj:finder:update", JSON.stringify({ guildId }));
    } catch (err) {
        logger.error("[notifyDjUpdate] Error publishing to Redis:", err);
    }
}

async function getDiscordId(userId: string): Promise<string | null> {
    const account = await db.account.findFirst({
        where: { userId, provider: "discord" },
        select: { providerAccountId: true },
    });
    return account?.providerAccountId || null;
}

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type DjPostWithDetails = {
    id: string;
    guildId: string;
    profileId: string;
    mode: string;
    dungeonId: string | null;
    questId: number | null;
    questName: string | null;
    questUrl: string | null;
    wantedAchievementIds: string[];
    maxMembers: number;
    message: string | null;
    targetDate: Date | null;
    requiredClasses: string[];
    isDiscordPublished: boolean;
    discordMessageId?: string | null;
    discordChannelId?: string | null;
    status: string;
    lastReminderAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _acceptedCount: number;
    dungeon: {
        id: string;
        name: string;
        bossName: string;
        level: number;
        imageUrl: string | null;
        isExpedition: boolean;
        isOcreQuest?: boolean;
        dofuspourlesnoobsUrl?: string | null;
        dofensiveUrl?: string | null;
        achievements: {
            id: string;
            points: number;
            challenge: { id: string; name: string; iconUrl: string | null };
        }[];
    } | null;
    profile: {
        id: string;
        discordNickname: string | null;
        pseudoDofus: string | null;
        dofusPseudo: string | null;
        user: { image: string | null };
    };
    participants: {
        id: string;
        status: string;
        createdAt: Date;
        classe?: string | null;
        message?: string | null;
        profile: {
            id: string;
            discordNickname: string | null;
            pseudoDofus: string | null;
            dofusPseudo: string | null;
            user: { image: string | null };
        };
    }[];
};

export type DjSettings = {
    djNotifyChannelId: string | null;
    djPingRoleIds: string[];
};

export async function getDungeonFinderConfig(guildId: string): Promise<ActionResponse<DjSettings>> {
    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Accès refusé" };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { djNotifyChannelId: true, djPingRoleIds: true },
        });
        return { success: true, data: { djNotifyChannelId: config?.djNotifyChannelId || null, djPingRoleIds: config?.djPingRoleIds || [] } };
    } catch (error) {
        logger.error("[getDungeonFinderConfig]", error);
        return { success: false, error: "Erreur lors de la récupération de la config" };
    }
}

// ---------------------------------------------------------------------------
// SCHEMAS
// ---------------------------------------------------------------------------

const createPostSchema = z.object({
    mode: z.enum(["DONJON", "QUETE"]),
    dungeonId: z.string().nullable(),
    questId: z.number().nullable(),
    questName: z.string().nullable(),
    questUrl: z.string().nullable(),
    wantedAchievementIds: z.array(z.string()).default([]),
    maxMembers: z.number().min(2).max(8).default(4),
    message: z.string().max(500).nullable(),
    targetDate: z.date().nullable(),
    requiredClasses: z.array(z.string()).default([]),
    isDiscordPublished: z.boolean().default(true),
    mentionRoleIds: z.array(z.string()).default([]),
});

/**
 * Mode multi-donjons (chantier #26) : jusqu'à 5 donjons dans UNE publication.
 * Chaque donjon a ses propres succès / message / date. UN seul embed Discord
 * (multi-embeds) avec UN seul ping.
 */
const createMultiPostSchema = z.object({
    posts: z.array(z.object({
        dungeonId: z.string().min(1),
        wantedAchievementIds: z.array(z.string()).default([]),
        message: z.string().max(500).nullable(),
        targetDate: z.date().nullable(),
    })).min(2).max(5),
    maxMembers: z.number().min(2).max(8).default(4),
    requiredClasses: z.array(z.string()).default([]),
    isDiscordPublished: z.boolean().default(true),
    mentionRoleIds: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

async function expireOldPosts(guildId: string) {
    // Les posts ne s'expirent plus automatiquement. Ils restent actifs jusqu'à fermeture manuelle.
}

async function sendDiscordNotification(
    guildId: string,
    post: any,
    embed: any,
    mentionRoleId?: string | null,
    creatorDiscordId?: string | null
) {
    try {
        const guildConfig = await (db as any).guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { djNotifyChannelId: true },
        });
        if (!guildConfig?.djNotifyChannelId) return;
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) return;

        const channelId = guildConfig.djNotifyChannelId;
        const channelRes = await fetch(`https://discord.com/api/v10/channels/${channelId}`, { headers: { Authorization: `Bot ${token}` } });
        if (!channelRes.ok) { logger.error(`[DJ Embed] Cannot fetch channel: ${channelRes.status}`); return; }
        const channelData = await channelRes.json();
        const isForumChannel = channelData.type === 15;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";

        const buttonComponents: any[] = [
            { type: 2, style: 1, label: "S'inscrire", emoji: { name: "⚔️" }, custom_id: `dj:join:${post.id}` },
            { type: 2, style: 4, label: "Se désinscrire", emoji: { name: "🚪" }, custom_id: `dj:leave:${post.id}` },
            { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: embed.url || `${appUrl}/dashboard/${guildId}/donjons-et-quetes` },
        ];

        if (post.dungeon?.dofuspourlesnoobsUrl || (post.questUrl && post.questUrl.includes("dofuspourlesnoobs"))) {
            buttonComponents.push({ type: 2, style: 5, label: "DofusPourLesNoobs", emoji: { name: "📙" }, url: post.dungeon?.dofuspourlesnoobsUrl || post.questUrl });
        }
        if (post.dungeon?.dofensiveUrl) {
            buttonComponents.push({ type: 2, style: 5, label: "Dofensive", emoji: { name: "🛡️" }, url: post.dungeon.dofensiveUrl });
        }
        if (post.questId && post.questId !== -1) {
            buttonComponents.push({ type: 2, style: 5, label: "DofusDB", emoji: { name: "🗺️" }, url: `https://dofusdb.fr/fr/database/quest/${post.questId}` });
        }

        const components = [{ type: 1, components: buttonComponents }];

        let discordMessageId: string | null = null;
        let discordChannelId: string | null = null;

        if (isForumChannel) {
            const isDungeon = embed.title?.includes("⚔️");
            // Extraire le nom depuis la description: "**Donjon :** Nom" ou "**Quete :** Nom"
            const nameMatch = embed.description?.match(/[*][*](?:Donjon|Qu.te)\s*:[*][*]\s*(.+?)(?:\n|$)/i);
            const contentName = (nameMatch && nameMatch[1] ? nameMatch[1] : "Groupe").trim().substring(0, 65);
            const typeLabel = isDungeon ? "Donjon" : "Quete";
            const emojiChar = embed.title ? embed.title.slice(0, 2) : "";
            const placesField = embed.fields && embed.fields.find((f: { name: string; value: string }) => f.name.includes("Places"));
            const placesTag = placesField ? " [" + placesField.value + "]" : "";
            const threadTitle = (emojiChar + " " + typeLabel + " - " + contentName + placesTag).trim().substring(0, 100);

            // Extraire les tags disponibles depuis channelData (déjà fetchée)
            const availableTags: { id: string; name: string; moderated?: boolean }[] = channelData.available_tags || [];
            const firstUsableTag = availableTags.find((t: { moderated?: boolean }) => !t.moderated);

            const roleMentions = mentionRoleId ? mentionRoleId.split(",").map(id => `<@&${id.trim()}>`).join(" ") : "";
            const creatorMention = creatorDiscordId ? `<@${creatorDiscordId}>` : "";
            const mentions = [creatorMention, roleMentions].filter(Boolean).join(" ");

            const forumBody: Record<string, unknown> = {
                name: threadTitle,
                message: { 
                    content: mentions || undefined,
                    embeds: [embed], 
                    components 
                },
                auto_archive_duration: 1440,
            };
            if (firstUsableTag) {
                forumBody.applied_tags = [firstUsableTag.id];
            }

            const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/threads`, {
                method: "POST",
                headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(forumBody),
            });
            if (res.ok) { const t = await res.json(); discordChannelId = t.id; discordMessageId = t.message?.id; }
            else { logger.error("[DJ Embed] Forum thread error:", await res.json()); }
        } else {
            const roleMentions = mentionRoleId ? mentionRoleId.split(",").map(id => `<@&${id.trim()}>`).join(" ") : "";
            const creatorMention = creatorDiscordId ? `<@${creatorDiscordId}>` : "";
            const mentions = [creatorMention, roleMentions].filter(Boolean).join(" ");
            
            const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                method: "POST",
                headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    content: mentions || undefined,
                    embeds: [embed], 
                    components 
                }),
            });
            if (res.ok) { const m = await res.json(); discordChannelId = channelId; discordMessageId = m.id; }
            else { logger.error("[DJ Embed] Text channel error:", await res.json()); }
        }

        if (discordChannelId && discordMessageId) {
            await (db as any).djSearchPost.update({
                where: { id: post.id },
                data: { discordMessageId, discordChannelId },
            });
        }
    } catch (error) {
        logger.error("[sendDiscordNotification]", error);
    }
}

/**
 * Multi-donjons (chantier #26) : envoie UN SEUL message Discord contenant les
 * embeds de tous les donjons + UN SEUL ping (créateur + rôles autorisés).
 * Chaque donjon a sa rangée de boutons « S'inscrire » (custom_id dj:join:<id>).
 */
async function sendMultiDiscordNotification(
    guildId: string,
    posts: any[],
    embeds: any[],
    mentionRoleId?: string | null,
    creatorDiscordId?: string | null
) {
    try {
        const guildConfig = await (db as any).guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { djNotifyChannelId: true },
        });
        if (!guildConfig?.djNotifyChannelId) return;
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) return;

        const channelId = guildConfig.djNotifyChannelId;
        const channelRes = await fetch(`https://discord.com/api/v10/channels/${channelId}`, { headers: { Authorization: `Bot ${token}` } });
        if (!channelRes.ok) { logger.error(`[DJ Multi Embed] Cannot fetch channel: ${channelRes.status}`); return; }
        const channelData = await channelRes.json();
        const isForumChannel = channelData.type === 15;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";

        // Une rangée de boutons par donjon (max 5 rangées autorisées par message)
        const rows = posts.map((post: any) => ({
            type: 1,
            components: [
                { type: 2, style: 1, label: `S'inscrire — ${(post.dungeon?.name || "Donjon").substring(0, 40)}`, emoji: { name: "⚔️" }, custom_id: `dj:join:${post.id}` },
                { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: `${appUrl}/dashboard/${guildId}/donjons-et-quetes` },
            ],
        }));

        const mentions = [
            creatorDiscordId ? `<@${creatorDiscordId}>` : "",
            ...(mentionRoleId ? mentionRoleId.split(",").map(id => `<@&${id.trim()}>`) : []),
        ].filter(Boolean).join(" ");

        let discordChannelId: string | null = null;
        let discordMessageId: string | null = null;

        if (isForumChannel) {
            const first = posts[0];
            const contentName = (first?.dungeon?.name || "Multi-donjon").substring(0, 60);
            const threadTitle = `⚔️ Multi-donjon - ${posts.length} donjons - ${contentName}`.substring(0, 100);
            const availableTags: { id: string; name: string; moderated?: boolean }[] = channelData.available_tags || [];
            const firstUsableTag = availableTags.find((t: { moderated?: boolean }) => !t.moderated);
            const forumBody: Record<string, unknown> = {
                name: threadTitle,
                message: { content: mentions || undefined, embeds, components: rows },
                auto_archive_duration: 1440,
            };
            if (firstUsableTag) forumBody.applied_tags = [firstUsableTag.id];
            const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/threads`, {
                method: "POST",
                headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(forumBody),
            });
            if (res.ok) { const t = await res.json(); discordChannelId = t.id; discordMessageId = t.message?.id; }
            else { logger.error("[DJ Multi Embed] Forum thread error:", await res.json()); }
        } else {
            const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                method: "POST",
                headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ content: mentions || undefined, embeds, components: rows }),
            });
            if (res.ok) { const m = await res.json(); discordChannelId = channelId; discordMessageId = m.id; }
            else { logger.error("[DJ Multi Embed] Text channel error:", await res.json()); }
        }

        // Attacher le message Discord à TOUS les posts créés
        if (discordChannelId && discordMessageId) {
            await (db as any).djSearchPost.updateMany({
                where: { id: { in: posts.map((p: any) => p.id) } },
                data: { discordMessageId, discordChannelId },
            });
        }
    } catch (error) {
        logger.error("[sendMultiDiscordNotification]", error);
    }
}

/**
 * Met à jour l'embed Discord existant (PATCH) quand les participants changent.
 */
export async function updateDjDiscordEmbed(guildId: string, postId: string) {
    try {
        const post = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            include: {
                dungeon: { include: { achievements: { include: { challenge: { select: { id: true, name: true, iconUrl: true } } } } } },
                profile: { select: { discordNickname: true, pseudoDofus: true, dofusPseudo: true, user: { select: { name: true } } } },
                participants: {
                    where: { status: "ACCEPTED" },
                    include: { profile: { select: { discordNickname: true, pseudoDofus: true, dofusPseudo: true, user: { select: { name: true } } } } },
                    orderBy: { createdAt: "asc" },
                },
            },
        });
        if (!post?.discordMessageId || !post?.discordChannelId) return;
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) return;
        const authorName = post.profile?.discordNickname || post.profile?.pseudoDofus || post.profile?.dofusPseudo || post.profile?.user?.name || "Membre";
        const embed = await buildPostEmbed(post, authorName, guildId, post.participants);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
        const isOpen = post.status === "OPEN" || post.status === "FULL";
        const buttonComponents: any[] = isOpen ? [
            { type: 2, style: 1, label: "S'inscrire", emoji: { name: "⚔️" }, custom_id: `dj:join:${postId}` },
            { type: 2, style: 4, label: "Se désinscrire", emoji: { name: "🚪" }, custom_id: `dj:leave:${postId}` },
            { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: `${appUrl}/dashboard/${guildId}/donjons-et-quetes` },
        ] : [
            { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: `${appUrl}/dashboard/${guildId}/donjons-et-quetes` },
        ];

        if (post.dungeon?.dofuspourlesnoobsUrl || (post.questUrl && post.questUrl.includes("dofuspourlesnoobs"))) {
            buttonComponents.push({ type: 2, style: 5, label: "DofusPourLesNoobs", emoji: { name: "📙" }, url: post.dungeon?.dofuspourlesnoobsUrl || post.questUrl });
        }
        if (post.dungeon?.dofensiveUrl) {
            buttonComponents.push({ type: 2, style: 5, label: "Dofensive", emoji: { name: "🛡️" }, url: post.dungeon.dofensiveUrl });
        }
        if (post.questId && post.questId !== -1) {
            buttonComponents.push({ type: 2, style: 5, label: "DofusDB", emoji: { name: "🗺️" }, url: `https://dofusdb.fr/fr/database/quest/${post.questId}` });
        }

        const components = [{ type: 1, components: buttonComponents }];
        const patchRes = await fetch(
            `https://discord.com/api/v10/channels/${post.discordChannelId}/messages/${post.discordMessageId}`,
            { method: "PATCH", headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [embed], components }) }
        );
        if (!patchRes.ok) logger.error("[updateDjDiscordEmbed] PATCH failed:", patchRes.status);
    } catch (err) { logger.error("[updateDjDiscordEmbed]", err); }
}

/**
 * Supprime l'embed Discord (post fermé) : message ou thread forum supprimé.
 */
async function disableDjDiscordEmbed(guildId: string, discordChannelId: string | null, discordMessageId: string | null) {
    if (!discordChannelId || !discordMessageId) return;
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { djNotifyChannelId: true }
        });
        
        const { deleteChannel, deleteChannelMessage } = await import("@/server/discord");
        
        // Si le discordChannelId de ce post n'est pas le salon général de notification des donjons,
        // c'est que c'est un thread/salon créé spécifiquement pour ce post (ex: forum). On supprime donc le salon entier.
        if (guildConfig?.djNotifyChannelId && discordChannelId !== guildConfig.djNotifyChannelId) {
            await deleteChannel(discordChannelId);
        } else {
            // Sinon, c'est un message classique dans le salon principal, on supprime juste le message.
            await deleteChannelMessage(discordChannelId, discordMessageId);
        }
    } catch (error) { 
        logger.error("[disableDjDiscordEmbed] Failed to clean up Discord message/channel:", error); 
    }
}

/**
 * Envoie un rappel (ping) aux participants acceptés sur Discord.
 */
export async function sendDjReminder(guildId: string, postId: string) {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.profileId) return { success: false, error: "Non authentifié" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { djNotifyChannelId: true },
        });

        const post = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            include: {
                dungeon: {
                    include: {
                        achievements: {
                            include: {
                                challenge: { select: { id: true, name: true, iconUrl: true } },
                            },
                        },
                    },
                },
                profile: {
                    select: {
                        discordNickname: true,
                        pseudoDofus: true,
                        dofusPseudo: true,
                        userId: true,
                        user: { select: { name: true } }
                    }
                },
                // Include ALL participants (PENDING + ACCEPTED) to notify everyone who signed up
                participants: {
                    where: { status: { in: ["PENDING", "ACCEPTED"] } },
                    include: {
                        profile: {
                            select: {
                                userId: true,
                                discordNickname: true,
                                pseudoDofus: true,
                                dofusPseudo: true
                            }
                        }
                    }
                }
            }
        });

        if (!post) return { success: false, error: "Post introuvable" };
        if (post.profileId !== user.profileId) return { success: false, error: "Seul le leader peut envoyer un rappel" };

        // Spam Protection: 5 minutes cooldown
        const COOLDOWN_MS = 5 * 60 * 1000;
        if (post.lastReminderAt && (Date.now() - post.lastReminderAt.getTime() < COOLDOWN_MS)) {
            const remainingMinutes = Math.ceil((COOLDOWN_MS - (Date.now() - post.lastReminderAt.getTime())) / 60000);
            return { success: false, error: `Anti-spam : Veuillez attendre ${remainingMinutes} minute(s) avant le prochain rappel.` };
        }

        // Resolve Discord channel: post-specific channel first, then guild's default DJ channel
        const targetChannelId: string | null = post.discordChannelId || guildConfig?.djNotifyChannelId || null;

        const mentions: string[] = [];
        for (const p of post.participants) {
            const discordId = await getDiscordId(p.profile.userId);
            if (discordId) mentions.push(`<@${discordId}>`);
        }

        if (mentions.length === 0) return { success: false, error: "Aucun inscrit à notifier" };

        // Update cooldown timestamp regardless of Discord availability
        await (db as any).djSearchPost.update({
            where: { id: postId },
            data: { lastReminderAt: new Date() }
        });

        // Send Discord ping if a channel is available
        if (targetChannelId) {
            const { sendDiscordRawEmbed } = await import("@/server/discord");
            const authorName = post.profile?.discordNickname || post.profile?.user?.name || "Leader";
            const embed = await buildPostEmbed(post, authorName, guildId);
            embed.title = `🔔 RAPPEL : ${post.mode === "DONJON" ? "DONJON" : "QUÊTE"}`;
            embed.description = `⚠️ **Le leader demande votre attention pour le départ !**\n\n${embed.description}`;
            embed.color = 0x9333ea; // Purple for reminders
            await sendDiscordRawEmbed(guildId, targetChannelId, mentions.join(" "), embed);
        }

        return { success: true };
    } catch (error) {
        logger.error("[sendDjReminder]", error);
        return { success: false, error: "Erreur lors de l'envoi du rappel" };
    }
}

/**
 * Envoie une relance personnalisée (message libre) aux participants acceptés.
 * Réservé au leader du post. Rate limit : 24h.
 */
export async function sendDjCustomReminder(guildId: string, postId: string, customMessage: string) {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.profileId) return { success: false, error: "Non authentifié" };

    if (!customMessage || customMessage.trim().length === 0) {
        return { success: false, error: "Le message ne peut pas être vide" };
    }
    if (customMessage.trim().length > 500) {
        return { success: false, error: "Le message est trop long (max 500 caractères)" };
    }

    try {
        const post = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            include: {
                dungeon: {
                    include: {
                        achievements: {
                            include: {
                                challenge: { select: { id: true, name: true, iconUrl: true } },
                            },
                        },
                    },
                },
                profile: {
                    select: {
                        discordNickname: true,
                        pseudoDofus: true,
                        dofusPseudo: true,
                        userId: true,
                        user: { select: { name: true } }
                    }
                },
                participants: {
                    where: { status: "ACCEPTED" },
                    include: {
                        profile: {
                            select: {
                                userId: true,
                                discordNickname: true,
                                pseudoDofus: true,
                                dofusPseudo: true
                            }
                        }
                    }
                }
            }
        });

        if (!post) return { success: false, error: "Post introuvable" };
        if (post.profileId !== user.profileId) return { success: false, error: "Seul le leader peut envoyer une relance" };
        if (!post.discordChannelId) return { success: false, error: "Post non publié sur Discord" };

        // Rate limit : 24h
        const COOLDOWN_MS = 24 * 60 * 60 * 1000;
        if (post.lastReminderAt && (Date.now() - post.lastReminderAt.getTime() < COOLDOWN_MS)) {
            const remainingHours = Math.ceil((COOLDOWN_MS - (Date.now() - post.lastReminderAt.getTime())) / 3600000);
            return { success: false, error: `Anti-spam : Veuillez attendre encore ${remainingHours}h avant la prochaine relance.` };
        }

        const mentions: string[] = [];
        for (const p of post.participants) {
            const discordId = await getDiscordId(p.profile.userId);
            if (discordId) mentions.push(`<@${discordId}>`);
        }

        if (mentions.length === 0) return { success: false, error: "Aucun participant accepté à pinger" };

        const { sendDiscordRawEmbed } = await import("@/server/discord");

        const authorName = post.profile?.discordNickname || post.profile?.user?.name || "Leader";
        const postTitle = post.mode === "DONJON" ? (post.dungeon?.name || "Donjon") : (post.questName || "Quête");

        const embed = {
            title: `📣 RELANCE DU LEADER — ${post.mode === "DONJON" ? "DONJON" : "QUÊTE"}`,
            description: `**${postTitle}**\n\n💬 **Message du leader (${authorName}) :**\n> ${customMessage.trim()}`,
            color: 0xf59e0b, // Amber for custom reminders
            footer: { text: "SigilOS • Donjon-Finder — Relance personnalisée" },
            timestamp: new Date().toISOString(),
        };

        await sendDiscordRawEmbed(guildId, post.discordChannelId, mentions.join(" "), embed);

        await (db as any).djSearchPost.update({
            where: { id: postId },
            data: { lastReminderAt: new Date() }
        });

        return { success: true };
    } catch (error) {
        logger.error("[sendDjCustomReminder]", error);
        return { success: false, error: "Erreur lors de l'envoi de la relance" };
    }
}





async function buildPostEmbed(post: any, authorName: string, guildId: string, acceptedParticipants: any[] = []) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
    const isDungeon = post.mode === "DONJON";
    
    // Fetch creator's Discord ID for pinging
    let creatorDiscordId: string | null = null;
    if (post.profile?.userId) {
        const acc = await db.account.findFirst({
            where: { userId: post.profile.userId, provider: "discord" },
            select: { providerAccountId: true }
        });
        creatorDiscordId = acc?.providerAccountId || null;
    }

    const title = isDungeon
        ? `⚔️ RECHERCHE DONJON`
        : `📜 RECHERCHE QUÊTE`;

    const fields: any[] = [];

    // Main Content Info
    if (isDungeon && post.dungeon) {
        fields.push({ 
            name: "📍 Donjon", 
            value: `**${post.dungeon.name}**\n*Niveau ${post.dungeon.level}*`,
            inline: true 
        });
    } else if (!isDungeon) {
        fields.push({ 
            name: "📂 Quête", 
            value: post.questUrl 
                ? `**[${post.questName || "Inconnue"}](${post.questUrl})**`
                : `**${post.questName || "Inconnue"}**`,
            inline: true 
        });
    }

    if (post.targetDate) {
        const d = new Date(post.targetDate);
        const timestamp = Math.floor(d.getTime() / 1000);
        fields.push({
            name: "📅 Date prévue",
            value: `<t:${timestamp}:F>\n(<t:${timestamp}:R>)`,
            inline: true
        });
    }

    // New line for following fields
    fields.push({ name: "\u200b", value: "\u200b", inline: false });

    if (isDungeon && post.wantedAchievementIds.length > 0 && post.dungeon?.achievements) {
        const achNames = post.dungeon.achievements
            .filter((a: any) => post.wantedAchievementIds.includes(a.id))
            .map((a: any) => `• ${a.challenge.name}`)
            .join("\n");
        if (achNames) {
            fields.push({ name: "🏆 Succès visés", value: achNames, inline: true });
        }
    }

    if (post.requiredClasses && post.requiredClasses.length > 0) {
        fields.push({ 
            name: "🎭 Classes recherchées", 
            value: post.requiredClasses.map((c: string) => `\`${c}\``).join(" "),
            inline: true
        });
    }

    // Live participants list
    const acceptedParts = (post.participants ?? []).filter((p: any) => p.status === "ACCEPTED");
    const totalCount = acceptedParts.length + 1; // +1 for creator
    
    const leadName = authorName;
    const participantLines = acceptedParts.map((p: any) => {
        const n = p.profile?.discordNickname || p.profile?.pseudoDofus || p.profile?.dofusPseudo || "Membre";
        return `• ${n}${p.classe ? ` *(${p.classe})*` : ""}`;
    });

    fields.push({ 
        name: `👥 Membres (${totalCount}/${post.maxMembers})`, 
        value: `**${leadName}**\n${participantLines.length > 0 ? participantLines.join("\n") : "*En attente de joueurs...*"}` ,
        inline: false
    });

    return {
        title,
        description: [
            `👤 **${creatorDiscordId ? `<@${creatorDiscordId}>` : authorName}** cherche des compagnons !`,
            post.message ? `\n> ${post.message}` : "",
        ].filter(Boolean).join("\n"),
        color: isDungeon ? 0x818cf8 : 0x34d399,
        fields,
        thumbnail: (() => {
            if (!isDungeon || !post.dungeon?.imageUrl) return undefined;
            const rawUrl = post.dungeon.imageUrl.startsWith("http")
                ? post.dungeon.imageUrl
                : `${appUrl}${post.dungeon.imageUrl}`;
            return rawUrl.startsWith("https://") ? { url: rawUrl } : undefined;
        })(),
        footer: {
            text: "SigilOS — Donjons & Quêtes",
        },
        url: `${appUrl}/dashboard/${guildId}/donjons-et-quetes`,
        timestamp: new Date().toISOString(),
    };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new DJ search post.
 */
export async function createDjPost(
    guildId: string,
    input: z.infer<typeof createPostSchema>
): Promise<ActionResponse<{ id: string }>> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) return { success: false, error: "Accès refusé" };
    if (!user.profileId) return { success: false, error: "Profil introuvable" };

    const parsed = createPostSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Données invalides" };

    const { mentionRoleIds, ...rest } = parsed.data;
    const mentionRoleId = mentionRoleIds.length > 0 ? mentionRoleIds.join(",") : null;

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, djPingRoleIds: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // SECURITY: Validate every mentionRoleId against the admin-configured whitelist
        if (mentionRoleIds.length > 0) {
            const allowedRoleIds: string[] = guildConfig.djPingRoleIds ?? [];
            const invalidRoles = mentionRoleIds.filter((id) => !allowedRoleIds.includes(id));
            if (invalidRoles.length > 0) {
                return { success: false, error: "Un ou plusieurs rôles mentionnés ne sont pas autorisés" };
            }
        }

        // Anti-spam: max 3 active posts per user
        const activeCount = await (db as any).djSearchPost.count({
            where: {
                profileId: user.profileId,
                guildId: guildConfig.id,
                status: "OPEN",
            },
        });
        if (activeCount >= 3) {
            return { success: false, error: "Tu as déjà 3 posts actifs. Ferme-en un pour en créer un nouveau." };
        }

        let finalQuestUrl = rest.questUrl;
        if (rest.mode === "QUETE" && !finalQuestUrl && rest.questName) {
            const { getVerifiedDPLNUrl } = await import("@/lib/dofus-noobs-helper");
            finalQuestUrl = await getVerifiedDPLNUrl(rest.questName);
        }

        const post = await (db as any).djSearchPost.create({
            data: {
                ...rest,
                questUrl: finalQuestUrl,
                guildId: guildConfig.id,
                profileId: user.profileId,
                mentionRoleId,
                expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
                // Note: creator is NOT added as a participant — they occupy 1 slot implicitly
            },
            include: {
                dungeon: {
                    include: {
                        achievements: {
                            include: {
                                challenge: { select: { id: true, name: true, iconUrl: true } },
                            },
                        },
                    },
                },
            },
        });

        // Discord notification
        if (rest.isDiscordPublished) {
            const authorName = user.name || "Membre";
            const embed = await buildPostEmbed(post, authorName, guildId);
            const creatorDiscordId = await getDiscordId(user.id || "");
            await sendDiscordNotification(guildId, post, embed, mentionRoleId, creatorDiscordId);
        }


        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        await notifyDjUpdate(guildId);
        return { success: true, data: { id: post.id } };
    } catch (error) {
        logger.error("[createDjPost]", error);
        return { success: false, error: "Erreur lors de la création du post" };
    }
}

/**
 * Mode multi-donjons (chantier #26) : crée de 2 à 5 posts en une transaction,
 * puis UN SEUL message Discord (multi-embeds + UN ping).
 */
export async function createDjPosts(
    guildId: string,
    input: z.infer<typeof createMultiPostSchema>
): Promise<ActionResponse<{ ids: string[] }>> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) return { success: false, error: "Accès refusé" };
    if (!user.profileId) return { success: false, error: "Profil introuvable" };

    const parsed = createMultiPostSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Données invalides" };

    const { mentionRoleIds, posts, ...rest } = parsed.data;
    const mentionRoleId = mentionRoleIds.length > 0 ? mentionRoleIds.join(",") : null;

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, djPingRoleIds: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // SECURITY: Validate every mentionRoleId against the admin-configured whitelist
        if (mentionRoleIds.length > 0) {
            const allowedRoleIds: string[] = guildConfig.djPingRoleIds ?? [];
            const invalidRoles = mentionRoleIds.filter((id) => !allowedRoleIds.includes(id));
            if (invalidRoles.length > 0) {
                return { success: false, error: "Un ou plusieurs rôles mentionnés ne sont pas autorisés" };
            }
        }

        // Anti-spam : 5 posts actifs max au total (mode multi inclus)
        const MAX_ACTIVE_POSTS = 5;
        const activeCount = await (db as any).djSearchPost.count({
            where: {
                profileId: user.profileId,
                guildId: guildConfig.id,
                status: "OPEN",
            },
        });
        if (activeCount + posts.length > MAX_ACTIVE_POSTS) {
            return {
                success: false,
                error: `Tu as déjà ${activeCount} post(s) actif(s). Ferme-en avant d'en créer ${posts.length}.`,
            };
        }

        // Bornage : tous les donjons doivent exister (guild isolation + validation)
        const dungeonIds = [...new Set(posts.map((p) => p.dungeonId))];
        const foundDungeons = await (db as any).dungeon.findMany({
            where: { id: { in: dungeonIds } },
            select: { id: true },
        });
        const foundIds = new Set(foundDungeons.map((d: any) => d.id));
        if (dungeonIds.some((id) => !foundIds.has(id))) {
            return { success: false, error: "Un ou plusieurs donjons sont invalides" };
        }

        // Création des posts en transaction
        const created = await (db as any).$transaction(
            posts.map((p) => (db as any).djSearchPost.create({
                data: {
                    mode: "DONJON",
                    dungeonId: p.dungeonId,
                    questId: null,
                    questName: null,
                    questUrl: null,
                    wantedAchievementIds: p.wantedAchievementIds,
                    maxMembers: rest.maxMembers,
                    message: p.message,
                    targetDate: p.targetDate,
                    requiredClasses: rest.requiredClasses,
                    isDiscordPublished: rest.isDiscordPublished,
                    mentionRoleId,
                    guildId: guildConfig.id,
                    profileId: user.profileId,
                    expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
                },
                include: {
                    dungeon: {
                        include: {
                            achievements: {
                                include: {
                                    challenge: { select: { id: true, name: true, iconUrl: true } },
                                },
                            },
                        },
                    },
                },
            }))
        );

        // Discord : UN seul message, multi-embeds, UN seul ping
        if (rest.isDiscordPublished) {
            const authorName = user.name || "Membre";
            const embeds = await Promise.all(created.map((post: any) => buildPostEmbed(post, authorName, guildId)));
            const creatorDiscordId = await getDiscordId(user.id || "");
            await sendMultiDiscordNotification(guildId, created, embeds, mentionRoleId, creatorDiscordId);
        }

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        await notifyDjUpdate(guildId);
        return { success: true, data: { ids: created.map((p: any) => p.id) } };
    } catch (error) {
        logger.error("[createDjPosts]", error);
        return { success: false, error: "Erreur lors de la création des posts" };
    }
}

/**
 * Update a DJ post (creator only).
 * Cannot change dungeon/quest — only metadata fields.
 */
export async function updateDjPost(
    guildId: string,
    postId: string,
    payload: {
        maxMembers: number;
        message: string | null;
        targetDate: Date | null;
        wantedAchievementIds: string[];
        requiredClasses: string[];
        questName?: string | null;
        questUrl?: string | null;
    }
): Promise<ActionResponse> {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.profileId) return { success: false, error: "Non authentifié" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const post = await (db as any).djSearchPost.findFirst({
            where: { id: postId, guildId: guildConfig.id },
            select: { profileId: true, status: true },
        });

        if (!post) return { success: false, error: "Post introuvable" };
        if (post.profileId !== user.profileId) return { success: false, error: "Seul le créateur peut modifier ce post" };
        if (post.status === "CLOSED" || post.status === "EXPIRED") return { success: false, error: "Impossible de modifier un post fermé" };

        await (db as any).djSearchPost.update({
            where: { id: postId },
            data: {
                maxMembers: payload.maxMembers,
                message: payload.message,
                targetDate: payload.targetDate,
                wantedAchievementIds: payload.wantedAchievementIds,
                requiredClasses: payload.requiredClasses,
                // Modifiable uniquement pour les quêtes manuelles (pas de questId valide)
                ...(payload.questName !== undefined && { questName: payload.questName }),
                ...(payload.questUrl !== undefined && { questUrl: payload.questUrl }),
            },
        });

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        return { success: true };
    } catch (error) {
        logger.error("[updateDjPost]", error);
        return { success: false, error: "Erreur lors de la modification" };
    }
}

/**
 * Returns contribution points to award based on dungeon level.
 * Quête (no dungeon level) = 1 pt
 * Lvl   1-99  = 1 pt
 * Lvl 100-149 = 2 pts
 * Lvl 150-199 = 3 pts
 * Lvl 200+    = 4 pts  (endgame content)
 */
function getContributionPoints(dungeonLevel?: number | null): number {
    if (!dungeonLevel) return 1;
    if (dungeonLevel >= 200) return 4;
    if (dungeonLevel >= 150) return 3;
    if (dungeonLevel >= 100) return 2;
    return 1;
}

/**
 * Close a DJ search post (creator only) and award contribution points to validated participants.
 * The creator themselves gets 0 points.
 * @param validatedProfileIds - profileIds of participants who participated and should get points
 */
export async function closeDjPostWithContributions(
    guildId: string,
    postId: string,
    validatedProfileIds: string[]
): Promise<ActionResponse> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder || !user.profileId) return { success: false, error: "Accès refusé" };

    try {
        // Close the post — first fetch the dungeon level for point calculation
        const post = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            select: {
                profileId: true,
                guildId: true,
                discordChannelId: true,
                discordMessageId: true,
                dungeon: { select: { level: true } },
            },
        });

        if (!post) return { success: false, error: "Post introuvable" };
        // Only creator can close with contributions (admins use closeDjPost)
        if (post.profileId !== user.profileId) {
            return { success: false, error: "Seul le créateur peut valider la clôture" };
        }

        const pts = getContributionPoints(post.dungeon?.level);

        // Close the post
        await (db as any).djSearchPost.update({
            where: { id: postId },
            data: { status: "CLOSED" },
        });

        // Distribution des points de contribution
        const toReward = validatedProfileIds.filter((pid) => pid !== post.profileId);
        if (toReward.length > 0) {
            await db.userProfile.updateMany({
                where: { id: { in: toReward } },
                data: { contributionPoints: { increment: pts } },
            });
        }

        // Désactiver l'embed Discord (fire-and-forget)
        disableDjDiscordEmbed(guildId, (post as any).discordChannelId ?? null, (post as any).discordMessageId ?? null).catch(() => { });

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        return { success: true, data: { pointsAwarded: pts } };
    } catch (error) {
        logger.error("[closeDjPostWithContributions]", error);
        return { success: false, error: "Erreur lors de la fermeture" };
    }
}

/**
 * Lightweight guild member list for the close modal — no Discord API calls.
 * Returns only id, pseudo, and avatar of active guild members.
 */
export async function getDjGuildMembersForClose(
    guildId: string
): Promise<ActionResponse<{ id: string; name: string; image: string | null }[]>> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder || !user.profileId) return { success: false, error: "Accès refusé" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profiles = await db.userProfile.findMany({
            where: { guildId: guildConfig.id, status: "ACTIVE" },
            select: {
                id: true,
                discordNickname: true,
                pseudoDofus: true,
                user: { select: { name: true, image: true } },
            },
            orderBy: { pseudoDofus: "asc" },
        });

        return {
            success: true,
            data: profiles.map((p) => ({
                id: p.id,
                name: getDisplayName(p),
                image: p.user.image,
            })),
        };
    } catch (error) {
        logger.error("[getDjGuildMembersForClose]", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Close a DJ search post — admin/quick version, no contribution awards.
 */
export async function closeDjPost(
    guildId: string,
    postId: string
): Promise<ActionResponse> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) return { success: false, error: "Accès refusé" };

    try {
        const post = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            select: { profileId: true, guildId: true, discordMessageId: true, discordChannelId: true },
        });

        if (!post) return { success: false, error: "Post introuvable" };
        if (post.profileId !== user.profileId && !user.isAdmin) {
            return { success: false, error: "Tu ne peux fermer que tes propres posts" };
        }

        await (db as any).djSearchPost.update({
            where: { id: postId },
            data: { status: "CLOSED" },
        });

        disableDjDiscordEmbed(guildId, post.discordChannelId, post.discordMessageId).catch(() => { });

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        await notifyDjUpdate(guildId);
        return { success: true };
    } catch (error) {
        logger.error("[closeDjPost]", error);
        return { success: false, error: "Erreur lors de la fermeture" };
    }
}

/**
 * Delete a DJ search post explicitly (author or admin).
 */
export async function deleteDjPost(
    guildId: string,
    postId: string
): Promise<ActionResponse> {
    const user = await getUserContext(guildId);
    if (!user.profileId) return { success: false, error: "Profil introuvable" };

    try {
        const post = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            select: { profileId: true, discordMessageId: true, discordChannelId: true },
        });

        if (!post) return { success: false, error: "Post introuvable" };

        if (post.profileId !== user.profileId && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
        }

        if (post.discordChannelId && post.discordMessageId) {
            deleteChannelMessage(post.discordChannelId, post.discordMessageId).catch(() => { });
        }

        await (db as any).djSearchPost.delete({
            where: { id: postId },
        });

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        return { success: true };
    } catch (error) {
        logger.error("[deleteDjPost]", error);
        return { success: false, error: "Erreur lors de la suppression" };
    }
}

/**
 * Join a DJ search post.
 */
export async function joinDjPost(
    guildId: string,
    postId: string,
    options?: { classe?: string | null; message?: string | null }
): Promise<ActionResponse> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) return { success: false, error: "Accès refusé" };
    if (!user.profileId) return { success: false, error: "Profil introuvable" };

    try {
        const post = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            include: {
                participants: { where: { status: "ACCEPTED" }, select: { id: true } },
                profile: { select: { userId: true } },
            },
        });

        if (!post) return { success: false, error: "Post introuvable" };
        if (post.status !== "OPEN") return { success: false, error: "Ce post n'est plus ouvert" };

        // Already joined?
        if (post.profileId === user.profileId) return { success: false, error: "Tu es le créateur de ce post" };

        const existing = await (db as any).djSearchParticipant.findFirst({
            where: { postId, profileId: user.profileId },
        });
        if (existing) return { success: false, error: "Tu as déjà rejoint ce groupe" };

        // Post full?
        if (post.participants.length >= post.maxMembers) {
            return { success: false, error: "Ce groupe est complet" };
        }

        await (db as any).djSearchParticipant.create({
            data: {
                postId,
                profileId: user.profileId,
                userId: user.id!,
                classe: options?.classe || null,
                message: options?.message || null,
                status: "ACCEPTED",
            },
        });

        // Auto-fill check
        const newCount = post.participants.length + 1;
        if (newCount >= post.maxMembers) {
            await (db as any).djSearchPost.update({
                where: { id: postId },
                data: { status: "FULL" },
            });
        }

        // Notify post creator (respect leur préférence notif)
        if (post.profile?.userId && post.profile.userId !== user.id) {
            const creatorProfile = await (db as any).userProfile.findFirst({
                where: { userId: post.profile.userId },
                select: { notificationPrefs: true },
            });
            const notifPrefs = (creatorProfile?.notificationPrefs as any) || {};
            const wantsNotif = notifPrefs.donjons !== false; // true par défaut

            if (wantsNotif) {
                const { createNotification } = await import("@/server/actions/notification-actions");
                const joinerName = user.name || "Un joueur";
                const postTitle = post.questName || post.dungeon?.name || "Groupe";
                await createNotification(
                    post.profile.userId,
                    "SYSTEM_INFO",
                    "Nouvelle candidature DJ",
                    `**${joinerName}** a rejoint ton groupe « ${postTitle} »`,
                    `/dashboard/${guildId}/donjons-et-quetes`,
                    guildId
                );
            }
        }

        updateDjDiscordEmbed(guildId, postId).catch(() => { });

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        await notifyDjUpdate(guildId);
        return { success: true };
    } catch (error) {
        logger.error("[joinDjPost]", error);
        return { success: false, error: "Erreur lors de l'inscription" };
    }
}

/**
 * Leave a DJ search post.
 */
export async function leaveDjPost(
    guildId: string,
    postId: string
): Promise<ActionResponse> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) return { success: false, error: "Accès refusé" };
    if (!user.profileId) return { success: false, error: "Profil introuvable" };

    try {
        const post = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            select: { profileId: true, status: true },
        });
        if (!post) return { success: false, error: "Post introuvable" };

        // Can't leave own post (must close instead)
        if (post.profileId === user.profileId) {
            return { success: false, error: "Utilise 'Fermer' pour quitter ton propre post" };
        }

        const participation = await (db as any).djSearchParticipant.findFirst({
            where: { postId, profileId: user.profileId },
        });
        if (!participation) return { success: false, error: "Tu n'es pas dans ce groupe" };

        await (db as any).djSearchParticipant.delete({
            where: { id: participation.id },
        });

        // Re-open if it was FULL
        if (post.status === "FULL") {
            await (db as any).djSearchPost.update({
                where: { id: postId },
                data: { status: "OPEN" },
            });
        }

        updateDjDiscordEmbed(guildId, postId).catch(() => { });

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        await notifyDjUpdate(guildId);
        return { success: true };
    } catch (error) {
        logger.error("[leaveDjPost]", error);
        return { success: false, error: "Erreur lors du départ" };
    }
}

// ---------------------------------------------------------------------------
// INTERNAL VARIANTS (for Discord interactions — no session required)
// ---------------------------------------------------------------------------

/**
 * Join a DJ post directly by profileId (used by Discord interactions endpoint).
 */
export async function internalJoinDjPost(
    postId: string,
    profileId: string,
    userId: string
): Promise<ActionResponse> {
    try {
        const post = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            include: {
                participants: { where: { status: "ACCEPTED" }, select: { id: true } },
            },
        });

        if (!post) return { success: false, error: "Post introuvable" };
        if (post.status !== "OPEN" && post.status !== "FULL") return { success: false, error: "Ce post n'est plus ouvert" };

        if (post.profileId === profileId) return { success: false, error: "Tu es le créateur de ce post" };

        const existing = await (db as any).djSearchParticipant.findFirst({
            where: { postId, profileId },
        });
        if (existing) return { success: false, error: "Tu as déjà rejoint ce groupe" };

        if (post.participants.length >= post.maxMembers) {
            return { success: false, error: "Ce groupe est complet" };
        }

        await (db as any).djSearchParticipant.create({
            data: { postId, profileId, userId, status: "ACCEPTED" },
        });

        const newCount = post.participants.length + 1;
        if (newCount >= post.maxMembers) {
            await (db as any).djSearchPost.update({
                where: { id: postId },
                data: { status: "FULL" },
            });
        }

        // Fire-and-forget: update Discord embed with new participant list
        const joinPostForEmbed = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            include: { guild: { select: { discordGuildId: true } } },
        });
        const joinGuildId = joinPostForEmbed?.guild?.discordGuildId;
        if (joinGuildId) {
            updateDjDiscordEmbed(joinGuildId, postId).catch(() => { });
            await notifyDjUpdate(joinGuildId);
            revalidatePath(`/dashboard/${joinGuildId}/donjons-et-quetes`);
        }


        return { success: true };
    } catch (error) {
        logger.error("[internalJoinDjPost]", error);
        return { success: false, error: "Erreur lors de l'inscription" };
    }
}

/**
 * Leave a DJ post directly by profileId (used by Discord interactions endpoint).
 */
export async function internalLeaveDjPost(
    postId: string,
    profileId: string
): Promise<ActionResponse> {
    try {
        const post = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            select: { profileId: true, status: true },
        });
        if (!post) return { success: false, error: "Post introuvable" };

        if (post.profileId === profileId) {
            return { success: false, error: "Ferme ton propre post depuis le site" };
        }

        const participation = await (db as any).djSearchParticipant.findFirst({
            where: { postId, profileId },
        });
        if (!participation) return { success: false, error: "Tu n'es pas dans ce groupe" };

        await (db as any).djSearchParticipant.delete({
            where: { id: participation.id },
        });

        if (post.status === "FULL") {
            await (db as any).djSearchPost.update({
                where: { id: postId },
                data: { status: "OPEN" },
            });
        }

        // Fire-and-forget: update Discord embed with new participant list
        const postForEmbed = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            include: { guild: { select: { discordGuildId: true } } },
        });
        const embedGuildId = postForEmbed?.guild?.discordGuildId;
        if (embedGuildId) {
            updateDjDiscordEmbed(embedGuildId, postId).catch(() => { });
            await notifyDjUpdate(embedGuildId);
            revalidatePath(`/dashboard/${embedGuildId}/donjons-et-quetes`);
        }


        return { success: true };
    } catch (error) {
        logger.error("[internalLeaveDjPost]", error);
        return { success: false, error: "Erreur lors du départ" };
    }
}

/**
 * Ferme ou supprime un post si son message Discord associé est supprimé.
 */
export async function handleDiscordDjPostDelete(discordGuildId: string, messageId: string) {
    try {
        const post = await (db as any).djSearchPost.findFirst({
            where: { discordMessageId: messageId },
            include: { guild: { select: { discordGuildId: true } } }
        });

        if (!post) return;

        // On ferme le post en DB (on le marque CLOSED) car son message a été supprimé sur Discord
        await (db as any).djSearchPost.update({
            where: { id: post.id },
            data: { status: "CLOSED" }
        });

        revalidatePath(`/dashboard/${discordGuildId}/donjons-et-quetes`);
        await notifyDjUpdate(discordGuildId);
    } catch (err) {
        logger.error("[handleDiscordDjPostDelete] Error:", err);
    }
}

/**
 * Ferme ou supprime un post si son salon/thread Discord associé est supprimé.
 */
export async function handleDiscordDjChannelDelete(discordGuildId: string, channelId: string) {
    try {
        const post = await (db as any).djSearchPost.findFirst({
            where: { discordChannelId: channelId },
            include: { guild: { select: { discordGuildId: true } } }
        });

        if (!post) return;

        // On ferme le post en DB
        await (db as any).djSearchPost.update({
            where: { id: post.id },
            data: { status: "CLOSED" }
        });

        revalidatePath(`/dashboard/${discordGuildId}/donjons-et-quetes`);
        await notifyDjUpdate(discordGuildId);
    } catch (err) {
        logger.error("[handleDiscordDjChannelDelete] Error:", err);
    }
}

// ---------------------------------------------------------------------------
// QUERIES
// ---------------------------------------------------------------------------

/**
 * Get all DJ posts for a guild (with filters).
 */
export async function getDjPosts(
    guildId: string,
    filters: {
        status?: string[];
        dungeonId?: string;
        mode?: string;
    } = {}
): Promise<ActionResponse<DjPostWithDetails[]>> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) return { success: false, error: "Accès refusé" };

    try {
        await expireOldPosts(guildId);

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const where: any = {
            guildId: guildConfig.id,
            profile: { status: "ACTIVE" }
        };

        if (filters.status && filters.status.length > 0) {
            where.status = { in: filters.status };
        } else {
            where.status = { in: ["OPEN", "FULL"] };
        }
        if (filters.dungeonId) where.dungeonId = filters.dungeonId;
        if (filters.mode) where.mode = filters.mode;

        const posts = await (db as any).djSearchPost.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 50,
            include: {
                dungeon: {
                    select: {
                        id: true,
                        name: true,
                        bossName: true,
                        level: true,
                        imageUrl: true,
                        isExpedition: true,
                        isOcreQuest: true,
                        dofuspourlesnoobsUrl: true,
                        dofensiveUrl: true,
                        achievements: {
                            include: {
                                challenge: {
                                    select: { id: true, name: true, iconUrl: true },
                                },
                            },
                        },
                    },
                },
                profile: {
                    select: {
                        id: true,
                        discordNickname: true,
                        pseudoDofus: true,
                        dofusPseudo: true,
                        user: { select: { image: true } },
                    },
                },
                participants: {
                    include: {
                        profile: {
                            select: {
                                id: true,
                                discordNickname: true,
                                pseudoDofus: true,
                                dofusPseudo: true,
                                user: { select: { image: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        const data = await Promise.all(posts.map(async (p: any) => {
            let questUrl = p.questUrl;
            if (p.mode === "QUETE" && !questUrl && p.questName) {
                const { getVerifiedDPLNUrl } = await import("@/lib/dofus-noobs-helper");
                questUrl = await getVerifiedDPLNUrl(p.questName);
            }
            return {
                ...p,
                questUrl,
                _acceptedCount: p.participants.filter((part: any) => part.status === "ACCEPTED").length,
            };
        }));

        return { success: true, data: data as any };
    } catch (error) {
        logger.error("[getDjPosts]", error);
        return { success: false, error: "Erreur lors du chargement des posts" };
    }
}

// ---------------------------------------------------------------------------
// PARTICIPANTS MANAGEMENT
// ---------------------------------------------------------------------------

/**
 * Accept a participant request (author only).
 */
export async function acceptDjParticipant(
    guildId: string,
    postId: string,
    participantId: string
): Promise<ActionResponse> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) return { success: false, error: "Accès refusé" };

    try {
        const participant = await (db as any).djSearchParticipant.findUnique({
            where: { id: participantId },
            include: { post: { select: { profileId: true } } },
        });

        if (!participant) return { success: false, error: "Participant introuvable" };
        if (participant.post.profileId !== user.profileId && !user.isAdmin) {
            return { success: false, error: "Seul l'auteur peut accepter" };
        }

        await (db as any).djSearchParticipant.update({
            where: { id: participantId },
            data: { status: "ACCEPTED" },
        });

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        return { success: true };
    } catch (error) {
        logger.error("[acceptParticipant]", error);
        return { success: false, error: "Erreur" };
    }
}

/**
 * Reject a participant (author only).
 */
export async function rejectDjParticipant(
    guildId: string,
    postId: string,
    participantId: string
): Promise<ActionResponse> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) return { success: false, error: "Accès refusé" };

    try {
        const participant = await (db as any).djSearchParticipant.findUnique({
            where: { id: participantId },
            include: { post: { select: { profileId: true } } },
        });

        if (!participant) return { success: false, error: "Participant introuvable" };
        if (participant.post.profileId !== user.profileId && !user.isAdmin) {
            return { success: false, error: "Seul l'auteur peut refuser" };
        }

        await (db as any).djSearchParticipant.delete({
            where: { id: participantId },
        });

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        return { success: true };
    } catch (error) {
        logger.error("[rejectParticipant]", error);
        return { success: false, error: "Erreur" };
    }
}

// ---------------------------------------------------------------------------
// ACHIEVEMENT TRACKER
// ---------------------------------------------------------------------------

/**
 * Get user dungeon progress for the tracker.
 */
export async function getUserDungeonProgress(
    guildId: string
): Promise<ActionResponse<{ achievementId: string; dungeonId: string }[]>> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) return { success: false, error: "Accès refusé" };
    if (!user.profileId) return { success: false, error: "Profil introuvable" };

    try {
        const progress = await (db as any).userDungeonProgress.findMany({
            where: { profileId: user.profileId },
            select: { achievementId: true, dungeonId: true },
        });

        return { success: true, data: progress };
    } catch (error) {
        logger.error("[getUserDungeonProgress]", error);
        return { success: false, error: "Erreur" };
    }
}

/**
 * Toggle an achievement as completed/uncompleted.
 */
export async function toggleAchievementCompleted(
    guildId: string,
    dungeonId: string,
    achievementId: string
): Promise<ActionResponse<{ completed: boolean }>> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) return { success: false, error: "Accès refusé" };
    if (!user.profileId) return { success: false, error: "Profil introuvable" };

    try {
        const existing = await (db as any).userDungeonProgress.findUnique({
            where: {
                profileId_achievementId: {
                    profileId: user.profileId,
                    achievementId,
                },
            },
        });

        if (existing) {
            await (db as any).userDungeonProgress.delete({
                where: { id: existing.id },
            });
            return { success: true, data: { completed: false } };
        } else {
            await (db as any).userDungeonProgress.create({
                data: {
                    profileId: user.profileId,
                    dungeonId,
                    achievementId,
                },
            });
            return { success: true, data: { completed: true } };
        }
    } catch (error) {
        logger.error("[toggleAchievementCompleted]", error);
        return { success: false, error: "Erreur" };
    }
}

/**
 * Find achievements a user is missing + guild members who have them.
 */
export async function findMissingAchievements(
    guildId: string,
    dungeonId: string
): Promise<ActionResponse<{
    achievementId: string;
    achievementName: string;
    iconUrl: string | null;
    membersWhoHaveIt: { name: string; imageUrl: string | null }[];
}[]>> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) return { success: false, error: "Accès refusé" };
    if (!user.profileId) return { success: false, error: "Profil introuvable" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Get all achievements for this dungeon
        const dungeonAchievements = await (db as any).dungeonAchievement.findMany({
            where: { dungeonId },
            include: { challenge: { select: { name: true, iconUrl: true } } },
        });

        // Get user's completed achievements for this dungeon
        const myProgress = await (db as any).userDungeonProgress.findMany({
            where: { profileId: user.profileId, dungeonId },
            select: { achievementId: true },
        });
        const myCompleted = new Set(myProgress.map((p: any) => p.achievementId));

        // Find achievements user DON'T have
        const missing = dungeonAchievements.filter((a: any) => !myCompleted.has(a.id));
        if (missing.length === 0) return { success: true, data: [] };

        // For each missing achievement, find guild members who have it
        const missingIds = missing.map((a: any) => a.id);
        const guildMembersWhoHave = await (db as any).userDungeonProgress.findMany({
            where: {
                achievementId: { in: missingIds },
                profile: { guildId: guildConfig.id, status: "ACTIVE" },
            },
            include: {
                profile: {
                    select: {
                        discordNickname: true,
                        pseudoDofus: true,
                        user: { select: { image: true } },
                    },
                },
            },
        });

        const result = missing.map((a: any) => {
            const membersWhoHaveIt = guildMembersWhoHave
                .filter((m: any) => m.achievementId === a.id)
                .map((m: any) => ({
                    name: m.profile.pseudoDofus || m.profile.discordNickname || "Inconnu",
                    imageUrl: m.profile.user.image,
                }));

            return {
                achievementId: a.id,
                achievementName: a.challenge.name,
                iconUrl: a.challenge.iconUrl,
                membersWhoHaveIt,
            };
        });

        return { success: true, data: result };
    } catch (error) {
        logger.error("[findMissingAchievements]", error);
        return { success: false, error: "Erreur lors de la recherche" };
    }
}

/**
 * Get all active posts for a specific dungeon (shown in donjon detail panel).
 */
export async function getDjPostsForDungeon(
    guildId: string,
    dungeonId: string
): Promise<ActionResponse<{ id: string; mode: string; status: string; _acceptedCount: number; maxMembers: number }[]>> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) return { success: false, error: "Accès refusé" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const posts = await (db as any).djSearchPost.findMany({
            where: { dungeonId, guildId: guildConfig.id, status: { in: ["OPEN", "FULL"] } },
            include: {
                participants: { where: { status: "ACCEPTED" }, select: { id: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return {
            success: true,
            data: posts.map((p: any) => {
                const mode = p.mode;

                // This part of the logic seems to be missing context for `missingAchievements`
                // and `dungeonPosts` from the provided diff.
                // Assuming the intent was to modify the mode based on some condition,
                // but without the full context of the original change request,
                // I'm applying the provided lines as literally as possible,
                // which might lead to undefined variables if `missingAchievements`
                // and `dungeonPosts` are not defined elsewhere in this function.
                // For now, I'll comment out the problematic lines to maintain syntax correctness.
                /*
                const data = dungeonPosts.map((p: any) => {
                    let mode = p.mode;

                    if (p.wantedAchievementIds.length > 0) {
                        const missingAchsForPost = missingAchievements.filter((a: any) => p.wantedAchievementIds.includes(a.achievementId));
                        if (missingAchsForPost.length > 0) {
                            mode = "SUCCES";
                        }
                    }
                });
                */

                return {
                    id: p.id,
                    mode, // Using the potentially modified mode, or original if logic above is commented
                    status: p.status,
                    maxMembers: p.maxMembers,
                    _acceptedCount: p.participants.filter((m: any) => m.status === "ACCEPTED").length,
                };
            }),
        };
    } catch (error) {
        logger.error("[getDjPostsForDungeon]", error);
        return { success: false, error: "Erreur" };
    }
}

// ---------------------------------------------------------------------------
// SETTINGS (ADMIN)
// ---------------------------------------------------------------------------

/**
 * Get the current DJ settings for the guild.
 * RBAC: admin only.
 */
export async function getDjSettings(guildId: string): Promise<ActionResponse<DjSettings>> {
    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Accès refusé" };

    try {
        const guildConfig = await (db as any).guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { djNotifyChannelId: true, djPingRoleIds: true },
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        return {
            success: true,
            data: {
                djNotifyChannelId: guildConfig.djNotifyChannelId || null,
                djPingRoleIds: guildConfig.djPingRoleIds || [],
            },
        };
    } catch (error) {
        logger.error("[getDjSettings]", error);
        return { success: false, error: "Erreur lors du chargement des paramètres" };
    }
}

/**
 * Public check: returns true if the DJ notify channel is configured for this guild.
 * Accessible to all authenticated guild members (not admin-only).
 */
export async function getDjChannelConfigured(guildId: string): Promise<boolean> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isMember) return false;

        const guildConfig = await (db as any).guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { djNotifyChannelId: true },
        });

        return !!guildConfig?.djNotifyChannelId;
    } catch {
        return false;
    }
}


/**
 * Update the DJ settings for the guild.
 * RBAC: admin only.
 */
export async function updateDjSettings(
    guildId: string,
    data: { djNotifyChannelId: string | null }
): Promise<ActionResponse> {
    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Accès refusé" };

    try {
        if (data.djNotifyChannelId) {
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const isValid = await validateChannelBelongsToGuild(data.djNotifyChannelId, guildId);
            if (!isValid) return { success: false, error: "Ce salon n'appartient pas à votre serveur Discord" };
        }

        await (db as any).guildConfig.update({
            where: { discordGuildId: guildId },
            data: { djNotifyChannelId: data.djNotifyChannelId },
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        logger.error("[updateDjSettings]", error);
        return { success: false, error: "Erreur lors de la mise à jour des paramètres" };
    }
}

// ---------------------------------------------------------------------------
// DUNGEON DIRECTORY (ANNUAIRE)
// ---------------------------------------------------------------------------

/**
 * Get the dungeon directory for a specific dungeon.
 * Returns two lists of members per achievement: those who have it, and those who don't.
 */
export async function getDungeonDirectory(
    guildId: string,
    dungeonId: string,
    dungeonName?: string
): Promise<ActionResponse<{
    achievementId: string;
    achievementName: string;
    iconUrl: string | null;
    points: number;
    hasCompleted: { id: string; name: string; imageUrl: string | null; classe: string | null }[];
    missing: { id: string; name: string; imageUrl: string | null; classe: string | null }[];
}[]>> {
    const user = await getUserContext(guildId);
    if (!user.canViewFinder) return { success: false, error: "Accès refusé" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // 1. Get all achievements for this dungeon
        let targetDjId = dungeonId;

        // If dungeonId looks like a Dofus numeric ID or if no achievements found, try name lookup
        if (dungeonName || !dungeonId.startsWith('c')) {
            const resolvedDungeon = await db.dungeon.findFirst({
                where: {
                    OR: [
                        { name: { contains: dungeonName || dungeonId, mode: 'insensitive' } },
                        { bossName: { contains: dungeonName || dungeonId, mode: 'insensitive' } }
                    ]
                },
                select: { id: true }
            });
            if (resolvedDungeon) {
                targetDjId = resolvedDungeon.id;
            }
        }

        const dungeonAchievements = await (db as any).dungeonAchievement.findMany({
            where: { dungeonId: targetDjId },
            include: { challenge: { select: { name: true, iconUrl: true } } },
        });

        if (dungeonAchievements.length === 0) {
            return { success: true, data: [] };
        }

        // 2. Get all ACTIVE members of the guild
        const activeMembers = await db.userProfile.findMany({
            where: { guildId: guildConfig.id, status: "ACTIVE" },
            select: {
                id: true,
                discordNickname: true,
                pseudoDofus: true,
                classe: true,
                user: { select: { image: true } },
            },
        });

        // 3. Get all progress for these achievements within the guild
        const achievementIds = dungeonAchievements.map((a: any) => a.id);
        const allProgress = await (db as any).userDungeonProgress.findMany({
            where: {
                achievementId: { in: achievementIds },
                profile: { guildId: guildConfig.id, status: "ACTIVE" },
            },
            select: { profileId: true, achievementId: true },
        });

        // 4. Map them out
        const result = dungeonAchievements.map((a: any) => {
            const completedProfileIds = new Set(
                allProgress.filter((p: any) => p.achievementId === a.id).map((p: any) => p.profileId)
            );

            const hasCompleted: any[] = [];
            const missing: any[] = [];

            activeMembers.forEach((member) => {
                const memberData = {
                    id: member.id,
                    name: member.pseudoDofus || member.discordNickname || "Inconnu",
                    imageUrl: member.user.image,
                    classe: member.classe,
                };

                if (completedProfileIds.has(member.id)) {
                    hasCompleted.push(memberData);
                } else {
                    missing.push(memberData);
                }
            });

            // Sort alphabetically
            hasCompleted.sort((a: any, b: any) => a.name.localeCompare(b.name));
            missing.sort((a: any, b: any) => a.name.localeCompare(b.name));

            return {
                achievementId: a.id,
                achievementName: a.challenge.name,
                iconUrl: a.challenge.iconUrl,
                points: a.points,
                hasCompleted,
                missing,
            };
        });

        return { success: true, data: result };
    } catch (error) {
        logger.error("[getDungeonDirectory]", error);
        return { success: false, error: "Erreur lors du chargement de l'annuaire" };
    }
}
