"use server";

// =============================================================================
// QUÃŠTE OCRE SERVER ACTIONS
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
import { metamobQueue } from "@/lib/queue/metamob-queue";

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
        .min(2, "Le pseudo doit contenir au moins 2 caractÃ¨res")
        .max(30, "Le pseudo ne peut pas dÃ©passer 30 caractÃ¨res")
        .regex(/^[a-zA-Z0-9_-]+$/, "Le pseudo ne peut contenir que des lettres, chiffres, tirets et underscores"),
    apiKey: z.string()
        .length(64, "La clÃ© API V2 doit contenir exactement 64 caractÃ¨res")
        .regex(/^[a-f0-9]+$/, "La clÃ© API doit Ãªtre une chaÃ®ne hexadÃ©cimale (chiffres et lettres de a Ã  f)")
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
            return { success: false, error: "Non authentifiÃ©" };
        }

        // Rate limit
        const rateCheck = await rateLimit(`ocre:link:${session.user.id}`, 5, 60);
        if (!rateCheck.success) {
            return { success: false, error: "Trop de tentatives. RÃ©essayez dans quelques minutes." };
        }

        // Validation
        const parsed = LinkAccountSchema.safeParse(rawData);
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "DonnÃ©es invalides" };
        }
        const { guildId } = parsed.data;
        const pseudo = parsed.data.pseudo.trim();
        const apiKey = parsed.data.apiKey?.trim();
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
                    ? "ClÃ© API invalide."
                    : "Votre compte Metamob semble privÃ© ou vous n'avez pas renseignÃ© de clÃ© API. Liez votre compte avec votre clÃ© personnelle."
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
                            ? "ClÃ© API invalide ou compte privÃ©. VÃ©rifiez votre clÃ© sur Metamob.fr."
                            : "Ce compte Metamob est privÃ©. Entrez votre clÃ© API personnelle ou passez votre profil en PUBLIC."
                    };
                }
                if (error.code === "NOT_FOUND") {
                    return { success: false, error: "Compte Metamob introuvable. VÃ©rifiez l'orthographe du pseudo." };
                }
            }
            throw error;
        }

        if (!metamobData) {
            return {
                success: false,
                error: "Impossible de rÃ©cupÃ©rer les informations du compte Metamob."
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
                    error: `Cette clÃ© API est dÃ©jÃ  utilisÃ©e par ${existingKeyUser.user.name || "un autre membre"} dans une autre guilde.`
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
                    error: `Le compte Metamob "${metamobPseudo}" est dÃ©jÃ  liÃ© Ã  ${existingPseudoUser.user.name || "un autre membre"} dans cette guilde.`
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
                    console.warn(`[linkOcreAccount] Character name mismatch for user ${effectiveUserId}: Metamob="${metamobCharName}", Dofus="${profile.pseudoDofus}". Linking anyway because API key was provided.`);
                } else {
                    return {
                        success: false,
                        error: `Le personnage Metamob "${metamobCharName}" ne correspond pas Ã  votre pseudo Dofus "${profile.pseudoDofus}". Utilisez votre clÃ© API personnelle pour valider l'identitÃ©.`
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
        console.error("[linkOcreAccount] Error:", error);

        if (error instanceof MetamobApiError) {
            switch (error.code) {
                case "RATE_LIMIT":
                    return { success: false, error: "Limite Metamob atteinte. RÃ©essayez plus tard." };
                case "API_KEY_MISSING":
                    return { success: false, error: "Module QuÃªte Ocre non configurÃ©. Contactez un administrateur." };
                case "API_KEY_INVALID":
                    return { success: false, error: "ClÃ© API Metamob expirÃ©e. Contactez un administrateur." };
                case "NOT_FOUND":
                    return { success: false, error: "Compte Metamob introuvable ou profil privÃ©." };
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
            return { success: false, error: "Non authentifiÃ©" };
        }

        const parsed = UnlinkAccountSchema.safeParse(rawData);
        if (!parsed.success) {
            return { success: false, error: "DonnÃ©es invalides" };
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
    if (!session?.user?.id) return { success: false, error: "Non authentifiÃ©" };
    const userId = session.user.id;

    try {
        // [RateLimit]
        const rateCheck = await rateLimit(`ocre:progress:${userId}`, 30, 60);
        if (!rateCheck.success) return { success: false, error: "Trop de requÃªtes." };

        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) return { success: false, error: "AccÃ¨s non autorisÃ©" };

              // Use queryRaw for profile to bypass intermittent Prisma field validation issues in dev
        const profileRaw: any[] = await db.$queryRawUnsafe(`
            SELECT
                up.id,
                up."metamobPseudo",
                up."metamobQuestSlug",
                up."metamobApiKey",
                up."ocreProgressSnapshot",
                up."metamobLastSync"
            FROM "UserProfile" AS up
            JOIN "GuildConfig" AS g ON up."guildId" = g.id
            WHERE up."userId" = $1
            AND g."discordGuildId" = $2
            AND up."status" = 'ACTIVE'
            LIMIT 1
        `, userId, guildId);
        
        const profile = profileRaw[0];

        if (!profile?.metamobPseudo) return { success: false, error: "Compte non lié" };

        const cacheKey = `ocre:progress:${guildId}:${userId}`;
        const finalResult = await withCache(cacheKey, 120, async () => {
            try {
                const effectiveApiKey = profile.metamobApiKey ? decrypt(profile.metamobApiKey as string) : undefined;
                let questSlug = profile.metamobQuestSlug;

                if (!questSlug) {
                    const quests = await getUserQuests(profile.metamobPseudo!, { guildApiKey: effectiveApiKey });
                    // Use slug for discovery since name is not in UserQuestSchema
                    const ocreQuest = quests.find(q => q.slug.includes("ocre") || q.slug.includes("eternelle-moisson"));
                    if (!ocreQuest) return { success: false, error: "NO_QUEST" };
                    questSlug = ocreQuest.slug;
                    await db.userProfile.update({ where: { id: profile.id }, data: { metamobQuestSlug: questSlug } });
                }

                // API calls
                const firstPage = await getQuestDetails(profile.metamobPseudo!, questSlug, { guildApiKey: effectiveApiKey });
                const userQuestData = [...firstPage.monsters];
                let uOffset = userQuestData.length;
                while (uOffset < (firstPage.pagination?.total || 0)) {
                    const more = await getQuestDetails(profile.metamobPseudo!, questSlug, { guildApiKey: effectiveApiKey, offset: uOffset });
                    userQuestData.push(...more.monsters);
                    uOffset += more.monsters.length;
                }

                const templateId = firstPage.quest_template.id;
                let skeletonMonsters: QuestMonster[] = [];
                try { skeletonMonsters = await getQuestTemplateMonsters(templateId, { guildApiKey: effectiveApiKey }); } catch { }

                let zonesData: any[] = [];
                try {
                    const { getQuestZones } = await import('@/lib/metamob-client');
                    zonesData = await getQuestZones(questSlug!, { guildApiKey: effectiveApiKey });
                } catch { }

                // Process Zones
                const monsterZoneMap = new Map<number, Set<string>>();
                const addZone = (m: any, name: string) => {
                    const mid = m.id || m.monster_id;
                    if (mid && name) {
                        if (!monsterZoneMap.has(mid)) monsterZoneMap.set(mid, new Set());
                        monsterZoneMap.get(mid)!.add(name);
                    }
                };
                zonesData.forEach(z => {
                    z.subzones?.forEach((sz: any) => sz.monsters?.forEach((m: any) => addZone(m, sz.name?.fr || z.name?.fr)));
                    z.monsters?.forEach((m: any) => addZone(m, z.name?.fr));
                });

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

                    const zones = monsterZoneMap.get(norm.id);
                    if (zones) norm.zone = Array.from(zones).join(", ");

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
                const resData = {
                    monsters: finalMonsters,
                    stats: { total: cT, manquants: cM, possedes: cP, doublons: cD, progressPercent: cT > 0 ? Math.round((gathered / cT) * 100) : 0, monsters: statsByType.monstre, bosses: statsByType.boss, archis: statsByType.archimonstre, acquired: gathered, remaining: cT - gathered },
                    questInfo: { slug: questSlug!, characterName: firstPage.character_name || "Dofusien", currentStep: firstPage.current_step || 0, totalSteps: 34, parallelQuests: PQ, serverName: firstPage.server?.name || "Serveur" },
                    lastSync: new Date()
                };

                // PUMP: Offline Save
                try {
                    // Raw update for snapshot to avoid schema issues
                    await db.$executeRawUnsafe(`
                        UPDATE "UserProfile"
                        SET "metamobLastSync" = $1, "ocreProgressSnapshot" = $2
                        WHERE id = $3
                    `, new Date(), JSON.stringify(resData), profile.id);
                    
                    const archisToPump = finalMonsters.filter(m => m.type === "archimonstre");
                    for (const a of archisToPump) {
                        await (db as any).ocreMonsterTemplate.upsert({
                            where: { id: a.id },
                            update: { name: a.name, image: a.image, zones: a.zone, type: a.type, levelMin: a.levelMin, levelMax: a.levelMax },
                            create: { id: a.id, name: a.name, image: a.image, zones: a.zone, type: a.type, levelMin: a.levelMin || 0, levelMax: a.levelMax || 0 }
                        });
                    }
                } catch (pe) { console.error("[PUMP ERROR]", pe); }

                return { success: true, data: resData };
            } catch (innerErr) {
                if (profile.ocreProgressSnapshot) {
                    return { success: true, data: { ...(profile.ocreProgressSnapshot as any), lastSync: profile.metamobLastSync, isOffline: true } };
                }
                throw innerErr;
            }
        });

        // Don't cache errors unless it's a valid snapshot
        if (!finalResult.success && !finalResult.data?.isOffline) {
            await invalidateCache(cacheKey);
        }

        return finalResult;
    } catch (err: any) {
        console.error("[CRITICAL OCRE ERROR]", err);
        try {
            const pLast: any[] = await db.$queryRawUnsafe(`
                SELECT
                    up."ocreProgressSnapshot",
                    up."metamobLastSync"
                FROM "UserProfile" AS up
                JOIN "GuildConfig" AS g ON up."guildId" = g.id
                WHERE up."userId" = $1
                AND g."discordGuildId" = $2
                LIMIT 1
            `, userId, guildId);
            
            if (pLast[0]?.ocreProgressSnapshot) {
                return { success: true, data: { ...(pLast[0].ocreProgressSnapshot as any), lastSync: pLast[0].metamobLastSync, isOffline: true } };
            }
        } catch (rawErr) {
            console.error("[CRITICAL RAW FALLBACK FAILED]", rawErr);
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
            return { success: false, error: "Non authentifiÃ©" };
        }

        const parsed = FindPartnersSchema.safeParse(rawData);
        if (!parsed.success) {
            return { success: false, error: "DonnÃ©es invalides" };
        }
        const { guildId } = parsed.data;

        // Rate limit
        const rateCheck = await rateLimit(`ocre:match:${session.user.id}`, 20, 60);
        if (!rateCheck.success) {
            return { success: false, error: "Trop de requÃªtes. RÃ©essayez plus tard." };
        }

        // Permission check
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) {
            return { success: false, error: "AccÃ¨s non autorisÃ©" };
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
        console.error("[findOcreExchangePartners] Error:", error);

        if (error instanceof MetamobApiError) {
            if (error.code === "RATE_LIMIT") {
                return { success: false, error: "Limite Metamob atteinte. RÃ©essayez plus tard." };
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
        if (!session?.user?.id) return { success: false, error: "Non authentifiÃ©" };

        // Security: Ensure user can only check their own started jobs
        if (!jobId.startsWith(`ocre-match-${session.user.id}-`)) {
            return { success: false, error: "AccÃ¨s refusÃ© Ã  ce Job" };
        }

        const job = await metamobQueue.getJob(jobId);

        if (!job) {
            return { success: false, error: "TÃ¢che introuvable ou expirÃ©e" };
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
        console.error("[getOcreExchangeJobStatus] Error:", error);
        return { success: false, error: "Erreur lors de la vÃ©rification du statut du Job" };
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
): Promise<ActionResponse<ExchangePartner[]>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifiÃ©" };

        const parsed = FindMonsterOwnersSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "DonnÃ©es invalides" };
        const { guildId, monsterId } = parsed.data;

        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) return { success: false, error: "AccÃ¨s non autorisÃ©" };

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
                metamobPseudo: true,
                metamobQuestSlug: true,
                user: { select: { id: true, name: true, image: true } },
            },
        });

        const owners: ExchangePartner[] = [];
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
                                username: member.metamobPseudo,
                                characterName: member.user.name || member.metamobPseudo,
                                discordId: member.user.id || "",
                                discordAvatar: member.user.image || undefined,
                                profileId: member.id,
                                parallelQuests: pq,
                                monstersTheyHave: [{ id: monster.id, name: monster.name?.fr || "Unknown", available, coversNeed: true, needed: 1 }],
                                monstersYouHave: [],
                                matchScore: 1
                            });
                        }
                    }
                } catch (e) {
                    // Ignore errors for individual members
                }
            }));
        }

        return { success: true, data: owners.sort((a, b) => b.monstersTheyHave[0].available - a.monstersTheyHave[0].available) };

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
        if (!session?.user?.id) return { success: false, error: "Non authentifiÃ©" };

        const parsed = GetProfileMatchingSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "DonnÃ©es invalides" };
        const { guildId, targetProfileId } = parsed.data;

        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) return { success: false, error: "AccÃ¨s non autorisÃ©" };

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

        if (!me?.metamobPseudo || !me.metamobVerified) return { success: false, error: "Votre compte Metamob n'est pas liÃ©" };
        if (!target?.metamobPseudo || !target.metamobVerified) return { success: false, error: "Le membre n'a pas liÃ© Metamob" };

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
                    pseudo: target.user.name || "Membre",
                    metamobPseudo: target.metamobPseudo
                }
            }
        };

    } catch (error) {
        console.error("[getProfileMatchingArchis] Error:", error);
        return { success: false, error: "Erreur lors du calcul des Ã©changes" };
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
            return { success: false, error: "Non authentifiÃ©" };
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
        console.error("[getGuildExchangeMap] Error:", error);
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
            return { success: false, error: "Non authentifiÃ©" };
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
            return { success: false, error: "Non authentifiÃ©" };
        }

        // Permission check
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ARCHIS_VIEW);
        if (!guard.allowed) return { success: true, data: [] }; // Silent fail for common data

        const guildApiKey = undefined;
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
            return { success: false, error: "Non authentifiÃ©" };
        }

        // Rate limit refresh
        const rateCheck = await rateLimit(`ocre:refresh:${session.user.id}`, 3, 60);
        if (!rateCheck.success) {
            return { success: false, error: "Trop de rafraÃ®chissements. Patientez une minute." };
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
            return { success: false, error: "Aucun compte Metamob liÃ©" };
        }

        // Use User Key
        const guildApiKey = profile.metamobApiKey || undefined;

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
        return { success: false, error: "Erreur lors du rafraÃ®chissement" };
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
            return { success: false, error: "Compte Metamob non liÃ©" };
        }

        // [RateLimit] Prevent abuse (1 refresh per minute)
        const rateCheck = await rateLimit(`ocre:refresh:${user.id!}`, 1, 60);
        if (!rateCheck.success) {
            return { success: false, error: "Veuillez attendre une minute avant de rafraÃ®chir Ã  nouveau." };
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
        if (!session?.user?.id) return { success: false, error: "Non authentifiÃ©" };

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

        if (!profile?.metamobPseudo) return { success: false, error: "Compte non liÃ©" };

        const effectiveKey = profile.metamobApiKey || undefined;

        // Always skip cache to get latest list
        const quests = await getUserQuests(profile.metamobPseudo, {
            guildApiKey: effectiveKey,
            skipCache: true
        });

        return { success: true, data: quests };
    } catch (error) {
        // console.error("[getAvailableOcreQuests] Error:", error);
        return { success: false, error: "Impossible de rÃ©cupÃ©rer la liste des quÃªtes" };
    }
}

export async function switchOcreQuest(guildId: string, questSlug: string, targetUserId?: string): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifiÃ©" };

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
        if (!member.metamobPseudo) return { success: false, error: "Compte Metamob non liÃ©" };

        const effectiveKey = member.metamobApiKey || undefined;

        // Verify the quest exists and belongs to user
        const quests = await getUserQuests(member.metamobPseudo, {
            guildApiKey: effectiveKey,
            skipCache: true
        });

        const targetQuest = quests.find(q => q.slug === questSlug);
        if (!targetQuest) return { success: false, error: "QuÃªte introuvable ou vous n'y avez pas accÃ¨s" };

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
        console.error("[switchOcreQuest] Error:", error);
        return { success: false, error: "Erreur lors du changement de quÃªte" };
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
        if (!session?.user?.id) return { success: false, error: "Non authentifiÃ©" };

        const parsed = AdminForceUnlinkSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "DonnÃ©es invalides" };
        const { guildId, targetPseudo } = parsed.data;

        // Security check
        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ADMIN_ACCESS);
        if (!guard.allowed) return { success: false, error: "AccÃ¨s refusÃ©" };

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
            return { success: false, error: `Aucun utilisateur trouvÃ© avec le compte Metamob "${targetPseudo}"` };
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

// =============================================================================
// OCRE TRADE REQUESTS (ASYNCHRONOUS)
// =============================================================================

const CreateTradeSchema = z.object({
    guildId: z.string(),
    targetProfileId: z.string(),
    monsterId: z.number(),
    monsterName: z.string().optional(), // Passed from client â€” avoids Metamob API call
    monsterImage: z.string().optional(), // Image URL passed from client
    message: z.string().max(500).optional(),
    sendDiscordPing: z.boolean().optional(),
});

export async function createTradeRequest(
    rawData: z.infer<typeof CreateTradeSchema>
): Promise<ActionResponse> {
    try {

        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifiÃ©" };


        const parsed = CreateTradeSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "DonnÃ©es invalides" };
        const { guildId, targetProfileId, monsterId, monsterName: clientMonsterName, monsterImage: clientMonsterImage, message, sendDiscordPing } = parsed.data;


        const rateCheck = await rateLimit(`ocre:trade:create:${session.user.id}`, 10, 60);
        if (!rateCheck.success) return { success: false, error: "Veuillez patienter avant de faire une nouvelle demande." };


        // Force TS re-eval
        const guildConfig = await (db.guildConfig as any).findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, ocreNotifyChannelId: true }
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };


        const requesterProfile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guildId: guildConfig.id },
            include: { user: true }
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
            return { success: false, error: "Vous ne pouvez pas Ã©changer avec vous-mÃªme" };
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
            return { success: false, error: "Tu as dÃ©jÃ  une demande en attente pour ce monstre" };
        }

        // Anti-spam: max 3 demandes en attente simultanÃ©es (monstres diffÃ©rents)
        const pendingCount = await (db as any).ocreTradeRequest.count({
            where: {
                requesterId: requesterProfile.id,
                status: "PENDING"
            }
        });

        if (pendingCount >= 3) {
            return { success: false, error: "Tu as dÃ©jÃ  3 demandes en attente. Attends une rÃ©ponse avant d'en envoyer de nouvelles." };
        }


        const tradeRequest = await (db as any).ocreTradeRequest.create({
            data: {
                guildId: guildConfig.id,
                requesterId: requesterProfile.id,
                targetId: targetProfile.id,
                monsterId,
                monsterName: clientMonsterName || null,
                monsterImageUrl: clientMonsterImage || null,
                message,
                status: "PENDING"
            }
        });


        const targetPrefs = (targetProfile.notificationPrefs as any) || {};
        const shouldNotifyOcre = targetPrefs.ocre !== false;

        if (shouldNotifyOcre) {
            // In-App Notification
            await (db.notification as any).create({
                data: {
                    userId: targetProfile.userId,
                    type: "OCRE_TRADE_REQUEST",
                    title: "Demande d'Ã‰change",
                    message: `${requesterProfile.discordNickname || requesterProfile.pseudoDofus || requesterProfile.user.name || "Un membre"} souhaite vous Ã©changer un monstre !`,
                    link: `/dashboard/${guildId}/quete-ocre`,
                }
            });
        }


        // Discord Ping if requested
        const targetDiscordAccount = targetProfile.user.accounts.find((a: any) => a.provider === "discord");
        if (sendDiscordPing && guildConfig.ocreNotifyChannelId && targetDiscordAccount) {
            try {
                // Use name/image passed from client (already known in the modal)
                const monsterName = clientMonsterName || `Monstre #${monsterId}`;
                const monsterImageUrl = clientMonsterImage || undefined;

                const { sendChannelMessage } = await import("@/server/discord");
                const publicUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
                const requesterName = requesterProfile.discordNickname || requesterProfile.pseudoDofus || requesterProfile.user.name || "Un membre";

                await sendChannelMessage(
                    guildConfig.ocreNotifyChannelId,
                    `<@${targetDiscordAccount.providerAccountId}>`,
                    {
                        embedTitle: `ðŸ¤ Demande d'Ã©change â€” ${monsterName}`,
                        embedColor: 0x10b981,
                        embedThumbnail: monsterImageUrl,
                        embedUrl: `${publicUrl}/dashboard/${guildId}/quete-ocre`,
                        fields: [
                            { name: "De", value: requesterName, inline: true },
                            { name: "Archimonstre", value: monsterName, inline: true },
                            ...(message ? [{ name: "Message", value: `*${message}*`, inline: false }] : []),
                            { name: "RÃ©pondre", value: `[Ouvrir le Dashboard](${publicUrl}/dashboard/${guildId}/quete-ocre)`, inline: false },
                        ]
                    }
                );
            } catch (e) {
                console.error("Failed to send Discord ping for Ocre trade:", e);
            }
        }



        revalidatePath(`/dashboard/${guildId}/quete-ocre`);
        
        // Trigger live update via socket for responsiveness
        try {
            const redis = (await import("@/lib/redis")).default;
            await redis.publish("ocre:trade:update", JSON.stringify({ guildId, type: "NEW_REQUEST", monsterId }));
        } catch (e) {
            console.error("Failed to publish ocre trade update:", e);
        }

        return { success: true };
    } catch (error: any) {
        console.error("[createTradeRequest] Detailed Error:", error);
        return { success: false, error: "DEBUG: " + (error?.message || "Erreur serveur interne") };
    }
}

const ActionTradeSchema = z.object({
    guildId: z.string(),
    requestId: z.string()
});

export async function rejectTradeRequest(rawData: z.infer<typeof ActionTradeSchema>): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifiÃ©" };

        const parsed = ActionTradeSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "DonnÃ©es invalides" };
        const { guildId, requestId } = parsed.data;

        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const tradeRequest = await (db as any).ocreTradeRequest.findUnique({
            where: { id: requestId },
            include: { target: true, requester: { include: { user: true } } }
        });

        if (!tradeRequest || tradeRequest.guildId !== guildConfig.id) return { success: false, error: "Demande introuvable" };
        if (tradeRequest.target.userId !== session.user.id) return { success: false, error: "Non autorisÃ©" };

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
        console.error("[rejectTradeRequest] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function cancelTradeRequest(rawData: z.infer<typeof ActionTradeSchema>): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifiÃ©" };

        const parsed = ActionTradeSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "DonnÃ©es invalides" };
        const { guildId, requestId } = parsed.data;

        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const tradeRequest = await (db as any).ocreTradeRequest.findUnique({
            where: { id: requestId },
            include: { requester: true }
        });

        if (!tradeRequest || tradeRequest.guildId !== guildConfig.id) return { success: false, error: "Demande introuvable" };
        if (tradeRequest.requester.userId !== session.user.id) return { success: false, error: "Non autorisÃ©" };

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
        console.error("[cancelTradeRequest] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function acceptTradeRequest(rawData: z.infer<typeof ActionTradeSchema>): Promise<ActionResponse> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifiÃ©" };

        const parsed = ActionTradeSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, error: "DonnÃ©es invalides" };
        const { guildId, requestId } = parsed.data;

        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const tradeRequest = await (db as any).ocreTradeRequest.findUnique({
            where: { id: requestId },
            include: { target: true, requester: true }
        });

        if (!tradeRequest || tradeRequest.guildId !== guildConfig.id) return { success: false, error: "Demande introuvable" };
        if (tradeRequest.target.userId !== session.user.id) return { success: false, error: "Non autorisÃ©" };
        if (tradeRequest.status !== "PENDING") return { success: false, error: "Demande dÃ©jÃ  traitÃ©e" };

        // Mark as Accepted
        await (db as any).ocreTradeRequest.update({
            where: { id: requestId },
            data: { status: "ACCEPTED" }
        });

        // Notify Requester
        await (db.notification as any).create({
            data: {
                userId: tradeRequest.requester.userId,
                type: "OCRE_TRADE_ACCEPTED",
                title: "Ã‰change AcceptÃ©",
                message: `${tradeRequest.target.discordNickname || tradeRequest.target.metamobPseudo || "Un membre"} a acceptÃ© votre Ã©change !`,
                link: `/dashboard/${guildId}/quete-ocre`,
            }
        });

        // Guild Feed Message
        try {
            const { pushSystemChatMessage } = await import("@/server/actions/chat-actions");
            const targetName = tradeRequest.target.discordNickname || tradeRequest.target.pseudoDofus || tradeRequest.target.metamobPseudo || "Un membre";
            const requesterName = tradeRequest.requester.discordNickname || tradeRequest.requester.pseudoDofus || tradeRequest.requester.metamobPseudo || "Un membre";
            await pushSystemChatMessage(
                guildId,
                `ðŸ¤ **${targetName}** a acceptÃ© une demande d'Ã©change Ocre avec **${requesterName}** !`,
                { type: "ocre_trade_accepted", requestId }
            );
        } catch (chatErr) {
            console.error("Failed to push system chat message for ocre trade", chatErr);
        }

        // Metamob Auto-Update
        try {
            const { getUserMonsters, updateMonsterQuantity } = await import("@/lib/metamob-client");

            // 1. Update Requester (Gains 1 monster)
            if (tradeRequest.requester.metamobApiKey && tradeRequest.requester.metamobQuestSlug && tradeRequest.requester.metamobVerified) {
                const reqMonsters = await getUserMonsters(tradeRequest.requester.metamobPseudo, { guildApiKey: tradeRequest.requester.metamobApiKey });
                const reqMonster = reqMonsters.find(m => m.id === tradeRequest.monsterId);
                const reqCurrent = reqMonster ? reqMonster.quantite : 0;
                await updateMonsterQuantity(
                    tradeRequest.requester.metamobPseudo,
                    tradeRequest.requester.metamobQuestSlug,
                    tradeRequest.monsterId,
                    reqCurrent + 1,
                    { guildApiKey: tradeRequest.requester.metamobApiKey }
                );
            }

            // 2. Update Target (Loses 1 monster)
            if (tradeRequest.target.metamobApiKey && tradeRequest.target.metamobQuestSlug && tradeRequest.target.metamobVerified) {
                const targetMonsters = await getUserMonsters(tradeRequest.target.metamobPseudo, { guildApiKey: tradeRequest.target.metamobApiKey });
                const targetMonster = targetMonsters.find(m => m.id === tradeRequest.monsterId);
                const targetCurrent = targetMonster ? targetMonster.quantite : 0;
                if (targetCurrent > 0) {
                    await updateMonsterQuantity(
                        tradeRequest.target.metamobPseudo,
                        tradeRequest.target.metamobQuestSlug,
                        tradeRequest.monsterId,
                        targetCurrent - 1,
                        { guildApiKey: tradeRequest.target.metamobApiKey }
                    );
                }
            }
        } catch (syncError) {
            console.error("[acceptTradeRequest] Auto-sync to Metamob failed:", syncError);
            // We do not fail the trade just because Metamob API failed, the users can do it manually worst case
        }

        revalidatePath(`/dashboard/${guildId}/quete-ocre`);

        // Trigger live update via socket
        try {
            const redis = (await import("@/lib/redis")).default;
            await redis.publish("ocre:trade:update", JSON.stringify({ guildId, type: "ACCEPTED", requestId }));
        } catch (e) { }

        return { success: true };
    } catch (error) {
        console.error("[acceptTradeRequest] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function getPendingTradeRequests(guildId: string): Promise<ActionResponse<any>> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifiÃ©" };

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
                    console.error(`[getPendingTradeRequests] Failed to enrich monster ${req.monsterId}:`, e);
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
        console.error("[getPendingTradeRequests] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/** Get archmonsters for a specific zone from the user's Metamob progress */
export async function getZoneArchmonsters(guildId: string, zoneName: string): Promise<ActionResponse<OcreMonster[]>> {
    try {
        const res = await getMyOcreProgress(guildId);
        if (!res.success || !res.data) {
            // Forward "Compte non lié" specific message so the frontend can catch it
            return { success: false, error: res.error === "Compte non lié" ? "Compte non lié" : res.error || "Impossible de récupérer la progression Ocre" };
        }

        const normalizedZone = zoneName.toLowerCase().trim();
        const zoneArchis = res.data.monsters.filter(m => {
            if (m.type !== "archimonstre") return false;

            const search = normalizedZone;
            const mZone = (m.zone || "").toLowerCase();
            const mSubzone = (m.subzone || "").toLowerCase();

            // Split zones by comma to handle multi-zone monsters (e.g., "Astrub, Bonta, Brakmar")
            const monsterZones = mZone.split(",").map(z => z.trim()).filter(Boolean);
            const monsterSubzones = mSubzone.split(",").map(z => z.trim()).filter(Boolean);

            // Check if any of the monster's zones match the search or vice-versa
            const matchesZone = monsterZones.some(mz => mz.includes(search) || search.includes(mz));
            const matchesSubzone = monsterSubzones.some(msz => msz.includes(search) || search.includes(msz));

            return matchesZone || matchesSubzone;
        });

        // Sort: Missing first, then by name
        const sorted = zoneArchis.sort((a, b) => {
            if (a.state === "MANQUANT" && b.state !== "MANQUANT") return -1;
            if (a.state !== "MANQUANT" && b.state === "MANQUANT") return 1;
            return a.name.localeCompare(b.name);
        });

        return { success: true, data: sorted };
    } catch (error) {
        console.error("[getZoneArchmonsters] Error:", error);
        return { success: false, error: "Erreur lors du filtrage des archimonstres" };
    }
}
