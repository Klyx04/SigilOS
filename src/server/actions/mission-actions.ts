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
import { createAuditLog } from "@/server/actions/audit-actions";


// --- Types & Schemas ---

export type ActionResponse<T = any> = {
    success: boolean;
    error?: string;
    data?: T;
};


const MissionSchema = z.object({
    slotIndex: z.number().min(0).max(11),
    category: z.enum(["DONJON", "REGULATION", "ANOMALIE", "SONGES", "EXPEDITION", "EVENT"]),
    tier: z.number().min(1).max(5),
    rank: z.number().min(1).max(4).default(1),
    xpReward: z.number().min(0).default(0),
    guildatonsReward: z.number().min(0).default(0),
    title: z.string().optional(),
    payload: z.record(z.any()),
}).strict(); // Enforce NO extra fields (2026 Security)

const CreateWeekSchema = z.object({
    guildId: z.string(),
    weekNumber: z.number().min(1).max(53),
    year: z.number().min(2025),
    missions: z.array(MissionSchema).min(1).max(12),
    updateGuildTier: z.number().min(1).max(5).optional(),
    notifyMembers: z.boolean().optional(),
}).strict();

async function notifyValidators(guildId: string, title: string, message: string, link?: string) {
    try {
        const { fetchGuild } = await import("@/server/discord");
        const guildInfo = await fetchGuild(guildId);

        if (!guildInfo) {
            logger.error("[Notification] Guild info not found", { guildId });
            return;
        }
        if (!guildInfo.owner_id) {
            logger.error("[Notification] Guild owner_id missing", { guildId });
            return;
        }

        // Find owner user internally
        const account = await db.account.findFirst({
            where: {
                provider: "discord",
                providerAccountId: guildInfo.owner_id
            },
            select: { userId: true }
        });

        if (account) {
            await createNotification(
                account.userId,
                "NEW_SUBMISSION_PENDING",
                title,
                message,
                link,
                guildId
            );
        }
    } catch (e) {
        logger.error("Notify Validators Error", { error: e });
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
    if (!validation.success) return { success: false, error: "Invalid Data" };
    const data = validation.data;

    // 2. Auth & Permission
    const guard = await checkGuildPermission(session, data.guildId, PERMISSIONS.MISSIONS_CREATE);
    if (!guard.allowed) {
        logger.error("createWeekMissions - Permission denied", { error: guard.error, guildId: data.guildId, userId: session?.user?.id });
        return { success: false, error: guard.error };
    }

    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // 3. RATE LIMIT: 5 creations per minute per admin
    const limiter = await rateLimit(`create_missions:${session.user.id}:${data.guildId}`, 5, 60 * 1000);
    if (!limiter.success) return { success: false, error: "Trop d'actions. Veuillez patienter un instant." };

    try {
        await db.$transaction(async (tx) => {
            // DEEP ISOLATION: Ensure we only touch the specific discordGuildId provided
            const guild = await tx.guildConfig.findUniqueOrThrow({
                where: { discordGuildId: data.guildId }
            });

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
                    await tx.notification.createMany({
                        data: activeProfiles.map(p => ({
                            userId: p.userId,
                            title: "🎯 Nouvel objectif hebdomadaire",
                            message: `Les missions de la Semaine ${data.weekNumber} sont disponibles !`,
                            type: "SYSTEM_INFO",
                            link: `/dashboard/${data.guildId}/missions`
                        }))
                    });
                }
            }
        });

        revalidatePath(`/dashboard/${data.guildId}/missions`);
        revalidatePath(`/dashboard/${data.guildId}/missions/manage`);

        // Invalidate Cache
        await invalidateCache(`missions:${data.guildId}:${data.year}:${data.weekNumber}`);

        // Audit log
        await createAuditLog({
            guildId: data.guildId,
            actorUserId: session!.user!.id,
            actorName: session!.user!.name || "Admin",
            action: "MISSION_CREATED" as any,
            targetType: "MISSION" as any,
            metadata: {
                weekNumber: data.weekNumber,
                year: data.year,
                slotsCount: data.missions.length,
                tier: data.updateGuildTier
            }
        });

        return { success: true };
    } catch (error) {
        logger.error("Create Missions Error", { error, guildId: data.guildId, weekNumber: data.weekNumber, year: data.year });
        return { success: false, error: "Database transaction failed: " + (error instanceof Error ? error.message : "Unknown") };
    }
}

export async function resetMission(
    guildId: string,
    weekNumber: number,
    year: number,
    slotIndex: number
): Promise<ActionResponse> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_CREATE);
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
        await createAuditLog({
            guildId,
            actorUserId: session?.user?.id ?? "unknown",
            actorName: session?.user?.name || "Admin",
            action: "MISSION_DELETED",
            targetType: "MISSION",
            metadata: { weekNumber, year, slotIndex }
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

    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_CREATE);
    if (!guard.allowed) {
        logger.error("ResetWeek - Permission denied", { error: guard.error, guildId });
        return { success: false, error: guard.error };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });

        if (!guildConfig) {
            return { success: false, error: "Guilde non configurée" };
        }

        await db.mission.deleteMany({
            where: {
                guildId: guildConfig.id,
                weekNumber,
                year
            }
        });

        revalidatePath(`/dashboard/${guildId}/missions`);
        revalidatePath(`/dashboard/${guildId}/missions/manage`);

        // Invalidate Cache
        await invalidateCache(`missions:${guildId}:${year}:${weekNumber}`);

        // Audit log
        await createAuditLog({
            guildId,
            actorUserId: session?.user?.id ?? "unknown",
            actorName: session?.user?.name || "Admin",
            action: "MISSION_DELETED",
            targetType: "MISSION",
            metadata: { weekNumber, year, scope: "FULL_WEEK" }
        });

        return { success: true };
    } catch (error) {
        logger.error("ResetWeek Critical Error", { error, guildId, weekNumber, year });
        return { success: false, error: "Failed to reset week" };
    }
}

export async function getWeekMissions(
    guildId: string,
    weekNumber: number,
    year: number
): Promise<ActionResponse<any>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_VIEW);
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

        // Merge submissions into cached missions and ensure plain objects
        const enrichedMissions = missions.map(m => ({
            ...m,
            // Spread relations to break Prisma prototype chain (which causes "not a plain object" error)
            interests: m.interests.map(i => ({
                ...i,
                profile: {
                    ...i.profile,
                    user: i.profile.user ? { ...i.profile.user } : null
                }
            })),
            submissions: userSubmissions.filter(s => s.missionId === m.id).slice(0, 1).map(s => ({ ...s }))
        }));

        // FINAL SAFEGUARD: Force pure JSON object to strip any remaining hidden properties/symbols
        // This is necessary because Prisma JSON fields or hidden symbols can cause "Not a plain object" errors in Client Components
        return { success: true, data: JSON.parse(JSON.stringify(enrichedMissions)) };
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

        const guard = await checkGuildPermission(session, mission.guild.discordGuildId, PERMISSIONS.MISSIONS_VIEW);
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

export async function submitMissionProof(
    missionId: string,
    imageData: string, // Base64 image data from client
    helperIds: string[] = [] // IDs of UserProfile
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

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

        const guard = await checkGuildPermission(session, mission.guild.discordGuildId, PERMISSIONS.MISSIONS_VIEW);
        if (!guard.allowed) return { success: false, error: guard.error };

        const profile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: session.user.id, guildId: mission.guildId } },
            include: { user: true }
        });
        if (!profile) return { success: false, error: "Profil introuvable" };

        // 1. Double check for existing submission
        const existing = await db.submission.findFirst({
            where: { missionId, profileId: profile.id, status: { in: ["PENDING", "VALIDATED"] } }
        });
        if (existing) return { success: false, error: "Vous avez déjà une soumission pour cette mission." };

        // 1.5 Validate Helpers
        if (helperIds.length > 7) return { success: false, error: "Maximum 7 aidants autorisés." };
        if (helperIds.includes(profile.id)) return { success: false, error: "Vous ne pouvez pas vous ajouter comme aidant." };


        // 2. OCR Processing
        const base64Data = imageData.split(',')[1];
        if (!base64Data) return { success: false, error: "Données d'image corrompues." };

        const buffer = Buffer.from(base64Data, 'base64');

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
        const imageHash = hashImage(base64Data);
        const existingHash = await (db as any).imageHash.findUnique({
            where: { guildId_hash: { guildId: mission.guildId, hash: imageHash } }
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
        const uploadRelativeDir = `uploads/proofs/${mission.guild.discordGuildId}`;
        const uploadDir = join(process.cwd(), "public", uploadRelativeDir);
        await mkdir(uploadDir, { recursive: true });

        const fileName = `${session.user.id}-${Date.now()}.webp`;
        const filePath = join(uploadDir, fileName);

        await writeFile(filePath, optimizedBuffer);
        const proofUrl = `/${uploadRelativeDir}/${fileName}`;

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
        const userName = profile.user.name || "Un membre";
        const missionTitle = mission.title || "Mission Inconnue";
        await notifyValidators(
            mission.guild.discordGuildId,
            `[Validation] ${userName} - ${missionTitle}`,
            `${userName} a posté une preuve pour : ${missionTitle}`,
            `/dashboard/${mission.guild.discordGuildId}/admin/validation`
        );

        revalidatePath(`/dashboard/${mission.guild.discordGuildId}/missions`);
        await invalidateCache(`missions:${mission.guild.discordGuildId}:${mission.year}:${mission.weekNumber}`);

        return {
            success: true,
            data: { submissionId: submission.id, status: "PENDING" }
        };
    } catch (error) {
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

        const guard = await checkGuildPermission(session, submission.mission.guild.discordGuildId, PERMISSIONS.MISSIONS_VALIDATE);
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
                profile: true,
                helpers: true // Need this for point distribution below
            }
        });

        // 3. If validated, add XP to user profile
        if (status === "VALIDATED") {
            const xpReward = submission.mission.xpReward || 0;
            await addProfileXp(updatedSubmission.profileId, xpReward);

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

        // Audit log
        await createAuditLog({
            guildId: discordGuildId,
            actorUserId: session.user.id,
            actorName: session.user.name || "Admin",
            action: (status === "VALIDATED" ? "MISSION_VALIDATED" : "MISSION_REJECTED") as any,
            targetType: "MISSION" as any,
            targetId: submissionId,
            metadata: {
                missionTitle: submission.mission.title,
                submitterId: updatedSubmission.profileId,
                status
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Validation Error:", error);
        return { success: false, error: "Database error" };
    }
}

// --- Helpers ---

async function addProfileXp(profileId: string, amount: number) {
    if (amount <= 0) return;

    try {
        const profile = await db.userProfile.findUnique({
            where: { id: profileId },
            select: { xp: true }
        });

        if (!profile) return;

        await db.userProfile.update({
            where: { id: profileId },
            data: { xp: (profile.xp || 0) + amount }
        });
    } catch (e) {
        console.error(`[XP] Failed to add XP to profile ${profileId}:`, e);
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


export async function cleanupExpiredSubmissions(guildId: string) {
    // 24 hours expiration
    const EXPIRATION_MS = 24 * 60 * 60 * 1000;
    const thresholdDate = new Date(Date.now() - EXPIRATION_MS);

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });
        if (!guildConfig) return;

        const expiredSubmissions = await db.submission.findMany({
            where: {
                mission: { guildId: guildConfig.id },
                status: "PENDING",
                createdAt: { lt: thresholdDate }
            }
        });

        if (expiredSubmissions.length > 0) {
            for (const sub of expiredSubmissions) {
                // Delete file
                await deleteProofFile(sub.proofUrl);
                // Delete submission to reset state for user
                await db.submission.delete({ where: { id: sub.id } });
            }
        }
    } catch (error) {
        console.error("[Cleanup] Error:", error);
    }
}

export async function getPendingSubmissions(guildId: string): Promise<ActionResponse<any>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_VALIDATE);
    if (!guard.allowed) return { success: false, error: guard.error };

    // Lazy Cleanup
    await cleanupExpiredSubmissions(guildId);

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({
            where: { discordGuildId: guildId },
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

        // Enrich submissions with isAdmin flag
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
        console.error("Fetch Pending Error:", error);
        return { success: false, error: "Database error" };
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
    // Security check: Must have permission to manage missions
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_CREATE);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                id: true,
                missionNotifyChannelId: true,
                missionNotifyRoleId: true,
                name: true
            }
        });

        if (!guild?.missionNotifyChannelId) {
            return {
                success: false,
                error: "Salon de notification non configuré. Allez dans Paramètres > Missions."
            };
        }

        // Build mention content
        let mention = "";
        if (pingType === "EVERYONE") mention = "@everyone";
        else if (pingType === "ROLE") {
            const idToMention = specificRoleId || guild.missionNotifyRoleId;
            if (idToMention) mention = `<@&${idToMention}>`;
        }

        const dashboardUrl = `${process.env.NEXTAUTH_URL}/dashboard/${guildId}/missions`;

        // We use lazy import to avoid circular dependencies if any, 
        // though server-to-server usually is fine.
        const { sendChannelMessage } = await import("@/server/discord");

        const messageId = await sendChannelMessage(guild.missionNotifyChannelId, mention, {
            embedTitle: "🎯 Nouvel objectif hebdomadaire",
            embedColor: 0x9333ea, // Purple
            embedUrl: dashboardUrl,
            embedFooter: "SigilOS • Système de Missions",
            embedThumbnail: "https://i.imgur.com/8N4pWvW.png", // Typical mission icon
            fields: [
                {
                    name: "Statut",
                    value: "✅ Les **12 missions** de la semaine sont disponibles !",
                    inline: false
                },
                {
                    name: "Action",
                    value: `[Consulter les missions sur le Dashboard](${dashboardUrl})`,
                    inline: false
                }
            ]
        });

        if (!messageId) {
            return { success: false, error: "L'API Discord n'a pas pu envoyer le message." };
        }

        // Audit log
        await createAuditLog({
            guildId,
            actorUserId: session!.user!.id!,
            actorName: session!.user!.name || "Admin",
            action: "MISSION_PUBLISH_DISCORD",
            targetType: "MISSION",
            metadata: { pingType, messageId, channelId: guild.missionNotifyChannelId }
        });

        return { success: true };

    } catch (error) {
        console.error("Publish to Discord error:", error);
        return { success: false, error: "Erreur serveur lors de la publication." };
    }
}
