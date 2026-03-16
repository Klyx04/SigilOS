"use server";

import { db } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getUserContext } from "./user-actions";
import { logger } from "@/lib/logger";
import { join } from "path";
import sharp from "sharp";
import { analyzeImage, hashImage, shouldAutoValidate } from "@/lib/llm-ocr";
import { writeFile, mkdir } from "fs/promises";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/ratelimit";
import { z } from "zod";
import { formatDofusPseudo } from "@/lib/utils";
import { getDiscordPublicUrl } from "@/lib/storage-utils";

const rankingCache = new Map<string, { data: any[], expiresAt: number }>();
const RANKING_CACHE_TTL = 300_000; // 5 minutes

/**
 * Pre-warm the Redis cache for Dofusbook builds.
 * Called non-blocking (setTimeout) after a user saves their links.
 * Extracts the build ID from the URL and hits our own proxy to populate Redis.
 */
// warmDofusbookCache is disabled — Dofusbook API blocked by Cloudflare for all server IPs.
// Cache is warmed via getDofusbookPreview during the bake step in updateDofusBookLinks.
function warmDofusbookCache(_urls: string[]): void { /* no-op */ }


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
        .regex(/^[a-zA-Z\u00C0-\u017F\u00DF\u00FF\u0100-\u017F\-\s]*$/, "Le pseudo ne doit contenir que des lettres, espaces et tirets (pas de chiffres ni de caractères spéciaux)")
        .optional(),
    classe: z.string().optional(),
    classeSecondaires: z.array(z.string()).max(10, "Maximum 10 classes secondaires").optional(),
    metiers: z.array(z.string()).optional(),
    forgemagieStatus: z.enum(["FREE", "PAID", "UNAVAILABLE"]).optional(),
    fmPriceClassic: z.number().min(0, "Prix invalide").nullable().optional(),
    fmPriceTrans: z.number().min(0, "Prix invalide").nullable().optional(),
    fmPriceExo: z.number().min(0, "Prix invalide").nullable().optional(),
    showPresence: z.boolean().optional(),
    targetUserId: z.string().optional(),
});

// Schema allows both legacy map (for validation) and new GlobalAvailability structure
const UpdateAvailabilitySchema = z.object({
    guildId: z.string(),
    // We accept any JSON structure here, validation will happen in component/render logic
    // primarily to allow the flexible "weeks" structure without complex Zod recursion
    availability: z.any(),
    targetUserId: z.string().optional(),
});

const UpdateVacationSchema = z.object({
    guildId: z.string(),
    vacationStart: z.string().datetime().nullable().optional(),
    vacationEnd: z.string().datetime().nullable().optional(),
    vacationNotify: z.boolean().optional(),
    targetUserId: z.string().optional(),
});

const UpdateForgemagieSchema = z.object({
    guildId: z.string(),
    status: z.enum(["FREE", "PAID", "UNAVAILABLE"]),
    targetUserId: z.string().optional(),
});

const SendVacationNotificationSchema = z.object({
    guildId: z.string(),
    pseudo: z.string(),
    profileId: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
});

const UpdateNotificationPrefsSchema = z.object({
    guildId: z.string(),
    prefs: z.object({
        missions: z.boolean().optional(),
        songes: z.boolean().optional(),
        events: z.boolean().optional(),
        ladder: z.boolean().optional(),
        polls: z.boolean().optional(),
        admin_validations: z.boolean().optional(),
        ocre: z.boolean().optional(),
        donjons: z.boolean().optional(),
    }),
    targetUserId: z.string().optional(),
});

const SyncSuccessPointsSchema = z.object({
    guildId: z.string(),
    imageData: z.string(), // Base64 image string (data:image/...)
    targetUserId: z.string().optional(),
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
            include: {
                user: true,
                roleGrants: {
                    where: {
                        revokedAt: null,
                        OR: [
                            { expiresAt: null },
                            { expiresAt: { gt: new Date() } }
                        ]
                    },
                    include: { role: true }
                }
            }
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
                createdAt: profile.createdAt.toISOString(),
                updatedAt: profile.updatedAt.toISOString(),
                lastActivityAt: profile.lastActivityAt?.toISOString() || null,
                vacationStart: profile.vacationStart?.toISOString() || null,
                vacationEnd: profile.vacationEnd?.toISOString() || null,
                hasSeenWelcome: profile.hasSeenWelcome,
                introduction: profile.introduction,
                showPresence: profile.showPresence,
                sigilRoles: profile.roleGrants.map(rg => ({
                    id: rg.role.id,
                    slug: rg.role.slug,
                    label: rg.role.label,
                    color: rg.role.color,
                    icon: rg.role.icon,
                    expiresAt: rg.expiresAt
                })),
                pendingSubmission: pendingSubmission ? {
                    id: pendingSubmission.id,
                    points: pendingSubmission.points,
                    ocrScore: pendingSubmission.ocrScore,
                    createdAt: pendingSubmission.createdAt.toISOString()
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

        // Fetch target profile (SECURITY: Only active profiles are accessible)
        const profile = await db.userProfile.findFirst({
            where: {
                id: profileId,
                guildId: guildConfig.id,
                status: "ACTIVE"  // Prevent access to archived/banned profiles
            },
            include: {
                user: {
                    include: {
                        accounts: {
                            where: { provider: "discord" },
                            select: { providerAccountId: true }
                        }
                    }
                },
                roleGrants: {
                    where: {
                        revokedAt: null,
                        OR: [
                            { expiresAt: null },
                            { expiresAt: { gt: new Date() } }
                        ]
                    },
                    include: { role: true }
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
                logger.warn("Failed to fetch Discord info", { error: e });
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

        const weeklySubmissions = allValidatedSubmissions.filter((s: { updatedAt: Date }) => s.updatedAt >= startOfWeek);
        const weeklyMissions = weeklySubmissions.length;
        const weeklyXp = weeklySubmissions.reduce((acc: number, curr: { mission: { xpReward: number | null } }) => acc + (curr.mission.xpReward || 0), 0);

        // Count validated missions (Total)
        const validatedMissionsCount = allValidatedSubmissions.length;

        return {
            success: true,
            data: {
                ...profile,
                createdAt: profile.createdAt.toISOString(),
                updatedAt: profile.updatedAt.toISOString(),
                lastActivityAt: profile.lastActivityAt?.toISOString() || null,
                vacationStart: profile.vacationStart?.toISOString() || null,
                vacationEnd: profile.vacationEnd?.toISOString() || null,
                user: { id: profile.user.id, name: profile.user.name, image: profile.user.image },
                introduction: profile.introduction,
                discordInfo,
                sigilRoles: profile.roleGrants.map(rg => ({
                    id: rg.role.id,
                    slug: rg.role.slug,
                    label: rg.role.label,
                    color: rg.role.color,
                    icon: rg.role.icon,
                    expiresAt: rg.expiresAt
                })),
                validatedMissionsCount,
                weeklyMissions,
                weeklyXp
            }
        };
    } catch (error) {
        logger.error("Get Member Profile Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateUserProfile(rawData: z.infer<typeof UpdateProfileSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateProfileSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, classe, classeSecondaires, metiers, forgemagieStatus, fmPriceClassic, fmPriceTrans, fmPriceExo, showPresence, targetUserId } = validation.data;
    let { pseudoDofus } = validation.data;

    // Formater le pseudo Dofus
    if (pseudoDofus) {
        pseudoDofus = formatDofusPseudo(pseudoDofus);
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // --- SECURITY: RBAC / OWNERSHIP CHECK ---
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

        // Effective user is self, or target if God
        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : session.user.id;
        const isOwner = effectiveUserId === session.user.id;
        const isGod = user.isSuperAdmin;

        if (!isOwner && !isGod) {
            logger.warn(`[Security] Unauthorized profile update attempt by ${session.user.id} on ${effectiveUserId} (God: ${isGod})`);
            return { success: false, error: "Vous n'avez pas la permission de modifier ce profil." };
        }

        // Uniqueness Check for Pseudo Dofus
        if (pseudoDofus) {
            const existing = await db.userProfile.findFirst({
                where: {
                    guildId: guildConfig.id,
                    pseudoDofus: { equals: pseudoDofus, mode: "insensitive" },
                    userId: { not: effectiveUserId } // Exclude target
                }
            });

            if (existing) {
                return { success: false, error: `Le pseudo "${pseudoDofus}" est déjà utilisé par un autre membre.` };
            }
        }

        await db.userProfile.upsert({
            where: {
                userId_guildId: {
                    userId: effectiveUserId,
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
                showPresence: showPresence !== undefined ? showPresence : undefined,
            },
            create: {
                userId: effectiveUserId,
                guildId: guildConfig.id,
                pseudoDofus: pseudoDofus || null,
                classe,
                classeSecondaires: classeSecondaires ? (classeSecondaires as any) : undefined,
                metiers: metiers ? (metiers as any) : undefined,
                forgemagieStatus,
                fmPriceClassic: fmPriceClassic || null,
                fmPriceTrans: fmPriceTrans || null,
                fmPriceExo: fmPriceExo || null,
                showPresence: showPresence ?? true,
                status: "ACTIVE"
            }
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        revalidatePath(`/dashboard/${guildId}/members`);
        return { success: true };
    } catch (error) {
        logger.error("Update Profile Error", { error });
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
    const { guildId, availability, targetUserId } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // --- SECURITY: RBAC / OWNERSHIP CHECK ---
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : session.user.id;
        const isOwner = effectiveUserId === session.user.id;
        const isGod = user.isSuperAdmin;

        if (!isOwner && !isGod) {
            logger.warn(`[Security] Unauthorized availability update attempt by ${session.user.id} on ${effectiveUserId} (God: ${isGod})`);
            return { success: false, error: "Vous n'avez pas la permission de modifier ces disponibilités." };
        }

        await db.userProfile.update({
            where: {
                userId_guildId: { userId: effectiveUserId, guildId: guildConfig.id }
            },
            data: { availability: availability as any }
        });

        return { success: true };
    } catch (error) {
        logger.error("Update Availability Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateVacationMode(rawData: z.infer<typeof UpdateVacationSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateVacationSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, vacationStart, vacationEnd, vacationNotify, targetUserId } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // --- SECURITY: RBAC / OWNERSHIP CHECK ---
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : session.user.id;
        const isOwner = effectiveUserId === session.user.id;
        const isGod = user.isSuperAdmin;

        if (!isOwner && !isGod) {
            logger.warn(`[Security] Unauthorized vacation update attempt by ${session.user.id} on ${effectiveUserId} (God: ${isGod})`);
            return { success: false, error: "Vous n'avez pas la permission de modifier ce mode absence." };
        }

        await db.userProfile.update({
            where: {
                userId_guildId: { userId: effectiveUserId, guildId: guildConfig.id }
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
        logger.error("Update Vacation Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateNotificationPrefs(rawData: z.infer<typeof UpdateNotificationPrefsSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const validation = UpdateNotificationPrefsSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, prefs, targetUserId } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // --- SECURITY: RBAC / OWNERSHIP CHECK ---
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated) return { success: false, error: "Non authentifié" };

        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : session.user.id;
        const isOwner = effectiveUserId === session.user.id;
        const isGod = user.isSuperAdmin;

        if (!isOwner && !isGod) {
            logger.warn(`[Security] Unauthorized notification prefs update attempt by ${session.user.id} on ${effectiveUserId} (God: ${isGod})`);
            return { success: false, error: "Vous n'avez pas la permission de modifier ces préférences." };
        }

        const currentProfile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: effectiveUserId, guildId: guildConfig.id } },
            select: { notificationPrefs: true }
        });

        const currentPrefs = (currentProfile?.notificationPrefs as any) || {};
        const newPrefs = { ...currentPrefs, ...prefs };

        await db.userProfile.update({
            where: {
                userId_guildId: { userId: effectiveUserId, guildId: guildConfig.id }
            },
            data: { notificationPrefs: newPrefs }
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        return { success: true };
    } catch (error) {
        logger.error("Update Notification Prefs Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateForgemagieStatus(rawData: z.infer<typeof UpdateForgemagieSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateForgemagieSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, status, targetUserId } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // --- SECURITY: RBAC / OWNERSHIP CHECK ---
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : session.user.id;
        const isOwner = effectiveUserId === session.user.id;
        const isGod = user.isSuperAdmin;

        if (!isOwner && !isGod) {
            logger.warn(`[Security] Unauthorized forgemagie update attempt by ${session.user.id} on ${effectiveUserId} (God: ${isGod})`);
            return { success: false, error: "Vous n'avez pas la permission de modifier ce statut." };
        }

        await db.userProfile.update({
            where: {
                userId_guildId: { userId: effectiveUserId, guildId: guildConfig.id }
            },
            data: { forgemagieStatus: status }
        });

        return { success: true };
    } catch (error) {
        logger.error("Update Forgemagie Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

const AltPseudoObjectSchema = z.object({
    id: z.string().optional(),
    pseudo: z.string()
        .min(2, "Pseudo trop court")
        .max(20, "Pseudo trop long")
        .regex(/^[A-Z][a-zA-Z0-9]*(-[a-zA-Z0-9]+)*$/, "Format invalide (Ex: Pseudo, Pseudo-mule, Pseudo-1)"),
    classe: z.string().optional(),
    level: z.number().min(0).max(200).optional()
});

const UpdateAltPseudosSchema = z.object({
    guildId: z.string(),
    altPseudos: z.array(AltPseudoObjectSchema).max(5, "Maximum 5 personnages"),
    targetUserId: z.string().optional(),
});

export async function updateAltPseudos(rawData: z.infer<typeof UpdateAltPseudosSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateAltPseudosSchema.safeParse(rawData);
    if (!validation.success) {
        logger.error("[Alt Pseudos] Validation error", { error: validation.error.format() });
        return { success: false, error: "Données invalides" };
    }
    const { guildId, altPseudos, targetUserId } = validation.data;

    logger.info(`[Alt Pseudos] Updating alt pseudos for guild ${guildId}`, { altPseudos });

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const cleanedPseudos = altPseudos.slice(0, 5).map(p => ({
            ...p,
            pseudo: formatDofusPseudo(p.pseudo)
        }));

        // --- SECURITY: RBAC / OWNERSHIP CHECK ---
        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : session.user.id;
        const isOwner = effectiveUserId === session.user.id;
        const isGod = user.isSuperAdmin;

        if (!isOwner && !isGod) {
            logger.warn(`[Security] Unauthorized alt pseudos update attempt by ${session.user.id} on ${effectiveUserId} (God: ${isGod})`);
            return { success: false, error: "Vous n'avez pas la permission de modifier ces pseudos secondaires." };
        }

        logger.info(`[Dofusbook] Profile ${effectiveUserId} in guild ${guildConfig.id} -> Saving`, { cleanedPseudos });

        await db.userProfile.update({
            where: {
                userId_guildId: { userId: effectiveUserId, guildId: guildConfig.id }
            },
            data: { altPseudos: cleanedPseudos }
        });

        logger.info(`[Dofusbook] Successfully updated database for ${user.id}`);

        revalidatePath(`/dashboard/${guildId}/profile`);
        return { success: true };
    } catch (error: unknown) {
        logger.error("[Dofusbook] Update Alt Pseudos DATABASE ERROR", { error });
        return { success: false, error: "Erreur serveur critique" };
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
            .max(30, "Nom trop long (max 30)"),
        url: z.string().regex(
            /^https:\/\/(www\.)?(d-bk\.net|dofusbook\.net)\/(fr|en|es|pt|de)\/(?:private\/)?[a-zA-Z0-9-_\/]+$/,
            "Format invalide (Ex: https://d-bk.net/fr/d/xyz)"
        ),
        tags: z.array(z.string()).optional(),
        classId: z.number().optional(),
        previewData: z.any().optional(), // Cached build info to bypass 403 later
    })).max(20, "Maximum 20 builds"),
    targetUserId: z.string().optional(),
});

export async function updateDofusBookLinks(rawData: z.infer<typeof UpdateDofusBookLinksSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateDofusBookLinksSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, links, targetUserId } = validation.data;

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };
    if (!user.isMember) return { success: false, error: "Not a member" };

    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // --- SECURITY: RBAC / OWNERSHIP CHECK ---
        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : session.user.id;
        const isOwner = effectiveUserId === session.user.id;
        const isGod = user.isSuperAdmin;

        if (!isOwner && !isGod) {
            logger.warn(`[Security] Unauthorized builds update attempt by ${session.user.id} on ${effectiveUserId} (God: ${isGod})`);
            return { success: false, error: "Vous n'avez pas la permission de modifier ces builds." };
        }

        // --- PREVIEW BAKING (Server-side) ---
        // Fetch metadata for any link missing it (new ones or changed ones)
        const { getDofusbookPreview } = await import("./dofusbook-actions");
        
        // Optimization: fetch existing links once
        const existingProfile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: effectiveUserId, guildId: guildConfig.id } },
            select: { dofusBookLinks: true }
        });
        const existingLinks = (existingProfile?.dofusBookLinks as any[]) || [];

        const bakedLinks = await Promise.all(links.map(async (link) => {
            // Find if we already have this URL in our DB to avoid re-fetching metadata
            const matchingOld = existingLinks.find(l => l.id === link.id);
            
            if (matchingOld && matchingOld.url === link.url && matchingOld.previewData) {
                return { ...link, previewData: matchingOld.previewData };
            }

            // Otherwise, try to fetch it
            try {
                const res = await getDofusbookPreview(link.url);
                if (res.success && res.data) {
                    return { ...link, previewData: res.data };
                }
            } catch (e) {
                console.error(`[Server Baking] Failed for ${link.url}:`, e);
            }
            return link;
        }));

        await db.userProfile.update({
            where: {
                userId_guildId: { userId: effectiveUserId, guildId: guildConfig.id }
            },
            data: { dofusBookLinks: bakedLinks as any }
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        revalidatePath(`/dashboard/${guildId}/galerie-stuff`);

        return { success: true };
    } catch (error: unknown) {
        logger.error("Update Builds Error", { error, guildId });
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
    lastActivity: { description: string; date: string | Date } | null;
    joinedAt: string | Date | null;
    isTopContributor: boolean;
    contributorTier: ContributorTier;
    rank?: number;
}>> {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

    const targetUserId = userId || user.id!;

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, discordGuildId: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: { userId: targetUserId, guildId: guildConfig.id }
            },
            select: {
                id: true,
                xp: true,
                guildatons: true,
                lastActivityAt: true,
                userId: true
            }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        // Get Start of Week (Monday)
        const now = new Date();
        const startOfWeek = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        // Fetch weekly stats and total mission count in parallel
        const [weeklySubmissions, totalMissionsCount] = await Promise.all([
            db.submission.findMany({
                where: {
                    profileId: profile.id,
                    status: "VALIDATED",
                    updatedAt: { gte: startOfWeek }
                },
                select: {
                    mission: {
                        select: { xpReward: true }
                    }
                }
            }),
            db.submission.count({
                where: {
                    profileId: profile.id,
                    status: "VALIDATED"
                }
            })
        ]);

        const weeklyMissions = weeklySubmissions.length;
        const weeklyXp = weeklySubmissions.reduce((acc, curr) => acc + (curr.mission?.xpReward || 0), 0);

        // Calculate contributor tier based on XP ranking
        let contributorTier: ContributorTier = null;
        let rank: number | undefined;

        // Ranking Cache Management
        const cacheKey = `ranking:${guildConfig.id}`;
        const cachedRanking = rankingCache.get(cacheKey);
        let guildRanking: { userId: string, xp: number }[];

        if (cachedRanking && Date.now() < cachedRanking.expiresAt) {
            guildRanking = cachedRanking.data;
        } else {
            guildRanking = await db.userProfile.findMany({
                where: {
                    guildId: guildConfig.id,
                    status: "ACTIVE"
                },
                orderBy: { xp: "desc" },
                select: { userId: true, xp: true }
            });
            rankingCache.set(cacheKey, { data: guildRanking, expiresAt: Date.now() + RANKING_CACHE_TTL });
        }

        // Find user's rank
        const userRankIndex = guildRanking.findIndex(p => p.userId === targetUserId);
        if (userRankIndex !== -1) {
            rank = userRankIndex + 1;
            if (rank === 1) contributorTier = "LEGENDE";
            else if (rank <= 3) contributorTier = "CHAMPION";
            else if (rank <= 10) contributorTier = "PILIER";
        }

        return {
            success: true,
            data: {
                xp: profile.xp,
                guildatons: profile.guildatons,
                missionsValidated: totalMissionsCount,
                weeklyXp,
                weeklyMissions,
                lastActivity: profile.lastActivityAt
                    ? { description: "Dernière activité", date: profile.lastActivityAt.toISOString() }
                    : null,
                joinedAt: null,
                isTopContributor: contributorTier !== null,
                contributorTier,
                rank
            }
        };
    } catch (error: unknown) {
        logger.error("Get Profile Stats Error", { error, guildId, targetUserId });
        return { success: false, error: "Erreur lors du calcul des statistiques." };
    }
}

// ============================================================================
// DIRECTORY ACTIONS
// ============================================================================

export async function getGuildMembers(
    guildId: string,
    filters?: { job?: string; class?: string; hasVacation?: boolean }
): Promise<ActionResponse<any[]>> {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await (db.guildConfig as any).findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, rolesMapping: true, usersMapping: true }
        });
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
            result = result.filter((p: any) => {
                const jobs = (p.metiers as string[]) || [];
                return jobs.includes(filters.job!);
            });
        }

        if (filters?.hasVacation === false) {
            const now = new Date();
            result = result.filter((p: any) => {
                if (!p.vacationStart || !p.vacationEnd) return true;
                return !(p.vacationStart <= now && p.vacationEnd >= now);
            });
        }

        // 3. Parallelize Discord correlation for Admin rights
        const { listGuildMembers, fetchGuildRoles } = await import("@/server/discord");
        const [discordMembers, allRoles] = await Promise.all([
            listGuildMembers(guildId).catch(() => [] as any[]),
            fetchGuildRoles(guildId, { excludeManaged: false }).catch(() => [] as any[])
        ]);

        // Identify roles that grant admin rights (Discord bit 0x8 or SigilOS mapping)
        const adminRoleIds = new Set<string>();
        const rolesMapping = (guildConfig?.rolesMapping as Record<string, string[]>) || {};
        const usersMapping = (guildConfig?.usersMapping as Record<string, string[]>) || {};

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
            where: { id: { in: result.map((p: any) => p.userId) } },
            include: { accounts: { where: { provider: "discord" } } }
        });
        const userDiscordIdMap = new Map(users.map((u: any) => [u.id, u.accounts[0]?.providerAccountId]));

        // Map with Discord cache data + Real-time Admin check
        const mappedResult = result.map((p: any) => {
            const discordId = userDiscordIdMap.get(p.userId as string);
            const discordMember = discordId ? discordMemberMap.get(discordId as string) : null;

            // Real-time admin check if we found the member
            const isAdmin = (discordMember
                ? (discordMember as any).roles.some((rid: string) => adminRoleIds.has(rid))
                : false) || (discordId && usersMapping[discordId]?.includes("admin:access"));

            return {
                ...p,
                createdAt: p.createdAt.toISOString(),
                updatedAt: p.updatedAt.toISOString(),
                lastActivityAt: p.lastActivityAt?.toISOString() || null,
                vacationStart: p.vacationStart?.toISOString() || null,
                vacationEnd: p.vacationEnd?.toISOString() || null,
                user: { id: p.user.id, name: p.user.name, image: p.user.image },
                displayName: p.discordNickname || p.pseudoDofus || p.user.name,
                roleColor: p.discordRoleColor || 0,
                roleName: p.discordRoleName || "Membre",
                isAdmin
            };
        });

        return { success: true, data: mappedResult };

    } catch (error: unknown) {
        logger.error("Get Members Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// DISCORD NOTIFICATIONS
// ============================================================================

// Rate Limiting needs to be outside the function scope to persist across calls (in stateful server environments)
// Note: specifically for server actions in Next.js, this map persists as long as the lambda/container is warm.
// Rate Limiter used inside function

export async function sendVacationNotification(rawData: z.infer<typeof SendVacationNotificationSchema>): Promise<ActionResponse> {
    const validation = SendVacationNotificationSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, pseudo, profileId, startDate, endDate } = validation.data;

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

    // Rate Limiting Check: 1 per minute
    const limiter = await rateLimit(`vacation_notif:${user.id}`, 1, 60 * 1000);
    if (!limiter.success) {
        return { success: false, error: `Veuillez patienter un instant avant de renvoyer une notification.` };
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

        if (!profile || profile.userId !== user.id) {
            logger.warn("Impersonation attempt blocked", { userId: user.id, profileId, guildId });
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
            footer: { text: "SigilOS • Anti-Spam (1min) • Tout abus sera sanctionné" },
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
            logger.error("Discord API Error", { status: response.status, errorData, guildId });
            if (response.status === 403) {
                return { success: false, error: "Bot n'a pas accès au salon. Vérifiez les permissions." };
            }
            return { success: false, error: "Erreur Discord API" };
        }

        return { success: true };
    } catch (error) {
        logger.error("Send Vacation Notification Error", { error, guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// OCR & LADDER SYNC
// ============================================================================

export async function syncMemberSuccessPoints(rawData: z.infer<typeof SyncSuccessPointsSchema>): Promise<ActionResponse<{ points: number, debugImage?: string, pending?: boolean, confidence?: number }>> {
    const validation = SyncSuccessPointsSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, imageData, targetUserId } = validation.data;

    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!user.isMember && !user.isSuperAdmin) return { success: false, error: "Permissions insuffisantes" };

    const effectiveUserId = (targetUserId && user.isSuperAdmin) ? targetUserId : session.user.id;

    // 1. Sanitization & Rate Limiting
    const limiter = await rateLimit(`sync_success:${user.id}`, 10, 10 * 60 * 1000);
    if (!limiter.success) {
        return { success: false, error: "Limite de tentatives atteinte. Veuillez patienter 10 minutes." };
    }

    if (imageData.length > 6000000) {
        return { success: false, error: "L'image est trop lourde (max 4Mo)." };
    }

    if (!imageData.startsWith("data:image/")) {
        return { success: false, error: "Format d'image invalide." };
    }

    try {
        const base64Data = imageData.split(',')[1];
        if (!base64Data) return { success: false, error: "Données d'image corrompues." };

        const buffer = Buffer.from(base64Data, 'base64');

        const imageHash = await hashImage(buffer);

        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const existingHash = await db.imageHash.findFirst({
            where: { hash: imageHash }
        });


        if (existingHash) {
            logger.warn("Duplicate image detected", { userId: user.id, guildId });
            return { success: false, error: "Cette image a déjà été utilisée pour une validation dans cette guilde." };
        }

        const currentProfile = await db.userProfile.findFirst({
            where: { userId: effectiveUserId, guildId: guildConfig.id }
        });
        if (!currentProfile) return { success: false, error: "Profil introuvable" };

        const existingPending = await (db as any).achievementSubmission.findFirst({
            where: { profileId: currentProfile.id, status: "PENDING" }
        });


        if (existingPending) {
            return { success: false, error: "Vous avez déjà une demande en attente." };
        }

        // --- LLM OCR ANALYSIS ---
        const ocrResult = await analyzeImage({
            imageBase64: base64Data,
            mimeType: imageData.split(';')[0].split(':')[1], // Extract from data:image/png;base64,...
            context: 'achievement'
        });



        if (!ocrResult.moderation.isAppropriate) {
            return { success: false, error: `Image rejetée : ${ocrResult.moderation.reason}` };
        }

        // Parse points from text (LLM usually gives us the number if we asked correctly in prompt)
        // However, the prompt in llm-ocr.ts currently returns broad text. 
        // Let's refine the point extraction from ocrResult.text
        const pointsMatch = ocrResult.text.match(/(\d{1,2}\s?\d{3})/); // Matches things like 21 644 or 15000
        let points = 0;
        if (pointsMatch) {
            points = parseInt(pointsMatch[0].replace(/\s/g, ''), 10);
        } else {
            // Fallback: look for any number > 100
            const numbers = ocrResult.text.match(/\d{3,5}/g);
            if (numbers) {
                points = Math.max(...numbers.map(n => parseInt(n, 10)));
            }
        }

        // If points are invalid OR OCR is skipped/failed, force manual validation
        const ocrWorked = ocrResult.success && !ocrResult.error?.includes('unreachable') && !ocrResult.rawResponse?.includes('DEV_SKIP');
        const pointsValid = points > 0 && points <= 35000;

        if (!pointsValid && ocrWorked) {
            // OCR worked but couldn't find valid points - reject
            return { success: false, error: "Impossible de détecter un score de points de succès valide." };
        }

        // If OCR didn't work OR points invalid, force manual validation path
        const forceManual = !ocrWorked || !pointsValid;

        const { autoValidate } = shouldAutoValidate(ocrResult, 'achievement');

        // If OCR is skipped/failed OR points invalid, always go manual
        if (autoValidate && !forceManual) {

            await db.$transaction([
                db.userProfile.update({
                    where: {
                        id: currentProfile.id,
                        guildId: guildConfig.id // MANDATORY Guild Isolation
                    },
                    data: {
                        successPoints: points,
                        lastLadderUpdate: new Date(),
                    }
                }),
                (db as any).imageHash.create({
                    data: {
                        guildId: guildConfig.id,
                        hash: imageHash,
                        sourceType: "ACHIEVEMENT",
                        sourceId: "AUTO_VALIDATED",
                        uploaderId: session.user.id
                    }
                })
            ]);


            revalidatePath(`/dashboard/${guildConfig.discordGuildId}/profile`);
            revalidatePath(`/dashboard/${guildConfig.discordGuildId}/ladder`);

            return {
                success: true,
                data: {
                    points,
                    confidence: ocrResult.confidence,
                    debugImage: imageData
                }
            };
        } else {
            // MANUAL VALIDATION PATH
            // Save preview image for staff (light resizing is handled by client or we can do it here)
            // For now we use the raw imageData as it's already limited to 4MB

            const uploadRelativeDir = `proofs/${guildConfig.discordGuildId}`;
            const uploadDir = join(process.cwd(), "private_uploads", uploadRelativeDir);
            await mkdir(uploadDir, { recursive: true });
            const { randomUUID: genProofUUID } = await import("crypto");
            const fileName = `${genProofUUID()}.webp`;
            const filePath = join(uploadDir, fileName);

            // Buffer already created at line 1183
            const optimizedBuffer = await sharp(buffer)
                .resize(1920, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .webp({ quality: 80 })
                .toBuffer();

            await writeFile(filePath, optimizedBuffer);
            const proofUrl = `/api/storage/${uploadRelativeDir}/${fileName}`;

            const submission = await (db as any).achievementSubmission.create({
                data: {
                    profileId: currentProfile.id,
                    guildId: guildConfig.id,
                    points,
                    proofUrl,
                    ocrScore: ocrResult.confidence,
                    ocrRawText: ocrResult.text
                }
            });

            // Store hash to prevent reusing the same image while pending
            await (db as any).imageHash.create({
                data: {
                    guildId: guildConfig.id,
                    hash: imageHash,
                    sourceType: "ACHIEVEMENT",
                    sourceId: submission.id,
                    uploaderId: session.user.id
                }
            });

            // Notify validators via Discord
            try {
                const achievementChannel = (guildConfig as any).achievementNotifyChannelId || guildConfig.missionNotifyChannelId;
                if (achievementChannel) {
                    const { sendChannelMessage } = await import("@/server/discord");
                    const userName = currentProfile.discordNickname || currentProfile.pseudoDofus || "Un membre";
                    const absoluteLink = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${guildConfig.discordGuildId}/admin/validation`;
                    const absoluteImageUrl = getDiscordPublicUrl(proofUrl);
                    
                    const mentionRole = (guildConfig as any).achievementNotifyRoleId || guildConfig.missionValidationNotifyRoleId;
                    const content = mentionRole ? (mentionRole === "everyone" ? "@everyone" : `<@&${mentionRole}>`) : "";

                    const discordMsgId = await sendChannelMessage(achievementChannel, content, {
                        embedTitle: `🏆 [Validation] ${userName} - Succès`,
                        embedDescription: `**${userName}** a posté une preuve pour confirmation manuelle de **${points} points** de succès.`,
                        embedColor: 0x0ea5e9,
                        embedUrl: absoluteLink,
                        embedImage: absoluteImageUrl,
                        embedFooter: "SigilOS \u2022 Points de Succès",
                        components: submission?.id ? [
                            {
                                type: 1,
                                components: [
                                    { type: 2, style: 3, label: "\u2705 Valider", custom_id: `validate:achievement:${submission.id}:${guildConfig.discordGuildId}` },
                                    { type: 2, style: 4, label: "\u274c Rejeter", custom_id: `validate:achievement_reject:${submission.id}:${guildConfig.discordGuildId}` },
                                ],
                            },
                        ] : undefined,
                    });

                    // Save discordMessageId for later embed deletion
                    if (discordMsgId && submission?.id) {
                        await (db as any).achievementSubmission.update({
                            where: { id: submission.id },
                            data: { discordMessageId: `${achievementChannel}:${discordMsgId}` },
                        });
                    }
                }
            } catch (discordError) {
                logger.error("[SyncSuccess] Discord Notification Error", { error: discordError });
            }


            return {
                success: true,
                data: {
                    points,
                    pending: true,
                    confidence: ocrResult.confidence,
                    debugImage: imageData
                }
            };
        }
    } catch (error: unknown) {
        logger.error("Sync Success Points Error", { error, userId: user.id, guildId });
        return {
            success: false,
            error: "Erreur lors du traitement de l'image (OLLAMA/OCR)"
        };
    }
}
