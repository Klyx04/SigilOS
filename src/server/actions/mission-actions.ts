"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { PERMISSIONS, type PermissionId } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MissionCategory, Prisma, NotificationType } from "@prisma/client";
import { createNotification } from "@/server/actions/notification-actions";
import { unlink } from "fs/promises";
import { join } from "path";

// --- Types & Schemas ---

export type ActionResponse<T = null> = {
    success: boolean;
    error?: string;
    data?: T;
};

const MissionSchema = z.object({
    slotIndex: z.number().min(0).max(11),
    // Use string enum for safer runtime validation vs Prisma object
    category: z.enum(["DONJON", "REGULATION", "ANOMALIE", "SONGES", "EXPEDITION", "EVENT"]),
    tier: z.number().min(1).max(5), // Palier 1-5 (Dofus Update)
    xpReward: z.number().min(0).default(0),
    guildatonsReward: z.number().min(0).default(0),
    title: z.string().optional(),
    payload: z.record(z.any()), // Flexible JSON payload
});

const CreateWeekSchema = z.object({
    guildId: z.string(),
    weekNumber: z.number().min(1).max(53),
    year: z.number().min(2025),
    missions: z.array(MissionSchema).min(1).max(12),
});

// --- Helper: Permission Guard ---

async function internalCheckPermission(
    guildId: string,
    discordUserId: string,
    permission: PermissionId
): Promise<boolean> {
    try {
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guildConfig) return false;

        const { fetchGuildMember, fetchGuildRoles, fetchGuild } = await import("@/server/discord");
        const member = await fetchGuildMember(guildId, discordUserId);
        if (!member) return false;

        const guildInfo = await fetchGuild(guildId);
        if (guildInfo.owner_id === discordUserId) return true;

        const guildRoles = await fetchGuildRoles(guildId);
        const memberRoles = guildRoles.filter(r => member.roles.includes(r.id));
        const isDiscordAdmin = memberRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);
        if (isDiscordAdmin) return true;

        const mapping = guildConfig.rolesMapping as Record<string, PermissionId[]>;
        return member.roles.some(roleId => {
            const perms = mapping[roleId];
            return perms?.includes(permission);
        });
    } catch (e) {
        console.error(`[InternalPermissionCheck] Error for ${discordUserId}:`, e);
        return false;
    }
}

export async function checkGuildPermission(
    session: any,
    guildId: string,
    permission: PermissionId
): Promise<{ allowed: boolean; error?: string }> {
    if (!session?.user?.id) return { allowed: false, error: "Unauthorized" };

    const account = await db.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
        select: { providerAccountId: true }
    });
    if (!account) return { allowed: false, error: "No Discord account linked" };

    const allowed = await internalCheckPermission(guildId, account.providerAccountId, permission);

    if (allowed) return { allowed: true };
    return { allowed: false, error: "Insufficient Permissions" };
}

// --- Helper: Notification ---
async function notifyValidators(guildId: string, title: string, message: string, link?: string) {
    console.log(`[Notification] notifyValidators called for guild ${guildId}`);
    try {
        const { fetchGuild } = await import("@/server/discord");
        const guildInfo = await fetchGuild(guildId);

        if (!guildInfo) {
            console.error(`[Notification] Guild info not found for ${guildId}`);
            return;
        }
        if (!guildInfo.owner_id) {
            console.error(`[Notification] Guild owner_id missing for ${guildId}`);
            return;
        }

        console.log(`[Notification] Guild Owner ID (Discord): ${guildInfo.owner_id}`);

        // Find owner user internally
        const account = await db.account.findFirst({
            where: {
                provider: "discord",
                providerAccountId: guildInfo.owner_id
            },
            select: { userId: true }
        });

        if (account) {
            console.log(`[Notification] Found internal user ${account.userId} for owner. Creating notification...`);
            await createNotification(
                account.userId,
                "NEW_SUBMISSION_PENDING",
                title,
                message,
                link
            );
            console.log(`[Notification] Notification created.`);
        } else {
            console.warn(`[Notification] Internal account not found for Discord Owner ID ${guildInfo.owner_id}`);
        }
    } catch (e) {
        console.error("Notify Validators Error:", e);
    }
}

// --- Helper: Deletion ---
// --- Helper: Deletion ---
async function deleteProofFile(proofUrl: string) {
    const isLocalUpload = proofUrl && proofUrl.startsWith("/uploads/proofs/");

    if (!isLocalUpload) return;

    try {
        // defined in upload route: /uploads/proofs/... -> public/uploads/proofs/...
        const relativePath = proofUrl.replace(/^\//, "");
        const absolutePath = join(process.cwd(), "public", relativePath);

        await unlink(absolutePath);
        console.log(`[Cleanup] Deleted file: ${absolutePath}`);

        // Note: Empty directories (guild/mission folders) might remain. 
        // This is acceptable as they are lightweight and reused.

    } catch (error: any) {
        // Ignore ENOENT (File not found), warn on others
        if (error.code !== "ENOENT") {
            console.warn(`[Cleanup] Failed to delete file ${proofUrl}:`, error);
        }
    }
}


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
        console.error("[DEBUG] createWeekMissions - Permission denied:", guard.error);
        return { success: false, error: guard.error };
    }

    try {
        await db.$transaction(async (tx) => {
            const guild = await tx.guildConfig.findUniqueOrThrow({
                where: { discordGuildId: data.guildId }
            });

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
                        xpReward: m.xpReward,
                        guildatonsReward: m.guildatonsReward,
                        title: m.title,
                        payload: m.payload as Prisma.InputJsonValue
                    }
                });
            }
        });

        revalidatePath(`/dashboard/${data.guildId}/missions`);
        return { success: true };
    } catch (error) {
        console.error("Create Missions Error Full:", error);
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
        return { success: true };
    } catch (error) {
        console.error("Reset Mission Error:", error);
        return { success: false, error: "Reset Failed" };
    }
}

export async function resetWeek(
    guildId: string,
    weekNumber: number,
    year: number
): Promise<ActionResponse> {
    const session = await auth();
    console.log(`[ResetWeek] Attempting reset for Week ${weekNumber}, Year ${year} in Guild ${guildId}`);

    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_CREATE);
    if (!guard.allowed) {
        console.error(`[ResetWeek] Permission denied: ${guard.error}`);
        return { success: false, error: guard.error };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId }
        });

        if (!guildConfig) {
            console.error(`[ResetWeek] Guild config not found for discordId: ${guildId}`);
            return { success: false, error: "Guilde non configurée" };
        }

        console.log(`[ResetWeek] Found internal guildId: ${guildConfig.id}. Proceeding to delete missions...`);

        const deleteResult = await db.mission.deleteMany({
            where: {
                guildId: guildConfig.id,
                weekNumber,
                year
            }
        });

        console.log(`[ResetWeek] Deleted ${deleteResult.count} missions.`);

        revalidatePath(`/dashboard/${guildId}/missions`);
        revalidatePath(`/dashboard/${guildId}/missions/manage`);
        return { success: true };
    } catch (error) {
        console.error("[ResetWeek] Critical Error:", error);
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
        console.error("[DEBUG] getWeekMissions - Permission denied:", guard.error);
        return { success: false, error: guard.error };
    }

    try {
        const guildConfig = await db.guildConfig.findUniqueOrThrow({
            where: { discordGuildId: guildId }
        });

        const missions = await db.mission.findMany({
            where: {
                guildId: guildConfig.id,
                weekNumber,
                year
            },
            include: {
                interests: {
                    include: {
                        profile: {
                            include: { user: true }
                        }
                    } // Include user for Discord name fallback
                },
                submissions: {
                    where: { profile: { userId: session!.user!.id } },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { slotIndex: 'asc' } // Sort by Slot Index for consistent grid
        });

        return { success: true, data: missions };
    } catch (error) {
        console.error("Fetch Missions Error Full:", error);
        return { success: false, error: "Failed to fetch missions: " + (error instanceof Error ? error.message : String(error)) };
    }
}

export async function toggleMissionInterest(
    missionId: string
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        console.log(`[DEBUG] ToggleInterest - User: ${session.user.id}, Mission: ${missionId}`);

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
            console.error(`[DEBUG] Profile not found for userId: ${session.user.id} and guildId: ${mission.guildId}`);
            return { success: false, error: "Profile null ou inexistant pour cette guilde." };
        }

        console.log(`[DEBUG] Profile found: ${profile.id}, attempting toggle...`);

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
            console.log(`[DEBUG] Interest removed for profile: ${profile.id}`);
        } else {
            await db.missionInterest.create({
                data: {
                    missionId,
                    profileId: profile.id
                }
            });
            console.log(`[DEBUG] Interest added for profile: ${profile.id}`);
        }

        revalidatePath(`/dashboard/${mission.guild.discordGuildId}/missions`);
        return { success: true };

    } catch (error) {
        console.error("Toggle Interest Error:", error);
        return { success: false, error: "Database error" };
    }
}

export async function submitMissionProof(
    missionId: string,
    proofUrl: string | null, // Allow null for auto-validation
    ocrScore?: number,
    ocrResult?: {
        matchedElements?: string[];
        missingElements?: string[];
        isValid?: boolean;
        categoryMatch?: boolean;
        contentMatch?: boolean;
        victoryDetected?: boolean;
        confidence?: number;
    }
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const mission = await db.mission.findUnique({
            where: { id: missionId },
            include: { guild: true }
        });
        if (!mission) return { success: false, error: "Mission not found" };

        if (mission.status !== "ACTIVE") return { success: false, error: "Mission is not active" };

        const guard = await checkGuildPermission(session, mission.guild.discordGuildId, PERMISSIONS.MISSIONS_VIEW);
        if (!guard.allowed) return { success: false, error: guard.error };

        const profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: mission.guildId
                }
            },
            include: { user: true }
        });
        if (!profile) return { success: false, error: "Profile not found" };

        // Auto-validation logic...
        const autoValidateThreshold = parseInt(process.env.OCR_AUTO_VALIDATE_THRESHOLD || "95", 10);
        const ocrIsValid = ocrResult?.isValid ?? false;
        const shouldAutoValidate = ocrIsValid && ocrScore !== undefined && ocrScore >= autoValidateThreshold;

        // Ensure proofUrl exists if NOT auto-validated
        if (!shouldAutoValidate && !proofUrl) {
            return { success: false, error: "Une preuve est requise pour validation manuelle." };
        }

        await db.submission.create({
            data: {
                missionId,
                profileId: profile.id,
                proofUrl: proofUrl ?? "",
                status: shouldAutoValidate ? "VALIDATED" : "PENDING",
                ocrScore: ocrScore ?? null,
                ocrResult: ocrResult ? (ocrResult as Prisma.InputJsonValue) : Prisma.DbNull,
                ocrStatus: ocrScore !== undefined ? "COMPLETED" : "PENDING",
                validatorId: shouldAutoValidate ? "SYSTEM_OCR" : null
            }
        });

        // Notify Validators
        const userName = profile.user.name || "Un membre";
        const missionTitle = mission.title || "Mission Inconnue";
        const missionInfo = `${mission.category} T${mission.tier}`;

        await notifyValidators(
            mission.guild.discordGuildId,
            `[Validation] ${userName} - ${missionTitle}`,
            `${userName} a posté une preuve pour : ${missionTitle} (${missionInfo}).`,
            `/dashboard/${mission.guild.discordGuildId}/missions/validation`
        );

        revalidatePath(`/dashboard/${mission.guild.discordGuildId}/missions`);
        return { success: true };
    } catch (error) {
        console.error("Submission Error:", error);
        return { success: false, error: "Database error" };
    }
}

export async function validateSubmission(
    submissionId: string,
    status: "VALIDATED" | "REJECTED"
): Promise<ActionResponse> {
    const session = await auth();
    try {
        const submission = await db.submission.findUnique({
            where: { id: submissionId },
            include: { mission: { include: { guild: true } } }
        });
        if (!submission) return { success: false, error: "Submission not found" };

        const guard = await checkGuildPermission(session, submission.mission.guild.discordGuildId, PERMISSIONS.MISSIONS_VALIDATE);
        if (!guard.allowed) return { success: false, error: guard.error };

        // 1. Delete the temp file (if it exists)
        await deleteProofFile(submission.proofUrl);

        // 2. Update DB
        const updatedSubmission = await db.submission.update({
            where: { id: submissionId },
            data: {
                status,
                validatorId: session!.user!.id,
                proofUrl: "" // Clear the URL since file is gone
            },
            include: { profile: true }
        });

        // 3. Notify User
        if (updatedSubmission.profile.userId) {
            const notifType = status === "VALIDATED" ? "MISSION_VALIDATED" : "MISSION_REJECTED";
            const resultMsg = status === "VALIDATED" ? "validée !" : "refusée.";

            await createNotification(
                updatedSubmission.profile.userId,
                notifType as NotificationType,
                `Mission ${resultMsg}`,
                `Votre preuve pour la mission "${submission.mission.title || 'Mission'}" a été ${status === "VALIDATED" ? "acceptée" : "rejetée"}.`,
                `/dashboard/${submission.mission.guild.discordGuildId}/missions`
            );
        }

        revalidatePath(`/dashboard/${submission.mission.guild.discordGuildId}/missions`);
        return { success: true };
    } catch (error) {
        console.error("Validation Error:", error);
        return { success: false, error: "Database error" };
    }
}


export async function cleanupExpiredSubmissions(guildId: string) {
    // 48 hours expiration
    const EXPIRATION_MS = 48 * 60 * 60 * 1000;
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
            console.log(`[Cleanup] Found ${expiredSubmissions.length} expired pending submissions for guild ${guildId}`);
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
            where: { discordGuildId: guildId }
        });

        const submissions = await db.submission.findMany({
            where: {
                mission: { guildId: guildConfig.id },
                status: "PENDING"
            },
            include: {
                mission: true,
                profile: { include: { user: true } } // Get User details (name, image)
            },
            orderBy: { createdAt: "asc" }
        });

        return { success: true, data: submissions };

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
        }

        revalidatePath(`/dashboard/${mission.guild.discordGuildId}/missions`);
        return { success: true };

    } catch (error) {
        console.error("Cancel Submission Error:", error);
        return { success: false, error: "Database error" };
    }
}
