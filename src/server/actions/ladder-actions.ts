"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { z } from "zod";

// ============================================================================
// TYPES
// ============================================================================

type ActionResponse<T = undefined> = {
    success: boolean;
    error?: string;
    data?: T;
};

export type LadderEntry = {
    rank: number;
    profileId: string;
    discordNickname: string | null;
    discordRoleColor: number | null;
    pseudoDofus: string | null;
    classe: string | null;
    value: number;
    isCurrentUser: boolean;
};

export type LadderType = "activity" | "seniority";
export type ActivityView = "monthly" | "alltime";

// ============================================================================
// LADDER QUERIES
// ============================================================================

/**
 * Get Activity Ladder (XP-based ranking)
 * @param view "monthly" for current month, "alltime" for cumulative
 */
export async function getActivityLadder(
    guildId: string,
    view: ActivityView = "monthly"
): Promise<ActionResponse<LadderEntry[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Get guild config
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guildConfig) {
            return { success: false, error: "Guilde non trouvée" };
        }

        // Get current user profile
        const currentProfile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guildId: guildConfig.id }
        });

        if (view === "monthly") {
            // For monthly view, we need to calculate XP from validated missions this month
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            // Get all validated submissions this month with their XP rewards
            const monthlyStats = await db.submission.groupBy({
                by: ["profileId"],
                where: {
                    status: "VALIDATED",
                    createdAt: { gte: startOfMonth },
                    profile: {
                        guildId: guildConfig.id,
                        status: "ACTIVE"
                    }
                },
                _count: true
            });

            // Get profile details and calculate XP based on mission rewards
            const profileIds = monthlyStats.map(s => s.profileId);

            // For now, use a simpler approach: count validated missions * base XP
            const profiles = await db.userProfile.findMany({
                where: {
                    id: { in: profileIds },
                    status: "ACTIVE"
                },
                select: {
                    id: true,
                    discordNickname: true,
                    discordRoleColor: true,
                    discordJoinedAt: true,
                    pseudoDofus: true,
                    classe: true,
                    submissions: {
                        where: {
                            status: "VALIDATED",
                            createdAt: { gte: startOfMonth }
                        },
                        select: {
                            mission: {
                                select: { xpReward: true }
                            }
                        }
                    }
                }
            });

            // Calculate monthly XP per profile
            const rankedProfiles = profiles.map(p => ({
                ...p,
                monthlyXp: p.submissions.reduce((sum, sub) => sum + (sub.mission.xpReward || 0), 0)
            }))
                .sort((a, b) => {
                    // Sort by XP DESC, then by joinedAt ASC (older wins ties)
                    if (b.monthlyXp !== a.monthlyXp) return b.monthlyXp - a.monthlyXp;
                    const aJoined = a.discordJoinedAt?.getTime() || Infinity;
                    const bJoined = b.discordJoinedAt?.getTime() || Infinity;
                    return aJoined - bJoined;
                });

            const ladder: LadderEntry[] = rankedProfiles.map((p, idx) => ({
                rank: idx + 1,
                profileId: p.id,
                discordNickname: p.discordNickname,
                discordRoleColor: p.discordRoleColor,
                pseudoDofus: p.pseudoDofus,
                classe: p.classe,
                value: p.monthlyXp,
                isCurrentUser: p.id === currentProfile?.id
            }));

            return { success: true, data: ladder };
        } else {
            // All-time: use cumulative XP field
            const profiles = await db.userProfile.findMany({
                where: {
                    guildId: guildConfig.id,
                    status: "ACTIVE",
                    xp: { gt: 0 }
                },
                select: {
                    id: true,
                    discordNickname: true,
                    discordRoleColor: true,
                    discordJoinedAt: true,
                    pseudoDofus: true,
                    classe: true,
                    xp: true
                },
                orderBy: [
                    { xp: "desc" },
                    { discordJoinedAt: "asc" } // Tie-breaker
                ]
            });

            const ladder: LadderEntry[] = profiles.map((p, idx) => ({
                rank: idx + 1,
                profileId: p.id,
                discordNickname: p.discordNickname,
                discordRoleColor: p.discordRoleColor,
                pseudoDofus: p.pseudoDofus,
                classe: p.classe,
                value: p.xp,
                isCurrentUser: p.id === currentProfile?.id
            }));

            return { success: true, data: ladder };
        }
    } catch (error) {
        console.error("[getActivityLadder] Error:", error);
        return { success: false, error: "Erreur lors du chargement du classement" };
    }
}

/**
 * Get Seniority Ladder (Discord join date ranking)
 */
export async function getSeniorityLadder(
    guildId: string
): Promise<ActionResponse<LadderEntry[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guildConfig) {
            return { success: false, error: "Guilde non trouvée" };
        }

        const currentProfile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guildId: guildConfig.id }
        });

        const profiles = await db.userProfile.findMany({
            where: {
                guildId: guildConfig.id,
                status: "ACTIVE",
                discordJoinedAt: { not: null }
            },
            select: {
                id: true,
                discordNickname: true,
                discordRoleColor: true,
                discordJoinedAt: true,
                pseudoDofus: true,
                classe: true
            },
            orderBy: { discordJoinedAt: "asc" } // Oldest first
        });

        const now = new Date();
        const ladder: LadderEntry[] = profiles.map((p, idx) => {
            // Calculate days since joining
            const joinedAt = p.discordJoinedAt!;
            const daysInGuild = Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));

            return {
                rank: idx + 1,
                profileId: p.id,
                discordNickname: p.discordNickname,
                discordRoleColor: p.discordRoleColor,
                pseudoDofus: p.pseudoDofus,
                classe: p.classe,
                value: daysInGuild,
                isCurrentUser: p.id === currentProfile?.id
            };
        });

        return { success: true, data: ladder };
    } catch (error) {
        console.error("[getSeniorityLadder] Error:", error);
        return { success: false, error: "Erreur lors du chargement du classement" };
    }
}
