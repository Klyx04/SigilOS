import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { cascadeResetIds } from "@/lib/rush-guide-utils";
import type { RushMilestone } from "@/types/rush-guide-types";

/**
 * **Logique jeu du rush** : les quêtes d'alignement et leur cascade.
 *
 * Aucun guide n'est codé en dur : on lit ce que le studio God a marqué (`alignment_set`).
 * Un changement de cité **réinitialise** les quêtes d'alignement **et toutes les quêtes
 * qui en dépendent** (prérequis, puis leurs dépendants, etc.). Le reste — quêtes
 * communes, donjons, succès indépendants — **garde** son avancement.
 */

/** Shape minimale du guide pour la règle de prérequis (lecture seule). */
async function loadGuideMilestones(): Promise<RushMilestone[]> {
  const milestones = await db.guideMilestone.findMany({
    select: {
      id: true,
      type: true,
      chapter: true,
      chapterLabel: true,
      title: true,
      order: true,
      isOptional: true,
      sequences: {
        select: {
          id: true,
          subGuideName: true,
          subGuideRef: true,
          order: true,
          isOptional: true,
          activityTags: true,
        },
      },
    },
  });
  return milestones as unknown as RushMilestone[];
}

/** Les quêtes qui donnent de l'alignement (tous camps confondus). */
function alignmentSeeds(milestones: RushMilestone[]): Set<string> {
  const ids = new Set<string>();
  for (const ms of milestones) {
    for (const seq of ms.sequences || []) {
      const tags = Array.isArray(seq.activityTags)
        ? (seq.activityTags as Array<{ type?: string }>)
        : [];
      if (tags.some((tag) => tag?.type === "alignment_set")) ids.add(seq.id);
    }
  }
  return ids;
}

/** Ids « stricts » (sans cascade) — utile pour l'inspection. */
export async function alignmentSequenceIds(): Promise<Set<string>> {
  return alignmentSeeds(await loadGuideMilestones());
}

/**
 * Ids à décocher lors d'un changement de cité : quêtes d'alignement **et leur cascade
 * de prérequis**. C'est la règle jeu : tout ce qui dépend d'une quête invalidée
 * redevient à faire.
 */
export async function alignmentResetIds(): Promise<Set<string>> {
  const milestones = await loadGuideMilestones();
  return cascadeResetIds(milestones, alignmentSeeds(milestones));
}

/**
 * Retire de la progression les quêtes à réinitialiser pour un personnage.
 *
 * @param keepSeqId la quête qui vient d'être cochée (elle reste cochée).
 * @returns le nombre de coches retirées.
 */
export async function resetAlignmentQuests(
  profileId: string,
  characterSlot: string,
  keepSeqId?: string
): Promise<number> {
  const ids = await alignmentResetIds();
  if (ids.size === 0) return 0;

  const rows = await db.playerGuideProgress.findMany({
    where: { profileId, characterSlot },
    select: { id: true, completedSteps: true },
  });

  let cleared = 0;
  for (const row of rows) {
    const steps = Array.isArray(row.completedSteps) ? (row.completedSteps as string[]) : [];
    const next = steps.filter((id) => !ids.has(id) || id === keepSeqId);
    if (next.length === steps.length) continue;
    cleared += steps.length - next.length;
    await db.playerGuideProgress.update({
      where: { id: row.id },
      data: { completedSteps: next as never },
    });
  }

  if (cleared > 0) {
    // Aucune donnée personnelle : seulement des volumes.
    logger.info("[RushAlignment] quêtes réinitialisées (alignement + cascade)", {
      cleared,
      roots: ids.size,
    });
  }
  return cleared;
}
