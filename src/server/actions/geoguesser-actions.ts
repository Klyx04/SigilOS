'use server';

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";

export async function submitGeoguesserScore(
    guildId: string,
    score: number,
    avgDistance: number
) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isMember) return { success: false, error: "Not a member" };

    try {
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
                userName: session.user.name || "Inconnu",
                userAvatar: session.user.image,
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
                userName: session.user.name || "Inconnu",
                userAvatar: session.user.image,
            }
        });

        // Re-check best score to ensure we don't overwrite with lower
        if (score > rank.bestScore) {
            await db.geoguesserRank.update({
                where: { id: rank.id },
                data: { bestScore: score }
            });
        }

        revalidatePath(`/dashboard/${guildId}/mini-jeux`);
        return { success: true };
    } catch (error) {
        console.error("Failed to submit score:", error);
        return { success: false, error: "Database error" };
    }
}

export async function getGeoguesserLadder(guildId: string) {
    try {
        return await db.geoguesserRank.findMany({
            where: { guildId },
            orderBy: { bestScore: 'desc' },
            take: 10
        });
    } catch (error) {
        console.error("Failed to fetch ladder:", error);
        return [];
    }
}
