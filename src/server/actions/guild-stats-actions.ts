"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";

// ============================================
// TYPES
// ============================================

interface WeeklyActivity {
    week: string;
    submissions: number;
    validated: number;
}

interface CategoryBreakdown {
    category: string;
    count: number;
    validated: number;
}

interface LeaderboardEntry {
    name: string;
    value: number;
}

interface SongesStats {
    total: number;
    completed: number;
    failed: number;
    abandoned: number;
    successRate: number;
    avgFloor: number;
    topLeaders: LeaderboardEntry[];
    totalCandidatures: number;
    acceptedCandidatures: number;
}

interface EventsStats {
    total: number;
    byType: { type: string; count: number }[];
    avgParticipation: number;
    topOrganizers: LeaderboardEntry[];
    thisMonth: number;
}

interface CommunityStats {
    topHelpers: LeaderboardEntry[];
    totalContributionPoints: number;
    ocreTradesAccepted: number;
    pollsCreated: number;
    pollParticipationRate: number;
    bonusesPurchased: number;
    bonusByType: { type: string; count: number }[];
}

interface GuildRecord {
    label: string;
    value: string;
    icon: string;
}

export interface GuildStats {
    // KPI
    activeMembers: number;
    totalXp: number;
    totalGuildatons: number;
    totalMissionsValidated: number;
    validationRate: number;
    totalSongesCompleted: number;
    totalEvents: number;
    totalEntraidePoints: number;

    // Charts
    weeklyActivity: WeeklyActivity[];
    missionsByCategory: CategoryBreakdown[];
    topValidators: LeaderboardEntry[];

    // Sections
    songes: SongesStats;
    events: EventsStats;
    community: CommunityStats;
    records: GuildRecord[];
}

// ============================================
// MAIN ACTION
// ============================================

export async function getGuildStats(guildId: string): Promise<{
    success: boolean;
    error?: string;
    stats?: GuildStats;
}> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.isMember) {
        return { success: false, error: "Non autorisé" };
    }

    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true },
    });
    if (!guildConfig) return { success: false, error: "Guilde introuvable" };

    const internalGuildId = guildConfig.id;

    try {
        // ===== PARALLEL QUERIES =====
        const [
            activeMembers,
            xpAgg,
            guildatonsAgg,
            totalSubmissions,
            validatedSubmissions,
            entraideAgg,
            missionCategories,
            songesAll,
            songesFloorAvg,
            candidatures,
            allEvents,
            eventParticipants,
            helpCredits,
            contributionAgg,
            ocreAccepted,
            pollsCreated,
            pollVoters,
            bonuses,
            topXpMember,
            oldestMember,
        ] = await Promise.all([
            db.userProfile.count({
                where: { guildId: internalGuildId, status: "ACTIVE" },
            }),
            db.userProfile.aggregate({
                where: { guildId: internalGuildId, status: "ACTIVE" },
                _sum: { xp: true },
            }),
            db.userProfile.aggregate({
                where: { guildId: internalGuildId, status: "ACTIVE" },
                _sum: { guildatons: true },
            }),
            db.submission.count({
                where: { mission: { guildId: internalGuildId } },
            }),
            db.submission.count({
                where: { mission: { guildId: internalGuildId }, status: "VALIDATED" },
            }),
            db.helpCredit.aggregate({
                where: { guildId: internalGuildId },
                _sum: { points: true },
            }),
            db.mission.groupBy({
                by: ["category"],
                where: { guildId: internalGuildId },
                _count: true,
            }),
            db.dreamRun.findMany({
                where: { guildId },
                select: { status: true, leaderId: true, currentFloor: true },
            }),
            db.dreamRun.aggregate({
                where: { guildId, status: "COMPLETED" },
                _avg: { currentFloor: true },
            }),
            db.dreamJoinRequest.groupBy({
                by: ["status"],
                where: { run: { guildId } },
                _count: true,
            }),
            db.guildEvent.findMany({
                where: { guildId: internalGuildId },
                select: { id: true, type: true, creatorId: true, startDate: true },
            }),
            db.eventParticipant.groupBy({
                by: ["eventId"],
                where: { event: { guildId: internalGuildId } },
                _count: true,
            }),
            db.helpCredit.groupBy({
                by: ["toUserId"],
                where: { guildId: internalGuildId },
                _sum: { points: true },
                orderBy: { _sum: { points: "desc" } },
                take: 5,
            }),
            db.userProfile.aggregate({
                where: { guildId: internalGuildId, status: "ACTIVE" },
                _sum: { contributionPoints: true },
            }),
            db.ocreTradeRequest.count({
                where: { guildId: internalGuildId, status: "ACCEPTED" },
            }),
            db.poll.count({
                where: { guildId: internalGuildId },
            }),
            db.pollVote.findMany({
                where: { option: { poll: { guildId: internalGuildId } } },
                select: { voterId: true },
                distinct: ["voterId"],
            }),
            db.guildBonus.groupBy({
                by: ["bonusType"],
                where: { guildId: internalGuildId },
                _count: true,
            }),
            db.userProfile.findFirst({
                where: { guildId: internalGuildId, status: "ACTIVE" },
                orderBy: { xp: "desc" },
                select: { discordNickname: true, pseudoDofus: true, xp: true, user: { select: { name: true } } },
            }),
            db.userProfile.findFirst({
                where: { guildId: internalGuildId, status: "ACTIVE", discordJoinedAt: { not: null } },
                orderBy: { discordJoinedAt: "asc" },
                select: { discordNickname: true, pseudoDofus: true, discordJoinedAt: true, user: { select: { name: true } } },
            }),
        ]);

        // ===== PROCESS RESULTS =====

        const validationRate = totalSubmissions > 0
            ? Math.round((validatedSubmissions / totalSubmissions) * 100)
            : 0;

        const weeklyActivity = await getWeeklyActivity(internalGuildId);
        const missionsByCategory = await getMissionCategoryStats(internalGuildId, missionCategories);
        const topValidators = await getTopValidators(internalGuildId);

        // -- Songes --
        const songesCompleted = songesAll.filter(r => r.status === "COMPLETED").length;
        const songesFailed = songesAll.filter(r => r.status === "FAILED").length;
        const songesAbandoned = songesAll.filter(r => r.status === "ABANDONED").length;

        const leaderCounts: Record<string, number> = {};
        songesAll.filter(r => r.status === "COMPLETED").forEach(r => {
            leaderCounts[r.leaderId] = (leaderCounts[r.leaderId] || 0) + 1;
        });
        const topLeaders = await resolveLeaderboard(
            Object.entries(leaderCounts).sort(([, a], [, b]) => b - a).slice(0, 5),
            internalGuildId,
            "userId"
        );

        const candidaturesTotal = candidatures.reduce((acc, c) => acc + c._count, 0);
        const candidaturesAccepted = candidatures.find(c => c.status === "ACCEPTED")?._count || 0;

        // -- Events --
        const eventsByType: Record<string, number> = {};
        const organizerCounts: Record<string, number> = {};
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        let eventsThisMonth = 0;

        allEvents.forEach(e => {
            eventsByType[e.type] = (eventsByType[e.type] || 0) + 1;
            organizerCounts[e.creatorId] = (organizerCounts[e.creatorId] || 0) + 1;
            if (e.startDate >= startOfMonth) eventsThisMonth++;
        });

        const avgParticipation = eventParticipants.length > 0
            ? Math.round(eventParticipants.reduce((acc, p) => acc + p._count, 0) / eventParticipants.length)
            : 0;

        const topOrganizers = await resolveLeaderboard(
            Object.entries(organizerCounts).sort(([, a], [, b]) => b - a).slice(0, 5),
            internalGuildId,
            "userId"
        );

        // -- Community --
        const topHelpers = await resolveLeaderboard(
            helpCredits.map(h => [h.toUserId, h._sum.points || 0] as [string, number]),
            internalGuildId,
            "userId"
        );

        const pollParticipationRate = activeMembers > 0
            ? Math.round((pollVoters.length / activeMembers) * 100)
            : 0;

        // -- Records --
        const records: GuildRecord[] = [];

        if (topXpMember) {
            records.push({
                label: "Plus d'XP",
                value: `${getName(topXpMember)} — ${(topXpMember.xp || 0).toLocaleString("fr-FR")} XP`,
                icon: "crown",
            });
        }

        if (oldestMember?.discordJoinedAt) {
            const days = Math.floor((Date.now() - oldestMember.discordJoinedAt.getTime()) / (1000 * 60 * 60 * 24));
            records.push({
                label: "Doyen de la guilde",
                value: `${getName(oldestMember)} — ${days} jours`,
                icon: "timer",
            });
        }

        const longestRun = songesAll.reduce((max, r) => r.currentFloor > max ? r.currentFloor : max, 0);
        if (longestRun > 0) {
            records.push({ label: "Plus haut étage Songes", value: `Étage ${longestRun}`, icon: "mountain" });
        }

        if (weeklyActivity.length > 0) {
            const best = weeklyActivity.reduce((max, w) => w.submissions > max.submissions ? w : max, weeklyActivity[0]);
            if (best.submissions > 0) {
                records.push({ label: "Semaine la plus active", value: `${best.week} — ${best.submissions} soumissions`, icon: "flame" });
            }
        }

        return {
            success: true,
            stats: {
                activeMembers,
                totalXp: xpAgg._sum.xp || 0,
                totalGuildatons: guildatonsAgg._sum.guildatons || 0,
                totalMissionsValidated: validatedSubmissions,
                validationRate,
                totalSongesCompleted: songesCompleted,
                totalEvents: allEvents.length,
                totalEntraidePoints: entraideAgg._sum.points || 0,
                weeklyActivity,
                missionsByCategory,
                topValidators,
                songes: {
                    total: songesAll.length,
                    completed: songesCompleted,
                    failed: songesFailed,
                    abandoned: songesAbandoned,
                    successRate: songesAll.length > 0 ? Math.round((songesCompleted / songesAll.length) * 100) : 0,
                    avgFloor: Math.round(songesFloorAvg._avg.currentFloor || 0),
                    topLeaders,
                    totalCandidatures: candidaturesTotal,
                    acceptedCandidatures: candidaturesAccepted,
                },
                events: {
                    total: allEvents.length,
                    byType: Object.entries(eventsByType).map(([type, count]) => ({ type, count })),
                    avgParticipation,
                    topOrganizers,
                    thisMonth: eventsThisMonth,
                },
                community: {
                    topHelpers,
                    totalContributionPoints: contributionAgg._sum.contributionPoints || 0,
                    ocreTradesAccepted: ocreAccepted,
                    pollsCreated,
                    pollParticipationRate,
                    bonusesPurchased: bonuses.reduce((acc, b) => acc + b._count, 0),
                    bonusByType: bonuses.map(b => ({ type: b.bonusType, count: b._count })),
                },
                records,
            },
        };
    } catch (error) {
        console.error("[getGuildStats] Error:", error);
        return { success: false, error: "Erreur lors du chargement des statistiques" };
    }
}

// ============================================
// HELPERS
// ============================================

function getName(p: { discordNickname?: string | null; pseudoDofus?: string | null; user?: { name?: string | null } | null }): string {
    return p.discordNickname || p.pseudoDofus || p.user?.name || "Inconnu";
}

async function resolveLeaderboard(
    entries: [string, number][],
    internalGuildId: string,
    lookupBy: "userId" | "profileId"
): Promise<LeaderboardEntry[]> {
    const result: LeaderboardEntry[] = [];
    for (const [id, value] of entries) {
        const profile = await db.userProfile.findFirst({
            where: lookupBy === "userId"
                ? { userId: id, guildId: internalGuildId }
                : { id },
            select: { discordNickname: true, pseudoDofus: true, user: { select: { name: true } } },
        });
        result.push({ name: getName(profile || {}), value });
    }
    return result;
}

async function getWeeklyActivity(internalGuildId: string): Promise<WeeklyActivity[]> {
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const submissions = await db.submission.findMany({
        where: {
            mission: { guildId: internalGuildId },
            createdAt: { gte: twelveWeeksAgo },
        },
        select: { createdAt: true, status: true },
    });

    const weeks: Record<string, { submissions: number; validated: number }> = {};
    for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i * 7);
        const key = `S${getISOWeek(d)}`;
        weeks[key] = { submissions: 0, validated: 0 };
    }

    for (const s of submissions) {
        const key = `S${getISOWeek(s.createdAt)}`;
        if (weeks[key]) {
            weeks[key].submissions++;
            if (s.status === "VALIDATED") weeks[key].validated++;
        }
    }

    return Object.entries(weeks).map(([week, data]) => ({ week, ...data }));
}

async function getMissionCategoryStats(
    internalGuildId: string,
    categories: { category: string; _count: number }[]
): Promise<CategoryBreakdown[]> {
    const result: CategoryBreakdown[] = [];
    for (const cat of categories) {
        const validated = await db.submission.count({
            where: {
                mission: { guildId: internalGuildId, category: cat.category as any },
                status: "VALIDATED",
            },
        });
        result.push({ category: cat.category, count: cat._count, validated });
    }
    return result;
}

async function getTopValidators(internalGuildId: string): Promise<LeaderboardEntry[]> {
    const topProfiles = await db.submission.groupBy({
        by: ["profileId"],
        where: { mission: { guildId: internalGuildId }, status: "VALIDATED" },
        _count: true,
        orderBy: { _count: { profileId: "desc" } },
        take: 5,
    });

    return resolveLeaderboard(
        topProfiles.map(p => [p.profileId, p._count] as [string, number]),
        internalGuildId,
        "profileId"
    );
}

function getISOWeek(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
