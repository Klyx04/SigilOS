"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { withCache } from "@/lib/cache";

// ============================================================================
// TYPES
// ============================================================================

export type ActionResponse<T = undefined> = {
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
    isInVacation: boolean;
    // Raid-specific optional fields
    averageScore?: number;
    jardinCount?: number;
    gigalodonCount?: number;
};

export type LadderResponse = {
    entries: LadderEntry[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
};

export type LadderType = "activity" | "seniority" | "success" | "contribution" | "discord_messages" | "discord_voice";
export type ActivityView = "weekly" | "monthly" | "alltime";

// ============================================================================
// LADDER QUERIES
// ============================================================================

/**
 * Get Discord Presence Ladder (Voice Time or Message Count)
 */
export async function getPresenceLadder(
    guildId: string,
    metric: "messages" | "voice" | "characters" | "reactions" | "stream" | "replies",
    view: ActivityView = "weekly",
    page: number = 1,
    pageSize: number = 25
): Promise<ActionResponse<LadderResponse>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Unauthorized" };

        const guildConfig = await db.guildConfig.findUnique({ 
            where: { discordGuildId: guildId },
            select: { id: true, rolesMapping: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const currentProfile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } }
        });

        const skip = (page - 1) * pageSize;
        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const adminRoleNames = new Set(Object.entries(rolesMapping)
            .filter(([_, perms]) => perms.includes("admin:access"))
            .map(([rid, _]) => rid));

        const cacheKey = `ladder:presence:${guildId}:${metric}:${view}`;
        const allRankedData = await withCache(cacheKey, 300, async () => {
            // Determine field name based on metric and view
            let field: string;
            if (metric === "messages") {
                if (view === "weekly") field = "discordMessageCountWeekly";
                else if (view === "monthly") field = "discordMessageCountMonthly";
                else field = "discordMessageCountTotal";
            } else if (metric === "voice") {
                if (view === "weekly") field = "discordVoiceTimeWeekly";
                else if (view === "monthly") field = "discordVoiceTimeMonthly";
                else field = "discordVoiceTimeTotal";
            } else if (metric === "characters") {
                if (view === "weekly") field = "discordCharactersWeekly";
                else if (view === "monthly") field = "discordCharactersMonthly";
                else field = "discordCharactersTotal";
            } else if (metric === "reactions") {
                if (view === "weekly") field = "discordReactionsReceivedWeekly";
                else if (view === "monthly") field = "discordReactionsReceivedMonthly";
                else field = "discordReactionsReceivedTotal";
            } else if (metric === "stream") {
                if (view === "weekly") field = "discordVoiceStreamTimeWeekly";
                else if (view === "monthly") field = "discordVoiceStreamTimeMonthly";
                else field = "discordVoiceStreamTimeTotal";
            } else {
                if (view === "weekly") field = "discordRepliesWeekly";
                else if (view === "monthly") field = "discordRepliesMonthly";
                else field = "discordRepliesTotal";
            }

            const activeProfiles = await db.userProfile.findMany({
                where: { 
                    guildId: guildConfig.id, 
                    status: "ACTIVE"
                },
                select: {
                    id: true,
                    discordNickname: true,
                    discordRoleColor: true,
                    discordRoleName: true,
                    discordJoinedAt: true,
                    pseudoDofus: true,
                    classe: true,
                    vacationStart: true,
                    vacationEnd: true,
                    [field]: true,
                    user: { select: { image: true } },
                },
                orderBy: {
                    [field]: "desc"
                }
            });

            const now = new Date();
            return activeProfiles.map((p: any, idx) => {
                const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= (p.vacationStart as any) && now <= (p.vacationEnd as any));
                return {
                    rank: idx + 1,
                    profileId: p.id,
                    discordNickname: p.discordNickname,
                    discordRoleColor: p.discordRoleColor,
                    discordImage: (p as any).user?.image,
                    pseudoDofus: p.pseudoDofus,
                    classe: p.classe,
                    value: (p as any)[field] || 0,
                    isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? ""),
                    isInVacation
                };
            });
        });

        const totalCount = allRankedData.length;
        const paginatedData = allRankedData.slice(skip, skip + pageSize).map((item: any) => ({
            ...item,
            isCurrentUser: item.profileId === currentProfile?.id
        }));

        return {
            success: true,
            data: {
                entries: paginatedData,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize),
                currentPage: page
            }
        };
    } catch (error) {
        console.error("Presence Ladder Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Get Activity Ladder (XP-based ranking)
 * @param view "monthly" for current month, "alltime" for cumulative
 */
export async function getActivityLadder(
    guildId: string,
    view: ActivityView = "monthly",
    page: number = 1,
    pageSize: number = 25
): Promise<ActionResponse<LadderResponse>> {
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

        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const adminRoleNames = new Set<string>();
        for (const [roleId, perms] of Object.entries(rolesMapping)) {
            if (perms.includes("admin:access")) adminRoleNames.add(roleId);
        }

        // Get current user profile for highlighting
        const currentProfile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guildId: guildConfig.id }
        });

        const skip = (page - 1) * pageSize;

        if (view === "weekly" || view === "monthly") {
            let startDate: Date;

            if (view === "weekly") {
                const now = new Date();
                const day = now.getDay();
                const daysSinceTuesday = (day + 7 - 2) % 7;
                const tuesday = new Date(now);
                tuesday.setDate(now.getDate() - daysSinceTuesday);
                tuesday.setHours(7, 0, 0, 0);
                if (now < tuesday) tuesday.setDate(tuesday.getDate() - 7);
                startDate = tuesday;
            } else {
                const now = new Date();
                startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            }

            const cacheKey = `ladder:activity:${guildId}:${view}:${startDate.getTime()}`;
            const allRankedData = await withCache(cacheKey, 300, async () => {
                const { KAMA_TRANCHE, REWARDS_PER_TRANCHE } = await import("@/lib/kama-constants");
                
                // Fetch ALL active profiles first to ensure they are ranked correctly even if not in the missions/kama tables
                const activeProfiles = await db.userProfile.findMany({
                    where: { guildId: guildConfig.id, status: "ACTIVE" },
                    select: {
                        id: true,
                        discordNickname: true,
                        discordRoleColor: true,
                        discordRoleName: true,
                        discordJoinedAt: true,
                        pseudoDofus: true,
                        classe: true,
                        vacationStart: true,
                        vacationEnd: true,
                        user: { select: { image: true } },
                    }
                });

                // Aggregate XP for the period
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
                `;

                const xpMap = new Map(xpByProfile.map(x => [x.profileId, x.totalXp]));

                // Sort ALL profiles
                const ranked = activeProfiles
                    .map((p: any) => {
                        const now = new Date();
                        const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);
                        return {
                            ...p,
                            pXp: xpMap.get(p.id) || 0,
                            isInVacation
                        };
                    })
                    .sort((a, b) => {
                        if (b.pXp !== a.pXp) return b.pXp - a.pXp;
                        return (a.discordJoinedAt?.getTime() || Infinity) - (b.discordJoinedAt?.getTime() || Infinity);
                    });

                return ranked.map((p: any, idx) => ({
                    rank: idx + 1,
                    profileId: p.id,
                    discordNickname: p.discordNickname,
                    discordRoleColor: p.discordRoleColor,
                    discordImage: (p as any).user?.image,
                    pseudoDofus: p.pseudoDofus,
                    classe: p.classe,
                    value: p.pXp,
                    isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? "")
                }));
            });

            const totalCount = allRankedData.length;
            const paginatedData = allRankedData.slice(skip, skip + pageSize).map((item: any) => ({
                ...item,
                isCurrentUser: item.profileId === currentProfile?.id
            }));

            return {
                success: true,
                data: {
                    entries: paginatedData,
                    totalCount,
                    totalPages: Math.ceil(totalCount / pageSize),
                    currentPage: page
                }
            };
        } else {
            // All-time: use cumulative XP field
            const cacheKey = `ladder:activity:${guildId}:alltime`;
            const allRankedData = await withCache(cacheKey, 600, async () => {
                const profiles = await db.userProfile.findMany({
                    where: { guildId: guildConfig.id, status: "ACTIVE" },
                    select: {
                        id: true,
                        discordNickname: true,
                        discordRoleColor: true,
                        discordRoleName: true,
                        discordJoinedAt: true,
                        pseudoDofus: true,
                        classe: true,
                        xp: true,
                        vacationStart: true,
                        vacationEnd: true,
                        user: { select: { image: true } }
                    },
                    orderBy: [{ xp: "desc" }, { discordJoinedAt: "asc" }]
                });

                return profiles.map((p: any, idx) => {
                    const now = new Date();
                    const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);
                    return {
                        rank: idx + 1,
                        profileId: p.id,
                        discordNickname: p.discordNickname,
                        discordRoleColor: p.discordRoleColor,
                        discordImage: (p as any).user?.image,
                        pseudoDofus: p.pseudoDofus,
                        classe: p.classe,
                        value: p.xp,
                        isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? ""),
                        isInVacation
                    };
                });
            });

            const totalCount = allRankedData.length;
            const paginatedData = allRankedData.slice(skip, skip + pageSize).map((item: any) => ({
                ...item,
                isCurrentUser: item.profileId === currentProfile?.id
            }));

            return {
                success: true,
                data: {
                    entries: paginatedData,
                    totalCount,
                    totalPages: Math.ceil(totalCount / pageSize),
                    currentPage: page
                }
            };
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
    guildId: string,
    page: number = 1,
    pageSize: number = 25
): Promise<ActionResponse<LadderResponse>> {
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

        const skip = (page - 1) * pageSize;
        const cacheKey = `ladder:seniority:${guildId}`;
        const allRankedData = await withCache(cacheKey, 600, async () => {
            const profiles = await db.userProfile.findMany({
                where: {
                    guildId: guildConfig.id,
                    status: "ACTIVE"
                },
                select: {
                    id: true,
                    discordNickname: true,
                    discordRoleColor: true,
                    discordRoleName: true,
                    discordJoinedAt: true,
                    pseudoDofus: true,
                    classe: true,
                    createdAt: true,
                    vacationStart: true,
                    vacationEnd: true,
                    user: {
                        select: { image: true }
                    }
                },
                orderBy: { discordJoinedAt: "asc" }
            });

            const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
            const adminRoleNames = new Set<string>();
            for (const [roleId, perms] of Object.entries(rolesMapping)) {
                if (perms.includes("admin:access")) adminRoleNames.add(roleId);
            }

            const now = new Date();
            return profiles.map((p: any, idx) => {
                const joinedAt = p.discordJoinedAt || p.createdAt || now;
                const daysInGuild = Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
                const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);

                return {
                    rank: idx + 1,
                    profileId: p.id,
                    discordNickname: p.discordNickname,
                    discordRoleColor: p.discordRoleColor,
                    discordImage: p.user.image,
                    pseudoDofus: p.pseudoDofus,
                    classe: p.classe,
                    value: daysInGuild,
                    isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? ""),
                    isInVacation
                };
            });
        });

        const totalCount = allRankedData.length;
        const entries = allRankedData.slice(skip, skip + pageSize).map((item: any) => ({
            ...item,
            isCurrentUser: item.profileId === currentProfile?.id
        }));

        return {
            success: true,
            data: {
                entries,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize),
                currentPage: page
            }
        };
    } catch (error) {
        console.error("[getSeniorityLadder] Error:", error);
        return { success: false, error: "Erreur lors du chargement du classement" };
    }
}

/**
 * Get Success Ladder (Achievement points ranking)
 */
export async function getSuccessLadder(
    guildId: string,
    page: number = 1,
    pageSize: number = 25
): Promise<ActionResponse<LadderResponse>> {
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

        const skip = (page - 1) * pageSize;
        const cacheKey = `ladder:success:${guildId}`;
        const allRankedData = await withCache(cacheKey, 600, async () => {
            const profiles = await db.userProfile.findMany({
                where: {
                    guildId: guildConfig.id,
                    status: "ACTIVE"
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
                    vacationStart: true,
                    vacationEnd: true,
                    user: {
                        select: { image: true }
                    }
                },
                orderBy: [
                    { successPoints: "desc" },
                    { discordJoinedAt: "asc" }
                ]
            });

            const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
            const adminRoleNames = new Set<string>();
            for (const [roleId, perms] of Object.entries(rolesMapping)) {
                if (perms.includes("admin:access")) adminRoleNames.add(roleId);
            }

            return profiles.map((p: any, idx) => {
                const now = new Date();
                const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);
                return {
                    rank: idx + 1,
                    profileId: p.id,
                    discordNickname: p.discordNickname,
                    discordRoleColor: p.discordRoleColor,
                    discordImage: p.user.image,
                    pseudoDofus: p.pseudoDofus,
                    classe: p.classe,
                    value: p.successPoints || 0,
                    isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? ""),
                    isInVacation
                };
            });
        });

        const totalCount = allRankedData.length;
        const entries = allRankedData.slice(skip, skip + pageSize).map((item: any) => ({
            ...item,
            isCurrentUser: item.profileId === currentProfile?.id
        }));

        return {
            success: true,
            data: {
                entries,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize),
                currentPage: page
            }
        };
    } catch (error) {
        console.error("[getSuccessLadder] Error:", error);
        return { success: false, error: "Erreur lors du chargement du classement des succès" };
    }
}

/**
 * Get General Ladder (Total XP ranking)
 */
export async function getGeneralLadder(
    guildId: string,
    page: number = 1,
    pageSize: number = 25
): Promise<ActionResponse<LadderResponse>> {
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

        const skip = (page - 1) * pageSize;
        const cacheKey = `ladder:general:${guildId}`;
        const allRankedData = await withCache(cacheKey, 600, async () => {
            const profiles = await db.userProfile.findMany({
                where: {
                    guildId: guildConfig.id,
                    status: "ACTIVE"
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
                    vacationStart: true,
                    vacationEnd: true,
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

            return profiles.map((p: any, idx) => {
                const now = new Date();
                const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);
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
                    value: 0,
                    isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? ""),
                    isInVacation
                };
            });
        });

        const totalCount = allRankedData.length;
        const entries = allRankedData.slice(skip, skip + pageSize).map((item: any) => ({
            ...item,
            isCurrentUser: item.profileId === currentProfile?.id
        }));

        return {
            success: true,
            data: {
                entries,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize),
                currentPage: page
            }
        };
    } catch (error) {
        console.error("[getGeneralLadder] Error:", error);
        return { success: false, error: "Erreur lors du chargement du classement général" };
    }
}

/**
 * Get Contribution Ladder (Guild contribution points ranking)
 */
export async function getContributionLadder(
    guildId: string,
    page: number = 1,
    pageSize: number = 25
): Promise<ActionResponse<LadderResponse>> {
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

        const skip = (page - 1) * pageSize;
        const cacheKey = `ladder:contribution:${guildId}`;
        const allRankedData = await withCache(cacheKey, 600, async () => {
            const profiles = await db.userProfile.findMany({
                where: {
                    guildId: guildConfig.id,
                    status: "ACTIVE"
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
                    vacationStart: true,
                    vacationEnd: true,
                    user: {
                        select: { image: true }
                    }
                },
                orderBy: [
                    { contributionPoints: "desc" },
                    { discordJoinedAt: "asc" }
                ]
            });

            const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
            const adminRoleNames = new Set<string>();
            for (const [roleId, perms] of Object.entries(rolesMapping)) {
                if (perms.includes("admin:access")) adminRoleNames.add(roleId);
            }

            return profiles.map((p: any, idx) => {
                const now = new Date();
                const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);
                return {
                    rank: idx + 1,
                    profileId: p.id,
                    discordNickname: p.discordNickname,
                    discordRoleColor: p.discordRoleColor,
                    discordImage: p.user.image,
                    pseudoDofus: p.pseudoDofus,
                    classe: p.classe,
                    value: p.contributionPoints || 0,
                    isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? ""),
                    isInVacation
                };
            });
        });

        const totalCount = allRankedData.length;
        const entries = allRankedData.slice(skip, skip + pageSize).map((item: any) => ({
            ...item,
            isCurrentUser: item.profileId === currentProfile?.id
        }));

        return {
            success: true,
            data: {
                entries,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize),
                currentPage: page
            }
        };
    } catch (error) {
        console.error("[getContributionLadder] Error:", error);
        return { success: false, error: "Erreur lors du chargement du classement de contribution" };
    }
}

/**
 * Get Guildatons Ladder (Guild currency ranking)
 * @param view "weekly", "monthly", or "alltime"
 */
export async function getGuildatonsLadder(
    guildId: string,
    view: ActivityView = "alltime",
    page: number = 1,
    pageSize: number = 25
): Promise<ActionResponse<LadderResponse>> {
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

        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const adminRoleNames = new Set<string>();
        for (const [roleId, perms] of Object.entries(rolesMapping)) {
            if (perms.includes("admin:access")) adminRoleNames.add(roleId);
        }

        const skip = (page - 1) * pageSize;

        if (view === "weekly" || view === "monthly") {
            let startDate: Date;
            if (view === "weekly") {
                const now = new Date();
                const daysSinceTuesday = (now.getDay() + 7 - 2) % 7;
                const tuesday = new Date(now);
                tuesday.setDate(now.getDate() - daysSinceTuesday);
                tuesday.setHours(7, 0, 0, 0);
                if (now < tuesday) tuesday.setDate(tuesday.getDate() - 7);
                startDate = tuesday;
            } else {
                const now = new Date();
                startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            }

            const cacheKey = `ladder:guildatons:${guildId}:${view}:${startDate.getTime()}`;
            const allRankedData = await withCache(cacheKey, 300, async () => {
                const { KAMA_TRANCHE, REWARDS_PER_TRANCHE } = await import("@/lib/kama-constants");
                
                const activeProfiles = await db.userProfile.findMany({
                    where: { guildId: guildConfig.id, status: "ACTIVE" },
                    select: {
                        id: true,
                        discordNickname: true,
                        discordRoleColor: true,
                        discordRoleName: true,
                        discordJoinedAt: true,
                        pseudoDofus: true,
                        classe: true,
                        vacationStart: true,
                        vacationEnd: true,
                        user: { select: { image: true } }
                    }
                });

                const guildatonsByProfile = await db.$queryRaw<{ profileId: string; total: number }[]>`
                    WITH MissionG AS (
                        SELECT s."profileId", COALESCE(SUM(m."guildatonsReward"), 0)::int AS g
                        FROM "Submission" s
                        JOIN "Mission" m ON s."missionId" = m."id"
                        JOIN "UserProfile" up ON s."profileId" = up."id"
                        WHERE s."status" = 'VALIDATED'
                          AND s."updatedAt" >= ${startDate}
                          AND up."guildId" = ${guildConfig.id}
                        GROUP BY s."profileId"
                    ),
                    KamaG AS (
                        SELECT k."profileId", COALESCE(SUM(FLOOR(k."amount" / ${KAMA_TRANCHE}) * ${REWARDS_PER_TRANCHE.guildatons || 0}), 0)::int AS g
                        FROM "KamaDonation" k
                        JOIN "UserProfile" up ON k."profileId" = up."id"
                        WHERE k."status" = 'VALIDATED'
                          AND k."validatedAt" >= ${startDate}
                          AND up."guildId" = ${guildConfig.id}
                        GROUP BY k."profileId"
                    ),
                    CombinedG AS (
                        SELECT "profileId", g FROM MissionG
                        UNION ALL
                        SELECT "profileId", g FROM KamaG
                    )
                    SELECT "profileId", COALESCE(SUM(g), 0)::int AS "total"
                    FROM CombinedG
                    GROUP BY "profileId"
                `;

                const guildatonsMap = new Map(guildatonsByProfile.map(g => [g.profileId, g.total]));

                const ranked = activeProfiles
                    .map((p: any) => {
                        const now = new Date();
                        const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);
                        return {
                            ...p,
                            val: guildatonsMap.get(p.id) || 0,
                            isInVacation
                        };
                    })
                    .sort((a, b) => {
                        if (b.val !== a.val) return b.val - a.val;
                        return (a.discordJoinedAt?.getTime() || Infinity) - (b.discordJoinedAt?.getTime() || Infinity);
                    });

                return ranked.map((p: any, idx) => ({
                    rank: idx + 1,
                    profileId: p.id,
                    discordNickname: p.discordNickname,
                    discordRoleColor: p.discordRoleColor,
                    discordImage: (p as any).user?.image,
                    pseudoDofus: p.pseudoDofus,
                    classe: p.classe,
                    value: p.val,
                    isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? ""),
                    isInVacation: p.isInVacation
                }));
            });

            const totalCount = allRankedData.length;
            const paginatedData = allRankedData.slice(skip, skip + pageSize).map((item: any) => ({
                ...item,
                isCurrentUser: item.profileId === currentProfile?.id
            }));

            return {
                success: true,
                data: {
                    entries: paginatedData,
                    totalCount,
                    totalPages: Math.ceil(totalCount / pageSize),
                    currentPage: page
                }
            };
        } else {
            // All-time: cumulative logic
            const cacheKey = `ladder:guildatons:${guildId}:alltime`;
            const allRankedData = await withCache(cacheKey, 600, async () => {
                const profiles = await db.userProfile.findMany({
                    where: { guildId: guildConfig.id, status: "ACTIVE" },
                    select: {
                        id: true,
                        discordNickname: true,
                        discordRoleColor: true,
                        discordRoleName: true,
                        discordJoinedAt: true,
                        pseudoDofus: true,
                        classe: true,
                        guildatons: true,
                        vacationStart: true,
                        vacationEnd: true,
                        user: { select: { image: true } }
                    },
                    orderBy: [{ guildatons: "desc" }, { discordJoinedAt: "asc" }]
                });

                return profiles.map((p: any, idx) => {
                    const now = new Date();
                    const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);
                    return {
                        rank: idx + 1,
                        profileId: p.id,
                        discordNickname: p.discordNickname,
                        discordRoleColor: p.discordRoleColor,
                        discordImage: p.user.image,
                        pseudoDofus: p.pseudoDofus,
                        classe: p.classe,
                        value: p.guildatons || 0,
                        isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? ""),
                        isInVacation
                    };
                });
            });

            const totalCount = allRankedData.length;
            const paginatedData = allRankedData.slice(skip, skip + pageSize).map((item: any) => ({
                ...item,
                isCurrentUser: item.profileId === currentProfile?.id
            }));

            return {
                success: true,
                data: {
                    entries: paginatedData,
                    totalCount,
                    totalPages: Math.ceil(totalCount / pageSize),
                    currentPage: page
                }
            };
        }
    } catch (error) {
        console.error("[getGuildatonsLadder] Error:", error);
        return { success: false, error: "Erreur lors du chargement du classement de guildatons" };
    }
}

/**
 * Get Raid Ladder (Raids completed, counts by type, and scores)
 */
export async function getRaidLadder(
    guildId: string,
    raidType: "all" | "jardin" | "gigalodon" = "all",
    page: number = 1,
    pageSize: number = 25
): Promise<ActionResponse<LadderResponse>> {
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

        const skip = (page - 1) * pageSize;

        // Fetch completed raid events
        const completedRaids = await db.guildEvent.findMany({
            where: {
                guildId: guildConfig.id,
                type: "RAID_OFFICIAL",
                status: "COMPLETED"
            },
            select: {
                id: true,
                metadata: true,
                participants: {
                    select: {
                        userId: true,
                        classe: true
                    }
                }
            }
        });

        // Calculate stats per user
        const statsByUser = new Map<string, {
            userId: string;
            totalCount: number;
            jardinCount: number;
            gigalodonCount: number;
            totalScore: number;
            scoreCount: number;
            classe: string | null;
        }>();

        for (const raid of completedRaids) {
            const meta = raid.metadata as any;
            const type = meta?.raidType || "jardin";
            const scoreStr = meta?.raidScore;
            
            let scoreVal = 0;
            if (scoreStr) {
                const cleaned = scoreStr.replace(/[^\d]/g, "");
                const parsed = parseInt(cleaned);
                if (!isNaN(parsed)) {
                    scoreVal = parsed;
                }
            }

            let participantUserIds: string[] = [];
            if (meta?.raidPresentUserIds && Array.isArray(meta.raidPresentUserIds) && meta.raidPresentUserIds.length > 0) {
                participantUserIds = meta.raidPresentUserIds;
            } else {
                participantUserIds = raid.participants.map(p => p.userId);
            }

            for (const userId of participantUserIds) {
                const pObj = raid.participants.find(p => p.userId === userId);
                const classUsed = pObj?.classe || null;

                let stats = statsByUser.get(userId);
                if (!stats) {
                    stats = {
                        userId,
                        totalCount: 0,
                        jardinCount: 0,
                        gigalodonCount: 0,
                        totalScore: 0,
                        scoreCount: 0,
                        classe: classUsed
                    };
                    statsByUser.set(userId, stats);
                }

                if (classUsed && !stats.classe) {
                    stats.classe = classUsed;
                }

                if (raidType === "all" || raidType === type) {
                    stats.totalCount += 1;
                    if (type === "jardin") {
                        stats.jardinCount += 1;
                    } else if (type === "gigalodon") {
                        stats.gigalodonCount += 1;
                    }

                    if (scoreVal > 0) {
                        stats.totalScore += scoreVal;
                        stats.scoreCount += 1;
                    }
                }
            }
        }

        const profiles = await db.userProfile.findMany({
            where: {
                guildId: guildConfig.id,
                status: "ACTIVE"
            },
            select: {
                id: true,
                userId: true,
                discordNickname: true,
                discordRoleColor: true,
                discordRoleName: true,
                discordJoinedAt: true,
                pseudoDofus: true,
                classe: true,
                vacationStart: true,
                vacationEnd: true,
                user: {
                    select: { image: true }
                }
            }
        });

        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const adminRoleNames = new Set<string>();
        for (const [roleId, perms] of Object.entries(rolesMapping)) {
            if (perms.includes("admin:access")) adminRoleNames.add(roleId);
        }

        const now = new Date();
        const entries = profiles
            .map((p) => {
                const stats = statsByUser.get(p.userId);
                const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);
                const value = stats ? stats.totalCount : 0;

                return {
                    profileId: p.id,
                    discordNickname: p.discordNickname,
                    discordRoleColor: p.discordRoleColor,
                    discordImage: p.user.image,
                    pseudoDofus: p.pseudoDofus,
                    classe: stats?.classe || p.classe,
                    value: value,
                    isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? ""),
                    isInVacation,
                    jardinCount: stats ? stats.jardinCount : 0,
                    gigalodonCount: stats ? stats.gigalodonCount : 0,
                    averageScore: stats && stats.scoreCount > 0 ? (stats.totalScore / stats.scoreCount) : 0
                };
            })
            .filter(entry => raidType === "all" || entry.value > 0)
            .sort((a, b) => {
                if (b.value !== a.value) return b.value - a.value;
                if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
                return (a.discordNickname || "").localeCompare(b.discordNickname || "");
            })
            .map((entry, idx) => ({
                ...entry,
                rank: idx + 1
            }));

        const totalCount = entries.length;
        const paginatedData = entries.slice(skip, skip + pageSize).map((item) => ({
            ...item,
            isCurrentUser: item.profileId === currentProfile?.id
        }));

        return {
            success: true,
            data: {
                entries: paginatedData,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize),
                currentPage: page
            }
        };
    } catch (error) {
        console.error("[getRaidLadder] Error:", error);
        return { success: false, error: "Erreur lors du chargement du classement des raids" };
    }
}


