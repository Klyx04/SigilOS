'use server';

import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";

export async function submitGeoguesserScore(
    guildId: string,
    score: number,
    avgDistance: number,
    isSolo: boolean = false
) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isMember) return { success: false, error: "Non membre" };

    try {
        // Only update Hall of Fame for multiplay (/!\ the user asked not to count solo)
        if (!isSolo) {
            // Update aggregate rank (ladder)
            const rank = await db.geoguesserRank.upsert({
                where: {
                    guildId_userId: {
                        guildId,
                        userId: session.user.id
                    }
                },
                    create: {
                        guildId,
                        userId: session.user.id,
                        userName: ctx.name || "Inconnu",
                        userAvatar: ctx.image,
                        bestScore: score,
                        totalPoints: score,
                        gamesPlayed: 1,
                        avgDistance: avgDistance
                    },
                    update: {
                        totalPoints: { increment: score },
                        gamesPlayed: { increment: 1 },
                        avgDistance: {
                            set: avgDistance
                        },
                        userName: ctx.name || "Inconnu",
                        userAvatar: ctx.image,
                    }
            });

            // Re-check best score to ensure we don't overwrite with lower
            if (score > rank.bestScore) {
                await db.geoguesserRank.update({
                    where: { id: rank.id },
                    data: { bestScore: score }
                });
            }
        }

        // Always save individual score for history/stats if needed, 
        // but here we primarily use geoguesserScore model for all games.
        await db.geoguesserScore.create({
            data: {
                guildId,
                userId: session.user.id,
                userName: ctx.name || "Inconnu",
                userAvatar: ctx.image,
                score,
                distance: avgDistance
            }
        });

        revalidatePath(`/dashboard/${guildId}/mini-jeux`);
        return { success: true };
    } catch (error) {
        logger.error("Failed to submit score:", error);
        return { success: false, error: "Erreur de base de données" };
    }
}

export async function getGeoguesserLadder(guildId: string, type: 'all_time' | 'month' = 'all_time') {
    try {
        if (type === 'all_time') {
            const ranks = await db.geoguesserRank.findMany({
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

        const monthlyScores = await db.geoguesserScore.groupBy({
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
        logger.error("Failed to fetch ladder:", error);
        return [];
    }
}
