"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { getUserContext, type ActionResponse } from "./user-actions";
import { createNotification } from "./notification-actions";
import { sendChannelMessage } from "@/server/discord";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ServiceCategory, NotificationType, NotificationCategory } from "@prisma/client";
import { logger } from "@/lib/logger";
import { sanitizeName } from "@/lib/security";

const submitFeedbackSchema = z.object({
    providerProfileId: z.string().min(1, "Prestataire requis"),
    serviceListingId: z.string().optional().nullable(),
    serviceRequestId: z.string().optional().nullable(),
    serviceTitle: z.string().min(1, "Titre du service requis").max(100),
    category: z.nativeEnum(ServiceCategory),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(280, "Commentaire limité à 280 caractères").optional().nullable(),
});

export type ServiceFeedbackWithProvider = {
    id: string;
    guildId: string;
    providerProfileId: string;
    clientUserId: string;
    clientName: string;
    clientAvatar: string | null;
    serviceListingId: string | null;
    serviceRequestId: string | null;
    serviceTitle: string;
    category: ServiceCategory;
    rating: number;
    comment: string | null;
    isModerated: boolean;
    createdAt: Date;
    providerProfile?: {
        id: string;
        pseudoDofus: string | null;
        discordNickname: string | null;
        classe: string | null;
        user: { name: string | null; image: string | null };
    };
};

export type ProviderRanking = {
    profileId: string;
    name: string;
    avatar: string | null;
    classe: string | null;
    averageRating: number;
    feedbackCount: number;
    latestFeedbackAt: Date;
};

/**
 * Soumettre un avis client pour un prestataire de service
 */
export async function submitServiceFeedback(
    guildId: string,
    rawInput: z.infer<typeof submitFeedbackSchema>
): Promise<ActionResponse<{ id: string }>> {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.isMember || !user.id) {
        return { success: false, error: "Non autorisé" };
    }

    const parsed = submitFeedbackSchema.safeParse(rawInput);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || "Données invalides" };
    }

    const { providerProfileId, serviceListingId, serviceRequestId, serviceTitle, category, rating, comment } = parsed.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, servicesNotifyChannelId: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Si lié à une demande de service, vérifier son statut
        let linkedRequest: { id: string; discordMessageId: string | null; status: string } | null = null;
        if (serviceRequestId) {
            const req = await db.serviceRequest.findFirst({
                where: { id: serviceRequestId, guildId: guildConfig.id },
                include: { feedback: { select: { id: true } } },
            });
            if (!req) return { success: false, error: "Demande de service introuvable" };
            if (req.clientUserId !== user.id) {
                return { success: false, error: "Seul le client ayant formulé cette demande peut laisser un avis" };
            }
            if (req.feedback) {
                return { success: false, error: "Un avis a déjà été soumis pour cette prestation" };
            }
            linkedRequest = { id: req.id, discordMessageId: req.discordMessageId, status: req.status };
        }

        // Vérifier que le profil du prestataire existe et appartient à cette guilde
        const providerProfile = await db.userProfile.findFirst({
            where: { id: providerProfileId, guildId: guildConfig.id },
            include: { user: { select: { id: true, name: true } } },
        });
        if (!providerProfile) return { success: false, error: "Prestataire introuvable" };

        // Anti-auto-évaluation : impossible de se noter soi-même
        if (providerProfile.userId === user.id) {
            return { success: false, error: "Tu ne peux pas t'évaluer toi-même !" };
        }

        const session = await auth();
        const clientName = user.name || session?.user?.name || "Client";
        const clientAvatar = session?.user?.image || null;

        const feedback = await db.serviceFeedback.create({
            data: {
                guildId: guildConfig.id,
                providerProfileId,
                clientUserId: user.id,
                clientName,
                clientAvatar,
                serviceListingId: serviceListingId || null,
                serviceRequestId: serviceRequestId || null,
                serviceTitle: sanitizeName(serviceTitle, 100) || serviceTitle,
                category,
                rating,
                comment: comment ? sanitizeName(comment, 280) : null,
            },
        });

        // 1. Notification Dashboard pour le prestataire
        await createNotification(
            providerProfile.userId,
            NotificationType.SERVICE_REPLY,
            "⭐ Nouvel avis reçu !",
            `${clientName} vous a attribué la note de ${rating}/5 pour "${serviceTitle}".`,
            `/dashboard/${guildId}/services?tab=feedbacks`,
            guildId,
            NotificationCategory.SYSTEM
        ).catch(() => {});

        // 2. Publication d'un embed Discord dans le salon de service de la guilde
        const stars = "⭐".repeat(rating);
        const providerName = providerProfile.pseudoDofus || providerProfile.discordNickname || providerProfile.user?.name || "Prestataire";
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";

        if (guildConfig.servicesNotifyChannelId) {
            // Si la demande avait un message Discord, on met à jour le message existant pour clore le cycle
            if (linkedRequest?.discordMessageId) {
                try {
                    const { patchChannelMessage } = await import("@/server/discord");
                    await patchChannelMessage(
                        guildConfig.servicesNotifyChannelId,
                        linkedRequest.discordMessageId,
                        {
                            content: `⭐ **Avis client enregistré** — **${clientName}** a attribué ${stars} (${rating}/5) à **${providerName}** !`,
                            components: [], // Supprime le bouton pour empêcher les doublons
                        }
                    );
                } catch (patchErr) {
                    logger.warn("[submitServiceFeedback] Discord patch failed", { error: patchErr });
                }
            }

            // Publication globale de l'avis dans le salon de service
            await sendChannelMessage(
                guildConfig.servicesNotifyChannelId,
                `⭐ **Nouvel avis client** pour **${providerName}** !`,
                {
                    embedTitle: `⭐ Avis Client — ${stars} (${rating}/5)`,
                    embedDescription: `**${clientName}** a laissé un avis sur la prestation de **${providerName}** :`,
                    fields: [
                        { name: "🛠️ Service", value: serviceTitle, inline: true },
                        { name: "⭐ Note", value: `${stars} **${rating}/5**`, inline: true },
                        ...(comment ? [{ name: "💬 Commentaire", value: `"${comment}"`, inline: false }] : []),
                    ],
                    embedColor: 0xf59e0b,
                    embedFooter: "SigilOS • Livre d'or des Services",
                    embedUrl: `${appUrl}/dashboard/${guildId}/services?tab=feedbacks`,
                }
            ).catch((err) => logger.warn("[submitServiceFeedback] Discord broadcast failed", { error: err }));
        }

        revalidatePath(`/dashboard/${guildId}/services`);
        return { success: true, data: { id: feedback.id } };
    } catch (error) {
        logger.error("[submitServiceFeedback]", error);
        return { success: false, error: "Erreur lors de l'enregistrement de l'avis" };
    }
}

/**
 * Récupérer tous les avis d'une guilde (ou pour un prestataire spécifique)
 */
export async function getServiceFeedbacks(
    guildId: string,
    providerProfileId?: string
): Promise<ActionResponse<ServiceFeedbackWithProvider[]>> {
    try {
        const user = await getUserContext(guildId);
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const feedbacks = await db.serviceFeedback.findMany({
            where: {
                guildId: guildConfig.id,
                ...(providerProfileId ? { providerProfileId } : {}),
                ...(user.isAdmin ? {} : { isModerated: false }),
            },
            include: {
                providerProfile: {
                    select: {
                        id: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        classe: true,
                        user: { select: { name: true, image: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });

        return { success: true, data: feedbacks as any };
    } catch (error) {
        logger.error("[getServiceFeedbacks]", error);
        return { success: false, error: "Erreur lors du chargement des avis" };
    }
}

/**
 * Calculer le classement de satisfaction des passeurs / artisans de la guilde
 */
export async function getProviderRankings(guildId: string): Promise<ActionResponse<ProviderRanking[]>> {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const feedbacks = await db.serviceFeedback.findMany({
            where: { guildId: guildConfig.id },
            include: {
                providerProfile: {
                    select: {
                        id: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        classe: true,
                        user: { select: { name: true, image: true } },
                    },
                },
            },
        });

        const byProvider = new Map<string, {
            profileId: string;
            name: string;
            avatar: string | null;
            classe: string | null;
            ratings: number[];
            latestFeedbackAt: Date;
        }>();

        for (const fb of feedbacks) {
            const pId = fb.providerProfileId;
            const current = byProvider.get(pId) || {
                profileId: pId,
                name: fb.providerProfile?.pseudoDofus || fb.providerProfile?.discordNickname || fb.providerProfile?.user?.name || "Prestataire",
                avatar: fb.providerProfile?.user?.image || null,
                classe: fb.providerProfile?.classe || null,
                ratings: [],
                latestFeedbackAt: fb.createdAt,
            };

            current.ratings.push(fb.rating);
            if (fb.createdAt > current.latestFeedbackAt) {
                current.latestFeedbackAt = fb.createdAt;
            }
            byProvider.set(pId, current);
        }

        const rankings: ProviderRanking[] = Array.from(byProvider.values()).map((p) => {
            const sum = p.ratings.reduce((acc, r) => acc + r, 0);
            const averageRating = Math.round((sum / p.ratings.length) * 10) / 10;
            return {
                profileId: p.profileId,
                name: p.name,
                avatar: p.avatar,
                classe: p.classe,
                averageRating,
                feedbackCount: p.ratings.length,
                latestFeedbackAt: p.latestFeedbackAt,
            };
        }).sort((a, b) => {
            if (b.feedbackCount !== a.feedbackCount) return b.feedbackCount - a.feedbackCount;
            return b.averageRating - a.averageRating;
        });

        return { success: true, data: rankings };
    } catch (error) {
        logger.error("[getProviderRankings]", error);
        return { success: false, error: "Erreur lors du calcul du classement" };
    }
}
