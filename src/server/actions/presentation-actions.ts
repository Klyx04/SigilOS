"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getUserContext } from "./user-actions";
import { uploadGuildImage, deleteGuildImage } from "./upload-actions";
import { logAdminAccessDenied } from "./audit-actions";
import { ALL_DOFUS_SERVERS, AVAILABLE_ACTIVITIES } from "@/lib/presentation-constants";

// ============================================================================
// SANITIZATION UTILITIES
// ============================================================================
import { sanitizeHtml, sanitizeDiscordLink, sanitizeName } from "@/lib/security";
import { buildDiscordAvatarUrl } from "@/lib/discord-avatars";
import { listGuildMembers } from "@/server/discord";

// Local validation helpers
function validateServerName(server: string | null): string | null {
    if (!server) return null;
    const cleaned = server.trim();
    return (ALL_DOFUS_SERVERS as readonly string[]).includes(cleaned) ? cleaned : null;
}

function validateLevel(level: number | null | undefined): number | null {
    if (level === null || level === undefined) return null;
    const num = Math.floor(Number(level));
    if (isNaN(num) || num < 0 || num > 200) return null;
    return num;
}

function validateSuccesses(successes: number | null | undefined): number | null {
    if (successes === null || successes === undefined) return null;
    const num = Math.floor(Number(successes));
    if (isNaN(num) || num < 0 || num > 25000) return null;
    return num;
}

// ============================================================================
// PUBLIC ACTIONS (No authentication required)
// ============================================================================

export type PublicGuildSummary = {
    id: string;
    discordGuildId: string;
    name: string;
    iconUrl: string | null;
    server: string | null;
    isRecruiting: boolean;
    bannerType: string | null;
    bannerUrl: string | null;
};

export type PublicGuildShowcase = PublicGuildSummary & {
    memberCount: number;
    missionsValidated: number;
    songesCompleted: number;
    dofusCompletionRate: number;
};

/**
 * Landing v3 — "showcase mini-dashboards par guilde".
 * Agrège des mini-KPI publics par guilde (membres actifs, missions validées,
 * songes complétés, progression Dofus moyenne). Léger :
 *  - limité aux 6 premières guildes publiques,
 *  - cache Redis 5 min,
 *  - agrégats groupés (pas une requête par guilde).
 * Aucune donnée sensible : stats globales de guilde uniquement.
 */
export async function getPublicGuildShowcase(limit = 6): Promise<PublicGuildShowcase[]> {
    try {
        const redisKey = `public:guilds:showcase:${limit}`;
        const cached = await (await import("@/lib/redis")).redis.get(redisKey).catch(() => null);
        if (cached) return JSON.parse(cached) as PublicGuildShowcase[];

        // #80 — refonte landing : filtre qualité côté serveur.
        // On agrège les stats de TOUTES les guildes publiques, puis on ne retient
        // que celles avec une activité réelle avant de tronquer au `limit`.
        const guilds = await getPublicGuilds();
        if (guilds.length === 0) return [];

        // Récupère les IDs internes des guildes publiques
        const guildConfigs = await db.guildConfig.findMany({
            where: { discordGuildId: { in: guilds.map(g => g.discordGuildId) } },
            select: { id: true, discordGuildId: true },
        });
        const internalIds = guildConfigs.map(g => g.id);
        if (internalIds.length === 0) return [];

        // Agrégats groupés (une requête par type, pas par guilde)
        const [memberCounts, missionsCount, songesCount, dofusStats] = await Promise.all([
            db.userProfile.groupBy({
                by: ["guildId"],
                where: { guildId: { in: internalIds }, status: "ACTIVE" },
                _count: true,
            }),
            db.submission.groupBy({
                by: ["missionId"],
                where: { status: "VALIDATED", mission: { guildId: { in: internalIds } } },
                _count: true,
            }),
            db.dreamRun.groupBy({
                by: ["guildId"],
                where: { guildId: { in: internalIds }, status: "COMPLETED" },
                _count: true,
            }),
            db.playerDofusQuestProgress.groupBy({
                by: ["guildId"],
                where: { guildId: { in: internalIds }, status: "COMPLETED" },
                _count: true,
            }),
        ]);

        const memberMap = new Map<string, number>(memberCounts.map(m => [m.guildId, m._count]));
        const songesMap = new Map<string, number>(songesCount.map(s => [s.guildId, s._count]));
        const dofusMap = new Map<string, number>(dofusStats.map(d => [d.guildId, d._count]));

        // Total de missions par guilde pour calculer un taux (requête légère groupée)
        const missionTotal = await db.mission.groupBy({
            by: ["guildId"],
            where: { guildId: { in: internalIds } },
            _count: true,
        });
        const missionTotalMap = new Map<string, number>(missionTotal.map(m => [m.guildId, m._count]));

        // Validations groupées par guilde (join mission.guildId)
        const missionsForValidation = await db.mission.findMany({
            where: { guildId: { in: internalIds } },
            select: { id: true, guildId: true },
        });
        const missionGuildByMission = new Map<string, string>(missionsForValidation.map(m => [m.id, m.guildId]));
        const validatedMap = new Map<string, number>();
        for (const s of missionsCount) {
            const gid = missionGuildByMission.get(s.missionId);
            if (!gid) continue;
            validatedMap.set(gid, (validatedMap.get(gid) || 0) + s._count);
        }

        const all: PublicGuildShowcase[] = guilds.map(g => {
            const internalId = guildConfigs.find(c => c.discordGuildId === g.discordGuildId)?.id;
            const members = internalId ? (memberMap.get(internalId) || 0) : 0;
            const validated = internalId ? (validatedMap.get(internalId) || 0) : 0;
            const totalMissions = internalId ? (missionTotalMap.get(internalId) || 0) : 0;
            const songes = internalId ? (songesMap.get(internalId) || 0) : 0;
            const dofusCompleted = internalId ? (dofusMap.get(internalId) || 0) : 0;
            const dofusTotal = totalMissions > 0 ? totalMissions : 1;
            const dofusRate = Math.min(100, Math.round((dofusCompleted / dofusTotal) * 100));

            return {
                ...g,
                memberCount: members,
                missionsValidated: validated,
                songesCompleted: songes,
                dofusCompletionRate: dofusRate,
            };
        });

        // #80 — filtre qualité : garde les guildes avec au moins 3 membres actifs OU
        // une activité réelle (missions/songes validés), sinon repli sur >= 1 membre.
        const withActivity = all.filter(
            (g) => g.memberCount >= 3 || g.missionsValidated + g.songesCompleted > 0
        );
        const pool = withActivity.length > 0
            ? withActivity
            : all.filter((g) => g.memberCount >= 1);
        const candidates = pool.length > 0 ? pool : all;

        const result = candidates
            .sort((a, b) => {
                const scoreA = a.missionsValidated + a.songesCompleted + a.memberCount * 2;
                const scoreB = b.missionsValidated + b.songesCompleted + b.memberCount * 2;
                return scoreB - scoreA;
            })
            .slice(0, limit);

        const { redis } = await import("@/lib/redis");
        await redis.set(redisKey, JSON.stringify(result), "EX", 300).catch(() => { });
        return result;
    } catch (error) {
        logger.error("Error fetching public guild showcase:", error);
        return [];
    }
}


/**
 * Get all guilds that have enabled their public presentation
 */
export async function getPublicGuilds(): Promise<PublicGuildSummary[]> {
    try {
        const guilds = await db.guildConfig.findMany({
            where: {
                isActive: true,
                presentationEnabled: true,
            },
            select: {
                id: true,
                discordGuildId: true,
                name: true,
                iconUrl: true,
                presentationServer: true,
                presentationRecruiting: true,
                presentationBannerType: true,
                presentationBannerUrl: true,
            },
            orderBy: { name: "asc" },
        });

        return guilds.map((g) => ({
            id: g.id,
            discordGuildId: g.discordGuildId,
            name: g.name,
            iconUrl: g.iconUrl,
            server: g.presentationServer,
            isRecruiting: g.presentationRecruiting,
            bannerType: g.presentationBannerType as any,
            bannerUrl: g.presentationBannerUrl ? g.presentationBannerUrl.replace(/^\/uploads\//, "/api/storage/") : null,
        }));
    } catch (error) {
        logger.error("Error fetching public guilds:", error);
        return [];
    }
}

export type GuildPresentation = {
    id: string;
    discordGuildId: string;
    name: string;
    iconUrl: string | null;
    createdAt: string;
    // Presentation fields
    history: string | null;
    activities: string[] | null;
    founder: string | null;
    coLeaders: string[]; // Up to 3 co-leader pseudos
    team: string[]; // Up to 10 bras droits pseudos
    discord: string | null;
    isRecruiting: boolean;
    recruitmentRequirements: string | null;
    server: string | null;
    bannerType: string | null;
    bannerUrl: string | null;
    photoUrl: string | null;
    foundedDate: string | null;
    memberCount: number | null;
    // Recruitment specific
    discordRequired: boolean;
    minLevel: number | null;
    minSuccesses: number | null;
};

function buildGuildLookupConditions(guildId: string): any[] {
    const decoded = decodeURIComponent(guildId).trim();
    const withSpaces = decoded.replace(/[-_]/g, ' ').trim();
    const conditions: any[] = [
        { id: decoded },
        { discordGuildId: decoded },
        { name: { equals: decoded, mode: 'insensitive' } },
    ];
    if (withSpaces.toLowerCase() !== decoded.toLowerCase()) {
        conditions.push({ name: { equals: withSpaces, mode: 'insensitive' } });
    }
    return conditions;
}

/**
 * Get public presentation data for a specific guild
 */
export async function getGuildPresentation(
    guildId: string,
    checkEnabled: boolean = true
): Promise<GuildPresentation | null> {
    const whereClause: any = {
        OR: buildGuildLookupConditions(guildId),
        isActive: true,
    };

    if (checkEnabled) {
        whereClause.presentationEnabled = true;
    }

    const guild = await db.guildConfig.findFirst({
        where: whereClause,
        select: {
            id: true,
            discordGuildId: true,
            name: true,
            iconUrl: true,
            createdAt: true,
            presentationHistory: true,
            presentationActivities: true,
            presentationFounder: true,
            presentationCoLeaders: true,
            presentationTeam: true,
            presentationDiscord: true,
            presentationRecruiting: true,
            presentationRecruitReq: true,
            presentationServer: true,
            presentationBannerType: true,
            presentationBannerUrl: true,
            presentationPhotoUrl: true,
            presentationDiscordReq: true,
            presentationMinLevel: true,
            presentationMinSuccesses: true,
            presentationFoundedDate: true,
            presentationMemberCount: true,
        },
    });

    if (!guild) return null;

    // Force cast to any to bypass stale Prisma types during build
    // The fields exist in the database (npx prisma db push was run)
    const g = guild as any;

    // Team is now simple pseudo strings (no Discord fetching needed)
    const teamPseudos = (g.presentationTeam as string[]) || [];
    const coLeadersPseudos = (g.presentationCoLeaders as string[]) || [];

    return {
        id: g.id,
        discordGuildId: g.discordGuildId,
        name: g.name,
        iconUrl: g.iconUrl,
        createdAt: (g.createdAt as Date).toISOString(),
        history: g.presentationHistory,
        activities: g.presentationActivities as string[] | null,
        founder: g.presentationFounder,
        coLeaders: coLeadersPseudos,
        team: teamPseudos,
        discord: g.presentationDiscord,
        isRecruiting: g.presentationRecruiting,
        recruitmentRequirements: g.presentationRecruitReq,
        server: g.presentationServer,
        bannerType: g.presentationBannerType,
        bannerUrl: g.presentationBannerUrl ? g.presentationBannerUrl.replace(/^\/uploads\//, "/api/storage/") : null,
        photoUrl: g.presentationPhotoUrl ? g.presentationPhotoUrl.replace(/^\/uploads\//, "/api/storage/") : null,
        foundedDate: g.presentationFoundedDate ? (g.presentationFoundedDate as Date).toISOString() : null,
        memberCount: g.presentationMemberCount as number | null,
        discordRequired: g.presentationDiscordReq,
        minLevel: g.presentationMinLevel,
        minSuccesses: g.presentationMinSuccesses,
    };
}

/**
 * Get basic guild info to check if it exists but is private
 */
export async function getPublicGuildBasicInfo(
    guildId: string
): Promise<{ id: string; name: string; iconUrl: string | null; presentationEnabled: boolean } | null> {
    const guild = await db.guildConfig.findFirst({
        where: {
            OR: buildGuildLookupConditions(guildId),
            isActive: true, // Only if guild is active in system
        },
        select: {
            id: true,
            name: true,
            iconUrl: true,
            presentationEnabled: true,
        },
    });

    if (!guild) return null;

    return {
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconUrl,
        presentationEnabled: guild.presentationEnabled,
    };
}

// ============================================================================
// ADMIN ACTIONS (Requires presentation:edit permission)
// ============================================================================

export type DiscordMemberOption = {
    id: string;
    name: string;
    avatar: string | null;
};

/**
 * Get list of Discord guild members for team selection
 */
export async function getDiscordMembersForSelection(
    guildId: string
): Promise<{ success: boolean; members?: DiscordMemberOption[]; error?: string }> {
    const user = await getUserContext(guildId);

    if (!user.isAuthenticated || !user.isAdmin) {
        return { success: false, error: "Non autorisé" };
    }

    try {
        // #223 P1 — Fetch centralisé dans la couche Discord (v10 + SSRF guard + UA + cache).
        const members = await listGuildMembers(guildId);

        const humanMembers: DiscordMemberOption[] = members
            .filter((m: any) => !m.user?.bot)
            .map((m: any) => ({
                id: m.user.id,
                name: m.nick || m.user.global_name || m.user.username,
                // #23 — avatar Discord borné en taille (webp 256px) → chargement fiable.
                avatar: buildDiscordAvatarUrl(m.user.id, m.user.avatar),
            }))
            .sort((a: DiscordMemberOption, b: DiscordMemberOption) =>
                a.name.localeCompare(b.name)
            );

        return { success: true, members: humanMembers };
    } catch (error) {
        logger.error("Discord members fetch error:", error);
        return { success: false, error: "Erreur lors de la récupération" };
    }
}

export type PresentationUpdateData = {
    enabled: boolean;
    history: string | null;
    activities: string[];
    founder: string | null;
    coLeaders: string[]; // Up to 3 co-leader pseudos
    team: string[]; // Up to 10 bras droits pseudos
    discord: string | null;
    recruiting: boolean;
    recruitmentRequirements: string | null;
    server: string | null;
    bannerType: "discord" | "custom";
    bannerUrl: string | null;
    photoUrl: string | null;
    foundedDate: Date | null;
    memberCount: number | null;
    discordRequired: boolean;
    minLevel: number | null;
    minSuccesses: number | null;
};

/**
 * Update guild presentation data
 * All inputs are strictly sanitized
 */
export async function updateGuildPresentation(
    guildId: string,
    data: PresentationUpdateData
): Promise<{ success: boolean; error?: string }> {
    const user = await getUserContext(guildId);

    if (!user.isAuthenticated) {
        return { success: false, error: "Non authentifié" };
    }

    if (!user.isAdmin && !user.canEditPresentation) {
        // Log unauthorized access
        await logAdminAccessDenied(guildId, "Modification de la Présentation");
        return { success: false, error: "Permission insuffisante" };
    }

    try {
        // STRICT SANITIZATION
        const sanitizedDiscord = sanitizeDiscordLink(data.discord);
        // Use strict mode for presentation history (strips most tags)
        const sanitizedHistory = sanitizeHtml(data.history, 5000, true);
        const sanitizedReqs = sanitizeHtml(data.recruitmentRequirements, 1000, true);
        const sanitizedFounder = sanitizeName(data.founder);
        const validatedServer = validateServerName(data.server);
        const validatedLevel = validateLevel(data.minLevel);
        const validatedSuccesses = validateSuccesses(data.minSuccesses);

        // Validate activities against allowed list
        const allowedActivityIds = AVAILABLE_ACTIVITIES.map(a => a.id) as readonly string[];
        const validatedActivities = data.activities.filter(a => allowedActivityIds.includes(a));

        // Validate co-leaders (max 3 free text pseudos)
        const validatedCoLeaders = data.coLeaders
            .map(name => sanitizeName(name))
            .filter((name): name is string => name !== null && name.length > 0)
            .slice(0, 3);

        // Validate team/bras droits (max 10 free text pseudos)
        const validatedTeam = data.team
            .map(name => sanitizeName(name))
            .filter((name): name is string => name !== null && name.length > 0)
            .slice(0, 10);

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: {
                presentationEnabled: data.enabled,
                presentationHistory: sanitizedHistory,
                presentationActivities: validatedActivities,
                presentationFounder: sanitizedFounder,
                presentationCoLeaders: validatedCoLeaders,
                presentationTeam: validatedTeam,
                presentationDiscord: sanitizedDiscord,
                presentationRecruiting: data.recruiting,
                presentationRecruitReq: sanitizedReqs,
                presentationServer: validatedServer,
                presentationBannerType: data.bannerType,
                presentationBannerUrl: data.bannerUrl, // Can be null to delete
                presentationPhotoUrl: data.photoUrl, // Can be null to delete
                presentationFoundedDate: data.foundedDate,
                presentationMemberCount: data.memberCount,
                presentationDiscordReq: data.discordRequired,
                presentationMinLevel: validatedLevel,
                presentationMinSuccesses: validatedSuccesses,
            },
        });

        revalidatePath(`/guilds/${guildId}`);
        revalidatePath(`/dashboard/${guildId}/presentation`);

        return { success: true };
    } catch (error) {
        logger.error("Presentation update error:", error);
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

/**
 * Upload guild banner or photo
 */
export async function uploadPresentationImage(
    guildId: string,
    formData: FormData,
    imageType: "banner" | "photo"
): Promise<{ success: boolean; url?: string; error?: string }> {
    const user = await getUserContext(guildId);

    if (!user.isAuthenticated || (!user.isAdmin && !user.canEditPresentation)) {
        await logAdminAccessDenied(guildId, "Upload d'image de Présentation");
        return { success: false, error: "Non autorisé" };
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: {
            id: true,
            presentationBannerUrl: true,
            presentationPhotoUrl: true,
        },
    });

    if (!guild) {
        return { success: false, error: "Guilde non trouvée" };
    }

    // Delete old image if exists
    const oldUrl = imageType === "banner"
        ? guild.presentationBannerUrl
        : guild.presentationPhotoUrl;

    if (oldUrl) {
        await deleteGuildImage(guildId, oldUrl);
    }

    // Upload new image
    const result = await uploadGuildImage(guild.id, formData, imageType);

    if (!result.success) {
        return result;
    }

    // Update database
    const updateData = imageType === "banner"
        ? { presentationBannerUrl: result.url, presentationBannerType: "custom" }
        : { presentationPhotoUrl: result.url };

    await db.guildConfig.update({
        where: { discordGuildId: guildId },
        data: updateData,
    });

    revalidatePath(`/guilds/${guildId}`);
    return result;
}

/**
 * Delete a presentation image (banner or photo) - removes both file and database reference
 */
export async function deletePresentationImage(
    guildId: string,
    imageType: "banner" | "photo"
): Promise<{ success: boolean; error?: string }> {
    const user = await getUserContext(guildId);

    if (!user.isAuthenticated || (!user.isAdmin && !user.canEditPresentation)) {
        await logAdminAccessDenied(guildId, "Suppression d'image de Présentation");
        return { success: false, error: "Non autorisé" };
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: {
            id: true,
            presentationBannerUrl: true,
            presentationPhotoUrl: true,
        },
    });

    if (!guild) {
        return { success: false, error: "Guilde non trouvée" };
    }

    // Get the current image URL
    const imageUrl = imageType === "banner"
        ? guild.presentationBannerUrl
        : guild.presentationPhotoUrl;

    // Delete physical file if exists
    if (imageUrl) {
        await deleteGuildImage(guild.id, imageUrl);
    }

    // Update database to remove URL
    const updateData = imageType === "banner"
        ? { presentationBannerUrl: null }
        : { presentationPhotoUrl: null };

    await db.guildConfig.update({
        where: { discordGuildId: guildId },
        data: updateData,
    });

    revalidatePath(`/guilds/${guildId}`);
    return { success: true };
}

/**
 * Get current presentation data for admin editing
 */
export async function getAdminPresentationData(guildId: string): Promise<{
    success: boolean;
    data?: PresentationUpdateData & { bannerUrl: string | null; photoUrl: string | null };
    error?: string;
}> {
    const user = await getUserContext(guildId);

    if (!user.isAuthenticated) {
        return { success: false, error: "Non authentifié" };
    }

    if (!user.isAdmin && !user.canEditPresentation) {
        await logAdminAccessDenied(guildId, "Lecture des données de Présentation");
        return { success: false, error: "Non autorisé" };
    }

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: {
            presentationEnabled: true,
            presentationHistory: true,
            presentationActivities: true,
            presentationFounder: true,
            presentationCoLeaders: true,
            presentationTeam: true,
            presentationDiscord: true,
            presentationRecruiting: true,
            presentationRecruitReq: true,
            presentationServer: true,
            presentationBannerType: true,
            presentationBannerUrl: true,
            presentationPhotoUrl: true,
            presentationDiscordReq: true,
            presentationMinLevel: true,
            presentationMinSuccesses: true,
            presentationFoundedDate: true,
            presentationMemberCount: true,
            // presentationIsActive: true, // If I needed to check active status
        },
    });

    if (!guild) {
        return { success: false, error: "Guilde non trouvée" };
    }

    // Force cast to any to bypass stale Prisma types
    const d = guild as any;

    return {
        success: true,
        data: {
            enabled: d.presentationEnabled,
            history: d.presentationHistory,
            activities: (d.presentationActivities as string[]) || [],
            founder: d.presentationFounder,
            coLeaders: (d.presentationCoLeaders as string[]) || [],
            team: (d.presentationTeam as string[]) || [],
            discord: d.presentationDiscord,
            recruiting: d.presentationRecruiting,
            recruitmentRequirements: d.presentationRecruitReq,
            server: d.presentationServer,
            bannerType: (d.presentationBannerType as "discord" | "custom") || "discord",
            bannerUrl: d.presentationBannerUrl ? d.presentationBannerUrl.replace(/^\/uploads\//, "/api/storage/") : null,
            photoUrl: d.presentationPhotoUrl ? d.presentationPhotoUrl.replace(/^\/uploads\//, "/api/storage/") : null,
            foundedDate: d.presentationFoundedDate,
            memberCount: d.presentationMemberCount as number | null,
            discordRequired: d.presentationDiscordReq,
            minLevel: d.presentationMinLevel,
            minSuccesses: d.presentationMinSuccesses,
        },
    };
}
