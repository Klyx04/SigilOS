"use server";

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendChannelMessage, deleteChannelMessage } from "@/server/discord";
import { createNotification } from "@/server/actions/notification-actions";
import { ServiceRequestStatus, NotificationType, NotificationCategory } from "@prisma/client";

/**
 * 🔄 Nettoyage automatique des demandes de service sans réponse du passeur.
 *
 * Cible : les `ServiceRequest` restées en statut `PENDING` (aucune réponse du passeur).
 * Le « créateur de la demande » est le **client / demandeur** (celui qui a soumis la demande).
 *
 * Calendrier progressif (calqué sur `cleanup-inactive-posts`) :
 * - J+7  : rappel 1/2 au demandeur → « sera supprimée dans 14 jours »
 * - J+14 : rappel 2/2 au demandeur → « sera supprimée dans 7 jours »
 * - J+21 : clôture définitive (`CANCELLED`) + suppression de l'embed Discord + notification.
 */
const REMINDER_DAYS = [7, 14] as const;
const PURGE_DAYS = 21;

export interface InactiveServiceRequestsResult {
    remindersSent: number;
    requestsCancelled: number;
}

/**
 * Récupère le Discord ID (mention) associé à un userId.
 */
async function getDiscordIdByUserId(userId: string): Promise<string | null> {
    const account = await db.account.findFirst({
        where: { userId, provider: "discord" },
        select: { providerAccountId: true },
    });
    return account?.providerAccountId || null;
}
/**
 * Traite les rappels et la clôture automatique des demandes de service sans réponse.
 */
export async function processInactiveServiceRequests(): Promise<{
    success: boolean;
    remindersSent: number;
    requestsCancelled: number;
    error?: string;
}> {
    let remindersSent = 0;
    let requestsCancelled = 0;

    try {
        const now = new Date();

        const openRequests = await db.serviceRequest.findMany({
            where: { status: ServiceRequestStatus.PENDING },
            include: {
                guild: {
                    select: {
                        id: true,
                        discordGuildId: true,
                        servicesNotifyChannelId: true,
                    },
                },
                listing: { select: { title: true, category: true } },
                clientProfile: {
                    select: { userId: true, pseudoDofus: true, discordNickname: true },
                },
            },
        });

        for (const req of openRequests) {
            const daysSinceCreate = Math.floor(
                (now.getTime() - req.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            const channelId = req.guild?.servicesNotifyChannelId;
            const discordGuildId = req.guild?.discordGuildId;
            const listingTitle = req.listing?.title || "service";
            const clientLabel =
                req.clientProfile?.pseudoDofus || req.clientProfile?.discordNickname || "👤";

            // ── Clôture définitive : PENDING depuis >= PURGE_DAYS sans réponse ──
            if (daysSinceCreate >= PURGE_DAYS) {
                // Suppression de l'embed Discord de la demande (best-effort)
                if (channelId && req.discordMessageId) {
                    await deleteChannelMessage(channelId, req.discordMessageId).catch(() => {});
                }

                await db.serviceRequest.update({
                    where: { id: req.id },
                    data: { status: ServiceRequestStatus.CANCELLED },
                });

                if (discordGuildId) {
                    await createNotification(
                        req.clientUserId,
                        NotificationType.SERVICE_REPLY,
                        "❌ Demande de service supprimée",
                        `Ta demande pour « ${listingTitle} » est restée sans réponse du passeur depuis ${PURGE_DAYS} jours et a donc été supprimée. Tu peux refaire une demande quand tu veux.`,
                        `/dashboard/${discordGuildId}/services?tab=demandes`,
                        discordGuildId,
                        NotificationCategory.SYSTEM
                    ).catch(() => {});
                }

                requestsCancelled++;
                continue;
            }

            // ── Rappels progressifs (1 seul par palier, jamais en double grâce à reminderCount) ──
            const nextIndex = req.reminderCount;
            if (nextIndex < REMINDER_DAYS.length && daysSinceCreate >= REMINDER_DAYS[nextIndex]) {
                const remainingDays = PURGE_DAYS - REMINDER_DAYS[nextIndex];
                const isLast = nextIndex === REMINDER_DAYS.length - 1;
                const label = `Rappel ${nextIndex + 1}/${REMINDER_DAYS.length}`;

                // 1. Ping Discord du demandeur dans le canal des services
                if (channelId) {
                    const clientDiscordId = await getDiscordIdByUserId(req.clientUserId);
                    const mention = clientDiscordId ? `<@${clientDiscordId}>` : clientLabel;
                    const content = isLast
                        ? `⚠️ **DERNIER RAPPEL ${label} (J+${REMINDER_DAYS[nextIndex]})** — ${mention}, ta demande pour « ${listingTitle} » est sans réponse depuis ${REMINDER_DAYS[nextIndex]} jours. Sans réponse sous **${remainingDays} jours**, elle sera **supprimée automatiquement**.`
                        : `⚠️ **${label} (J+${REMINDER_DAYS[nextIndex]})** — ${mention}, ta demande pour « ${listingTitle} » est toujours sans réponse. Elle sera **supprimée automatiquement dans ${remainingDays} jours** si aucun passeur ne répond.`;
                    await sendChannelMessage(channelId, content).catch(() => {});
                }

                // 2. Notification Dashboard au demandeur
                if (discordGuildId) {
                    await createNotification(
                        req.clientUserId,
                        NotificationType.SERVICE_REPLY,
                        `⏳ ${isLast ? "Dernier rappel" : "Rappel"} avant suppression`,
                        `Ta demande pour « ${listingTitle} » sera supprimée dans ${remainingDays} jours si aucun passeur ne répond.`,
                        `/dashboard/${discordGuildId}/services?tab=demandes`,
                        discordGuildId,
                        NotificationCategory.SYSTEM
                    ).catch(() => {});
                }

                // 3. Trace du rappel pour éviter les doublons
                await db.serviceRequest.update({
                    where: { id: req.id },
                    data: {
                        reminderCount: nextIndex + 1,
                        lastReminderAt: now,
                    },
                });

                remindersSent++;
            }
        }

        return { success: true, remindersSent, requestsCancelled };
    } catch (error) {
        logger.error("[processInactiveServiceRequests] Erreur générale:", { error });
        return {
            success: false,
            remindersSent,
            requestsCancelled,
            error: "Erreur lors du nettoyage des demandes de service",
        };
    }
}

