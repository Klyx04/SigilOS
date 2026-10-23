"use server";

/**
 * Succès de donjon — **coche « fait »** du membre (fiche boss interne).
 *
 * Besoin mesuré le 23/10/2026 : l'onglet « Succès » de la fiche boss réutilisait le composant
 * **public** (`PublicBossAchievementsTab`), donc en lecture seule, y compris pour les donjons à
 * **double boss** — impossible de marquer un succès comme fait.
 *
 * Persistance : `UserDungeonAchievement` (table existante, clé unique `(userId, dungeonAchievementId)`,
 * `userId` = **profil** de guilde). **Aucune migration.**
 *
 * Gardes : `getUserContext(guildId)` (auth + guilde), appartenance du succès au donjon demandé
 * (isolation de la cible), `rateLimit` Redis, Zod borné, écriture idempotente.
 */

import { z } from "zod";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { getUserContext } from "./user-actions";

const ToggleSchema = z.object({
    guildId: z.string().min(1).max(32),
    dungeonId: z.string().min(1).max(64),
    achievementId: z.string().min(1).max(64),
});

const ReadSchema = z.object({
    guildId: z.string().min(1).max(32),
    dungeonId: z.string().min(1).max(64),
});

type ToggleResponse = { success: boolean; error?: string; done?: boolean };

/** Bascule « fait » / « à faire » d'un succès de donjon pour le profil courant. */
export async function toggleDungeonAchievement(raw: unknown): Promise<ToggleResponse> {
    const parsed = ToggleSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: "Données invalides" };
    const { guildId, dungeonId, achievementId } = parsed.data;

    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.profileId) return { success: false, error: "Non autorisé" };

    const limited = await rateLimit(`dungeon-achievement:${ctx.profileId}`, 60, 60_000);
    if (!limited.success) return { success: false, error: "Trop d'actions — réessaie dans une minute." };

    try {
        // La cible doit appartenir au donjon demandé (jamais un id fourni tel quel).
        const achievement = await db.dungeonAchievement.findFirst({
            where: { id: achievementId, dungeonId },
            select: { id: true },
        });
        if (!achievement) return { success: false, error: "Succès introuvable pour ce donjon" };

        const existing = await db.userDungeonAchievement.findUnique({
            where: {
                userId_dungeonAchievementId: {
                    userId: ctx.profileId,
                    dungeonAchievementId: achievement.id,
                },
            },
            select: { id: true },
        });

        if (existing) {
            await db.userDungeonAchievement.delete({ where: { id: existing.id } });
            return { success: true, done: false };
        }

        try {
            await db.userDungeonAchievement.create({
                data: { userId: ctx.profileId, dungeonAchievementId: achievement.id },
            });
        } catch (err) {
            // Course : deux clics rapprochés → la contrainte unique tranche, l'état reste « fait ».
            if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
                return { success: true, done: true };
            }
            throw err;
        }
        return { success: true, done: true };
    } catch (error) {
        logger.error("[toggleDungeonAchievement] Erreur", { error });
        return { success: false, error: "Impossible d'enregistrer la coche" };
    }
}

/** Succès déjà marqués « fait » par le profil courant pour un donjon. */
export async function getDungeonAchievementStates(
    rawGuildId: string,
    rawDungeonId: string,
): Promise<{ success: boolean; error?: string; doneIds?: string[] }> {
    const parsed = ReadSchema.safeParse({ guildId: rawGuildId, dungeonId: rawDungeonId });
    if (!parsed.success) return { success: false, error: "Données invalides" };
    const { guildId, dungeonId } = parsed.data;

    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.profileId) return { success: false, error: "Non autorisé" };

    try {
        const rows = await db.userDungeonAchievement.findMany({
            where: {
                userId: ctx.profileId,
                dungeonAchievement: { dungeonId },
            },
            select: { dungeonAchievementId: true },
            take: 500,
        });
        return { success: true, doneIds: rows.map((r) => r.dungeonAchievementId) };
    } catch (error) {
        logger.error("[getDungeonAchievementStates] Erreur", { error });
        return { success: false, error: "Impossible de lire les coches" };
    }
}
