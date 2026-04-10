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
    metric: "messages" | "voice",
    view: ActivityView = "weekly",
    page: number = 1,
    pageSize: number = 25
): Promise<ActionResponse<LadderResponse>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Unauthorized" };

        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
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
        const allRankedData = await withCache(cacheKey, 60, async () => {
            // Determine field name based on metric and view
            let field: string;
            if (metric === "messages") {
                if (view === "weekly") field = "discordMessageCountWeekly";
                else if (view === "monthly") field = "discordMessageCountMonthly";
                else field = "discordMessageCountTotal";
            } else {
                if (view === "weekly") field = "discordVoiceTimeWeekly";
                else if (view === "monthly") field = "discordVoiceTimeMonthly";
                else field = "discordVoiceTimeTotal";
            }

            const activeProfiles = await db.userProfile.findMany({
                where: { 
                    guildId: guildConfig.id, 
                    status: "ACTIVE",
                    [field]: { gt: 0 } // Only show people with activity
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
            return activeProfiles.map((p, idx) => {
                const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);
                return {
                    rank: idx + 1,
                    profileId: p.id,
                    discordNickname: p.discordNickname,
                    discordRoleColor: p.discordRoleColor,
                    discordImage: p.user.image,
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
                    .map(p => {
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

                return ranked.map((p, idx) => ({
                    rank: idx + 1,
                    profileId: p.id,
                    discordNickname: p.discordNickname,
                    discordRoleColor: p.discordRoleColor,
                    discordImage: p.user.image,
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

                return profiles.map((p, idx) => {
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

        const totalCount = await db.userProfile.count({
            where: { guildId: guildConfig.id, status: "ACTIVE" }
        });

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
            orderBy: { discordJoinedAt: "asc" },
            skip: (page - 1) * pageSize,
            take: pageSize
        });

        const now = new Date();
        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const adminRoleNames = new Set<string>();
        for (const [roleId, perms] of Object.entries(rolesMapping)) {
            if (perms.includes("admin:access")) adminRoleNames.add(roleId);
        }

        const entries: LadderEntry[] = profiles.map((p, idx) => {
            const joinedAt = p.discordJoinedAt || p.createdAt || now;
            const daysInGuild = Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
            const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);

            return {
                rank: ((page - 1) * pageSize) + idx + 1,
                profileId: p.id,
                discordNickname: p.discordNickname,
                discordRoleColor: p.discordRoleColor,
                discordImage: p.user.image,
                pseudoDofus: p.pseudoDofus,
                classe: p.classe,
                value: daysInGuild,
                isCurrentUser: p.id === currentProfile?.id,
                isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? ""),
                isInVacation
            };
        });

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

        const totalCount = await db.userProfile.count({
            where: { guildId: guildConfig.id, status: "ACTIVE" }
        });

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
            ],
            skip: (page - 1) * pageSize,
            take: pageSize
        });

        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const adminRoleNames = new Set<string>();
        for (const [roleId, perms] of Object.entries(rolesMapping)) {
            if (perms.includes("admin:access")) adminRoleNames.add(roleId);
        }

        const entries: LadderEntry[] = profiles.map((p, idx) => {
            const now = new Date();
            const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);
            return {
                rank: ((page - 1) * pageSize) + idx + 1,
                profileId: p.id,
                discordNickname: p.discordNickname,
                discordRoleColor: p.discordRoleColor,
                discordImage: p.user.image,
                pseudoDofus: p.pseudoDofus,
                classe: p.classe,
                value: p.successPoints || 0,
                isCurrentUser: p.id === currentProfile?.id,
                isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? ""),
                isInVacation
            };
        });

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

        const totalCount = await db.userProfile.count({
            where: { guildId: guildConfig.id, status: "ACTIVE" }
        });

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
            ],
            skip: (page - 1) * pageSize,
            take: pageSize
        });

        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const adminRoleNames = new Set<string>();
        for (const [roleId, perms] of Object.entries(rolesMapping)) {
            if (perms.includes("admin:access")) adminRoleNames.add(roleId);
        }

        const entries: LadderEntry[] = profiles.map((p, idx) => {
            const now = new Date();
            const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);
            return {
                rank: ((page - 1) * pageSize) + idx + 1,
                profileId: p.id,
                discordNickname: p.discordNickname,
                discordRoleColor: p.discordRoleColor,
                discordImage: p.user.image,
                pseudoDofus: p.pseudoDofus,
                classe: p.classe,
                dofusLevel: p.dofusLevel || undefined,
                totalXpBigInt: p.totalXp?.toString() || "0",
                value: 0,
                isCurrentUser: p.id === currentProfile?.id,
                isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? ""),
                isInVacation
            };
        });

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

        const totalCount = await db.userProfile.count({
            where: { guildId: guildConfig.id, status: "ACTIVE" }
        });

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
            ],
            skip: (page - 1) * pageSize,
            take: pageSize
        });

        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};
        const adminRoleNames = new Set<string>();
        for (const [roleId, perms] of Object.entries(rolesMapping)) {
            if (perms.includes("admin:access")) adminRoleNames.add(roleId);
        }

        const entries: LadderEntry[] = profiles.map((p, idx) => {
            const now = new Date();
            const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);
            return {
                rank: ((page - 1) * pageSize) + idx + 1,
                profileId: p.id,
                discordNickname: p.discordNickname,
                discordRoleColor: p.discordRoleColor,
                discordImage: p.user.image,
                pseudoDofus: p.pseudoDofus,
                classe: p.classe,
                value: p.contributionPoints || 0,
                isCurrentUser: p.id === currentProfile?.id,
                isAdmin: p.discordRoleName === "Administrateur" || adminRoleNames.has(p.discordRoleName ?? ""),
                isInVacation
            };
        });

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

                const dotsByProfile = await db.$queryRaw<{ profileId: string; totalDots: number }[]>`
                    WITH MissionDots AS (
                        SELECT s."profileId", COALESCE(SUM(m."guildatonsReward"), 0)::int AS dots
                        FROM "Submission" s
                        JOIN "Mission" m ON s."missionId" = m."id"
                        JOIN "UserProfile" up ON s."profileId" = up."id"
                        WHERE s."status" = 'VALIDATED'
                          AND s."updatedAt" >= ${startDate}
                          AND up."guildId" = ${guildConfig.id}
                        GROUP BY s."profileId"
                    ),
                    KamaDots AS (
                        SELECT k."profileId", COALESCE(SUM(FLOOR(k."amount" / ${KAMA_TRANCHE}) * ${REWARDS_PER_TRANCHE.guildatons || 0}), 0)::int AS dots
                        FROM "KamaDonation" k
                        JOIN "UserProfile" up ON k."profileId" = up."id"
                        WHERE k."status" = 'VALIDATED'
                          AND k."validatedAt" >= ${startDate}
                          AND up."guildId" = ${guildConfig.id}
                        GROUP BY k."profileId"
                    ),
                    CombinedDots AS (
                        SELECT "profileId", dots FROM MissionDots
                        UNION ALL
                        SELECT "profileId", dots FROM KamaDots
                    )
                    SELECT "profileId", COALESCE(SUM(dots), 0)::int AS "totalDots"
                    FROM CombinedDots
                    GROUP BY "profileId"
                `;

                const dotsMap = new Map(dotsByProfile.map(x => [x.profileId, x.totalDots]));

                const ranked = activeProfiles
                    .map(p => {
                        const now = new Date();
                        const isInVacation = !!(p.vacationStart && p.vacationEnd && now >= p.vacationStart && now <= p.vacationEnd);
                        return {
                            ...p,
                            pDots: dotsMap.get(p.id) || 0,
                            isInVacation
                        };
                    })
                    .sort((a, b) => {
                        if (b.pDots !== a.pDots) return b.pDots - a.pDots;
                        return (a.discordJoinedAt?.getTime() || Infinity) - (b.discordJoinedAt?.getTime() || Infinity);
                    });

                return ranked.map((p, idx) => ({
                    rank: idx + 1,
                    profileId: p.id,
                    discordNickname: p.discordNickname,
                    discordRoleColor: p.discordRoleColor,
                    discordImage: p.user.image,
                    pseudoDofus: p.pseudoDofus,
                    classe: p.classe,
                    value: p.pDots,
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

                return profiles.map((p, idx) => {
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
