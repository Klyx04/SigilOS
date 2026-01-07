'use server'

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { PERMISSIONS, type PermissionId } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MissionCategory, Prisma } from "@prisma/client";

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

export async function checkGuildPermission(
    session: any,
    guildId: string,
    permission: PermissionId
): Promise<{ allowed: boolean; error?: string }> {
    console.log(`[PermissionCheck] Checking ${permission} for user ${session?.user?.id} in guild ${guildId}`);
    if (!session?.user?.id) return { allowed: false, error: "Unauthorized" };

    // 1. Fetch User Discord Account
    const account = await db.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
        select: { providerAccountId: true }
    });
    if (!account) return { allowed: false, error: "No Discord account linked" };
    const discordUserId = account.providerAccountId;

    // 2. Fetch Guild Config
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId }
    });
    // console.log("[DEBUG] checkGuildPermission - Guild Config:", guildConfig ? "Found" : "Not Found");
    if (!guildConfig) return { allowed: false, error: "Guild not configured in SigilOS" };

    // 3. Admin/Owner Override
    const { fetchGuildMember, fetchGuildRoles, fetchGuild } = await import("@/server/discord");

    const member = await fetchGuildMember(guildId, discordUserId);
    if (!member) {
        console.log("[DEBUG] checkGuildPermission - Member not found in Discord");
        return { allowed: false, error: "Member not found in Discord" };
    }

    // Check Owner
    const guildInfo = await fetchGuild(guildId);
    if (guildInfo.owner_id === discordUserId) {
        // console.log("[DEBUG] checkGuildPermission - User is Guild Owner");
        return { allowed: true };
    }

    // Check Discord Admin
    const guildRoles = await fetchGuildRoles(guildId);
    const memberRoles = guildRoles.filter(r => member.roles.includes(r.id));
    const isDiscordAdmin = memberRoles.some(r => (BigInt(r.permissions) & 0x8n) === 0x8n);

    if (isDiscordAdmin) {
        // console.log("[DEBUG] checkGuildPermission - User is Discord Admin");
        return { allowed: true };
    }

    // 4. Check Roles Mapping
    // console.log("[DEBUG] checkGuildPermission - Checking roles mapping for:", permission);
    const mapping = guildConfig.rolesMapping as Record<string, PermissionId[]>;

    const hasPermission = member.roles.some(roleId => {
        const perms = mapping[roleId];
        return perms?.includes(permission);
    });

    if (hasPermission) return { allowed: true };

    console.log("[DEBUG] checkGuildPermission - Insufficient Permissions");
    return { allowed: false, error: "Insufficient Permissions" };
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
                    where: { profile: { userId: session!.user!.id } }
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
    proofUrl: string,
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

        // Check if submissions are allowed (mission must be active)
        if (mission.status !== "ACTIVE") return { success: false, error: "Mission is not active" };

        const guard = await checkGuildPermission(session, mission.guild.discordGuildId, PERMISSIONS.MISSIONS_VIEW);
        if (!guard.allowed) return { success: false, error: guard.error };

        const profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: mission.guildId
                }
            }
        });
        if (!profile) return { success: false, error: "Profile not found" };

        // Auto-validation requires:
        // 1. OCR marked as valid (victory + category + content match)
        // 2. Score >= threshold (default 95%)
        const autoValidateThreshold = parseInt(process.env.OCR_AUTO_VALIDATE_THRESHOLD || "95", 10);
        const ocrIsValid = ocrResult?.isValid ?? false;
        const shouldAutoValidate = ocrIsValid && ocrScore !== undefined && ocrScore >= autoValidateThreshold;

        // Create Submission with OCR data
        await db.submission.create({
            data: {
                missionId,
                profileId: profile.id,
                proofUrl,
                status: shouldAutoValidate ? "VALIDATED" : "PENDING",
                ocrScore: ocrScore ?? null,
                ocrResult: ocrResult ? (ocrResult as Prisma.InputJsonValue) : null,
                ocrStatus: ocrScore !== undefined ? "COMPLETED" : "PENDING",
                // If auto-validated, set validator to system
                validatorId: shouldAutoValidate ? "SYSTEM_OCR" : null
            }
        });

        console.log(`[Submission] Created for mission ${missionId}. Score: ${ocrScore ?? 'N/A'}, Valid: ${ocrIsValid}, Auto-validated: ${shouldAutoValidate}`);

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

        // Guard: Check if user can VALIDATE missions
        const guard = await checkGuildPermission(session, submission.mission.guild.discordGuildId, PERMISSIONS.MISSIONS_VALIDATE);
        if (!guard.allowed) return { success: false, error: guard.error };

        await db.submission.update({
            where: { id: submissionId },
            data: {
                status,
                validatorId: session!.user!.id
            }
        });

        // TODO: If VALIDATED, trigger gamification points (Ladder)

        revalidatePath(`/dashboard/${submission.mission.guild.discordGuildId}/missions`);
        return { success: true };
    } catch (error) {
        console.error("Validation Error:", error);
        return { success: false, error: "Database error" };
    }
}

export async function getPendingSubmissions(guildId: string): Promise<ActionResponse<any>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_VALIDATE);
    if (!guard.allowed) return { success: false, error: guard.error };

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
