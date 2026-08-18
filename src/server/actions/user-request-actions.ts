"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { sendChannelMessage } from "@/server/discord";
import { NotificationType, NotificationCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { DOFUS_JOBS, getAlignment, getOrder } from "@/lib/dofus-assets";

export async function sendUserRequest(
    guildId: string,
    targetUserId: string,
    data: {
        type: "job" | "order" | "legendary" | "service";
        value: string;
        message: string;
    }
) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const viewer = await getUserContext(guildId);
    if (!viewer.isMember) return { success: false, error: "Accès refusé" };

    // 0. Rate Limiting (1 request per hour per sender to the same target)
    const rateLimitKey = `rate-limit:solicit:${session.user.id}:${targetUserId}`;
    try {
        const { redis } = await import("@/lib/redis");
        const isRateLimited = await redis.get(rateLimitKey);
        if (isRateLimited) {
            return { success: false, error: "Veuillez attendre 1h entre chaque sollicitation pour ce membre." };
        }
    } catch (e) {
        logger.warn("Rate limit check failed, bypassing...", { error: e });
    }

    // Validation
    if (data.message && data.message.length > 500) {
        return { success: false, error: "Le message est trop long (max 500 caractères)." };
    }

    try {
        // 1. Fetch Guild Config first to get internal DB guildId
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, userRequestChannelId: true, dofusServerName: true }
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // 2. Fetch Target User (use internal guild id for profile lookup)
        const targetUser = await db.user.findUnique({
            where: { id: targetUserId },
            include: { 
                profiles: { where: { guildId: guildConfig.id } },
                accounts: { where: { provider: "discord" } }
            }
        });

        if (!targetUser || targetUser.profiles.length === 0) {
            return { success: false, error: "Utilisateur introuvable" };
        }

        const discordAccount = targetUser.accounts[0];
        const discordId = discordAccount?.providerAccountId || targetUser.id; // Fallback to id if no account found (unlikely)

        const targetProfile = targetUser.profiles[0];
        const senderName = session.user.name || "Un membre";
        const targetMention = `<@${discordId}>`;
        
        let requestLabel = "";
        let iconUrl = "";

        // 2. Format Request Data for UI & Embed
        if (data.type === "job") {
            const jobData = Object.values(DOFUS_JOBS).flat().find(j => j.id === data.value);
            requestLabel = `Métier : ${jobData?.name || data.value}`;
            iconUrl = jobData?.icon || "";
        } else if (data.type === "order") {
            const alignment = targetProfile.alignment;
            const orderData = alignment ? getOrder(alignment, data.value) : null;
            requestLabel = `Ordre : ${orderData?.name || data.value}`;
            iconUrl = orderData?.icon || "";
        } else if (data.type === "legendary") {
            const item = await db.legendaryItem.findUnique({ where: { id: data.value } });
            requestLabel = `Craft Légendaire : ${item?.name || data.value}`;
            iconUrl = item?.imageUrl || "";
        } else if (data.type === "service") {
            // Fail-closed : le service doit exister, appartenir à la cible, à la guilde et être ACTIF.
            const service = await db.serviceListing.findUnique({ where: { id: data.value } });
            if (
                !service ||
                service.profileId !== targetProfile.id ||
                service.guildId !== guildConfig.id ||
                service.status !== "ACTIVE"
            ) {
                return { success: false, error: "Service introuvable ou plus disponible." };
            }
            requestLabel = `Service : ${service.title}`;
            iconUrl = service.dofusItemIconUrl || service.dungeonImageUrl || "";
        }

        // 3. Create Dashboard Notification
        const notif = await db.notification.create({
            data: {
                userId: targetUser.id,
                guildId: guildConfig.id,
                title: "Nouvelle sollicitation",
                message: `${senderName} vous a sollicité pour : ${requestLabel}. Message : ${data.message}`,
                type: NotificationType.SYSTEM_INFO,
                category: NotificationCategory.SYSTEM,
                // `req` = id de l'expéditeur (nécessaire pour router la réponse depuis l'embed Discord).
                link: `/dashboard/${guildId}/profile?req=${session.user.id}`,
            }
        });

        // 4. Send Discord Ping if configured
        if (guildConfig?.userRequestChannelId) {
            try {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
                
                await sendChannelMessage(
                    guildConfig.userRequestChannelId,
                    "", // content empty, use embed
                    {
                        embedTitle: `Sollicitation : ${requestLabel}`,
                        embedDescription: data.message || "Aucun message complémentaire.",
                        embedColor: 0x6366f1, // Indigo
                        embedAuthor: {
                            name: `${senderName} vous sollicite !`,
                            iconUrl: session.user.image || undefined,
                        },
                        embedThumbnail: iconUrl.startsWith("/") ? `${appUrl}${iconUrl}` : iconUrl,
                        mentionContent: `Hey ${targetMention}, tu as une nouvelle demande !`,
                        fields: [
                            { name: "Demandeur", value: senderName, inline: true },
                            { name: "Serveur", value: guildConfig.dofusServerName || "N/A", inline: true },
                        ],
                        embedFooter: "SigilOS · Système de Sollicitation de Guilde",
                        embedUrl: `${appUrl}/dashboard/${guildId}/profile`,
                        components: [{
                            type: 1,
                            components: [
                                { type: 2, style: 1, label: "Répondre", emoji: { name: "💬" }, custom_id: `userreq:reply:${notif.id}` },
                                { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: `${appUrl}/dashboard/${guildId}/profile` }
                            ]
                        }]
                    }
                );
            } catch (discordError) {
                logger.error("Discord Notification Failed", { discordError });
                // We don't fail the whole action if Discord fails, as DB notification was created.
            }
        }

        // 5. Apply Rate Limit
        try {
            const { redis } = await import("@/lib/redis");
            const rateLimitKey = `rate-limit:solicit:${session.user.id}:${targetUserId}`;
            await redis.set(rateLimitKey, "1", "EX", 3600); // 1 hour cooldown
        } catch (e) {
            logger.warn("Failed to set rate limit key", { error: e });
        }

        return { success: true };
    } catch (error) {
        logger.error("Send User Request Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Réponse à une sollicitation depuis le bouton « Répondre » de l'embed Discord.
 * Seul le membre sollicité (destinataire de la notification) peut répondre (fail-closed).
 * La réponse crée une notification dashboard pour l'expéditeur + un message Discord
 * dans le canal de sollicitation avec mention de l'expéditeur (même mécanique que le module service).
 */
export async function replyToUserRequestAction(
    guildId: string,
    notificationId: string,
    replyMessage: string
): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    if (!replyMessage || replyMessage.trim().length === 0 || replyMessage.length > 500) {
        return { success: false, error: "Message invalide (1 à 500 caractères)." };
    }
    const message = replyMessage.trim();

    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true, userRequestChannelId: true }
    });
    if (!guildConfig) return { success: false, error: "Guilde introuvable" };

    const notif = await db.notification.findUnique({ where: { id: notificationId } });
    if (!notif || notif.guildId !== guildConfig.id) {
        return { success: false, error: "Demande introuvable" };
    }

    // Fail-closed : seul le membre sollicité (destinataire de la notification) peut répondre.
    if (notif.userId !== session.user.id) {
        return { success: false, error: "Seul le membre sollicité peut répondre." };
    }

    // L'expéditeur de la sollicitation est encodé dans le lien de la notification (?req=).
    let senderUserId: string | null = null;
    try {
        const url = new URL(notif.link || "", "https://sigilos.fr");
        senderUserId = url.searchParams.get("req");
    } catch {
        // lien invalide → senderUserId reste null
    }
    if (!senderUserId) return { success: false, error: "Demande invalide (expéditeur introuvable)." };

    const targetName = session.user.name || "Le membre sollicité";

    // Notification dashboard pour l'expéditeur
    try {
        await db.notification.create({
            data: {
                userId: senderUserId,
                guildId: guildConfig.id,
                title: "💬 Réponse à votre sollicitation",
                message: `${targetName} vous a répondu : ${message}`,
                type: NotificationType.SERVICE_REPLY,
                category: NotificationCategory.SYSTEM,
                link: `/dashboard/${guildId}/profile`,
            }
        });
    } catch (notifErr) {
        logger.error("[replyToUserRequestAction] notification failed", { err: notifErr });
        return { success: false, error: "Impossible de créer la réponse." };
    }

    // Message Discord dans le canal de sollicitation (mention de l'expéditeur)
    if (guildConfig.userRequestChannelId) {
        try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
            const senderAccount = await db.account.findFirst({
                where: { userId: senderUserId, provider: "discord" },
                select: { providerAccountId: true }
            });
            const senderMention = senderAccount?.providerAccountId ? `<@${senderAccount.providerAccountId}>` : senderUserId;

            await sendChannelMessage(
                guildConfig.userRequestChannelId,
                `🔔 ${senderMention}, ${targetName} a répondu à votre sollicitation :`,
                {
                    embedTitle: `💬 Réponse de ${targetName}`,
                    embedDescription: message,
                    embedColor: 0x10b981, // Emerald
                    embedFooter: "SigilOS · Système de Sollicitation de Guilde",
                    embedUrl: `${appUrl}/dashboard/${guildId}/profile`
                }
            );
        } catch (discordError) {
            logger.error("Discord reply failed", { discordError });
        }
    }

    return { success: true };
}
