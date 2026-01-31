"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rateLimit } from "@/lib/ratelimit";
import { hasAnyForgemagie, type AvailabilityMap, type ForgemagieStatusId } from "@/lib/dofus-assets";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

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
    pseudoDofus: z.string()
        .max(50, "Le pseudo ne peut pas dépasser 50 caractères")
        .regex(/^[a-zA-Z\u00C0-\u017F\u00DF\u00FF\u0100-\u017F]+$/, "Le pseudo ne doit contenir que des lettres (pas de chiffres ni de caractères spéciaux)")
        .optional(),
    classe: z.string().optional(),
    classeSecondaires: z.array(z.string()).optional(),
    metiers: z.array(z.string()).optional(),
    forgemagieStatus: z.enum(["FREE", "PAID", "UNAVAILABLE"]).optional(),
    fmPriceClassic: z.number().min(0, "Prix invalide").nullable().optional(),
    fmPriceTrans: z.number().min(0, "Prix invalide").nullable().optional(),
    fmPriceExo: z.number().min(0, "Prix invalide").nullable().optional(),
});

// Schema allows both legacy map (for validation) and new GlobalAvailability structure
const UpdateAvailabilitySchema = z.object({
    guildId: z.string(),
    // We accept any JSON structure here, validation will happen in component/render logic
    // primarily to allow the flexible "weeks" structure without complex Zod recursion
    availability: z.any(),
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

const SyncSuccessPointsSchema = z.object({
    guildId: z.string(),
    imageData: z.string(), // Base64 image string (data:image/...)
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

        // Attach pending submission if exists
        const pendingSubmission = await (db as any).achievementSubmission.findFirst({
            where: {
                profileId: profile.id,
                status: "PENDING"
            },
            orderBy: { createdAt: "desc" }
        });

        return {
            success: true,
            data: {
                ...profile,
                pendingSubmission: pendingSubmission ? {
                    id: pendingSubmission.id,
                    points: pendingSubmission.points,
                    ocrScore: pendingSubmission.ocrScore,
                    createdAt: pendingSubmission.createdAt
                } : null
            }
        };
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
                    const nickname = member.nick || member.user?.global_name || member.user?.username || null;
                    let roleName = "Membre";
                    let roleColor = 0;
                    const joinedAt = member.joined_at ? member.joined_at : null;

                    if (member.roles && member.roles.length > 0) {
                        const guildRoles = await fetchGuildRoles(guildId);
                        const memberRoles = guildRoles
                            .filter(r => member.roles.includes(r.id))
                            .sort((a, b) => b.position - a.position);

                        if (memberRoles.length > 0) {
                            roleName = memberRoles[0].name;
                            roleColor = memberRoles[0].color || 0;
                        }

                        // Admin Check
                        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
                        const rolesMapping = (guildConfig?.rolesMapping as Record<string, string[]>) || {};
                        const isAdmin = member.roles.some(rid => {
                            const hasSigilAdmin = rolesMapping[rid]?.includes("admin:access");
                            const role = guildRoles.find(r => r.id === rid);
                            const hasDiscordAdmin = role ? (BigInt(role.permissions) & 0x8n) === 0x8n : false;
                            return hasSigilAdmin || hasDiscordAdmin;
                        });

                        discordInfo = { nickname, roleName, roleColor, joinedAt, isAdmin };
                    } else {
                        discordInfo = { nickname, roleName, roleColor, joinedAt, isAdmin: false };
                    }
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
    const { guildId, pseudoDofus, classe, classeSecondaires, metiers, forgemagieStatus, fmPriceClassic, fmPriceTrans, fmPriceExo } = validation.data;

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
                fmPriceClassic: fmPriceClassic !== undefined ? fmPriceClassic : undefined,
                fmPriceTrans: fmPriceTrans !== undefined ? fmPriceTrans : undefined,
                fmPriceExo: fmPriceExo !== undefined ? fmPriceExo : undefined,
            },
            create: {
                userId: session.user.id,
                guildId: guildConfig.id,
                pseudoDofus: pseudoDofus || null,
                classe,
                classeSecondaires: classeSecondaires ? (classeSecondaires as any) : undefined,
                metiers: metiers ? (metiers as any) : undefined,
                forgemagieStatus,
                fmPriceClassic: fmPriceClassic || null,
                fmPriceTrans: fmPriceTrans || null,
                fmPriceExo: fmPriceExo || null,
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
    altPseudos: z.array(
        z.string()
            .min(2, "Pseudo trop court")
            .max(20, "Pseudo trop long")
            .regex(/^[A-Z][a-z0-9]*(-[A-Z][a-z0-9]*)?$/, "Format invalide (Ex: Pseudo, Pseudo-Surnom)")
    ).max(5, "Maximum 5 personnages"),
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
// DOFUSBOOK LINKS
// ============================================================================

const UpdateDofusBookLinksSchema = z.object({
    guildId: z.string(),
    links: z.array(z.object({
        id: z.string(),
        name: z.string()
            .min(1, "Nom requis")
            .max(30, "Nom trop long (max 30)")
            .regex(/^[a-zA-Z0-9À-ÿ\s\-_'().]+$/, "Caractères non autorisés"),
        url: z.string().regex(
            /^https:\/\/(www\.)?(d-bk\.net|dofusbook\.net)\/(fr|en|es|pt|de)\/[a-zA-Z0-9-_\/]+$/,
            "Format invalide (Ex: https://d-bk.net/fr/d/xyz)"
        )
    })).max(10, "Maximum 10 builds")
});

export async function updateDofusBookLinks(rawData: z.infer<typeof UpdateDofusBookLinksSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateDofusBookLinksSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, links } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        await db.userProfile.update({
            where: {
                userId_guildId: { userId: session.user.id, guildId: guildConfig.id }
            },
            data: { dofusBookLinks: links as any }
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        return { success: true };
    } catch (error) {
        console.error("Update Builds Error:", error);
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

        // 3. Parallelize Discord correlation for Admin rights
        const { listGuildMembers, fetchGuildRoles } = await import("@/server/discord");
        const [discordMembers, allRoles] = await Promise.all([
            listGuildMembers(guildId).catch(() => []),
            fetchGuildRoles(guildId, { excludeManaged: false }).catch(() => [])
        ]);

        // Identify roles that grant admin rights (Discord bit 0x8 or SigilOS mapping)
        const adminRoleIds = new Set<string>();
        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};

        for (const role of allRoles) {
            const hasDiscordAdmin = (BigInt(role.permissions) & 0x8n) === 0x8n;
            const hasSigilAdmin = rolesMapping[role.id]?.includes("admin:access");
            if (hasDiscordAdmin || hasSigilAdmin) {
                adminRoleIds.add(role.id);
            }
        }

        const discordMemberMap = new Map(discordMembers.map(m => [m.user.id, m]));

        // Fetch Discord Accounts for matching
        const users = await db.user.findMany({
            where: { id: { in: result.map(p => p.userId) } },
            include: { accounts: { where: { provider: "discord" } } }
        });
        const userDiscordIdMap = new Map(users.map(u => [u.id, u.accounts[0]?.providerAccountId]));

        // Map with Discord cache data + Real-time Admin check
        const mappedResult = result.map(p => {
            const discordId = userDiscordIdMap.get(p.userId);
            const discordMember = discordId ? discordMemberMap.get(discordId) : null;

            // Real-time admin check if we found the member
            const isAdmin = discordMember
                ? discordMember.roles.some(rid => adminRoleIds.has(rid))
                : false;

            return {
                ...p,
                user: { id: p.user.id, name: p.user.name, image: p.user.image },
                displayName: p.discordNickname || p.pseudoDofus || p.user.name,
                roleColor: p.discordRoleColor || 0,
                roleName: p.discordRoleName || "Membre",
                isAdmin
            };
        });

        return { success: true, data: mappedResult };

    } catch (error) {
        console.error("Get Members Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// DISCORD NOTIFICATIONS
// ============================================================================

// Rate Limiting needs to be outside the function scope to persist across calls (in stateful server environments)
// Note: specifically for server actions in Next.js, this map persists as long as the lambda/container is warm.
const notificationRateLimits = new Map<string, number>();

export async function sendVacationNotification(rawData: z.infer<typeof SendVacationNotificationSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = SendVacationNotificationSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, pseudo, profileId, startDate, endDate } = validation.data;

    // Rate Limiting Check
    const now = Date.now();
    const lastSent = notificationRateLimits.get(session.user.id);
    const COOLDOWN = 60 * 1000; // 60 seconds

    if (lastSent && now - lastSent < COOLDOWN) {
        const remaining = Math.ceil((COOLDOWN - (now - lastSent)) / 1000);
        return { success: false, error: `Veuillez patienter ${remaining}s avant de renvoyer une notification.` };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, absenceChannelId: true }
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // SECURITY: Verify the profile belongs to the session user to prevent impersonation
        const profile = await db.userProfile.findUnique({
            where: { id: profileId },
            select: { userId: true, discordNickname: true, pseudoDofus: true, user: { select: { name: true } } }
        });

        if (!profile || profile.userId !== session.user.id) {
            console.warn(`[Security] Impersonation attempt blocked: User ${session.user.id} tried to send notification for profile ${profileId}`);
            return { success: false, error: "Non autorisé" };
        }

        if (!guildConfig.absenceChannelId) {
            return { success: false, error: "Aucun salon configuré pour les notifications d'absence" };
        }

        // SECURITY: Validate channel belongs to this guild
        const { validateChannelBelongsToGuild } = await import("@/server/discord");
        const isValidChannel = await validateChannelBelongsToGuild(guildConfig.absenceChannelId, guildId);
        if (!isValidChannel) {
            return { success: false, error: "Salon Discord invalide ou n'appartient pas à ce serveur" };
        }

        // Apply Rate Limit Update only before successful attempt logic (or after?)
        // Applying before prevents spamming external API even if it fails, ensuring strict rate limit.
        notificationRateLimits.set(session.user.id, now);

        // Use the SECURED pseudo from the database profile, not the provided one
        const securedPseudo = profile.discordNickname || profile.pseudoDofus || profile.user.name || "Un membre";

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
            // Remove rate limit if it was a system error? No, keep it to prevent attack.
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

// ============================================================================
// OCR & LADDER SYNC
// ============================================================================

export async function syncMemberSuccessPoints(rawData: z.infer<typeof SyncSuccessPointsSchema>): Promise<ActionResponse<{ points: number, debugImage?: string, pending?: boolean, confidence?: number }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = SyncSuccessPointsSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, imageData } = validation.data;

    // 1. Sanitization & Rate Limiting
    // Rate limit: 10 syncs per 10 minutes (to be more forgiving while preventing spam)
    const limiter = await rateLimit(`sync_success:${session.user.id}`, 10, 10 * 60 * 1000);
    if (!limiter.success) {
        return { success: false, error: "Limite de tentatives atteinte. Veuillez patienter 10 minutes avant de réessayer la synchronisation." };
    }

    // Security: Validate Base64 size (limit to ~4MB to prevent memory exhaustion)
    // 4MB in base64 is roughly 5.5 million characters
    if (imageData.length > 6000000) {
        return { success: false, error: "L'image est trop lourde (max 4Mo)." };
    }

    // Security: Validate Image Format and Integrity (Hard check with Sharp)
    if (!imageData.startsWith("data:image/")) {
        return { success: false, error: "Format d'image invalide." };
    }

    try {
        const base64Data = imageData.split(',')[1];
        if (!base64Data) return { success: false, error: "Données d'image corrompues." };

        const buffer = Buffer.from(base64Data, 'base64');

        // Hard validation: If Sharp can't read metadata, it's not a valid image
        const sharp = await import("sharp");
        try {
            const metadata = await sharp.default(buffer).metadata();
            const allowedFormats = ["png", "jpeg", "webp", "tiff"];
            if (!metadata.format || !allowedFormats.includes(metadata.format)) {
                return { success: false, error: "Format d'image non supporté ou fichier malveillant détecté." };
            }
        } catch (e) {
            console.error("[Security] Sharp validation failed:", e);
            return { success: false, error: "Le fichier n'est pas une image valide ou est corrompu." };
        }

        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const currentProfile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guildId: guildConfig.id
            }
        });
        if (!currentProfile) return { success: false, error: "Profil introuvable" };

        // 1.1 SECURITY: Block if a submission is already pending
        const existingPending = await (db as any).achievementSubmission.findFirst({
            where: {
                profileId: currentProfile.id,
                status: "PENDING"
            }
        });

        if (existingPending) {
            return { success: false, error: "Vous avez déjà une demande de validation en attente. Annulez-la ou attendez le staff." };
        }

        // 2. OCR Processing (Optimized for small crops)
        const sharpInstance = sharp.default(buffer);
        const metadata = await sharpInstance.metadata();
        const isSmallCrop = (metadata.width || 0) < 600;

        // NICE BUFFER FOR DISPLAY
        const displayBuffer = await sharpInstance
            .resize({ width: 1000, withoutEnlargement: true })
            .webp({ quality: 90 })
            .toBuffer();

        const ocrBuffer = await sharpInstance
            .resize({ width: isSmallCrop ? 1800 : 1200, withoutEnlargement: false })
            .grayscale()
            .threshold(160)
            .toBuffer();

        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker(['fra', 'eng']);

        // Optimize for single line/block reading
        await worker.setParameters({
            tessedit_pageseg_mode: '6' as any,
        });

        const { data: { text, confidence } } = await worker.recognize(ocrBuffer);
        await worker.terminate();

        const cleanedTextForLog = text.replace(/\n/g, ' ').trim();
        console.log(`[OCR] Raw: "${cleanedTextForLog}" (Conf: ${confidence}%)`);

        // Security: Context Validation
        const dousKeywords = [
            "succès", "succes", "points", "de succès", "de succes", "personnage",
            "déverrouillé", "achievements", "avancement", "score", "progression"
        ];
        const lowerText = text.toLowerCase();
        const hasDofusContext = dousKeywords.some(kw => lowerText.includes(kw));

        // Threshold logic:
        if (confidence < 15) {
            return { success: false, error: "Image illisible. Essayez de prendre une capture d'écran plus nette." };
        }

        // 2. Parse points
        // Robust cleaning: Tesseract often adds spaces in large numbers (21 644)
        // We first normalize characters that look like numbers or separators
        const normalized = text
            .replace(/[Il|]/g, '1')
            .replace(/[Oo]/g, '0')
            .replace(/[.,'·]/g, '')
            .replace(/[^0-9/]/g, ' '); // Everything else is a space, keep slash for strategy A

        // Merge digits that were separated by 1 or 2 spaces only
        const cleanedText = normalized.replace(/(\d)\s{1,2}(?=\d)/g, '$1');

        let points = 0;

        // Strategy A: Progress bars (XXXX / YYYY) - Very common in Dofus
        // We match any two groups of numbers separated by / or |
        const progressMatch = cleanedText.match(/(\d{2,5})\s*[\/|1]\s*(\d{2,5})/);

        if (progressMatch) {
            points = parseInt(progressMatch[1], 10);
        } else {
            // Strategy B: Biggest number in the correct range
            const allNumbers = cleanedText.match(/\d{3,5}/g);
            if (allNumbers) {
                const candidates = allNumbers
                    .map(n => parseInt(n, 10))
                    .filter(n => n >= 50 && n <= 32000);

                if (candidates.length > 0) {
                    candidates.sort((a, b) => b - a);
                    points = candidates[0];
                }
            }
        }

        // Strategy C: REMOVED (Too risky, was letting random numbers pass)

        if (isNaN(points) || points <= 0) {
            return { success: false, error: "Aucun score détecté. Assurez-vous d'inclure vos points de succès dans le screen." };
        }

        // currentProfile already fetched above

        // 3. Threshold Logic
        // SECURITY HYBRID: 
        // - IF VERY high confidence (>90), we allow it even if keywords are missing (Banner only crop)
        // - IF good confidence (>70) AND keywords present, we allow it.
        const VERY_HIGH_CONFIDENCE = 90;
        const GOOD_CONFIDENCE = 70;
        const shouldAutoValidate = (confidence >= VERY_HIGH_CONFIDENCE) || (hasDofusContext && confidence >= GOOD_CONFIDENCE);

        // Fallback for Debug Image: use displayBuffer so user sees the "Nice" version
        const finalDebugBuffer = displayBuffer;

        console.log(`[OCR] Decision: Points=${points}, Context=${hasDofusContext}, Conf=${confidence}%, Auto=${shouldAutoValidate}`);

        if (shouldAutoValidate) {
            // Auto-update Profile
            await db.userProfile.update({
                where: { id: currentProfile.id },
                data: {
                    successPoints: points,
                    lastLadderUpdate: new Date(),
                    achievementPoints: points,
                    achievementLastSync: new Date()
                }
            });

            revalidatePath(`/dashboard/${guildConfig.discordGuildId}/profile`);
            revalidatePath(`/dashboard/${guildConfig.discordGuildId}/ladder`);

            return {
                success: true,
                data: {
                    points,
                    confidence,
                    debugImage: `data:image/webp;base64,${displayBuffer.toString('base64')}`
                }
            };
        } else {
            // MANUAL VALIDATION PATH
            // 4. Save image for staff review
            const uploadRelativeDir = `uploads/achievements/${guildConfig.discordGuildId}`;
            const uploadDir = join(process.cwd(), "public", uploadRelativeDir);
            await mkdir(uploadDir, { recursive: true });

            const fileName = `${session.user.id}-${Date.now()}.webp`;
            const filePath = join(uploadDir, fileName);

            // Save the ORIGINAL crop (with displayBuffer) for staff review so it's not ugly
            await writeFile(filePath, displayBuffer);
            const proofUrl = `/${uploadRelativeDir}/${fileName}`;

            // 5. Create Submission (Safety check for Prisma generation)
            if (!(db as any).achievementSubmission) {
                console.error("[Prisma] achievementSubmission model not found in client!");
                // Emergency fallback: just update the profile but log the error
                await db.userProfile.update({
                    where: { id: currentProfile.id },
                    data: {
                        successPoints: points,
                        lastLadderUpdate: new Date()
                    }
                });
                return {
                    success: true,
                    data: { points, debugImage: `data:image/webp;base64,${displayBuffer.toString('base64')}` }
                };
            }

            await (db as any).achievementSubmission.create({
                data: {
                    profileId: currentProfile.id,
                    guildId: guildConfig.id,
                    points,
                    proofUrl,
                    ocrScore: confidence,
                    ocrRawText: text
                }
            });

            return {
                success: true,
                data: {
                    points,
                    pending: true,
                    confidence,
                    debugImage: `data:image/webp;base64,${finalDebugBuffer.toString('base64')}`
                }
            };
        }
    } catch (error: any) {
        console.error("Sync Success Points Error:", error);

        // Try to capture the processed buffer even on error if it's available in the scope
        // (Note: it might not be available if error happens before processedBuffer is created)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erreur lors du traitement de l'image (OCR)"
        };
    }
}
