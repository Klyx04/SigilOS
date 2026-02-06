"use server";

// =============================================================================
// QUÊTE OCRE SERVER ACTIONS
// =============================================================================
// Refactored from metamob-actions.ts to use API v2 with native matching

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { checkGuildPermission } from "@/server/actions/mission-actions";
import { rateLimit } from "@/lib/ratelimit";
import {
    getUserProfile,
    getUserQuests,
    getQuestDetails,
    getPrivateQuestDetails,
    getQuestMatches,
    getKralamoureEvents,
    getZones,
    verifyMetamobUser,
    normalizeQuestMonster,
    clearCache,
    MetamobApiError,
    type UserProfile,
    type UserQuest,
    type QuestDetails,
    type QuestMonster,
    type MatchPartner,
    type OcreMonster,
    type Zone,
    type KralamoureEvent,
} from "@/lib/metamob-client";

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

interface ActionResponse<T = void> {
    success: boolean;
    error?: string;
    data?: T;
}

// Quest progress data for dashboard
export interface OcreProgressData {
    monsters: OcreMonster[];
    stats: {
        total: number;
        manquants: number;
        possedes: number;
        doublons: number;
        progressPercent: number;
    };
    questInfo: {
        slug: string;
        characterName: string;
        currentStep: number;
        totalSteps: number;
        parallelQuests: number;
        serverName: string;
    };
    lastSync: Date | null;
}

// Guild exchange map data
export interface GuildExchangeMapData {
    /** Map of monsterId -> number of guild members who can exchange */
    availableExchanges: Record<number, number>;
    /** Total unique monsters available for exchange */
    totalMonstersAvailable: number;
}

// Exchange partner from native API
export interface ExchangePartner {
    username: string;
    characterName: string;
    parallelQuests: number;
    lastActive?: string;
    monstersTheyHave: Array<{
        id: number;
        name: string;
        available: number;
        needed: number;
        coversNeed: boolean;
    }>;
    monstersYouHave: Array<{
        id: number;
        name: string;
        available: number;
        needed: number;
        coversNeed: boolean;
    }>;
    matchScore: number;
}

// -----------------------------------------------------------------------------
// SCHEMAS
// -----------------------------------------------------------------------------

const LinkAccountSchema = z.object({
    guildId: z.string().min(1),
    pseudo: z.string()
        .min(2, "Le pseudo doit contenir au moins 2 caractères")
        .max(30, "Le pseudo ne peut pas dépasser 30 caractères")
        .regex(/^[a-zA-Z0-9_-]+$/, "Le pseudo ne peut contenir que des lettres, chiffres, tirets et underscores"),
    apiKey: z.string().optional(),
});

const UnlinkAccountSchema = z.object({
    guildId: z.string().min(1),
});

const GetProgressSchema = z.object({
    guildId: z.string().min(1),
});

const FindPartnersSchema = z.object({
    guildId: z.string().min(1),
    direction: z.enum(["they_have", "they_want", "both"]).optional(),
});

// -----------------------------------------------------------------------------
// LINK / UNLINK METAMOB ACCOUNT
// -----------------------------------------------------------------------------

/**
 * Link a Metamob account to the user's profile.
 * Validates the pseudo exists and retrieves the primary quest slug.
 */
export async function linkOcreAccount(
    rawData: z.infer<typeof LinkAccountSchema>
): Promise<ActionResponse<{
    pseudo: string;
    questSlug: string | null;
    serverName: string | null;
    characterName: string | null;
}>> {
    try {
        // Auth check
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Rate limit
        const rateCheck = await rateLimit(`ocre:link:${session.user.id}`, 5, 60);
        if (!rateCheck.success) {
            return { success: false, error: "Trop de tentatives. Réessayez dans quelques minutes." };
        }

        // Validation
        const parsed = LinkAccountSchema.safeParse(rawData);
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
        }
        const { guildId, pseudo, apiKey } = parsed.data;

        // Get user profile (multi-tenant check) - include pseudoEnJeu for ownership verification
        const profile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: {
                id: true,
                pseudoDofus: true,
            },
        });

        if (!profile) {
            return { success: false, error: "Profil introuvable" };
        }

        // Get guild's API key (fallback if user doesn't provide one)
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { metamobApiKey: true },
        });

        // Determine which key to use for verification
        const keyToUse = apiKey || guildConfig?.metamobApiKey;

        if (!keyToUse) {
            return {
                success: false,
                error: (apiKey)
                    ? "Clé API invalide."
                    : "Aucune clé API configurée (ni perso, ni guilde). Entrez votre clé API personnelle."
            };
        }

        // Verify Metamob account exists and get primary quest
        // We use the User Key if provided, allowing access to private data (owned/doublons)
        const metamobData = await verifyMetamobUser(pseudo, {
            guildApiKey: keyToUse
        });
        if (!metamobData) {
            return {
                success: false,
                error: "Compte Metamob introuvable. Vérifiez l'orthographe du pseudo."
            };
        }

        const { profile: metamobProfile, primaryQuest } = metamobData;

        // =====================================================================
        // SECURITY: Verify ownership - character name must match pseudo Dofus
        // =====================================================================
        // This prevents users from linking someone else's Metamob account
        if (primaryQuest) {
            const metamobCharName = primaryQuest.character_name.toLowerCase().trim();
            const userPseudoDofus = profile.pseudoDofus?.toLowerCase().trim();

            if (!userPseudoDofus) {
                return {
                    success: false,
                    error: "Configurez d'abord votre pseudo Dofus dans votre profil SigilOS."
                };
            }

            if (metamobCharName !== userPseudoDofus) {
                return {
                    success: false,
                    error: `Le personnage Metamob "${primaryQuest.character_name}" ne correspond pas à votre pseudo Dofus "${profile.pseudoDofus}".`
                };
            }
        }

        // Update profile with Metamob link
        // Update profile with Metamob link and API Key
        await db.userProfile.update({
            where: { id: profile.id },
            data: {
                metamobPseudo: metamobProfile.username, // Use exact casing from API
                metamobApiKey: apiKey || null,          // Store user key if provided
                metamobQuestSlug: primaryQuest?.slug || null,
                metamobServerId: primaryQuest?.server.id || null,
                metamobVerified: true,
                metamobLastSync: new Date(),
            },
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        revalidatePath(`/dashboard/${guildId}/quete-ocre`);

        return {
            success: true,
            data: {
                pseudo: metamobProfile.username,
                questSlug: primaryQuest?.slug || null,
                serverName: primaryQuest?.server.name || null,
                characterName: primaryQuest?.character_name || null,
            }
        };
    } catch (error) {
        console.error("[linkOcreAccount] Error:", error);

        if (error instanceof MetamobApiError) {
            switch (error.code) {
                case "RATE_LIMIT":
                    return { success: false, error: "Limite Metamob atteinte. Réessayez plus tard." };
                case "API_KEY_MISSING":
                    return { success: false, error: "Module Quête Ocre non configuré. Contactez un administrateur." };
                case "API_KEY_INVALID":
                    return { success: false, error: "Clé API Metamob expirée. Contactez un administrateur." };
                case "NOT_FOUND":
                    return { success: false, error: "Compte Metamob introuvable ou profil privé." };
            }
        }

        return { success: false, error: "Erreur lors de la liaison du compte" };
    }
}

/**
 * Unlink Metamob account from user's profile.
 */
export async function unlinkOcreAccount(
    rawData: z.infer<typeof UnlinkAccountSchema>
): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        const parsed = UnlinkAccountSchema.safeParse(rawData);
        if (!parsed.success) {
            return { success: false, error: "Données invalides" };
        }
        const { guildId } = parsed.data;

        const profile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
        });

        if (!profile) {
            return { success: false, error: "Profil introuvable" };
        }

        // Clear cache for this user
        if (profile.metamobPseudo) {
            clearCache(profile.metamobPseudo.toLowerCase());
        }

        // Remove Metamob link
        await db.userProfile.update({
            where: { id: profile.id },
            data: {
                metamobPseudo: null,
                metamobQuestSlug: null,
                metamobServerId: null,
                metamobVerified: false,
                metamobLastSync: null,
            },
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        revalidatePath(`/dashboard/${guildId}/quete-ocre`);

        return { success: true };
    } catch (error) {
        console.error("[unlinkOcreAccount] Error:", error);
        return { success: false, error: "Erreur lors de la suppression du lien" };
    }
}

// -----------------------------------------------------------------------------
// GET QUEST PROGRESS
// -----------------------------------------------------------------------------

/**
 * Get the current user's Quête Ocre progress.
 */
export async function getMyOcreProgress(
    guildId: string
): Promise<ActionResponse<OcreProgressData>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Rate limit
        const rateCheck = await rateLimit(`ocre:progress:${session.user.id}`, 30, 60);
        if (!rateCheck.success) {
            return { success: false, error: "Trop de requêtes. Réessayez plus tard." };
        }

        // Permission check
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) {
            return { success: false, error: "Accès au module Quête Ocre non autorisé" };
        }

        const profile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: {
                id: true,
                metamobPseudo: true,
                metamobApiKey: true, // Fetch user key
                metamobQuestSlug: true,
                metamobServerId: true,
                metamobVerified: true,
                metamobLastSync: true,
                guild: { select: { metamobApiKey: true } },
            },
        });

        if (!profile) {
            return { success: false, error: "Profil introuvable" };
        }

        if (!profile.metamobPseudo || !profile.metamobVerified) {
            return {
                success: false,
                error: "Aucun compte Metamob lié. Liez votre compte dans votre profil."
            };
        }

        // Get API key: Prefer User Key > Guild Key
        const apiKey = profile.metamobApiKey || profile.guild?.metamobApiKey;

        // If no API key at all (should not happen if linked, but safety check)
        // Actually it CAN happen if linked via pseudo only (legacy) and guild has no key.
        // But the user wants to see progress. Public view works without key? 
        // No, fetchApi requires key because we enforce it. 
        // We will pass undefined if no key, but fetchApi throws.
        // Let's assume one must exist or use a safe fallback if we want to support no-key public view?
        // Current implementation throws if no key.
        const effectiveApiKey = apiKey || undefined;

        // If no quest slug, try to fetch one
        let questSlug = profile.metamobQuestSlug;
        if (!questSlug) {
            const quests = await getUserQuests(profile.metamobPseudo, { guildApiKey: effectiveApiKey });
            console.log(`[getMyOcreProgress] Quests found for ${profile.metamobPseudo}:`, quests.map(q => `${q.slug} (Step ${q.current_step})`));

            if (quests.length === 0) {
                return {
                    success: false,
                    error: "Aucune quête publique trouvée sur votre compte Metamob."
                };
            }
            questSlug = quests[0].slug;

            // Update profile with quest slug
            await db.userProfile.update({
                where: { id: profile.id },
                data: {
                    metamobQuestSlug: questSlug,
                    metamobServerId: quests[0].server.id,
                },
            });
        }

        // DEBUG: API Key Trace
        console.log(`[getMyOcreProgress] User: ${profile.metamobPseudo}`);
        const userHasKey = !!profile.metamobApiKey;
        console.log(`[getMyOcreProgress] Has User Key: ${userHasKey}`);
        console.log(`[getMyOcreProgress] Has Guild Key: ${!!profile.guild?.metamobApiKey}`);

        const keyForLog = effectiveApiKey as string | undefined;
        console.log(`[getMyOcreProgress] Using Key: ${keyForLog ? (keyForLog.substring(0, 5) + "...") : "NONE"}`);

        // Fetch quest details with all monsters (paginated)
        // Use effectiveApiKey to allow accessing private data (owned/doublons)
        let questDetails: QuestDetails;

        const safePseudo = profile.metamobPseudo || "";
        const safeSlug = questSlug || "";

        if (profile.metamobApiKey && profile.metamobPseudo && profile.metamobQuestSlug) {
            // If we have the User Key, use the PRIVATE endpoint to get "owned"/"status"
            console.log("[getMyOcreProgress] Using PRIVATE endpoint");
            questDetails = await getPrivateQuestDetails(
                profile.metamobPseudo,
                profile.metamobQuestSlug,
                { guildApiKey: effectiveApiKey, limit: 200, status: "all" }
            );
        } else {
            // Fallback to public endpoint (data might be incomplete/different)
            console.log("[getMyOcreProgress] Using PUBLIC endpoint");
            questDetails = await getQuestDetails(
                safePseudo,
                safeSlug,
                { guildApiKey: effectiveApiKey, limit: 200, status: "all" }
            );
        }

        // Remove debug files if they exist
        try {
            const fs = require('fs');
            if (fs.existsSync('a:/SigilOS/debug-api-raw.json')) fs.unlinkSync('a:/SigilOS/debug-api-raw.json');
        } catch (e) { }

        // Fetch all monsters if paginated
        let allMonsters: QuestMonster[] = [...questDetails.monsters];
        let offset = 200;
        while (allMonsters.length < questDetails.pagination.total) {
            const moreMonsters = await getQuestDetails(
                profile.metamobPseudo,
                questSlug,
                { guildApiKey: effectiveApiKey, limit: 200, offset, status: "all" }
            );
            allMonsters = [...allMonsters, ...moreMonsters.monsters];
            offset += 200;
        }

        // Normalize monsters for display
        const monsters = allMonsters.map(m =>
            normalizeQuestMonster(m, questDetails.parallel_quests)
        );

        // Calculate stats
        const stats = {
            total: monsters.length,
            manquants: monsters.filter(m => m.state === "MANQUANT").length,
            possedes: monsters.filter(m => m.state !== "MANQUANT").length, // Includes Doublons
            doublons: monsters.filter(m => m.state === "DOUBLON").length,
            progressPercent: Math.round(
                (monsters.filter(m => m.state !== "MANQUANT").length / monsters.length) * 100
            ),
        };

        // Update last sync time (non-blocking)
        db.userProfile.update({
            where: { id: profile.id },
            data: { metamobLastSync: new Date() },
        }).catch(() => { /* ignore */ });

        return {
            success: true,
            data: {
                monsters,
                stats,
                questInfo: {
                    slug: questDetails.slug,
                    characterName: questDetails.character_name,
                    currentStep: questDetails.current_step,
                    totalSteps: questDetails.quest_template.step_count,
                    parallelQuests: questDetails.parallel_quests,
                    serverName: questDetails.server.name,
                },
                lastSync: profile.metamobLastSync,
            },
        };
    } catch (error) {
        console.error("[getMyOcreProgress] Error:", error);

        if (error instanceof MetamobApiError) {
            switch (error.code) {
                case "RATE_LIMIT":
                    return { success: false, error: "Limite Metamob atteinte. Réessayez plus tard." };
                case "API_KEY_MISSING":
                    return { success: false, error: "Module non configuré. Contactez un administrateur." };
                case "API_KEY_INVALID":
                    return { success: false, error: "Clé API expirée. Contactez un administrateur." };
                case "NOT_FOUND":
                    return { success: false, error: "Quête Metamob introuvable. Re-liez votre compte." };
            }
        }

        return { success: false, error: "Erreur lors de la récupération des données" };
    }
}

// -----------------------------------------------------------------------------
// NATIVE EXCHANGE MATCHING (GAME CHANGER!)
// -----------------------------------------------------------------------------

/**
 * Find exchange partners WITHIN THE GUILD ONLY.
 * Searches guild members who have linked Metamob accounts and have doublons.
 */
export async function findOcreExchangePartners(
    rawData: z.infer<typeof FindPartnersSchema>
): Promise<ActionResponse<ExchangePartner[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        const parsed = FindPartnersSchema.safeParse(rawData);
        if (!parsed.success) {
            return { success: false, error: "Données invalides" };
        }
        const { guildId } = parsed.data;

        // Rate limit
        const rateCheck = await rateLimit(`ocre:match:${session.user.id}`, 20, 60);
        if (!rateCheck.success) {
            return { success: false, error: "Trop de requêtes. Réessayez plus tard." };
        }

        // Permission check
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) {
            return { success: false, error: "Accès non autorisé" };
        }

        // Get current user's quest to know what they need
        const currentUserProfile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: {
                metamobPseudo: true,
                metamobQuestSlug: true,
                metamobVerified: true,
                guild: { select: { metamobApiKey: true } },
            },
        });

        if (!currentUserProfile?.metamobQuestSlug || !currentUserProfile.metamobVerified) {
            return { success: false, error: "Aucune quête Metamob liée" };
        }

        const guildApiKey = currentUserProfile.guild?.metamobApiKey || undefined;

        // Get current user's wanted monsters
        const currentUserQuest = await getQuestDetails(
            currentUserProfile.metamobPseudo!,
            currentUserProfile.metamobQuestSlug,
            { guildApiKey, status: "wanted", limit: 200 }
        );

        const wantedMonsterIds = new Set(
            currentUserQuest.monsters.map(m => m.id)
        );

        // Get all OTHER guild members with linked Metamob
        const guildMembers = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
                metamobVerified: true,
                metamobPseudo: { not: null },
                metamobQuestSlug: { not: null },
                userId: { not: session.user.id }, // Exclude self
            },
            select: {
                metamobPseudo: true,
                metamobQuestSlug: true,
                user: { select: { name: true } },
            },
        });

        if (guildMembers.length === 0) {
            return { success: true, data: [] };
        }

        // Fetch each guild member's offered monsters (doublons)
        const partners: ExchangePartner[] = [];

        for (const member of guildMembers) {
            if (!member.metamobPseudo || !member.metamobQuestSlug) continue;

            try {
                const memberQuest = await getQuestDetails(
                    member.metamobPseudo,
                    member.metamobQuestSlug,
                    { guildApiKey, status: "offered", limit: 200 }
                );

                // Find monsters this member has that we want
                const monstersTheyHave = memberQuest.monsters
                    .filter(m => (m.status ?? 0) > 0 && wantedMonsterIds.has(m.id))
                    .map(m => ({
                        id: m.id,
                        name: m.name.fr,
                        available: m.owned ?? 0,
                        needed: 1,
                        coversNeed: true,
                    }));

                if (monstersTheyHave.length > 0) {
                    partners.push({
                        username: member.metamobPseudo,
                        characterName: memberQuest.character_name || member.metamobPseudo,
                        parallelQuests: memberQuest.parallel_quests || 1,
                        lastActive: undefined,
                        monstersTheyHave,
                        monstersYouHave: [], // Could be extended later
                        matchScore: monstersTheyHave.length,
                    });
                }
            } catch {
                // Skip members with API errors
            }
        }

        // Sort by match score (most monsters first)
        partners.sort((a, b) => b.matchScore - a.matchScore);

        return { success: true, data: partners };
    } catch (error) {
        console.error("[findOcreExchangePartners] Error:", error);

        if (error instanceof MetamobApiError) {
            if (error.code === "RATE_LIMIT") {
                return { success: false, error: "Limite Metamob atteinte. Réessayez plus tard." };
            }
        }

        return { success: false, error: "Erreur lors de la recherche" };
    }
}

// -----------------------------------------------------------------------------
// GUILD EXCHANGE MAP (Optimized)
// -----------------------------------------------------------------------------

/**
 * Get aggregated exchange availability for the guild.
 * This builds a map of which monsters guild members can exchange.
 */
export async function getGuildExchangeMap(
    guildId: string
): Promise<ActionResponse<GuildExchangeMapData>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Permission check
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) {
            return { success: true, data: { availableExchanges: {}, totalMonstersAvailable: 0 } };
        }

        // Get all guild members with linked Metamob (except current user)
        const members = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
                metamobVerified: true,
                metamobPseudo: { not: null },
                metamobQuestSlug: { not: null },
                userId: { not: session.user.id },
            },
            select: {
                metamobPseudo: true,
                metamobQuestSlug: true,
            },
        });

        // Build map by fetching each member's doublons
        // TODO: Cache this with Redis for better performance
        const availableExchanges: Record<number, number> = {};
        const guildConfig = await db.guildConfig.findFirst({
            where: { discordGuildId: guildId },
            select: { metamobApiKey: true },
        });
        const guildApiKey = guildConfig?.metamobApiKey || undefined;

        // Parallel fetch with limit (avoid rate limiting)
        const batchSize = 5;
        for (let i = 0; i < members.length; i += batchSize) {
            const batch = members.slice(i, i + batchSize);
            await Promise.all(batch.map(async (member) => {
                if (!member.metamobPseudo || !member.metamobQuestSlug) return;

                try {
                    const details = await getQuestDetails(
                        member.metamobPseudo,
                        member.metamobQuestSlug,
                        { guildApiKey, status: "offered", limit: 200 }
                    );

                    for (const monster of details.monsters) {
                        if ((monster.status ?? 0) > 0) { // Has extras to offer
                            availableExchanges[monster.id] = (availableExchanges[monster.id] || 0) + 1;
                        }
                    }
                } catch {
                    // Skip members with API errors
                }
            }));
        }

        return {
            success: true,
            data: {
                availableExchanges,
                totalMonstersAvailable: Object.keys(availableExchanges).length,
            },
        };
    } catch (error) {
        console.error("[getGuildExchangeMap] Error:", error);
        return { success: false, error: "Erreur lors du chargement" };
    }
}

// -----------------------------------------------------------------------------
// KRALAMOURE EVENTS
// -----------------------------------------------------------------------------

/**
 * Get upcoming Kralamoure events for the guild's server.
 */
export async function getGuildKralamoureEvents(
    guildId: string
): Promise<ActionResponse<KralamoureEvent[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Get guild's server ID from any linked member
        const guildConfig = await db.guildConfig.findFirst({
            where: { discordGuildId: guildId },
            select: { metamobApiKey: true },
        });

        const memberWithServer = await db.userProfile.findFirst({
            where: {
                guild: { discordGuildId: guildId },
                metamobServerId: { not: null },
            },
            select: { metamobServerId: true },
        });

        const guildApiKey = guildConfig?.metamobApiKey || undefined;

        const events = await getKralamoureEvents({
            guildApiKey,
            serverId: memberWithServer?.metamobServerId || undefined,
        });

        return { success: true, data: events };
    } catch (error) {
        console.error("[getGuildKralamoureEvents] Error:", error);

        if (error instanceof MetamobApiError) {
            if (error.code === "RATE_LIMIT") {
                return { success: false, error: "Limite atteinte" };
            }
        }

        return { success: true, data: [] }; // Silent fail for widget
    }
}

// -----------------------------------------------------------------------------
// ZONES
// -----------------------------------------------------------------------------

/**
 * Get all zones for filtering.
 */
export async function getOcreZones(
    guildId: string
): Promise<ActionResponse<Zone[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        const guildConfig = await db.guildConfig.findFirst({
            where: { discordGuildId: guildId },
            select: { metamobApiKey: true },
        });

        const guildApiKey = guildConfig?.metamobApiKey || undefined;
        const zones = await getZones({ guildApiKey });

        return { success: true, data: zones };
    } catch (error) {
        console.error("[getOcreZones] Error:", error);
        return { success: true, data: [] }; // Silent fail
    }
}

// -----------------------------------------------------------------------------
// REFRESH CACHE
// -----------------------------------------------------------------------------

/**
 * Force refresh the cache for the current user's Metamob data.
 * Also AUTO-DETECTS if the user has changed their quest on Metamob!
 */
export async function refreshOcreCache(
    guildId: string
): Promise<ActionResponse<{ questUpdated?: boolean }>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
        }

        // Rate limit refresh
        const rateCheck = await rateLimit(`ocre:refresh:${session.user.id}`, 3, 60);
        if (!rateCheck.success) {
            return { success: false, error: "Trop de rafraîchissements. Patientez une minute." };
        }

        const profile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: {
                id: true,
                metamobPseudo: true,
                metamobApiKey: true, // Fetch user key
                metamobQuestSlug: true,
                guild: { select: { metamobApiKey: true } },
            },
        });

        if (!profile?.metamobPseudo) {
            return { success: false, error: "Aucun compte Metamob lié" };
        }

        // Prefer User Key over Guild Key
        const guildApiKey = profile.metamobApiKey || profile.guild?.metamobApiKey || undefined;

        // Clear cache for this user first
        clearCache(profile.metamobPseudo.toLowerCase());

        let questUpdated = false;
        let newQuestSlug = profile.metamobQuestSlug;

        // Auto-detect if quest has changed on Metamob
        try {
            // Fetch user's current quests from Metamob
            const userQuests = await getUserQuests(profile.metamobPseudo, { guildApiKey });

            if (userQuests.length > 0) {
                // Get the most recent active quest (first one with most progress)
                const activeQuest = userQuests[0];

                // Check if it's different from what we have stored
                if (activeQuest.slug !== profile.metamobQuestSlug) {
                    newQuestSlug = activeQuest.slug;
                    questUpdated = true;

                    // Update the database with new quest slug
                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: {
                            metamobQuestSlug: activeQuest.slug,
                            metamobLastSync: new Date(),
                        },
                    });
                }
            }
        } catch (apiError) {
            // Log but don't fail - the refresh should still work
            console.error("[refreshOcreCache] Error detecting quest change:", apiError);
        }

        // Update sync timestamp if not already updated
        if (!questUpdated) {
            await db.userProfile.updateMany({
                where: {
                    userId: session.user.id,
                    guild: { discordGuildId: guildId },
                },
                data: { metamobLastSync: new Date() },
            });
        }

        revalidatePath(`/dashboard/${guildId}/quete-ocre`);

        return {
            success: true,
            data: { questUpdated },
        };
    } catch (error) {
        console.error("[refreshOcreCache] Error:", error);
        return { success: false, error: "Erreur lors du rafraîchissement" };
    }
}

// -----------------------------------------------------------------------------
// RE-EXPORTS for backward compatibility during migration
// -----------------------------------------------------------------------------

// These can be removed after full migration
export {
    type OcreMonster as MetamobMonster,
    type ExchangePartner as MonsterOwner
};
