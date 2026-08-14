"use server";

import { z } from "zod";
import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { mergePointsConfig } from "@/lib/points-config";

/**
 * Points de contribution personnalisables (par guilde, admin).
 * Stockage : `GuildConfig.pointsConfig` (JSON). Les types / défauts / helpers
 * purs (resolve*) vivent dans `src/lib/points-config.ts` (un fichier "use server"
 * ne peut exporter que des fonctions async).
 */

const POINTS_FIELD_SCHEMA = z.object({
    djQuest: z.number().int().min(0).max(100),
    djLvl1_99: z.number().int().min(0).max(100),
    djLvl100_149: z.number().int().min(0).max(100),
    djLvl150_199: z.number().int().min(0).max(100),
    djLvl200Plus: z.number().int().min(0).max(100),
    songesReve: z.number().int().min(0).max(100),
    songesParadoxe: z.number().int().min(0).max(100),
    songesCauchemar: z.number().int().min(0).max(100),
});

/** Lecture de la config de points (membre authentifié de la guilde). */
export async function getGuildPointsConfig(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.isMember) return { success: false, error: "Non autorisé" };
    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { pointsConfig: true },
        });
        return { success: true, data: mergePointsConfig(guild?.pointsConfig as unknown) };
    } catch (e) {
        logger.error("[getGuildPointsConfig] error:", e);
        return { success: false, error: "Erreur serveur" };
    }
}

/** Mise à jour de la config de points — admin de guilde uniquement, Zod borné. */
export async function updateGuildPointsConfig(guildId: string, input: unknown) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.isAdmin) return { success: false, error: "Permission administrateur requise" };

    const parsed = POINTS_FIELD_SCHEMA.safeParse(input);
    if (!parsed.success) return { success: false, error: "Configuration invalide (valeurs entières 0-100 requises)" };

    try {
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { pointsConfig: parsed.data as any },
        });
        revalidatePath(`/dashboard/${guildId}/admin/points`);
        return { success: true };
    } catch (e) {
        logger.error("[updateGuildPointsConfig] error:", e);
        return { success: false, error: "Erreur serveur" };
    }
}

