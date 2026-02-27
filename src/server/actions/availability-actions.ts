"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";

/**
 * Récupère l'availability JSON du profil connecté pour l'afficher dans le formulaire service.
 * Format stocké : { "lundi": ["matin", "soir"], "vendredi": ["soir"], ... }
 */
export async function getMyAvailability(
    guildId: string
): Promise<{ success: true; data: Record<string, string[]> } | { success: false; error: string }> {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.isMember) {
        return { success: false, error: "Accès refusé" };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId: user.id!, guildId: guildConfig.id } },
            select: { availability: true },
        });

        const raw = (profile?.availability as Record<string, string[]> | null) || {};
        return { success: true, data: raw };
    } catch {
        return { success: false, error: "Erreur interne" };
    }
}
