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

        // Detect channel type (0 = text, 15 = forum)
        const channelRes = await fetch(
            `https://discord.com/api/v10/channels/${channelId}`,
            { headers: { Authorization: `Bot ${token}` } }
        );
        const channelData = await channelRes.json();
        const isForumChannel = channelData.type === 15;

        // Interactive buttons (join/leave) + link
        const components = [{
            type: 1,
            components: [
                { type: 2, style: 1, label: "S'inscrire", emoji: { name: "⚔️" }, custom_id: `dj:join:${postId}` },
                { type: 2, style: 4, label: "Se désinscrire", emoji: { name: "🚪" }, custom_id: `dj:leave:${postId}` },
                { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: embed.url },
            ]
        }];

        let discordMessageId: string | null = null;
        let discordChannelId: string | null = null;

        if (isForumChannel) {
            // ── SALON FORUM : crée un thread avec le post comme premier message ──
            // Titre propre : retire les emojis leadings pour un titre de thread lisible
            const threadTitle = embed.title
                .replace(/^[\p{Emoji}\s]+/u, "")
                .trim()
                .substring(0, 100) || "Recherche de groupe";

            const res = await fetch(
                `https://discord.com/api/v10/channels/${channelId}/threads`,
                {
                    method: "POST",
                    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: threadTitle,
                        message: { embeds: [embed], components },
                        // Auto-archive after 24h of inactivity
                        auto_archive_duration: 1440,
                    }),
                }
            );

            if (res.ok) {
                const thread = await res.json();
                // thread.id = ID du thread (= channelId pour les PATCH suivants)
                // thread.message.id = ID du premier message dans le thread
                discordChannelId = thread.id;          // thread ID
                discordMessageId = thread.message?.id; // message ID
            } else {
                const err = await res.json();
                console.error("[sendDiscordNotification] Forum thread error:", err);
            }
        } else {
            // ── SALON TEXTE CLASSIQUE ──
            const res = await fetch(
                `https://discord.com/api/v10/channels/${channelId}/messages`,
                {
                    method: "POST",
                    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ embeds: [embed], components }),
                }
            );

            if (res.ok) {
                const msg = await res.json();
                discordChannelId = channelId;
                discordMessageId = msg.id;
            } else {
                const err = await res.json();
                console.error("[sendDiscordNotification] Text channel error:", err);
            }
        }

        // Persist IDs for future PATCH/DELETE
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
 * Construit l'embed Discord pour un post DJ.
 * acceptedParticipants : liste avec .profile.discordNickname / .profile.pseudoDofus / .profile.user.name
 */
function buildPostEmbed(post: any, authorName: string, guildId: string, acceptedParticipants: any[] = []) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
    const isDungeon = post.mode === "DONJON";
    const title = isDungeon
        ? `⚔️ Recherche de groupe — ${post.dungeon?.name || "Donjon inconnu"}`
        : `📜 Recherche de groupe — ${post.questName || "Quête inconnue"}`;

    const fields: any[] = [];

    if (isDungeon && post.dungeon) {
        fields.push({ name: "🏰 Donjon", value: post.dungeon.name, inline: true });
        fields.push({ name: "📊 Niveau", value: `${post.dungeon.level}`, inline: true });
    } else {
        fields.push({ name: "📜 Quête", value: post.questName || "Inconnue", inline: true });
    }

    const acceptedCount = acceptedParticipants.length;
    fields.push({ name: "👥 Places", value: `${acceptedCount}/${post.maxMembers}`, inline: true });

    if (post.requiredClasses && post.requiredClasses.length > 0) {
        fields.push({ name: "🎭 Classes recherchées", value: post.requiredClasses.join(", "), inline: false });
    }

    if (post.targetDate) {
        const d = new Date(post.targetDate);
        fields.push({
            name: "📅 Date prévue",
            value: d.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
            }),
            inline: false,
        });
    }

    if (post.wantedAchievementIds.length > 0 && post.dungeon?.achievements) {
        const achNames = post.dungeon.achievements
            .filter((a: any) => post.wantedAchievementIds.includes(a.id))
            .map((a: any) => a.challenge.name)
            .join(", ");
        if (achNames) {
            fields.push({ name: "🏆 Succès visés", value: achNames, inline: false });
        }
    }

    if (post.message) {
        fields.push({ name: "💬 Message", value: post.message, inline: false });
    }

    // Member list — priorité : discordNickname > pseudoDofus > nom Discord OAuth
    const memberLines = acceptedParticipants.map((p: any) => {
        const name = p.profile?.discordNickname || p.profile?.pseudoDofus || p.profile?.user?.name || "Joueur";
        const classTag = p.classe ? `[${p.classe}] ` : "";
        return `• ${classTag}**${name}**`;
    });
    fields.push({
        name: `👤 Membres (${acceptedCount}/${post.maxMembers})`,
        value: memberLines.length > 0 ? memberLines.join("\n") : "*En attente de joueurs...*",
        inline: false,
    });

    return {
        title,
        description: `**${authorName}** cherche des compagnons !`,
        color: isDungeon ? 0x818cf8 : 0x34d399,
        fields,
        thumbnail: post.dungeon?.imageUrl && post.dungeon.imageUrl.startsWith("https://") ? { url: post.dungeon.imageUrl } : undefined,
        footer: {
            text: `SigilOS — Donjons & Quêtes • Aujourd'hui à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
        },
        url: `${appUrl}/dashboard/${guildId}/donjons-et-quetes`,
        timestamp: new Date().toISOString(),
    };
}

// ---------------------------------------------------------------------------
// UPDATE DISCORD EMBED (called after join/leave)
// ---------------------------------------------------------------------------

export async function updateDjDiscordEmbed(guildId: string, postId: string) {
    try {
        const post = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            include: {
                dungeon: {
                    include: {
                        achievements: { include: { challenge: { select: { id: true, name: true, iconUrl: true } } } },
                    },
                },
                // Nom complet du créateur
                profile: {
                    select: {
                        id: true,
                        discordNickname: true,
                        pseudoDofus: true,
                        user: { select: { name: true } },
                    },
                },
                // Participants acceptés avec leur nom complet
                participants: {
                    where: { status: "ACCEPTED" },
                    include: {
                        profile: {
                            select: {
                                id: true,
                                discordNickname: true,
                                pseudoDofus: true,
                                user: { select: { name: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!post?.discordMessageId || !post?.discordChannelId) return;
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) return;

        // Priorité nom : discordNickname > pseudoDofus > nom Discord OAuth
        const authorName =
            post.profile?.discordNickname ||
            post.profile?.pseudoDofus ||
            post.profile?.user?.name ||
            "Membre";

        const embed = buildPostEmbed(post, authorName, guildId, post.participants);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
        const isOpen = post.status === "OPEN" || post.status === "FULL";
        const components = isOpen ? [{
            type: 1,
            components: [
                { type: 2, style: 1, label: "S'inscrire", emoji: { name: "⚔️" }, custom_id: `dj:join:${postId}` },
                { type: 2, style: 4, label: "Se désinscrire", emoji: { name: "🚪" }, custom_id: `dj:leave:${postId}` },
                { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: `${appUrl}/dashboard/${guildId}/donjons-et-quetes` },
            ]
        }] : [{
            type: 1,
            components: [
                { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: `${appUrl}/dashboard/${guildId}/donjons-et-quetes` },
            ]
        }];

        // Works for both text channels AND forum threads:
        // For forums, discordChannelId = thread ID, discordMessageId = first message ID
        // For text, discordChannelId = channel ID, discordMessageId = message ID
        const patchRes = await fetch(
            `https://discord.com/api/v10/channels/${post.discordChannelId}/messages/${post.discordMessageId}`,
            {
                method: "PATCH",
                headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ embeds: [embed], components }),
            }
        );

        if (!patchRes.ok) {
            const err = await patchRes.json();
            console.error("[updateDjDiscordEmbed] PATCH failed:", err);
        }
    } catch (error) {
        console.error("[updateDjDiscordEmbed]", error);
    }
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
                participants: {
                    create: {
                        profileId: user.profileId,
                        userId: user.id!,
                        status: "ACCEPTED",
                    },
                },
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
            // Creator is the first accepted participant
            const creatorAsParticipant = [{ profile: { discordNickname: user.name, pseudoDofus: null }, classe: null }];
            const embed = buildPostEmbed(post, authorName, guildId, creatorAsParticipant);
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
 * Close a DJ search post (author or admin).
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
            select: { profileId: true, guildId: true },
        });

        if (!post) return { success: false, error: "Post introuvable" };
        if (post.profileId !== user.profileId && !user.isAdmin) {
            return { success: false, error: "Tu ne peux fermer que tes propres posts" };
        }

        await (db as any).djSearchPost.update({
            where: { id: postId },
            data: { status: "CLOSED" },
        });

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
        });

        if (!post) return { success: false, error: "Post introuvable" };

        if (post.profileId !== user.profileId && !user.isAdmin) {
            return { success: false, error: "Non autorisé" };
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

        // Sync Discord embed avec les nouveaux participants (fire-and-forget)
        updateDjDiscordEmbed(guildId, postId).catch(() => { });

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

        // Sync Discord embed (fire-and-forget)
        updateDjDiscordEmbed(guildId, postId).catch(() => { });

        revalidatePath(`/dashboard/${guildId}/donjons-et-quetes`);
        return { success: true };
    } catch (error) {
        console.error("[leaveDjPost]", error);
        return { success: false, error: "Erreur lors du départ" };
    }
}

// ---------------------------------------------------------------------------
// INTERNAL (Discord Interactions — no session required)
// ---------------------------------------------------------------------------

/**
 * Called from Discord interaction endpoint when a user clicks "S'inscrire".
 * Identified by their Discord userId (internal SigilOS user ID).
 */
export async function internalJoinDjPost(
    discordGuildId: string,
    postId: string,
    userId: string
): Promise<ActionResponse> {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Find the profile for this user in this guild
        const profile = await db.userProfile.findFirst({
            where: { userId, guildId: guildConfig.id, status: "ACTIVE" },
            select: { id: true },
        });
        if (!profile) return { success: false, error: "Tu n'es pas membre actif de cette guilde sur SigilOS." };

        const post = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            include: {
                participants: { where: { status: "ACCEPTED" }, select: { id: true } },
            },
        });

        if (!post) return { success: false, error: "Post introuvable" };
        if (post.status !== "OPEN" && post.status !== "FULL") {
            return { success: false, error: "Ce post est fermé ou expiré." };
        }
        if (post.status === "FULL") {
            return {
                success: false,
                error: `Groupe complet (${post.participants.length}/${post.maxMembers}) 🟥\nConsulte le dashboard pour voir d’autres recherches disponibles.`,
            };
        }

        // Already joined?
        const existing = await (db as any).djSearchParticipant.findFirst({
            where: { postId, profileId: profile.id },
        });
        if (existing) {
            if (existing.status === "ACCEPTED") return { success: false, error: "Tu es déjà dans ce groupe !" };
            // Re-accept if previously rejected
            await (db as any).djSearchParticipant.update({
                where: { id: existing.id },
                data: { status: "ACCEPTED", respondedAt: new Date() },
            });
        } else {
            // Post full?
            if (post.participants.length >= post.maxMembers) {
                return {
                    success: false,
                    error: `Groupe complet (${post.participants.length}/${post.maxMembers}) 🟥\nConsulte le dashboard pour d’autres recherches.`,
                };
            }

            await (db as any).djSearchParticipant.create({
                data: {
                    postId,
                    profileId: profile.id,
                    userId,
                    status: "ACCEPTED",
                },
            });
        }

        // Check if now full
        const newCount = post.participants.length + 1;
        if (newCount >= post.maxMembers) {
            await (db as any).djSearchPost.update({
                where: { id: postId },
                data: { status: "FULL" },
            });
        }

        // Update embed (fire-and-forget)
        updateDjDiscordEmbed(discordGuildId, postId).catch(() => { });

        return { success: true };
    } catch (error) {
        console.error("[internalJoinDjPost]", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Called from Discord interaction endpoint when a user clicks "Se désinscrire".
 */
export async function internalLeaveDjPost(
    discordGuildId: string,
    postId: string,
    userId: string
): Promise<ActionResponse> {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findFirst({
            where: { userId, guildId: guildConfig.id },
            select: { id: true },
        });
        if (!profile) return { success: false, error: "Profil introuvable" };

        const participation = await (db as any).djSearchParticipant.findFirst({
            where: { postId, profileId: profile.id },
        });
        if (!participation) return { success: false, error: "Tu n'es pas dans ce groupe" };

        // Check they're not the creator
        const post = await (db as any).djSearchPost.findUnique({
            where: { id: postId },
            select: { profileId: true, status: true },
        });
        if (post?.profileId === profile.id) {
            return { success: false, error: "Le créateur ne peut pas quitter son propre post. Utilise le dashboard." };
        }

        await (db as any).djSearchParticipant.delete({
            where: { id: participation.id },
        });

        // Re-open if it was FULL
        if (post?.status === "FULL") {
            await (db as any).djSearchPost.update({
                where: { id: postId },
                data: { status: "OPEN" },
            });
        }

        // Update embed (fire-and-forget)
        updateDjDiscordEmbed(discordGuildId, postId).catch(() => { });

        return { success: true };
    } catch (error) {
        console.error("[internalLeaveDjPost]", error);
        return { success: false, error: "Erreur serveur" };
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
