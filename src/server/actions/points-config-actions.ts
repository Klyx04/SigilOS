"use server";

import { z } from "zod";
import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

/**
 * Points de contribution personnalisables (par guilde, admin).
 * Stockés dans `GuildConfig.pointsConfig` (JSON), lus à la clôture des runs
 * Songes et des posts DJ/quêtes. Défauts alignés sur l'ancien comportement.
 */
export type GuildPointsConfig = {
    djQuest: number;
    djLvl1_99: number;
    djLvl100_149: number;
    djLvl150_199: number;
    djLvl200Plus: number;
    songesReve: number;
    songesParadoxe: number;
    songesCauchemar: number;
};

export const DEFAULT_POINTS_CONFIG: GuildPointsConfig = {
    djQuest: 1,
    djLvl1_99: 1,
    djLvl100_149: 2,
    djLvl150_199: 3,
    djLvl200Plus: 4,
    songesReve: 1,
    songesParadoxe: 2,
    songesCauchemar: 3,
};

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

/** Fusionne une config brute (DB) avec les défauts — bornée et fail-safe. */
export function mergePointsConfig(raw: unknown): GuildPointsConfig {
    const base: GuildPointsConfig = { ...DEFAULT_POINTS_CONFIG };
    if (!raw || typeof raw !== "object") return base;
    const r = raw as Partial<GuildPointsConfig>;
    (Object.keys(base) as (keyof GuildPointsConfig)[]).forEach((k) => {
        const v = r[k];
        if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100) base[k] = Math.round(v);
    });
    return base;
}

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

// ─────────────────────────────────────────────
// Helpers pures — utilisées par les actions de clôture (DJ & Songes)
// ─────────────────────────────────────────────

export function resolveDjContributionPoints(
    dungeonLevel: number | null | undefined,
    cfg?: unknown
): number {
    const c = mergePointsConfig(cfg);
    if (!dungeonLevel) return c.djQuest;
    if (dungeonLevel >= 200) return c.djLvl200Plus;
    if (dungeonLevel >= 150) return c.djLvl150_199;
    if (dungeonLevel >= 100) return c.djLvl100_149;
    return c.djLvl1_99;
}

export function resolveSongesContributionPoints(
    difficulty: string,
    cfg?: unknown
): number {
    const c = mergePointsConfig(cfg);
    if (difficulty.startsWith("CAUCHEMAR")) return c.songesCauchemar;
    if (difficulty.startsWith("PARADOXE")) return c.songesParadoxe;
    return c.songesReve;
}
