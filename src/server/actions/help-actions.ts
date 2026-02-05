"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Schema for giving a help credit
 */
const GiveHelpCreditSchema = z.object({
    guildId: z.string(),
    toUserId: z.string(),
    missionId: z.string().optional(),
    message: z.string().max(100).optional(),
});

export type ActionResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
};

/**
 * Give a help credit to another member
 * 
 * Rules:
 * 1. Max 3 credits given per day (rolling 24h)
 * 2. Cannot thank the same person twice in 24h
 * 3. Cannot thank yourself
 * 4. Must be a member of the guild
 */
export async function giveHelpCredit(formData: z.infer<typeof GiveHelpCreditSchema>): Promise<ActionResponse> {
    const validation = GiveHelpCreditSchema.safeParse(formData);
    if (!validation.success) {
        return { success: false, error: "Données invalides : " + validation.error.message };
    }

    const { guildId, toUserId, missionId, message } = validation.data;

    // 1. Auth & Guild Isolation
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Vous devez être membre de cette guilde" };

    const fromUserId = ctx.id!;

    // 2. Self-thank check
    if (fromUserId === toUserId) {
        return { success: false, error: "Vous ne pouvez pas vous remercier vous-même" };
    }

    try {
        const now = new Date();
        const rolling24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // 3. Check daily limit (3/day)
        const creditsToday = await (db as any).helpCredit.count({
            where: {
                guildId,
                fromUserId,
                createdAt: { gte: rolling24h }
            }
        });


        if (creditsToday >= 3) {
            return { success: false, error: "Limite de 3 remerciements par 24h atteinte" };
        }

        // 4. Check recipient cooldown (once per person per 24h)
        const recentCreditToUser = await (db as any).helpCredit.findFirst({
            where: {
                guildId,
                fromUserId,
                toUserId,
                createdAt: { gte: rolling24h }
            }
        });


        if (recentCreditToUser) {
            return { success: false, error: "Vous avez déjà remercié ce membre ces dernières 24h" };
        }

        // 5. Transaction: Create Credit + Update Points
        const pointsPerCredit = parseInt(process.env.ENTRAIDE_POINTS_PER_CREDIT || "5", 10);

        await db.$transaction([
            (db as any).helpCredit.create({
                data: {
                    guildId,
                    fromUserId,
                    toUserId,
                    missionId,
                    message,
                    points: pointsPerCredit
                }
            }),
            (db as any).userProfile.update({
                where: { userId_guildId: { userId: toUserId, guildId } },
                data: {
                    entraidePoints: { increment: pointsPerCredit }
                }
            })
        ]);

        // 6. Audit Log
        const { createAuditLog } = await import("@/server/actions/audit-actions");
        await createAuditLog({
            guildId,
            actorUserId: fromUserId,
            actorName: ctx.name || "Inconnu",
            action: "HELP_CREDIT_GIVEN",
            targetType: "USER_PROFILE",
            targetId: toUserId,
            newValue: { toUserId, points: pointsPerCredit, missionId, message }
        });


        revalidatePath(`/dashboard/${guildId}/missions`);
        revalidatePath(`/dashboard/${guildId}/ladder`);

        return { success: true };
    } catch (error) {
        console.error("[HelpActions] Error giving credit:", error);
        return { success: false, error: "Une erreur est survenue lors de l'attribution du remerciement" };
    }
}

/**
 * Get help credits received by a user
 */
export async function getReceivedCredits(guildId: string, userId: string) {
    return await (db as any).helpCredit.findMany({
        where: { guildId, toUserId: userId },
        include: {
            fromProfile: {
                select: {
                    discordNickname: true,
                    userId: true
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });
}


/**
 * Get stats for current user (limits remaining)
 */
export async function getHelpStats(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return null;

    const now = new Date();
    const rolling24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const creditsGiven = await (db as any).helpCredit.count({
        where: {
            guildId,
            fromUserId: ctx.id!,
            createdAt: { gte: rolling24h }
        }
    });


    return {
        remainingToday: Math.max(0, 3 - creditsGiven),
        limit: 3
    };
}
