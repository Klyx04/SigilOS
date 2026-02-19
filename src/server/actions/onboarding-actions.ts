"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";

export type OnboardingProgress = {
    steps: {
        id: string;
        title: string;
        description: string;
        status: "COMPLETED" | "IN_PROGRESS" | "TO_DO";
        points: number;
        href: string;
    }[];
    totalPoints: number;
    maxPoints: number;
    isFinished: boolean;
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
                            weekNumber: getWeekNumber(new Date()),
                            year: new Date().getFullYear(),
                        }
                    }
                }
            }
        }
    });

    if (!guild) {
        throw new Error("Guild not found");
    }

    const steps: OnboardingProgress["steps"] = [
        {
            id: "discord",
            title: "Lier le Bot Discord",
            description: "Le cœur de SigilOS est son lien avec Discord. Assurez-vous d'avoir configuré un salon de notifications.",
            status: guild.missionNotifyChannelId ? "COMPLETED" : "TO_DO",
            points: 20,
            href: `/dashboard/${guildId}/admin/settings`,
        },
        {
            id: "modules",
            title: "Configurer les Modules",
            description: "Activez les fonctionnalités dont votre guilde a besoin (Missions, Songes, Ocre...).",
            status: guild.modules && countEnabledModules(guild.modules) > 4 ? "COMPLETED" : "IN_PROGRESS",
            points: 20,
            href: `/dashboard/${guildId}/admin/modules`,
        },
        {
            id: "presentation",
            title: "Page de Présentation",
            description: "Personnalisez votre page publique pour attirer de nouveaux membres.",
            status: guild.presentationEnabled && guild.presentationHistory ? "COMPLETED" : "IN_PROGRESS",
            points: 20,
            href: `/dashboard/${guildId}/admin/presentation`,
        },
        {
            id: "missions",
            title: "Premières Missions",
            description: "Lancez l'activité en publiant des missions hebdomadaires pour vos membres.",
            status: guild._count.missions > 0 ? "COMPLETED" : "TO_DO",
            points: 20,
            href: `/dashboard/${guildId}/missions/manage`,
        },
        {
            id: "members",
            title: "Inviter les Membres",
            description: "Partagez l'accès au Dashboard à vos membres pour qu'ils commencent à gagner de l'XP.",
            status: guild._count.profiles > 1 ? "COMPLETED" : "IN_PROGRESS",
            points: 20,
            href: `/dashboard/${guildId}/admin/settings#membres`,
        },
    ];

    const totalPoints = steps.reduce((acc, step) => acc + (step.status === "COMPLETED" ? step.points : 0), 0);
    const maxPoints = steps.reduce((acc, step) => acc + step.points, 0);

    return {
        steps,
        totalPoints,
        maxPoints,
        isFinished: totalPoints === maxPoints,
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

function getWeekNumber(d: Date) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}
