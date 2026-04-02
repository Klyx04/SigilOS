"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";
import { DofusQuestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

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
};

export type DofusChainWithProgress = {
    id: string;
    sectionType: string;
    sectionName: string;
    description: string | null;
    chainOrder: number;
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
    // Computed
    status: DofusQuestStatus;
    completedAt: Date | null;
};

export type GuildDofusStats = {
    dofusId: string;
    slug: string;
    name: string;
    nameShort: string;
    color: string | null;
    imageUrl: string | null;
    totalMembers: number;
    obtainedCount: number;
    obtainedPercent: number;
};

export type MemberDofusSummary = {
    profileId: string;
    pseudo: string;
    image: string | null;
    dofusObtained: number;
    dofusTotal: number;
    dofusList: { slug: string; name: string; color: string | null; isObtained: boolean }[];
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
export async function getDofusListWithProgress(guildId: string): Promise<{
    success: boolean;
    error?: string;
    data?: DofusItemWithProgress[];
}> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès refusé" };

    try {
        // Fetch all Dofus items ordered by display order
        const items = await (db as any).dofusItem.findMany({
            orderBy: { displayOrder: "asc" },
            include: {
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
                          where: { profileId: ctx.profileId },
                          take: 1,
                      }
                    : false,
            },
        });

        // Fetch quest progress for current user
        const questProgressMap: Map<string, DofusQuestStatus> = new Map();
        if (ctx.profileId) {
            const questProgress = await (db as any).playerDofusQuestProgress.findMany({
                where: {
                    profileId: ctx.profileId,
                    guildId,
                },
                select: { questId: true, status: true },
            });
            questProgress.forEach((qp: any) => {
                questProgressMap.set(qp.questId, qp.status);
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
                levelRecommended: item.levelRecommended,
                imageUrl: item.imageUrl,
                color: item.color,
                displayOrder: item.displayOrder,
                description: item.description,
                successName: item.successName,
                filterCategory: item.filterCategory,
                filterSubCategory: item.filterSubCategory,
                isObtained: progress?.isObtained ?? false,
                obtainedAt: progress?.obtainedAt ?? null,
                completedQuests,
                totalQuests,
                totalWeight,
                doneWeight,
                progressPercent: totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0,
            };
        });

        return { success: true, data: result };
    } catch (error) {
        console.error("[dofus-quest-actions] getDofusListWithProgress error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Récupère un Dofus avec toutes ses chaînes de quêtes + progression du joueur
 */
export async function getDofusDetailWithChains(
    guildId: string,
    dofusSlug: string
): Promise<{
    success: boolean;
    error?: string;
    data?: {
        dofus: DofusItemWithProgress;
        chains: DofusChainWithProgress[];
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
                          where: { profileId: ctx.profileId },
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
                    objectives: entry.objectives,
                    isDungeon: entry.isDungeon,
                    bossName: entry.bossName,
                    bossImg: entry.bossImg,
                    posX: entry.posX,
                    posY: entry.posY,
                    dofusdbId: entry.dofusdbId,
                    isSynergyCandidate: entry.isSynergyCandidate,
                    weight: entry.weight ?? 1, // V3
                    externalRef: entry.externalRef ?? null, // V3
                    status: prog?.status ?? "NOT_STARTED",
                    completedAt: prog?.completedAt ?? null,
                };
            }),
        }));

        const progress = item.playerProgress?.[0];
        const totalQuests = chains
            .flatMap((c) => c.entries)
            .filter((e) => !e.isOptional).length;
        const completedQuests = chains
            .flatMap((c) => c.entries)
            .filter((e) => !e.isOptional && e.status === "COMPLETED").length;

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
            progressPercent: totalQuests > 0 ? Math.round((completedQuests / totalQuests) * 100) : 0,
        };

        return { success: true, data: { dofus: dofusData, chains } };
    } catch (error) {
        console.error("[dofus-quest-actions] getDofusDetailWithChains error:", error);
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
            select: { id: true, slug: true, name: true, nameShort: true, color: true, imageUrl: true },
        });

        // Get all player Dofus progress for this guild
        const allProgress = await (db as any).playerDofusProgress.findMany({
            where: { guildId: internalGuildId, isObtained: true },
            select: { dofusId: true, profileId: true },
        });

        // Build stats per Dofus
        const progressByDofus = new Map<string, Set<string>>();
        allProgress.forEach((p: any) => {
            if (!progressByDofus.has(p.dofusId)) progressByDofus.set(p.dofusId, new Set());
            progressByDofus.get(p.dofusId)!.add(p.profileId);
        });

        const stats: GuildDofusStats[] = dofusItems.map((d: any) => {
            const obtainedSet = progressByDofus.get(d.id) ?? new Set();
            return {
                dofusId: d.id,
                slug: d.slug,
                name: d.name,
                nameShort: d.nameShort,
                color: d.color,
                imageUrl: d.imageUrl,
                totalMembers,
                obtainedCount: obtainedSet.size,
                obtainedPercent: totalMembers > 0 ? Math.round((obtainedSet.size / totalMembers) * 100) : 0,
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

        return { success: true, data: { stats, topMembers, totalMembers } };
    } catch (error) {
        console.error("[dofus-quest-actions] getGuildDofusStats error:", error);
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
        console.error("[getDofusWarRoomData] error:", error);
        return { success: false, error: "Erreur lors du calcul de la War Room" };
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
        console.error("[getOtherMembersOnQuest] Error:", error);
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
        console.error("[getGuildSynergyForDofus] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────

/**
 * Bascule l'état d'une quête (NOT_STARTED → COMPLETED, etc.)
 */
export async function toggleQuestStatus(
    guildId: string,
    questEntryId: string,
    newStatus: DofusQuestStatus
): Promise<{ success: boolean; error?: string }> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès refusé" };
    if (!ctx.profileId) return { success: false, error: "Profil introuvable" };

    // Resolve internal guild ID
    const guildConfig = await (db as any).guildConfig.findFirst({
        where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
        select: { id: true },
    });
    if (!guildConfig) return { success: false, error: "Guilde introuvable" };

    try {
        await (db as any).playerDofusQuestProgress.upsert({
            where: {
                profileId_questId: {
                    profileId: ctx.profileId,
                    questId: questEntryId,
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
                status: newStatus,
                completedAt: newStatus === "COMPLETED" ? new Date() : null,
            },
        });

        // V3: Refresh completionPercent cache on PlayerDofusProgress
        // Find which Dofus this quest belongs to and recompute
        try {
            const questEntry = await (db as any).dofusQuestEntry.findUnique({
                where: { id: questEntryId },
                select: { chain: { select: { dofusId: true } } },
            });
            const dofusId = questEntry?.chain?.dofusId;
            if (dofusId && ctx.profileId) {
                // Fetch all non-optional entries with weights for this Dofus
                const allEntries = await (db as any).dofusQuestEntry.findMany({
                    where: { chain: { dofusId }, isOptional: false },
                    select: { id: true, weight: true },
                });
                const entryIds = allEntries.map((e: any) => e.id);
                const doneEntries = await (db as any).playerDofusQuestProgress.findMany({
                    where: { profileId: ctx.profileId, questId: { in: entryIds }, status: "COMPLETED" },
                    select: { questId: true },
                });
                const doneIds = new Set(doneEntries.map((e: any) => e.questId));
                const totalWeight = allEntries.reduce((s: number, e: any) => s + (e.weight ?? 1), 0);
                const doneWeight = allEntries
                    .filter((e: any) => doneIds.has(e.id))
                    .reduce((s: number, e: any) => s + (e.weight ?? 1), 0);
                const completionPercent = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0;
                await (db as any).playerDofusProgress.upsert({
                    where: { profileId_dofusId: { profileId: ctx.profileId, dofusId } },
                    update: { completionPercent },
                    create: { profileId: ctx.profileId, guildId: guildConfig.id, dofusId, completionPercent },
                });
            }
        } catch (e) {
            // Non-blocking: cache refresh failure should not break the toggle
            console.error("[toggleQuestStatus] completionPercent refresh failed:", e);
        }

        revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
        return { success: true };
    } catch (error) {
        console.error("[dofus-quest-actions] toggleQuestStatus error:", error);
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

/**
 * Marque un Dofus comme obtenu (ou non)
 */
export async function toggleDofusObtained(
    guildId: string,
    dofusId: string,
    obtained: boolean
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
        await (db as any).playerDofusProgress.upsert({
            where: {
                profileId_dofusId: {
                    profileId: ctx.profileId,
                    dofusId,
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

            for (const questId of allEntryIds) {
                await (db as any).playerDofusQuestProgress.upsert({
                    where: {
                        profileId_questId: { profileId: ctx.profileId, questId },
                    },
                    update: { status: "COMPLETED", completedAt: new Date() },
                    create: {
                        profileId: ctx.profileId,
                        guildId: guildConfig.id,
                        questId,
                        status: "COMPLETED",
                        completedAt: new Date(),
                    },
                });
            }
        }

        revalidatePath(`/dashboard/${guildId}/quetes-dofus`);
        return { success: true };
    } catch (error) {
        console.error("[dofus-quest-actions] toggleDofusObtained error:", error);
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
    const ctx = await getUserContext(guildId);
    if (!ctx.isSuperAdmin && !ctx.isAdmin) return { success: false, error: "Admin uniquement" };

    try {
        // Dynamic import of JSON data — items list (master catalog)
        const itemsData = await import("../../../prisma/seed-data/dofus-quests/dofus-items.json");
        const items: any[] = (itemsData as any).default;

        // List of compiled chain JSONs to load (ordered by priority)
        const chainFiles = [
            { slug: "emeraude", file: () => import("../../../prisma/seed-data/dofus-quests/emeraude-compiled.json") },
            { slug: "turquoise", file: () => import("../../../prisma/seed-data/dofus-quests/turquoise-compiled.json") },
            { slug: "ivoire", file: () => import("../../../prisma/seed-data/dofus-quests/ivoire-compiled.json") },
            { slug: "ebene", file: () => import("../../../prisma/seed-data/dofus-quests/ebene-compiled.json") },
            { slug: "ocre", file: () => import("../../../prisma/seed-data/dofus-quests/ocre-compiled.json") },
            { slug: "vulbis", file: () => import("../../../prisma/seed-data/dofus-quests/vulbis-compiled.json") },
            { slug: "pourpre", file: () => import("../../../prisma/seed-data/dofus-quests/pourpre-compiled.json") },
            { slug: "tacheté", file: () => import("../../../prisma/seed-data/dofus-quests/tachete-compiled.json") },
            { slug: "argenté", file: () => import("../../../prisma/seed-data/dofus-quests/argent-compiled.json") },
            { slug: "dom-de-pin", file: () => import("../../../prisma/seed-data/dofus-quests/dom-de-pin-compiled.json") },
            { slug: "sylvestre", file: () => import("../../../prisma/seed-data/dofus-quests/sylvestre-compiled.json") },
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
        for (const { slug, file } of chainFiles) {
            const dofusId = createdItems[slug];
            if (!dofusId) continue;

            let chainData: any;
            try {
                const module = await file();
                chainData = (module as any).default;
            } catch {
                // JSON file not found — skip silently
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
                            name: entry.name,
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
                            objectives: entry.objectives ?? null,
                            weight: entry.weight ?? 1,           // V3
                            externalRef: entry.externalRef ?? null, // V3
                        },
                    });
                    entryCount++;
                }
            }
        }

        return {
            success: true,
            message: `✅ Seed terminé : ${itemCount} Dofus, ${chainCount} sections, ${entryCount} entrées`,
        };
    } catch (error) {
        console.error("[dofus-quest-actions] seedDofusData error:", error);
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
        console.error("[getDofusRequirements] error:", error);
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
        console.error("[seedDofusRequirements] error:", error);
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
        console.error("[getGuildHeatmapForDofus] error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}
