"use server";

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/utils";
import { deleteChannelMessage, deleteChannel, sendChannelMessage } from "@/server/discord";
import { createNotification } from "@/server/actions/notification-actions";
import { abandonDreamRun, deleteDiscordRunEmbed } from "@/server/songes-service";
import { getMultiDungeons } from "@/lib/dungeon-finder-utils";
import { isStandByActive } from "@/lib/group-standby";
import { resolveSongesReminderStep, SONGES_CLOSE_AFTER_DAYS } from "@/lib/songes/run-status";

export interface InactivePostsConfig {
    inactivityDays: number;     // Jours d'inactivité avant premier rappel / entre rappels (défaut: 3)
    maxReminders: number;       // Nombre de rappels avant suppression (défaut: 3)
}

const DEFAULT_CONFIG: InactivePostsConfig = {
    inactivityDays: 3,
    maxReminders: 3,
};

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
    songesEmbedsPurged: number;
    error?: string;
}> {
    const now = new Date();

    let djRemindersSent = 0;
    let djPostsClosed = 0;
    let songesRemindersSent = 0;
    let songesRunsClosed = 0;
    let songesEmbedsPurged = 0;

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

            // Stand-by (30/10/2026) : un post volontairement suspendu ne reçoit ni relance
            // d'inactivité ni clôture J+21 — sinon la pause serait un piège à 21 jours.
            // Placé APRÈS le contrôle de statut du profil : un créateur banni/archivé ferme
            // son post même s'il l'avait mis en pause.
            if (isStandByActive(post.standBy)) {
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
            // Un post multi n'a ni `questName` ni `titanName` : sans ce repli, les trois rappels
            // d'inactivité parlaient d'un « Groupe Donjon/Quête » anonyme (mesure du 23/10/2026).
            const multiEntries = getMultiDungeons(post.dungeonsJson);
            const multiLabel = multiEntries.length > 0
                ? `${multiEntries.length} donjons (${multiEntries.slice(0, 3).map((e) => e.name).join(", ")}${multiEntries.length > 3 ? "…" : ""})`
                : null;
            const postTitle = post.questName || post.titanName || post.dungeon?.name || multiLabel || "Groupe Donjon/Quête";
            // Lien direct vers le module + jours restants avant clôture auto (J+21)
            const postLink = `${getAppBaseUrl()}/dashboard/${post.guild.discordGuildId}/donjons-et-quetes`;
            const daysLeft = Math.max(0, 21 - daysSinceUpdate);

            // Seuil 1 : J+7 (Rappel 1)
            if (existingRemindersCount === 0 && daysSinceUpdate >= 7) {
                if (post.discordChannelId) {
                    const reminderMsg = `⏳ **Rappel 1/3 d'inactivité (J+7)** — ${authorMention}, ton annonce pour **${postTitle}** n'a pas eu d'activité depuis 7 jours. Si elle n'est plus d'actualité, clôture-la : [tableau de bord](${postLink}). Sinon, clôture automatique dans ${daysLeft} jours (J+21).`;
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

                await createNotification(
                    post.profile.userId,
                    "SYSTEM_INFO",
                    "Rappel Sortie Donjon/Quête",
                    `Ton annonce **${postTitle}** est inactive depuis 7 jours. Clôture-la si elle n'est plus d'actualité, sinon clôture automatique dans ${daysLeft} jours.`,
                    `/dashboard/${post.guild.discordGuildId}/donjons-et-quetes`,
                    post.guild.discordGuildId
                ).catch(() => {});

                djRemindersSent++;
            }
            // Seuil 2 : J+15 (Rappel 2)
            else if (existingRemindersCount === 1 && daysSinceUpdate >= 15 && hoursSinceLastReminder >= 24) {
                if (post.discordChannelId) {
                    const reminderMsg = `⏳ **Rappel 2/3 d'inactivité (J+15)** — ${authorMention}, ton annonce pour **${postTitle}** est sans activité depuis 15 jours. Groupe maintenu ? Réagis sur l'annonce ou clôture-la : [tableau de bord](${postLink}). Clôture automatique dans ${daysLeft} jours.`;
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

                await createNotification(
                    post.profile.userId,
                    "SYSTEM_INFO",
                    "Rappel Sortie Donjon/Quête (2/3)",
                    `Ton annonce **${postTitle}** est sans activité depuis 15 jours. Clôture automatique dans ${daysLeft} jours sans interaction.`,
                    `/dashboard/${post.guild.discordGuildId}/donjons-et-quetes`,
                    post.guild.discordGuildId
                ).catch(() => {});

                djRemindersSent++;
            }
            // Seuil 3 : J+20 (Rappel 3 - Ultime)
            else if (existingRemindersCount === 2 && daysSinceUpdate >= 20 && hoursSinceLastReminder >= 24) {
                if (post.discordChannelId) {
                    const reminderMsg = `⚠️ **DERNIER RAPPEL 3/3 (J+20)** — ${authorMention}, ton annonce pour **${postTitle}** est inactive depuis 20 jours. Sans interaction sous 24h, elle sera clôturée et supprimée définitivement : [tableau de bord](${postLink}).`;
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

                await createNotification(
                    post.profile.userId,
                    "EVENT_REMINDER",
                    "⚠️ Dernier Rappel Avant Clôture",
                    `Ton annonce **${postTitle}** sera automatiquement clôturée sous 24h sans nouvelle interaction.`,
                    `/dashboard/${post.guild.discordGuildId}/donjons-et-quetes`,
                    post.guild.discordGuildId
                ).catch(() => {});

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
        // 2. SONGES (DreamRun) — calendrier UNIQUE : J+7 / J+15 / J+20 / J+21
        // ─────────────────────────────────────────────────────────────────────
        // `IN_PROGRESS` est inclus (05/11/2026) : le job `daily-cleanup` du worker
        // abandonnait ces runs à J+3 ; sans cette inclusion, elles ne seraient plus
        // jamais relancées ni clôturées après le retrait de ce job.
        const activeRuns = await (db as any).dreamRun.findMany({
            where: {
                status: { in: ["RECRUITING", "IN_PROGRESS"] },
            },
            include: {
                reminders: { select: { id: true, createdAt: true } },
                // L'activité réelle ne vit pas seulement sur `DreamRun.updatedAt` :
                // une candidature ou un étage terminé sont aussi des signes de vie.
                joinRequests: { take: 1, orderBy: { createdAt: "desc" }, select: { createdAt: true } },
                floors: { take: 1, orderBy: { completedAt: "desc" }, select: { completedAt: true } },
            },
        });

        for (const run of activeRuns) {
            const guildConfig = await db.guildConfig.findFirst({
                where: { OR: [{ id: run.guildId }, { discordGuildId: run.guildId }] },
                select: { id: true, discordGuildId: true },
            });

            if (!guildConfig) continue;

            // Stand-by : run suspendue → ni relance d'inactivité ni clôture J+21.
            if (isStandByActive(run.standBy)) {
                continue;
            }

            // Dernière activité RÉELLE — `updatedAt` seul ne suffit pas : chaque rappel
            // écrivait `lastReminderAt`, ce qui l'avançait et repoussait chaque palier.
            const lastActivityAt = Math.max(
                new Date(run.updatedAt || run.createdAt).getTime(),
                run.joinRequests?.[0]?.createdAt ? new Date(run.joinRequests[0].createdAt).getTime() : 0,
                run.floors?.[0]?.completedAt ? new Date(run.floors[0].completedAt).getTime() : 0,
            );
            const daysSinceUpdate = Math.floor((now.getTime() - lastActivityAt) / (24 * 60 * 60 * 1000));
            const hoursSinceLastReminder = run.lastReminderAt
                ? (now.getTime() - new Date(run.lastReminderAt).getTime()) / (3600 * 1000)
                : Infinity;

            const reminderCount = run.reminders?.length || 0;
            const leaderDiscordId = await getDiscordIdByUserId(run.leaderId);
            const leaderMention = leaderDiscordId ? `<@${leaderDiscordId}>` : "Chef de groupe";
            const runLink = `${getAppBaseUrl()}/dashboard/${guildConfig.discordGuildId}/songes`;
            const daysLeft = Math.max(0, SONGES_CLOSE_AFTER_DAYS - daysSinceUpdate);

            // Une seule règle décide (palier 1/2/3, clôture, ou rien) — jamais une cascade
            // de seuils recopiée dans deux fichiers : `src/lib/songes/run-status.ts`.
            const step = resolveSongesReminderStep({
                daysSinceActivity: daysSinceUpdate,
                reminderCount,
                hoursSinceLastReminder,
            });
            if (step === null) continue;

            // ── Clôture : trois rappels obligatoires puis J+21 (règle pure) ──────
            if (step === "close") {
                // `abandonDreamRun` porte la garde d'état ET la purge de l'embed : le
                // sujet de forum ne survit plus à la clôture (cause du post fantôme du
                // 29/10 — le worker abandonnait sans jamais rien supprimer).
                const closed = await abandonDreamRun(guildConfig.discordGuildId, run.id);
                if (!closed) continue;

                await createNotification(
                    run.leaderId,
                    "SYSTEM_INFO",
                    "Run Songes expiré",
                    `Ton run Songes (${run.difficulty}) a été archivé automatiquement après ${SONGES_CLOSE_AFTER_DAYS} jours sans activité.`,
                    `/dashboard/${guildConfig.discordGuildId}/songes`,
                    guildConfig.discordGuildId
                ).catch(() => {});

                songesRunsClosed++;
                continue;
            }

            // ── Rappels 1/3, 2/3, 3/3 ───────────────────────────────────────────
            const reminderMsg = step === 1
                ? `⏳ **Rappel 1/3 Songes (J+7)** — ${leaderMention}, ton run Songes (${run.difficulty}) est sans activité depuis 7 jours. S'il n'est plus d'actualité, clôture-le : [tableau de bord](${runLink}). Sinon, clôture automatique dans ${daysLeft} jours (J+21).`
                : step === 2
                    ? `⏳ **Rappel 2/3 Songes (J+15)** — ${leaderMention}, ton run Songes (${run.difficulty}) est sans activité depuis 15 jours. Continue ? Confirme ou clôture ici : [tableau de bord](${runLink}). Clôture automatique dans ${daysLeft} jours.`
                    : `⚠️ **DERNIER RAPPEL 3/3 Songes (J+20)** — ${leaderMention}, ton run Songes (${run.difficulty}) est inactif depuis 20 jours. Sans interaction sous 24h, il sera clôturé et supprimé : [tableau de bord](${runLink}).`;

            if (run.discordChannelId) {
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
                // `updatedAt` figé : un rappel n'est PAS une activité de la run.
                // Sans ça, chaque envoi repoussait le palier suivant de plusieurs jours.
                data: { lastReminderAt: now, updatedAt: run.updatedAt },
            });
            songesRemindersSent++;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 2 bis. RATTRAPAGE — posts Discord de runs closes restés en ligne
        // ─────────────────────────────────────────────────────────────────────
        // Une clôture manuelle, un meneur parti (`leaveDreamRun`) ou l'ancien job du
        // worker laissaient parfois le sujet de forum vivant : statut clos, embed intact,
        // boutons toujours cliquables. Cette passe bornée répare l'existant. Elle est
        // idempotente : `deleteDiscordRunEmbed` ne vide les références que si la
        // suppression a réellement réussi, donc un échec revient au passage suivant.
        const orphanEmbeds = await db.dreamRun.findMany({
            where: {
                status: { in: ["ABANDONED", "COMPLETED", "FAILED"] },
                discordChannelId: { not: null },
            },
            select: { id: true, guildId: true },
            take: 25,
        });
        for (const orphan of orphanEmbeds) {
            if (await deleteDiscordRunEmbed(orphan.guildId, orphan.id)) {
                songesEmbedsPurged++;
            }
        }

        return {
            success: true,
            djRemindersSent,
            djPostsClosed,
            songesRemindersSent,
            songesRunsClosed,
            songesEmbedsPurged,
        };
    } catch (error) {
        logger.error("[processInactivePostsRemindersAndAutoClose] Erreur générale:", { error });
        return {
            success: false,
            djRemindersSent,
            djPostsClosed,
            songesRemindersSent,
            songesRunsClosed,
            songesEmbedsPurged,
            error: "Erreur lors du traitement des posts inactifs",
        };
    }
}
