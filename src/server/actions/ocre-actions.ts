"use server";

// =============================================================================
// QUÊTE OCRE SERVER ACTIONS
// =============================================================================
// Refactored from metamob-actions.ts to use API v2 with native matching

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { checkGuildPermission, getUserContext } from "@/server/actions/user-actions";
import { rateLimit } from "@/lib/ratelimit";
import { withCache } from "@/lib/cache";
import {
    getUserProfile,
    getUserQuests,
    getQuestDetails,
    getQuestTemplates,
    getQuestTemplateMonsters,
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
import { decrypt } from "@/lib/encryption";

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
        monsters: { total: number; gathered: number };
        bosses: { total: number; gathered: number };
        archis: { total: number; gathered: number };
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

export interface MatchMonster {
    id: number;
    name: string;
    imageUrl?: string;
    available: number;
    needed: number;
    coversNeed: boolean;
}

// Exchange partner from native API
export interface ExchangePartner {
    username: string;
    characterName: string;
    discordId: string;
    discordAvatar?: string;
    profileId: string;
    parallelQuests: number;
    lastActive?: string;
    monstersTheyHave: MatchMonster[];
    monstersYouHave: MatchMonster[];
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
    force: z.boolean().optional(),
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

const GetProfileMatchingSchema = z.object({
    guildId: z.string().min(1),
    targetProfileId: z.string().min(1),
});

const FindMonsterOwnersSchema = z.object({
    guildId: z.string().min(1),
    monsterId: z.number().int().positive(),
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
        const { guildId } = parsed.data;
        const pseudo = parsed.data.pseudo.trim();
        const apiKey = parsed.data.apiKey?.trim();
        const force = parsed.data.force;

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
        const keyToUse = apiKey || decrypt(guildConfig?.metamobApiKey);

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
        let metamobData;
        try {
            metamobData = await verifyMetamobUser(pseudo, {
                guildApiKey: keyToUse
            });
        } catch (error: any) {
            if (error instanceof MetamobApiError) {
                if (error.code === "UNAUTHORIZED") {
                    return {
                        success: false,
                        error: apiKey
                            ? "Clé API invalide ou compte privé. Vérifiez votre clé sur Metamob.fr."
                            : "Ce compte Metamob est privé. Entrez votre clé API personnelle ou passez votre profil en PUBLIC."
                    };
                }
                if (error.code === "NOT_FOUND") {
                    return { success: false, error: "Compte Metamob introuvable. Vérifiez l'orthographe du pseudo." };
                }
            }
            throw error;
        }

        if (!metamobData) {
            return {
                success: false,
                error: "Impossible de récupérer les informations du compte Metamob."
            };
        }

        const {
            pseudo: metamobPseudo,
            questSlug: metamobQuestSlug,
            characterName: metamobCharName,
            serverId: metamobServerId,
            serveur: metamobServerName
        } = metamobData;

        // =====================================================================
        // SECURITY: Verify ownership - character name must match pseudo Dofus
        // =====================================================================

        // 1. Check if API Key is already used by another user (Globally)
        // [Fix] Allow same key if it's the same user (NextJS session ID check is already there)
        // [Fix] We don't block if the key matches the Guild Key, as it's often the same for the Admin.
        if (apiKey) {
            const existingKeyUser = await db.userProfile.findFirst({
                where: {
                    metamobApiKey: apiKey,
                    userId: { not: session.user.id }
                },
                include: { user: true }
            });

            if (existingKeyUser) {
                // TODO: Allow force here too? For now, keep it strict as keys are sensitive.
                return {
                    success: false,
                    error: `Cette clé API est déjà utilisée par ${existingKeyUser.user.name || "un autre membre"} dans une autre guilde.`
                };
            }
        }

        // 2. Check if Metamob Pseudo is already linked in this guild by another user
        const existingPseudoUser = await db.userProfile.findFirst({
            where: {
                guild: { discordGuildId: guildId },
                metamobPseudo: { equals: metamobPseudo, mode: "insensitive" }, // Case insensitive check
                userId: { not: session.user.id },
                status: "ACTIVE"
            },
            include: { user: true }
        });

        if (existingPseudoUser) {
            let canOverwrite = false;

            if (force) {
                // Check if user is Admin
                const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ADMIN_ACCESS);
                if (guard.allowed) {
                    canOverwrite = true;
                    // Detach the previous owner
                    await db.userProfile.update({
                        where: { id: existingPseudoUser.id },
                        data: {
                            metamobPseudo: null,
                            metamobQuestSlug: null,
                            metamobServerId: null,
                            metamobVerified: false,
                            metamobLastSync: null,
                            metamobApiKey: null, // Also remove key if it was linked
                        }
                    });
                    // Clear cache for the old user
                    clearCache(metamobPseudo.toLowerCase());
                }
            }

            if (!canOverwrite) {
                return {
                    success: false,
                    error: `Le compte Metamob "${metamobPseudo}" est déjà lié à ${existingPseudoUser.user.name || "un autre membre"} dans cette guilde.`
                };
            }
        }

        // 3. Verify character name matches pseudo Dofus

        if (metamobCharName) {
            const normalizedMetamobChar = metamobCharName.toLowerCase().trim();
            const userPseudoDofus = profile.pseudoDofus?.toLowerCase().trim();

            if (!userPseudoDofus) {
                return {
                    success: false,
                    error: "Configurez d'abord votre pseudo Dofus dans votre profil SigilOS."
                };
            }

            if (normalizedMetamobChar !== userPseudoDofus) {
                return {
                    success: false,
                    error: `Le personnage Metamob "${metamobCharName}" ne correspond pas à votre pseudo Dofus "${profile.pseudoDofus}".`
                };
            }
        }

        // Update profile with Metamob link
        // Update profile with Metamob link and API Key
        await db.userProfile.update({
            where: { id: profile.id },
            data: {
                metamobPseudo: metamobPseudo, // Use exact casing from API
                metamobApiKey: apiKey || null,          // Store user key if provided
                metamobQuestSlug: metamobQuestSlug || null,
                metamobServerId: metamobServerId || null,
                metamobVerified: true,
                metamobLastSync: new Date(),
            },
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        revalidatePath(`/dashboard/${guildId}/quete-ocre`);

        return {
            success: true,
            data: {
                pseudo: metamobPseudo,
                questSlug: metamobQuestSlug || null,
                serverName: metamobServerName || null,
                characterName: metamobCharName || null,
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

export async function getMyOcreProgress(
    guildId: string
): Promise<ActionResponse<OcreProgressData>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    const userId = session.user.id;

    try {
        // [RateLimit] Prevent API spam
        const rateCheck = await rateLimit(`ocre:progress:${userId}`, 30, 60);
        if (!rateCheck.success) return { success: false, error: "Trop de requêtes. Réessayez plus tard." };

        // Permission check
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) return { success: false, error: "Accès non autorisé" };

        const cacheKey = `ocre:progress:${guildId}:${userId}`;
        return await withCache(cacheKey, 120, async () => {
            const profile = await db.userProfile.findFirst({
                where: {
                    userId: userId,
                    guild: { discordGuildId: guildId },
                    status: "ACTIVE",
                },
                select: {
                    id: true,
                    metamobPseudo: true,
                    metamobApiKey: true,
                    metamobQuestSlug: true,
                    metamobServerId: true,
                    metamobVerified: true,
                    metamobLastSync: true,
                    guild: { select: { metamobApiKey: true } },
                },
            });

            if (!profile?.metamobPseudo || !profile.metamobVerified) {
                return { success: false, error: "Profil Metamob non lié." };
            }

            const safePseudo = profile.metamobPseudo;
            let questSlug = profile.metamobQuestSlug;
            const effectiveApiKey = decrypt(profile.metamobApiKey) || decrypt(profile.guild?.metamobApiKey);

            // Auto-discover quest if missing
            if (!questSlug) {
                const quests = await getUserQuests(safePseudo, { guildApiKey: effectiveApiKey });
                if (quests.length === 0) return { success: false, error: "Quête introuvable." };
                questSlug = quests[0].slug;
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: { metamobQuestSlug: questSlug, metamobServerId: quests[0].server.id }
                });
            }

            let userQuestData: QuestMonster[] = [];
            let firstPage: QuestDetails | null = null;

            try {
                firstPage = await getQuestDetails(safePseudo, questSlug, { guildApiKey: effectiveApiKey, limit: 1000, skipCache: true });
                userQuestData = [...firstPage.monsters];

                let uOffset = firstPage.monsters.length;
                while (userQuestData.length < firstPage.pagination.total) {
                    const more = await getQuestDetails(safePseudo, questSlug, { guildApiKey: effectiveApiKey, limit: 1000, offset: uOffset, skipCache: true });
                    if (more.monsters.length === 0) break;
                    userQuestData = [...userQuestData, ...more.monsters];
                    uOffset += more.monsters.length;
                }
            } catch (apiError: any) {
                if (apiError instanceof MetamobApiError && (apiError.code === "NOT_FOUND" || apiError.message.includes("404"))) {
                    await db.userProfile.update({ where: { id: profile.id }, data: { metamobQuestSlug: null } });
                    return { success: false, error: "NO_QUEST" };
                }
                throw apiError;
            }

            const templateId = firstPage.quest_template.id;
            let skeletonMonsters: QuestMonster[] = [];
            try {
                skeletonMonsters = await getQuestTemplateMonsters(templateId, { guildApiKey: effectiveApiKey });
            } catch (skelError) { }

            const finalMonsters: OcreMonster[] = [];
            const masterList = skeletonMonsters.length > 0 ? skeletonMonsters : userQuestData;
            const userMap = new Map<number, QuestMonster>();
            const skeletonIdMap = new Set(masterList.map(m => m.id));
            const skeletonNameMap = new Map<string, QuestMonster>();
            masterList.forEach(m => { if (m.name?.fr) skeletonNameMap.set(m.name.fr.toLowerCase().trim(), m); });

            userQuestData.forEach(m => {
                let targetId = m.monster_id ?? (m as any).monster?.id ?? m.id;
                if (skeletonMonsters.length > 0 && !skeletonIdMap.has(targetId)) {
                    const match = m.name?.fr ? skeletonNameMap.get(m.name.fr.toLowerCase().trim()) : undefined;
                    if (match) targetId = match.id;
                }
                userMap.set(targetId, m);
            });

            let countTotal = 0, countManquants = 0, countPossedes = 0, countDoublons = 0;
            const statsByType = { monstre: { total: 0, gathered: 0 }, boss: { total: 0, gathered: 0 }, archimonstre: { total: 0, gathered: 0 } };
            const PQ = firstPage.parallel_quests ?? 1;

            for (const templateMonster of masterList) {
                const userMonster = userMap.get(templateMonster.id);
                const normalized = normalizeQuestMonster(userMonster || templateMonster, PQ);
                if (!userMonster) { normalized.owned = PQ; normalized.state = "POSSEDE"; }
                finalMonsters.push(normalized);
                countTotal++;
                const isPossessed = normalized.state !== "MANQUANT";
                const isGathered = isPossessed || (normalized.step && firstPage?.current_step && normalized.step < firstPage.current_step);
                if (normalized.state === "MANQUANT") countManquants++;
                else { countPossedes++; if (normalized.state === "DOUBLON") countDoublons++; }
                const typeKey = normalized.type as keyof typeof statsByType;
                if (statsByType[typeKey]) { statsByType[typeKey].total++; if (isGathered) statsByType[typeKey].gathered++; }
            }

            const totalGathered = finalMonsters.filter(m => (m.state !== "MANQUANT") || (m.step && firstPage?.current_step && m.step < firstPage.current_step)).length;
            const progressPercent = countTotal > 0 ? Math.round((totalGathered / countTotal) * 100) : 0;

            await db.userProfile.update({ where: { id: profile.id }, data: { metamobLastSync: new Date() } });

            return {
                success: true,
                data: {
                    monsters: finalMonsters,
                    stats: { total: countTotal, manquants: countManquants, possedes: countPossedes, doublons: countDoublons, progressPercent, monsters: statsByType.monstre, bosses: statsByType.boss, archis: statsByType.archimonstre },
                    questInfo: { slug: questSlug!, characterName: firstPage.character_name || safePseudo, currentStep: firstPage.current_step || 0, totalSteps: 34, parallelQuests: PQ, serverName: firstPage.server?.name || "Serveur inconnu" },
                    lastSync: new Date()
                }
            };
        });
    } catch (error) {
        console.error("[getMyOcreProgress] Critical Error:", error);
        return { success: false, error: "Erreur technique lors de la synchronisation." };
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
                metamobApiKey: true, // Fetch user's key
                guild: { select: { metamobApiKey: true } },
            },
        });

        if (!currentUserProfile?.metamobQuestSlug || !currentUserProfile.metamobVerified) {
            return { success: false, error: "Aucune quête Metamob liée" };
        }

        const guildConfig = currentUserProfile.guild;
        const effectiveApiKey = decrypt(currentUserProfile.metamobApiKey) || decrypt(guildConfig?.metamobApiKey) || undefined;

        // Get current user's quests to locally calculate precise needs
        // We fetch ALL status to determine need = (owned < pq)
        const currentUserQuest = await getQuestDetails(
            currentUserProfile.metamobPseudo!,
            currentUserProfile.metamobQuestSlug,
            { guildApiKey: effectiveApiKey, status: "all", limit: 200 }
        );

        // Calculate needed IDs locally
        const currentUserPQ = currentUserQuest.parallel_quests || 1;
        const neededMonsterIds = new Set<number>();

        // Helper to process user's monsters and fill needed set
        const processUserMonsters = (monsters: QuestMonster[]) => {
            for (const m of monsters) {
                // @ts-ignore
                const rawOwned = m.owned ?? m.quantite ?? m.amount ?? m.quantity ?? 0;
                if (rawOwned < currentUserPQ) {
                    neededMonsterIds.add(m.id);
                }
            }
        };

        processUserMonsters(currentUserQuest.monsters);

        // Handle pagination for current user to be 100% sure we have all data
        if (currentUserQuest.pagination.total > 200) {
            let offset = 200;
            while (offset < currentUserQuest.pagination.total) {
                const page = await getQuestDetails(
                    currentUserProfile.metamobPseudo!,
                    currentUserProfile.metamobQuestSlug,
                    { guildApiKey: effectiveApiKey, status: "all", limit: 200, offset }
                );
                processUserMonsters(page.monsters);
                offset += 200;
            }
        }

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
                metamobApiKey: true,
                discordNickname: true,
                id: true, // profileId
                user: { select: { id: true, name: true, image: true } },
            },
        });

        if (guildMembers.length === 0) {
            return { success: true, data: [] };
        }

        const partners: ExchangePartner[] = [];
        // We process in small batches to respect rate limits
        const BATCH_SIZE = 3;
        for (let i = 0; i < guildMembers.length; i += BATCH_SIZE) {
            const batch = guildMembers.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (member: any) => {
                if (!member.metamobPseudo || !member.metamobQuestSlug) return;

                try {
                    // Use member's own key if available, fallback to guild key
                    const effectiveKey = decrypt(member.metamobApiKey) || effectiveApiKey;

                    // Fetch partners monsters
                    const firstPage = await getQuestDetails(
                        member.metamobPseudo,
                        member.metamobQuestSlug,
                        { guildApiKey: effectiveKey, status: "all", limit: 200 }
                    );

                    let allMonsters = [...firstPage.monsters];
                    const pq = firstPage.parallel_quests || 1;

                    // Paginator
                    let offset = 200;
                    while (offset < firstPage.pagination.total) {
                        const nextPage = await getQuestDetails(
                            member.metamobPseudo,
                            member.metamobQuestSlug,
                            { guildApiKey: effectiveKey, status: "all", limit: 200, offset }
                        );
                        allMonsters = [...allMonsters, ...nextPage.monsters];
                        offset += 200;
                    }

                    // Find monsters this member has in surplus (Global Marketplace Logic)
                    // We return ALL surplus, not just what matches needs
                    const monstersTheyHave = allMonsters
                        .filter(m => {
                            // Public profiles expose 'offer' instead of 'owned'
                            // 'offer' is the ALREADY calculated surplus available for trade
                            // Logic: Available if Offer > 0 OR (Owned > PQ)
                            // We prioritize explicit offer if set
                            let available = 0;
                            // @ts-ignore
                            if (typeof m.offer === 'number') {
                                // @ts-ignore
                                available = m.offer;
                            } else {
                                // @ts-ignore
                                const rawOwned = m.owned ?? m.quantite ?? m.amount ?? m.quantity ?? 0;
                                available = Math.max(0, rawOwned - pq);
                            }
                            return available > 0;
                        })
                        .map(m => {
                            // @ts-ignore
                            let available = 0;
                            // @ts-ignore
                            if (typeof m.offer === 'number') {
                                // @ts-ignore
                                available = m.offer;
                            } else {
                                // @ts-ignore
                                const rawOwned = m.owned ?? m.quantite ?? m.amount ?? m.quantity ?? 0;
                                available = Math.max(0, rawOwned - pq);
                            }

                            return {
                                id: m.id,
                                name: m.name.fr,
                                imageUrl: m.image ? `https://www.metamob.fr/img/monsters/${m.image}` : undefined,
                                available,
                                needed: 1,
                                coversNeed: neededMonsterIds.has(m.id), // Flag matching needs
                            };
                        });

                    if (monstersTheyHave.length > 0) {
                        partners.push({
                            username: member.metamobPseudo,
                            characterName: member.discordNickname || member.user.name || member.metamobPseudo,
                            discordId: member.user.id || "",
                            discordAvatar: member.user.image || undefined,
                            profileId: member.id,
                            parallelQuests: pq,
                            lastActive: undefined,
                            monstersTheyHave,
                            monstersYouHave: [],
                            matchScore: monstersTheyHave.filter(m => m.coversNeed).length, // Sort relevance by matches
                        });
                    }
                } catch (e) {
                    console.error(`Error fetching for ${member.metamobPseudo}:`, e);
                }
            }));
        }




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
// FIND SPECIFIC MONSTER OWNERS
// -----------------------------------------------------------------------------

/**
 * Find all guild members who have a specific monster in doublon.
 */
export async function findMonsterOwnersAction(
    rawData: z.infer<typeof FindMonsterOwnersSchema>
): Promise<ActionResponse<{ metamobPseudo: string; profileId: string; displayName: string; quantite: number; }[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const parsed = FindMonsterOwnersSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const { guildId, monsterId } = parsed.data;

        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) return { success: false, error: "Accès non autorisé" };

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { metamobApiKey: true }
        });
        const guildApiKey = decrypt(guildConfig?.metamobApiKey) || undefined;

        // Get guild members with linked Metamob
        const members = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
                metamobVerified: true,
                metamobPseudo: { not: null },
                userId: { not: session.user.id },
            },
            select: {
                id: true,
                metamobPseudo: true,
                metamobQuestSlug: true,
                user: { select: { name: true } },
            },
        });

        const owners: { metamobPseudo: string; profileId: string; displayName: string; quantite: number; }[] = [];
        const BATCH_SIZE = 5;

        for (let i = 0; i < members.length; i += BATCH_SIZE) {
            const batch = members.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (member: any) => {
                if (!member.metamobPseudo || !member.metamobQuestSlug) return;
                try {
                    // Optimized: Fetch only this monster if possible? No, API doesn't support filtering by monster ID in list.
                    // But we can check public page or use our API wrapper which fetches list.
                    // Actually getQuestDetails fetches all monsters.
                    // Optimization: We could cache these results aggressively?
                    // For now, simple fetch.
                    const details = await getQuestDetails(member.metamobPseudo, member.metamobQuestSlug, {
                        guildApiKey,
                        limit: 1000 // Get all
                    });

                    const monster = details.monsters.find(m => m.id === monsterId);
                    if (monster) {
                        // @ts-ignore
                        const owned = monster.owned ?? monster.quantite ?? monster.amount ?? monster.quantity ?? 0;
                        // @ts-ignore
                        const offer = monster.offer;
                        const pq = details.parallel_quests || 1;

                        let available = 0;
                        if (typeof offer === 'number') {
                            available = offer;
                        } else {
                            available = Math.max(0, owned - pq);
                        }

                        if (available > 0) {
                            owners.push({
                                metamobPseudo: member.metamobPseudo,
                                profileId: member.id,
                                displayName: member.user.name || member.metamobPseudo,
                                quantite: available
                            });
                        }
                    }
                } catch (e) {
                    // Ignore errors for individual members
                }
            }));
        }

        return { success: true, data: owners.sort((a, b) => b.quantite - a.quantite) };

    } catch (error) {
        console.error("[findMonsterOwnersAction] Error:", error);
        return { success: false, error: "Erreur lors de la recherche" };
    }
}

// -----------------------------------------------------------------------------
// GET PROFILE MATCHING ARCHIS (One-on-One)
// -----------------------------------------------------------------------------

export interface ProfileMatchData {
    matches: {
        id: number;
        nom: string;
        image: string;
        imageUrl?: string;
        zone: string;
        ownerQuantite: number;
        myState: string;
    }[];
    targetProfile: {
        pseudo: string;
        metamobPseudo: string;
    };
}

export async function getProfileMatchingArchis(
    rawData: z.infer<typeof GetProfileMatchingSchema>
): Promise<ActionResponse<ProfileMatchData>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const parsed = GetProfileMatchingSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const { guildId, targetProfileId } = parsed.data;

        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) return { success: false, error: "Accès non autorisé" };

        // 1. Get Me and Target
        const [me, target] = await Promise.all([
            db.userProfile.findFirst({
                where: { userId: session.user.id, guild: { discordGuildId: guildId } },
                include: { guild: { select: { metamobApiKey: true } } }
            }),
            db.userProfile.findUnique({
                where: { id: targetProfileId },
                include: { user: true }
            })
        ]);

        if (!me?.metamobPseudo || !me.metamobVerified) return { success: false, error: "Votre compte Metamob n'est pas lié" };
        if (!target?.metamobPseudo || !target.metamobVerified) return { success: false, error: "Le membre n'a pas lié Metamob" };

        const guildApiKey = decrypt(me.guild?.metamobApiKey) || undefined;

        // 2. Get My Progress (to know what I need)
        const myProgress = await getMyOcreProgress(guildId);
        if (!myProgress.success || !myProgress.data) return { success: false, error: "Impossible de charger votre progression" };

        const myNeededIds = new Set(
            myProgress.data.monsters
                .filter(m => m.state === "MANQUANT")
                .map(m => m.id)
        );

        // 3. Get Target Quest Details (to know what they have in surplus)
        // FORCE "status: all" to get everything (even if user didn't mark as "Offer")
        // Short cache (5min) to capture recent changes from Metamob
        const targetQuest = await getQuestDetails(target.metamobPseudo, target.metamobQuestSlug || "moisson-eternelle", {
            guildApiKey,
            limit: 1000,
            status: "all",
            revalidate: 300
        });

        const matches: ProfileMatchData['matches'] = [];
        const pq = targetQuest.parallel_quests || 1;

        for (const m of targetQuest.monsters) {
            // @ts-ignore
            const owned = m.owned ?? m.quantite ?? m.amount ?? m.quantity ?? 0;
            // @ts-ignore
            const offer = m.offer;

            let available = 0;
            if (typeof offer === 'number') {
                available = offer;
            } else {
                available = Math.max(0, owned - pq);
            }

            if (available > 0 && myNeededIds.has(m.id)) {
                matches.push({
                    id: m.id,
                    nom: m.name.fr,
                    image: m.image || "tofu.png",
                    imageUrl: m.image ? `https://www.metamob.fr/img/monsters/${m.image}` : undefined,
                    // We try to find zone from myProgress which has normalized data
                    zone: myProgress.data.monsters.find(myM => myM.id === m.id)?.zone || "Inconnue",
                    ownerQuantite: available,
                    myState: "MANQUANT"
                });
            }
        }

        return {
            success: true,
            data: {
                matches: matches.sort((a, b) => a.nom.localeCompare(b.nom)),
                targetProfile: {
                    pseudo: target.user.name || "Membre",
                    metamobPseudo: target.metamobPseudo
                }
            }
        };

    } catch (error) {
        console.error("[getProfileMatchingArchis] Error:", error);
        return { success: false, error: "Erreur lors du calcul des échanges" };
    }
}

// -----------------------------------------------------------------------------
// GUILD EXCHANGE MAP (Optimized with Pagination)
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
                metamobApiKey: true, // Important for private profiles
            },
        });

        // Build map by fetching each member's doublons
        const availableExchanges: Record<number, number> = {};
        const guildConfig = await db.guildConfig.findFirst({
            where: { discordGuildId: guildId },
            select: { metamobApiKey: true },
        });
        const guildApiKey = decrypt(guildConfig?.metamobApiKey) || undefined;

        // Parallel fetch with limit
        const batchSize = 4; // Lower concurrency for heavier "all" queries
        for (let i = 0; i < members.length; i += batchSize) {
            const batch = members.slice(i, i + batchSize);
            await Promise.all(batch.map(async (member: any) => {
                if (!member.metamobPseudo || !member.metamobQuestSlug) return;

                try {
                    const effectiveKey = decrypt(member.metamobApiKey) || guildApiKey;

                    // Fetch first page to get total and parallel quests
                    // Short cache (5min) for the map to stay relatively fresh vs external updates
                    const firstPage = await getQuestDetails(
                        member.metamobPseudo,
                        member.metamobQuestSlug,
                        { guildApiKey: effectiveKey, status: "all", limit: 200, revalidate: 300 }
                    );

                    const pq = firstPage.parallel_quests || 1;
                    const allMonsters = [...firstPage.monsters];

                    // Process first page
                    for (const monster of allMonsters) {
                        const owned = monster.owned ?? 0;
                        if (owned > pq) {
                            availableExchanges[monster.id] = (availableExchanges[monster.id] || 0) + 1;
                        }
                    }

                    // Process remaining pages
                    let offset = 200;
                    while (offset < firstPage.pagination.total) {
                        const nextPage = await getQuestDetails(
                            member.metamobPseudo,
                            member.metamobQuestSlug,
                            { guildApiKey: effectiveKey, status: "all", limit: 200, offset, revalidate: 300 }
                        );

                        for (const monster of nextPage.monsters) {
                            const owned = monster.owned ?? 0;
                            if (owned > pq) {
                                availableExchanges[monster.id] = (availableExchanges[monster.id] || 0) + 1;
                            }
                        }
                        offset += 200;
                    }

                } catch {
                    // Skip errors
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

        // PRIORITY 1: Current user's personal key (most likely to be fresh or have allowance)
        const currentUser = await db.userProfile.findFirst({
            where: { userId: session.user.id, guild: { discordGuildId: guildId } },
            select: { metamobApiKey: true, metamobServerId: true }
        });

        // PRIORITY 2: Guild's global key
        const guildConfig = await db.guildConfig.findFirst({
            where: { discordGuildId: guildId },
            select: { metamobApiKey: true },
        });

        // PRIORITY 3: Any member with a server ID (to at least get the server ID)
        const memberWithServer = await db.userProfile.findFirst({
            where: {
                guild: { discordGuildId: guildId },
                metamobServerId: { not: null },
            },
            select: {
                metamobServerId: true,
                metamobApiKey: true
            },
        });

        const guildApiKey =
            decrypt(currentUser?.metamobApiKey) ||
            decrypt(guildConfig?.metamobApiKey) ||
            decrypt(memberWithServer?.metamobApiKey) ||
            undefined;

        const events = await getKralamoureEvents({
            guildApiKey,
            serverId: currentUser?.metamobServerId || memberWithServer?.metamobServerId || undefined,
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

        // Permission check
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) return { success: true, data: [] }; // Silent fail for common data

        const guildConfig = await db.guildConfig.findFirst({
            where: { discordGuildId: guildId },
            select: { metamobApiKey: true },
        });

        const guildApiKey = decrypt(guildConfig?.metamobApiKey) || undefined;
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
        const guildApiKey = decrypt(profile.metamobApiKey) || decrypt(profile.guild?.metamobApiKey) || undefined;

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
            } else {
                // [HANDLE DELETION] No quests found on Metamob, but we have one linked.
                // This means the user deleted their quest. Clear it locally.
                if (profile.metamobQuestSlug) {
                    newQuestSlug = null;
                    questUpdated = true;

                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: {
                            metamobQuestSlug: null,
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

        revalidateTag(`metamob-user-${profile.metamobPseudo.toLowerCase()}`, "max");
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
/**
 * Force refresh the Ocre cache for the current user.
 * This invalidates the Next.js cache and updates the Last Sync timestamp.
 */
export async function forceRefreshOcre(
    guildId: string
): Promise<ActionResponse<{ questUpdated: boolean }>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié" };
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
                metamobQuestSlug: true,
                metamobApiKey: true,
                guild: { select: { metamobApiKey: true } }
            },
        });

        if (!profile?.metamobPseudo) {
            return { success: false, error: "Compte Metamob non lié" };
        }

        // [RateLimit] Prevent abuse (1 refresh per minute)
        const rateCheck = await rateLimit(`ocre:refresh:${session.user.id}`, 1, 60);
        if (!rateCheck.success) {
            return { success: false, error: "Veuillez attendre une minute avant de rafraîchir à nouveau." };
        }

        // 1. Clear internal memory cache
        clearCache(profile.metamobPseudo.toLowerCase());

        // 2. Fetch fresh data from Metamob API to verify it works (and detect quest changes)
        // We force skipCache: true
        const effectiveKey = decrypt(profile.metamobApiKey) || decrypt(profile.guild?.metamobApiKey);

        let questUpdated = false;

        // Optionally, check if the quest slug is still valid or if user changed quest
        if (profile.metamobQuestSlug) {
            try {
                const details = await getQuestDetails(
                    profile.metamobPseudo,
                    profile.metamobQuestSlug,
                    { guildApiKey: effectiveKey, limit: 1, skipCache: true }
                );

                // If details fetched successfully, update timestamp
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: { metamobLastSync: new Date() }
                });
            } catch (e) {
                // console.warn("[forceRefreshOcre] Current quest failed, attempting rediscovery...");
                const quests = await getUserQuests(profile.metamobPseudo, { guildApiKey: effectiveKey, skipCache: true });
                if (quests.length > 0 && quests[0].slug !== profile.metamobQuestSlug) {
                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: {
                            metamobQuestSlug: quests[0].slug,
                            metamobLastSync: new Date()
                        }
                    });
                    questUpdated = true;
                }
            }
        }

        // 3. Revalidate
        // Invalidate specific user tag so that getQuestDetails returns fresh data immediately
        // @ts-ignore
        revalidateTag(`metamob-user-${profile.metamobPseudo.toLowerCase()}`);
        revalidatePath(`/dashboard/${guildId}/quete-ocre`, "page");

        return { success: true, data: { questUpdated } };

    } catch (error) {
        // console.error("[forceRefreshOcre] Error:", error);
        return { success: false, error: "Erreur lors de la synchronisation" };
    }
}

// -----------------------------------------------------------------------------
// MULTI-QUEST SUPPORT
// -----------------------------------------------------------------------------

export async function getAvailableOcreQuests(guildId: string): Promise<ActionResponse<UserQuest[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const profile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
            },
            select: { metamobPseudo: true, metamobApiKey: true, guild: { select: { metamobApiKey: true } } }
        });

        if (!profile?.metamobPseudo) return { success: false, error: "Compte non lié" };

        const effectiveKey = decrypt(profile.metamobApiKey) || decrypt(profile.guild.metamobApiKey);

        // Always skip cache to get latest list
        const quests = await getUserQuests(profile.metamobPseudo, {
            guildApiKey: effectiveKey,
            skipCache: true
        });

        return { success: true, data: quests };
    } catch (error) {
        // console.error("[getAvailableOcreQuests] Error:", error);
        return { success: false, error: "Impossible de récupérer la liste des quêtes" };
    }
}

export async function switchOcreQuest(guildId: string, questSlug: string): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const member = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: { id: true, metamobPseudo: true, metamobQuestSlug: true, metamobApiKey: true, guild: { select: { metamobApiKey: true } } },
        });

        if (!member) return { success: false, error: "Profil introuvable" };
        if (!member.metamobPseudo) return { success: false, error: "Compte Metamob non lié" };

        const effectiveKey = decrypt(member.metamobApiKey) || decrypt(member.guild.metamobApiKey);

        // Verify the quest exists and belongs to user
        const quests = await getUserQuests(member.metamobPseudo, {
            guildApiKey: effectiveKey,
            skipCache: true
        });

        const targetQuest = quests.find(q => q.slug === questSlug);
        if (!targetQuest) return { success: false, error: "Quête introuvable ou vous n'y avez pas accès" };

        // Update profile
        await db.userProfile.update({
            where: { id: member.id },
            data: {
                metamobQuestSlug: targetQuest.slug,
                metamobServerId: targetQuest.server.id, // Update server ID too!
                metamobLastSync: new Date() // Force fresh sync timestamp
            }
        });

        // Revalidate
        revalidatePath(`/dashboard/${guildId}/quete-ocre`, "page");
        revalidatePath(`/dashboard/${guildId}/profile`, "page");

        return { success: true };

    } catch (error) {
        console.error("[switchOcreQuest] Error:", error);
        return { success: false, error: "Erreur lors du changement de quête" };
    }
}

const AdminForceUnlinkSchema = z.object({
    guildId: z.string().min(1),
    targetPseudo: z.string().min(1),
});

/**
 * ADMIN: Force unlink a Metamob account from ANY user in the guild.
 * Useful directly from Admin UI to release a blocked pseudo.
 */
export async function adminForceUnlink(
    rawData: z.infer<typeof AdminForceUnlinkSchema>
): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const parsed = AdminForceUnlinkSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const { guildId, targetPseudo } = parsed.data;

        // Security check
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ADMIN_ACCESS);
        if (!guard.allowed) return { success: false, error: "Accès refusé" };

        // Find the user holding this pseudo
        const userProfile = await db.userProfile.findFirst({
            where: {
                guild: { discordGuildId: guildId },
                metamobPseudo: { equals: targetPseudo, mode: "insensitive" },
                status: "ACTIVE"
            },
            include: { user: true }
        });

        if (!userProfile) {
            return { success: false, error: `Aucun utilisateur trouvé avec le compte Metamob "${targetPseudo}"` };
        }

        // Perform unlink
        await db.userProfile.update({
            where: { id: userProfile.id },
            data: {
                metamobPseudo: null,
                metamobQuestSlug: null,
                metamobServerId: null,
                metamobVerified: false,
                metamobLastSync: null,
                metamobApiKey: null,
            }
        });

        clearCache(targetPseudo.toLowerCase());

        // Revalidate admin page and potential user page (though we don't know which user it was easily without fetching)
        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        revalidatePath(`/dashboard/${guildId}/members`);

        return { success: true, data: undefined };

    } catch (error) {
        console.error("Error in adminForceUnlink:", error);
        return { success: false, error: "Erreur serveur interne" };
    }
}
