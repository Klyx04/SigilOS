/**
 * Pseudo-succès unique « Donjon validé » — SOURCE DE VÉRITÉ de la règle « donjon sans succès ».
 *
 * Deux contenus l'utilisent :
 *  1. les donjons marqués `isNoAchievement` (chantier « donjon sans succès ») ;
 *  2. les boss d'ANOMALIE siphonnés (`isAnomalyBoss`), qui n'ont pas de succès propres :
 *     « valider le donjon » = avoir vaincu le gardien.
 *
 * Le pseudo-succès rend ces entrées cochables dans « Mes Succès » (et comptées dans les
 * totaux / filtres done-todo) exactement comme un donjon classique.
 *
 * ⚠️ Ne PAS dupliquer cette logique (elle était privée dans `game-data-admin-actions.ts`) :
 * le siphon des anomalies l'appelle aussi.
 */
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/** Slug du challenge système matérialisant « le donjon est validé ». */
export const NO_ACHIEVEMENT_CHALLENGE_SLUG = "donjon-valide";

/** Libellé affiché du pseudo-succès. */
export const NO_ACHIEVEMENT_CHALLENGE_NAME = "Donjon validé";

/** Crée/retourne (upsert idempotent) le challenge système « Donjon validé ». */
export async function ensureNoAchievementChallengeId(): Promise<string | null> {
    const existing = await db.challenge.findUnique({ where: { slug: NO_ACHIEVEMENT_CHALLENGE_SLUG } });
    if (existing) return existing.id;
    try {
        const created = await db.challenge.create({
            data: {
                name: NO_ACHIEVEMENT_CHALLENGE_NAME,
                slug: NO_ACHIEVEMENT_CHALLENGE_SLUG,
                description: "Donjon sans succès : valider le donjon suffit à le compléter.",
            },
        });
        return created.id;
    } catch (error: any) {
        // Course possible (upsert concurrent) → relire.
        if (error?.code === "P2002") {
            const re = await db.challenge.findUnique({ where: { slug: NO_ACHIEVEMENT_CHALLENGE_SLUG } });
            return re?.id ?? null;
        }
        logger.error("[ensureNoAchievementChallengeId]", error);
        return null;
    }
}

/**
 * Rattache le pseudo-succès « Donjon validé » à un donjon (idempotent, sans transaction
 * appelante) — utilisé par le siphon : un boss d'anomalie est immédiatement cochable
 * dans « Mes Succès ». Fail-soft : renvoie false si le challenge n'a pas pu être résolu.
 */
export async function attachNoAchievementToDungeon(dungeonId: string): Promise<boolean> {
    const challengeId = await ensureNoAchievementChallengeId();
    if (!challengeId) return false;
    try {
        await db.dungeonAchievement.upsert({
            where: { dungeonId_challengeId: { dungeonId, challengeId } },
            update: {},
            create: { dungeonId, challengeId, points: 10 },
        });
        return true;
    } catch (error) {
        logger.warn("[attachNoAchievementToDungeon] échec:", { error: String(error) });
        return false;
    }
}
