"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { siphonChallengeDetails, siphonSpecialAchievements } from "@/lib/achievement-details-siphon";

/**
 * 🏆 **Siphon complet des succès** (God) — descriptions de challenges + succès « Spécial ».
 *
 * Le cron `sync-monster-stats` est borné à 25 par nuit (budget DofusDB partagé) ; ce bouton
 * laisse le mainteneur **tout finir d'un coup** depuis God, sans script local. Chaque passe
 * s'arrête d'elle-même quand le budget DofusDB se ferme (`deferred`) : il suffit de relancer.
 *
 * Garde : super-admin ou brique `game-data` (même règle que `game-data-admin-actions`).
 * Un verrou Redis de 10 min empêche deux passes concurrentes (elles se partageraient le budget).
 */
export type AchievementSiphonData = {
    /** Descriptions de challenges écrites (`Challenge.description`). */
    challengesWritten: number;
    /** Succès « Spécial » par donjon écrits (`DungeonAchievement.description` + icône). */
    specialsWritten: number;
    /** Lignes examinées sans écriture (déjà complètes ou introuvables). */
    scanned: number;
    /** Budget DofusDB partagé épuisé : relancer le bouton. */
    deferred: boolean;
};

const LOCK_KEY = "god:siphon-achievements:lock";

export async function siphonAllAchievements(): Promise<{
    success: boolean;
    error?: string;
    data?: AchievementSiphonData;
}> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    if (!(await isSuperAdmin()) && !(await canAccessBrick("game-data"))) {
        return { success: false, error: "Accès refusé" };
    }

    // Verrou : deux passes concurrentes se partageraient le budget DofusDB. Fail-open si Redis
    // tombe (ce n'est pas une garde d'accès, seulement une protection de débit).
    const locked = await redis.set(LOCK_KEY, "1", "EX", 10 * 60, "NX").catch(() => "OK");
    if (locked !== "OK") return { success: false, error: "Un siphon des succès est déjà en cours." };

    try {
        const details = await siphonChallengeDetails({ db: db as never, apply: true });
        const specials = await siphonSpecialAchievements({ db: db as never, apply: true });

        const data: AchievementSiphonData = {
            challengesWritten: details.written,
            specialsWritten: specials.written,
            scanned: details.scanned + specials.scanned,
            deferred: details.deferred || specials.deferred,
        };
        logger.info("[God] siphon des succès", data);
        return { success: true, data };
    } catch (error) {
        logger.error("[God] siphon des succès — échec", {
            err: error instanceof Error ? error.message : String(error),
        });
        return { success: false, error: "Siphon interrompu — voir les logs." };
    } finally {
        await redis.del(LOCK_KEY).catch(() => {});
    }
}
