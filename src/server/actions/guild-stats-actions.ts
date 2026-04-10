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

interface SocialStats {
    totalMessages: number;
    totalVoiceMinutes: number;
    topTalkers: LeaderboardEntry[];
    topVocal: LeaderboardEntry[];
}

interface QuestStats {
    ownership: { slug: string; name: string; count: number; total: number }[];
    topProgressors: LeaderboardEntry[];
    bottlenecks: { questName: string; count: number }[];
    guildCompletionRate: number;
    recentDofus: { name: string; username: string; obtainedAt: Date }[];
}

interface MiniGameGlobalStats {
    totalGamesPlayed: number;
    totalPointsRanked: number;
    records: {
        sigilKing: { name: string; score: number };
        skribbl: { name: string; score: number };
        geoguesser: { name: string; score: number };
    };
}

interface AdminPerformance {
    avgValidationHours: number;
    totalValidations: number;
    topValidatorsMonth: LeaderboardEntry[];
}

interface RetentionStats {
    growth: { month: string; joins: number; leaves: number }[];
    totalJoins: number;
    avgTenureDays: number;
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
    social: SocialStats;
    miniGames: MiniGameGlobalStats;
    performance: AdminPerformance;
    retention: RetentionStats;
    quests: QuestStats;
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
        // ===== BATCHED PARALLEL QUERIES =====
        // Split into 3 primary batches to avoid exhausting the DB connection pool.

        // --- BATCH 1: Core KPIs & Member data ---
        const [
            activeMembers,
            xpAgg,
            guildatonsAgg,
            totalSubmissions,
            validatedSubmissions,
            entraideAgg,
            songesAll,
            songesFloorAvg,
            candidaturesByStatus,
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
        ]);

        // --- BATCH 2: Events, Community & Leaderboards ---
        const resultsBatch2 = await Promise.all([
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
            // NEW: Social Stats (Bulk profiles)
            db.userProfile.findMany({
                where: { guildId: internalGuildId, status: "ACTIVE" },
                select: { id: true, discordNickname: true, pseudoDofus: true, discordMessageCountWeekly: true, discordVoiceTimeWeekly: true, user: { select: { name: true } } },
                orderBy: { discordMessageCountWeekly: "desc" },
                take: 100, // For aggregation + top talkers
            }),
            db.sigilKingScore.count({ where: { guildId } }),
            db.skribblScore.count({ where: { guildId } }),
            db.geoguesserScore.count({ where: { guildId } }),
        ]);

        const [
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
        ] = resultsBatch2 as any[];

        const socialProfiles = resultsBatch2[10] as any[];
        const skCount = resultsBatch2[11] as number;
        const skribblCount = resultsBatch2[12] as number;
        const geoCount = resultsBatch2[13] as number;

        // --- BATCH 3: Services, Kama & Top Achievers ---
        // NOTE: missionsWithValidatedSubs replaces the old validatedMissionsWithRewards findMany.
        // Instead of loading one row per submission (potentially thousands), we load one row
        // per mission and multiply reward × validated_count. Much more efficient.
        const resultsBatch3 = await Promise.all([
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
            db.kamaDonation.findMany({
                where: { guildId: internalGuildId, status: "VALIDATED" },
                select: { amount: true },
            }),
            // One row per mission with count of validated submissions — replaces full submission scan
            db.mission.findMany({
                where: { guildId: internalGuildId },
                select: {
                    guildatonsReward: true,
                    _count: { select: { submissions: { where: { status: "VALIDATED" } } } },
                },
            }),
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
            // NEW: Admin Performance (Validation time)
            db.submission.findMany({
                where: { mission: { guildId: internalGuildId }, status: "VALIDATED" },
                select: { createdAt: true, updatedAt: true },
                orderBy: { updatedAt: "desc" },
                take: 100, // Recent average
            }),
            // NEW: Retention raw data (Joins last 6 mo)
            db.userProfile.findMany({
                where: { guildId: internalGuildId },
                select: { createdAt: true, archivedAt: true },
                orderBy: { createdAt: "asc" },
            }),
            // NEW: Mini Game Records
            db.sigilKingRank.findFirst({ where: { guildId }, orderBy: { bestScore: "desc" }, select: { userName: true, bestScore: true } }),
            db.skribblRank.findFirst({ where: { guildId }, orderBy: { bestScore: "desc" }, select: { userName: true, bestScore: true } }),
            db.geoguesserRank.findFirst({ where: { guildId }, orderBy: { bestScore: "desc" }, select: { userName: true, bestScore: true } }),
            // NEW: Quest Stats Batching
            db.playerDofusProgress.groupBy({
                by: ["dofusId"],
                where: { guildId, isObtained: true },
                _count: true,
            }),
            db.playerDofusQuestProgress.groupBy({
                by: ["questId"],
                where: { guildId, status: "IN_PROGRESS" },
                _count: true,
                orderBy: { _count: { questId: "desc" } },
                take: 10,
            }),
            db.playerDofusProgress.findMany({
                where: { guildId, isObtained: true },
                orderBy: { obtainedAt: "desc" },
                take: 5,
                select: {
                    obtainedAt: true,
                    dofus: { select: { name: true } },
                    profile: { select: { discordNickname: true, pseudoDofus: true, user: { select: { name: true } } } }
                }
            }),
            db.playerDofusProgress.groupBy({
                by: ["profileId"],
                where: { guildId },
                _avg: { completionPercent: true },
                orderBy: { _avg: { completionPercent: "desc" } },
                take: 10
            })
        ]);

        const [
            loansByStatus,
            loansByLender,
            vaultDeposits,
            vaultWithdrawals,
            vaultByProfile,
            vaultTopItem,
            validatedKamaDonations,
            missionsWithValidatedSubs,
            kamaDonorsAgg,
            topAchieversProfiles,
        ] = resultsBatch3 as any[];

        const performanceData = resultsBatch3[10] as { createdAt: Date, updatedAt: Date }[];
        const retentionData = resultsBatch3[11] as { createdAt: Date, archivedAt: Date | null }[];
        const recordSK = resultsBatch3[12] as any;
        const recordSkribbl = resultsBatch3[13] as any;
        const recordGeo = resultsBatch3[14] as any;

        // ===== PRE-PROCESS IN-MEMORY (no DB calls) =====

        const { KAMA_TRANCHE, REWARDS_PER_TRANCHE } = await import("@/lib/kama-constants");
        const totalKamasCollected = validatedKamaDonations.reduce((acc: number, d: any) => acc + d.amount, 0);
        const guildatonsFromKamas = validatedKamaDonations.reduce(
            (acc: number, d: any) => acc + (Math.floor(d.amount / KAMA_TRANCHE) * REWARDS_PER_TRANCHE.guildatons),
            0
        );
        // Compute guildatons from missions: reward × count of validated subs per mission
        const guildatonsFromMissions = missionsWithValidatedSubs.reduce(
            (acc: number, m: any) => acc + (m.guildatonsReward || 0) * m._count.submissions,
            0
        );
        const totalGuildatonsEarned = guildatonsFromKamas + guildatonsFromMissions;

        const validationRate = totalSubmissions > 0 ? Math.round((validatedSubmissions / totalSubmissions) * 100) : 0;

        // Pre-compute leader/organizer counts (pure JS, instant)
        const leaderCounts: Record<string, number> = {};
        songesAll.filter((r: any) => r.status === "COMPLETED").forEach((r: any) => {
            leaderCounts[r.leaderId] = (leaderCounts[r.leaderId] || 0) + 1;
        });

        const eventsByType: Record<string, number> = {};
        const organizerCounts: Record<string, number> = {};
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        let eventsThisMonth = 0;
        allEvents.forEach((e: any) => {
            eventsByType[e.type] = (eventsByType[e.type] || 0) + 1;
            organizerCounts[e.creatorId] = (organizerCounts[e.creatorId] || 0) + 1;
            if (e.startDate >= startOfMonth) eventsThisMonth++;
        });

        // --- BATCH 4: All leaderboard resolvers + helpers in parallel ---
        // Previously these were 9 sequential DB calls. Now they run concurrently.
        const resultsBatch4 = await Promise.all([
            getWeeklyActivity(internalGuildId),
            getMissionCategoryStats(internalGuildId),
            getTopValidators(internalGuildId),
            resolveLeaderboard(
                kamaDonorsAgg.map((d: any) => [d.profileId, d._sum.amount || 0] as [string, number]),
                internalGuildId,
                "profileId"
            ),
            resolveLeaderboard(
                Object.entries(leaderCounts).sort(([, a], [, b]) => b - a).slice(0, 5),
                internalGuildId,
                "userId"
            ),
            resolveLeaderboard(
                Object.entries(organizerCounts).sort(([, a], [, b]) => b - a).slice(0, 5),
                internalGuildId,
                "userId"
            ),
            resolveLeaderboard(
                helpCreditsAgg.map((h: any) => [h.toUserId, h._sum.points || 0] as [string, number]),
                internalGuildId,
                "userId"
            ),
            resolveLeaderboard(
                loansByLender.map((l: any) => [l.lenderId, l._count] as [string, number]),
                internalGuildId,
                "profileId"
            ),
            resolveLeaderboard(
                vaultByProfile.map((v: any) => [v.profileId, v._count] as [string, number]),
                internalGuildId,
                "profileId"
            ),
            // NEW: Dofus Meta Data Resolvers
            db.dofusItem.findMany({
                select: { id: true, slug: true, name: true }
            }),
            db.dofusQuestEntry.findMany({
                where: { id: { in: (resultsBatch3[16] as any[]).map(q => q.questId) } },
                select: { id: true, name: true }
            })
        ]);

        const [
            weeklyActivity,
            missionsByCategory,
            topValidators,
            topDonors,
            topSongeLeaders,
            topOrganizers,
            topHelpers,
            topLenders,
            topVaultContributors,
            dofusTemplates,
            questTemplates
        ] = resultsBatch4 as any[];

        // Destructure NEW parameters from BATCH 1 & 2
        // Batch 1 extra results index: BATCH1 [9..12]
        // Actually, let's re-access Batch results by index carefully.
        // ===== PROCESS REMAINING RESULTS =====

        const songesCompleted = songesAll.filter((r: any) => r.status === "COMPLETED").length;
        const songesFailed = songesAll.filter((r: any) => r.status === "FAILED").length;
        const songesAbandoned = songesAll.filter((r: any) => r.status === "ABANDONED").length;

        const candidaturesTotal = candidaturesByStatus.reduce((acc: number, c: any) => acc + c._count, 0);
        const candidaturesAccepted = candidaturesByStatus.find((c: any) => c.status === "ACCEPTED")?._count || 0;

        const avgParticipation = eventParticipants.length > 0
            ? Math.round(eventParticipants.reduce((acc: number, p: any) => acc + p._count, 0) / eventParticipants.length)
            : 0;

        const pollParticipationRate = activeMembers > 0
            ? Math.round((pollVoters.length / activeMembers) * 100)
            : 0;

        const topAchievers = topAchieversProfiles.map((p: any) => ({
            name: getName(p),
            value: p.successPoints || 0
        }));

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

        const longestRun = songesAll.reduce((max: number, r: any) => r.currentFloor > max ? r.currentFloor : max, 0);
        if (longestRun > 0) {
            records.push({ label: "Plus haut étage Songes", value: `Étage ${longestRun}`, icon: "mountain" });
        }

        if (weeklyActivity.length > 0) {
            const best = weeklyActivity.reduce((max: any, w: any) => w.submissions > max.submissions ? w : max, weeklyActivity[0]);
            if (best.submissions > 0) {
                records.push({ label: "Semaine la plus active", value: `${best.week} — ${best.submissions} soumissions`, icon: "flame" });
            }
        }

        // -- Services stats --
        const loansTotal = loansByStatus.reduce((acc: number, s: any) => acc + s._count, 0);
        const loansActive = loansByStatus.filter((s: any) => s.status === "ACTIVE" || s.status === "PARTIAL").reduce((acc: number, s: any) => acc + s._count, 0);
        const loansReturned = loansByStatus.find((s: any) => s.status === "RETURNED")?._count ?? 0;
        const loansCancelled = loansByStatus.find((s: any) => s.status === "CANCELLED")?._count ?? 0;

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
                topLeaders: topSongeLeaders,
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
                bonusesPurchased: bonusesByStatus.reduce((acc: number, b: any) => acc + b._count, 0),
                bonusByType: bonusesByStatus.map((b: any) => ({ type: b.bonusType, count: b._count })),
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
            social: {
                totalMessages: socialProfiles.reduce((acc: number, p: any) => acc + (p.discordMessageCountWeekly || 0), 0),
                totalVoiceMinutes: socialProfiles.reduce((acc: number, p: any) => acc + (p.discordVoiceTimeWeekly || 0), 0),
                topTalkers: socialProfiles.sort((a: any, b: any) => (b.discordMessageCountWeekly || 0) - (a.discordMessageCountWeekly || 0)).slice(0, 5).map((p: any) => ({
                    name: getName(p),
                    value: p.discordMessageCountWeekly || 0
                })),
                topVocal: socialProfiles.sort((a: any, b: any) => (b.discordVoiceTimeWeekly || 0) - (a.discordVoiceTimeWeekly || 0)).slice(0, 5).map((p: any) => ({
                    name: getName(p),
                    value: p.discordVoiceTimeWeekly || 0 // Keep raw minutes
                })),
            },
            miniGames: {
                totalGamesPlayed: skCount + skribblCount + geoCount,
                totalPointsRanked: 0, // Simplified for now
                records: {
                    sigilKing: { name: recordSK?.userName || "N/A", score: recordSK?.bestScore || 0 },
                    skribbl: { name: recordSkribbl?.userName || "N/A", score: recordSkribbl?.bestScore || 0 },
                    geoguesser: { name: recordGeo?.userName || "N/A", score: recordGeo?.bestScore || 0 },
                }
            },
            performance: {
                avgValidationHours: performanceData.length > 0
                    ? Math.round((performanceData.reduce((acc: number, s: any) => acc + (s.updatedAt.getTime() - s.createdAt.getTime()), 0) / performanceData.length) / (1000 * 60 * 60) * 10) / 10
                    : 0,
                totalValidations: validatedSubmissions,
                topValidatorsMonth: topValidators,
            },
            retention: {
                growth: [], // Calculated below if needed
                totalJoins: retentionData.length,
                avgTenureDays: retentionData.filter((r: any) => r.archivedAt).length > 0
                    ? Math.round(retentionData.filter((r: any) => r.archivedAt).reduce((acc: number, r: any) => acc + (r.archivedAt!.getTime() - r.createdAt.getTime()), 0) / retentionData.filter((r: any) => r.archivedAt).length / (1000 * 60 * 60 * 24))
                    : 365, // Default/Placeholder
            },
            quests: {
                ownership: dofusTemplates.map(t => ({
                    slug: t.slug,
                    name: t.name,
                    count: (resultsBatch3[15] as any[]).find(o => o.dofusId === t.id)?._count || 0,
                    total: activeMembers
                })).sort((a, b) => b.count - a.count),
                topProgressors: await resolveLeaderboard(
                    (resultsBatch3[18] as any[]).map(p => [p.profileId, Math.round(p._avg.completionPercent || 0)] as [string, number]),
                    internalGuildId,
                    "profileId"
                ),
                bottlenecks: (resultsBatch3[16] as any[]).map(q => ({
                    questName: questTemplates.find(t => t.id === q.questId)?.name || "Quête inconnue",
                    count: q._count
                })),
                guildCompletionRate: (resultsBatch3[18] as any[]).length > 0
                    ? Math.round((resultsBatch3[18] as any[]).reduce((acc: number, p: any) => acc + (p._avg.completionPercent || 0), 0) / (resultsBatch3[18] as any[]).length)
                    : 0,
                recentDofus: (resultsBatch3[17] as any[]).map(rd => ({
                    name: rd.dofus.name,
                    username: getName(rd.profile),
                    obtainedAt: rd.obtainedAt
                }))
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

// Rewritten: one query per mission (not per submission).
// Loads missions with their validated submission count — O(missions) instead of O(submissions).
async function getMissionCategoryStats(internalGuildId: string): Promise<CategoryBreakdown[]> {
    const missions = await db.mission.findMany({
        where: { guildId: internalGuildId },
        select: {
            category: true,
            _count: { select: { submissions: { where: { status: "VALIDATED" } } } },
        },
    });

    const categoryMap: Record<string, { total: number; validated: number }> = {};
    missions.forEach((m: any) => {
        if (!categoryMap[m.category]) categoryMap[m.category] = { total: 0, validated: 0 };
        categoryMap[m.category].total++;
        categoryMap[m.category].validated += m._count.submissions;
    });

    return Object.entries(categoryMap).map(([category, data]) => ({
        category,
        count: data.total,
        validated: data.validated,
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
