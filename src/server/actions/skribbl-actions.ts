'use server';

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";

export async function submitSkribblScore(
    guildId: string,
    score: number
) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isMember) return { success: false, error: "Non membre" };

    try {
        // Ladder aggregation via Rank (minimal persistence)
        const rank = await db.skribblRank.upsert({
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
                gamesPlayed: 1
            },
            update: {
                totalPoints: { increment: score },
                gamesPlayed: { increment: 1 },
                userName: ctx.name || "Inconnu",
                userAvatar: ctx.image,
            }
        });

        // Re-check best score
        if (score > rank.bestScore) {
            await db.skribblRank.update({
                where: { id: rank.id },
                data: { bestScore: score }
            });
        }

        revalidatePath(`/dashboard/${guildId}/mini-jeux`);
        return { success: true };
    } catch (error) {
        console.error("Failed to submit skribbl score:", error);
        return { success: false, error: "Erreur de base de données" };
    }
}

export async function getSkribblLadder(guildId: string, type: 'all_time' | 'month' = 'all_time') {
    try {
        if (type === 'all_time') {
            const ranks = await db.skribblRank.findMany({
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

        const monthlyScores = await db.skribblScore.groupBy({
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
        console.error("Failed to fetch skribbl ladder:", error);
        return [];
    }
}
