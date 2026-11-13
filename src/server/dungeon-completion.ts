/**
 * Rattachement du pseudo-succès « Donjon validé » — **serveur uniquement**.
 *
 * Utilisé par le seed et l'outil `scripts/backfill-dungeon-completion.ts`, **jamais** par un
 * écran à la lecture. Le challenge est créé s'il a été purgé (`retirer-donjon-valide`), puis
 * rattaché aux donjons qui n'ont **aucun** succès.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import {
    NO_ACHIEVEMENT_CHALLENGE_DESCRIPTION,
    NO_ACHIEVEMENT_CHALLENGE_NAME,
    NO_ACHIEVEMENT_CHALLENGE_SLUG,
} from "@/lib/dungeon-no-achievement";

/** Points du pseudo-succès (même valeur que les succès génériques). */
export const COMPLETION_ACHIEVEMENT_POINTS = 10;

/** Crée (ou retrouve) le challenge système « Donjon validé ». */
export async function ensureCompletionChallengeId(
    tx: Prisma.TransactionClient | PrismaClient
): Promise<string> {
    const existing = await tx.challenge.findUnique({
        where: { slug: NO_ACHIEVEMENT_CHALLENGE_SLUG },
        select: { id: true },
    });
    if (existing) return existing.id;

    const created = await tx.challenge.create({
        data: {
            slug: NO_ACHIEVEMENT_CHALLENGE_SLUG,
            name: NO_ACHIEVEMENT_CHALLENGE_NAME,
            description: NO_ACHIEVEMENT_CHALLENGE_DESCRIPTION,
            iconUrl: null,
        },
        select: { id: true },
    });
    return created.id;
}

/** Rattache le pseudo-succès à un donjon (idempotent). */
export async function attachCompletionAchievement(
    tx: Prisma.TransactionClient | PrismaClient,
    dungeonId: string,
    challengeId?: string
): Promise<void> {
    const resolvedChallengeId = challengeId ?? (await ensureCompletionChallengeId(tx));
    await tx.dungeonAchievement.upsert({
        where: { dungeonId_challengeId: { dungeonId, challengeId: resolvedChallengeId } },
        update: {},
        create: { dungeonId, challengeId: resolvedChallengeId, points: COMPLETION_ACHIEVEMENT_POINTS },
    });
}
