"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasAnyForgemagie, type AvailabilityMap, type ForgemagieStatusId } from "@/lib/dofus-assets";

// ============================================================================
// TYPES
// ============================================================================

export type ActionResponse<T = null> = {
    success: boolean;
    error?: string;
    data?: T;
};

// ============================================================================
// SCHEMAS
// ============================================================================

const UpdateProfileSchema = z.object({
    guildId: z.string(),
    pseudoDofus: z.string().max(30).optional(),
    classe: z.string().optional(),
    classeSecondaires: z.array(z.string()).optional(),
    metiers: z.array(z.string()).optional(),
    forgemagieStatus: z.enum(["FREE", "PAID", "UNAVAILABLE"]).optional(),
});

const UpdateAvailabilitySchema = z.object({
    guildId: z.string(),
    availability: z.record(z.array(z.enum(["matin", "midi", "soir"]))),
});

const UpdateVacationSchema = z.object({
    guildId: z.string(),
    vacationStart: z.string().datetime().nullable().optional(),
    vacationEnd: z.string().datetime().nullable().optional(),
    vacationNotify: z.boolean().optional(),
});

const UpdateForgemagieSchema = z.object({
    guildId: z.string(),
    status: z.enum(["FREE", "PAID", "UNAVAILABLE"]),
});

const SendVacationNotificationSchema = z.object({
    guildId: z.string(),
    pseudo: z.string(),
    profileId: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
});

// ============================================================================
// PROFILE CRUD
// ============================================================================

export async function getUserProfile(guildId: string): Promise<ActionResponse<any>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: guildConfig.id
                }
            },
            include: { user: true }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        return { success: true, data: profile };
    } catch (error) {
        console.error("Get Profile Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function getMemberProfile(guildId: string, profileId: string): Promise<ActionResponse<any>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Verify caller is member of guild
        const callerProfile = await db.userProfile.findUnique({
            where: {
                userId_guildId: { userId: session.user.id, guildId: guildConfig.id }
            }
        });
        if (!callerProfile) return { success: false, error: "Accès refusé" };

        // Fetch target profile
        const profile = await db.userProfile.findFirst({
            where: { id: profileId, guildId: guildConfig.id },
            include: {
                user: {
                    include: {
                        accounts: {
                            where: { provider: "discord" },
                            select: { providerAccountId: true }
                        }
                    }
                }
            }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        // Fetch Discord info
        let discordInfo = null;
        const discordAccountId = profile.user.accounts?.[0]?.providerAccountId;
        if (discordAccountId) {
            try {
                const { fetchGuildMember, fetchGuildRoles } = await import("@/server/discord");
                const member = await fetchGuildMember(guildId, discordAccountId);
                if (member) {
                    let nickname = member.nick || member.user?.global_name || member.user?.username || null;
                    let roleName = "Membre";
                    let roleColor = 0;
                    let joinedAt = member.joined_at ? member.joined_at : null;

                    if (member.roles && member.roles.length > 0) {
                        const guildRoles = await fetchGuildRoles(guildId);
                        const memberRoles = guildRoles
                            .filter(r => member.roles.includes(r.id))
                            .sort((a, b) => b.position - a.position);
                        if (memberRoles.length > 0) {
                            roleName = memberRoles[0].name;
                            roleColor = memberRoles[0].color || 0;
                        }
                    }

                    discordInfo = { nickname, roleName, roleColor, joinedAt };
                }
            } catch (e) {
                console.warn("Failed to fetch Discord info:", e);
            }
        }

        // Get Start of Week (Monday)
        const now = new Date();
        const day = now.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const startOfWeek = new Date(now.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);

        // Fetch validated submissions with mission data for XP calculation (Total & Weekly)
        const allValidatedSubmissions = await db.submission.findMany({
            where: {
                profileId: profile.id,
                status: "VALIDATED"
            },
            include: {
                mission: {
                    select: { xpReward: true }
                }
            }
        });

        const weeklySubmissions = allValidatedSubmissions.filter(s => s.updatedAt >= startOfWeek);
        const weeklyMissions = weeklySubmissions.length;
        const weeklyXp = weeklySubmissions.reduce((acc, curr) => acc + (curr.mission.xpReward || 0), 0);

        // Count validated missions (Total)
        const validatedMissionsCount = allValidatedSubmissions.length;

        return {
            success: true,
            data: {
                ...profile,
                user: { id: profile.user.id, name: profile.user.name, image: profile.user.image },
                discordInfo,
                validatedMissionsCount,
                weeklyMissions,
                weeklyXp
            }
        };
    } catch (error) {
        console.error("Get Member Profile Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateUserProfile(rawData: z.infer<typeof UpdateProfileSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateProfileSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, pseudoDofus, classe, classeSecondaires, metiers, forgemagieStatus } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        await db.userProfile.upsert({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: guildConfig.id
                }
            },
            update: {
                pseudoDofus: pseudoDofus !== undefined ? (pseudoDofus || null) : undefined,
                classe,
                classeSecondaires: classeSecondaires ? (classeSecondaires as any) : undefined,
                metiers: metiers ? (metiers as any) : undefined,
                forgemagieStatus,
            },
            create: {
                userId: session.user.id,
                guildId: guildConfig.id,
                pseudoDofus: pseudoDofus || null,
                classe,
                classeSecondaires: classeSecondaires ? (classeSecondaires as any) : undefined,
                metiers: metiers ? (metiers as any) : undefined,
                forgemagieStatus,
                status: "ACTIVE"
            }
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        revalidatePath(`/dashboard/${guildId}/members`);
        return { success: true };
    } catch (error) {
        console.error("Update Profile Error:", error);
        return { success: false, error: "Erreur lors de la sauvegarde" };
    }
}

// ============================================================================
// AVAILABILITY & VACATION
// ============================================================================

export async function updateAvailability(rawData: z.infer<typeof UpdateAvailabilitySchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateAvailabilitySchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, availability } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        await db.userProfile.update({
            where: {
                userId_guildId: { userId: session.user.id, guildId: guildConfig.id }
            },
            data: { availability: availability as any }
        });

        return { success: true };
    } catch (error) {
        console.error("Update Availability Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateVacationMode(rawData: z.infer<typeof UpdateVacationSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateVacationSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, vacationStart, vacationEnd, vacationNotify } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        await db.userProfile.update({
            where: {
                userId_guildId: { userId: session.user.id, guildId: guildConfig.id }
            },
            data: {
                vacationStart: vacationStart ? new Date(vacationStart) : null,
                vacationEnd: vacationEnd ? new Date(vacationEnd) : null,
                vacationNotify: vacationNotify ?? false,
            }
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        return { success: true };
    } catch (error) {
        console.error("Update Vacation Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateForgemagieStatus(rawData: z.infer<typeof UpdateForgemagieSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateForgemagieSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, status } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        await db.userProfile.update({
            where: {
                userId_guildId: { userId: session.user.id, guildId: guildConfig.id }
            },
            data: { forgemagieStatus: status }
        });

        return { success: true };
    } catch (error) {
        console.error("Update Forgemagie Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

const UpdateAltPseudosSchema = z.object({
    guildId: z.string(),
    altPseudos: z.array(z.string().max(24)).max(5),
});

export async function updateAltPseudos(rawData: z.infer<typeof UpdateAltPseudosSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateAltPseudosSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, altPseudos } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Clean and validate pseudos
        const cleanedPseudos = altPseudos
            .map(p => p.trim())
            .filter(p => p.length > 0)
            .slice(0, 5); // Max 5 pseudos

        await db.userProfile.update({
            where: {
                userId_guildId: { userId: session.user.id, guildId: guildConfig.id }
            },
            data: { altPseudos: cleanedPseudos }
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        return { success: true };
    } catch (error) {
        console.error("Update Alt Pseudos Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// GAMIFICATION
// ============================================================================

export type ContributorTier = "LEGENDE" | "CHAMPION" | "PILIER" | null;

export async function getProfileStats(guildId: string, userId?: string): Promise<ActionResponse<{
    xp: number;
    weeklyXp: number;
    guildatons: number;
    missionsValidated: number;
    weeklyMissions: number;
    lastActivity: { description: string; date: Date } | null;
    joinedAt: Date | null;
    isTopContributor: boolean;
    contributorTier: ContributorTier;
    rank?: number;
}>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const targetUserId = userId || session.user.id;

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: { userId: targetUserId, guildId: guildConfig.id }
            },
            include: {
                user: {
                    include: {
                        accounts: {
                            where: { provider: "discord" },
                            select: { providerAccountId: true }
                        }
                    }
                }
            }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        // Get Start of Week (Monday)
        const now = new Date();
        const day = now.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const startOfWeek = new Date(now.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);

        // Fetch validated submissions with mission data for XP calculation
        const allValidatedSubmissions = await db.submission.findMany({
            where: {
                profileId: profile.id,
                status: "VALIDATED"
            },
            include: {
                mission: {
                    select: { xpReward: true }
                }
            }
        });

        const weeklySubmissions = allValidatedSubmissions.filter(s => s.updatedAt >= startOfWeek);

        const weeklyMissions = weeklySubmissions.length;
        const weeklyXp = weeklySubmissions.reduce((acc, curr) => acc + (curr.mission.xpReward || 0), 0);

        // Calculate contributor tier based on monthly XP ranking
        // Tier thresholds:
        // - Top 1: Légende (gold)
        // - Top 2-3: Champion (silver) 
        // - Top 4-10: Pilier (bronze)
        let contributorTier: ContributorTier = null;
        let rank: number | undefined;

        // Get all guild members sorted by XP (descending)
        const guildRanking = await db.userProfile.findMany({
            where: {
                guildId: guildConfig.id,
                status: "ACTIVE"
            },
            orderBy: { xp: "desc" },
            select: { userId: true, xp: true }
        });

        // Find user's rank
        const userRankIndex = guildRanking.findIndex(p => p.userId === targetUserId);
        if (userRankIndex !== -1) {
            rank = userRankIndex + 1; // 1-indexed rank

            if (rank === 1) {
                contributorTier = "LEGENDE";
            } else if (rank <= 3) {
                contributorTier = "CHAMPION";
            } else if (rank <= 10) {
                contributorTier = "PILIER";
            }
        }

        // Legacy isTopContributor for backwards compatibility
        const isTopContributor = contributorTier !== null;

        const joinedAt = null; // Default to null for now, handled by UserContext in UI

        return {
            success: true,
            data: {
                xp: profile.xp,
                guildatons: profile.guildatons,
                missionsValidated: allValidatedSubmissions.length,
                weeklyXp,
                weeklyMissions,
                lastActivity: profile.lastActivityAt
                    ? { description: "Dernière activité", date: profile.lastActivityAt }
                    : null,
                joinedAt,
                isTopContributor,
                contributorTier,
                rank
            }
        };
    } catch (error) {
        console.error("Get Stats Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// DIRECTORY ACTIONS
// ============================================================================

export async function getGuildMembers(
    guildId: string,
    filters?: { job?: string; class?: string; hasVacation?: boolean }
): Promise<ActionResponse<any[]>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const whereClause: any = {
            guildId: guildConfig.id,
            status: "ACTIVE"
        };

        if (filters?.class) {
            whereClause.classe = filters.class;
        }

        const profiles = await db.userProfile.findMany({
            where: whereClause,
            include: { user: true },
            orderBy: { pseudoDofus: 'asc' }
        });

        let result = profiles;

        if (filters?.job) {
            result = result.filter(p => {
                const jobs = (p.metiers as string[]) || [];
                return jobs.includes(filters.job!);
            });
        }

        if (filters?.hasVacation === false) {
            const now = new Date();
            result = result.filter(p => {
                if (!p.vacationStart || !p.vacationEnd) return true;
                return !(p.vacationStart <= now && p.vacationEnd >= now);
            });
        }

        // Map with Discord cache data
        const mappedResult = result.map(p => ({
            ...p,
            user: { id: p.user.id, name: p.user.name, image: p.user.image },
            displayName: p.discordNickname || p.pseudoDofus || p.user.name,
            roleColor: p.discordRoleColor || 0,
            roleName: p.discordRoleName || "Membre",
        }));

        return { success: true, data: mappedResult };

    } catch (error) {
        console.error("Get Members Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// DISCORD NOTIFICATIONS
// ============================================================================

export async function sendVacationNotification(rawData: z.infer<typeof SendVacationNotificationSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = SendVacationNotificationSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, pseudo, profileId, startDate, endDate } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { absenceChannelId: true }
        });

        if (!guildConfig?.absenceChannelId) {
            return { success: false, error: "Aucun salon configuré pour les notifications d'absence" };
        }

        const channelId = guildConfig.absenceChannelId;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const profileUrl = `${appUrl}/dashboard/${guildId}/members/${profileId}`;

        // Format dates
        const formatDate = (dateStr: string | null) => {
            if (!dateStr) return "Pas de date prévue";
            const date = new Date(dateStr);
            return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        };

        const embed = {
            title: "🏝️ Notification d'absence",
            description: `[${pseudo}](${profileUrl}) sera absent(e).`,
            color: 0x06b6d4, // Cyan
            fields: [
                { name: "📅 Début", value: formatDate(startDate), inline: true },
                { name: "📅 Retour", value: formatDate(endDate), inline: true },
            ],
            footer: { text: "SigilOS • Mode Vacances" },
            timestamp: new Date().toISOString(),
        };

        const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ embeds: [embed] }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Discord API Error:", response.status, errorData);
            if (response.status === 403) {
                return { success: false, error: "Bot n'a pas accès au salon. Vérifiez les permissions." };
            }
            return { success: false, error: "Erreur Discord API" };
        }

        return { success: true };
    } catch (error) {
        console.error("Send Vacation Notification Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}
