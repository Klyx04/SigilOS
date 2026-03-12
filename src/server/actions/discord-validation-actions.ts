/**
 * Discord Interaction Validation Actions
 *
 * Fonctions "internal" appelées UNIQUEMENT depuis /api/discord/interactions.
 * Elles bypassent auth() car la sécurité est garantie par :
 *   1. Vérification de signature Ed25519 Discord (dans le router interactions)
 *   2. internalCheckPermission → vérifie MISSIONS_VALIDATE sur le Discord ID de l'admin
 *
 * Jamais exposées en tant que Server Actions Next.js ("use server" absent intentionnellement).
 */

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/permissions";
import { NotificationType, PrismaClient } from "@prisma/client";
import { createNotification } from "@/server/actions/notification-actions";
import { deleteProofFile } from "@/lib/storage-utils";
import { createAuditLog } from "@/server/actions/audit-actions";

const kamaDb = db as unknown as PrismaClient;

// Inline XP helper (addProfileXp is not exported from mission-actions)
async function grantRewards(profileId: string, xp: number, guildatons: number = 0) {
    if (xp <= 0 && guildatons <= 0) return;
    try {
        await db.userProfile.update({
            where: { id: profileId },
            data: {
                xp: { increment: xp > 0 ? xp : 0 },
                guildatons: { increment: guildatons > 0 ? guildatons : 0 }
            }
        });
    } catch (e) {
        console.error(`[Rewards] grantRewards failed for ${profileId}:`, e);
    }
}

// ============================================================================
// HELPER — Permission check sans session (via Discord User ID)
// ============================================================================

async function requireDiscordAdmin(discordGuildId: string, discordUserId: string): Promise<
    { allowed: true; internalUserId: string; adminName: string } |
    { allowed: false; error: string }
> {
    const { internalCheckPermission } = await import("@/server/actions/user-actions");
    const hasPermission = await internalCheckPermission(discordGuildId, discordUserId, PERMISSIONS.MISSIONS_VALIDATE);
    if (!hasPermission) return { allowed: false, error: "Permissions insuffisantes (MISSIONS_VALIDATE requis)." };

    const account = await db.account.findFirst({
        where: { provider: "discord", providerAccountId: discordUserId },
        select: { userId: true, user: { select: { name: true } } },
    });
    if (!account) return { allowed: false, error: "Admin inconnu sur SigilOS." };

    return { allowed: true, internalUserId: account.userId, adminName: account.user?.name || "Admin Discord" };
}

// ============================================================================
// 1. MISSION SUBMISSION
// ============================================================================

export async function internalValidateMissionSubmission(
    submissionId: string,
    status: "VALIDATED" | "REJECTED",
    discordGuildId: string,
    discordAdminId: string
): Promise<{ success: boolean; error?: string; memberName?: string; missionTitle?: string }> {
    const guard = await requireDiscordAdmin(discordGuildId, discordAdminId);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const submission = await db.submission.findUnique({
            where: { id: submissionId },
            include: {
                mission: { include: { guild: true } },
                profile: { include: { user: true } },
                helpers: true,
            },
        });
        if (!submission) return { success: false, error: "Soumission introuvable." };
        if (submission.status !== "PENDING") return { success: false, error: "Cette soumission a déjà été traitée." };
        if (submission.mission.guild.discordGuildId !== discordGuildId) return { success: false, error: "Guilde invalide." };

        // 1. Delete proof file
        await deleteProofFile(submission.proofUrl);

        // 2. Delete image hash
        await (db as any).imageHash.deleteMany({
            where: { guildId: submission.mission.guild.id, sourceType: "MISSION", sourceId: submissionId },
        });

        // 3. Delete Discord embed
        if (submission.discordMessageId && submission.discordMessageId.includes(":")) {
            const [channelId, msgId] = submission.discordMessageId.split(":");
            if (channelId && msgId) {
                try {
                    const { deleteChannelMessage } = await import("@/server/discord");
                    await deleteChannelMessage(channelId, msgId);
                } catch (e) {
                    console.error("[internalValidateMissionSubmission] Failed to delete Discord embed", e);
                }
            }
        }

        // 4. Update DB
        const updated = await db.submission.update({
            where: { id: submissionId },
            data: { status, validatorId: guard.internalUserId, proofUrl: "", discordMessageId: null },
            include: { profile: { include: { user: true } }, helpers: true },
        });

        // 4. Award XP & Guildatons (if validated)
        if (status === "VALIDATED") {
            const xpReward = (submission.mission as any).xpReward || 0;
            const guildatonsReward = (submission.mission as any).guildatonsReward || 0;
            await grantRewards(updated.profileId, xpReward, guildatonsReward);

            // Award helpers contribution points
            if (updated.helpers.length > 0) {
                const rankPointsMap: Record<number, number> = { 1: 5, 2: 10, 3: 20, 4: 50 };
                const points = rankPointsMap[(submission.mission as any).rank] || 5;
                await db.userProfile.updateMany({
                    where: { id: { in: updated.helpers.map((h: any) => h.id) } },
                    data: { contributionPoints: { increment: points } },
                });
            }
        }

        // 5. Notify submitter
        const notifType = status === "VALIDATED" ? "MISSION_VALIDATED" : "MISSION_REJECTED";
        const resultMsg = status === "VALIDATED" ? "✅ validée !" : "❌ refusée.";
        await createNotification(
            updated.profile.userId,
            notifType as NotificationType,
            `[Mission] ${submission.mission.title}`,
            `Votre preuve a été ${resultMsg}`,
            undefined,
            discordGuildId
        );

        // 6. Audit log
        await createAuditLog({
            guildId: discordGuildId,
            actorUserId: guard.internalUserId,
            actorName: guard.adminName,
            action: (status === "VALIDATED" ? "MISSION_VALIDATED" : "MISSION_REJECTED") as any,
            targetType: "MISSION" as any,
            targetId: submissionId,
            metadata: { missionTitle: submission.mission.title ?? undefined, source: "discord_button" },
        });

        revalidatePath(`/dashboard/${discordGuildId}/missions`);
        revalidatePath(`/dashboard/${discordGuildId}/admin/validation`);

        const memberName = updated.profile.discordNickname || updated.profile.pseudoDofus || updated.profile.user?.name || "Membre";
        return { success: true, memberName, missionTitle: submission.mission.title ?? undefined };
    } catch (error) {
        console.error("[internalValidateMissionSubmission]", error);
        return { success: false, error: "Erreur serveur." };
    }
}

// ============================================================================
// 2. ACHIEVEMENT SUBMISSION
// ============================================================================

export async function internalValidateAchievementSubmission(
    submissionId: string,
    status: "VALIDATED" | "REJECTED",
    discordGuildId: string,
    discordAdminId: string
): Promise<{ success: boolean; error?: string; memberName?: string; points?: number }> {
    const guard = await requireDiscordAdmin(discordGuildId, discordAdminId);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const submission = await (db as any).achievementSubmission.findUnique({
            where: { id: submissionId },
            include: { guild: true, profile: { include: { user: true } } },
        });
        if (!submission) return { success: false, error: "Demande introuvable." };
        if (submission.status !== "PENDING") return { success: false, error: "Cette demande a déjà été traitée." };
        if (submission.guild.discordGuildId !== discordGuildId) return { success: false, error: "Guilde invalide." };

        // 1. Update points (if validated)
        if (status === "VALIDATED") {
            await db.userProfile.update({
                where: { id: submission.profileId },
                data: { successPoints: submission.points, lastLadderUpdate: new Date() },
            });
        }

        // 2. Notify submitter
        const title = status === "VALIDATED" ? "[Ladder] Points validés ✅" : "[Ladder] Points refusés ❌";
        const body = status === "VALIDATED"
            ? `Vos ${submission.points} points de succès ont été validés par le staff.`
            : `Votre demande de mise à jour des points de succès a été refusée par le staff.`;
        await createNotification(submission.profile.userId, "SYSTEM_INFO" as NotificationType, title, body, undefined, discordGuildId);

        // 3. Cleanup file
        if (submission.proofUrl) await deleteProofFile(submission.proofUrl);

        // 3.5. Delete Discord embed (validation ET rejet)
        if (submission.discordMessageId && submission.discordMessageId.includes(":")) {
            const [channelId, msgId] = submission.discordMessageId.split(":");
            if (channelId && msgId) {
                try {
                    const { deleteChannelMessage } = await import("@/server/discord");
                    await deleteChannelMessage(channelId, msgId);
                } catch (e) {
                    console.error("[internalValidateAchievementSubmission] Failed to delete Discord embed", e);
                }
            }
        }

        // 4. Update submission status
        await (db as any).achievementSubmission.update({
            where: { id: submissionId },
            data: { status, validatorId: guard.internalUserId, validatedAt: new Date(), proofUrl: "", discordMessageId: null },
        });

        // 5. Delete image hash
        await (db as any).imageHash.deleteMany({
            where: { guildId: submission.guildId, sourceType: "ACHIEVEMENT", sourceId: submissionId },
        });

        revalidatePath(`/dashboard/${discordGuildId}/ladder`);
        revalidatePath(`/dashboard/${discordGuildId}/admin/validation`);

        const memberName = submission.profile.discordNickname || submission.profile.pseudoDofus || submission.profile.user?.name || "Membre";
        return { success: true, memberName, points: submission.points };
    } catch (error) {
        console.error("[internalValidateAchievementSubmission]", error);
        return { success: false, error: "Erreur serveur." };
    }
}

// ============================================================================
// 3. KAMA DONATION
// ============================================================================

export async function internalReviewKamaDonation(
    donationId: string,
    action: "VALIDATE" | "REJECT",
    discordGuildId: string,
    discordAdminId: string
): Promise<{ success: boolean; error?: string; memberName?: string; amount?: number }> {
    const guard = await requireDiscordAdmin(discordGuildId, discordAdminId);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable." };

        const donation = await (kamaDb as any).kamaDonation.findFirst({
            where: { id: donationId, guildId: guildConfig.id },
            include: { profile: { include: { user: true } } },
        });
        if (!donation) return { success: false, error: "Donation introuvable." };
        if (donation.status !== "PENDING") return { success: false, error: "Cette donation a déjà été traitée." };

        const newStatus = action === "VALIDATE" ? "VALIDATED" : "REJECTED";

        // Find admin profile
        const adminProfile = await db.userProfile.findFirst({
            where: { userId: guard.internalUserId, guildId: guildConfig.id },
            select: { id: true },
        });

        await (kamaDb as any).kamaDonation.update({
            where: { id: donationId },
            data: {
                status: newStatus,
                validatedById: adminProfile?.id ?? undefined,
                validatedAt: new Date(),
                rejectedReason: action === "REJECT" ? "Refusé via Discord" : null,
                discordMessageId: null,
            },
        });

        // Award rewards (if validated)
        if (newStatus === "VALIDATED") {
            const { KAMA_TRANCHE, REWARDS_PER_TRANCHE } = await import("@/lib/kama-constants");
            const tranches = Math.floor(donation.amount / KAMA_TRANCHE);
            const addedXp = tranches * REWARDS_PER_TRANCHE.xp;
            const addedGuildatons = tranches * REWARDS_PER_TRANCHE.guildatons;

            if (addedXp > 0 || addedGuildatons > 0) {
                await grantRewards(donation.profileId, addedXp, addedGuildatons);
            }
        }

        // Delete proof file + image hash (validation ET rejet)
        if (donation.proofUrl) {
            await deleteProofFile(donation.proofUrl);
            await (db as any).imageHash.deleteMany({
                where: { guildId: guildConfig.id, sourceType: "KAMA_DONATION", sourceId: donationId },
            });
        }

        // Delete Discord embed (validation ET rejet)
        if (donation.discordMessageId && donation.discordMessageId.includes(":")) {
            const [channelId, msgId] = donation.discordMessageId.split(":");
            if (channelId && msgId) {
                try {
                    const { deleteChannelMessage } = await import("@/server/discord");
                    await deleteChannelMessage(channelId, msgId);
                } catch (e) {
                    console.error("[internalReviewKamaDonation] Failed to delete Discord embed", e);
                }
            }
        }

        revalidatePath(`/dashboard/${discordGuildId}/missions`);
        revalidatePath(`/dashboard/${discordGuildId}/admin/validation`);

        const memberName = donation.profile?.discordNickname || donation.profile?.pseudoDofus || donation.profile?.user?.name || "Membre";
        return { success: true, memberName, amount: donation.amount };
    } catch (error) {
        console.error("[internalReviewKamaDonation]", error);
        return { success: false, error: "Erreur serveur." };
    }
}
