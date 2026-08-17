"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { DofusQuestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { publishDofusEvent } from "@/lib/dofus-realtime";
import { rateLimit } from "@/lib/ratelimit";

export type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type DofusItemWithProgress = {
    id: string;
    slug: string;
    name: string;
    nameShort: string;
    element: string | null;
    rarity: string;
    isPrimordial: boolean;
    isSylvestreReq: boolean; // V3
    isMeta: boolean; // V3
    bonusSummary: string | null; // V3
    filterCategory: string;
    filterSubCategory: string | null;
    levelRecommended: number;
    imageUrl: string | null;
    color: string | null;
    displayOrder: number;
    description: string | null;
    successName: string | null;
    // Computed progress for current user
    isObtained: boolean;
    obtainedAt: Date | null;
    completedQuests: number;
    totalQuests: number;
    progressPercent: number;  // V3: weighted
    totalWeight: number;      // V3
    doneWeight: number;       // V3
    notes: string | null;
};

export type QuestPrereqLite = {
    fromQuestId: string;
    name: string;
};

export type DofusChainWithProgress = {
    id: string;
    sectionType: string;
    sectionName: string;
    description: string | null;
    chainOrder: number;
    sectionIcon?: string;
    entries: DofusEntryWithProgress[];
};

export type DofusEntryWithProgress = {
    id: string;
    name: string;
    zone: string | null;
    npcName: string | null;
    npcSubArea: string | null;
    questType: string;
    stepOrder: number;
    isOptional: boolean;
    isLast: boolean;
    notes: string | null;
    requirements: any;
    coords: any;
    itemsRequired: any;
    objectives: any;
    isDungeon: boolean;
    bossName: string | null;
    bossImg: string | null;
    posX: number;
    posY: number;
    dofusdbId: number | null;
    isSynergyCandidate: boolean;
    weight: number; // V3: poids pondéré
    externalRef: string | null; // V3: lien guide externe
    positions: { x: number; y: number; label?: string }[];
    dofusdbUrl: string | null;
    dofuspourlesnoobsUrl: string | null;
    // Computed
    status: DofusQuestStatus;
    completedAt: Date | null;
};

export type MemberProgressDetail = {
    profileId: string;
    pseudo: string;
    image: string | null;
    percent: number;
    currentQuestNames?: string[];
    isObtained: boolean;
};

export type GuildDofusStats = {
    dofusId: string;
    slug: string;
    name: string;
    nameShort: string;
    color: string | null;
    imageUrl: string | null;
    filterCategory: string;
    totalMembers: number;
    obtainedCount: number;
    obtainedPercent: number;
    avgPercent: number;
    membersProgress: MemberProgressDetail[];
};

export type MemberDofusSummary = {
    profileId: string;
    pseudo: string;
    image: string | null;
    dofusObtained: number;
    dofusTotal: number;
    dofusList: { slug: string; name: string; color: string | null; isObtained: boolean }[];
};

export type GuildMemberSummary = {
    profileId: string;
    pseudo: string;
    image: string | null;
    dofusObtained: number;
    dofusTotal: number;
};

export type MemberOnQuest = {
    profileId: string;
    pseudo: string;
    image: string | null;
    status: DofusQuestStatus;
};

export type WarRoomData = {
    hotZones: { zone: string; count: number; members: { pseudo: string; image: string | null }[] } [];
    questSynergies: { questName: string; questId: string; players: { pseudo: string; image: string | null; status: string }[] } [];
    dungeonSynergies: { dungeonName: string; count: number; players: { pseudo: string; image: string | null }[] } [];
};

// ─── LECTURE ─────────────────────────────────────────────────────────────────

/**
 * Récupère la liste de tous les Dofus avec la progression du joueur courant
 */
export async function getDofusListWithProgress(guildId: string, characterName: string = "PRINCIPAL"): Promise<{
    success: boolean;
    error?: string;
    data?: DofusItemWithProgress[];
}> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès refusé" };

    try {
        // Fetch all Dofus items ordered by display order
        const items = await db.dofusItem.findMany({
            orderBy: { displayOrder: "asc" },
            select: {
                id: true,
                slug: true,
                name: true,
                nameShort: true,
                element: true,
                rarity: true,
                isPrimordial: true,
                isSylvestreReq: true,
                isMeta: true,
                bonusSummary: true,
                filterCategory: true,
                filterSubCategory: true,
                levelRecommended: true,
                imageUrl: true,
                color: true,
                displayOrder: true,
                description: true,
                successName: true,
                questChains: {
                    include: {
                        entries: {
                            where: { isOptional: false },
                            select: { id: true, weight: true },
                        },
                    },
                },
                playerProgress: ctx.profileId
                    ? {
                          where: { profileId: ctx.profileId, characterName },
                          select: { isObtained: true, obtainedAt: true, completionPercent: true, notes: true },
                          take: 1,
                      }
                    : false,
            },
        });

        // Fetch quest progress for current user
        const questProgressMap: Map<string, DofusQuestStatus> = new Map();
        if (ctx.profileId) {
            const questProgress = await db.playerDofusQuestProgress.findMany({
                where: {
                    profileId: ctx.profileId,
                    guildId,
                    characterName,
                },
                select: { questId: true, status: true },
            });
            questProgress.forEach((qp: any) => {
                questProgressMap.set(qp.questId, qp.status);
            });
        }

        // Fetch user profile for special progress (Ocre/Metamob)
        let profile = null;
        if (ctx.profileId) {
            profile = await db.userProfile.findUnique({
                where: { id: ctx.profileId },
                select: { ocreProgressSnapshot: true }
            });
        }

        const result: DofusItemWithProgress[] = items.map((item: any) => {
            const progress = item.playerProgress?.[0];
            const allEntries: { id: string; weight: number }[] = item.questChains.flatMap((c: any) =>
                c.entries.map((e: any) => ({ id: e.id, weight: e.weight ?? 1 }))
            );
            // V3: weighted progress calculation
            const totalWeight = allEntries.reduce((sum, e) => sum + e.weight, 0);
            const doneWeight = allEntries
                .filter(e => questProgressMap.get(e.id) === "COMPLETED")
                .reduce((sum, e) => sum + e.weight, 0);
            const completedQuests = allEntries.filter(e => questProgressMap.get(e.id) === "COMPLETED").length;
            const totalQuests = allEntries.length;

            let progressPercent = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0;

            if (progress?.isObtained) {
                progressPercent = 100;
            } else if (item.slug === "ocre" && profile?.ocreProgressSnapshot) {
                // INTELLIGENT PROGRESS SPECIAL CASES
                try {
                    const snap = profile.ocreProgressSnapshot as any;
                    if (snap?.stats?.progressPercent !== undefined) {
                        progressPercent = snap.stats.progressPercent;
                    }
                } catch (e) {}
            } else if (item.slug === "dolmanax" && progress?.completionPercent !== undefined) {
                // For Dolmanax, we store the actual page percentage in completionPercent
                progressPercent = progress.completionPercent;
            } else if (item.isMeta) {
                // SYLVESTRE SPECIAL CASE (V3)
                // 50% Required Dofus, 50% Own Quests
                const sylvestreReqDofus = items.filter(d => d.isSylvestreReq && !d.isMeta);
                const dofusReqTotal = sylvestreReqDofus.length;
                const dofusReqDoneCount = sylvestreReqDofus.filter(d => {
                    const dp = d.playerProgress?.[0];
                    return dp?.isObtained;
                }).length;
                const dofusReqPercent = dofusReqTotal > 0 ? (dofusReqDoneCount / dofusReqTotal) * 100 : 0;
                
                // Own quests percentage (already calculated in progressPercent from entries)
                const questPercent = progressPercent;
                progressPercent = Math.round((dofusReqPercent * 0.5) + (questPercent * 0.5));
            }

            return {
                id: item.id,
                slug: item.slug,
                name: item.name,
                nameShort: item.nameShort,
                element: item.element,
                rarity: item.rarity,
                isPrimordial: item.isPrimordial,
                isSylvestreReq: item.isSylvestreReq ?? false,
                isMeta: item.isMeta ?? false,
                bonusSummary: item.bonusSummary ?? null,
                filterCategory: item.filterCategory,
                filterSubCategory: item.filterSubCategory,
                levelRecommended: item.levelRecommended,
                imageUrl: item.imageUrl,
                color: item.color,
                displayOrder: item.displayOrder,
                description: item.description,
                successName: item.successName,
                isObtained: progress?.isObtained ?? false,
                obtainedAt: progress?.obtainedAt ?? null,
                completedQuests,
                totalQuests,
                totalWeight,
                doneWeight,
                progressPercent,
                notes: progress?.notes ?? null,
            };
        });

        return { success: true, data: result };
    } catch (error) {
        logger.error("[dofus-quest-actions] getDofusListWithProgress error:", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Récupère un Dofus avec toutes ses chaînes de quêtes + progression du joueur
 */
export async function getDofusDetailWithChains(
    guildId: string,
    dofusSlug: string,
    characterName: string = "PRINCIPAL"
): Promise<{
    success: boolean;
    error?: string;
    data?: {
        dofus: DofusItemWithProgress;
        chains: DofusChainWithProgress[];
        prereqsByQuestId?: Record<string, QuestPrereqLite[]>;
    };
}> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès refusé" };

    try {
        const item = await (db as any).dofusItem.findUnique({
            where: { slug: dofusSlug },
            include: {
                questChains: {
                    orderBy: { chainOrder: "asc" },
                    include: {
                        entries: {
                            orderBy: { stepOrder: "asc" },
                        },
                    },
                },
                playerProgress: ctx.profileId
                    ? {
                          where: { profileId: ctx.profileId, characterName },
                          select: { isObtained: true, obtainedAt: true, notes: true, completionPercent: true },
                          take: 1,
                      }
                    : false,
            },
        });

        if (!item) return { success: false, error: "Dofus introuvable" };

        // Fetch quest progress for this user
        const questProgressMap: Map<string, { status: DofusQuestStatus; completedAt: Date | null }> = new Map();
        if (ctx.profileId) {
            const allEntryIds = item.questChains.flatMap((c: any) =>
                c.entries.map((e: any) => e.id)
            );
            if (allEntryIds.length > 0) {
                const questProgress = await (db as any).playerDofusQuestProgress.findMany({
                    where: {
                        profileId: ctx.profileId,
                        questId: { in: allEntryIds },
                        characterName,
                    },
                    select: { questId: true, status: true, completedAt: true },
                });
                questProgress.forEach((qp: any) => {
                    questProgressMap.set(qp.questId, { status: qp.status, completedAt: qp.completedAt });
                });
            }
        }

        // Build chains with progress
        const chains: DofusChainWithProgress[] = item.questChains.map((chain: any) => ({
            id: chain.id,
            sectionType: chain.sectionType,
            sectionName: chain.sectionName,
            description: chain.description,
            chainOrder: chain.chainOrder,
            sectionIcon: chain.sectionIcon ?? "serie-de-quete",
            entries: chain.entries.map((entry: any) => {
                const prog = questProgressMap.get(entry.id);
                return {
                    id: entry.id,
                    name: entry.name,
                    zone: entry.zone,
                    npcName: entry.npcName,
                    npcSubArea: entry.npcSubArea,
                    questType: entry.questType,
                    stepOrder: entry.stepOrder,
                    isOptional: entry.isOptional,
                    isLast: entry.isLast,
                    notes: entry.notes,
                    requirements: entry.requirements,
                    coords: entry.coords,
                    itemsRequired: entry.itemsRequired,
                    dungeonsRequired: entry.dungeonsRequired, // V3
                    objectives: entry.objectives,
                    isDungeon: entry.isDungeon,
                    bossName: entry.bossName,
                    bossImg: entry.bossImg,
                    posX: entry.posX,
                    posY: entry.posY,
                    dofusdbId: entry.dofusdbId,
                    level: entry.level, // V3
                    isSynergyCandidate: entry.isSynergyCandidate,
                    weight: entry.weight ?? 1, // V3
                    externalRef: entry.externalRef ?? null, // V3
                    positions: entry.positions ?? [],
                    dofusdbUrl: entry.dofusdbUrl ?? null,
                    dofuspourlesnoobsUrl: entry.dofuspourlesnoobsUrl ?? null,
                    status: prog?.status ?? "NOT_STARTED",
                    completedAt: prog?.completedAt ?? null,
                };
            }),
        }));

        // Prérequis — qui doit être terminé AVANT telle quête (rendu côté user)
        let prereqsByQuestId: Record<string, QuestPrereqLite[]> = {};
        const allEntryIds = chains.flatMap((c: any) => c.entries.map((e: any) => e.id));
        if (allEntryIds.length > 0) {
            const prereqs = await (db as any).dofusQuestPrerequisite.findMany({
                where: { toQuestId: { in: allEntryIds } },
                select: {
                    toQuestId: true,
                    fromQuestId: true,
                    fromQuest: { select: { name: true } },
                },
            });
            for (const p of prereqs) {
                const list = prereqsByQuestId[p.toQuestId] ?? [];
                list.push({ fromQuestId: p.fromQuestId, name: p.fromQuest?.name ?? "Quête prérequis" });
                prereqsByQuestId[p.toQuestId] = list;
            }
        }

        const progress = item.playerProgress?.[0];
        
        // Fetch user profile for special progress (Ocre/Metamob)
        let profile = null;
        if (ctx.profileId) {
            profile = await db.userProfile.findUnique({
                where: { id: ctx.profileId },
                select: { ocreProgressSnapshot: true }
            });
        }

        const totalQuests = chains
            .flatMap((c) => c.entries)
            .filter((e) => !e.isOptional).length;
        const completedQuests = chains
            .flatMap((c) => c.entries)
            .filter((e) => !e.isOptional && e.status === "COMPLETED").length;

        let progressPercent = totalQuests > 0 ? Math.round((completedQuests / totalQuests) * 100) : 0;

        if (progress?.isObtained) {
            progressPercent = 100;
        } else if (item.slug === "ocre" && profile?.ocreProgressSnapshot) {
            try {
                const snap = profile.ocreProgressSnapshot as any;
                if (snap?.stats?.progressPercent !== undefined) {
                    progressPercent = snap.stats.progressPercent;
                }
            } catch (e) {}
        } else if (item.slug === "dolmanax" && progress?.completionPercent !== undefined) {
            progressPercent = progress.completionPercent;
        } else if (item.isMeta) {
            // Fetch all items to calculate Sylvestre requirements
            const allItems = await db.dofusItem.findMany({
                include: {
                    playerProgress: ctx.profileId ? {
                        where: { profileId: ctx.profileId, characterName },
                        select: { isObtained: true }
                    } : false
                }
            });
            const sylvestreReqDofus = allItems.filter(d => d.isSylvestreReq && !d.isMeta);
            const dofusReqTotal = sylvestreReqDofus.length;
            const dofusReqDoneCount = sylvestreReqDofus.filter(d => (d as any).playerProgress?.[0]?.isObtained).length;
            const dofusReqPercent = dofusReqTotal > 0 ? (dofusReqDoneCount / dofusReqTotal) * 100 : 0;
            
            const questPercent = progressPercent;
            progressPercent = Math.round((dofusReqPercent * 0.5) + (questPercent * 0.5));
        }

        const dofusData: DofusItemWithProgress = {
            id: item.id,
            slug: item.slug,
            name: item.name,
            nameShort: item.nameShort,
            element: item.element,
            rarity: item.rarity,
            isPrimordial: item.isPrimordial,
            isSylvestreReq: item.isSylvestreReq ?? false,
            isMeta: item.isMeta ?? false,
            bonusSummary: item.bonusSummary ?? null,
            filterCategory: item.filterCategory,
            filterSubCategory: item.filterSubCategory,
            levelRecommended: item.levelRecommended,
            imageUrl: item.imageUrl,
            color: item.color,
            displayOrder: item.displayOrder,
            description: item.description,
            successName: item.successName,
            isObtained: progress?.isObtained ?? false,
            obtainedAt: progress?.obtainedAt ?? null,
            completedQuests,
            totalQuests,
            totalWeight: chains.flatMap(c => c.entries).filter(e => !e.isOptional).reduce((s, e) => s + (e.weight ?? 1), 0),
            doneWeight: chains.flatMap(c => c.entries).filter(e => !e.isOptional && e.status === "COMPLETED").reduce((s, e) => s + (e.weight ?? 1), 0),
            progressPercent,
            notes: progress?.notes ?? null,
        };

        return { success: true, data: { dofus: dofusData, chains, prereqsByQuestId } };
    } catch (error) {
        logger.error("[dofus-quest-actions] getDofusDetailWithChains error:", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Statistiques de progression de la guilde sur les Dofus
 */
export async function getGuildDofusStats(guildId: string): Promise<{
    success: boolean;
    error?: string;
    data?: {
        stats: GuildDofusStats[];
        topMembers: MemberDofusSummary[];
        members: GuildMemberSummary[];
        totalMembers: number;
    };
}> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès refusé" };

    try {
        const guildConfig = await (db as any).guildConfig.findFirst({
            where: {
                OR: [{ id: guildId }, { discordGuildId: guildId }],
            },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const internalGuildId = guildConfig.id;

        // Count active members
        const totalMembers = await db.userProfile.count({
            where: { guildId: internalGuildId, status: "ACTIVE" },
        });

        // Get all Dofus items
        const dofusItems = await (db as any).dofusItem.findMany({
            orderBy: { displayOrder: "asc" },
            select: { 
                id: true, 
                slug: true, 
                name: true, 
                nameShort: true, 
                color: true, 
                imageUrl: true,
                filterCategory: true,
            },
        });

        // Get all player Dofus progress for their PRINCIPAL character (avoid duplicates from alts)
        const allProgress = await (db as any).playerDofusProgress.findMany({
            where: { guildId: internalGuildId, characterName: "PRINCIPAL" },
            include: {
                profile: {
                    select: {
                        id: true,
                        discordNickname: true,
                        pseudoDofus: true,
                        user: { select: { image: true } }
                    }
                }
            }
        });

        // Get active quest progress for PRINCIPAL character
        const activeQuests = await (db as any).playerDofusQuestProgress.findMany({
            where: {
                guildId: internalGuildId,
                status: "IN_PROGRESS",
                characterName: "PRINCIPAL"
            },
            include: {
                quest: { select: { id: true, name: true, chain: { select: { dofusId: true } } } }
            }
        });

        const questsByDofusAndProfile = new Map<string, string[]>();
        activeQuests.forEach((aq: any) => {
            const key = `${aq.quest.chain.dofusId}_${aq.profileId}`;
            if (!questsByDofusAndProfile.has(key)) questsByDofusAndProfile.set(key, []);
            questsByDofusAndProfile.get(key)!.push(aq.quest.name);
        });

        const progressMap = new Map<string, MemberProgressDetail[]>();
        allProgress.forEach((p: any) => {
            if (!progressMap.has(p.dofusId)) progressMap.set(p.dofusId, []);
            const currentQuests = questsByDofusAndProfile.get(`${p.dofusId}_${p.profileId}`) || [];
            
            progressMap.get(p.dofusId)!.push({
                profileId: p.profile.id,
                pseudo: p.profile.discordNickname || p.profile.pseudoDofus || "Inconnu",
                image: p.profile.user?.image || null,
                percent: p.completionPercent,
                isObtained: p.isObtained,
                currentQuestNames: currentQuests
            });
        });

        const stats: GuildDofusStats[] = dofusItems.map((d: any) => {
            const members = progressMap.get(d.id) ?? [];
            const obtainedCount = members.filter(m => m.isObtained).length;
            const avgPercent = members.length > 0 
                ? Math.round(members.reduce((sum, m) => sum + m.percent, 0) / members.length)
                : 0;
            
            return {
                dofusId: d.id,
                slug: d.slug,
                name: d.name,
                nameShort: d.nameShort,
                color: d.color,
                imageUrl: d.imageUrl,
                filterCategory: d.filterCategory,
                totalMembers,
                obtainedCount,
                obtainedPercent: totalMembers > 0 ? Math.round((obtainedCount / totalMembers) * 100) : 0,
                avgPercent,
                membersProgress: members.sort((a, b) => b.percent - a.percent)
            };
        });

        // Top members by dofus count
        const progressByMember = new Map<string, Set<string>>();
        allProgress.forEach((p: any) => {
            if (!progressByMember.has(p.profileId)) progressByMember.set(p.profileId, new Set());
            progressByMember.get(p.profileId)!.add(p.dofusId);
        });

        const topProfileIds = [...progressByMember.entries()]
            .sort((a, b) => b[1].size - a[1].size)
            .slice(0, 10)
            .map(([id]) => id);

        const topProfiles = await db.userProfile.findMany({
            where: { id: { in: topProfileIds } },
            select: { id: true, discordNickname: true, pseudoDofus: true },
            take: 10,
        });

        const topMembers: MemberDofusSummary[] = topProfiles.map((p: any) => {
            const obtained = progressByMember.get(p.id) ?? new Set();
            return {
                profileId: p.id,
                pseudo: p.discordNickname || p.pseudoDofus || "Inconnu",
                image: null,
                dofusObtained: obtained.size,
                dofusTotal: dofusItems.length,
                dofusList: dofusItems.map((d: any) => ({
                    slug: d.slug,
                    name: d.nameShort,
                    color: d.color,
                    isObtained: obtained.has(d.id),
                })),
            };
        });

        // Full active member list (for member search across the guild)
        const memberProfiles = await db.userProfile.findMany({
            where: { guildId: internalGuildId, status: "ACTIVE" },
            select: {
                id: true,
                discordNickname: true,
                pseudoDofus: true,
                user: { select: { image: true } },
            },
            orderBy: { discordNickname: "asc" },
        });

        const members: GuildMemberSummary[] = memberProfiles.map((p: any) => {
            const obtained = progressByMember.get(p.id) ?? new Set<string>();
            return {
                profileId: p.id,
                pseudo: p.discordNickname || p.pseudoDofus || "Inconnu",
                image: p.user?.image || null,
                dofusObtained: obtained.size,
                dofusTotal: dofusItems.length,
            };
        });

        return { success: true, data: { stats, topMembers, totalMembers, members } };
    } catch (error) {
        logger.error("[dofus-quest-actions] getGuildDofusStats error:", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Récupère les données de la War Room de guilde (Heatmap, Synergies, Donjons)
 */
export async function getDofusWarRoomData(guildId: string): Promise<ActionResponse<WarRoomData>> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès refusé" };

    try {
        const guildConfig = await (db as any).guildConfig.findFirst({
            where: {
                OR: [{ id: guildId }, { discordGuildId: guildId }],
            },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const internalGuildId = guildConfig.id;

        // 1. Fetch all active progress for this guild (IN_PROGRESS or COMPLETED recently)
        const activeProgress = await (db as any).playerDofusQuestProgress.findMany({
            where: {
                guildId: internalGuildId,
                status: { in: ["IN_PROGRESS", "COMPLETED"] },
                // Only look at progress from the last 30 days to avoid stale data
                updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            },
            include: {
                profile: { 
                    select: { 
                        discordNickname: true, 
                        pseudoDofus: true, 
                        user: { select: { image: true } } 
                    } 
                },
                quest: { select: { id: true, name: true, zone: true, npcSubArea: true, isDungeon: true } }
            }
        });

        // 2. Aggregate Hot Zones
        const zoneMap = new Map<string, { count: number; members: Set<string>; memberDetails: any[] }>();
        activeProgress.forEach((p: any) => {
            const z = p.quest.zone || p.quest.npcSubArea || "Inconnue";
            if (!zoneMap.has(z)) zoneMap.set(z, { count: 0, members: new Set(), memberDetails: [] });
            const data = zoneMap.get(z)!;
            const pseudo = p.profile.discordNickname || p.profile.pseudoDofus || "Inconnu";
            if (!data.members.has(p.profileId)) {
                data.members.add(p.profileId);
                data.memberDetails.push({ pseudo, image: p.profile.user?.image });
            }
        });

        const hotZones = Array.from(zoneMap.entries())
            .map(([zone, data]) => ({ zone, count: data.members.size, members: data.memberDetails }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // 3. Aggregate Quest Synergies
        const questMap = new Map<string, { name: string; players: any[] }>();
        activeProgress.filter((p: any) => p.status === "IN_PROGRESS").forEach((p: any) => {
            if (!questMap.has(p.quest.id)) questMap.set(p.quest.id, { name: p.quest.name, players: [] });
            const pseudo = p.profile.discordNickname || p.profile.pseudoDofus || "Inconnu";
            questMap.get(p.quest.id)!.players.push({ pseudo, image: p.profile.user?.image, status: p.status });
        });

        const questSynergies = Array.from(questMap.entries())
            .map(([questId, data]) => ({ questId, questName: data.name, players: data.players }))
            .filter(q => q.players.length >= 2)
            .sort((a, b) => b.players.length - a.players.length)
            .slice(0, 10);

        // 4. Aggregate Dungeon Synergies
        const dungeonMap = new Map<string, { count: number; players: Set<string>; playerDetails: any[] }>();
        activeProgress.filter((p: any) => p.quest.isDungeon && p.status === "IN_PROGRESS").forEach((p: any) => {
            const d = p.quest.name;
            if (!dungeonMap.has(d)) dungeonMap.set(d, { count: 0, players: new Set(), playerDetails: [] });
            const data = dungeonMap.get(d)!;
            if (!data.players.has(p.profileId)) {
                data.players.add(p.profileId);
                const pseudo = p.profile.discordNickname || p.profile.pseudoDofus || "Inconnu";
                data.playerDetails.push({ pseudo, image: p.profile.user?.image });
            }
        });

        const dungeonSynergies = Array.from(dungeonMap.entries())
            .map(([dungeonName, data]) => ({ dungeonName, count: data.players.size, players: data.playerDetails }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            success: true,
            data: { hotZones, questSynergies, dungeonSynergies }
        };
    } catch (error) {
        logger.error("[getDofusWarRoomData] error:", { error });
        return { success: false, error: "Erreur lors de la calcul de la War Room" };
    }
}

/**
 * Récupère les autres membres de la guilde qui sont sur la même quête
 */
export async function getOtherMembersOnQuest(
    guildId: string,
    questId: string
): Promise<ActionResponse<MemberOnQuest[]>> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès refusé" };

    try {
        const guildConfig = await (db as any).guildConfig.findFirst({
            where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const internalGuildId = guildConfig.id;

        const otherProgress = await (db as any).playerDofusQuestProgress.findMany({
            where: {
                guildId: internalGuildId,
                questId,
                profileId: { not: ctx.profileId },
                status: { in: ["IN_PROGRESS", "COMPLETED"] } // On veut voir ceux qui y sont ou l'ont fini (pour aide)
            },
            include: {
                profile: {
                    select: {
                        id: true,
                        discordNickname: true,
                        pseudoDofus: true,
                        user: { select: { image: true } }
                    }
                }
            },
            orderBy: { status: 'desc' }
        });

        const members: MemberOnQuest[] = otherProgress.map((p: any) => ({
            profileId: p.profile.id,
            pseudo: p.profile.discordNickname || p.profile.pseudoDofus || "Inconnu",
            image: p.profile.user?.image || null,
            status: p.status,
        }));

        return { success: true, data: members };
    } catch (error) {
        logger.error("[getOtherMembersOnQuest] Error:", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Récupère toute la synergie de guilde pour un Dofus (qui est où)
 */
export async function getGuildSynergyForDofus(
    guildId: string,
    dofusId: string
): Promise<ActionResponse<Record<string, MemberOnQuest[]>>> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès refusé" };

    try {
        const guildConfig = await (db as any).guildConfig.findFirst({
            where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const internalGuildId = guildConfig.id;

        // Fetch all progress for all quests of this Dofus for all guild members
        const allProgress = await (db as any).playerDofusQuestProgress.findMany({
            where: {
                guildId: internalGuildId,
                quest: { chain: { dofusId } },
                profileId: { not: ctx.profileId }, // Don't include current user
                status: { in: ["IN_PROGRESS", "COMPLETED"] }
            },
            include: {
                profile: {
                    select: {
                        id: true,
                        discordNickname: true,
                        pseudoDofus: true,
                        user: { select: { image: true } }
                    }
                }
            }
        });

        const synergyMap: Record<string, MemberOnQuest[]> = {};
        allProgress.forEach((p: any) => {
            if (!synergyMap[p.questId]) synergyMap[p.questId] = [];
            synergyMap[p.questId].push({
                profileId: p.profile.id,
                pseudo: p.profile.discordNickname || p.profile.pseudoDofus || "Inconnu",
                image: p.profile.user?.image || null,
                status: p.status,
            });
        });

        return { success: true, data: synergyMap };
    } catch (error) {
        logger.error("[getGuildSynergyForDofus] Error:", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * #112 — Récupère récursivement tous les IDs des quêtes prérequises en amont.
 * Protégé contre les cycles éventuels avec un Set visité et une profondeur max.
 */
async function getAllUpstreamPrerequisites(questId: string): Promise<string[]> {
    const upstreamIds = new Set<string>();
    let currentLevel = [questId];
    let depth = 0;

    while (currentLevel.length > 0 && depth < 20) {
        depth++;
        const prereqs = await (db as any).dofusQuestPrerequisite.findMany({
            where: { toQuestId: { in: currentLevel } },
            select: { fromQuestId: true },
        });

        const nextLevel: string[] = [];
        for (const p of prereqs) {
            if (p.fromQuestId && !upstreamIds.has(p.fromQuestId)) {
                upstreamIds.add(p.fromQuestId);
                nextLevel.push(p.fromQuestId);
            }
        }
        currentLevel = nextLevel;
    }

    return Array.from(upstreamIds);
}

/**
 * #112 — Recalcule et persiste le pourcentage d'avancement pour un Dofus donné.
 */
async function refreshDofusCompletionPercent(
    profileId: string,
    guildConfigId: string,
    dofusId: string,
    characterName: string
) {
    const allEntries = await (db as any).dofusQuestEntry.findMany({
        where: { chain: { dofusId }, isOptional: false },
        select: { id: true, weight: true },
    });
    const entryIds = allEntries.map((e: any) => e.id);
    if (entryIds.length === 0) return;

    const doneEntries = await (db as any).playerDofusQuestProgress.findMany({
        where: { profileId, questId: { in: entryIds }, status: "COMPLETED", characterName },
        select: { questId: true },
    });
    const doneIds = new Set(doneEntries.map((e: any) => e.questId));
    const totalWeight = allEntries.reduce((s: number, e: any) => s + (e.weight ?? 1), 0);
    const doneWeight = allEntries
        .filter((e: any) => doneIds.has(e.id))
        .reduce((s: number, e: any) => s + (e.weight ?? 1), 0);
    const completionPercent = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0;
    await (db as any).playerDofusProgress.upsert({
        where: { profileId_dofusId_characterName: { profileId, dofusId, characterName } },
        update: { completionPercent },
        create: { profileId, guildId: guildConfigId, dofusId, completionPercent, characterName },
    });
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────

/**
 * Bascule l'état d'une quête (NOT_STARTED → COMPLETED, etc.)
 */
export async function toggleQuestStatus(
    guildId: string,
    questEntryId: string,
    newStatus: DofusQuestStatus,
    characterName: string = "PRINCIPAL"
): Promise<{ success: boolean; error?: string }> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès refusé" };
    if (!ctx.profileId) return { success: false, error: "Profil introuvable" };

    // #55 — rate-limit bascule quêtes (60/min — aligné sur les mutations guide).
    // L'id utilisateur vient du contexte (ctx.id = session.user.id).
    const rateLimitResult = await rateLimit(`quest:toggle:${ctx.id}:${guildId}`, 60, 60_000);
    if (!rateLimitResult.success) {
        return { success: false, error: "Trop de changements, réessaie dans une minute." };
    }

    // Resolve internal guild ID
    const guildConfig = await (db as any).guildConfig.findFirst({
        where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
        select: { id: true },
    });
    if (!guildConfig) return { success: false, error: "Guilde introuvable" };

    try {
        await (db as any).playerDofusQuestProgress.upsert({
            where: {
                profileId_questId_characterName: {
                    profileId: ctx.profileId,
                    questId: questEntryId,
                    characterName,
                },
            },
            update: {
                status: newStatus,
                completedAt: newStatus === "COMPLETED" ? new Date() : null,
            },
            create: {
                profileId: ctx.profileId,
                guildId: guildConfig.id,
                questId: questEntryId,
                characterName,
                status: newStatus,
                completedAt: newStatus === "COMPLETED" ? new Date() : null,
            },
        });

        // #112 — Complétion en cascade des prérequis en amont
        const affectedDofusIds = new Set<string>();
        if (newStatus === "COMPLETED" && ctx.profileId) {
            try {
                const upstreamPrereqIds = await getAllUpstreamPrerequisites(questEntryId);
                if (upstreamPrereqIds.length > 0) {
                    const now = new Date();
                    await (db as any).$transaction(
                        upstreamPrereqIds.map((pId: string) =>
                            (db as any).playerDofusQuestProgress.upsert({
                                where: {
                                    profileId_questId_characterName: {
                                        profileId: ctx.profileId!,
                                        questId: pId,
                                        characterName,
                                    },
                                },
                                update: {
                                    status: "COMPLETED",
                                    completedAt: now,
                                },
                                create: {
                                    profileId: ctx.profileId!,
                                    guildId: guildConfig.id,
                                    questId: pId,
                                    characterName,
                                    status: "COMPLETED",
                                    completedAt: now,
                                },
                            })
                        )
                    );

                    const prereqQuests = await (db as any).dofusQuestEntry.findMany({
                        where: { id: { in: upstreamPrereqIds } },
                        select: { chain: { select: { dofusId: true } } },
                    });
                    for (const pq of prereqQuests) {
                        if (pq?.chain?.dofusId) {
                            affectedDofusIds.add(pq.chain.dofusId);
                        }
                    }
                }
            } catch (err) {
                logger.error("[toggleQuestStatus] cascade prerequisite completion failed:", { error: err });
            }
        }

        // V3: Refresh completionPercent cache on PlayerDofusProgress
        // Find which Dofus this quest belongs to and recompute
        try {
            const questEntry = await (db as any).dofusQuestEntry.findUnique({
                where: { id: questEntryId },
                select: { chain: { select: { dofusId: true, dofus: { select: { slug: true } } } } },
            });
            const dofusId = questEntry?.chain?.dofusId;
            if (dofusId) {
                affectedDofusIds.add(dofusId);
            }

            if (ctx.profileId) {
                for (const dId of affectedDofusIds) {
                    await refreshDofusCompletionPercent(ctx.profileId, guildConfig.id, dId, characterName);
                }
            }
        } catch (e) {
            // Non-blocking: cache refresh failure should not break the toggle
            logger.error("[toggleQuestStatus] completionPercent refresh failed:", { error: e });
        }

        // Temps réel (#37 suite) : broadcast « quête basculée » (best-effort, fail-closed).
        // Les autres membres de la page par-Dofus rafraîchissent leur synergie en live.
        try {
            const slugEntry = await (db as any).dofusQuestEntry.findUnique({
                where: { id: questEntryId },
                select: { chain: { select: { dofus: { select: { slug: true } } } } },
            });
            const dofusSlug = slugEntry?.chain?.dofus?.slug;
            if (dofusSlug) {
                await publishDofusEvent(guildId, dofusSlug, {
                    type: "quest:status",
                    profileId: ctx.profileId,
                    userName: ctx.pseudoDofus || ctx.name || "Membre",
                    userAvatar: ctx.image || undefined,
                    questId: questEntryId,
                    status: newStatus,
                });
            }
        } catch (err) {
            logger.warn("[toggleQuestStatus] publish temps réel échoué (non bloquant)", { error: err });
        }

        revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
        return { success: true };
    } catch (error) {
        logger.error("[dofus-quest-actions] toggleQuestStatus error:", { error });
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

/**
 * Marque un Dofus comme obtenu (ou non)
 */
export async function toggleDofusObtained(
    guildId: string,
    dofusId: string,
    obtained: boolean,
    characterName: string = "PRINCIPAL",
    syncAllMules: boolean = false
): Promise<{ success: boolean; error?: string }> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès refusé" };
    if (!ctx.profileId) return { success: false, error: "Profil introuvable" };

    const guildConfig = await (db as any).guildConfig.findFirst({
        where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
        select: { id: true },
    });
    if (!guildConfig) return { success: false, error: "Guilde introuvable" };

    try {
        let charactersToUpdate = [characterName];
        if (syncAllMules) {
            const profile = await db.userProfile.findUnique({
                where: { id: ctx.profileId },
                select: { altPseudos: true }
            });
            const altPseudosList = Array.isArray(profile?.altPseudos) ? (profile.altPseudos as any[]) : [];
            const muleNames = altPseudosList.map(m => typeof m === 'string' ? m : m.pseudo).filter(Boolean);
            charactersToUpdate = Array.from(new Set(["PRINCIPAL", ...muleNames]));
        }

        for (const charName of charactersToUpdate) {
            await (db as any).playerDofusProgress.upsert({
                where: {
                    profileId_dofusId_characterName: {
                        profileId: ctx.profileId,
                        dofusId,
                        characterName: charName,
                    },
                },
                update: {
                    isObtained: obtained,
                    obtainedAt: obtained ? new Date() : null,
                },
                create: {
                    profileId: ctx.profileId,
                    guildId: guildConfig.id,
                    dofusId,
                    characterName: charName,
                    isObtained: obtained,
                    obtainedAt: obtained ? new Date() : null,
                },
            });

            // Si marqué comme obtenu, marquer toutes ses quêtes comme COMPLETED
            if (obtained) {
                const chains = await (db as any).dofusQuestChain.findMany({
                    where: { dofusId },
                    include: { entries: { select: { id: true } } },
                });
                const allEntryIds = chains.flatMap((c: any) => c.entries.map((e: any) => e.id));

                if (allEntryIds.length > 0) {
                    // Use a transaction for bulk update
                    await db.$transaction(
                        allEntryIds.map((questId: string) =>
                            (db as any).playerDofusQuestProgress.upsert({
                                where: {
                                    profileId_questId_characterName: { 
                                        profileId: ctx.profileId!, 
                                        questId,
                                        characterName: charName 
                                    },
                                },
                                update: { status: "COMPLETED", completedAt: new Date() },
                                create: {
                                    profileId: ctx.profileId!,
                                    guildId: guildConfig.id,
                                    questId,
                                    characterName: charName,
                                    status: "COMPLETED",
                                    completedAt: new Date(),
                                },
                            })
                        )
                    );
                }
                // Also update the completion percentage to 100
                await (db as any).playerDofusProgress.update({
                    where: {
                        profileId_dofusId_characterName: {
                            profileId: ctx.profileId,
                            dofusId,
                            characterName: charName,
                        },
                    },
                    data: { completionPercent: 100 }
                });
            }
        }

        revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
        return { success: true };
    } catch (error) {
        logger.error("[dofus-quest-actions] toggleDofusObtained error:", { error });
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

/**
 * Met à jour le nombre de pages récoltées pour le Dolmanax (0-365)
 */
export async function updateDolmanaxProgress(
    guildId: string,
    dofusId: string,
    pages: number,
    characterName: string = "PRINCIPAL"
): Promise<ActionResponse> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.profileId) return { success: false, error: "Profil introuvable" };

    const guildConfig = await (db as any).guildConfig.findFirst({
        where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
        select: { id: true },
    });
    if (!guildConfig) return { success: false, error: "Guilde introuvable" };

    try {
        const percent = Math.min(100, Math.round((pages / 365) * 100));
        const notes = `PAGES:${pages}`;
        
        await (db as any).playerDofusProgress.upsert({
            where: {
                profileId_dofusId_characterName: {
                    profileId: ctx.profileId,
                    dofusId,
                    characterName,
                },
            },
            update: { completionPercent: percent, isObtained: pages >= 365, notes },
            create: {
                profileId: ctx.profileId,
                guildId: guildConfig.id,
                dofusId,
                characterName,
                completionPercent: percent,
                isObtained: pages >= 365,
                notes
            },
        });

        revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
        return { success: true };
    } catch (error) {
        logger.error("[updateDolmanaxProgress] error:", { error });
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

/**
 * Seed les données Dofus depuis les JSONs curatés (admin uniquement)
 * V3: Supporte les champs isSylvestreReq, isMeta, bonusSummary, weight, externalRef
 * et charge les JSONs compilés par Dofus depuis seed-data/dofus-quests/
 */
export async function seedDofusData(guildId: string): Promise<{
    success: boolean;
    error?: string;
    message?: string;
}> {
    // Accept super-admins (called from /god with no guildId) OR guild admins
    const superAdmin = (process.env.IS_SUPER_ADMIN === "true") || await isSuperAdmin();
    if (!superAdmin) {
        const ctx = await getUserContext(guildId);
        if (!ctx.isAdmin) return { success: false, error: "Admin uniquement" };
    }

    try {
        // Load items list from disk (bypassing Node cache)
        const fs = require("fs");
        const pathModule = require("path");
        const itemsPath = pathModule.resolve(process.cwd(), "prisma/seed-data/dofus-quests/dofus-items.json");
        const itemsDataRaw = fs.readFileSync(itemsPath, "utf-8");
        const items: any[] = JSON.parse(itemsDataRaw);

        // Delete any ghost Dofus that are no longer in our JSON (cleaning duplicates from old slugs)
        const validSlugs = items.map((i: any) => i.slug);
        const ghosts = await (db as any).dofusItem.findMany({ where: { slug: { notIn: validSlugs } } });
        for (const ghost of ghosts) {
            logger.debug(`[seedDofusData] Deleting ghost item: ${ghost.slug}`);
            
            // Delete player progresses
            await (db as any).playerDofusProgress.deleteMany({ where: { dofusId: ghost.id } });
            
            // Delete chains
            const chains = await (db as any).dofusQuestChain.findMany({ where: { dofusId: ghost.id } });
            for (const chain of chains) {
                await (db as any).dofusQuestEntry.deleteMany({ where: { chainId: chain.id } });
            }
            await (db as any).dofusQuestChain.deleteMany({ where: { dofusId: ghost.id } });
            
            // Delete requirements involving this ghost
            await (db as any).dofusRequirement.deleteMany({
                where: { OR: [ { fromDofusId: ghost.id }, { toDofusId: ghost.id } ] }
            });

            await (db as any).dofusItem.delete({ where: { id: ghost.id } });
        }

        // List of compiled chain JSON paths to load (bypassing Node cache)
        const chainFiles = [
            // Primordiaux
            { slug: "emeraude", path: "prisma/seed-data/dofus-quests/emeraude-compiled.json" },
            { slug: "turquoise", path: "prisma/seed-data/dofus-quests/turquoise-compiled.json" },
            { slug: "ivoire", path: "prisma/seed-data/dofus-quests/ivoire-compiled.json" },
            { slug: "ebene", path: "prisma/seed-data/dofus-quests/ebene-compiled.json" },
            { slug: "ocre", path: "prisma/seed-data/dofus-quests/ocre-compiled.json" },
            { slug: "pourpre", path: "prisma/seed-data/dofus-quests/pourpre-compiled.json" },
            // Majeurs
            { slug: "vulbis", path: "prisma/seed-data/dofus-quests/vulbis-compiled.json" },
            { slug: "tachete", path: "prisma/seed-data/dofus-quests/tachete-compiled.json" },
            { slug: "argente", path: "prisma/seed-data/dofus-quests/argente-compiled.json" },
            { slug: "dom-de-pin", path: "prisma/seed-data/dofus-quests/dom-de-pin-compiled.json" },
            { slug: "des-glaces", path: "prisma/seed-data/dofus-quests/des-glaces-compiled.json" },
            { slug: "domakuro", path: "prisma/seed-data/dofus-quests/domakuro-compiled.json" },
            { slug: "dorigami", path: "prisma/seed-data/dofus-quests/dorigami-compiled.json" },
            { slug: "du-cauchemar", path: "prisma/seed-data/dofus-quests/du-cauchemar-compiled.json" },
            { slug: "abyssal", path: "prisma/seed-data/dofus-quests/abyssal-compiled.json" },
            { slug: "nebuleux", path: "prisma/seed-data/dofus-quests/nebuleux-compiled.json" },
            { slug: "forgelave", path: "prisma/seed-data/dofus-quests/forgelave-compiled.json" },
            { slug: "cacao", path: "prisma/seed-data/dofus-quests/cacao-compiled.json" },
            { slug: "dokoko", path: "prisma/seed-data/dofus-quests/dokoko-compiled.json" },
            { slug: "veilleur", path: "prisma/seed-data/dofus-quests/veilleur-compiled.json" },
            { slug: "argente-scintillant", path: "prisma/seed-data/dofus-quests/argente-scintillant-compiled.json" },
            // Meta / Spéciaux
            { slug: "sylvestre", path: "prisma/seed-data/dofus-quests/sylvestre-compiled.json" },
            // Mineurs (configs minimales)
            { slug: "cawotte", path: "prisma/seed-data/dofus-quests/cawotte-compiled.json" },
            { slug: "dolmanax", path: "prisma/seed-data/dofus-quests/dolmanax-compiled.json" },
        ];

        let itemCount = 0;
        let chainCount = 0;
        let entryCount = 0;
        const createdItems: Record<string, string> = {};

        // Upsert DofusItem records with V3 fields
        for (const item of items) {
            const record = await (db as any).dofusItem.upsert({
                where: { slug: item.slug },
                update: {
                    name: item.name,
                    nameShort: item.nameShort,
                    element: item.element,
                    rarity: item.rarity,
                    isPrimordial: item.isPrimordial ?? false,
                    isSylvestreReq: item.isSylvestreReq ?? false,
                    isMeta: item.isMeta ?? false,
                    bonusSummary: item.bonusSummary ?? null,
                    levelRecommended: item.levelRecommended,
                    imageUrl: item.imageUrl,
                    color: item.color,
                    displayOrder: item.displayOrder,
                    description: item.description,
                    successName: item.successName,
                    filterCategory: item.filterCategory ?? "AUTRES",
                },
                create: {
                    slug: item.slug,
                    name: item.name,
                    nameShort: item.nameShort,
                    element: item.element,
                    rarity: item.rarity,
                    isPrimordial: item.isPrimordial ?? false,
                    isSylvestreReq: item.isSylvestreReq ?? false,
                    isMeta: item.isMeta ?? false,
                    bonusSummary: item.bonusSummary ?? null,
                    levelRecommended: item.levelRecommended,
                    imageUrl: item.imageUrl,
                    color: item.color,
                    displayOrder: item.displayOrder,
                    description: item.description,
                    successName: item.successName,
                    filterCategory: item.filterCategory ?? "AUTRES",
                },
            });
            createdItems[item.slug] = record.id;
            itemCount++;
        }

        // Seed chains from per-Dofus compiled JSONs
        for (const { slug, path: filePath } of chainFiles) {
            const dofusId = createdItems[slug];
            if (!dofusId) continue;

            let chainData: any;
            try {
                const fileName = pathModule.basename(filePath);
                const resolvedPath = pathModule.join(process.cwd(), "prisma/seed-data/dofus-quests", fileName);
                const fileContent = fs.readFileSync(resolvedPath, "utf-8");
                chainData = JSON.parse(fileContent);
            } catch (err) {
                logger.error(`[seedDofusData] Could not load ${filePath}:`, { error: err });
                continue;
            }

            // Delete existing chains before re-seeding
            await (db as any).dofusQuestChain.deleteMany({ where: { dofusId } });

            for (const section of chainData.chains ?? []) {
                const chainRecord = await (db as any).dofusQuestChain.create({
                    data: {
                        dofusId,
                        sectionType: section.sectionType ?? "MAIN_CHAIN",
                        sectionName: section.sectionName,
                        description: section.description ?? null,
                        chainOrder: section.chainOrder ?? 0,
                    },
                });
                chainCount++;

                for (const entry of section.entries ?? []) {
                    await (db as any).dofusQuestEntry.create({
                        data: {
                            chainId: chainRecord.id,
                            name: typeof entry.name === "string" ? entry.name : (entry.name?.name || String(entry.name)),
                            zone: entry.zone ?? null,
                            questType: entry.questType ?? "QUEST",
                            stepOrder: entry.stepOrder ?? 0,
                            isOptional: entry.isOptional ?? false,
                            isLast: entry.isLast ?? false,
                            isDungeon: entry.isDungeon ?? false,
                            dofusdbId: entry.dofusdbId ?? null,
                            notes: entry.notes ?? null,
                            npcName: entry.npcName ?? null,
                            npcSubArea: entry.npcSubArea ?? null,
                            requirements: entry.requirements ?? null,
                            itemsRequired: entry.itemsRequired ?? null,
                            dungeonsRequired: entry.dungeonsRequired ?? null, // V3
                            objectives: entry.objectives ?? null,
                            coords: entry.coords ?? null,                      // V3
                            level: entry.level ?? null,                        // V3
                            isSynergyCandidate: entry.isSynergyCandidate ?? false,
                            weight: entry.weight ?? 1,           // V3
                            externalRef: entry.externalRef ?? null, // V3
                        },
                    });
                    entryCount++;
                }
            }
        }

        const { revalidatePath } = require("next/cache");
        revalidatePath(`/dashboard/${guildId}/quetes-dofus`, "layout");

        return {
            success: true,
            message: `✅ Seed terminé : ${itemCount} Dofus, ${chainCount} sections, ${entryCount} entrées (Cache vidéo Next.js purgé)`,
        };
    } catch (error) {
        logger.error("[dofus-quest-actions] seedDofusData error:", { error });
        return { success: false, error: `Erreur seed: ${(error as Error).message}` };
    }
}

/**
 * V3: Récupère les dépendances entre Dofus (graphe de prérequis)
 * Ex: Sylvestre → [Dom de Pin, Ocre, Ivoire, ...]
 */
export async function getDofusRequirements(
    guildId: string,
    dofusSlug?: string
): Promise<ActionResponse<{ fromSlug: string; toSlug: string; toName: string; toColor: string | null; notes: string | null }[]>> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès refusé" };

    try {
        const where = dofusSlug
            ? { fromDofus: { slug: dofusSlug } }
            : {};

        const requirements = await (db as any).dofusRequirement.findMany({
            where,
            include: {
                fromDofus: { select: { slug: true } },
                toDofus: { select: { slug: true, name: true, color: true } },
            },
        });

        return {
            success: true,
            data: requirements.map((r: any) => ({
                fromSlug: r.fromDofus.slug,
                toSlug: r.toDofus.slug,
                toName: r.toDofus.name,
                toColor: r.toDofus.color,
                notes: r.notes,
            })),
        };
    } catch (error) {
        logger.error("[getDofusRequirements] error:", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * V3: Seed des dépendances entre Dofus (admin uniquement)
 * À appeler après seedDofusData si tu veux injecter les RequirementEdges
 */
export async function seedDofusRequirements(guildId: string): Promise<ActionResponse<{ count: number }>> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isSuperAdmin && !ctx.isAdmin) return { success: false, error: "Admin uniquement" };

    // Relations connues : qui requiert qui
    const requirements: { from: string; to: string; notes?: string }[] = [
        // Sylvestre requiert
        { from: "sylvestre", to: "dom-de-pin", notes: "Prérequis direct Sylvestre" },
        { from: "sylvestre", to: "ocre", notes: "Prérequis Sylvestre via primordiaux" },
        { from: "sylvestre", to: "ivoire", notes: "Prérequis Sylvestre via primordiaux" },
        { from: "sylvestre", to: "ebene", notes: "Prérequis Sylvestre via primordiaux" },
        { from: "sylvestre", to: "turquoise", notes: "Prérequis Sylvestre" },
        { from: "sylvestre", to: "emeraude", notes: "Prérequis Sylvestre" },
        { from: "sylvestre", to: "pourpre", notes: "Prérequis Sylvestre" },
        // Ocre requiert (les 3 autres séries de quêtes)
        { from: "ocre", to: "turquoise", notes: "Arc quête Ocre : Bleu Turquoise" },
        { from: "ocre", to: "emeraude", notes: "Arc quête Ocre : Vert Émeraude" },
        { from: "ocre", to: "pourpre", notes: "Arc quête Ocre : Pourpre Profond" },
    ];

    try {
        let count = 0;
        for (const req of requirements) {
            const fromDofus = await (db as any).dofusItem.findUnique({ where: { slug: req.from }, select: { id: true } });
            const toDofus = await (db as any).dofusItem.findUnique({ where: { slug: req.to }, select: { id: true } });
            if (!fromDofus || !toDofus) continue;

            await (db as any).dofusRequirement.upsert({
                where: { fromDofusId_toDofusId: { fromDofusId: fromDofus.id, toDofusId: toDofus.id } },
                update: { notes: req.notes ?? null },
                create: { fromDofusId: fromDofus.id, toDofusId: toDofus.id, notes: req.notes ?? null },
            });
            count++;
        }
        return { success: true, data: { count } };
    } catch (error) {
        logger.error("[seedDofusRequirements] error:", { error });
        return { success: false, error: `Erreur: ${(error as Error).message}` };
    }
}

// ── Heatmap types ─────────────────────────────────────────────────────────────

export type HeatmapMember = {
    profileId: string;
    pseudo: string;
    image: string | null;
    completedCount: number;
    totalCount: number;
    completionPercent: number;
    statusMap: Record<string, string>;
};

export type HeatmapEntry = {
    id: string;
    name: string;
    questType: string;
    isDungeon: boolean;
    isOptional: boolean;
    stepOrder: number;
    weight: number;
    sectionType: string;
    sectionName: string;
};

export type GuildHeatmapData = {
    entries: HeatmapEntry[];
    members: HeatmapMember[];
};

/**
 * V3 — Heatmap membres × étapes pour un Dofus spécifique
 */
export async function getGuildHeatmapForDofus(
    guildId: string,
    dofusSlug: string
): Promise<ActionResponse<GuildHeatmapData>> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès refusé" };

    try {
        const guildConfig = await (db as any).guildConfig.findFirst({
            where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };
        const internalGuildId: string = guildConfig.id;

        // 1. Dofus + ses chaînes + entrées non-optionnelles
        const dofusItem = await (db as any).dofusItem.findUnique({
            where: { slug: dofusSlug },
            include: {
                questChains: {
                    orderBy: { chainOrder: "asc" },
                    include: {
                        entries: {
                            where: { isOptional: false },
                            orderBy: { stepOrder: "asc" },
                            select: {
                                id: true,
                                name: true,
                                questType: true,
                                isDungeon: true,
                                isOptional: true,
                                stepOrder: true,
                                weight: true,
                            },
                        },
                    },
                },
            },
        });
        if (!dofusItem) return { success: false, error: "Dofus introuvable" };

        const entries: HeatmapEntry[] = (dofusItem.questChains as any[]).flatMap(
            (chain: { sectionType: string; sectionName: string; entries: any[] }) =>
                chain.entries.map((e: any) => ({
                    id: e.id as string,
                    name: e.name as string,
                    questType: e.questType as string,
                    isDungeon: Boolean(e.isDungeon),
                    isOptional: Boolean(e.isOptional),
                    stepOrder: Number(e.stepOrder),
                    weight: Number(e.weight ?? 1),
                    sectionType: chain.sectionType,
                    sectionName: chain.sectionName,
                }))
        );

        if (entries.length === 0) return { success: true, data: { entries: [], members: [] } };

        const entryIds = entries.map((e) => e.id);

        // 2. Membres actifs de la guilde
        const profiles = await db.userProfile.findMany({
            where: { guildId: internalGuildId, status: "ACTIVE" },
            select: {
                id: true,
                discordNickname: true,
                pseudoDofus: true,
                user: { select: { image: true } },
            },
            orderBy: { discordNickname: "asc" },
            take: 40,
        });

        // 3. Progression de tous ces membres sur ces entrées
        const allProgress = await (db as any).playerDofusQuestProgress.findMany({
            where: {
                questId: { in: entryIds },
                profileId: { in: profiles.map((p: any) => p.id) },
            },
            select: { profileId: true, questId: true, status: true },
        });

        // 4. Map profileId → { questId → status }
        const progressByMember = new Map<string, Record<string, string>>();
        for (const p of allProgress as { profileId: string; questId: string; status: string }[]) {
            if (!progressByMember.has(p.profileId)) progressByMember.set(p.profileId, {});
            progressByMember.get(p.profileId)![p.questId] = p.status;
        }

        const totalWeight = entries.reduce((s, e) => s + e.weight, 0);

        const members: HeatmapMember[] = (profiles as any[])
            .map((p: any) => {
                const statusMap = progressByMember.get(p.id as string) ?? {};
                const completedCount = entryIds.filter((id) => statusMap[id] === "COMPLETED").length;
                const doneWeight = entries
                    .filter((e) => statusMap[e.id] === "COMPLETED")
                    .reduce((s, e) => s + e.weight, 0);
                return {
                    profileId: p.id as string,
                    pseudo: (p.discordNickname || p.pseudoDofus || "Inconnu") as string,
                    image: (p.user?.image ?? null) as string | null,
                    completedCount,
                    totalCount: entryIds.length,
                    completionPercent: totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0,
                    statusMap,
                };
            })
            .sort((a, b) => b.completionPercent - a.completionPercent);

        return { success: true, data: { entries, members } };
    } catch (error) {
        logger.error("[getGuildHeatmapForDofus] error:", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Récupère TOUS les IDs de quêtes terminées par l'utilisateur (ID internes + DofusDB IDs)
 */
export async function getUserCompletedQuestIds(
    guildId: string,
    characterName: string = "PRINCIPAL"
): Promise<ActionResponse<string[]>> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };

    try {
        const progress = await (db as any).playerDofusQuestProgress.findMany({
            where: {
                profileId: ctx.profileId,
                status: "COMPLETED",
                characterName
            },
            include: {
                quest: { select: { dofusdbId: true } }
            }
        });

        const ids = new Set<string>();
        progress.forEach((p: any) => {
            ids.add(p.questId);
            if (p.quest.dofusdbId) ids.add(String(p.quest.dofusdbId));
        });

        return { success: true, data: Array.from(ids) };
    } catch (error) {
        logger.error("[getUserCompletedQuestIds] error:", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Chantier #68 — Icône du bloc d'en-tête des pages quêtes par Dofus (choix God).
 * Retourne toujours une valeur sûre (fail-closed : "serie-de-quete").
 */
export async function getDofusQuestHeaderIcon(): Promise<"serie-de-quete" | "icone-succes"> {
    try {
        const platform = await db.platformConfig.findUnique({
            where: { id: "singleton" },
            select: { dofusQuestHeaderIcon: true },
        });
        return platform?.dofusQuestHeaderIcon === "icone-succes" ? "icone-succes" : "serie-de-quete";
    } catch (error) {
        logger.error("[getDofusQuestHeaderIcon] error:", { error });
        return "serie-de-quete";
    }
}

