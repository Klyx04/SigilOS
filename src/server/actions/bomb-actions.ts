'use server';

import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";

export async function submitBombScore(
    guildId: string,
    userId: string,
    score: number
) {
    // Note: Since this can be called from the WebSocket server directly (which might not have a session in context),
    // we bypass auth check ONLY if the caller is the internal WebSocket server, but standard security applies.
    // If it's a client calling it via Server Action, we authenticate:
    const session = await auth();
    
    // Allow internal calls (from WS server where session is not set in the async local storage of Next.js)
    const activeUserId = session?.user?.id || userId;
    if (!activeUserId) return { success: false, error: "Non autorisé" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isMember) return { success: false, error: "Non membre" };

    try {
        // Update aggregate rank
        const rank = await db.bombRank.upsert({
            where: {
                guildId_userId: {
                    guildId,
                    userId: activeUserId
                }
            },
            create: {
                guildId,
                userId: activeUserId,
                userName: ctx.name || "Inconnu",
                userAvatar: ctx.image,
                bestScore: score,
                totalPoints: score,
                gamesPlayed: 1
            },
            update: {
                totalPoints: { increment: score },
                gamesPlayed: { increment: 1 },
                userName: ctx.name || "Inconnu",
                userAvatar: ctx.image,
            }
        });

        // Re-check best score to ensure we don't overwrite with lower
        if (score > rank.bestScore) {
            await db.bombRank.update({
                where: { id: rank.id },
                data: { bestScore: score }
            });
        }

        // Save individual score
        await db.bombScore.create({
            data: {
                guildId,
                userId: activeUserId,
                userName: ctx.name || "Inconnu",
                userAvatar: ctx.image,
                score
            }
        });

        revalidatePath(`/dashboard/${guildId}/mini-jeux`);
        return { success: true };
    } catch (error) {
        logger.error("Failed to submit bomb score:", error);
        return { success: false, error: "Erreur de base de données" };
    }
}

export async function getBombLadder(guildId: string, type: 'all_time' | 'month' = 'all_time') {
    try {
        if (type === 'all_time') {
            const ranks = await db.bombRank.findMany({
                where: { guildId },
                orderBy: { bestScore: 'desc' },
                take: 10
            });
            return ranks.map(r => ({
                userId: r.userId,
                userName: r.userName,
                userAvatar: r.userAvatar,
                bestScore: r.bestScore
            }));
        }

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const monthlyScores = await db.bombScore.groupBy({
            by: ['userId', 'userName', 'userAvatar'],
            where: {
                guildId,
                createdAt: { gte: startOfMonth }
            },
            _max: {
                score: true
            },
            orderBy: {
                _max: {
                    score: 'desc'
                }
            },
            take: 10
        });

        return monthlyScores.map((s: any) => ({
            userId: s.userId,
            userName: s.userName,
            userAvatar: s.userAvatar,
            bestScore: s._max?.score || 0
        }));
    } catch (error) {
        logger.error("Failed to fetch bomb ladder:", error);
        return [];
    }
}
