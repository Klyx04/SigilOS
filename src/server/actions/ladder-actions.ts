"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { withCache } from "@/lib/cache";

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
    discordImage: string | null;
    pseudoDofus: string | null;
    classe: string | null;
    value: number;
    dofusLevel?: number;
    totalXpBigInt?: string;
    isCurrentUser: boolean;
    isAdmin: boolean;
};

export type LadderType = "activity" | "seniority" | "success" | "contribution";
export type ActivityView = "weekly" | "monthly" | "alltime";

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
            select: { id: true, rolesMapping: true }
        });

        if (!guildConfig) {
            return { success: false, error: "Guilde non trouvée" };
        }

        // Get current user profile
        const currentProfile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guildId: guildConfig.id }
        });

        if (view === "weekly" || view === "monthly") {
            let startDate: Date;

            if (view === "weekly") {
                // Reset every Tuesday at 07:00 (Dofus Maintenance / Week start)
                const now = new Date();
                const day = now.getDay(); // 0=Sun, 1=Mon, 2=Tue ... 6=Sat
                const daysSinceTuesday = (day + 7 - 2) % 7;
                const tuesday = new Date(now);
                tuesday.setDate(now.getDate() - daysSinceTuesday);
                tuesday.setHours(7, 0, 0, 0);
                // If we're Tuesday but before 7am, use previous Tuesday
                if (now < tuesday) {
                    tuesday.setDate(tuesday.getDate() - 7);
                }
                startDate = tuesday;
            } else {
                // Monthly: first day of current month at 00:00
                const now = new Date();
                startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            }

            const cacheKey = `ladder:activity:${guildId}:${view}:${startDate.getTime()}`;
            const ladder = await withCache(cacheKey, 300, async () => {
                const { KAMA_TRANCHE, REWARDS_PER_TRANCHE } = await import("@/lib/kama-constants");
                
                // PERF-01: Single aggregation query — Combine Mission XP and Kama XP
                // RAW SQL EXCEPTION: This CTE (Common Table Expression) combines two
                // aggregated sources in a single DB round-trip. Prisma ORM cannot
                // express UNION ALL + GROUP BY across relations without N+1 queries.
                // Inputs are internal UUIDs from guildConfig.id — no user-controlled values.
                const xpByProfile = await db.$queryRaw<{ profileId: string; totalXp: number }[]>`
                    WITH MissionXP AS (
                        SELECT s."profileId", COALESCE(SUM(m."xpReward"), 0)::int AS xp
                        FROM "Submission" s
                        JOIN "Mission" m ON s."missionId" = m."id"
                        JOIN "UserProfile" up ON s."profileId" = up."id"
                        WHERE s."status" = 'VALIDATED'
                          AND s."updatedAt" >= ${startDate}
                          AND up."guildId" = ${guildConfig.id}
                          AND up."status" = 'ACTIVE'
                        GROUP BY s."profileId"
                    ),
                    KamaXP AS (
                        SELECT k."profileId", COALESCE(SUM(FLOOR(k."amount" / ${KAMA_TRANCHE}) * ${REWARDS_PER_TRANCHE.xp}), 0)::int AS xp
                        FROM "KamaDonation" k
                        JOIN "UserProfile" up ON k."profileId" = up."id"
                        WHERE k."status" = 'VALIDATED'
                          AND k."validatedAt" >= ${startDate}
                          AND up."guildId" = ${guildConfig.id}
                          AND up."status" = 'ACTIVE'
                        GROUP BY k."profileId"
                    ),
                    CombinedXP AS (
                        SELECT "profileId", xp FROM MissionXP
                        UNION ALL
                        SELECT "profileId", xp FROM KamaXP
                    )
                    SELECT "profileId", COALESCE(SUM(xp), 0)::int AS "totalXp"
                    FROM CombinedXP
                    GROUP BY "profileId"
                    HAVING COALESCE(SUM(xp), 0) > 0
                    ORDER BY "totalXp" DESC
                `;

                if (xpByProfile.length === 0) return [];

                // Bulk fetch profile display data (single query, no submissions loaded)
                const profileIds = xpByProfile.map(x => x.profileId);
                const xpMap = new Map(xpByProfile.map(x => [x.profileId, x.totalXp]));

                const profiles = await db.userProfile.findMany({
                    where: { id: { in: profileIds }, status: "ACTIVE" },
                    select: {
                        id: true,
                        discordNickname: true,
                        discordRoleColor: true,
                        discordRoleName: true,
                        discordJoinedAt: true,
                        pseudoDofus: true,
                        classe: true,
                        user: { select: { image: true } },
                    }
                });

                // Sort by XP desc, then seniority asc for tie-breaking
                const rankedProfiles = profiles
                    .map(p => ({ ...p, periodXp: xpMap.get(p.id) || 0 }))
                    .sort((a, b) => {
                        if (b.periodXp !== a.periodXp) return b.periodXp - a.periodXp;
                        return (a.discordJoinedAt?.getTime() || Infinity) - (b.discordJoinedAt?.getTime() || Infinity);
                    });

                const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
                // Build a set of role NAMES that have admin:access
                const adminRoleNames = new Set<string>();
                for (const [roleId, perms] of Object.entries(rolesMapping)) {
                    if (perms.includes("admin:access")) adminRoleNames.add(roleId);
                }
                return rankedProfiles.map((p, idx) => ({
                    rank: idx + 1,
                    profileId: p.id,
                    discordNickname: p.discordNickname,
                    discordRoleColor: p.discordRoleColor,
                    discordImage: p.user.image,
                    pseudoDofus: p.pseudoDofus,
                    classe: p.classe,
                    value: p.periodXp,
                    isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? "")
                }));
            });

            // Post-process to add isCurrentUser
            const enrichedLadder = ladder.map((entry: any) => ({
                ...entry,
                isCurrentUser: entry.profileId === currentProfile?.id
            }));

            return { success: true, data: enrichedLadder };
        } else {
            // All-time: use cumulative XP field
            const cacheKey = `ladder:activity:${guildId}:alltime`;
            const ladder = await withCache(cacheKey, 600, async () => {
                const profiles = await db.userProfile.findMany({
                    where: { guildId: guildConfig.id, status: "ACTIVE", xp: { gt: 0 } },
                    select: {
                        id: true,
                        discordNickname: true,
                        discordRoleColor: true,
                        discordRoleName: true,
                        discordJoinedAt: true,
                        pseudoDofus: true,
                        classe: true,
                        xp: true,
                        user: { select: { image: true } }
                    },
                    orderBy: [{ xp: "desc" }, { discordJoinedAt: "asc" }]
                });

                const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
                const adminRoleNames = new Set<string>();
                for (const [roleId, perms] of Object.entries(rolesMapping)) {
                    if (perms.includes("admin:access")) adminRoleNames.add(roleId);
                }
                return profiles.map((p, idx) => ({
                    rank: idx + 1,
                    profileId: p.id,
                    discordNickname: p.discordNickname,
                    discordRoleColor: p.discordRoleColor,
                    discordImage: p.user.image,
                    pseudoDofus: p.pseudoDofus,
                    classe: p.classe,
                    value: p.xp,
                    isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? "")
                }));
            });

            const enrichedLadder = ladder.map((entry: any) => ({
                ...entry,
                isCurrentUser: entry.profileId === currentProfile?.id
            }));

            return { success: true, data: enrichedLadder };
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
            select: { id: true, rolesMapping: true }
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
                discordRoleName: true,
                discordJoinedAt: true,
                pseudoDofus: true,
                classe: true,
                user: {
                    select: { image: true }
                }
            },
            orderBy: { discordJoinedAt: "asc" } // Oldest first
        });

        const now = new Date();
        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const adminRoleNames = new Set<string>();
        for (const [roleId, perms] of Object.entries(rolesMapping)) {
            if (perms.includes("admin:access")) adminRoleNames.add(roleId);
        }

        const ladder: LadderEntry[] = profiles.map((p, idx) => {
            const joinedAt = p.discordJoinedAt!;
            const daysInGuild = Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));

            return {
                rank: idx + 1,
                profileId: p.id,
                discordNickname: p.discordNickname,
                discordRoleColor: p.discordRoleColor,
                discordImage: p.user.image,
                pseudoDofus: p.pseudoDofus,
                classe: p.classe,
                value: daysInGuild,
                isCurrentUser: p.id === currentProfile?.id,
                isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? "")
            };
        });

        return { success: true, data: ladder };
    } catch (error) {
        console.error("[getSeniorityLadder] Error:", error);
        return { success: false, error: "Erreur lors du chargement du classement" };
    }
}

/**
 * Get Success Ladder (Achievement points ranking)
 */
export async function getSuccessLadder(
    guildId: string
): Promise<ActionResponse<LadderEntry[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, rolesMapping: true }
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
                successPoints: { gt: 0 }
            },
            select: {
                id: true,
                discordNickname: true,
                discordRoleColor: true,
                discordRoleName: true,
                discordJoinedAt: true,
                pseudoDofus: true,
                classe: true,
                successPoints: true,
                user: {
                    select: { image: true }
                }
            },
            orderBy: [
                { successPoints: "desc" },
                { discordJoinedAt: "asc" } // Tie-breaker
            ]
        });

        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const adminRoleNames = new Set<string>();
        for (const [roleId, perms] of Object.entries(rolesMapping)) {
            if (perms.includes("admin:access")) adminRoleNames.add(roleId);
        }

        const ladder: LadderEntry[] = profiles.map((p, idx) => {
            return {
                rank: idx + 1,
                profileId: p.id,
                discordNickname: p.discordNickname,
                discordRoleColor: p.discordRoleColor,
                discordImage: p.user.image,
                pseudoDofus: p.pseudoDofus,
                classe: p.classe,
                value: p.successPoints || 0,
                isCurrentUser: p.id === currentProfile?.id,
                isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? "")
            };
        });

        return { success: true, data: ladder };
    } catch (error) {
        console.error("[getSuccessLadder] Error:", error);
        return { success: false, error: "Erreur lors du chargement du classement des succès" };
    }
}

/**
 * Get General Ladder (Total XP ranking)
 */
export async function getGeneralLadder(
    guildId: string
): Promise<ActionResponse<LadderEntry[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, rolesMapping: true }
        });

        if (!guildConfig) {
            return { success: false, error: "Guilde non trouvée" };
        }

        const currentProfile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guildId: guildConfig.id }
        });

        // We only show characters that have totalXp indexed
        const profiles = await db.userProfile.findMany({
            where: {
                guildId: guildConfig.id,
                status: "ACTIVE",
                totalXp: { not: null }
            },
            select: {
                id: true,
                discordNickname: true,
                discordRoleColor: true,
                discordRoleName: true,
                discordJoinedAt: true,
                pseudoDofus: true,
                classe: true,
                dofusLevel: true,
                totalXp: true,
                user: {
                    select: { image: true }
                }
            },
            orderBy: [
                { totalXp: "desc" },
                { discordJoinedAt: "asc" } 
            ]
        });

        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const adminRoleNames = new Set<string>();
        for (const [roleId, perms] of Object.entries(rolesMapping)) {
            if (perms.includes("admin:access")) adminRoleNames.add(roleId);
        }

        const ladder: LadderEntry[] = profiles.map((p, idx) => {
            return {
                rank: idx + 1,
                profileId: p.id,
                discordNickname: p.discordNickname,
                discordRoleColor: p.discordRoleColor,
                discordImage: p.user.image,
                pseudoDofus: p.pseudoDofus,
                classe: p.classe,
                dofusLevel: p.dofusLevel || undefined,
                totalXpBigInt: p.totalXp?.toString() || "0",
                value: 0, // We use bigInt payload for UI
                isCurrentUser: p.id === currentProfile?.id,
                isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? "")
            };
        });

        return { success: true, data: ladder };
    } catch (error) {
        console.error("[getGeneralLadder] Error:", error);
        return { success: false, error: "Erreur lors du chargement du classement général" };
    }
}

/**
 * Get Contribution Ladder (Guild contribution points ranking)
 */
export async function getContributionLadder(
    guildId: string
): Promise<ActionResponse<LadderEntry[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, rolesMapping: true }
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
                contributionPoints: { gt: 0 }
            },
            select: {
                id: true,
                discordNickname: true,
                discordRoleColor: true,
                discordRoleName: true,
                discordJoinedAt: true,
                pseudoDofus: true,
                classe: true,
                contributionPoints: true,
                user: {
                    select: { image: true }
                }
            },
            orderBy: [
                { contributionPoints: "desc" },
                { discordJoinedAt: "asc" } // Tie-breaker
            ]
        });

        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const adminRoleNames = new Set<string>();
        for (const [roleId, perms] of Object.entries(rolesMapping)) {
            if (perms.includes("admin:access")) adminRoleNames.add(roleId);
        }

        const ladder: LadderEntry[] = profiles.map((p, idx) => {
            return {
                rank: idx + 1,
                profileId: p.id,
                discordNickname: p.discordNickname,
                discordRoleColor: p.discordRoleColor,
                discordImage: p.user.image,
                pseudoDofus: p.pseudoDofus,
                classe: p.classe,
                value: p.contributionPoints || 0,
                isCurrentUser: p.id === currentProfile?.id,
                isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? "")
            };
        });

        return { success: true, data: ladder };
    } catch (error) {
        console.error("[getContributionLadder] Error:", error);
        return { success: false, error: "Erreur lors du chargement du classement de contribution" };
    }
}

/**
 * Get Guildatons Ladder (Guild currency ranking)
 */
export async function getGuildatonsLadder(
    guildId: string
): Promise<ActionResponse<LadderEntry[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, rolesMapping: true }
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
                guildatons: { gt: 0 }
            },
            select: {
                id: true,
                discordNickname: true,
                discordRoleColor: true,
                discordRoleName: true,
                discordJoinedAt: true,
                pseudoDofus: true,
                classe: true,
                guildatons: true,
                user: {
                    select: { image: true }
                }
            },
            orderBy: [
                { guildatons: "desc" },
                { discordJoinedAt: "asc" } // Tie-breaker
            ]
        });

        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const adminRoleNames = new Set<string>();
        for (const [roleId, perms] of Object.entries(rolesMapping)) {
            if (perms.includes("admin:access")) adminRoleNames.add(roleId);
        }

        const ladder: LadderEntry[] = profiles.map((p, idx) => {
            return {
                rank: idx + 1,
                profileId: p.id,
                discordNickname: p.discordNickname,
                discordRoleColor: p.discordRoleColor,
                discordImage: p.user.image,
                pseudoDofus: p.pseudoDofus,
                classe: p.classe,
                value: p.guildatons || 0,
                isCurrentUser: p.id === currentProfile?.id,
                isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? "")
            };
        });

        return { success: true, data: ladder };
    } catch (error) {
        console.error("[getGuildatonsLadder] Error:", error);
        return { success: false, error: "Erreur lors du chargement du classement de guildatons" };
    }
}
