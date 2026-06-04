"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";
import { getDofusWeek } from "@/lib/date-utils";

export type OnboardingProgress = {
    steps: {
        id: string;
        title: string;
        description: string;
        status: "COMPLETED" | "IN_PROGRESS" | "TO_DO";
        mandatory: boolean;
        points: number;
        href: string;
    }[];
    totalPoints: number;
    maxPoints: number;
    isFinished: boolean;
    mandatoryComplete: boolean;
};

export async function getGettingStartedProgress(guildId: string): Promise<OnboardingProgress> {
    const user = await getUserContext(guildId);
    if (!user.isAdmin) {
        throw new Error("Unauthorized");
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        include: {
            modules: true,
            _count: {
                select: {
                    profiles: true,
                    missions: {
                        where: {
                            weekNumber: getDofusWeek().week,
                            year: getDofusWeek().year,
                        }
                    }
                }
            }
        }
    });

    if (!guild) {
        throw new Error("Guild not found");
    }

    const rolesMapping = (guild.rolesMapping as Record<string, string[]>) || {};
    const isRbacConfigured = Object.values(rolesMapping).some(perms => 
        Array.isArray(perms) && perms.includes("dashboard:login")
    );

    const steps: OnboardingProgress["steps"] = [
        {
            id: "dofus",
            title: "Serveur de Jeu",
            description: "Sélectionnez le serveur Dofus de votre guilde. Cela débloquera l'accès aux autres paramètres.",
            status: guild.dofusServerId ? "COMPLETED" : "TO_DO",
            mandatory: true,
            points: 20,
            href: `/dashboard/${guildId}/admin/settings?tab=dofus`,
        },
        {
            id: "rbac",
            title: "Rôles & Permissions",
            description: "Définissez au moins un rôle Discord pour l'autorisation 'Accès Dashboard' afin de sécuriser l'accès.",
            status: isRbacConfigured ? "COMPLETED" : "TO_DO",
            mandatory: true,
            points: 20,
            href: `/dashboard/${guildId}/admin/permissions`,
        },
        {
            id: "discord",
            title: "Lier le Bot Discord",
            description: "Configurez au moins le salon de notifications principal (Lifecycle ou Missions).",
            status: guild.missionNotifyChannelId || guild.lifecycleNotifyChannelId ? "COMPLETED" : "IN_PROGRESS",
            mandatory: false,
            points: 15,
            href: `/dashboard/${guildId}/admin/settings?tab=annonces`,
        },
        {
            id: "modules",
            title: "Configurer les Modules",
            description: "Activez les fonctionnalités dont votre guilde a besoin (Missions, Songes, Ocre...).",
            status: guild.modules && countEnabledModules(guild.modules) > 4 ? "COMPLETED" : "IN_PROGRESS",
            mandatory: false,
            points: 15,
            href: `/dashboard/${guildId}/admin/modules`,
        },
        {
            id: "presentation",
            title: "Page de Présentation",
            description: "Personnalisez votre page publique pour attirer de nouveaux membres.",
            status: guild.presentationEnabled && guild.presentationHistory ? "COMPLETED" : "IN_PROGRESS",
            mandatory: false,
            points: 15,
            href: `/dashboard/${guildId}/admin/presentation`,
        },
        {
            id: "missions",
            title: "Premières Missions",
            description: "Lancez l'activité en publiant des missions hebdomadaires pour vos membres.",
            status: guild._count.missions > 0 ? "COMPLETED" : "TO_DO",
            mandatory: false,
            points: 15,
            href: `/dashboard/${guildId}/missions/manage`,
        },
    ];

    const totalPoints = steps.reduce((acc, step) => acc + (step.status === "COMPLETED" ? step.points : 0), 0);
    const maxPoints = steps.reduce((acc, step) => acc + step.points, 0);
    const mandatoryComplete = steps
        .filter(s => s.mandatory)
        .every(s => s.status === "COMPLETED");

    return {
        steps,
        totalPoints,
        maxPoints,
        isFinished: totalPoints === maxPoints,
        mandatoryComplete,
    };
}

export async function markWelcomeAsSeen(guildId: string) {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        await db.userProfile.update({
            where: {
                userId_guildId: {
                    userId: user.id!,
                    guildId: guildConfig.id,
                },
            },
            data: {
                hasSeenWelcome: true,
            },
        });

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateUserContextCache } = await import("./user-actions");
        await invalidateUserContextCache(user.id!, guildConfig.id, guildId);

        revalidatePath(`/dashboard/${guildId}`);
        return { success: true };
    } catch (e) {
        console.error("Failed to mark welcome as seen", e);
        return { success: false, error: "Database error" };
    }
}

function countEnabledModules(modules: any): number {
    let count = 0;
    const keys = ["presentation", "roster", "stats", "calendar", "missions", "songes", "ocre", "ladder", "services", "donjons", "profile", "docs", "polls", "admin"];
    for (const key of keys) {
        if (modules[key] === true) count++;
    }
    return count;
}


export async function sendWelcomeNotifications(guildConfig: any, profileId: string, displayName: string) {
    if (!guildConfig) return;

    // Helper to strip HTML tags
    const stripHtml = (html: string) => {
        if (!html) return "";
        return html
            .replace(/<p>/g, "")
            .replace(/<\/p>/g, "\n")
            .replace(/<br\s*\/?>/g, "\n")
            .replace(/<strong>/g, "**")
            .replace(/<\/strong>/g, "**")
            .replace(/<em>/g, "_")
            .replace(/<\/em>/g, "_")
            .replace(/<[^>]*>?/gm, "")
            .trim();
    };

    // Fetch user profile to get Discord ID if needed for pinging
    const profile = await db.userProfile.findUnique({
        where: { id: profileId },
        select: {
            userId: true,
            user: {
                select: {
                    image: true,
                    accounts: {
                        where: { provider: "discord" },
                        select: { providerAccountId: true },
                        take: 1
                    }
                }
            }
        },
    });

    const discordUserId = profile?.user?.accounts?.[0]?.providerAccountId;

    // 1. Dashboard Welcome Post
    if (guildConfig.welcomeDashboardEnabled) {
        const template = guildConfig.welcomeMessageTemplate || "<p>🎉 Bienvenue à <strong>{member}</strong> parmi nous !</p>";
        const content = template
            .replace(/{member}/g, `**${displayName}**`)
            .replace(/{user}/g, `**${displayName}**`)
            .replace(/{nickname}/g, `**${displayName}**`)
            .replace(/{guild}/g, `**${guildConfig.name || "la guilde"}**`)
            .replace(/{server}/g, `**${guildConfig.name || "la guilde"}**`);

        try {
            await Promise.all([
                db.memberWelcome.create({
                    data: {
                        guildId: guildConfig.id,
                        profileId: profileId,
                        content: content
                    }
                }),
                db.guildActivity.create({
                    data: {
                        guildId: guildConfig.id,
                        type: "NEW_MEMBER",
                        actorName: displayName,
                        meta: { message: stripHtml(content), profileId }
                    }
                })
            ]);
        } catch (e) {
            console.error("[Welcome] Failed to create welcome records", e);
        }
    }

    // 2. Global In-App Notification (Small bell for everyone)
    try {
        const { createNotification } = await import("@/server/actions/notification-actions");

        const activeMembers = await db.userProfile.findMany({
            where: {
                guildId: guildConfig.id,
                status: "ACTIVE",
                id: { not: profileId }
            },
            select: { userId: true }
        });

        if (activeMembers.length > 0) {
            const notificationTitle = "✨ Arrivée d'un nouveau membre";
            const notificationMessage = `${displayName} vient d'intégrer le Dashboard ! 👋`;

            const notificationPromises = activeMembers.map(m =>
                createNotification(
                    m.userId,
                    "SYSTEM_INFO",
                    notificationTitle,
                    notificationMessage,
                    `/dashboard/${guildConfig.discordGuildId}/welcome`,
                    guildConfig.discordGuildId,
                    "SYSTEM"
                )
            );

            const CHUNK_SIZE = 50;
            for (let i = 0; i < notificationPromises.length; i += CHUNK_SIZE) {
                await Promise.all(notificationPromises.slice(i, i + CHUNK_SIZE));
            }
        }
    } catch (e) {
        console.error("[Welcome] Failed to send global notifications", e);
    }

    // 3. Discord Welcome Ping
    if (guildConfig.welcomeDiscordEnabled && guildConfig.welcomeNotifyChannelId) {
        const { sendChannelMessage } = await import("@/server/discord");

        const rawTemplate = guildConfig.welcomeDiscordMessageTemplate || guildConfig.welcomeMessageTemplate || "🎉 Bienvenue à {member} !";
        const template = stripHtml(rawTemplate);

        const memberMention = discordUserId ? `<@${discordUserId}>` : `**${displayName}**`;

        const content = template
            .replace(/{member}/g, memberMention)
            .replace(/{user}/g, memberMention)
            .replace(/{nickname}/g, memberMention)
            .replace(/{guild}/g, `**${guildConfig.name || "la guilde"}**`)
            .replace(/{server}/g, `**${guildConfig.name || "la guilde"}**`);

        // Pings go outside the embed (trigger notification)
        let mentionContent = "";
        if (guildConfig.welcomeMentionRoleId) {
            mentionContent = guildConfig.welcomeMentionRoleId === "everyone"
                ? "@everyone"
                : `<@&${guildConfig.welcomeMentionRoleId}>`;
        }

        // Combine role ping and user ping for maximum attention
        const pings = [mentionContent, memberMention].filter(Boolean).join(" ");

        try {
            await sendChannelMessage(guildConfig.welcomeNotifyChannelId, pings, {
                embedTitle: `🌟 NOUVELLE ARRIVÉE !`,
                embedDescription: content,
                embedColor: 0xf59e0b, // Amber 500
                embedThumbnail: profile?.user?.image || "https://beta.sigilos.fr/assets/ui/logo-v2.png",
                embedFooter: "SigilOS Onboarding System"
            });
        } catch (e) {
            console.error("[Welcome] Failed to send Discord welcome message", e);
        }
    }
}
