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

interface ServicesStats {
    loans: {
        total: number;
        active: number;
        returned: number;
        cancelled: number;
        topLenders: LeaderboardEntry[];
    };
    vault: {
        totalDeposits: number;
        totalWithdrawals: number;
        topContributors: LeaderboardEntry[];
        topItem: string | null;
    };
}

export interface GuildStats {
    // KPI
    activeMembers: number;
    totalXp: number;
    totalGuildatons: number; // Current balance
    totalGuildatonsEarned: number; // Sum of rewards
    totalKamasCollected: number; // Sum of kama donations
    totalMissionsValidated: number;
    validationRate: number;
    totalSongesCompleted: number;
    totalEvents: number;
    totalEntraidePoints: number;

    // Charts
    weeklyActivity: WeeklyActivity[];
    missionsByCategory: CategoryBreakdown[];
    topValidators: LeaderboardEntry[];
    topDonors: LeaderboardEntry[];
    topAchievers: LeaderboardEntry[];

    // Sections
    songes: SongesStats;
    events: EventsStats;
    community: CommunityStats;
    services: ServicesStats;
    records: GuildRecord[];
}

// ============================================
// MAIN ACTION
// ============================================

// Simple in-memory cache to prevent DB saturation
const statsCache = new Map<string, { stats: GuildStats; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

export async function getGuildStats(guildId: string): Promise<{
    success: boolean;
    error?: string;
    stats?: GuildStats;
}> {
    // Check Cache
    const cached = statsCache.get(guildId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return { success: true, stats: cached.stats };
    }
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
            candidaturesByStatus,
            allEvents,
            eventParticipants,
            helpCreditsAgg,
            contributionAgg,
            ocreAccepted,
            pollsCreated,
            pollVoters,
            bonusesByStatus,
            topXpMember,
            oldestMember,
            loansByStatus,
            loansByLender,
            vaultDeposits,
            vaultWithdrawals,
            vaultByProfile,
            vaultTopItem,
            validatedKamaDonations,
            validatedMissionsWithRewards,
            kamaDonorsAgg,
            topAchieversProfiles,
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
            // -- Services (loans + vault) --
            db.guildLoan.groupBy({
                by: ["status"],
                where: { guildId: internalGuildId },
                _count: true,
            }),
            db.guildLoan.groupBy({
                by: ["lenderId"],
                where: { guildId: internalGuildId },
                _count: true,
                orderBy: { _count: { lenderId: "desc" } },
                take: 5,
            }),
            db.vaultEntry.count({ where: { guildId: internalGuildId, action: "DEPOSIT" } }),
            db.vaultEntry.count({ where: { guildId: internalGuildId, action: "WITHDRAW" } }),
            db.vaultEntry.groupBy({
                by: ["profileId"],
                where: { guildId: internalGuildId },
                _count: true,
                orderBy: { _count: { profileId: "desc" } },
                take: 5,
            }),
            db.vaultEntry.groupBy({
                by: ["itemName"],
                where: { guildId: internalGuildId },
                _count: true,
                orderBy: { _count: { itemName: "desc" } },
                take: 1,
            }),
            // -- Kama & Guildatons Earned --
            db.kamaDonation.findMany({
                where: { guildId: internalGuildId, status: "VALIDATED" },
                select: { amount: true },
            }),
            db.submission.findMany({
                where: { mission: { guildId: internalGuildId }, status: "VALIDATED" },
                select: { mission: { select: { guildatonsReward: true } } },
            }),
            // -- Top Leaders --
            db.kamaDonation.groupBy({
                by: ["profileId"],
                where: { guildId: internalGuildId, status: "VALIDATED" },
                _sum: { amount: true },
                orderBy: { _sum: { amount: "desc" } },
                take: 5,
            }),
            db.userProfile.findMany({
                where: { guildId: internalGuildId, status: "ACTIVE", successPoints: { gt: 0 } },
                orderBy: { successPoints: "desc" },
                take: 5,
                select: { id: true, discordNickname: true, pseudoDofus: true, successPoints: true, user: { select: { name: true } } },
            }),
        ]);

        // ===== PROCESS RESULTS =====

        // -- Guildatons & Kama calculations --
        const { KAMA_TRANCHE, REWARDS_PER_TRANCHE } = await import("@/lib/kama-constants");
        const totalKamasCollected = validatedKamaDonations.reduce((acc, d) => acc + d.amount, 0);
        const guildatonsFromKamas = validatedKamaDonations.reduce((acc, d) => acc + (Math.floor(d.amount / KAMA_TRANCHE) * REWARDS_PER_TRANCHE.guildatons), 0);
        const guildatonsFromMissions = validatedMissionsWithRewards.reduce((acc, s) => acc + (s.mission.guildatonsReward || 0), 0);
        const totalGuildatonsEarned = guildatonsFromKamas + guildatonsFromMissions;

        const validationRate = totalSubmissions > 0 ? Math.round((validatedSubmissions / totalSubmissions) * 100) : 0;

        const weeklyActivity = await getWeeklyActivity(internalGuildId);
        const missionsByCategory = await getMissionCategoryStats(internalGuildId, missionCategories);
        const topValidators = await getTopValidators(internalGuildId);
        const topDonors = await resolveLeaderboard(
            kamaDonorsAgg.map(d => [d.profileId, d._sum.amount || 0] as [string, number]),
            internalGuildId,
            "profileId"
        );
        const topAchievers = topAchieversProfiles.map(p => ({
            name: getName(p),
            value: p.successPoints || 0
        }));

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

        const candidaturesTotal = candidaturesByStatus.reduce((acc, c) => acc + c._count, 0);
        const candidaturesAccepted = candidaturesByStatus.find(c => c.status === "ACCEPTED")?._count || 0;

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
            helpCreditsAgg.map(h => [h.toUserId, h._sum.points || 0] as [string, number]),
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

        // -- Services stats --
        const loansTotal = loansByStatus.reduce((acc, s) => acc + s._count, 0);
        const loansActive = loansByStatus.find(s => s.status === "ACTIVE")?._count ?? 0
            + (loansByStatus.find(s => s.status === "PARTIAL")?._count ?? 0);
        const loansReturned = loansByStatus.find(s => s.status === "RETURNED")?._count ?? 0;
        const loansCancelled = loansByStatus.find(s => s.status === "CANCELLED")?._count ?? 0;

        const topLenders = await resolveLeaderboard(
            loansByLender.map(l => [l.lenderId, l._count] as [string, number]),
            internalGuildId,
            "profileId"
        );

        const topVaultContributors = await resolveLeaderboard(
            vaultByProfile.map(v => [v.profileId, v._count] as [string, number]),
            internalGuildId,
            "profileId"
        );

        const stats: GuildStats = {
            activeMembers,
            totalXp: xpAgg._sum.xp || 0,
            totalGuildatons: guildatonsAgg._sum.guildatons || 0,
            totalGuildatonsEarned,
            totalKamasCollected,
            totalMissionsValidated: validatedSubmissions,
            validationRate,
            totalSongesCompleted: songesCompleted,
            totalEvents: allEvents.length,
            totalEntraidePoints: entraideAgg._sum.points || 0,
            weeklyActivity,
            missionsByCategory,
            topValidators,
            topDonors,
            topAchievers,
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
                bonusesPurchased: bonusesByStatus.reduce((acc, b) => acc + b._count, 0),
                bonusByType: bonusesByStatus.map(b => ({ type: b.bonusType, count: b._count })),
            },
            services: {
                loans: {
                    total: loansTotal,
                    active: loansActive,
                    returned: loansReturned,
                    cancelled: loansCancelled,
                    topLenders,
                },
                vault: {
                    totalDeposits: vaultDeposits,
                    totalWithdrawals: vaultWithdrawals,
                    topContributors: topVaultContributors,
                    topItem: vaultTopItem[0]?.itemName ?? null,
                },
            },
            records,
        };

        // Cache for next time
        statsCache.set(guildId, { stats, timestamp: Date.now() });

        return {
            success: true,
            stats
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
    if (entries.length === 0) return [];

    const ids = entries.map(([id]) => id);
    const profiles = await db.userProfile.findMany({
        where: lookupBy === "userId"
            ? { userId: { in: ids }, guildId: internalGuildId }
            : { id: { in: ids } },
        select: {
            id: true,
            userId: true,
            discordNickname: true,
            pseudoDofus: true,
            user: { select: { name: true } }
        },
    });

    const profileMap = new Map();
    profiles.forEach(p => {
        const key = lookupBy === "userId" ? p.userId : p.id;
        profileMap.set(key, p);
    });

    return entries.map(([id, value]) => {
        const profile = profileMap.get(id);
        return { name: getName(profile || {}), value };
    });
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
    // 1. Get all validated counts in a single query
    const validatedCounts = await db.submission.groupBy({
        by: ["missionId"],
        where: {
            mission: { 
                guildId: internalGuildId,
                category: { in: categories.map(c => c.category) as any }
            },
            status: "VALIDATED"
        },
        _count: true
    });

    // 2. We need to sum them by category since groupBy by mission doesn't give category directly easily with current schema path
    // Actually, mission.category is available if we use mission: { select: { category: true } } but groupBy doesn't support nested select.
    // Better: Query missions with their category and count validated submissions.
    
    // Alternative: Just query all validated submissions for these categories in this guild
    const submissions = await db.submission.findMany({
        where: {
            mission: {
                guildId: internalGuildId,
                category: { in: categories.map(c => c.category) as any }
            },
            status: "VALIDATED"
        },
        select: {
            mission: {
                select: { category: true }
            }
        }
    });

    const categoryMap: Record<string, number> = {};
    submissions.forEach(s => {
        const cat = s.mission.category;
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });

    return categories.map(cat => ({
        category: cat.category,
        count: cat._count,
        validated: categoryMap[cat.category] || 0
    }));
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
