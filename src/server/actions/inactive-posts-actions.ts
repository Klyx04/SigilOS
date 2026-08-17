"use server";

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendChannelMessage, deleteChannelMessage, deleteChannel } from "@/server/discord";
import { createNotification } from "@/server/actions/notification-actions";
import { deleteDiscordRunEmbed } from "@/server/songes-service";

export interface InactivePostsConfig {
    inactivityDays: number;     // Jours d'inactivité avant premier rappel / entre rappels (défaut: 3)
    maxReminders: number;       // Nombre de rappels avant suppression (défaut: 3)
}

const DEFAULT_CONFIG: InactivePostsConfig = {
    inactivityDays: 3,
    maxReminders: 3,
};

const INACTIVITY_SCHEDULE_DAYS = [7, 15, 20] as const;

/**
 * Récupère le Discord ID associé à un userId.
 */
async function getDiscordIdByUserId(userId: string): Promise<string | null> {
    const account = await db.account.findFirst({
        where: { userId, provider: "discord" },
        select: { providerAccountId: true },
    });
    return account?.providerAccountId || null;
}

/**
 * Nettoie l'embed / thread Discord d'un post DJ / Quête.
 */
async function cleanDjDiscordEmbed(guildDiscordId: string, channelId: string | null, messageId: string | null) {
    if (!channelId || !messageId) return;
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildDiscordId },
            select: { djNotifyChannelId: true },
        });

        if (guildConfig?.djNotifyChannelId && channelId !== guildConfig.djNotifyChannelId) {
            await deleteChannel(channelId);
        } else {
            await deleteChannelMessage(channelId, messageId);
        }
    } catch (err) {
        logger.error("[cleanDjDiscordEmbed] Erreur lors du nettoyage Discord:", { error: err });
    }
}

/**
 * #107 — Traite les relances automatiques et la clôture des posts DJ / Quêtes / Songes inactifs.
 * 
 * Calendrier progressif (#107) :
 * - J+7  : Rappel 1/3
 * - J+15 : Rappel 2/3
 * - J+20 : Rappel 3/3 (Ultime rappel)
 * - J+21 : Clôture définitive du post + suppression embed/thread Discord + notification SigilOS.
 */
export async function processInactivePostsRemindersAndAutoClose(): Promise<{
    success: boolean;
    djRemindersSent: number;
    djPostsClosed: number;
    songesRemindersSent: number;
    songesRunsClosed: number;
    error?: string;
}> {
    const now = new Date();

    let djRemindersSent = 0;
    let djPostsClosed = 0;
    let songesRemindersSent = 0;
    let songesRunsClosed = 0;

    try {
        // ─────────────────────────────────────────────────────────────────────
        // 1. DJ / QUÊTES (DjSearchPost)
        // ─────────────────────────────────────────────────────────────────────
        const openDjPosts = await (db as any).djSearchPost.findMany({
            where: {
                status: { in: ["OPEN", "FULL"] },
            },
            include: {
                guild: { select: { id: true, discordGuildId: true, name: true } },
                profile: {
                    select: {
                        id: true,
                        userId: true,
                        discordNickname: true,
                        pseudoDofus: true,
                        status: true,
                    },
                },
                dungeon: { select: { name: true } },
            },
        });

        for (const post of openDjPosts) {
            // Si le profil créateur est banni / archivé, le post doit être clos immédiatement
            if (post.profile.status !== "ACTIVE") {
                await (db as any).djSearchPost.update({
                    where: { id: post.id },
                    data: { status: "CLOSED", closedAt: now },
                });
                await cleanDjDiscordEmbed(post.guild.discordGuildId, post.discordChannelId, post.discordMessageId);
                djPostsClosed++;
                continue;
            }

            const lastUpdate = post.updatedAt || post.createdAt;
            const daysSinceUpdate = Math.floor((now.getTime() - new Date(lastUpdate).getTime()) / (24 * 60 * 60 * 1000));
            const hoursSinceLastReminder = post.lastReminderAt
                ? (now.getTime() - new Date(post.lastReminderAt).getTime()) / (3600 * 1000)
                : Infinity;

            const existingRemindersCount = (post.dungeonsJson as any)?._autoReminderCount ?? 0;
            const authorDiscordId = await getDiscordIdByUserId(post.profile.userId);
            const authorMention = authorDiscordId ? `<@${authorDiscordId}>` : post.profile.discordNickname || "Créateur";
            const postTitle = post.questName || post.dungeon?.name || "Groupe Donjon/Quête";

            // Seuil 1 : J+7 (Rappel 1)
            if (existingRemindersCount === 0 && daysSinceUpdate >= 7) {
                if (post.discordChannelId) {
                    const reminderMsg = `⏳ **Rappel 1/3 d'inactivité (J+7)** — ${authorMention}, ton annonce pour **${postTitle}** n'a pas eu d'activité depuis 7 jours. Est-elle toujours d'actualité ?`;
                    await sendChannelMessage(post.discordChannelId, reminderMsg).catch(() => "");
                }

                const currentDungeonsJson = (post.dungeonsJson && typeof post.dungeonsJson === "object") ? post.dungeonsJson : {};
                await (db as any).djSearchPost.update({
                    where: { id: post.id },
                    data: {
                        lastReminderAt: now,
                        dungeonsJson: {
                            ...(Array.isArray(post.dungeonsJson) ? { _items: post.dungeonsJson } : currentDungeonsJson),
                            _autoReminderCount: 1,
                        },
                    },
                });

                djRemindersSent++;
            }
            // Seuil 2 : J+15 (Rappel 2)
            else if (existingRemindersCount === 1 && daysSinceUpdate >= 15 && hoursSinceLastReminder >= 24) {
                if (post.discordChannelId) {
                    const reminderMsg = `⏳ **Rappel 2/3 d'inactivité (J+15)** — ${authorMention}, ton annonce pour **${postTitle}** est sans activité depuis 15 jours. Peux-tu confirmer si le groupe est maintenu ?`;
                    await sendChannelMessage(post.discordChannelId, reminderMsg).catch(() => "");
                }

                const currentDungeonsJson = (post.dungeonsJson && typeof post.dungeonsJson === "object") ? post.dungeonsJson : {};
                await (db as any).djSearchPost.update({
                    where: { id: post.id },
                    data: {
                        lastReminderAt: now,
                        dungeonsJson: {
                            ...(Array.isArray(post.dungeonsJson) ? { _items: post.dungeonsJson } : currentDungeonsJson),
                            _autoReminderCount: 2,
                        },
                    },
                });

                djRemindersSent++;
            }
            // Seuil 3 : J+20 (Rappel 3 - Ultime)
            else if (existingRemindersCount === 2 && daysSinceUpdate >= 20 && hoursSinceLastReminder >= 24) {
                if (post.discordChannelId) {
                    const reminderMsg = `⚠️ **DERNIER RAPPEL 3/3 (J+20)** — ${authorMention}, ton annonce pour **${postTitle}** est inactive depuis 20 jours. Sans interaction sous 24h, elle sera clôturée et supprimée définitivement.`;
                    await sendChannelMessage(post.discordChannelId, reminderMsg).catch(() => "");
                }

                const currentDungeonsJson = (post.dungeonsJson && typeof post.dungeonsJson === "object") ? post.dungeonsJson : {};
                await (db as any).djSearchPost.update({
                    where: { id: post.id },
                    data: {
                        lastReminderAt: now,
                        dungeonsJson: {
                            ...(Array.isArray(post.dungeonsJson) ? { _items: post.dungeonsJson } : currentDungeonsJson),
                            _autoReminderCount: 3,
                        },
                    },
                });

                djRemindersSent++;
            }
            // Clôture définitive : >= J+21 et 3 rappels passés (ou 24h après le rappel 3)
            else if (existingRemindersCount >= 3 && (daysSinceUpdate >= 21 || hoursSinceLastReminder >= 24)) {
                await (db as any).djSearchPost.update({
                    where: { id: post.id },
                    data: { status: "CLOSED", closedAt: now },
                });

                await cleanDjDiscordEmbed(post.guild.discordGuildId, post.discordChannelId, post.discordMessageId);

                await createNotification(
                    post.profile.userId,
                    "SYSTEM_INFO",
                    "Post DJ/Quête clôturé",
                    `Ton annonce **${postTitle}** a été clôturée automatiquement après 20 jours sans activité.`,
                    `/dashboard/${post.guild.discordGuildId}/donjons-et-quetes`,
                    post.guild.discordGuildId
                ).catch(() => {});

                djPostsClosed++;
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 2. SONGES (DreamRun)
        // ─────────────────────────────────────────────────────────────────────
        const recruitingRuns = await (db as any).dreamRun.findMany({
            where: {
                status: "RECRUITING",
            },
            include: {
                reminders: { select: { id: true, createdAt: true } },
            },
        });

        for (const run of recruitingRuns) {
            const guildConfig = await db.guildConfig.findFirst({
                where: { OR: [{ id: run.guildId }, { discordGuildId: run.guildId }] },
                select: { id: true, discordGuildId: true },
            });

            if (!guildConfig) continue;

            const lastUpdate = run.updatedAt || run.createdAt;
            const daysSinceUpdate = Math.floor((now.getTime() - new Date(lastUpdate).getTime()) / (24 * 60 * 60 * 1000));
            const hoursSinceLastReminder = run.lastReminderAt
                ? (now.getTime() - new Date(run.lastReminderAt).getTime()) / (3600 * 1000)
                : Infinity;

            const reminderCount = run.reminders?.length || 0;
            const leaderDiscordId = await getDiscordIdByUserId(run.leaderId);
            const leaderMention = leaderDiscordId ? `<@${leaderDiscordId}>` : "Chef de groupe";

            // Seuil 1 : J+7
            if (reminderCount === 0 && daysSinceUpdate >= 7) {
                if (run.discordChannelId) {
                    const reminderMsg = `⏳ **Rappel 1/3 Songes (J+7)** — ${leaderMention}, ton run Songes (${run.difficulty}) est sans activité depuis 7 jours. Est-il toujours ouvert ?`;
                    const sentMsgId = await sendChannelMessage(run.discordChannelId, reminderMsg).catch(() => "");
                    if (sentMsgId) {
                        await (db as any).dreamRunReminder.create({
                            data: {
                                runId: run.id,
                                discordChannelId: run.discordChannelId,
                                discordMessageId: sentMsgId,
                            },
                        }).catch(() => {});
                    }
                }
                await (db as any).dreamRun.update({
                    where: { id: run.id },
                    data: { lastReminderAt: now },
                });
                songesRemindersSent++;
            }
            // Seuil 2 : J+15
            else if (reminderCount === 1 && daysSinceUpdate >= 15 && hoursSinceLastReminder >= 24) {
                if (run.discordChannelId) {
                    const reminderMsg = `⏳ **Rappel 2/3 Songes (J+15)** — ${leaderMention}, ton run Songes (${run.difficulty}) est sans activité depuis 15 jours. Peux-tu confirmer s'il continue ?`;
                    const sentMsgId = await sendChannelMessage(run.discordChannelId, reminderMsg).catch(() => "");
                    if (sentMsgId) {
                        await (db as any).dreamRunReminder.create({
                            data: {
                                runId: run.id,
                                discordChannelId: run.discordChannelId,
                                discordMessageId: sentMsgId,
                            },
                        }).catch(() => {});
                    }
                }
                await (db as any).dreamRun.update({
                    where: { id: run.id },
                    data: { lastReminderAt: now },
                });
                songesRemindersSent++;
            }
            // Seuil 3 : J+20 (Ultime)
            else if (reminderCount === 2 && daysSinceUpdate >= 20 && hoursSinceLastReminder >= 24) {
                if (run.discordChannelId) {
                    const reminderMsg = `⚠️ **DERNIER RAPPEL 3/3 Songes (J+20)** — ${leaderMention}, ton run Songes (${run.difficulty}) est inactif depuis 20 jours. Sans interaction sous 24h, il sera clôturé et supprimé.`;
                    const sentMsgId = await sendChannelMessage(run.discordChannelId, reminderMsg).catch(() => "");
                    if (sentMsgId) {
                        await (db as any).dreamRunReminder.create({
                            data: {
                                runId: run.id,
                                discordChannelId: run.discordChannelId,
                                discordMessageId: sentMsgId,
                            },
                        }).catch(() => {});
                    }
                }
                await (db as any).dreamRun.update({
                    where: { id: run.id },
                    data: { lastReminderAt: now },
                });
                songesRemindersSent++;
            }
            // Clôture définitive : >= J+21 et 3 rappels passés (ou 24h après le rappel 3)
            else if (reminderCount >= 3 && (daysSinceUpdate >= 21 || hoursSinceLastReminder >= 24)) {
                await (db as any).dreamRun.update({
                    where: { id: run.id },
                    data: { status: "ABANDONED" },
                });

                await deleteDiscordRunEmbed(guildConfig.discordGuildId, run.id);

                await createNotification(
                    run.leaderId,
                    "SYSTEM_INFO",
                    "Run Songes expiré",
                    `Ton run Songes (${run.difficulty}) a été archivé automatiquement après 20 jours sans activité.`,
                    `/dashboard/${guildConfig.discordGuildId}/songes`,
                    guildConfig.discordGuildId
                ).catch(() => {});

                songesRunsClosed++;
            }
        }

        return {
            success: true,
            djRemindersSent,
            djPostsClosed,
            songesRemindersSent,
            songesRunsClosed,
        };
    } catch (error) {
        logger.error("[processInactivePostsRemindersAndAutoClose] Erreur générale:", { error });
        return {
            success: false,
            djRemindersSent,
            djPostsClosed,
            songesRemindersSent,
            songesRunsClosed,
            error: "Erreur lors du traitement des posts inactifs",
        };
    }
}
