"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";

export async function toggleBuildVote(guildId: string, buildId: string) {
    if (!guildId || !buildId) return { success: false, error: "Paramètres invalides" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.id) {
        return { success: false, error: "Vous devez être connecté pour voter" };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const existingVote = await db.buildVote.findUnique({
            where: {
                buildId_userId: {
                    buildId,
                    userId: ctx.id
                }
            }
        });

        if (existingVote) {
            // Remove vote
            await db.buildVote.delete({
                where: { id: existingVote.id }
            });
            return { success: true, voted: false };
        } else {
            // Add vote
            await db.buildVote.create({
                data: {
                    buildId,
                    userId: ctx.id,
                    guildId: guildConfig.id
                }
            });
            return { success: true, voted: true };
        }
    } catch (error) {
        console.error("[Vote Build] Error:", error);
        return { success: false, error: "Erreur serveur lors du vote" };
    }
}
