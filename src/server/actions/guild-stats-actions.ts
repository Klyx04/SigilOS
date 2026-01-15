"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";

type ActionResponse<T = undefined> = {
    success: boolean;
    error?: string;
    data?: T;
};

export type GuildStats = {
    missionsValidatedThisWeek: number;
    activeSongesRuns: number;
    activeMembersThisWeek: number;
    totalMembers: number;
    activityPointsThisWeek: number;
};

/**
 * Get aggregated guild statistics for the dashboard
 * Replaces personal stats with guild-wide metrics
 */
export async function getGuildStats(
    discordGuildId: string
): Promise<ActionResponse<GuildStats>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Security: Verify user is member of the guild
        const user = await getUserContext(discordGuildId);
        if (!user.isAuthenticated || !user.isMember) {
            return { success: false, error: "Accès non autorisé" };
        }

        // Get guild config
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true }
        });

        if (!guildConfig) {
            return { success: false, error: "Guild not found" };
        }

        // Calculate current week boundaries (Monday 8h reset like Dofus)
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek; // Monday = 1
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() + diff);
        weekStart.setHours(8, 0, 0, 0);

        // If we're before Monday 8h, go back one more week
        if (now < weekStart) {
            weekStart.setDate(weekStart.getDate() - 7);
        }

        // Parallel queries for performance
        const [
            missionsValidatedThisWeek,
            activeSongesRuns,
            activeMembersThisWeek,
            totalMembers,
            activityPointsThisWeek
        ] = await Promise.all([
            // Validated submissions this week (using updatedAt as validation timestamp)
            db.submission.count({
                where: {
                    mission: { guildId: guildConfig.id },
                    status: "VALIDATED",
                    updatedAt: { gte: weekStart }
                }
            }),
            // Active Songes runs (recruiting or in progress)
            db.dreamRun.count({
                where: {
                    guildId: discordGuildId,
                    status: { in: ["RECRUITING", "IN_PROGRESS"] }
                }
            }),
            // Members with activity this week
            db.userProfile.count({
                where: {
                    guildId: guildConfig.id,
                    status: "ACTIVE",
                    lastActivityAt: { gte: weekStart }
                }
            }),
            // Total active members
            db.userProfile.count({
                where: {
                    guildId: guildConfig.id,
                    status: "ACTIVE"
                }
            }),
            // Activity points gained this week
            db.submission.findMany({
                where: {
                    mission: { guildId: guildConfig.id },
                    status: "VALIDATED",
                    updatedAt: { gte: weekStart }
                },
                select: {
                    mission: {
                        select: { xpReward: true }
                    }
                }
            }).then(submissions =>
                submissions.reduce((acc, sub) => acc + (sub.mission.xpReward || 0), 0)
            )
        ]);

        return {
            success: true,
            data: {
                missionsValidatedThisWeek,
                activeSongesRuns,
                activeMembersThisWeek,
                totalMembers,
                activityPointsThisWeek
            }
        };
    } catch (error) {
        console.error("[getGuildStats] Error:", error);
        return { success: false, error: "Erreur lors du chargement des stats" };
    }
}
