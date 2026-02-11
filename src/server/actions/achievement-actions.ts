"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { NotificationType } from "@prisma/client";
import { createNotification } from "@/server/actions/notification-actions";
import { PERMISSIONS } from "@/lib/permissions";
import { checkGuildPermission } from "@/server/actions/user-actions";
import { deleteProofFile } from "@/lib/storage-utils";

export type ActionResponse<T = null> = {
    success: boolean;
    error?: string;
    data?: T;
};

/**
 * Validate or Reject an achievement submission
 */
export async function validateAchievementSubmission(
    submissionId: string,
    status: "VALIDATED" | "REJECTED"
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    try {
        const submission = await (db as any).achievementSubmission.findUnique({
            where: { id: submissionId },
            include: { guild: true, profile: true }
        });

        if (!submission) return { success: false, error: "Demande introuvable" };

        // Check if user has permission to validate (using same permission as missions for now or a specific one)
        const guard = await checkGuildPermission(session, submission.guild.discordGuildId, PERMISSIONS.MISSIONS_VALIDATE);
        if (!guard.allowed) return { success: false, error: "Permissions insuffisantes." };

        if (status === "VALIDATED") {
            // Update User Profile
            await db.userProfile.update({
                where: { id: submission.profileId },
                data: {
                    successPoints: submission.points,
                    lastLadderUpdate: new Date()
                }
            });


            // Notify user
            await createNotification(
                submission.profile.userId,
                "SYSTEM_INFO" as NotificationType,
                "[Ladder] Points validés",
                `Vos ${submission.points} points de succès ont été validés par le staff.`
            );
        } else {
            // Notify user of rejection
            await createNotification(
                submission.profile.userId,
                "SYSTEM_INFO" as NotificationType,
                "[Ladder] Points refusés",
                `Votre demande de mise à jour des points de succès a été refusée par le staff.`
            );
        }

        // Cleanup: Delete file
        if (submission.proofUrl) {
            await deleteProofFile(submission.proofUrl);
        }

        // Update submission status
        await (db as any).achievementSubmission.update({
            where: { id: submissionId },
            data: {
                status,
                validatorId: session.user.id,
                validatedAt: new Date(),
                proofUrl: "" // Clear URL after deletion
            }
        });

        revalidatePath(`/dashboard/${submission.guild.discordGuildId}/ladder`);
        revalidatePath(`/dashboard/${submission.guild.discordGuildId}/profile`);

        return { success: true };
    } catch (error) {
        console.error("[Achievement] Validation error:", error);
        return { success: false, error: "Erreur lors de la validation." };
    }
}

/**
 * Get pending achievement submissions for a guild
 */
export async function getPendingAchievements(guildId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    // Lazy cleanup of old pending submissions (24h)
    await cleanupExpiredAchievements(guildId);

    try {
        const guild = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const guard = await checkGuildPermission(session, guildId, PERMISSIONS.ADMIN_ACCESS);
        if (!guard.allowed) return { success: false, error: "Accès refusé" };

        const submissions = await (db as any).achievementSubmission.findMany({
            where: {
                guildId: guild.id,
                status: "PENDING"
            },
            include: {
                profile: {
                    select: {
                        discordNickname: true,
                        pseudoDofus: true,
                        user: { select: { image: true } }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return { success: true, data: submissions };
    } catch (error) {
        return { success: false, error: "Erreur lors de la récupération des demandes." };
    }
}

/**
 * Cleanup pending achievement submissions older than 24h
 */
export async function cleanupExpiredAchievements(guildId: string) {
    const EXPIRATION_MS = 24 * 60 * 60 * 1000;
    const thresholdDate = new Date(Date.now() - EXPIRATION_MS);

    try {
        const guild = await db.guildConfig.findUnique({ where: { discordGuildId: guildId } });
        if (!guild) return;

        const expired = await (db as any).achievementSubmission.findMany({
            where: {
                guildId: guild.id,
                status: "PENDING",
                createdAt: { lt: thresholdDate }
            }
        });

        if (expired.length > 0) {
            for (const sub of expired) {
                if (sub.proofUrl) {
                    await deleteProofFile(sub.proofUrl);
                }
                await (db as any).achievementSubmission.delete({ where: { id: sub.id } });
            }
        }
    } catch (error) {
        console.error("[Cleanup] Achievement cleanup error:", error);
    }
}
/**
 * Cancel a pending achievement submission (User action)
 */
export async function cancelAchievementSubmission(guildId: string): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    try {
        const profile = await db.userProfile.findFirst({
            where: {
                userId: session.user.id,
                guild: { discordGuildId: guildId }
            }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        const pending = await (db as any).achievementSubmission.findFirst({
            where: {
                profileId: profile.id,
                status: "PENDING"
            }
        });

        if (!pending) return { success: false, error: "Aucune demande en attente" };

        // 1. Cleanup file
        if (pending.proofUrl) {
            await deleteProofFile(pending.proofUrl);
        }

        // 2. Delete from DB
        await (db as any).achievementSubmission.delete({
            where: { id: pending.id }
        });

        // 3. Delete Image Hash to allow retry
        await (db as any).imageHash.deleteMany({
            where: {
                guildId: profile.guildId,
                sourceType: "ACHIEVEMENT",
                sourceId: pending.id
            }
        });


        revalidatePath(`/dashboard/${guildId}/profile`);
        return { success: true };
    } catch (error) {
        console.error("[Achievement] Cancel error:", error);
        return { success: false, error: "Erreur lors de l'annulation" };
    }
}
