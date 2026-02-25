"use server";

import { db } from "@/lib/prisma";
import { getUserContext, type ActionResponse } from "./user-actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
    status: string;
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
};

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
});

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

async function expireOldPosts(guildId: string) {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return;

        const expireDate = new Date();
        expireDate.setHours(expireDate.getHours() - 48);

        await (db as any).djSearchPost.updateMany({
            where: {
                guildId: guildConfig.id,
                status: { in: ["OPEN", "FULL"] },
                createdAt: { lt: expireDate },
            },
            data: { status: "EXPIRED" },
        });
    } catch (error) {
        console.error("[expireOldPosts]", error);
    }
}

async function sendDiscordNotification(
    guildId: string,
    postId: string,
    embed: any
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
        if (!channelRes.ok) { console.error(`[DJ Embed] Cannot fetch channel: ${channelRes.status}`); return; }
        const channelData = await channelRes.json();
        const isForumChannel = channelData.type === 15;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";

        const components = [{
            type: 1, components: [
                { type: 2, style: 1, label: "S'inscrire", emoji: { name: "⚔️" }, custom_id: `dj:join:${postId}` },
                { type: 2, style: 4, label: "Se désinscrire", emoji: { name: "🚪" }, custom_id: `dj:leave:${postId}` },
                { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: embed.url || `${appUrl}/dashboard/${guildId}/donjons-et-quetes` },
            ]
        }];

        let discordMessageId: string | null = null;
        let discordChannelId: string | null = null;

        if (isForumChannel) {
            const isDungeon = embed.title?.includes("⚔️");
            const contentName = embed.title
                ?.replace(/^[⚔️📜\s]+/, "")
                .replace(/Recherche de groupe\s?—\s?/i, "")
                .trim().substring(0, 80) || "Recherche de groupe";
            const placesField = embed.fields?.find((f: any) => f.name.includes("Places"));
            const placesTag = placesField ? ` [${placesField.value}]` : "";
            const threadTitle = `${isDungeon ? "⚔️" : "📜"} ${contentName}${placesTag}`.substring(0, 100);

            const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/threads`, {
                method: "POST",
                headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ name: threadTitle, message: { embeds: [embed], components }, auto_archive_duration: 1440 }),
            });
            if (res.ok) { const t = await res.json(); discordChannelId = t.id; discordMessageId = t.message?.id; }
            else { console.error("[DJ Embed] Forum thread error:", await res.json()); }
        } else {
            const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                method: "POST",
                headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ embeds: [embed], components }),
            });
            if (res.ok) { const m = await res.json(); discordChannelId = channelId; discordMessageId = m.id; }
            else { console.error("[DJ Embed] Text channel error:", await res.json()); }
        }

        if (discordChannelId && discordMessageId) {
            await (db as any).djSearchPost.update({
                where: { id: postId },
                data: { discordMessageId, discordChannelId },
            });
        }
    } catch (error) {
        console.error("[sendDiscordNotification]", error);
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
        const embed = buildPostEmbed(post, authorName, guildId, post.participants);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
        const isOpen = post.status === "OPEN" || post.status === "FULL";
        const components = isOpen ? [{
            type: 1, components: [
                { type: 2, style: 1, label: "S'inscrire", emoji: { name: "⚔️" }, custom_id: `dj:join:${postId}` },
                { type: 2, style: 4, label: "Se désinscrire", emoji: { name: "🚪" }, custom_id: `dj:leave:${postId}` },
                { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: `${appUrl}/dashboard/${guildId}/donjons-et-quetes` },
            ]
        }] : [{
            type: 1, components: [
                { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: `${appUrl}/dashboard/${guildId}/donjons-et-quetes` },
            ]
        }];
        const patchRes = await fetch(
            `https://discord.com/api/v10/channels/${post.discordChannelId}/messages/${post.discordMessageId}`,
            { method: "PATCH", headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [embed], components }) }
        );
        if (!patchRes.ok) console.error("[updateDjDiscordEmbed] PATCH failed:", patchRes.status);
    } catch (err) { console.error("[updateDjDiscordEmbed]", err); }
}

/**
 * Désactive l'embed (post fermé) : embed gris + thread forum archivé/verrouillé.
 */
async function disableDjDiscordEmbed(guildId: string, discordChannelId: string | null, discordMessageId: string | null) {
    if (!discordChannelId || !discordMessageId) return;
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return;
    try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
        await fetch(`https://discord.com/api/v10/channels/${discordChannelId}/messages/${discordMessageId}`, {
            method: "PATCH",
            headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                embeds: [{ title: "🔒 Recherche de groupe — Terminée", description: "Ce groupe a été fermé par son créateur.", color: 0x475569, footer: { text: "SigilOS — Donjons & Quêtes" }, timestamp: new Date().toISOString() }],
                components: [{ type: 1, components: [{ type: 2, style: 5, label: "Voir le dashboard", emoji: { name: "🔗" }, url: `${appUrl}/dashboard/${guildId}/donjons-et-quetes` }] }],
            }),
        });
        await fetch(`https://discord.com/api/v10/channels/${discordChannelId}`, {
            method: "PATCH",
            headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ archived: true, locked: true }),
        });
    } catch (error) { console.error("[disableDjDiscordEmbed]", error); }
}

/**
 * Supprime un message Discord ou un thread forum (détecte le type via API).
 */
async function deleteDiscordMessage(channelId: string, messageId: string) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return;
    try {
        const channelRes = await fetch(`https://discord.com/api/v10/channels/${channelId}`, { headers: { Authorization: `Bot ${token}` } });
        if (!channelRes.ok) return;
        const isThread = [10, 11, 12].includes((await channelRes.json()).type);
        if (isThread) {
            await fetch(`https://discord.com/api/v10/channels/${channelId}`, { method: "DELETE", headers: { Authorization: `Bot ${token}` } });
        } else {
            await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, { method: "DELETE", headers: { Authorization: `Bot ${token}` } });
        }
    } catch (error) { console.error("[deleteDiscordMessage]", error); }
}


function buildPostEmbed(post: any, authorName: string, guildId: string, acceptedParticipants: any[] = []) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
    const isDungeon = post.mode === "DONJON";
    const title = isDungeon
        ? `⚔️ Recherche de groupe — Donjon`
        : `📜 Recherche de groupe — Quête`;

    const fields: any[] = [];

    if (isDungeon && post.dungeon) {
        fields.push({ name: "📊 Niveau", value: `${post.dungeon.level}`, inline: true });
    }

    fields.push({ name: "👥 Places", value: `1/${post.maxMembers}`, inline: true });

    if (post.wantedAchievementIds.length > 0 && post.dungeon?.achievements) {
        const achNames = post.dungeon.achievements
            .filter((a: any) => post.wantedAchievementIds.includes(a.id))
            .map((a: any) => a.challenge.name)
            .join(", ");
        if (achNames) {
            fields.push({ name: "🏆 Succès visés", value: achNames });
        }
    }

    if (post.requiredClasses && post.requiredClasses.length > 0) {
        fields.push({ name: "🎭 Classes recherchées", value: post.requiredClasses.join(", ") });
    }

    if (post.targetDate) {
        const d = new Date(post.targetDate);
        fields.push({
            name: "\uD83D\uDCC5 Date prévue",
            value: d.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
            }),
        });
    }

    // Live participants list
    const acceptedParts = (post.participants ?? []).filter((p: any) => p.status === "ACCEPTED");
    const totalCount = acceptedParts.length + 1; // +1 for creator
    if (acceptedParts.length > 0) {
        const names = acceptedParts
            .map((p: any) => {
                const n = p.profile?.discordNickname || p.profile?.pseudoDofus || p.profile?.dofusPseudo || "Membre";
                return p.classe ? `${n} *(${p.classe})*` : n;
            })
            .join("\n");
        fields.push({ name: `\uD83D\uDC64 Membres (${totalCount}/${post.maxMembers})`, value: names });
    } else {
        fields.push({ name: `\uD83D\uDC64 Membres (1/${post.maxMembers})`, value: "En attente de joueurs\u2026" });
    }


    return {
        title,
        description: [
            isDungeon
                ? `🏰 **Donjon :** ${post.dungeon?.name || "Inconnu"}`
                : `📜 **Quête :** ${post.questName || "Inconnue"}`,
            `👤 **${authorName}** cherche des compagnons !`,
            post.message ? `\n💬 *${post.message}*` : "",
        ].filter(Boolean).join("\n"),
        color: isDungeon ? 0x818cf8 : 0x34d399,
        fields,
        // Discord requires a publicly accessible HTTPS URL for thumbnails.
        // Skip if appUrl is localhost (Discord cannot reach it).
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

    const data = parsed.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

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

        const post = await (db as any).djSearchPost.create({
            data: {
                guildId: guildConfig.id,
                profileId: user.profileId,
                mode: data.mode,
                dungeonId: data.dungeonId,
                questId: data.questId,
                questName: data.questName,
                questUrl: data.questUrl,
                wantedAchievementIds: data.wantedAchievementIds,
                maxMembers: data.maxMembers,
                message: data.message,
                targetDate: data.targetDate,
                requiredClasses: data.requiredClasses,
                isDiscordPublished: data.isDiscordPublished,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
        if (data.isDiscordPublished) {
            const authorName = user.name || "Membre";
            const embed = buildPostEmbed(post, authorName, guildId);
            await sendDiscordNotification(guildId, post.id, embed);
        }

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        return { success: true, data: { id: post.id } };
    } catch (error) {
        console.error("[createDjPost]", error);
        return { success: false, error: "Erreur lors de la création du post" };
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
            },
        });

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        return { success: true };
    } catch (error) {
        console.error("[updateDjPost]", error);
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
        console.error("[closeDjPostWithContributions]", error);
        return { success: false, error: "Erreur lors de la fermeture" };
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
        return { success: true };
    } catch (error) {
        console.error("[closeDjPost]", error);
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
            deleteDiscordMessage(post.discordChannelId, post.discordMessageId).catch(() => { });
        }

        await (db as any).djSearchPost.delete({
            where: { id: postId },
        });

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        return { success: true };
    } catch (error) {
        console.error("[deleteDjPost]", error);
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
            },
        });

        if (!post) return { success: false, error: "Post introuvable" };
        if (post.status !== "OPEN") return { success: false, error: "Ce post n'est plus ouvert" };

        // Already joined?
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

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        return { success: true };
    } catch (error) {
        console.error("[joinDjPost]", error);
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

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        return { success: true };
    } catch (error) {
        console.error("[leaveDjPost]", error);
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
            include: { guildConfig: { select: { discordGuildId: true } } },
        });
        const joinGuildId = joinPostForEmbed?.guildConfig?.discordGuildId;
        if (joinGuildId) updateDjDiscordEmbed(joinGuildId, postId).catch(() => { });

        return { success: true };
    } catch (error) {
        console.error("[internalJoinDjPost]", error);
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
            include: { guildConfig: { select: { discordGuildId: true } } },
        });
        const embedGuildId = postForEmbed?.guildConfig?.discordGuildId;
        if (embedGuildId) updateDjDiscordEmbed(embedGuildId, postId).catch(() => { });

        return { success: true };
    } catch (error) {
        console.error("[internalLeaveDjPost]", error);
        return { success: false, error: "Erreur lors du départ" };
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
                    include: {
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

        const data = posts.map((p: any) => ({
            ...p,
            _acceptedCount: p.participants.filter((part: any) => part.status === "ACCEPTED").length,
        }));

        return { success: true, data: data as any };
    } catch (error) {
        console.error("[getDjPosts]", error);
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
        console.error("[acceptParticipant]", error);
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
        console.error("[rejectParticipant]", error);
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
        console.error("[getUserDungeonProgress]", error);
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
        console.error("[toggleAchievementCompleted]", error);
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
        console.error("[findMissingAchievements]", error);
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
        console.error("[getDjPostsForDungeon]", error);
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
    const user = await getUserContext(guildId);
    if (!user.isAdmin) return { success: false, error: "Accès refusé" };

    try {
        const guildConfig = await (db as any).guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { djNotifyChannelId: true },
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        return { success: true, data: { djNotifyChannelId: guildConfig.djNotifyChannelId } };
    } catch (error) {
        console.error("[getDjSettings]", error);
        return { success: false, error: "Erreur lors du chargement des paramètres" };
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
    const user = await getUserContext(guildId);
    if (!user.isAdmin) return { success: false, error: "Accès refusé" };

    try {
        await (db as any).guildConfig.update({
            where: { discordGuildId: guildId },
            data: { djNotifyChannelId: data.djNotifyChannelId },
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        console.error("[updateDjSettings]", error);
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
    dungeonId: string
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
        const dungeonAchievements = await (db as any).dungeonAchievement.findMany({
            where: { dungeonId },
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
        console.error("[getDungeonDirectory]", error);
        return { success: false, error: "Erreur lors du chargement de l'annuaire" };
    }
}
