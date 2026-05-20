"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { PERMISSIONS, type PermissionId } from "@/lib/permissions";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { checkGuildPermission, getUserContext } from "@/server/actions/user-actions";
import { MissionCategory, Prisma, NotificationType } from "@prisma/client";
import { createNotification } from "@/server/actions/notification-actions";
import { join, dirname } from "path";
import { writeFile, mkdir } from "fs/promises";
import sharp from "sharp";
import { deleteProofFile } from "@/lib/storage-utils";
import { rateLimit } from "@/lib/ratelimit";
import { withCache, invalidateCache } from "@/lib/cache";
import { hashImage } from "@/lib/llm-ocr";
import { logAction } from "@/server/actions/audit-actions";
import { getDiscordPublicUrl } from "@/lib/storage-utils";
import { getDofusWeek } from "@/lib/date-utils";
import { getKamaStats } from "./kama-actions";


// --- Types & Schemas ---

export type ActionResponse<T = any> = {
    success: boolean;
    error?: string;
    data?: T;
};


const MissionSchema = z.object({
    slotIndex: z.number().min(0).max(17), // 0-11 classiques, 12-17 spéciales (Dofus 3.5)
    category: z.enum(["DONJON", "REGULATION", "ANOMALIE", "SONGES", "EXPEDITION", "EVENT"]),
    tier: z.number().min(1).max(5),
    rank: z.number().min(1).max(4).default(1),
    xpReward: z.number().min(0).default(0),
    guildatonsReward: z.number().min(0).default(0),
    title: z.string().optional(),
    payload: z.record(z.any()),
}); // No .strict() — extra fields from DB are ignored safely

const CreateWeekSchema = z.object({
    guildId: z.string(),
    weekNumber: z.number().min(1).max(53),
    year: z.number().min(2025),
    missions: z.array(MissionSchema).min(1).max(18), // up to 12 classiques + 6 spéciales
    updateGuildTier: z.number().min(1).max(5).optional(),
    notifyMembers: z.boolean().optional(),
}).strict();

async function notifyValidators(guildId: string, title: string, message: string, link?: string, proofUrl?: string, submissionId?: string): Promise<string | undefined> {
    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                id: true,
                missionNotifyChannelId: true,
                missionValidationChannelId: true,
                missionValidationNotifyRoleId: true
            }
        });

        if (!guild) return;

        // 0. Send Discord Message if channel is configured
        // Priority: validation channel > notification channel
        const discordChannelId = guild.missionValidationChannelId || guild.missionNotifyChannelId;
        const mentionRole = guild.missionValidationNotifyRoleId;
        const content = mentionRole ? (mentionRole === "everyone" ? "Bonjour @everyone !" : `Bonjour <@&${mentionRole}> !`) : "Bonjour le Staff !";

        let resultDiscordId: string | undefined = undefined;
        if (discordChannelId) {
            try {
                const { sendChannelMessage } = await import("@/server/discord");
                const absoluteLink = link ? `${process.env.NEXT_PUBLIC_APP_URL}${link}` : undefined;
                const absoluteImageUrl = getDiscordPublicUrl(proofUrl);

                // Compact validation alert with proof screenshot + action buttons
                const messageId = await sendChannelMessage(discordChannelId, "", {
                    mentionContent: content,
                    embedTitle: "🎯 Nouvelle Mission à Valider",
                    embedDescription: message,
                    embedColor: 0x9333ea, // Purple
                    embedUrl: absoluteLink,
                    embedImage: absoluteImageUrl,
                    embedFooter: "SigilOS • Système de Validation",
                    components: submissionId ? [
                        {
                            type: 1, // Action Row
                            components: [
                                {
                                    type: 2, style: 3,
                                    label: "✅ Valider",
                                    custom_id: `validate:mission:${submissionId}:${guildId}`,
                                },
                                {
                                    type: 2, style: 4,
                                    label: "❌ Rejeter",
                                    custom_id: `validate:mission_reject:${submissionId}:${guildId}`,
                                },
                            ],
                        },
                    ] : undefined,
                });

                if (messageId) {
                    resultDiscordId = `${discordChannelId}:${messageId}`;
                }
            } catch (discordError) {
                logger.error("[NotifyValidators] Discord Error", { error: discordError });
            }
        }

        // 1. Find all users in this guild with "MISSIONS_VALIDATE" permission
        // We first get the guild's roles mapping to see which roles have this perm
        const { getGuildAdminsWithPermission } = await import("@/server/actions/admin-actions");
        const validators = await getGuildAdminsWithPermission(guildId, PERMISSIONS.MISSIONS_OFFICER);

        if (validators.length === 0) {
            logger.warn(`[Notification] No validators found for guild ${guildId}`);
            return;
        }

        // 2. Notify all of them (granular prefs will be checked in createNotification)
        const notificationPromises = validators.map(v =>
            createNotification(
                v.userId,
                "NEW_SUBMISSION_PENDING",
                title,
                message,
                link,
                guildId,
                "ADMIN_ALERT"
            )
        );

        await Promise.all(notificationPromises);

        return resultDiscordId;
    } catch (e) {
        logger.error("Notify Validators Error", { error: e });
        return undefined;
    }
}

// deleteProofFile removed and moved to @/lib/storage-utils


// --- Actions ---

export async function createWeekMissions(
    rawData: z.infer<typeof CreateWeekSchema>
): Promise<ActionResponse> {
    const session = await auth();

    // 1. Validation
    const validation = CreateWeekSchema.safeParse(rawData);
    if (!validation.success) {
        logger.error("createWeekMissions - Zod validation failed", { errors: validation.error.flatten() });
        return { success: false, error: "Invalid Data: " + JSON.stringify(validation.error.flatten().fieldErrors) };
    }
    const data = validation.data;

    // 2. Auth & Permission
    const guard = await checkGuildPermission(session, data.guildId, PERMISSIONS.MISSIONS_OFFICER);
    if (!guard.allowed) {
        logger.error("createWeekMissions - Permission denied", { error: guard.error, guildId: data.guildId, userId: session?.user?.id });
        return { success: false, error: guard.error };
    }

    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // 3. RATE LIMIT: 5 creations per minute per admin
    const limiter = await rateLimit(`create_missions:${session.user.id}:${data.guildId}`, 5, 60 * 1000);
    if (!limiter.success) return { success: false, error: "Trop d'actions. Veuillez patienter un instant." };

    // 4. UNIQUENESS CHECK: Ensure no two missions are strictly identical
    const seen = new Set<string>();
    for (const m of data.missions) {
        // Create a signature based on key fields. We use JSON.stringify for the payload to be precise.
        const signature = `${m.category}-${m.tier}-${m.rank}-${m.title || ''}-${JSON.stringify(m.payload)}`;
        if (seen.has(signature)) {
            return { 
                success: false, 
                error: `Doublon détecté : La mission "${m.title || m.category}" est présente plusieurs fois. Chaque mission de la semaine doit être unique.` 
            };
        }
        seen.add(signature);
    }

    try {
        await db.$transaction(async (tx) => {
            // DEEP ISOLATION: Ensure we only touch the specific discordGuildId provided
            const guild = await tx.guildConfig.findUniqueOrThrow({
                where: { discordGuildId: data.guildId }
            });

            // 5. DATABASE UNIQUENESS CHECK: Check against existing missions in DB
            const existingMissions = await tx.mission.findMany({
                where: {
                    guildId: guild.id,
                    weekNumber: data.weekNumber,
                    year: data.year,
                }
            });

            for (const m of data.missions) {
                const currentSig = `${m.category}-${m.tier}-${m.rank}-${m.title || ''}-${JSON.stringify(m.payload)}`;
                
                const duplicate = existingMissions.find(em => {
                    // Ignore the exact same slot we are currently updating
                    if (em.slotIndex === m.slotIndex) return false;
                    
                    const emSig = `${em.category}-${em.tier}-${em.rank}-${em.title || ''}-${JSON.stringify(em.payload)}`;
                    return emSig === currentSig;
                });

                if (duplicate) {
                    throw new Error(`La mission "${m.title || m.category}" existe déjà dans un autre slot de cette semaine.`);
                }
            }

            // Double check that this guild is actually the one intended (Secondary check)
            if (guild.discordGuildId !== data.guildId) {
                throw new Error("Multi-tenant violation detected.");
            }

            // Update Guild Tier if provided
            if (data.updateGuildTier) {
                await tx.guildConfig.update({
                    where: { id: guild.id },
                    // @ts-ignore - Type definition lag
                    data: { missionTier: data.updateGuildTier }
                });
            }

            // Upsert Logic: Iterate and update/create per slot
            for (const m of data.missions) {
                await tx.mission.upsert({
                    where: {
                        guildId_weekNumber_year_slotIndex: {
                            guildId: guild.id,
                            weekNumber: data.weekNumber,
                            year: data.year,
                            slotIndex: m.slotIndex
                        }
                    },
                    update: {
                        category: m.category as any,
                        tier: m.tier,
                        // @ts-ignore
                        rank: m.rank,
                        xpReward: m.xpReward,
                        guildatonsReward: m.guildatonsReward,
                        title: m.title,
                        payload: m.payload as Prisma.InputJsonValue
                    },
                    create: {
                        guildId: guild.id,
                        weekNumber: data.weekNumber,
                        year: data.year,
                        slotIndex: m.slotIndex,
                        category: m.category as any,
                        tier: m.tier,
                        // @ts-ignore
                        rank: m.rank,
                        xpReward: m.xpReward,
                        guildatonsReward: m.guildatonsReward,
                        title: m.title,
                        payload: m.payload as Prisma.InputJsonValue
                    }
                });
            }

            // 4. Global Notification if requested
            if (data.notifyMembers) {
                const activeProfiles = await tx.userProfile.findMany({
                    where: { guildId: guild.id, status: 'ACTIVE' },
                    select: { userId: true }
                });

                if (activeProfiles.length > 0) {
                    // We don't use createMany because we want to check individual preferences via createNotification
                    // Although createNotification is "use server", we call it here. 
                    // Note: transactions and async hooks might be tricky but for notifications it's fine to run after or use Promise.all
                    const notificationPromises = activeProfiles.map(p =>
                        createNotification(
                            p.userId,
                            "SYSTEM_INFO",
                            "🎯 Nouvel objectif hebdomadaire",
                            `Les missions de la Semaine ${data.weekNumber} sont disponibles !`,
                            `/dashboard/${data.guildId}/missions`,
                            data.guildId
                        )
                    );
                    await Promise.all(notificationPromises);
                }
            }
        });

        revalidatePath(`/dashboard/${data.guildId}/missions`);
        revalidatePath(`/dashboard/${data.guildId}/missions/manage`);

        // Invalidate Cache
        await invalidateCache(`missions:${data.guildId}:${data.year}:${data.weekNumber}`);

        // Audit log (Verbose)
        await logAction({
            guildId: data.guildId,
            action: "MISSION_CREATED",
            targetType: "MISSION",
            metadata: {
                weekNumber: data.weekNumber,
                year: data.year,
                slotsCount: data.missions.length,
                tier: data.updateGuildTier,
                operation: "PUBLISH_WEEKLY_MISSIONS"
            }
        });

        return { success: true };
    } catch (error) {
        logger.error("Create Missions Error", { error, guildId: data.guildId, weekNumber: data.weekNumber, year: data.year });
        return { success: false, error: "Database transaction failed: " + (error instanceof Error ? error.message : "Unknown") };
    }
}

export async function updateWeekTier(
    guildId: string,
    weekNumber: number,
    year: number,
    tier: number
): Promise<ActionResponse> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_OFFICER);
    if (!guard.allowed) return { success: false, error: guard.error };

    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({
            where: { discordGuildId: guildId }
        });

        await db.$transaction(async (tx) => {
            // Update guild default if requested
            await tx.guildConfig.update({
                where: { id: guildConfig.id },
                data: { missionTier: tier } as any // Use as any to bypass Prisma type lags
            });

            // Update all existing missions for that week
            await tx.mission.updateMany({
                where: {
                    guildId: guildConfig.id,
                    weekNumber,
                    year
                },
                data: { tier }
            });
        });

        revalidatePath(`/dashboard/${guildId}/missions/manage`);
        revalidatePath(`/dashboard/${guildId}/missions`);

        await invalidateCache(`missions:${guildId}:${year}:${weekNumber}`);

        await logAction({
            guildId,
            action: "CONFIG_UPDATED",
            targetType: "GUILD",
            metadata: { 
                operation: "UPDATE_WEEK_TIER",
                weekNumber, 
                year, 
                newTier: tier 
            }
        });

        return { success: true };
    } catch (error) {
        logger.error("Update Week Tier Error", { error, guildId, weekNumber, year, tier });
        return { success: false, error: "Database transaction failed" };
    }
}


export async function resetMission(
    guildId: string,
    weekNumber: number,
    year: number,
    slotIndex: number
): Promise<ActionResponse> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_OFFICER);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({
            where: { discordGuildId: guildId }
        });

        await db.mission.deleteMany({
            where: {
                guildId: guildConfig.id,
                weekNumber,
                year,
                slotIndex
            }
        });

        revalidatePath(`/dashboard/${guildId}/missions`);
        revalidatePath(`/dashboard/${guildId}/missions/manage`);

        // Invalidate Cache
        await invalidateCache(`missions:${guildId}:${year}:${weekNumber}`);

        // Audit log
        await logAction({
            guildId,
            action: "MISSION_DELETED",
            targetType: "MISSION",
            metadata: { 
                operation: "RESET_SINGLE_MISSION",
                weekNumber, 
                year, 
                slotIndex 
            }
        });

        return { success: true };
    } catch (error) {
        logger.error("Reset Mission Error", { error, guildId, weekNumber, year, slotIndex });
        return { success: false, error: "Reset Failed" };
    }
}

export async function resetWeek(
    guildId: string,
    weekNumber: number,
    year: number
): Promise<ActionResponse> {
    const session = await auth();

    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_OFFICER);
    if (!guard.allowed) {
        logger.error("ResetWeek - Permission denied", { error: guard.error, guildId });
        return { success: false, error: guard.error };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const { deleteProofFile } = await import("@/lib/storage-utils");

        // 1. Calculate week boundaries for non-weekly models (approximate)
        const startOfWeek = new Date(year, 0, 1 + (weekNumber - 1) * 7);
        const endOfWeek = new Date(year, 0, 1 + weekNumber * 7);

        // 2. Fetch all items to be deleted to cleanup physical files
        const [missions, kamas] = await Promise.all([
            db.mission.findMany({
                where: { guildId: guildConfig.id, weekNumber, year },
                include: { submissions: { select: { id: true, proofUrl: true } } }
            }),
            (db as any).kamaDonation.findMany({
                where: { guildId: guildConfig.id, weekNumber, yearNumber: year },
                select: { id: true, proofUrl: true }
            })
        ]);

        // 3. Extract and delete physical proofs + ImageHashes
        const submissionProofs = missions.flatMap(m => m.submissions.map(s => ({ id: s.id, url: s.proofUrl, type: "MISSION" })));
        const kamaProofs = kamas.map((k: any) => ({ id: k.id, url: k.proofUrl, type: "KAMA_DONATION" }));
        
        const allProofs = [...submissionProofs, ...kamaProofs];

        for (const proof of allProofs) {
            if (proof.url) {
                await deleteProofFile(proof.url);
                // Clean image hashes to allow re-upload if needed
                await (db as any).imageHash.deleteMany({
                    where: { 
                        guildId: guildConfig.id, 
                        sourceId: proof.id 
                    }
                });
            }
        }

        // 4. Final DB Reset
        await db.$transaction([
            db.mission.deleteMany({
                where: { guildId: guildConfig.id, weekNumber, year }
            }),
            (db as any).kamaDonation.deleteMany({
                where: { guildId: guildConfig.id, weekNumber, yearNumber: year }
            })
        ]);

        revalidatePath(`/dashboard/${guildId}/missions`);
        revalidatePath(`/dashboard/${guildId}/missions/manage`);
        revalidatePath(`/dashboard/${guildId}/ladder`);

        await invalidateCache(`missions:${guildId}:${year}:${weekNumber}`);

        await logAction({
            guildId,
            action: "MISSION_DELETED",
            targetType: "MISSION",
            metadata: { 
                operation: "RESET_FULL_WEEK",
                weekNumber, 
                year, 
                scope: "FULL_WEEK_CLEANUP", 
                proofsDeleted: allProofs.length 
            }
        });

        return { success: true };
    } catch (error) {
        logger.error("ResetWeek Critical Error", { error, guildId, weekNumber, year });
        return { success: false, error: "Expansion de la purge échouée" };
    }
}

export async function getWeekMissions(
    guildId: string,
    weekNumber: number,
    year: number
): Promise<ActionResponse<any>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
    if (!guard.allowed) {
        return { success: false, error: guard.error };
    }

    try {
        const missions = await withCache(
            `missions:${guildId}:${year}:${weekNumber}`,
            300, // 5 minutes cache
            async () => {
                const guildConfig = await db.guildConfig.findUniqueOrThrow({
                    where: { discordGuildId: guildId }
                });

                return db.mission.findMany({
                    where: {
                        guildId: guildConfig.id,
                        weekNumber,
                        year
                    },
                    include: {
                        submissions: {
                            where: { profile: { userId: session?.user?.id } } // Filter submissions for the current user
                        },
                        interests: {
                            include: {
                                profile: {
                                    include: { user: true }
                                }
                            }
                        },
                        _count: {
                            select: { submissions: { where: { status: 'VALIDATED' } } }
                        }
                    },
                    orderBy: { slotIndex: 'asc' }
                });
            }
        );

        // Submissions can't be easily cached per user in a global key, 
        // so we filter them or fetch them separately if needed. 
        // For now, let's skip user-specific submission caching in the global missions list
        // OR we can make the key user-specific, but that defeats the purpose of "global" cache.
        // DECISION: Cache the missions + interests (global), then fetch the current user's submission separately if session exists.

        let userSubmissions: any[] = [];
        if (session?.user?.id) {
            userSubmissions = await db.submission.findMany({
                where: {
                    mission: {
                        guild: { discordGuildId: guildId },
                        weekNumber,
                        year
                    },
                    profile: { userId: session.user.id }
                }
            });
        }

        // Fetch linked events for these missions
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        const linkedEvents = guildConfig ? await db.guildEvent.findMany({
            where: {
                guildId: guildConfig.id,
                type: "SESSION_MISSIONS",
                status: { in: ["DRAFT", "PUBLISHED"] },
                startDate: {
                    gte: new Date(year, 0, 1 + (weekNumber - 1) * 7),
                    lte: new Date(year, 0, 1 + weekNumber * 7 + 7)
                }
            },
            select: { id: true, title: true, startDate: true, metadata: true }
        }) : [];

        // Merge submissions and events into cached missions and ensure plain objects
        const enrichedMissions = missions.map(m => {
            const event = linkedEvents.find(e => {
                const meta = e.metadata as any;
                return meta?.missionIds?.includes(m.id);
            });

            return {
                ...m,
                linkedEvent: event ? { id: event.id, title: event.title, startDate: event.startDate } : null,
                // Spread relations to break Prisma prototype chain
                interests: m.interests.map(i => ({
                    ...i,
                    profile: {
                        ...i.profile,
                        user: i.profile.user ? { ...i.profile.user } : null
                    }
                })),
                submissions: userSubmissions.filter(s => s.missionId === m.id).slice(0, 1).map(s => ({ ...s }))
            };
        });

        // FINAL SAFEGUARD
        const safeData = JSON.parse(JSON.stringify(enrichedMissions, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));
        return { success: true, data: safeData };
    } catch (error) {
        logger.error("Fetch Missions Error", { error, guildId, weekNumber, year });
        return { success: false, error: "Failed to fetch missions: " + (error instanceof Error ? error.message : String(error)) };
    }
}

export async function toggleMissionInterest(
    missionId: string
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // RATE LIMIT: 30 toggles per minute
    const limiter = await rateLimit(`toggle_interest:${session.user.id}:${missionId}`, 30, 60 * 1000);
    if (!limiter.success) return { success: false, error: "Trop d'actions rapide. Calmez-vous un peu !" };

    try {

        // 1. Get Mission & Guild (to check permissions)
        const mission = await db.mission.findUnique({
            where: { id: missionId },
            include: { guild: true }
        });
        if (!mission) return { success: false, error: "Mission not found" };

        const guard = await checkGuildPermission(session, mission.guild.discordGuildId, PERMISSIONS.COMMUNITY_ACCESS);
        if (!guard.allowed) return { success: false, error: guard.error };

        // 2. Get User Profile linked to this Guild
        const profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: mission.guildId
                }
            }
        });

        if (!profile) {
            return { success: false, error: "Profile null ou inexistant pour cette guilde." };
        }

        // 3. Toggle
        const existing = await db.missionInterest.findUnique({
            where: {
                missionId_profileId: {
                    missionId,
                    profileId: profile.id
                }
            }
        });

        if (existing) {
            await db.missionInterest.delete({ where: { id: existing.id } });
        } else {
            await db.missionInterest.create({
                data: {
                    missionId,
                    profileId: profile.id
                }
            });
        }

        revalidatePath(`/dashboard/${mission.guild.discordGuildId}/missions`);

        // Invalidate Cache
        await invalidateCache(`missions:${mission.guild.discordGuildId}:${mission.year}:${mission.weekNumber}`);

        return { success: true };

    } catch (error) {
        logger.error("Toggle Interest Error", { error, missionId, userId: session?.user?.id });
        return { success: false, error: "Database error" };
    }
}

/**
 * Récupère les missions de la semaine pour le sélecteur du calendrier.
 */
export async function getMissionsForCalendar(guildId: string): Promise<ActionResponse<any[]>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const { week, year } = getDofusWeek();
        
        const guildConfig = await db.guildConfig.findUniqueOrThrow({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        const missions = await db.mission.findMany({
            where: {
                guildId: guildConfig.id,
                weekNumber: week,
                year: year,
                status: "ACTIVE"
            },
            select: {
                id: true,
                title: true,
                category: true,
                payload: true,
                slotIndex: true,
                rank: true
            },
            orderBy: { slotIndex: "asc" }
        });

        // Ensure safe JSON serialization
        const safeData = JSON.parse(JSON.stringify(missions));
        return { success: true, data: safeData };
    } catch (error) {
        logger.error("getMissionsForCalendar Error", { error, guildId });
        return { success: false, error: "Erreur lors de la récupération des missions de la semaine." };
    }
}

export async function submitMissionProof(
    missionId: string,
    imageData: string, // Base64 image data from client
    helperIds: string[] = [], // IDs of UserProfile,
    honeypot?: string // 🍯 Honeypot value
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    // 🍯 HONEYPOT CHECK
    const { validateHoneypot } = await import("@/lib/honeypot");
    if (!validateHoneypot({ hp_ignore_field: honeypot })) {
        logger.warn(`[Security] Honeypot triggered by user ${session.user.id}`);
        return { success: false, error: "Action interdite : Protection anti-bot activée." };
    }

    // RATE LIMIT: 10 submissions per minute
    const limiter = await rateLimit(`submit_proof:${session.user.id}`, 10, 60 * 1000);
    if (!limiter.success) return { success: false, error: "Trop de soumissions. Veuillez patienter." };

    try {
        const mission = await db.mission.findUnique({
            where: { id: missionId },
            include: { guild: true }
        });
        if (!mission) return { success: false, error: "Mission introuvable" };
        if (mission.status !== "ACTIVE") return { success: false, error: "Mission non active" };

        const guard = await checkGuildPermission(session, mission.guild.discordGuildId, PERMISSIONS.COMMUNITY_ACCESS);
        if (!guard.allowed) return { success: false, error: guard.error };

        const profile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: session.user.id, guildId: mission.guildId } },
            include: { user: true }
        });
        if (!profile) return { success: false, error: "Profil introuvable" };

        // 24h Restriction Check
        const HOURS_RESIDENCY = 24;
        const createdAt = profile.createdAt;
        const diffMs = Date.now() - createdAt.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        const userCtx = await getUserContext(mission.guild.discordGuildId);
        if (diffHours < HOURS_RESIDENCY && !userCtx.isAdmin) {
            const remainingMs = (HOURS_RESIDENCY * 60 * 60 * 1000) - diffMs;
            const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
            const remainingMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
            return { 
                success: false, 
                error: `Accès restreint. Vous devez avoir rejoint le Dashboard depuis au moins 24h pour participer aux missions. Disponible dans ${remainingHours}h ${remainingMins}m.` 
            };
        }

        // 1. Double check for existing submission
        const existing = await db.submission.findFirst({
            where: { missionId, profileId: profile.id, status: { in: ["PENDING", "VALIDATED"] } }
        });
        if (existing) return { success: false, error: "Vous avez déjà une soumission pour cette mission." };

        // 1.2 If a REJECTED submission exists, clean it up to allow retry
        const rejectedSubmission = await db.submission.findFirst({
            where: { missionId, profileId: profile.id, status: "REJECTED" }
        });
        if (rejectedSubmission) {
            // Delete old image hash if any (normally already deleted at rejection time, but belt-and-suspenders)
            await (db as any).imageHash.deleteMany({
                where: { guildId: mission.guildId, sourceType: "MISSION", sourceId: rejectedSubmission.id }
            });
            // Delete the physical rejected proof to prevent orphan files on VPS
            if (rejectedSubmission.proofUrl) {
                const { deletePhysicalProof } = await import("@/server/actions/upload-actions");
                await deletePhysicalProof(rejectedSubmission.proofUrl);
            }
            // Delete the stale REJECTED submission row to allow new submission
            await db.submission.delete({ where: { id: rejectedSubmission.id } });
        }

        // 1.5 Validate Helpers
        if (helperIds.length > 7) return { success: false, error: "Maximum 7 aidants autorisés." };
        if (helperIds.includes(profile.id)) return { success: false, error: "Vous ne pouvez pas vous ajouter comme aidant." };


        // 2. OCR Processing
        const base64Data = imageData.split(',')[1];
        if (!base64Data) return { success: false, error: "Données d'image corrompues." };

        const buffer = Buffer.from(base64Data, 'base64');

        // SECURITY: Limit image size to 10MB before processing
        const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
        if (buffer.length > MAX_SIZE_BYTES) {
            return { success: false, error: "Image trop grande. Maximum 10MB autorisé." };
        }

        // SECURITY: Verify HelperIds integrity (Multi-tenant check)
        if (helperIds.length > 0) {
            const helperProfiles = await db.userProfile.findMany({
                where: {
                    id: { in: helperIds },
                    guildId: mission.guildId // MUST be in the same guild
                },
                select: { id: true }
            });

            if (helperProfiles.length !== helperIds.length) {
                return { success: false, error: "Certains aidants ne font pas partie de votre guilde." };
            }
        }

        // SECURITY: Validate Magic Bytes
        // We import dynamically to avoid circular deps if any (though lib is clean)
        const { detectMimeType } = await import("@/lib/image-security");

        const detectedMime = detectMimeType(buffer);
        if (!detectedMime) {
            return { success: false, error: "Format de fichier non reconnu ou non sécurisé." };
        }

        // Image Hashing (Anti-Duplicate)
        const imageHash = await hashImage(buffer);
        const existingHash = await db.imageHash.findFirst({
            where: { hash: imageHash }
        });

        if (existingHash) {
            return { success: false, error: "Cette image a déjà été utilisée pour une validation dans cette guilde." };
        }

        // NO OCR - All submissions go to admin validation
        // Just save the proof image and create a PENDING submission

        // 3. Optimize Image using Sharp
        // - Resize to max 1920px width
        // - Convert to WebP (80% quality)
        const optimizedBuffer = await sharp(buffer)
            .resize(1920, null, {
                withoutEnlargement: true,
                fit: 'inside'
            })
            .webp({ quality: 80 })
            .toBuffer();

        // 4. Save proof image (Always .webp now)
        const storageSubDir = `proofs/${mission.guild.discordGuildId}`;
        const uploadDir = join(process.cwd(), "private_uploads", storageSubDir);
        await mkdir(uploadDir, { recursive: true });

        const { randomUUID } = await import("crypto");
        const fileName = `${randomUUID()}.webp`;
        const filePath = join(uploadDir, fileName);

        await writeFile(filePath, optimizedBuffer);
        const proofUrl = `/api/storage/${storageSubDir}/${fileName}`;

        const submission = await db.submission.create({
            data: {
                missionId,
                profileId: profile.id,
                proofUrl: proofUrl,
                status: "PENDING",
                ocrScore: null,
                ocrStatus: "PENDING",
                validatorId: null,
                helpers: {
                    connect: helperIds.map(id => ({ id }))
                }
            }
        });

        // Store hash (anti-duplicate)
        await (db as any).imageHash.create({
            data: {
                guildId: mission.guildId,
                hash: imageHash,
                sourceType: "MISSION",
                sourceId: submission.id,
                uploaderId: session.user.id
            }
        });

        // Notify Validators
        const userName = profile.discordNickname || profile.pseudoDofus || profile.user.name || "Un membre";
        const missionTitle = mission.title || "Mission Inconnue";
        const discordMessageId = await notifyValidators(
            mission.guild.discordGuildId,
            `[Validation] ${userName} - ${missionTitle}`,
            `**${userName}** a posté une preuve pour : **${missionTitle}**`,
            `/dashboard/${mission.guild.discordGuildId}/admin/validation`,
            proofUrl,
            submission.id  // ← pour les custom_id des boutons Discord
        );

        if (discordMessageId) {
            await db.submission.update({
                where: { id: submission.id },
                data: { discordMessageId }
            });
        }

        revalidatePath(`/dashboard/${mission.guild.discordGuildId}/missions`);
        await invalidateCache(`missions:${mission.guild.discordGuildId}:${mission.year}:${mission.weekNumber}`);

        return {
            success: true,
            data: { submissionId: submission.id, status: "PENDING" }
        };
    } catch (error: any) {
        // AUDIT-FUNC-07: Handle race-condition duplicate submission gracefully
        if (error?.code === "P2002") {
            return { success: false, error: "Vous avez déjà une soumission pour cette mission." };
        }
        logger.error("Submit Mission Proof Error", { error, missionId });
        return { success: false, error: "Erreur serveur lors de la soumission" };
    }
}



export async function validateSubmission(
    discordGuildId: string,
    submissionId: string,
    status: "VALIDATED" | "REJECTED"
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    // RATE LIMIT: 20 validations per minute per admin (prevent script abuse)
    const limiter = await rateLimit(`validate_submission:${session.user.id}:${discordGuildId}`, 20, 60 * 1000);
    if (!limiter.success) {
        return { success: false, error: "Trop d'actions de validation. Veuillez patienter un instant." };
    }

    try {
        const submission = await db.submission.findUnique({
            where: { id: submissionId },
            include: {
                mission: { include: { guild: true } },
                helpers: true // Include helpers for point distribution
            }
        });
        if (!submission) return { success: false, error: "Submission not found" };

        const guard = await checkGuildPermission(session, submission.mission.guild.discordGuildId, PERMISSIONS.MISSIONS_OFFICER);
        if (!guard.allowed) return { success: false, error: guard.error };

        // 1. Delete the temp file (if it exists)
        await deleteProofFile(submission.proofUrl);

        // 1.5 Delete image hash to allow re-upload
        await (db as any).imageHash.deleteMany({
            where: {
                guildId: submission.mission.guild.id,
                sourceType: "MISSION",
                sourceId: submissionId
            }
        });

        // 1.6 Delete Discord embed message if present
        if (submission.discordMessageId && submission.discordMessageId.includes(":")) {
            const [channelId, msgId] = submission.discordMessageId.split(":");
            if (channelId && msgId) {
                try {
                    const { deleteChannelMessage } = await import("@/server/discord");
                    await deleteChannelMessage(channelId, msgId);
                } catch (e) {
                    logger.error("Failed to delete Discord validation message", { error: e });
                }
            }
        }

        // 2. Update DB
        const updatedSubmission = await db.submission.update({
            where: { id: submissionId },
            data: {
                status,
                validatorId: session!.user!.id,
                proofUrl: "", // Clear the URL since file is gone
                updatedAt: new Date() // Force update time for stats
            },
            include: {
                profile: { include: { user: true } },
                helpers: true // Need this for point distribution below
            }
        });

        // 3. If validated, award rewards (XP & Guildatons)
        if (status === "VALIDATED") {
            const xpReward = submission.mission.xpReward || 0;
            const guildatonsReward = (submission.mission as any).guildatonsReward || 0;
            await grantRewards(updatedSubmission.profileId, xpReward, guildatonsReward);

            // AWARD CONTRIBUTION POINTS TO HELPERS
            if (updatedSubmission.helpers && updatedSubmission.helpers.length > 0) {
                // R1=5, R2=10, R3=20, R4=50
                const rankPointsMap = { 1: 5, 2: 10, 3: 20, 4: 50 };
                // @ts-ignore
                const points = rankPointsMap[submission.mission.rank] || 5;

                // Bulk update helpers
                await db.userProfile.updateMany({
                    where: { id: { in: updatedSubmission.helpers.map(h => h.id) } },
                    data: { contributionPoints: { increment: points } }
                });
            }
        }

        // 4. Notify User
        if (updatedSubmission.profile.userId) {
            const notifType = status === "VALIDATED" ? "MISSION_VALIDATED" : "MISSION_REJECTED";
            const resultMsg = status === "VALIDATED" ? "validée !" : "refusée.";

            await createNotification(
                updatedSubmission.profile.userId,
                notifType as NotificationType,
                `[Mission] ${submission.mission.title}`,
                `Votre preuve a été ${resultMsg}`,
                undefined,
                discordGuildId
            );
        }


        revalidatePath(`/dashboard/${discordGuildId}/missions`);
        revalidatePath(`/dashboard/${discordGuildId}/ladder`);

        // Invalidate Cache
        await invalidateCache(`missions:${discordGuildId}:${submission.mission.year}:${submission.mission.weekNumber}`);

        // Audit log (Verbose)
        await logAction({
            guildId: discordGuildId,
            action: status === "VALIDATED" ? "MISSION_VALIDATED" : "MISSION_REJECTED",
            targetType: "MISSION",
            targetId: submissionId,
            metadata: {
                operation: status === "VALIDATED" ? "VALIDATE_SUBMISSION" : "REJECT_SUBMISSION",
                missionTitle: submission.mission.title,
                submitterId: updatedSubmission.profileId,
                submitterName: updatedSubmission.profile.pseudoDofus || updatedSubmission.profile.discordNickname || updatedSubmission.profile.user.name,
                status,
                source: "dashboard",
                xpReward: status === "VALIDATED" ? (submission.mission.xpReward || 0) : 0,
                guildatonsReward: status === "VALIDATED" ? ((submission.mission as any).guildatonsReward || 0) : 0,
                helpersCount: updatedSubmission.helpers?.length || 0
            }
        });

        // 🔥 Real-time Discord Update
        await refreshMissionDiscordEmbed(discordGuildId);

        return { success: true };
    } catch (error) {
        console.error("Validation Error:", error);
        return { success: false, error: "Database error" };
    }
}

// --- Helpers ---


/**
 * Calculate the sum of guildatons earned this week by a profile (missions + kamas)
 */
export async function getWeeklyGuildatons(profileId: string, week: number, year: number): Promise<number> {
    const { KAMA_TRANCHE, REWARDS_PER_TRANCHE } = await import("@/lib/kama-constants");

    const [missions, kamas] = await Promise.all([
        db.submission.findMany({
            where: {
                profileId,
                status: "VALIDATED",
                mission: { weekNumber: week, year: year }
            },
            include: { mission: { select: { guildatonsReward: true } } }
        }),
        db.kamaDonation.findMany({
            where: {
                profileId,
                status: "VALIDATED",
                weekNumber: week,
                yearNumber: year
            },
            select: { amount: true }
        })
    ]);

    const fromMissions = missions.reduce((acc, sub) => acc + (sub.mission.guildatonsReward || 0), 0);
    const fromKamas = kamas.reduce((acc, don) => {
        const tranches = Math.floor(don.amount / KAMA_TRANCHE);
        return acc + (tranches * REWARDS_PER_TRANCHE.guildatons);
    }, 0);

    return fromMissions + fromKamas;
}

export async function grantRewards(profileId: string, xp: number, guildatons: number = 0, week?: number, year?: number) {
    if (xp <= 0 && guildatons <= 0) return;

    try {
        let finalGuildatons = guildatons;
        if (guildatons > 0) {
            const { week: currentWeek, year: currentYear } = getDofusWeek();
            const w = week ?? currentWeek;
            const y = year ?? currentYear;

            const currentWeekly = await getWeeklyGuildatons(profileId, w, y);
            const { GUILDATONS_MAX_PER_WEEK } = await import("@/lib/kama-constants");

            if (currentWeekly >= GUILDATONS_MAX_PER_WEEK) {
                finalGuildatons = 0;
            } else if (currentWeekly + guildatons > GUILDATONS_MAX_PER_WEEK) {
                finalGuildatons = GUILDATONS_MAX_PER_WEEK - currentWeekly;
            }
        }
        // 🛡️ CRITICAL UPDATE: Apply the rewards to the database profile
        // Without this, the ladder and profile stats remain stale.
        await db.userProfile.update({
            where: { id: profileId },
            data: {
                xp: { increment: xp },
                guildatons: { increment: finalGuildatons }
            }
        });

        // Invalidate Ladder Cache (since XP/Guildatons changed)
        const profile = await db.userProfile.findUnique({
            where: { id: profileId },
            select: { guild: { select: { discordGuildId: true } } }
        });

        if (profile?.guild?.discordGuildId) {
            const { clearCachePattern } = await import("@/lib/cache");
            await clearCachePattern(`ladder:activity:${profile.guild.discordGuildId}:*`);
            await clearCachePattern(`ladder:guildatons:${profile.guild.discordGuildId}:*`);
            revalidatePath(`/dashboard/${profile.guild.discordGuildId}/ladder`);
            revalidatePath(`/dashboard/${profile.guild.discordGuildId}/stats`); // Recalculate stats too
        }
    } catch (e) {
        console.error(`[Rewards] grantRewards failed for ${profileId}:`, e);
    }
}

/**
 * Allows a member to cancel their own PENDING submission
 */
export async function cancelMySubmission(
    submissionId: string
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    try {
        const submission = await db.submission.findUnique({
            where: { id: submissionId },
            include: {
                profile: true,
                mission: { include: { guild: true } }
            }
        });

        if (!submission) return { success: false, error: "Submission introuvable" };

        // 1. Verify it's the submitter's own submission
        if (submission.profile.userId !== session.user.id) {
            return { success: false, error: "Vous ne pouvez annuler que vos propres soumissions" };
        }

        // 2. Can only cancel PENDING submissions
        if (submission.status !== "PENDING") {
            return { success: false, error: "Seules les soumissions en attente peuvent être annulées" };
        }

        // 3. Delete the proof file
        await deleteProofFile(submission.proofUrl);

        // 3.5 Delete image hash to allow re-upload
        await (db as any).imageHash.deleteMany({
            where: {
                guildId: submission.mission.guild.id,
                sourceType: "MISSION",
                sourceId: submissionId
            }
        });

        // 3.6 Delete Discord embed message if present
        if (submission.discordMessageId && submission.discordMessageId.includes(":")) {
            const [channelId, msgId] = submission.discordMessageId.split(":");
            if (channelId && msgId) {
                try {
                    const { deleteChannelMessage } = await import("@/server/discord");
                    await deleteChannelMessage(channelId, msgId);
                } catch (e) { }
            }
        }

        // 4. Delete the submission
        await db.submission.delete({
            where: { id: submissionId }
        });

        revalidatePath(`/dashboard/${submission.mission.guild.discordGuildId}/missions`);

        // Invalidate Cache
        await invalidateCache(`missions:${submission.mission.guild.discordGuildId}:${submission.mission.year}:${submission.mission.weekNumber}`);

        return { success: true };
    } catch (error) {
        console.error("Cancel Submission Error:", error);
        return { success: false, error: "Database error" };
    }
}


/**
 * Cleanup pending mission submissions older than 48h
 */
export async function cleanupExpiredSubmissions(discordGuildId: string) {
    const EXPIRATION_MS = 48 * 60 * 60 * 1000; // 48 hours
    const thresholdDate = new Date(Date.now() - EXPIRATION_MS);

    try {
        const guild = await db.guildConfig.findUnique({ where: { discordGuildId } });
        if (!guild) return;

        const expired = await db.submission.findMany({
            where: {
                mission: { guildId: guild.id },
                status: "PENDING",
                createdAt: { lt: thresholdDate }
            }
        });

        if (expired.length > 0) {
            for (const sub of expired) {
                if (sub.proofUrl) {
                    await deleteProofFile(sub.proofUrl);
                }
                await db.submission.delete({ where: { id: sub.id } });
            }
            logger.info(`[Cleanup] Deleted ${expired.length} expired mission submissions`, { discordGuildId });
        }
    } catch (error) {
        logger.error("[Cleanup] Mission cleanup error:", { error });
    }
}

/**
 * Get pending submissions for validation
 */
export async function getPendingSubmissions(discordGuildId: string): Promise<ActionResponse<any>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, discordGuildId, PERMISSIONS.MISSIONS_OFFICER);
    if (!guard.allowed) return { success: false, error: guard.error };

    // 🧹 LAZY CLEANUP
    await cleanupExpiredSubmissions(discordGuildId).catch(err => {
        logger.error("[Cleanup] Lazy cleanup failed", { err, discordGuildId });
    });

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({
            where: { discordGuildId },
            select: { id: true, rolesMapping: true }
        });

        const submissions = await db.submission.findMany({
            where: {
                mission: { guildId: guildConfig.id },
                status: "PENDING"
            },
            include: {
                mission: true,
                profile: {
                    select: {
                        id: true,
                        userId: true,
                        discordNickname: true,
                        pseudoDofus: true,
                        classe: true,
                        discordRoleName: true,
                        user: {
                            select: { id: true, name: true, image: true }
                        }
                    }
                },
                helpers: {
                    select: {
                        id: true,
                        pseudoDofus: true,
                        user: {
                            select: { name: true, image: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: "asc" }
        });

        const rolesMapping = (guildConfig.rolesMapping as Record<string, string[]>) || {};

        const enrichedSubmissions = submissions.map(sub => {
            const isAdmin = sub.profile.discordRoleName === "Administrateur" ||
                Object.values(rolesMapping).some(perms => perms.includes("admin:access")) && sub.profile.discordRoleName;

            return {
                ...sub,
                profile: {
                    ...sub.profile,
                    isAdmin: !!isAdmin
                }
            };
        });

        return { success: true, data: enrichedSubmissions };

    } catch (error) {
        logger.error("Fetch Pending Error:", { error, discordGuildId });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function getMissionValidators(guildId: string, missionId: string): Promise<ActionResponse<any>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        // 1. Fetch submissions where status is VALIDATED for this mission
        const submissions = await db.submission.findMany({
            where: {
                missionId,
                status: "VALIDATED",
                mission: { guildId: guildConfig.id }
            },
            include: {
                profile: {
                    select: {
                        id: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true, image: true } }
                    }
                },
                helpers: {
                    select: {
                        id: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true, image: true } }
                    }
                }
            },
            orderBy: { updatedAt: "desc" }
        });

        // Resolve unique validators (profiles + helpers)
        const validatorMap = new Map<string, any>();

        for (const sub of submissions) {
            // Main profile
            if (sub.profile && !validatorMap.has(sub.profile.id)) {
                validatorMap.set(sub.profile.id, {
                    id: sub.profile.id,
                    pseudo: sub.profile.pseudoDofus || sub.profile.discordNickname || sub.profile.user.name,
                    image: sub.profile.user.image,
                    date: sub.updatedAt
                });
            }
            // Helpers
            for (const helper of sub.helpers) {
                if (!validatorMap.has(helper.id)) {
                    validatorMap.set(helper.id, {
                        id: helper.id,
                        pseudo: helper.pseudoDofus || helper.discordNickname || helper.user.name,
                        image: helper.user.image,
                        date: sub.updatedAt
                    });
                }
            }
        }

        const validators = Array.from(validatorMap.values()).sort((a, b) => b.date.getTime() - a.date.getTime());

        return { success: true, data: validators };

    } catch (error) {
        console.error("Fetch Validators Error:", error);
        return { success: false, error: "Erreur BDD" };
    }
}


export async function cancelMissionSubmission(
    missionId: string
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const mission = await db.mission.findUnique({
            where: { id: missionId },
            include: { guild: true }
        });
        if (!mission) return { success: false, error: "Mission not found" };

        const profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: mission.guildId
                }
            }
        });
        if (!profile) return { success: false, error: "Profile not found" };

        const submissions = await db.submission.findMany({
            where: {
                missionId,
                profileId: profile.id,
                status: { in: ["PENDING", "VALIDATED"] }
            }
        });

        for (const sub of submissions) {
            await deleteProofFile(sub.proofUrl);

            // Delete from Discord
            if (sub.discordMessageId && sub.discordMessageId.includes(":")) {
                const [channelId, msgId] = sub.discordMessageId.split(":");
                if (channelId && msgId) {
                    try {
                        const { deleteChannelMessage } = await import("@/server/discord");
                        await deleteChannelMessage(channelId, msgId);
                    } catch (e) { }
                }
            }

            await db.submission.delete({ where: { id: sub.id } });

            // Delete Image Hash to allow retry
            await (db as any).imageHash.deleteMany({
                where: {
                    guildId: mission.guildId,
                    hash: { not: "" }, // Security check
                    sourceType: "MISSION",
                    sourceId: sub.id
                }
            });
        }


        revalidatePath(`/dashboard/${mission.guild.discordGuildId}/missions`);

        // Invalidate Cache
        await invalidateCache(`missions:${mission.guild.discordGuildId}:${mission.year}:${mission.weekNumber}`);

        return { success: true };

    } catch (error) {
        console.error("Cancel Submission Error:", error);
        return { success: false, error: "Database error" };
    }
}

/**
 * Publish a Discord notification about the new weekly missions
 */
export async function publishMissionsToDiscord(
    guildId: string,
    pingType: "EVERYONE" | "ROLE" | "NONE",
    specificRoleId?: string | null
): Promise<ActionResponse> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_OFFICER);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                id: true,
                missionNotifyChannelId: true,
                missionNotifyRoleId: true,
                missionTier: true,
                name: true
            }
        });

        if (!guild?.missionNotifyChannelId) {
            return {
                success: false,
                error: "Salon de notification non configuré. Allez dans Paramètres > Missions."
            };
        }

        const { week, year } = getDofusWeek();
        const missions = await db.mission.findMany({
            where: { guildId: guild.id, weekNumber: week, year }
        });

        if (missions.length === 0) {
            return { success: false, error: "Aucune mission n'est publiée pour cette semaine." };
        }

        const hasEvents = missions.some(m => m.category === "EVENT");
        const missionLabel = hasEvents ? "Missions Classiques et Événements" : "Missions Classiques";

        const currentXP = (await getGuildMissionXpOverride(guildId)).data?.xpOverride || (await calculateDynamicXP(guild.id, guildId));
        const targetTier = guild.missionTier || 3;

        const { formatDiscordTierProgress, formatDiscordMilestones } = await import("@/lib/discord-utils");
        const progressDisplay = formatDiscordTierProgress(currentXP, targetTier);
        const milestonesDisplay = formatDiscordMilestones(currentXP, targetTier);

        // Build mention content
        let mentionContent = "Bonjour à tous !";
        if (pingType === "EVERYONE") mentionContent = "Bonjour @everyone !";
        else if (pingType === "ROLE") {
            const idToMention = specificRoleId || guild.missionNotifyRoleId;
            if (idToMention) mentionContent = `Bonjour <@&${idToMention}> !`;
        }

        const { getAppBaseUrl } = await import("@/lib/utils");
        const dashboardUrl = `${getAppBaseUrl()}/dashboard/${guildId}/missions`;

        const { sendChannelMessage } = await import("@/server/discord");
        const { formatDofusRange } = await import("@/lib/date-utils");

        const messageId = await sendChannelMessage(guild.missionNotifyChannelId, "", {
            mentionContent,
            embedTitle: `📅 Objectifs Hebdomadaires — ${formatDofusRange()}`,
            embedDescription: `## 📋 ${missionLabel}\n\nConsultez le dashboard pour voir le détail des objectifs de la semaine.\n\u200B`,
            embedColor: 0x00f2ff, // Neon Cyan
            embedUrl: dashboardUrl,
            embedFooter: `SigilOS • Système de Gestion de Guilde`,
            fields: [
                {
                    name: "📊 Progression du Palier",
                    value: `${progressDisplay}\n\u200B`,
                    inline: false
                },
                {
                    name: "📍 Jalons de la Semaine",
                    value: `${milestonesDisplay}\n\u200B`,
                    inline: false
                },
                {
                    name: "🔗 Liens Rapides",
                    value: `[Accéder au Dashboard](${dashboardUrl})`,
                    inline: true
                }
            ]
        });

        if (!messageId) {
            return { success: false, error: "L'API Discord n'a pas pu envoyer le message." };
        }

        // Store the message ID for real-time updates
        await db.guildConfig.update({
            where: { id: guild.id },
            data: { missionDiscordMessageId: `${guild.missionNotifyChannelId}:${messageId}` }
        });

        // Audit log
        await logAction({
            guildId,
            action: "MISSION_PUBLISH_DISCORD",
            targetType: "MISSION",
            metadata: { 
                pingType, 
                messageId, 
                channelId: guild.missionNotifyChannelId,
                actorId: session?.user?.id || "system"
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Publish to Discord error:", error);
        return { success: false, error: "Erreur serveur lors de la publication." };
    }
}

// =============================================================================
// [MIS-1] XP PROGRESS BAR OVERRIDE (Admin Manual Adjustment)  
// =============================================================================


/**
 * Shared utility to update the active mission announcement embed on Discord.
 * Called whenever XP changes (validation, kama donation, manual adjustment).
 */
export async function refreshMissionDiscordEmbed(discordGuildId: string) {
    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { 
                id: true, 
                missionDiscordMessageId: true,
                missionTier: true,
                missionNotifyChannelId: true
            }
        });

        if (!guild?.missionDiscordMessageId) return;

        const [channelId, messageId] = guild.missionDiscordMessageId.split(":");
        if (!channelId || !messageId) return;

        const { week, year } = getDofusWeek();
        
        // Fetch missions to determine labels
        const missions = await db.mission.findMany({
            where: { guildId: guild.id, weekNumber: week, year }
        });
        
        const hasEvents = missions.some(m => m.category === "EVENT");
        const missionLabel = hasEvents ? "Missions Classiques et Événements" : "Missions Classiques";

        // Calculate XP (Direct DB access to avoid session/auth dependency in background refresh)
        const xpData = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { missionWeekXpOverride: true, id: true }
        });
        
        const dynamicXP = await calculateDynamicXP(guild.id, discordGuildId);
        const currentXP = xpData?.missionWeekXpOverride !== null 
            ? (xpData?.missionWeekXpOverride || 0) + dynamicXP 
            : dynamicXP;
            
        const targetTier = guild.missionTier || 3;

        const { formatDiscordTierProgress, formatDiscordMilestones } = await import("@/lib/discord-utils");
        const progressDisplay = formatDiscordTierProgress(currentXP, targetTier);
        const milestonesDisplay = formatDiscordMilestones(currentXP, targetTier);

        const { getAppBaseUrl } = await import("@/lib/utils");
        const dashboardUrl = `${getAppBaseUrl()}/dashboard/${discordGuildId}/missions`;
        const { updateChannelMessage } = await import("@/server/discord");
        const { formatDofusRange } = await import("@/lib/date-utils");

        await updateChannelMessage(channelId, messageId, "", {
            embedTitle: `📅 Objectifs Hebdomadaires — ${formatDofusRange()}`,
            embedDescription: `## 📋 ${missionLabel}\n\nConsultez le dashboard pour voir le détail des objectifs de la semaine.\n\u200B`,
            embedColor: 0x00f2ff, // Neon Cyan
            embedUrl: dashboardUrl,
            embedFooter: `SigilOS • Système de Gestion de Guilde`,
            fields: [
                {
                    name: "📊 Progression du Palier",
                    value: `${progressDisplay}\n\u200B`,
                    inline: false
                },
                {
                    name: "📍 Jalons de la Semaine",
                    value: `${milestonesDisplay}\n\u200B`,
                    inline: false
                },
                {
                    name: "🔗 Liens Rapides",
                    value: `[Accéder au Dashboard](${dashboardUrl})`,
                    inline: true
                }
            ]
        });
    } catch (e) {
        console.error("[Discord] refreshMissionDiscordEmbed failed:", e);
    }
}

export async function calculateDynamicXP(guildInternalId: string, discordGuildId: string): Promise<number> {
    const { week, year } = getDofusWeek();
    
    // 1. Mission XP
    const missions = await db.mission.findMany({
        where: { guildId: guildInternalId, weekNumber: week, year },
        include: { _count: { select: { submissions: { where: { status: 'VALIDATED' } } } } }
    });
    const missionXP = missions.reduce((acc, m) => acc + (m.xpReward || 0) * m._count.submissions, 0);

    // 2. Kama XP
    let kamaXP = 0;
    const kamaStatsRes = await getKamaStats(discordGuildId);
    if (kamaStatsRes.success && kamaStatsRes.data) {
        const { KAMA_TRANCHE, REWARDS_PER_TRANCHE } = await import("@/lib/kama-constants");
        const validatedWeeklyKamas = kamaStatsRes.data.weeklyTotal || 0;
        const validatedTranches = Math.floor(validatedWeeklyKamas / KAMA_TRANCHE);
        kamaXP = validatedTranches * REWARDS_PER_TRANCHE.xp;
    }

    return missionXP + kamaXP;
}

const XpOverrideSchema = z.object({
    guildId: z.string().min(1),
    xpOverride: z.number().int().min(0).max(1_000_000).nullable(),
}).strict();

export async function setGuildMissionXpOverride(
    rawData: z.infer<typeof XpOverrideSchema>
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

    const parsed = XpOverrideSchema.safeParse(rawData);
    if (!parsed.success) return { success: false, error: "Donnees invalides" };
    const { guildId, xpOverride } = parsed.data;

    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_OFFICER);
    if (!guard.allowed) return { success: false, error: guard.error };

    const limiter = await rateLimit(`xp_override:${session.user.id}:${guildId}`, 10, 60 * 1000);
    if (!limiter.success) return { success: false, error: "Trop d actions. Veuillez patienter." };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        let finalBaseOverride: number | null = null;
        if (xpOverride !== null) {
            const dynamicXP = await calculateDynamicXP(guild.id, guildId);
            finalBaseOverride = xpOverride - dynamicXP; // Deduct auto points to act as base
        }

        await db.guildConfig.update({
            where: { id: guild.id },
            data: { missionWeekXpOverride: finalBaseOverride } as any
        });

        await logAction({
            guildId,
            action: "MISSION_XP_OVERRIDE",
            targetType: "CONFIG",
            metadata: { operation: "SET_MISSION_XP_OVERRIDE", targetTotalXp: xpOverride, baseOverrideComputed: finalBaseOverride, cleared: xpOverride === null }
        });

        revalidatePath(`/dashboard/${guildId}/missions/manage`);

        // 🔥 Real-time Discord Update
        await refreshMissionDiscordEmbed(guildId);

        return {
            success: true,
            data: { message: xpOverride === null ? "Override supprime" : `XP fixe a ${xpOverride.toLocaleString()}` }
        };
    } catch (error) {
        logger.error("setGuildMissionXpOverride Error", { error, guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function getGuildMissionXpOverride(
    guildId: string
): Promise<ActionResponse<{ xpOverride: number | null, realXp: number }>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, missionWeekXpOverride: true } as any
        }) as unknown as { id: string, missionWeekXpOverride: number | null } | null;
        
        if (!guild) {
             return { success: false, error: "Guilde introuvable" };
        }

        const dynamicXP = await calculateDynamicXP(guild.id, guildId);

        if (guild.missionWeekXpOverride === null) {
            return { success: true, data: { xpOverride: null, realXp: dynamicXP } };
        }

        const totalXP = guild.missionWeekXpOverride + dynamicXP; // Base + Generated
        
        return { success: true, data: { xpOverride: totalXP, realXp: dynamicXP } };
    } catch (error) {
        logger.error("getGuildMissionXpOverride Error", { error, guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function getMissionsByIds(ids: string[]) {
    try {
        const missions = await db.mission.findMany({
            where: { id: { in: ids } }
        });
        // Ensure safe JSON serialization
        return JSON.parse(JSON.stringify(missions));
    } catch (error) {
        console.error("getMissionsByIds Error:", error);
        return [];
    }
}