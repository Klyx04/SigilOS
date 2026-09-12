"use server";
import { logger } from "@/lib/logger";

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
import { withCache, invalidateCache } from "@/lib/cache";
import { getDisplayName, getGameDisplayName } from "@/lib/display-name";
import {
    getUserProfile,
    getQuestDetails,
    getQuestTemplates,
    getQuestTemplateMonsters,
    getPrivateQuestDetails,
    getQuestMatches,
    getKralamoureEvents,
    getZones,
    getMetamobMe,
    getOwnQuests,
    listSelfQuests,
    getSelfQuestDetails,
    matchesOcreQuest,
    getConversations,
    getConversationDetails,
    getMonster,
    verifyMetamobUser,
    normalizeQuestMonster,
    clearCache,
    MetamobApiError,
    updateQuestSettings,
    updateMonsterTradeParams,
    bulkUpdateMonsters,
    type UserProfile,
    type UserQuest,
    type QuestDetails,
    type QuestMonster,
    type MatchPartner,
    type OcreMonster,
    type Zone,
    type KralamoureEvent,
    type QuestSettings,
} from "@/lib/metamob-client";
import { decrypt } from "@/lib/encryption";
import { metamobQueue } from "@/lib/queue/metamob-queue";
import { redis } from "@/lib/redis";

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
        acquired: number;
        remaining: number;
    };
    questInfo: {
        slug: string;
        characterName: string;
        currentStep: number;
        totalSteps: number;
        parallelQuests: number;
        serverName: string;
        // Expert Settings
        trade_mode?: number;
        trade_offer_threshold?: number | null;
        trade_want_threshold?: number | null;
        show_trades?: boolean;
    };
    lastSync: Date | null;
    isOffline?: boolean;
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
    slug?: string;
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
    // Pseudo optionnel : si absent, résolu via GET /v1/me depuis la clé (zéro erreur de casse).
    pseudo: z.string()
        .min(2, "Le pseudo doit contenir au moins 2 caractères")
        .max(30, "Le pseudo ne peut pas dépasser 30 caractères")
        .regex(/^[a-zA-Z0-9_-]+$/, "Le pseudo ne peut contenir que des lettres, chiffres, tirets et underscores")
        .optional()
        .or(z.literal("")),
    apiKey: z.string()
        .length(64, "La clé API V2 doit contenir exactement 64 caractères")
        .regex(/^[a-f0-9]+$/, "La clé API doit être une chaîne hexadécimale (chiffres et lettres de a à f)")
        .optional(),
    force: z.boolean().optional(),
    targetUserId: z.string().optional(),
});

const UnlinkAccountSchema = z.object({
    guildId: z.string().min(1),
    targetUserId: z.string().optional(),
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

const UpdateSettingsSchema = z.object({
    guildId: z.string().min(1),
    settings: z.any(),
});

const UpdateTradeParamsSchema = z.object({
    guildId: z.string().min(1),
    monsterId: z.number().int().positive(),
    params: z.object({
        trade_offer: z.number().int().min(0).nullable().optional(),
        trade_want: z.number().int().min(0).nullable().optional(),
    }),
});

const BulkUpdateQuantitiesSchema = z.object({
    guildId: z.string().min(1),
    monsters: z.array(z.object({
        monster_id: z.number().int().positive(),
        quantity: z.number().int().min(0).max(30),
    })).max(200),
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
        const apiKey = parsed.data.apiKey?.trim();
        let pseudo = parsed.data.pseudo?.trim();

        // Lot A — liaison clé-seule : pseudo résolu via GET /v1/me (casse canonique,
        // zéro erreur de frappe). Fail-closed : /me en échec = clé invalide.
        if (!pseudo) {
            if (!apiKey) {
                return { success: false, error: "Indiquez votre pseudo Metamob ou votre clé API." };
            }
            try {
                const me = await getMetamobMe(apiKey);
                pseudo = me.username;
            } catch {
                return { success: false, error: "Clé API invalide. Vérifiez votre clé sur Metamob.fr." };
            }
        }
        const force = parsed.data.force;
        const targetUserId = parsed.data.targetUserId;

        // DB / RBAC Check
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : session.user.id;

        const profile = await db.userProfile.findFirst({
            where: {
                userId: effectiveUserId,
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

        // Determine which key to use for verification
        const keyToUse = apiKey;

        if (!keyToUse) {
            return {
                success: false,
                error: (apiKey)
                    ? "Clé API invalide."
                    : "Votre compte Metamob semble privé ou vous n'avez pas renseigné de clé API. Liez votre compte avec votre clé personnelle."
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
                    userId: { not: effectiveUserId }
                },
                include: { user: true }
            });

            if (existingKeyUser) {
                // TODO: Allow force here too? For now, keep it strict as keys are sensitive.
                return {
                    success: false,
                    error: `Cette clé API est déjà utilisée par ${getDisplayName(existingKeyUser)} dans une autre guilde.`
                };
            }
        }

        // 2. Check if Metamob Pseudo is already linked in this guild by another user
        const existingPseudoUser = await db.userProfile.findFirst({
            where: {
                guild: { discordGuildId: guildId },
                metamobPseudo: { equals: metamobPseudo, mode: "insensitive" }, // Case insensitive check
                userId: { not: effectiveUserId },
                status: "ACTIVE"
            },
            include: { user: true }
        });

        if (existingPseudoUser) {
            let canOverwrite = false;

            if (force) {
                // Check if user is Admin
                const guard = await checkGuildPermission(session, guildId, PERMISSIONS.SYSTEM_CONFIG);
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
                    error: `Le compte Metamob "${metamobPseudo}" est déjà lié à ${getDisplayName(existingPseudoUser)} dans cette guilde.`
                };
            }
        }

        // 3. Verify character name matches pseudo Dofus (or auto-fill it)

        if (metamobCharName) {
            const normalizedMetamobChar = metamobCharName.toLowerCase().trim();
            const userPseudoDofus = profile.pseudoDofus?.toLowerCase().trim();

            if (!userPseudoDofus) {
                // Auto-fill pseudoDofus from Metamob character name
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: { pseudoDofus: metamobCharName.trim() },
                });
            } else if (normalizedMetamobChar !== userPseudoDofus) {
                // If the user provided an API key, we trust ownership but log the discrepancy
                if (apiKey) {
                    logger.warn(`[linkOcreAccount] Character name mismatch for user ${effectiveUserId}: Metamob="${metamobCharName}", Dofus="${profile.pseudoDofus}". Linking anyway because API key was provided.`);
                } else {
                    return {
                        success: false,
                        error: `Le personnage Metamob "${metamobCharName}" ne correspond pas à votre pseudo Dofus "${profile.pseudoDofus}". Utilisez votre clé API personnelle pour valider l'identité.`
                    };
                }
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

        // Force clear Redis progress cache
        await invalidateCache(`ocre:progress:${guildId}:${effectiveUserId}`);

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
        logger.error("[linkOcreAccount] Error:", error);

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
        const { guildId, targetUserId } = parsed.data;

        // DB / RBAC Check
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : session.user.id;

        const profile = await db.userProfile.findFirst({
            where: {
                userId: effectiveUserId,
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
        logger.error("[unlinkOcreAccount] Error:", error);
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
        // [RateLimit]
        const rateCheck = await rateLimit(`ocre:progress:${userId}`, 30, 60);
        if (!rateCheck.success) return { success: false, error: "Trop de requêtes." };

        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
        if (!guard.allowed) return { success: false, error: "Accès non autorisé" };

        // Use Prisma ORM — $queryRawUnsafe is forbidden by project rules
        const profile = await db.userProfile.findFirst({
            where: {
                userId,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: {
                id: true,
                metamobPseudo: true,
                metamobQuestSlug: true,
                metamobApiKey: true,
                ocreProgressSnapshot: true,
                metamobLastSync: true,
            },
        });

        if (!profile?.metamobPseudo) return { success: false, error: "Compte non lié" };

        const cacheKey = `ocre:progress:${guildId}:${userId}`;
        const finalResult = await withCache(cacheKey, 120, async () => {
            try {
                const effectiveApiKey = profile.metamobApiKey ? decrypt(profile.metamobApiKey as string) : undefined;
                let questSlug = profile.metamobQuestSlug;

                if (!questSlug) {
                    const quests = await listSelfQuests(profile.metamobPseudo!, effectiveApiKey);
                    // Slug d'abord, sinon modèle (le slug = nom personnalisé, ex. « Draconiros »).
                    const ocreQuest = quests.find(matchesOcreQuest);
                    if (!ocreQuest) return { success: false, error: "NO_VISIBLE_QUEST" };
                    questSlug = ocreQuest.slug;
                    await db.userProfile.update({ where: { id: profile.id }, data: { metamobQuestSlug: questSlug } });
                }

                // API calls — résolveur self : public d'abord, repli privé (paginé) si 404.
                const firstPage = await getSelfQuestDetails(profile.metamobPseudo!, questSlug, effectiveApiKey);
                if (firstPage.slug !== questSlug) {
                    questSlug = firstPage.slug;
                    await db.userProfile.update({ where: { id: profile.id }, data: { metamobQuestSlug: questSlug } });
                }
                const userQuestData = [...firstPage.monsters];

                const templateId = firstPage.quest_template.id;
                let skeletonMonsters: QuestMonster[] = [];
                try { skeletonMonsters = await getQuestTemplateMonsters(templateId, { guildApiKey: effectiveApiKey }); } catch { }

                // ===========================================================================
                // ZONE MAP — Source : /v1/quests/{slug}/zones?monster_type_id=3
                // Endpoint authentifié Metamob : 1 seul appel, retourne zones → subzones → archis.
                // Matching par nom FR (stable, évite les mismatches d'IDs entre endpoints).
                // Cachépar slug dans Redis 2h.
                // ===========================================================================
                const archiZoneCacheKey = `metamob:archi-zones:${questSlug}`;
                const nameToZoneMap = new Map<string, string>();    // archiNameFr.lower → zone.name.fr
                const nameToSubzoneMap = new Map<string, string>(); // archiNameFr.lower → subzone.name.fr

                try {
                    const cachedZones = await redis.get(archiZoneCacheKey);
                    if (cachedZones) {
                        const cachedData: Record<string, { zone?: string; subzone?: string }> = JSON.parse(cachedZones);
                        Object.entries(cachedData).forEach(([k, v]) => {
                            if (v.zone) nameToZoneMap.set(k, v.zone);
                            if (v.subzone) nameToSubzoneMap.set(k, v.subzone);
                        });
                    } else {
                        const zoneEndpoint = `https://www.metamob.fr/api/v1/quests/${encodeURIComponent(questSlug!)}/zones?monster_type_id=3`;
                        const zoneHeaders: Record<string, string> = { 'Accept': 'application/json' };
                        if (effectiveApiKey) zoneHeaders['Authorization'] = `Bearer ${effectiveApiKey}`;

                        const zoneRes = await fetch(zoneEndpoint, { headers: zoneHeaders, signal: AbortSignal.timeout(10000) });
                        if (zoneRes.ok) {
                            const zoneJson = await zoneRes.json();
                            const zones: any[] = zoneJson.data || [];
                            const cacheStore: Record<string, { zone?: string; subzone?: string }> = {};

                            zones.forEach((z: any) => {
                                const zoneName: string = z.name?.fr || '';
                                (z.subzones || []).forEach((sz: any) => {
                                    const subzoneName: string = sz.name?.fr || '';
                                    (sz.monsters || []).forEach((m: any) => {
                                        const nameFr: string | undefined = m.name?.fr;
                                        if (nameFr) {
                                            const key = nameFr.toLowerCase().trim();
                                            if (!nameToZoneMap.has(key)) {
                                                if (zoneName) nameToZoneMap.set(key, zoneName);
                                                if (subzoneName) nameToSubzoneMap.set(key, subzoneName);
                                                cacheStore[key] = { zone: zoneName || undefined, subzone: subzoneName || undefined };
                                            }
                                        }
                                    });
                                });
                            });

                            if (Object.keys(cacheStore).length > 0) {
                                await redis.set(archiZoneCacheKey, JSON.stringify(cacheStore), 'EX', 7200).catch(() => {});
                            }
                        }
                    }
                } catch { /* silent — zones are best-effort */ }

                // Mapping
                const masterList = skeletonMonsters.length > 0 ? skeletonMonsters : userQuestData;
                const userMap = new Map<number, QuestMonster>();
                const skeletonIdMap = new Set(masterList.map(m => m.id));
                const skeletonNameMap = new Map<string, QuestMonster>();
                masterList.forEach(m => { if (m.name?.fr) skeletonNameMap.set(m.name.fr.toLowerCase().trim(), m); });

                userQuestData.forEach(m => {
                    let tid = m.monster_id ?? (m as any).monster?.id ?? m.id;
                    if (skeletonMonsters.length > 0 && !skeletonIdMap.has(tid)) {
                        const match = m.name?.fr ? skeletonNameMap.get(m.name.fr.toLowerCase().trim()) : undefined;
                        if (match) tid = match.id;
                    }
                    userMap.set(tid, m);
                });

                const finalMonsters: OcreMonster[] = [];
                let cT = 0, cM = 0, cP = 0, cD = 0;
                const statsByType = { monstre: { total: 0, gathered: 0 }, boss: { total: 0, gathered: 0 }, archimonstre: { total: 0, gathered: 0 } };
                const PQ = firstPage.parallel_quests ?? 1;

                for (const tm of masterList) {
                    const um = userMap.get(tm.id);
                    const norm = normalizeQuestMonster(um || tm, PQ);
                    if (!um) { norm.owned = PQ; norm.state = "POSSEDE"; }
                    if (norm.type === "monstre") continue;

                    // Zone par nom FR — fiable, évite les mismatches d'IDs entre endpoints Metamob
                    const zoneKey = norm.nameFr.toLowerCase().trim();
                    const zVal = nameToZoneMap.get(zoneKey);
                    const szVal = nameToSubzoneMap.get(zoneKey);
                    if (zVal) norm.zone = zVal;
                    if (szVal) norm.subzone = szVal;

                    finalMonsters.push(norm);
                    cT++;
                    const isPoss = norm.state !== "MANQUANT";
                    const isGath = isPoss || (norm.step && firstPage.current_step && norm.step < firstPage.current_step);
                    if (norm.state === "MANQUANT") cM++;
                    else { cP++; if (norm.state === "DOUBLON") cD++; }
                    const tk = norm.type as keyof typeof statsByType;
                    if (statsByType[tk]) { statsByType[tk].total++; if (isGath) statsByType[tk].gathered++; }
                }


                const gathered = finalMonsters.filter(m => (m.state !== "MANQUANT") || (m.step && firstPage.current_step && m.step < firstPage.current_step)).length;
                const resData: OcreProgressData = {
                    monsters: finalMonsters,
                    stats: { total: cT, manquants: cM, possedes: cP, doublons: cD, progressPercent: cT > 0 ? Math.round((gathered / cT) * 100) : 0, monsters: statsByType.monstre, bosses: statsByType.boss, archis: statsByType.archimonstre, acquired: gathered, remaining: cT - gathered },
                    questInfo: { 
                        slug: questSlug!, 
                        characterName: firstPage.character_name || "Dofusien", 
                        currentStep: firstPage.current_step || 0, 
                        totalSteps: 34, 
                        parallelQuests: PQ, 
                        serverName: firstPage.server?.name || "Serveur",
                        trade_mode: firstPage.trade_mode,
                        trade_offer_threshold: firstPage.trade_offer_threshold,
                        trade_want_threshold: firstPage.trade_want_threshold,
                        show_trades: firstPage.show_trades
                    },
                    lastSync: new Date()
                };

                // PUMP: Offline Save (Async - don't block response)
                Promise.resolve().then(async () => {
                    try {
                        await db.userProfile.update({
                            where: { id: profile.id },
                            data: {
                                metamobLastSync: new Date(),
                                ocreProgressSnapshot: resData as any
                            }
                        });
                    } catch (pe) { logger.error("[PUMP ERROR]", pe); }
                });

                return { success: true, data: resData };
            } catch (innerErr) {
                if (profile.ocreProgressSnapshot) {
                    return { success: true, data: { ...(profile.ocreProgressSnapshot as any), lastSync: profile.metamobLastSync, isOffline: true } as OcreProgressData };
                }
                throw innerErr;
            }
        });

        // Don't cache errors unless it's a valid snapshot
        const finalResultTyped = finalResult as ActionResponse<OcreProgressData>;
        if (!finalResultTyped.success && !finalResultTyped.data?.isOffline) {
            await invalidateCache(cacheKey);
        }

        return finalResultTyped;
    } catch (err: any) {
        logger.error("[CRITICAL OCRE ERROR]", err);
        try {
            const pLast = await db.userProfile.findFirst({
                where: {
                    userId,
                    guild: { discordGuildId: guildId },
                },
                select: {
                    ocreProgressSnapshot: true,
                    metamobLastSync: true,
                },
            });
            if (pLast?.ocreProgressSnapshot) {
                return { success: true, data: { ...(pLast.ocreProgressSnapshot as any), lastSync: pLast.metamobLastSync, isOffline: true } };
            }
        } catch (rawErr) {
            logger.error("[CRITICAL RAW FALLBACK FAILED]", rawErr);
        }
        return { success: false, error: "Metamob indisponible." };
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
): Promise<ActionResponse<{ jobId: string }>> {
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
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
        if (!guard.allowed) {
            return { success: false, error: "Accès non autorisé" };
        }

        const jobId = `ocre-match-${session.user.id}-${Date.now()}`;

        // Push job to queue (Actual matching logic is in src/workers/metamob-worker.ts)
        const job = await metamobQueue.add(
            "sync-partners",
            { guildId, userId: session.user.id },
            { jobId }
        );

        return { success: true, data: { jobId: job.id! } };
    } catch (error) {
        logger.error("[findOcreExchangePartners] Error:", error);

        if (error instanceof MetamobApiError) {
            if (error.code === "RATE_LIMIT") {
                return { success: false, error: "Limite Metamob atteinte. Réessayez plus tard." };
            }
        }

        return { success: false, error: "Erreur lors de la mise en file d'attente" };
    }
}

/**
 * Polling endpoint for the frontend to check BullMQ job status and retrieve the results
 */
export async function getOcreExchangeJobStatus(
    jobId: string
): Promise<ActionResponse<{ state: string; progress: any; result?: ExchangePartner[] }>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        // Security: Ensure user can only check their own started jobs
        if (!jobId.startsWith(`ocre-match-${session.user.id}-`)) {
            return { success: false, error: "Accès refusé à ce Job" };
        }

        const job = await metamobQueue.getJob(jobId);

        if (!job) {
            return { success: false, error: "Tâche introuvable ou expirée" };
        }

        const state = await job.getState();
        const progress: any = job.progress;

        if (state === "completed") {
            return { success: true, data: { state, progress, result: job.returnvalue } };
        }

        if (state === "failed") {
            return { success: false, error: job.failedReason || "Erreur lors du traitement asynchrone" };
        }

        return { success: true, data: { state, progress } };

    } catch (error) {
        logger.error("[getOcreExchangeJobStatus] Error:", error);
        return { success: false, error: "Erreur lors de la vérification du statut du Job" };
    }
}

// -----------------------------------------------------------------------------
// FIND SPECIFIC MONSTER OWNERS
// -----------------------------------------------------------------------------

/**
 * Find all guild members who have a specific monster in doublon.
 * Resolves monster IDs using the same normalization logic as getMyOcreProgress
 * to handle ID mismatches between Metamob API raw data and normalized skeleton IDs.
 */
export async function findMonsterOwnersAction(
    rawData: z.infer<typeof FindMonsterOwnersSchema>
): Promise<ActionResponse<ExchangePartner[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const parsed = FindMonsterOwnersSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const { guildId, monsterId } = parsed.data;

        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
        if (!guard.allowed) return { success: false, error: "Accès non autorisé" };

        const guildApiKey = undefined; // Deprecated guild key

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
                pseudoDofus: true,
                discordNickname: true,
                metamobPseudo: true,
                metamobQuestSlug: true,
                metamobApiKey: true,
                user: { select: { id: true, name: true, image: true } },
            },
        });

        if (members.length === 0) return { success: true, data: [] };

        const owners: ExchangePartner[] = [];
        const BATCH_SIZE = 5;

        for (let i = 0; i < members.length; i += BATCH_SIZE) {
            const batch = members.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (member: any) => {
                if (!member.metamobPseudo || !member.metamobQuestSlug) return;
                try {
                    const effectiveKey = member.metamobApiKey || undefined;
                    const details = await getQuestDetails(member.metamobPseudo, member.metamobQuestSlug, {
                        guildApiKey: effectiveKey,
                        limit: 1000 // Get all
                    });

                    const pq = details.parallel_quests || 1;

                    // Scan all monsters, resolve their IDs the same way as getMyOcreProgress (lines ~648-654).
                    // The key issue was that the old code used `m.id === monsterId` but the API can return
                    // different ID fields (monster_id vs monster.id vs m.id). We need to resolve the canonical ID.
                    for (const m of details.monsters) {
                        // Resolve the real monster ID: prefer monster_id, fallback to monster?.id, then m.id
                        let resolvedId = (m as any).monster_id ?? (m as any).monster?.id ?? m.id;

                        // If the resolved ID doesn't match, try matching by name as fallback
                        // (same pattern as getMyOcreProgress for stability when IDs shift between endpoints)
                        if (resolvedId !== monsterId) {
                            const nameKey = m.name?.fr?.toLowerCase().trim();
                            if (nameKey) {
                                // We can't fully reproduce the skeleton-ID fallback without also
                                // fetching the quest template, but for the direct owner search,
                                // the monster_id resolution is already the critical fix.
                                // If name matching is needed, we'd need the template — skip for now.
                            }
                            continue; // No need to check other names, resolvedId is the canonical ID
                        }

                        // Filter out normal monsters (only archis/bosses/guardians matter for Ocre)
                        const typeName = m.type?.name?.fr?.toLowerCase() || "";
                        if (!typeName.includes("archimonstre") && !typeName.includes("gardien") && !typeName.includes("boss")) {
                            continue;
                        }

                        // Use normalizeQuestMonster to determine state (same as getMyOcreProgress does)
                        const normalized = normalizeQuestMonster(m, pq);

                        // Only include if they have this as a doublon (surplus to trade)
                        if (normalized.state !== "DOUBLON") continue;

                        const available = Math.max(0, normalized.owned - pq);
                        if (available <= 0) continue;

                        owners.push({
                            username: member.metamobPseudo,
                            characterName: getGameDisplayName(member),
                            discordId: member.user.id || "",
                            discordAvatar: member.user.image || undefined,
                            profileId: member.id,
                            slug: (member.pseudoDofus || member.discordNickname || member.id).trim(),
                            parallelQuests: pq,
                            monstersTheyHave: [{
                                id: resolvedId,
                                name: m.name?.fr || "Unknown",
                                available,
                                coversNeed: true,
                                needed: 1
                            }],
                            monstersYouHave: [],
                            matchScore: available
                        });
                        break; // Found the monster, no need to scan further
                    }
                } catch (e) {
                    // Ignore errors for individual members
                }
            }));
        }

        return { success: true, data: owners.sort((a, b) => b.monstersTheyHave[0].available - a.monstersTheyHave[0].available) };

    } catch (error) {
        logger.error("[findMonsterOwnersAction] Error:", error);
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

        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
        if (!guard.allowed) return { success: false, error: "Accès non autorisé" };

        // 1. Get Me and Target (scoped to this guild to prevent cross-guild probing)
        const [me, target] = await Promise.all([
            db.userProfile.findFirst({
                where: { userId: session.user.id, guild: { discordGuildId: guildId } },
            }),
            db.userProfile.findFirst({
                where: {
                    id: targetProfileId,
                    guild: { discordGuildId: guildId } // ðŸ‘ˆ CRITICAL: MUST BE IN SAME GUILD
                },
                include: { user: true }
            })
        ]);

        if (!me?.metamobPseudo || !me.metamobVerified) return { success: false, error: "Votre compte Metamob n'est pas lié" };
        if (!target?.metamobPseudo || !target.metamobVerified) return { success: false, error: "Le membre n'a pas lié Metamob" };

        const guildApiKey = undefined;

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
            // [SigilOS V3] Filter out normal monsters
            const typeName = m.type?.name?.fr?.toLowerCase() || "";
            if (!typeName.includes("archimonstre") && !typeName.includes("gardien") && !typeName.includes("boss")) {
                continue;
            }

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
                    pseudo: getGameDisplayName(target),
                    metamobPseudo: target.metamobPseudo
                }
            }
        };

    } catch (error) {
        logger.error("[getProfileMatchingArchis] Error:", error);
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
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
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
        const guildApiKey = undefined;

        // Parallel fetch with limit
        const batchSize = 4; // Lower concurrency for heavier "all" queries
        for (let i = 0; i < members.length; i += batchSize) {
            const batch = members.slice(i, i + batchSize);
            await Promise.all(batch.map(async (member: any) => {
                if (!member.metamobPseudo || !member.metamobQuestSlug) return;

                try {
                    const effectiveKey = member.metamobApiKey || guildApiKey;

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
                        // [SigilOS V3] Filter out normal monsters
                        const typeName = monster.type?.name?.fr?.toLowerCase() || "";
                        if (!typeName.includes("archimonstre") && !typeName.includes("gardien") && !typeName.includes("boss")) {
                            continue;
                        }

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
                            // [SigilOS V3] Filter out normal monsters
                            const typeName = monster.type?.name?.fr?.toLowerCase() || "";
                            if (!typeName.includes("archimonstre") && !typeName.includes("gardien") && !typeName.includes("boss")) {
                                continue;
                            }

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
        logger.error("[getGuildExchangeMap] Error:", error);
        return { success: false, error: "Erreur lors du chargement" };
    }
}

// -----------------------------------------------------------------------------
// KRALAMOURE EVENTS
// -----------------------------------------------------------------------------

const DOFUS_TO_METAMOB_SERVER: Record<string, number> = {
    "295": 401, // Draconiros
    "48": 401,  // Draconiros (Unity)
    "291": 402, // Imagiro
    "292": 403, // Orukam
    "290": 404, // Tal Kasha
    "293": 405, // Tylezia
    "294": 406, // Hell Mina
    "50": 407,  // Ombre
};

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

        // PRIORITY 1: Current user's personal key & server
        const currentUser = await db.userProfile.findFirst({
            where: { userId: session.user.id, guild: { discordGuildId: guildId } },
            select: { metamobApiKey: true, metamobServerId: true }
        });

        // PRIORITY 2: Default server (Mapping Dofus ID -> Metamob ID)
        const guildConfig = await db.guildConfig.findFirst({
            where: { discordGuildId: guildId },
            select: { dofusServerId: true },
        });

        const guildDefaultServerId = guildConfig?.dofusServerId ? DOFUS_TO_METAMOB_SERVER[guildConfig.dofusServerId] : undefined;

        // PRIORITY 3: Any member with a server ID (Fallback)
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
            currentUser?.metamobApiKey ||
            memberWithServer?.metamobApiKey ||
            undefined;

        const serverId = currentUser?.metamobServerId || guildDefaultServerId || memberWithServer?.metamobServerId || undefined;

        const events = await getKralamoureEvents({
            guildApiKey,
            serverId,
        });

        return { success: true, data: events };
    } catch (error) {
        logger.error("[getGuildKralamoureEvents] Error:", error);

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
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
        if (!guard.allowed) return { success: true, data: [] }; // Silent fail for common data

        const guildApiKey = undefined;
        const zones = await getZones({ guildApiKey });

        return { success: true, data: zones };
    } catch (error) {
        logger.error("[getOcreZones] Error:", error);
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
            },
        });

        if (!profile?.metamobPseudo) {
            return { success: false, error: "Aucun compte Metamob lié" };
        }

        // Use User Key
        const guildApiKey = profile.metamobApiKey || undefined;

        // Clear cache for this user first
        clearCache(profile.metamobPseudo.toLowerCase());

        let questUpdated = false;
        let newQuestSlug = profile.metamobQuestSlug;

        // Auto-detect if quest has changed on Metamob
        try {
            // Fetch user's current quests from Metamob (privées incluses via sa clé)
            const userQuests = await listSelfQuests(profile.metamobPseudo, guildApiKey);

            if (userQuests.length > 0) {
                // Get the most recent active quest (first one with most progress)
                // Préfère une vraie quête Ocre, sinon garde l'ancienne logique ([0]).
                const activeQuest = userQuests.find(matchesOcreQuest) ?? userQuests[0];

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
            logger.error("[refreshOcreCache] Error detecting quest change:", apiError);
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
        logger.error("[refreshOcreCache] Error:", error);
        return { success: false, error: "Erreur lors du rafraîchissement" };
    }
}

// -----------------------------------------------------------------------------
/**
 * Force refresh the Ocre cache for the current user.
 * This invalidates the Next.js cache and updates the Last Sync timestamp.
 */
export async function forceRefreshOcre(
    guildId: string,
    targetUserId?: string
): Promise<ActionResponse<{ questUpdated: boolean }>> {
    try {
        // DB / RBAC Check
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : user.id!;

        const profile = await db.userProfile.findFirst({
            where: {
                userId: effectiveUserId,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: {
                id: true,
                metamobPseudo: true,
                metamobQuestSlug: true,
                metamobApiKey: true,
            },
        });

        if (!profile?.metamobPseudo) {
            return { success: false, error: "Compte Metamob non lié" };
        }

        // [RateLimit] Prevent abuse (1 refresh per minute)
        const rateCheck = await rateLimit(`ocre:refresh:${user.id!}`, 1, 60);
        if (!rateCheck.success) {
            return { success: false, error: "Veuillez attendre une minute avant de rafraîchir à nouveau." };
        }

        // 1. Clear internal memory cache
        clearCache(profile.metamobPseudo.toLowerCase());

        // 2. Fetch fresh data from Metamob API to verify it works (and detect quest changes)
        // We force skipCache: true
        const effectiveKey = profile.metamobApiKey;

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
                const quests = await listSelfQuests(profile.metamobPseudo, effectiveKey, { skipCache: true });
                const best = quests.find(matchesOcreQuest) ?? quests[0];
                if (best && best.slug !== profile.metamobQuestSlug) {
                    await db.userProfile.update({
                        where: { id: profile.id },
                        data: {
                            metamobQuestSlug: best.slug,
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

        // Force clear Redis progress cache
        await invalidateCache(`ocre:progress:${guildId}:${effectiveUserId}`);

        return { success: true, data: { questUpdated } };

    } catch (error) {
        // console.error("[forceRefreshOcre] Error:", error);
        return { success: false, error: "Erreur lors de la synchronisation" };
    }
}

// -----------------------------------------------------------------------------
// MULTI-QUEST SUPPORT
// -----------------------------------------------------------------------------

export async function getAvailableOcreQuests(guildId: string, targetUserId?: string): Promise<ActionResponse<UserQuest[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        // DB / RBAC Check
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : session.user.id;

        const profile = await db.userProfile.findFirst({
            where: {
                userId: effectiveUserId,
                guild: { discordGuildId: guildId },
            },
            select: { metamobPseudo: true, metamobApiKey: true }
        });

        if (!profile?.metamobPseudo) return { success: false, error: "Compte non lié" };

        const effectiveKey = profile.metamobApiKey || undefined;

        // Always skip cache to get latest list (privées incluses via sa clé)
        const quests = await listSelfQuests(profile.metamobPseudo, effectiveKey, { skipCache: true });

        return { success: true, data: quests };
    } catch (error) {
        // console.error("[getAvailableOcreQuests] Error:", error);
        return { success: false, error: "Impossible de récupérer la liste des quêtes" };
    }
}

export async function switchOcreQuest(guildId: string, questSlug: string, targetUserId?: string): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        // DB / RBAC Check
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : session.user.id;

        const member = await db.userProfile.findFirst({
            where: {
                userId: effectiveUserId,
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: { id: true, metamobPseudo: true, metamobQuestSlug: true, metamobApiKey: true },
        });

        if (!member) return { success: false, error: "Profil introuvable" };
        if (!member.metamobPseudo) return { success: false, error: "Compte Metamob non lié" };

        const effectiveKey = member.metamobApiKey || undefined;

        // Verify the quest exists and belongs to user (privées incluses via sa clé)
        const quests = await listSelfQuests(member.metamobPseudo, effectiveKey, { skipCache: true });

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

        // Force clear Redis progress cache
        await invalidateCache(`ocre:progress:${guildId}:${effectiveUserId}`);

        return { success: true };

    } catch (error) {
        logger.error("[switchOcreQuest] Error:", error);
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
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.SYSTEM_CONFIG);
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
            }
        });

        clearCache(targetPseudo.toLowerCase());

        // Revalidate admin page and potential user page
        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        revalidatePath(`/dashboard/${guildId}/members`);

        return { success: true, data: undefined };

    } catch (error) {
        logger.error("Error in adminForceUnlink:", error);
        return { success: false, error: "Erreur serveur interne" };
    }
}

/**
 * ADMIN: Search for linked Metamob pseudos in the guild for the unlocker tool.
 */
export async function searchMetamobPseudos(
    guildId: string,
    query: string
): Promise<ActionResponse<string[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.SYSTEM_CONFIG);
        if (!guard.allowed) return { success: false, error: "Accès refusé" };

        if (query.length < 2) return { success: true, data: [] };

        const profiles = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId: guildId },
                metamobPseudo: { contains: query, mode: "insensitive" },
                status: "ACTIVE"
            },
            select: { metamobPseudo: true },
            take: 10
        });

        const pseudos = profiles
            .map(p => p.metamobPseudo)
            .filter((p): p is string => !!p);

        return { success: true, data: pseudos };
    } catch (error) {
        logger.error("Error searching Metamob pseudos:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// =============================================================================
// OCRE TRADE REQUESTS (ASYNCHRONOUS)
// =============================================================================

const CreateTradeSchema = z.object({
    guildId: z.string(),
    targetProfileId: z.string(),
    monsterId: z.number(),
    monsterName: z.string().optional(),
    monsterImage: z.string().optional(),
    monsterStep: z.number().optional(),
    offeredMonsterId: z.number().optional(),
    offeredMonsterName: z.string().optional(),
    offeredMonsterImage: z.string().optional(),
    offeredMonsterStep: z.number().optional(),
    message: z.string().max(500).optional(),
    sendDiscordPing: z.boolean().optional(),
});

export async function createTradeRequest(
    rawData: z.infer<typeof CreateTradeSchema>
): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const parsed = CreateTradeSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const {
            guildId,
            targetProfileId,
            monsterId,
            monsterName: clientMonsterName,
            monsterImage: clientMonsterImage,
            monsterStep,
            offeredMonsterId,
            offeredMonsterName,
            offeredMonsterImage,
            offeredMonsterStep,
            message,
            sendDiscordPing
        } = parsed.data;

        const rateCheck = await rateLimit(`ocre:trade:create:${session.user.id}`, 10, 60);
        if (!rateCheck.success) return { success: false, error: "Veuillez patienter avant de faire une nouvelle demande." };

        const guildConfig = await (db.guildConfig as any).findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, ocreNotifyChannelId: true }
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const requesterProfile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guildId: guildConfig.id },
            include: { user: { include: { accounts: true } } }
        });

        if (!requesterProfile) return { success: false, error: "Profil introuvable" };

        const targetProfile = await db.userProfile.findUnique({
            where: { id: targetProfileId },
            include: { user: { include: { accounts: true } } }
        });

        if (!targetProfile || targetProfile.guildId !== guildConfig.id) {
            return { success: false, error: "Partenaire introuvable" };
        }

        if (requesterProfile.id === targetProfile.id) {
            return { success: false, error: "Vous ne pouvez pas échanger avec vous-même" };
        }

        // Unique par monstre : un seul trade en attente par monstre (toutes cibles confondues)
        const existingRequest = await (db as any).ocreTradeRequest.findFirst({
            where: {
                requesterId: requesterProfile.id,
                monsterId,
                status: "PENDING"
            }
        });

        if (existingRequest) {
            return { success: false, error: "Tu as déjà une demande en attente pour ce monstre" };
        }

        // Anti-spam: max 3 demandes en attente simultanées (monstres différents)
        const pendingCount = await (db as any).ocreTradeRequest.count({
            where: {
                requesterId: requesterProfile.id,
                status: "PENDING"
            }
        });

        if (pendingCount >= 3) {
            return { success: false, error: "Tu as déjà 3 demandes en attente. Attends une réponse avant d'en envoyer de nouvelles." };
        }

        const tradeRequest = await (db as any).ocreTradeRequest.create({
            data: {
                guildId: guildConfig.id,
                requesterId: requesterProfile.id,
                targetId: targetProfile.id,
                monsterId,
                monsterName: clientMonsterName || null,
                monsterImageUrl: clientMonsterImage || null,
                monsterStep: monsterStep || null,
                offeredMonsterId: offeredMonsterId || null,
                offeredMonsterName: offeredMonsterName || null,
                offeredMonsterImageUrl: offeredMonsterImage || null,
                offeredMonsterStep: offeredMonsterStep || null,
                message,
                status: "PENDING"
            }
        });

        const targetPrefs = (targetProfile.notificationPrefs as any) || {};
        const shouldNotifyOcre = targetPrefs.ocre !== false;

        if (shouldNotifyOcre) {
            const trocMsg = offeredMonsterName ? ` en échange de ${offeredMonsterName}` : "";
            // In-App Notification
            await (db.notification as any).create({
                data: {
                    userId: targetProfile.userId,
                    guildId: guildConfig.id,
                    type: "OCRE_TRADE_REQUEST",
                    title: "Demande d'Échange Ocre",
                    message: `${getDisplayName(requesterProfile)} souhaite vous échanger ${clientMonsterName || "un monstre"}${trocMsg} !`,
                    link: `/dashboard/${guildId}/quete-ocre`,
                }
            });
        }

        // Discord Ping if requested
        const targetDiscordAccount = targetProfile.user.accounts.find((a: any) => a.provider === "discord");
        const requesterDiscordAccount = requesterProfile.user.accounts?.find((a: any) => a.provider === "discord");
        
        if (sendDiscordPing && guildConfig.ocreNotifyChannelId && targetDiscordAccount) {
            try {
                const monsterName = clientMonsterName || `Monstre #${monsterId}`;
                const monsterImageUrl = clientMonsterImage || undefined;

                const { sendChannelMessage } = await import("@/server/discord");
                const publicUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
                const requesterName = getDisplayName(requesterProfile);
                
                const targetMention = `<@${targetDiscordAccount.providerAccountId}>`;
                const requesterMention = requesterDiscordAccount ? `<@${requesterDiscordAccount.providerAccountId}>` : "";
                const mentions = [requesterMention, targetMention].filter(Boolean).join(" ");

                const stepText = monsterStep ? ` (Étape ${monsterStep})` : "";
                const offeredText = offeredMonsterName
                    ? `${offeredMonsterName}${offeredMonsterStep ? ` (Étape ${offeredMonsterStep})` : ""}`
                    : "Don / Échange simple";

                await sendChannelMessage(
                    guildConfig.ocreNotifyChannelId,
                    mentions,
                    {
                        embedTitle: `🤝 Proposition d'Échange — ${monsterName}`,
                        embedColor: 0x10b981,
                        embedThumbnail: monsterImageUrl,
                        embedUrl: `${publicUrl}/dashboard/${guildId}/quete-ocre`,
                        fields: [
                            { name: "Demandeur", value: requesterName, inline: true },
                            { name: "Recherché", value: `${monsterName}${stepText}`, inline: true },
                            { name: "Proposé en contrepartie", value: offeredText, inline: false },
                            ...(message ? [{ name: "Message", value: `*${message}*`, inline: false }] : []),
                            { name: "Répondre", value: `[Ouvrir le Dashboard](${publicUrl}/dashboard/${guildId}/quete-ocre)`, inline: false },
                        ]
                    }
                );
            } catch (e) {
                logger.error("Failed to send Discord ping for Ocre trade:", e);
            }
        }

        revalidatePath(`/dashboard/${guildId}/quete-ocre`);
        
        // Trigger live update via socket for responsiveness
        try {
            const redis = (await import("@/lib/redis")).default;
            await redis.publish("ocre:trade:update", JSON.stringify({ guildId, type: "NEW_REQUEST", monsterId }));
        } catch (e) {
            logger.error("Failed to publish ocre trade update:", e);
        }

        return { success: true };
    } catch (error: any) {
        logger.error("[createTradeRequest] Detailed Error:", error);
        return { success: false, error: error?.message || "Erreur serveur interne" };
    }
}

const ActionTradeSchema = z.object({
    guildId: z.string(),
    requestId: z.string()
});

export async function rejectTradeRequest(rawData: z.infer<typeof ActionTradeSchema>): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const parsed = ActionTradeSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const { guildId, requestId } = parsed.data;

        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const tradeRequest = await (db as any).ocreTradeRequest.findUnique({
            where: { id: requestId },
            include: { target: true, requester: { include: { user: true } } }
        });

        if (!tradeRequest || tradeRequest.guildId !== guildConfig.id) return { success: false, error: "Demande introuvable" };
        if (tradeRequest.target.userId !== session.user.id) return { success: false, error: "Non autorisé" };

        await (db as any).ocreTradeRequest.update({
            where: { id: requestId },
            data: { status: "REJECTED" }
        });

        revalidatePath(`/dashboard/${guildId}/quete-ocre`);

        // Trigger live update via socket
        try {
            const redis = (await import("@/lib/redis")).default;
            await redis.publish("ocre:trade:update", JSON.stringify({ guildId, type: "REJECTED", requestId }));
        } catch (e) { }

        return { success: true };
    } catch (error) {
        logger.error("[rejectTradeRequest] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function cancelTradeRequest(rawData: z.infer<typeof ActionTradeSchema>): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const parsed = ActionTradeSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const { guildId, requestId } = parsed.data;

        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const tradeRequest = await (db as any).ocreTradeRequest.findUnique({
            where: { id: requestId },
            include: { requester: true }
        });

        if (!tradeRequest || tradeRequest.guildId !== guildConfig.id) return { success: false, error: "Demande introuvable" };
        if (tradeRequest.requester.userId !== session.user.id) return { success: false, error: "Non autorisé" };

        await (db as any).ocreTradeRequest.update({
            where: { id: requestId },
            data: { status: "CANCELED" }
        });

        revalidatePath(`/dashboard/${guildId}/quete-ocre`);

        // Trigger live update via socket
        try {
            const redis = (await import("@/lib/redis")).default;
            await redis.publish("ocre:trade:update", JSON.stringify({ guildId, type: "CANCELED", requestId }));
        } catch (e) { }

        return { success: true };
    } catch (error) {
        logger.error("[cancelTradeRequest] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function acceptTradeRequest(rawData: z.infer<typeof ActionTradeSchema>): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const parsed = ActionTradeSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const { guildId, requestId } = parsed.data;

        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const tradeRequest = await (db as any).ocreTradeRequest.findUnique({
            where: { id: requestId },
            include: { target: true, requester: true }
        });

        if (!tradeRequest || tradeRequest.guildId !== guildConfig.id) return { success: false, error: "Demande introuvable" };
        if (tradeRequest.target.userId !== session.user.id) return { success: false, error: "Non autorisé" };
        if (tradeRequest.status !== "PENDING") return { success: false, error: "Demande déjà traitée" };

        // Mark as Accepted
        await (db as any).ocreTradeRequest.update({
            where: { id: requestId },
            data: { status: "ACCEPTED" }
        });

        // Notify Requester
        await (db.notification as any).create({
            data: {
                userId: tradeRequest.requester.userId,
                guildId: guildConfig.id,
                type: "OCRE_TRADE_ACCEPTED",
                title: "Échange Accepté",
                message: `${tradeRequest.target.discordNickname || tradeRequest.target.metamobPseudo || "Un membre"} a accepté votre échange pour ${tradeRequest.monsterName || "un archimonstre"} !`,
                link: `/dashboard/${guildId}/quete-ocre`,
            }
        });

        // Metamob Auto-Update (#180 : transfert strictement unitaire et bilatéral si contrepartie)
        try {
            const { getQuestDetails, normalizeQuestMonster, updateMonsterQuantity } = await import("@/lib/metamob-client");

            const readOwned = async (pseudo: string, slug: string, apiKey: string, mId: number): Promise<number | null> => {
                if (!pseudo || !slug || !apiKey) return null;
                try {
                    const details = await getQuestDetails(pseudo, slug, { guildApiKey: apiKey, limit: 500 });
                    const m = details.monsters.find((mm) => (mm as any).id === mId);
                    if (!m) return null;
                    return normalizeQuestMonster(m, details.parallel_quests).owned;
                } catch {
                    return null;
                }
            };

            const reqKey = tradeRequest.requester.metamobApiKey ? decrypt(tradeRequest.requester.metamobApiKey as string) || "" : "";
            const tgtKey = tradeRequest.target.metamobApiKey ? decrypt(tradeRequest.target.metamobApiKey as string) || "" : "";

            // 1. Monstre demandé (tradeRequest.monsterId) :
            // Target donne (-1, borné à 0), Requester reçoit (+1)
            if (tradeRequest.target.metamobQuestSlug && tgtKey) {
                const tgtOwned = await readOwned(tradeRequest.target.metamobPseudo as string, tradeRequest.target.metamobQuestSlug, tgtKey, tradeRequest.monsterId);
                if (tgtOwned !== null && tgtOwned > 0) {
                    await updateMonsterQuantity(
                        tradeRequest.target.metamobPseudo,
                        tradeRequest.target.metamobQuestSlug,
                        tradeRequest.monsterId,
                        Math.max(0, tgtOwned - 1),
                        { guildApiKey: tgtKey }
                    );
                }
            }

            if (tradeRequest.requester.metamobQuestSlug && reqKey) {
                const reqOwned = await readOwned(tradeRequest.requester.metamobPseudo as string, tradeRequest.requester.metamobQuestSlug, reqKey, tradeRequest.monsterId);
                if (reqOwned !== null) {
                    await updateMonsterQuantity(
                        tradeRequest.requester.metamobPseudo,
                        tradeRequest.requester.metamobQuestSlug,
                        tradeRequest.monsterId,
                        reqOwned + 1,
                        { guildApiKey: reqKey }
                    );
                }
            }

            // 2. Monstre offert en contrepartie (si troc bilatéral) :
            // Requester donne (-1, borné à 0), Target reçoit (+1)
            if (tradeRequest.offeredMonsterId) {
                const offId = tradeRequest.offeredMonsterId;

                if (tradeRequest.requester.metamobQuestSlug && reqKey) {
                    const reqOffOwned = await readOwned(tradeRequest.requester.metamobPseudo as string, tradeRequest.requester.metamobQuestSlug, reqKey, offId);
                    if (reqOffOwned !== null && reqOffOwned > 0) {
                        await updateMonsterQuantity(
                            tradeRequest.requester.metamobPseudo,
                            tradeRequest.requester.metamobQuestSlug,
                            offId,
                            Math.max(0, reqOffOwned - 1),
                            { guildApiKey: reqKey }
                        );
                    }
                }

                if (tradeRequest.target.metamobQuestSlug && tgtKey) {
                    const tgtOffOwned = await readOwned(tradeRequest.target.metamobPseudo as string, tradeRequest.target.metamobQuestSlug, tgtKey, offId);
                    if (tgtOffOwned !== null) {
                        await updateMonsterQuantity(
                            tradeRequest.target.metamobPseudo,
                            tradeRequest.target.metamobQuestSlug,
                            offId,
                            tgtOffOwned + 1,
                            { guildApiKey: tgtKey }
                        );
                    }
                }
            }
        } catch (syncError) {
            logger.error("[acceptTradeRequest] Auto-sync to Metamob failed:", syncError);
        }

        revalidatePath(`/dashboard/${guildId}/quete-ocre`);

        // Trigger live update via socket
        try {
            const redis = (await import("@/lib/redis")).default;
            await redis.publish("ocre:trade:update", JSON.stringify({ guildId, type: "ACCEPTED", requestId }));
        } catch (e) { }

        return { success: true };
    } catch (error) {
        logger.error("[acceptTradeRequest] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Direct single monster quantity update in Metamob
 */
export async function updateUserMonsterQuantityAction(rawData: {
    guildId: string;
    monsterId: number;
    quantity: number;
}): Promise<ActionResponse<{ quantity: number }>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const { guildId, monsterId, quantity } = rawData;
        if (typeof monsterId !== "number" || typeof quantity !== "number" || quantity < 0) {
            return { success: false, error: "Quantité invalide" };
        }

        const profile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guild: { discordGuildId: guildId }, status: "ACTIVE" },
            select: { metamobApiKey: true, metamobQuestSlug: true, metamobPseudo: true }
        });

        if (!profile?.metamobApiKey || !profile.metamobQuestSlug) {
            return { success: false, error: "Compte Metamob non lié ou clé API manquante" };
        }

        const { updateMonsterQuantity } = await import("@/lib/metamob-client");
        const effectiveApiKey = decrypt(profile.metamobApiKey as string) || "";
        
        await updateMonsterQuantity(
            profile.metamobPseudo as string,
            profile.metamobQuestSlug as string,
            monsterId,
            quantity,
            { guildApiKey: effectiveApiKey }
        );

        await invalidateCache(`ocre:progress:${guildId}:${session.user.id}`);
        revalidatePath(`/dashboard/${guildId}/quete-ocre`);
        revalidatePath(`/dashboard/${guildId}/quetes-dofus`);

        return { success: true, data: { quantity } };
    } catch (error: any) {
        logger.error("[updateUserMonsterQuantityAction] Error:", error);
        return { success: false, error: error?.message || "Erreur lors de la mise à jour Metamob" };
    }
}

/**
 * Get available duplicates for troc trade selector
 */
export async function getTradeAvailableDuplicatesAction(guildId: string): Promise<ActionResponse<{ id: number; name: string; step: number; imageUrl?: string; count: number }[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const profile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guild: { discordGuildId: guildId }, status: "ACTIVE" },
            select: { metamobApiKey: true, metamobQuestSlug: true, metamobPseudo: true }
        });

        if (!profile?.metamobPseudo || !profile.metamobQuestSlug) {
            return { success: true, data: [] };
        }

        const effectiveApiKey = profile.metamobApiKey ? (decrypt(profile.metamobApiKey as string) || undefined) : undefined;
        // Résolveur self : public d'abord, repli privé (quête privée invisible à l'ancienne route).
        const { getSelfQuestDetails, normalizeQuestMonster } = await import("@/lib/metamob-client");
        const details = await getSelfQuestDetails(profile.metamobPseudo, profile.metamobQuestSlug, effectiveApiKey, { limit: 500 });

        const duplicates = details.monsters
            .map(m => normalizeQuestMonster(m, details.parallel_quests))
            .filter(m => m.state === "DOUBLON" && m.owned > 1 && m.type === "archimonstre")
            .map(m => ({
                id: m.id,
                name: m.nameFr,
                step: m.step,
                imageUrl: m.image,
                count: m.owned - details.parallel_quests,
            }))
            .sort((a, b) => a.step - b.step || a.name.localeCompare(b.name));

        return { success: true, data: duplicates };
    } catch (error: any) {
        logger.error("[getTradeAvailableDuplicatesAction] Error:", error);
        return { success: false, error: error?.message || "Erreur récupération doublons" };
    }
}

/**
 * Liste les trades Ocre de TOUTE la guilde (PENDING + ACCEPTED), pour la modale HD
 * de la carte du monde. N'utilise aucune donnée perso (pas d'auth utilisateur requise).
 * Filtre optionnel par zone/subarea pour cibler le contenu affiché.
 */
export async function getGuildOcreTrades(
    guildId: string,
    filters?: { subAreaName?: string | null }
): Promise<ActionResponse<Array<{
    id: string;
    monsterId: number;
    monsterName: string | null;
    monsterImageUrl: string | null;
    status: string;
    message: string | null;
    zone: string | null;
    requesterName: string | null;
    targetName: string | null;
}>>> {
    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const trades = await (db as any).ocreTradeRequest.findMany({
            where: {
                guildId: guildConfig.id,
                status: { in: ["PENDING", "ACCEPTED"] },
            },
            include: {
                requester: { select: { discordNickname: true, pseudoDofus: true, metamobPseudo: true, user: { select: { name: true } } } },
                target: { select: { discordNickname: true, pseudoDofus: true, metamobPseudo: true, user: { select: { name: true } } } },
            },
            orderBy: { createdAt: "desc" },
            take: 30,
        });

        const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const zoneFilter = filters?.subAreaName ? normalize(filters.subAreaName) : null;

        // Jointure locale : résoudre la zone d'un trade via la table Archimonstre (dofusdbId)
        const monsterIds = trades.map((t: any) => t.monsterId).filter((id: any) => typeof id === "number");
        const localMonsters = monsterIds.length > 0
            ? await db.archimonstre.findMany({ where: { dofusdbId: { in: monsterIds } }, select: { dofusdbId: true, zone: true, name: true } })
            : [];
        const zoneByMonsterId = new Map<number, { zone: string | null; name: string | null }>();
        for (const m of localMonsters) {
            if (m.dofusdbId != null) zoneByMonsterId.set(m.dofusdbId, { zone: m.zone, name: m.name });
        }

        const result = trades
            .map((t: any) => {
                const local = t.monsterId != null ? zoneByMonsterId.get(t.monsterId) : undefined;
                const zone = t.zone || local?.zone || null;
                const monsterName = t.monsterName || local?.name || `Monstre #${t.monsterId}`;
                return {
                    id: t.id,
                    monsterId: t.monsterId,
                    monsterName,
                    monsterImageUrl: t.monsterImageUrl || null,
                    status: t.status,
                    message: t.message || null,
                    zone,
                    requesterName: t.requester.discordNickname || t.requester.pseudoDofus || t.requester.metamobPseudo || t.requester.user?.name || "Membre",
                    targetName: t.target.discordNickname || t.target.pseudoDofus || t.target.metamobPseudo || t.target.user?.name || "Membre",
                };
            })
            // Filtre zone : si un filtre est actif, on garde les trades dont la zone matche
            // (partiel) OU les trades sans zone résolue (affichage "Zone inconnue")
            .filter((t: any) => {
                if (!zoneFilter) return true;
                if (!t.zone) return false; // on filtre les trades sans zone en mode ciblé
                return normalize(t.zone).includes(zoneFilter) || zoneFilter.includes(normalize(t.zone));
            })
            .slice(0, 20);

        return { success: true, data: result };
    } catch (error) {
        logger.error("[getGuildOcreTrades] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function getPendingTradeRequests(guildId: string): Promise<ActionResponse<any>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const userProfile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guildId: guildConfig.id, status: "ACTIVE" }
        });

        if (!userProfile) return { success: false, error: "Profil introuvable" };

        const incomingRaw = await (db as any).ocreTradeRequest.findMany({
            where: { targetId: userProfile.id, status: "PENDING" },
            include: { requester: { select: { discordNickname: true, metamobPseudo: true, user: { select: { name: true, image: true } } } } },
            orderBy: { createdAt: "desc" }
        });

        const outgoingRaw = await (db as any).ocreTradeRequest.findMany({
            where: { requesterId: userProfile.id, status: "PENDING" },
            include: { target: { select: { discordNickname: true, metamobPseudo: true, user: { select: { name: true, image: true } } } } },
            orderBy: { createdAt: "desc" }
        });

        const { getMonster } = await import("@/lib/metamob-client");
        const enrichRequests = async (reqs: any[]) => {
            return Promise.all(reqs.map(async (req) => {
                // Determine if we need to fetch info
                const isPlaceholder = !req.monsterName || req.monsterName.includes("#");
                const hasImage = !!req.monsterImageUrl;

                // Return immediately if enrichment already happened accurately
                if (!isPlaceholder && hasImage) {
                    return req;
                }

                let monsterName = req.monsterName || `Monstre #${req.monsterId}`;
                let monsterImageUrl = req.monsterImageUrl || "";
                
                try {
                    const m = await getMonster(req.monsterId);
                    if (m && m.name) {
                        monsterName = m.name.fr || m.name.en || monsterName;
                        monsterImageUrl = m.image ? (m.image.startsWith('http') ? m.image : `https://www.metamob.fr/img/monsters/${m.image}`) : monsterImageUrl;
                        
                        // Background update: fill missing info in DB to avoid future API calls
                        (db as any).ocreTradeRequest.update({
                            where: { id: req.id },
                            data: { monsterName, monsterImageUrl }
                        }).catch(() => {}); // Fire and forget
                    }
                } catch (e) {
                    logger.error(`[getPendingTradeRequests] Failed to enrich monster ${req.monsterId}:`, e);
                }

                return { ...req, monsterName, monsterImageUrl };
            }));
        };

        const [incoming, outgoing] = await Promise.all([
            enrichRequests(incomingRaw),
            enrichRequests(outgoingRaw)
        ]);

        return { success: true, data: { incoming, outgoing } };
    } catch (error) {
        logger.error("[getPendingTradeRequests] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/** Get archmonsters for a specific zone from SigilOS database, enriched with Metamob progress if linked */
export async function getZoneArchmonsters(guildId?: string | null, zoneName?: string, subAreaId?: number): Promise<ActionResponse<OcreMonster[]>> {
    try {
        if (!zoneName) return { success: true, data: [] };
        const norm = (s: string | null | undefined) =>
            (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

        const zNorm = norm(zoneName);

        // 1. Récupérer tous les archimonstres de la table locale db.archimonstre
        const dbArchis = await db.archimonstre.findMany({
            where: { type: "archimonstre" }
        });

        // 2. Filtrer les archimonstres de la zone
        //
        // RÈGLE DE PRIORITÉ :
        //   A) Si subAreaId fourni → filtre STRICT sur subareaIds[] uniquement.
        //      Un archi avec subareaIds vide est ignoré (pas de données de zone précises).
        //   B) Si pas de subAreaId → fallback texte EXACT sur zone/subzone.
        //      On n'utilise PAS de matching partiel pour éviter "Cimetière" → "Cimetière de Grobe".
        const matchedDbArchis = dbArchis.filter(a => {
            const hasSubareaData = Array.isArray(a.subareaIds) && (a.subareaIds as number[]).length > 0;

            if (subAreaId) {
                // Cas A : subAreaId disponible → matching strict uniquement
                if (!hasSubareaData) return false; // Pas de données de zone précises pour cet archi
                return (a.subareaIds as number[]).includes(subAreaId);
            }

            // Cas B : pas de subAreaId → fallback texte EXACT (pas de contains partiel)
            const aZone = norm(a.zone);
            const aSubzone = norm(a.subzone);
            return aZone === zNorm || aSubzone === zNorm;
        });


        // 3. Tenter d'enrichir avec la progression Metamob si le membre a lié son compte
        const metamobProgressMap = new Map<string, OcreMonster>();
        if (guildId) {
            try {
                const progressRes = await getMyOcreProgress(guildId);
                if (progressRes.success && progressRes.data?.monsters) {
                    progressRes.data.monsters.forEach(m => {
                        metamobProgressMap.set(norm(m.name), m);
                    });
                }
            } catch {
                // Non bloquant : si Metamob est non lié ou en panne, on continue avec les archis du jeu
            }
        }

        // 4. Construire la liste enrichie
        const result: OcreMonster[] = matchedDbArchis.map(a => {
            const metamobData = metamobProgressMap.get(norm(a.name));
            return {
                id: a.dofusdbId || (metamobData ? metamobData.id : 0),
                name: a.name,
                nameFr: a.name,
                nameEn: a.name,
                image: a.imageUrl || (metamobData ? metamobData.image : ""),
                levelMin: a.level || (metamobData ? metamobData.levelMin : 0),
                levelMax: a.level || (metamobData ? metamobData.levelMax : 0),
                type: "archimonstre",
                typeId: 0,
                step: metamobData ? metamobData.step : 1,
                owned: metamobData ? metamobData.owned : 0,
                status: metamobData ? metamobData.status : 0,
                state: metamobData ? metamobData.state : "MANQUANT",
                zone: a.zone || undefined,
                subzone: a.subzone || undefined,
                trade_offer: metamobData ? metamobData.trade_offer : null,
                trade_want: metamobData ? metamobData.trade_want : null,
            };
        });

        // 5. Tri : Manquants en premier, puis alphabétique
        const sorted = result.sort((a, b) => {
            if (a.state === "MANQUANT" && b.state !== "MANQUANT") return -1;
            if (a.state !== "MANQUANT" && b.state === "MANQUANT") return 1;
            return a.name.localeCompare(b.name);
        });

        return { success: true, data: sorted };
    } catch (error) {
        logger.error("[getZoneArchmonsters] Error:", error);
        return { success: false, error: "Erreur lors du filtrage des archimonstres" };
    }
}

// -----------------------------------------------------------------------------
// EXPERT ACTIONS: SETTINGS & BULK UPDATES
// -----------------------------------------------------------------------------

/**
 * Update global quest settings (parallel quests, trade mode, thresholds, filters).
 */
export async function updateOcreSettingsAction(
    rawData: z.infer<typeof UpdateSettingsSchema>
): Promise<ActionResponse<QuestSettings>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const parsed = UpdateSettingsSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const { guildId, settings } = parsed.data;

        const profile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guild: { discordGuildId: guildId }, status: "ACTIVE" },
            select: { id: true, metamobApiKey: true, metamobQuestSlug: true }
        });

        if (!profile?.metamobApiKey || !profile.metamobQuestSlug) {
            return { success: false, error: "Compte Metamob non lié ou clé API manquante" };
        }

        const effectiveApiKey = decrypt(profile.metamobApiKey as string) || "";
        const result = await updateQuestSettings(profile.metamobQuestSlug as string, settings, { guildApiKey: effectiveApiKey });

        // Invalidate local caches to reflect changes (especially parallel_quests)
        await invalidateCache(`ocre:progress:${guildId}:${session.user.id}`);
        revalidatePath(`/dashboard/${guildId}/quete-ocre`);

        return { success: true, data: result };
    } catch (error: any) {
        logger.error("[updateOcreSettingsAction] Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour des paramètres. Réessaie." };
    }
}

/**
 * Update specific trade parameters for a monster (manual override).
 */
export async function updateMonsterTradeParamsAction(
    rawData: z.infer<typeof UpdateTradeParamsSchema>
): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const parsed = UpdateTradeParamsSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const { guildId, monsterId, params } = parsed.data;

        const profile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guild: { discordGuildId: guildId }, status: "ACTIVE" },
            select: { metamobApiKey: true, metamobQuestSlug: true }
        });

        if (!profile?.metamobApiKey || !profile.metamobQuestSlug) {
            return { success: false, error: "Compte non lié" };
        }

        const effectiveApiKey = decrypt(profile.metamobApiKey as string) || "";
        await updateMonsterTradeParams(profile.metamobQuestSlug as string, monsterId, params, { guildApiKey: effectiveApiKey });

        // Partial cache invalidation is hard, so we just clear progress
        await invalidateCache(`ocre:progress:${guildId}:${session.user.id}`);

        return { success: true };
    } catch (error: any) {
        logger.error("[updateMonsterTradeParamsAction] Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour du trade. Réessaie." };
    }
}

/**
 * Bulk update quantities for multiple monsters.
 */
export async function bulkUpdateMonsterQuantitiesAction(
    rawData: z.infer<typeof BulkUpdateQuantitiesSchema>
): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const parsed = BulkUpdateQuantitiesSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const { guildId, monsters } = parsed.data;

        const profile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guild: { discordGuildId: guildId }, status: "ACTIVE" },
            select: { metamobApiKey: true, metamobQuestSlug: true }
        });

        if (!profile?.metamobApiKey || !profile.metamobQuestSlug) {
            return { success: false, error: "Compte non lié" };
        }

        const effectiveApiKey = decrypt(profile.metamobApiKey as string) || "";
        await bulkUpdateMonsters(profile.metamobQuestSlug as string, monsters, { guildApiKey: effectiveApiKey });

        // Clear progress cache
        await invalidateCache(`ocre:progress:${guildId}:${session.user.id}`);
        revalidatePath(`/dashboard/${guildId}/quete-ocre`);

        return { success: true };
    } catch (error: any) {
        logger.error("[bulkUpdateMonsterQuantitiesAction] Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour groupée. Réessaie." };
    }
}

/**
 * Get public config for Ocre (e.g., trade channel id) for UI components
 */
export async function getOcrePublicConfig(guildId: string) {
    try {
        const ctx = await getUserContext(guildId);
        if (!ctx.isAuthenticated) return { success: false, error: "Non autorisé" };

        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { ocreNotifyChannelId: true }
        });

        if (!config) return { success: false, error: "Guilde introuvable" };
        
        return { success: true, data: config };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export interface MetamobDirectoryMember {
    id: string;
    pseudoDofus: string | null;
    metamobPseudo: string | null;
    metamobVerified: boolean;
    metamobLastSync: Date | null;
    metamobQuestSlug: string | null;
    user: {
        id: string;
        name: string | null;
        image: string | null;
    };
    progressPercent?: number;
    currentStep?: number;
    serverName?: string;
    remainingCount?: number;
}

/**
 * Get all active guild members and their Metamob linking and ocre progress status.
 */
export async function getGuildMetamobDirectory(
    guildId: string
): Promise<ActionResponse<MetamobDirectoryMember[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
        if (!guard.allowed) return { success: false, error: "Accès non autorisé" };

        const members = await db.userProfile.findMany({
            where: {
                guild: { discordGuildId: guildId },
                status: "ACTIVE",
            },
            select: {
                id: true,
                pseudoDofus: true,
                metamobPseudo: true,
                metamobVerified: true,
                metamobLastSync: true,
                metamobQuestSlug: true,
                ocreProgressSnapshot: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    }
                }
            },
            orderBy: {
                user: {
                    name: "asc"
                }
            }
        });

        const directory: MetamobDirectoryMember[] = members.map(m => {
            const snapshot = m.ocreProgressSnapshot as any;
            const hasSnapshot = !!snapshot?.stats;

            return {
                id: m.id,
                pseudoDofus: m.pseudoDofus,
                metamobPseudo: m.metamobPseudo,
                metamobVerified: m.metamobVerified,
                metamobLastSync: m.metamobLastSync,
                metamobQuestSlug: m.metamobQuestSlug,
                user: {
                    id: m.user.id,
                    name: getDisplayName(m),
                    image: m.user.image,
                },
                progressPercent: hasSnapshot ? snapshot.stats.progressPercent : undefined,
                currentStep: hasSnapshot ? snapshot.questInfo?.currentStep : undefined,
                serverName: hasSnapshot ? snapshot.questInfo?.serverName : undefined,
                remainingCount: hasSnapshot ? snapshot.stats.remaining : undefined,
            };
        });

        return { success: true, data: directory };
    } catch (error: any) {
        logger.error("[getGuildMetamobDirectory] Error:", error);
        return { success: false, error: "Impossible de récupérer l'annuaire Metamob. Réessaie." };
    }
}

// -----------------------------------------------------------------------------
// TRADE CENTER (T1) — threads unifiés : requêtes internes + conversations
// Metamob (proposals, lecture seule) + partenaires suggérés.
// Règles : même quest_type + même serveur uniquement (échanges inter-types
// impossibles côté Metamob) ; écriture = clé PERSO, jamais la clé guilde.
// -----------------------------------------------------------------------------

export interface TradeThreadMonster {
    monsterId: number;
    name: string;
    imageUrl: string;
    step?: number | null;
    levelMin?: number | null;
    levelMax?: number | null;
    owned?: number | null;
    needed?: number | null;
    quantity: number;
    coversNeed: boolean;
}

export interface TradeThread {
    id: string; // "int:<requestId>" | "mm:<username>" | "sg:<username>:<slug>"
    source: "internal" | "metamob" | "suggested";
    direction: "incoming" | "outgoing" | "unknown";
    partnerPseudo: string | null;
    partnerAvatarUrl: string | null;
    serverId: number | null;
    questType: string | null; // "ocre" | "dokille" | null
    status: string; // interne: PENDING | metamob: pending|half_applied|completed|cancelled|active | suggéré: suggested
    message?: string | null;
    messageCount?: number | null;
    given: TradeThreadMonster[];
    received: TradeThreadMonster[];
    createdAt: string;
    deepLink?: string | null;
}

const GetTradeThreadsSchema = z.object({
    guildId: z.string().min(1),
    filter: z.enum(["all", "incoming", "outgoing", "suggested"]).optional(),
    limit: z.number().int().min(1).max(20).optional(),
});

const metamobMonsterImage = (image?: string | null): string =>
    image ? (image.startsWith("http") ? image : `https://www.metamob.fr/img/monsters/${image}`) : "";

async function enrichProposalMonsters(
    items: { monster_id: number; quantity: number }[],
    covers: Map<number, { needed: number; coversNeed: boolean }>
): Promise<TradeThreadMonster[]> {
    return Promise.all(items.map(async (it) => {
        const c = covers.get(it.monster_id);
        try {
            const m = await getMonster(it.monster_id);
            return {
                monsterId: it.monster_id,
                name: m?.name?.fr || m?.name?.en || `Monstre #${it.monster_id}`,
                imageUrl: metamobMonsterImage(m?.image),
                levelMin: m?.level_min ?? null,
                levelMax: m?.level_max ?? null,
                needed: c?.needed ?? null,
                quantity: it.quantity,
                coversNeed: c?.coversNeed ?? false,
            };
        } catch {
            return {
                monsterId: it.monster_id,
                name: `Monstre #${it.monster_id}`,
                imageUrl: "",
                needed: c?.needed ?? null,
                quantity: it.quantity,
                coversNeed: c?.coversNeed ?? false,
            };
        }
    }));
}

export async function getTradeThreads(rawData: z.infer<typeof GetTradeThreadsSchema>): Promise<ActionResponse<{ threads: TradeThread[]; hasMetamob: boolean }>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const rateCheck = await rateLimit(`ocre:threads:${session.user.id}`, 20, 60);
        if (!rateCheck.success) return { success: false, error: "Trop de requêtes. Réessayez dans quelques secondes." };

        const parsed = GetTradeThreadsSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const { guildId, filter = "all", limit = 20 } = parsed.data;

        const ctx = await getUserContext(guildId);
        if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

        const profile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guild: { discordGuildId: guildId }, status: "ACTIVE" },
            select: { id: true, metamobPseudo: true, metamobApiKey: true, metamobQuestSlug: true, metamobServerId: true },
        });
        if (!profile) return { success: false, error: "Profil introuvable" };

        const threads: TradeThread[] = [];
        const myPseudo = profile.metamobPseudo?.toLowerCase() ?? null;
        const hasKey = !!profile.metamobApiKey;
        const apiKey = hasKey ? (decrypt(profile.metamobApiKey as string) || "") : "";

        // ── 1. Requêtes internes (temps réel via socket existant) ──
        try {
            const pending = await getPendingTradeRequests(guildId);
            const incoming = (pending.success && pending.data?.incoming) || [];
            const outgoing = (pending.success && pending.data?.outgoing) || [];
            const toThread = (req: any, direction: "incoming" | "outgoing"): TradeThread => {
                const partner = direction === "incoming" ? req.requester : req.target;
                // Vue cible (reçue) : je DONNE le monstre recherché, je REÇOIS la contrepartie.
                // Vue demandeur (envoyée) : inverse.
                const wanted = { monsterId: req.monsterId, name: req.monsterName || `Monstre #${req.monsterId}`, imageUrl: req.monsterImageUrl || "", step: req.monsterStep ?? null, quantity: 1, coversNeed: false };
                const offered = req.offeredMonsterId
                    ? { monsterId: req.offeredMonsterId, name: req.offeredMonsterName || `Monstre #${req.offeredMonsterId}`, imageUrl: req.offeredMonsterImageUrl || "", step: req.offeredMonsterStep ?? null, quantity: 1, coversNeed: false }
                    : null;
                return {
                    id: `int:${req.id}`,
                    source: "internal",
                    direction,
                    partnerPseudo: partner?.metamobPseudo || partner?.discordNickname || partner?.user?.name || null,
                    partnerAvatarUrl: partner?.user?.image || null,
                    serverId: profile.metamobServerId ?? null,
                    questType: "ocre",
                    status: req.status || "PENDING",
                    message: req.message || null,
                    given: direction === "incoming" ? [wanted] : (offered ? [offered] : []),
                    received: direction === "incoming" ? (offered ? [offered] : []) : [wanted],
                    createdAt: req.createdAt instanceof Date ? req.createdAt.toISOString() : String(req.createdAt),
                    deepLink: null,
                };
            };
            incoming.forEach((r: any) => threads.push(toThread(r, "incoming")));
            outgoing.forEach((r: any) => threads.push(toThread(r, "outgoing")));
        } catch (e) {
            logger.warn("[getTradeThreads] Requêtes internes indisponibles:", e);
        }

        // ── 2. Conversations Metamob (résumés ; détail chargé à l'ouverture) ──
        if (apiKey) {
            try {
                const { redis } = await import("@/lib/redis");
                let ignored: string[] = [];
                try {
                    ignored = await redis.smembers(`ocre:ignored-mm:${session.user.id}`);
                } catch { /* Redis down → on n'ignore rien (fail-open local bénin) */ }
                const convs = await getConversations(apiKey, { status: "active", limit: 20 });
                for (const c of convs.conversations) {
                    if (!c.username || ignored.includes(c.username.toLowerCase())) continue;
                    threads.push({
                        id: `mm:${c.username}`,
                        source: "metamob",
                        direction: "unknown",
                        partnerPseudo: c.username,
                        partnerAvatarUrl: null,
                        serverId: null,
                        questType: null,
                        status: "active",
                        messageCount: c.message_count,
                        given: [],
                        received: [],
                        createdAt: c.last_message_at,
                        deepLink: `https://www.metamob.fr/profile/${encodeURIComponent(c.username)}`,
                    });
                }
            } catch (e) {
                // Clé invalide / 429 / down → on sert au moins l'interne (fail-closed partiel).
                logger.warn("[getTradeThreads] Conversations Metamob indisponibles:", e);
            }

            // ── 3. Partenaires suggérés (matches natifs, échange bilatéral) ──
            // Clé PERSO obligatoire : les matches ne fonctionnent que sur ses propres quêtes.
            if (profile.metamobQuestSlug) {
                try {
                    const { matches } = await getQuestMatches(profile.metamobQuestSlug, { guildApiKey: apiKey, limit: 8 });
                    for (const m of matches.slice(0, 8)) {
                        const given = (m.matches.you_have_they_want || []).slice(0, 3).map((x) => ({
                            monsterId: x.id,
                            name: x.name?.fr || `Monstre #${x.id}`,
                            imageUrl: "",
                            quantity: x.available,
                            needed: x.needed,
                            coversNeed: x.covers_need,
                        }));
                        const received = (m.matches.they_have_you_want || []).slice(0, 3).map((x) => ({
                            monsterId: x.id,
                            name: x.name?.fr || `Monstre #${x.id}`,
                            imageUrl: "",
                            quantity: x.available,
                            needed: x.needed,
                            coversNeed: x.covers_need,
                        }));
                        threads.push({
                            id: `sg:${m.user.username}:${m.quest.slug}`,
                            source: "suggested",
                            direction: "unknown",
                            partnerPseudo: m.user.username,
                            partnerAvatarUrl: null,
                            serverId: null,
                            questType: null,
                            status: "suggested",
                            given,
                            received,
                            createdAt: m.user.last_active || new Date(0).toISOString(),
                            deepLink: `https://www.metamob.fr/profile/${encodeURIComponent(m.user.username)}`,
                        });
                    }
                } catch (e) {
                    logger.warn("[getTradeThreads] Suggestions indisponibles:", e);
                }
            }
        }

        // Tri : action requise (entrants internes) → récence. Puis filtre + borne.
        const rank = (t: TradeThread) => (t.source === "internal" && t.direction === "incoming" ? 0 : t.source === "metamob" ? 1 : t.source === "internal" ? 2 : 3);
        threads.sort((a, b) => rank(a) - rank(b) || +new Date(b.createdAt) - +new Date(a.createdAt));
        const filtered = threads.filter((t) => {
            if (filter === "all") return true;
            if (filter === "suggested") return t.source === "suggested";
            return t.direction === filter;
        });

        return { success: true, data: { threads: filtered.slice(0, limit), hasMetamob: hasKey } };
    } catch (error) {
        logger.error("[getTradeThreads] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

const GetThreadDetailsSchema = z.object({
    guildId: z.string().min(1),
    threadId: z.string().min(1).max(120),
});

/** Détail d'un thread : interne (BDD) ou conversation Metamob (curseur, page 1). */
export async function getTradeThreadDetails(rawData: z.infer<typeof GetThreadDetailsSchema>): Promise<ActionResponse<TradeThread>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const parsed = GetThreadDetailsSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const { guildId, threadId } = parsed.data;

        const ctx = await getUserContext(guildId);
        if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };

        // ── Thread interne : resolu via la liste (même mapping, fail-closed) ──
        if (threadId.startsWith("int:")) {
            const all = await getTradeThreads({ guildId, filter: "all", limit: 20 });
            const found = all.success ? all.data?.threads.find((t) => t.id === threadId) : undefined;
            if (!found) return { success: false, error: "Demande introuvable" };
            return { success: true, data: found };
        }

        // ── Conversation Metamob ──
        if (!threadId.startsWith("mm:")) return { success: false, error: "Thread inconnu" };
        const username = threadId.slice(3);
        if (!username) return { success: false, error: "Thread inconnu" };

        const profile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guild: { discordGuildId: guildId }, status: "ACTIVE" },
            select: { metamobPseudo: true, metamobApiKey: true },
        });
        const apiKey = profile?.metamobApiKey ? (decrypt(profile.metamobApiKey as string) || "") : "";
        if (!apiKey) return { success: false, error: "Compte Metamob non lié" };
        const myPseudo = (profile?.metamobPseudo || "").toLowerCase();

        const details = await getConversationDetails(apiKey, username, { limit: 30 });
        const proposals = details.items.filter((i) => i.kind === "proposal");
        const latest = proposals[0];

        // Items fusionnés : dernière proposal (donnent/reçoivent de MON point de vue).
        let given: TradeThreadMonster[] = [];
        let received: TradeThreadMonster[] = [];
        let status = "active";
        let questType: string | null = null;
        let serverId: number | null = null;
        if (latest && latest.kind === "proposal") {
            status = latest.status;
            questType = latest.quest_type?.slug || null;
            serverId = latest.server_id ?? null;
            const mine = (latest.sender || "").toLowerCase() === myPseudo;
            // Les proposals n'exposent pas le besoin croisé (pas de covers_need) :
            // on affiche quantités + statuts, le badge « couvre le besoin » reste
            // réservé aux suggestions issues des matches.
            const emptyCovers = new Map<number, { needed: number; coversNeed: boolean }>();
            const [g, r] = await Promise.all([
                enrichProposalMonsters(mine ? latest.monsters_given : latest.monsters_received, emptyCovers),
                enrichProposalMonsters(mine ? latest.monsters_received : latest.monsters_given, emptyCovers),
            ]);
            given = g;
            received = r;
        }

        return {
            success: true,
            data: {
                id: threadId,
                source: "metamob",
                direction: latest ? ((latest.sender || "").toLowerCase() === myPseudo ? "outgoing" : "incoming") : "unknown",
                partnerPseudo: username,
                partnerAvatarUrl: null,
                serverId,
                questType,
                status,
                given,
                received,
                createdAt: latest?.created_at || new Date().toISOString(),
                deepLink: `https://www.metamob.fr/profile/${encodeURIComponent(username)}`,
            },
        };
    } catch (error) {
        if (error instanceof MetamobApiError) {
            if (error.code === "NOT_FOUND") return { success: false, error: "Conversation introuvable" };
            if (error.code === "UNAUTHORIZED") return { success: false, error: "Clé API invalide" };
            return { success: false, error: "Metamob.fr est temporairement indisponible." };
        }
        logger.error("[getTradeThreadDetails] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

const IgnoreThreadSchema = z.object({
    guildId: z.string().min(1),
    threadId: z.string().min(1).max(120),
});

/** Masque localement une conversation Metamob (ne touche PAS à Metamob, lecture seule). */
export async function ignoreMetamobThread(rawData: z.infer<typeof IgnoreThreadSchema>): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };
        const parsed = IgnoreThreadSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "Données invalides" };
        const { guildId, threadId } = parsed.data;
        if (!threadId.startsWith("mm:")) return { success: false, error: "Thread inconnu" };
        const ctx = await getUserContext(guildId);
        if (!ctx.isAuthenticated) return { success: false, error: "Unauthorized" };
        try {
            const { redis } = await import("@/lib/redis");
            await redis.sadd(`ocre:ignored-mm:${session.user.id}`, threadId.slice(3).toLowerCase());
            await redis.expire(`ocre:ignored-mm:${session.user.id}`, 30 * 86400);
        } catch {
            return { success: false, error: "Masquage indisponible pour le moment" };
        }
        return { success: true };
    } catch (error) {
        logger.error("[ignoreMetamobThread] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}
