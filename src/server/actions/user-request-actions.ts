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
        type: "job" | "order" | "legendary";
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
        // 1. Fetch Target User & Guild Config
        const [targetUser, guildConfig] = await Promise.all([
            db.user.findUnique({
                where: { id: targetUserId },
                include: { 
                    profiles: { where: { guildId } },
                    accounts: { where: { provider: "discord" } }
                }
            }),
            db.guildConfig.findUnique({
                where: { discordGuildId: guildId },
                select: { userRequestChannelId: true, dofusServerName: true }
            })
        ]);

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
        }

        // 3. Create Dashboard Notification
        await db.notification.create({
            data: {
                userId: targetUser.id,
                title: "Nouvelle sollicitation",
                message: `${senderName} vous a sollicité pour : ${requestLabel}. Message : ${data.message}`,
                type: NotificationType.SYSTEM_INFO,
                category: NotificationCategory.SYSTEM,
                link: `/dashboard/${guildId}/profile`, // Direct to their own profile to see requests? Or just profile.
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
                        embedUrl: `${appUrl}/dashboard/${guildId}/profile`
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
