"use server";

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
        console.error("Error fetching public guilds:", error);
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
    // Recruitment specific
    discordRequired: boolean;
    minLevel: number | null;
    minSuccesses: number | null;
};

/**
 * Get public presentation data for a specific guild
 */
export async function getGuildPresentation(
    guildId: string,
    checkEnabled: boolean = true
): Promise<GuildPresentation | null> {
    const whereClause: any = {
        OR: [
            { id: guildId },
            { discordGuildId: guildId },
        ],
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
            OR: [
                { id: guildId },
                { discordGuildId: guildId },
            ],
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
        const token = process.env.DISCORD_BOT_TOKEN;
        const res = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`,
            {
                headers: { Authorization: `Bot ${token}` },
                next: { revalidate: 60 },
            }
        );

        if (!res.ok) {
            return { success: false, error: "Impossible de récupérer les membres" };
        }

        const members = await res.json();

        const humanMembers: DiscordMemberOption[] = members
            .filter((m: any) => !m.user?.bot)
            .map((m: any) => ({
                id: m.user.id,
                name: m.nick || m.user.global_name || m.user.username,
                avatar: m.user.avatar
                    ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png`
                    : null,
            }))
            .sort((a: DiscordMemberOption, b: DiscordMemberOption) =>
                a.name.localeCompare(b.name)
            );

        return { success: true, members: humanMembers };
    } catch (error) {
        console.error("Discord members fetch error:", error);
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
                presentationDiscordReq: data.discordRequired,
                presentationMinLevel: validatedLevel,
                presentationMinSuccesses: validatedSuccesses,
            },
        });

        revalidatePath(`/guilds/${guildId}`);
        revalidatePath(`/dashboard/${guildId}/presentation`);

        return { success: true };
    } catch (error) {
        console.error("Presentation update error:", error);
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
            discordRequired: d.presentationDiscordReq,
            minLevel: d.presentationMinLevel,
            minSuccesses: d.presentationMinSuccesses,
        },
    };
}
