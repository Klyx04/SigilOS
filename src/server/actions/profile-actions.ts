"use server";

import { db } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getUserContext, checkGuildPermission } from "./user-actions";
import { PERMISSIONS } from "@/lib/permissions";
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
        .regex(/^[a-zA-Z\u00C0-\u017F\u00DF\u00FF\u0100-\u017F\-\s\[\]]*$/, "Le pseudo ne doit contenir que des lettres, espaces, tirets et crochets (pas de chiffres ni d'autres caractères spéciaux)")
        .optional(),
    classe: z.string().optional(),
    metiers: z.array(z.string()).optional(),
    forgemagieStatus: z.enum(["FREE", "PAID", "UNAVAILABLE"]).optional(),
    fmPriceClassic: z.number().min(0, "Prix invalide").nullable().optional(),
    fmPriceTrans: z.number().min(0, "Prix invalide").nullable().optional(),
    fmPriceExo: z.number().min(0, "Prix invalide").nullable().optional(),
    showPresence: z.boolean().optional(),
    alignment: z.string().nullable().optional(),
    alignmentOrder: z.string().nullable().optional(),
    alignmentLevel: z.number().min(0).max(100).optional(),
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
    vacationReason: z.string().max(100, "Motif trop long").nullable().optional(),
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
    reason: z.string().nullable().optional(),
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

const TogglePinnedNavItemSchema = z.object({
    guildId: z.string(),
    href: z.string(),
});

const ToggleHiddenNavItemSchema = z.object({
    guildId: z.string(),
    href: z.string(),
});

// ============================================================================
// PROFILE CRUD
// ============================================================================

/**
 * Internal helper: check if a pseudo exists on the Dofus ladder.
 * Not rate-limited — only called server-side during save operations.
 * Returns true if found, false if not found, null if service unavailable (fail-open).
 */
async function checkPseudoExistsOnLadder(pseudo: string, serverId: string): Promise<boolean | null> {
    const WORKER_URL = process.env.DOFUS_LADDER_WORKER_URL;
    const WORKER_SECRET = process.env.DOFUS_LADDER_WORKER_KEY || process.env.DOFUS_LADDER_WORKER_SECRET;

    if (!WORKER_URL) return null; // Service unavailable → fail-open (don't block)

    try {
        const headers: Record<string, string> = { "Accept": "application/json" };
        if (WORKER_SECRET) headers["X-SigilOS-Key"] = WORKER_SECRET;

        const url = `${WORKER_URL}?server_id=${encodeURIComponent(serverId)}&name=${encodeURIComponent(pseudo)}&type=general`;
        const res = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(5000),
            cache: "no-store",
        });

        if (!res.ok) return null; // Network error → fail-open
        const data = await res.json().catch(() => null);
        return !!(data?.success || data?.found);
    } catch {
        return null; // Timeout/crash → fail-open
    }
}

/**
 * Verify a Dofus pseudo using the ladder API.
 * Accessible to all members for profile setup.
 */
export async function verifyDofusPseudo(pseudo: string, guildId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const viewer = await getUserContext(guildId);
    if (!viewer.isMember) return { success: false, error: "Accès refusé" };

    if (!pseudo || pseudo.length < 2) return { success: false, error: "Pseudo trop court" };

    // Use a strict rate limit for this potentially expensive worker call
    const rateLimitKey = `rate-limit:verify-pseudo:${session.user.id}`;
    const isRateLimited = await rateLimit(rateLimitKey, 10, 60); // 10 checks per minute
    if (!isRateLimited) return { success: false, error: "Trop de tentatives. Veuillez patienter." };

    const WORKER_URL = process.env.DOFUS_LADDER_WORKER_URL;
    const WORKER_SECRET = process.env.DOFUS_LADDER_WORKER_KEY || process.env.DOFUS_LADDER_WORKER_SECRET;
    
    if (!WORKER_URL) {
        logger.error("DOFUS_LADDER_WORKER_URL is missing in environment");
        return { success: false, error: "Service de vérification indisponible." };
    }

    // Get guild's server ID
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { dofusServerId: true }
    });
    
    const serverId = guildConfig?.dofusServerId || "295"; // Default to Imagiro

    try {
        const headers: Record<string, string> = { "Accept": "application/json" };
        if (WORKER_SECRET) headers["X-SigilOS-Key"] = WORKER_SECRET;

        // We check 'general' as it's the most reliable for existence
        const url = `${WORKER_URL}?server_id=${encodeURIComponent(serverId)}&name=${encodeURIComponent(pseudo)}&type=general`;
        const res = await fetch(url, { 
            headers,
            next: { revalidate: 3600 } // Cache verification for 1h
        });
        
        const data = await res.json().catch(() => null);
        const found = data?.success || data?.found;

        if (res.status === 200 && found) {
            return { 
                success: true, 
                data: { 
                    found: true, 
                    level: data?.level || data?.data?.level, 
                    xp: data?.xp || data?.data?.xp,
                    character_name: data?.character_name || data?.data?.character_name
                } 
            };
        }

        return { success: false, error: "Pseudo introuvable sur le ladder Officiel." };
    } catch (err: any) {
        logger.error("Verify Pseudo Error", { error: err });
        return { success: false, error: "Erreur de communication avec le service de vérification." };
    }
}

export async function getUserProfile(guildId: string): Promise<ActionResponse<any>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({ 
            where: { discordGuildId: guildId },
            select: { id: true, discordGuildId: true, rolesMapping: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true }
        });
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
                skins: {
                    orderBy: { createdAt: "desc" }
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
                vacationReason: profile.vacationReason || null,
                hasSeenWelcome: profile.hasSeenWelcome,
                introduction: profile.introduction,
                showPresence: profile.showPresence,
                pinnedNavItems: profile.pinnedNavItems,
                hiddenNavItems: profile.hiddenNavItems,
                alignment: profile.alignment,
                alignmentOrder: profile.alignmentOrder,
                alignmentLevel: profile.alignmentLevel,
                altPseudos: profile.altPseudos,
                metamobPseudo: profile.metamobPseudo,
                metamobVerified: profile.metamobVerified,
                metamobLastSync: profile.metamobLastSync,
                dofusBookLinks: profile.dofusBookLinks,
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

export async function togglePinnedNavItem(rawData: z.infer<typeof TogglePinnedNavItemSchema>) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = TogglePinnedNavItemSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, href } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ 
            where: { discordGuildId: guildId },
            select: { id: true, discordGuildId: true, rolesMapping: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } },
            select: { pinnedNavItems: true }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        let pinned = profile.pinnedNavItems || [];
        if (pinned.includes(href)) {
            pinned = pinned.filter(h => h !== href);
        } else {
            pinned = [...pinned, href];
        }

        await db.userProfile.update({
            where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } },
            data: { pinnedNavItems: pinned }
        });

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateUserContextCache } = await import("./user-actions");
        await invalidateUserContextCache(session.user.id, guildConfig.id, guildId);

        revalidatePath(`/dashboard/${guildId}`, 'layout');
        return { success: true, pinned };
    } catch (error) {
        logger.error("Toggle Pinned Nav Item Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function toggleHiddenNavItem(rawData: z.infer<typeof ToggleHiddenNavItemSchema>) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = ToggleHiddenNavItemSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, href } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ 
            where: { discordGuildId: guildId },
            select: { id: true, discordGuildId: true, rolesMapping: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } },
            select: { hiddenNavItems: true }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        let hidden = profile.hiddenNavItems || [];
        if (hidden.includes(href)) {
            hidden = hidden.filter(h => h !== href);
        } else {
            hidden = [...hidden, href];
        }

        await db.userProfile.update({
            where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } },
            data: { hiddenNavItems: hidden }
        });

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateUserContextCache } = await import("./user-actions");
        await invalidateUserContextCache(session.user.id, guildConfig.id, guildId);

        revalidatePath(`/dashboard/${guildId}`, 'layout');
        return { success: true, hidden };
    } catch (error) {
        logger.error("Toggle Hidden Nav Item Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function getMemberProfile(guildId: string, profileId: string): Promise<ActionResponse<any>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({ 
            where: { discordGuildId: guildId },
            select: { id: true, discordGuildId: true, rolesMapping: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true }
        });
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
                legendaryCrafts: true,
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
                        const guildConfig = await db.guildConfig.findUnique({ 
                            where: { discordGuildId: guildId },
                            select: { id: true, discordGuildId: true, rolesMapping: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true }
                        });
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
                vacationReason: profile.vacationReason || null,
                user: { id: profile.user.id, name: profile.user.name, image: profile.user.image },
                introduction: profile.introduction,
                alignment: profile.alignment,
                alignmentOrder: profile.alignmentOrder,
                alignmentLevel: profile.alignmentLevel,
                altPseudos: profile.altPseudos,
                metamobPseudo: profile.metamobPseudo,
                metamobVerified: profile.metamobVerified,
                metamobLastSync: profile.metamobLastSync,
                dofusBookLinks: profile.dofusBookLinks,
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

/**
 * Résout un profil membre à partir d'un "slug" human-readable.
 * Priorité : pseudoDofus (insensible à la casse) → id (cuid, backward-compat).
 * Cela permet des URLs propres : /members/Darkaine au lieu de /members/cmofl232x...
 */
export async function getMemberProfileBySlug(guildId: string, slug: string): Promise<ActionResponse<any>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Security: caller must be member of the guild
        const callerProfile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: session.user.id, guildId: guildConfig.id } }
        });
        if (!callerProfile) return { success: false, error: "Accès refusé" };

        // Decode the slug (handles URL-encoded characters)
        const decoded = decodeURIComponent(slug);

        // Try pseudoDofus, then discordNickname, then user.name, then fall back to id
        const profile = await db.userProfile.findFirst({
            where: {
                guildId: guildConfig.id,
                status: "ACTIVE",
                OR: [
                    { pseudoDofus: { equals: decoded, mode: "insensitive" } },
                    { discordNickname: { equals: decoded, mode: "insensitive" } },
                    { user: { name: { equals: decoded, mode: "insensitive" } } },
                    { id: decoded },
                ]
            },
            select: { id: true }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        // Delegate to the canonical getMemberProfile with the resolved id
        return getMemberProfile(guildId, profile.id);
    } catch (error) {
        logger.error("Get Member Profile By Slug Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateUserProfile(rawData: z.infer<typeof UpdateProfileSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateProfileSchema.safeParse(rawData);
    if (!validation.success) return { success: false, error: "Données invalides" };
    const { guildId, classe, metiers, forgemagieStatus, fmPriceClassic, fmPriceTrans, fmPriceExo, showPresence, alignment, alignmentOrder, alignmentLevel, targetUserId } = validation.data;
    let { pseudoDofus } = validation.data;

    // Formater le pseudo Dofus
    if (pseudoDofus) {
        pseudoDofus = formatDofusPseudo(pseudoDofus);
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({ 
            where: { discordGuildId: guildId },
            select: { id: true, discordGuildId: true, rolesMapping: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true, dofusServerId: true }
        });
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

            // 🛡️ ANKAMA LADDER CHECK: Le pseudo doit exister sur les pages officielles Ankama
            // SuperAdmins sont exemptés (bypass pour les overrides admin)
            if (!isGod) {
                const serverId = (guildConfig as any).dofusServerId || "295";
                const existsOnLadder = await checkPseudoExistsOnLadder(pseudoDofus, serverId);
                if (existsOnLadder === false) {
                    return { success: false, error: `Le pseudo "${pseudoDofus}" est introuvable sur le ladder officiel Ankama. Vérifiez l'orthographe exacte (majuscules, tirets...).` };
                }
                // null = service indisponible → on laisse passer (fail-open)
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
                metiers: metiers ? (metiers as any) : undefined,
                forgemagieStatus,
                fmPriceClassic: fmPriceClassic !== undefined ? fmPriceClassic : undefined,
                fmPriceTrans: fmPriceTrans !== undefined ? fmPriceTrans : undefined,
                fmPriceExo: fmPriceExo !== undefined ? fmPriceExo : undefined,
                showPresence: showPresence !== undefined ? showPresence : undefined,
                alignment: alignment !== undefined ? alignment : undefined,
                alignmentOrder: alignmentOrder !== undefined ? alignmentOrder : undefined,
                alignmentLevel: alignmentLevel !== undefined ? alignmentLevel : undefined,
            },
            create: {
                userId: effectiveUserId,
                guildId: guildConfig.id,
                pseudoDofus: pseudoDofus || null,
                classe,
                metiers: metiers ? (metiers as any) : undefined,
                forgemagieStatus,
                fmPriceClassic: fmPriceClassic || null,
                fmPriceTrans: fmPriceTrans || null,
                fmPriceExo: fmPriceExo || null,
                showPresence: showPresence ?? true,
                alignment: alignment || null,
                alignmentOrder: alignmentOrder || null,
                alignmentLevel: alignmentLevel || 0,
                status: "ACTIVE"
            }
        });

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateUserContextCache } = await import("./user-actions");
        await invalidateUserContextCache(effectiveUserId, guildConfig.id, guildId);

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
        const guildConfig = await db.guildConfig.findUnique({ 
            where: { discordGuildId: guildId },
            select: { id: true, discordGuildId: true, rolesMapping: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true }
        });
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

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateUserContextCache } = await import("./user-actions");
        await invalidateUserContextCache(effectiveUserId, guildConfig.id, guildId);

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
    const { guildId, vacationStart, vacationEnd, vacationNotify, vacationReason, targetUserId } = validation.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({ 
            where: { discordGuildId: guildId },
            select: { id: true, discordGuildId: true, rolesMapping: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // --- SECURITY: RBAC / OWNERSHIP CHECK ---
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

        const canEditOthers = user.canEditVacation || user.isSuperAdmin;
        const effectiveUserId = (canEditOthers && targetUserId) ? targetUserId : session.user.id;
        const isOwner = effectiveUserId === session.user.id;

        if (!isOwner && !canEditOthers) {
            logger.warn(`[Security] Unauthorized vacation update attempt by ${session.user.id} on ${effectiveUserId} (CanEditOthers: ${canEditOthers})`);
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
                vacationReason: vacationReason ?? null,
            }
        });

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateUserContextCache } = await import("./user-actions");
        await invalidateUserContextCache(effectiveUserId, guildConfig.id, guildId);

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
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true, discordGuildId: true, rolesMapping: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true } });
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

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateUserContextCache } = await import("./user-actions");
        await invalidateUserContextCache(effectiveUserId, guildConfig.id, guildId);

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
        const guildConfig = await db.guildConfig.findUnique({ 
            where: { discordGuildId: guildId },
            select: { id: true, discordGuildId: true, rolesMapping: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true }
        });
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

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateUserContextCache } = await import("./user-actions");
        await invalidateUserContextCache(effectiveUserId, guildConfig.id, guildId);

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
        .regex(/^[A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F]*(-[a-zA-Z\u00C0-\u017F]+)*$/, "Format invalide (Ex: Pseudo, Pseudo-mule - Pas de chiffres ni caractères spéciaux)"),
    classe: z.string().optional(),
    level: z.number().min(0).max(200).optional(),
    alignment: z.string().nullable().optional(),
    alignmentOrder: z.string().nullable().optional(),
});

const UpdateAltPseudosSchema = z.object({
    guildId: z.string(),
    altPseudos: z.array(AltPseudoObjectSchema).max(10, "Maximum 10 personnages"),
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
        const guildConfig = await db.guildConfig.findUnique({ 
            where: { discordGuildId: guildId },
            select: { id: true, discordGuildId: true, rolesMapping: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true, dofusServerId: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // --- SECURITY: RBAC / OWNERSHIP CHECK ---
        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : session.user.id;
        const isOwner = effectiveUserId === session.user.id;
        const isGod = user.isSuperAdmin;

        if (!isOwner && !isGod) {
            logger.warn(`[Security] Unauthorized alt pseudos update attempt by ${session.user.id} on ${effectiveUserId} (God: ${isGod})`);
            return { success: false, error: "Vous n'avez pas la permission de modifier ces pseudos secondaires." };
        }

        const cleanedPseudos = altPseudos.slice(0, 10).map(p => ({
            ...p,
            pseudo: formatDofusPseudo(p.pseudo)
        }));

        // 🛡️ ANKAMA LADDER CHECK: Chaque mule doit exister sur le ladder officiel Ankama
        // SuperAdmins sont exemptés
        if (!isGod) {
            const serverId = (guildConfig as any).dofusServerId || "295";
            const ladderChecks = await Promise.all(
                cleanedPseudos.map(p => checkPseudoExistsOnLadder(p.pseudo, serverId))
            );
            for (let i = 0; i < cleanedPseudos.length; i++) {
                if (ladderChecks[i] === false) {
                    return { success: false, error: `La mule "${cleanedPseudos[i].pseudo}" est introuvable sur le ladder officiel Ankama. Vérifiez l'orthographe exacte.` };
                }
            }
        }

        logger.info(`[Dofusbook] Profile ${effectiveUserId} in guild ${guildConfig.id} -> Saving`, { cleanedPseudos });

        await db.userProfile.update({
            where: {
                userId_guildId: { userId: effectiveUserId, guildId: guildConfig.id }
            },
            data: { altPseudos: cleanedPseudos }
        });

        logger.info(`[Dofusbook] Successfully updated database for ${user.id}`);

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateUserContextCache } = await import("./user-actions");
        await invalidateUserContextCache(effectiveUserId, guildConfig.id, guildId);

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
        url: z.string().refine(
            (url) => {
                const dofusbookPattern = /^https:\/\/(www\.)?(d-bk\.net|dofusbook\.net)\/(fr|en|es|pt|de)\/(?:private\/)?[a-zA-Z0-9-_\/]+$/;
                const dofusroomPattern = /^https:\/\/(www\.)?dofusroom\.com\/(buildroom\/build\/show\/\d+|b-\d+)\/?$/;
                return dofusbookPattern.test(url) || dofusroomPattern.test(url);
            },
            { message: "Format invalide (DofusBook: d-bk.net/dofusbook.net ou DofusRoom: dofusroom.com)" }
        ),
        tags: z.array(z.string()).optional(),
        classId: z.number().nullable().optional(),
        source: z.enum(["dofusbook", "dofusroom"]).nullable().optional(),
        previewData: z.any().nullable().optional(),
    })).max(20, "Maximum 20 builds"),
    targetUserId: z.string().optional(),
});

export async function updateDofusBookLinks(rawData: z.infer<typeof UpdateDofusBookLinksSchema>): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const validation = UpdateDofusBookLinksSchema.safeParse(rawData);
    if (!validation.success) {
        console.error("[DofusBook Validation Error]", JSON.stringify(validation.error.format(), null, 2));
        return { success: false, error: "Données invalides" };
    }
    const { guildId, links, targetUserId } = validation.data;

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };
    if (!user.isMember) return { success: false, error: "Not a member" };

    try {
        const guildConfig = await db.guildConfig.findUnique({ 
            where: { discordGuildId: guildId },
            select: { id: true, discordGuildId: true, rolesMapping: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true }
        });
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

            // DofusRoom links: skip DofusBook baking (different proxy)
            const isDofusRoom = /dofusroom\.com/.test(link.url);
            if (isDofusRoom) {
                return { ...link, source: "dofusroom" };
            }

            // DofusBook: try to fetch and bake preview
            try {
                const res = await getDofusbookPreview(link.url, true);
                if (res.success && res.data) {
                    return { ...link, previewData: res.data, source: "dofusbook" };
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

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateUserContextCache } = await import("./user-actions");
        await invalidateUserContextCache(effectiveUserId, guildConfig.id, guildId);

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
    weeklyActivity: { week: string; submissions: number; validated: number }[];
    missionsByCategory: { category: string; count: number; validated: number }[];
    totalGuildMissions: number;
    discordStats?: {
        weekly: { messages: number; voice: number };
        monthly: { messages: number; voice: number };
        total: { messages: number; voice: number };
    };
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
                userId: true,
                discordMessageCountWeekly: true,
                discordMessageCountMonthly: true,
                discordMessageCountTotal: true,
                discordVoiceTimeWeekly: true,
                discordVoiceTimeMonthly: true,
                discordVoiceTimeTotal: true,
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
        const [weeklySubmissions, totalMissionsCount, memberSubmissions, totalGuildMissions] = await Promise.all([
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
            }),
            db.submission.findMany({
                where: { profileId: profile.id },
                include: { mission: { select: { category: true } } }
            }),
            db.mission.count({
                where: { guildId: guildConfig.id }
            })
        ]);

        const weeklyMissionsCount = weeklySubmissions.length;
        const weeklyXp = weeklySubmissions.reduce((acc, curr) => acc + (curr.mission?.xpReward || 0), 0);

        // Calculate Weekly Activity (Last 12 weeks)
        const twelveWeeksAgo = new Date();
        twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
        
        const weeks: Record<string, { submissions: number; validated: number }> = {};
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i * 7);
            const key = `S${getISOWeek(d)}`;
            weeks[key] = { submissions: 0, validated: 0 };
        }

        memberSubmissions.forEach(s => {
            if (s.createdAt >= twelveWeeksAgo) {
                const key = `S${getISOWeek(s.createdAt)}`;
                if (weeks[key]) {
                    weeks[key].submissions++;
                    if (s.status === "VALIDATED") weeks[key].validated++;
                }
            }
        });

        const weeklyActivity = Object.entries(weeks).map(([week, data]) => ({ week, ...data }));

        // Category Breakdown
        const categoryMap: Record<string, { total: number; validated: number }> = {};
        memberSubmissions.forEach(s => {
            const cat = s.mission.category;
            if (!categoryMap[cat]) categoryMap[cat] = { total: 0, validated: 0 };
            categoryMap[cat].total++;
            if (s.status === "VALIDATED") categoryMap[cat].validated++;
        });

        const missionsByCategory = Object.entries(categoryMap).map(([category, data]) => ({
            category,
            count: data.total,
            validated: data.validated,
        }));

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
                weeklyMissions: weeklyMissionsCount,
                lastActivity: profile.lastActivityAt
                    ? { description: "Dernière activité", date: profile.lastActivityAt.toISOString() }
                    : null,
                joinedAt: null,
                isTopContributor: contributorTier !== null,
                contributorTier,
                rank,
                weeklyActivity,
                missionsByCategory,
                totalGuildMissions,
                discordStats: {
                    weekly: { 
                        messages: profile.discordMessageCountWeekly, 
                        voice: profile.discordVoiceTimeWeekly 
                    },
                    monthly: { 
                        messages: profile.discordMessageCountMonthly, 
                        voice: profile.discordVoiceTimeMonthly 
                    },
                    total: { 
                        messages: profile.discordMessageCountTotal, 
                        voice: profile.discordVoiceTimeTotal 
                    },
                }
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
            include: { 
                user: true,
                legendaryCrafts: true
            },
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
                vacationReason: p.vacationReason || null,
                user: { id: p.user.id, name: p.user.name, image: p.user.image },
                displayName: p.discordNickname || p.pseudoDofus || p.user.name,
                roleColor: p.discordRoleColor || 0,
                roleName: p.discordRoleName || "Membre",
                isAdmin,
                alignment: p.alignment,
                alignmentOrder: p.alignmentOrder,
                alignmentLevel: p.alignmentLevel,
                altPseudos: p.altPseudos
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
        // Utilize the readable pseudo for the Discord link
        const profileSlug = encodeURIComponent(profile.pseudoDofus || profileId);
        const profileUrl = `${appUrl}/dashboard/${guildId}/members/${profileSlug}`;

        // Format dates
        const formatDate = (dateStr: string | null) => {
            if (!dateStr) return "Pas de date prévue";
            const date = new Date(dateStr);
            return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        };

        const embed: any = {
            title: "🏝️ Notification d'absence",
            description: `[${securedPseudo}](${profileUrl}) sera absent(e).`,
            color: 0x06b6d4, // Cyan
            fields: [
                { name: "📅 Début", value: formatDate(startDate), inline: true },
                { name: "📅 Retour", value: formatDate(endDate), inline: true },
            ],
            footer: { text: "SigilOS • Anti-Spam (1min) • Tout abus sera sanctionné" },
            timestamp: new Date().toISOString(),
        };

        if (validation.data.reason) {
            embed.fields.push({ name: "📝 Motif", value: validation.data.reason, inline: false });
        }

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

        const guildConfig = await db.guildConfig.findUnique({ 
            where: { discordGuildId: guildId },
            select: { id: true, discordGuildId: true, rolesMapping: true, missionNotifyChannelId: true, missionValidationNotifyRoleId: true }
        });
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
                    const content = mentionRole ? (mentionRole === "everyone" ? "Bonjour @everyone !" : `Bonjour <@&${mentionRole}> !`) : "Bonjour le Staff !";

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

// ============================================================================
// ACHIEVEMENT VALIDATION
// ============================================================================

export type AchievementSubmissionEntry = {
    id: string;
    guildId: string;
    profileId: string;
    points: number;
    proofUrl: string;
    ocrScore: number | null;
    ocrRawText: string | null;
    status: "PENDING" | "VALIDATED" | "REJECTED";
    createdAt: Date;
    profile: {
        id: string;
        pseudoDofus: string | null;
        discordNickname: string | null;
        discordRoleColor: number | null;
        user: { name: string | null; image: string | null };
    };
};

export async function getPendingAchievementSubmissions(guildId: string): Promise<ActionResponse<AchievementSubmissionEntry[]>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_OFFICER);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const entries = await (db as any).achievementSubmission.findMany({
            where: { guildId: guild.id, status: "PENDING" },
            include: {
                profile: {
                    select: {
                        id: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        discordRoleColor: true,
                        user: { select: { name: true, image: true } }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return { success: true, data: entries };
    } catch (error) {
        logger.error("getPendingAchievementSubmissions error", { error, guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

const reviewAchievementSchema = z.object({
    guildId: z.string().min(1),
    submissionId: z.string().min(1),
    action: z.enum(["VALIDATE", "REJECT"]),
    rejectedReason: z.string().max(200).optional().nullable(),
});

export async function reviewAchievementSubmission(input: z.infer<typeof reviewAchievementSchema>): Promise<ActionResponse> {
    const session = await auth();
    const guard = await checkGuildPermission(session, input.guildId, PERMISSIONS.MISSIONS_OFFICER);
    if (!guard.allowed) return { success: false, error: guard.error };

    const parsed = reviewAchievementSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message };

    try {
        const submission = await (db as any).achievementSubmission.findUnique({
            where: { id: input.submissionId },
            include: { profile: true }
        });

        if (!submission) return { success: false, error: "Soumission introuvable" };
        if (submission.status !== "PENDING") return { success: false, error: "Déjà traitée" };

        const newStatus = input.action === "VALIDATE" ? "VALIDATED" : "REJECTED";

        await (db as any).achievementSubmission.update({
            where: { id: submission.id },
            data: {
                status: newStatus,
                validatedAt: new Date(),
                rejectedReason: input.action === "REJECT" ? (input.rejectedReason || "Refusé par le staff") : null
            }
        });

        if (newStatus === "VALIDATED") {
            await db.userProfile.update({
                where: { id: submission.profileId },
                data: { successPoints: submission.points }
            });
        }

        // Cleanup Discord embed
        if (submission.discordMessageId?.includes(":")) {
            const [channelId, msgId] = submission.discordMessageId.split(":");
            if (channelId && msgId) {
                try {
                    const { deleteChannelMessage } = await import("@/server/discord");
                    await deleteChannelMessage(channelId, msgId);
                } catch (e) {
                    logger.error("Failed to delete achievement Discord embed", { error: e });
                }
            }
        }

        // Cleanup proof file + image hash
        if (submission.proofUrl) {
            const { deleteProofFile } = await import("@/lib/storage-utils");
            await deleteProofFile(submission.proofUrl);
            await (db as any).imageHash.deleteMany({
                where: { sourceType: "ACHIEVEMENT", sourceId: submission.id }
            });
        }

        revalidatePath(`/dashboard/${input.guildId}/admin/validation`);
        revalidatePath(`/dashboard/${input.guildId}/ladder`);
        revalidatePath(`/dashboard/${input.guildId}/profile`);

        return { success: true };
    } catch (error) {
        logger.error("reviewAchievementSubmission error", { error, guildId: input.guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Refresh user success points via official Dofus ladder proxy (Cloudflare Worker)
 * Strategies: CF Worker (Scraping) -> Database Update
 */
export async function refreshUserSuccessPoints(guildId: string): Promise<ActionResponse<{ points: number, level: number }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!user.canSyncLadder) return { success: false, error: "Ce module est désactivé sur ce serveur." };

    try {
        // 1. Get profile and server config
        const profile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId }
            },
            include: { guild: true }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };
        if (!profile.pseudoDofus) return { success: false, error: "Veuillez renseigner votre pseudo Dofus dans l'onglet Général." };

        // 2. Rate limiting (once every 30 minutes per user)
        const limiter = await rateLimit(`ladder_sync:${session.user.id}`, 1, 30 * 60 * 1000);
        if (!limiter.success) {
            return { success: false, error: "Veuillez patienter 30 minutes entre deux synchronisations ladder." };
        }

        // 3. Call CF Worker Scraper
        const workerUrl = process.env.DOFUS_LADDER_WORKER_URL;
        const workerSecret = process.env.DOFUS_LADDER_WORKER_KEY || process.env.DOFUS_LADDER_WORKER_SECRET;

        if (!workerUrl) {
            return { success: false, error: "Service de synchronisation non configuré." };
        }

        const serverId = profile.guild.dofusServerId || "295"; // Draconiros by default
        const targetUrl = `${workerUrl}?server_id=${serverId}&name=${encodeURIComponent(profile.pseudoDofus)}`;

        const response = await fetch(targetUrl, {
            headers: {
                "Accept": "application/json",
                ...(workerSecret ? { "X-SigilOS-Key": workerSecret } : {}),
            },
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            logger.error("[LadderSync] Worker error", { status: response.status, error });
            return { success: false, error: "Le ladder de Dofus est actuellement inaccessible." };
        }

        const result = await response.json();

        if (!result.success || !result.found) {
            return { success: false, error: `Personnage "${profile.pseudoDofus}" introuvable sur le ladder (${serverId}).` };
        }

        // 4. Update Database
        const updatedPoints = result.points;
        const updatedLevel = result.level;

        await db.userProfile.update({
            where: { id: profile.id },
            data: {
                successPoints: updatedPoints,
                lastLadderUpdate: new Date(),
                // Optionally update level if we have a field for it, SigilOS usually focuses on pseudo/points
            }
        });

        revalidatePath(`/dashboard/${guildId}/ladder`);
        revalidatePath(`/dashboard/${guildId}/profile`);

        return {
            success: true,
            data: {
                points: updatedPoints,
                level: updatedLevel
            }
        };

    } catch (error) {
        logger.error("[LadderSync] Server Error", { error, guildId, userId: session.user.id });
        return { success: false, error: "Erreur lors de la synchronisation (Serveur)." };
    }
}

/**
 * Fetch a preview of the external ladder data without saving to DB.
 */
export async function getLadderPreview(guildId: string): Promise<ActionResponse<{ points: number, level: number, className?: string, rank?: number, guildRank?: number }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return { success: false, error: "Non authentifié" };

    try {
        const profile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId }
            },
            include: { guild: true }
        });

        if (!profile || !profile.pseudoDofus) return { success: false, error: "Pseudo manquant." };

        const workerUrl = process.env.DOFUS_LADDER_WORKER_URL;
        const workerSecret = process.env.DOFUS_LADDER_WORKER_KEY || process.env.DOFUS_LADDER_WORKER_SECRET;

        if (!workerUrl) return { success: false, error: "Service indisponible." };

        const serverId = profile.guild.dofusServerId || "295";
        const targetUrl = `${workerUrl}?server_id=${serverId}&name=${encodeURIComponent(profile.pseudoDofus)}`;

        const response = await fetch(targetUrl, {
            headers: {
                "Accept": "application/json",
                ...(workerSecret ? { "X-SigilOS-Key": workerSecret } : {}),
            },
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) return { success: false, error: "Ankama injoignable." };

        const result = await response.json();
        if (!result.success || !result.found) return { success: false, error: "Inconnu au bataillon." };

        // 🛡️ FUZZY MAPPING HELPER
        // Some Workers return character info at the root, others nested in .data or .character
        const raw = result.character || result.data || result.results?.[0] || result;

        // Helper to find a value regardless of case or common variations
        const findValue = (obj: any, keys: string[]) => {
            const lowerKeys = keys.map(k => k.toLowerCase());
            for (const [key, value] of Object.entries(obj)) {
                if (lowerKeys.includes(key.toLowerCase())) return value;
            }
            return undefined;
        };

        // Cleaning numbers (removing spaces like "7 682" or thousand separators)
        const parseNumber = (val: any) => {
            if (typeof val === "number") return val;
            if (typeof val !== "string") return 0;
            return parseInt(val.replace(/\s/g, '').replace(/,/g, ''), 10) || 0;
        };

        // Determine Points and Level
        const points = parseNumber(findValue(raw, ["points", "success_points", "points_succès"])) || 0;
        const level = parseNumber(findValue(raw, ["level", "character_level", "niveau", "niv"])) || 0;
        
        // Determine Rank
        const rankValue = findValue(raw, ["rank", "rank_world", "world_rank", "pos", "position", "rang", "#"]);
        const rank = parseNumber(rankValue) || undefined;
        
        // Determine Class (Fallback to DB if Worker doesn't provide it)
        const workerClass = findValue(raw, ["className", "class", "character_class", "classe", "class_id"]);
        const className = workerClass ? workerClass.toString() : (profile.classe || undefined);

        // Calculate Guild Rank (comparing fresh Ankama points with last known guild points)
        const guildRank = await db.userProfile.count({
            where: {
                guildId: profile.guildId,
                status: "ACTIVE",
                successPoints: {
                    gt: points
                }
            }
        }) + 1;

        return {
            success: true,
            data: {
                points,
                level,
                className,
                rank,
                guildRank
            }
        };
    } catch {
        return { success: false, error: "Erreur réseau." };
    }
}

function getISOWeek(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
