import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * **Logique jeu du rush** : les quêtes d'alignement.
 *
 * Aucun guide n'est codé en dur : on lit ce que le studio God a marqué (`alignment_set`).
 * Un changement de cité **réinitialise** les quêtes d'alignement (comme en jeu) ; les
 * autres quêtes — communes, prérequis, donjons, succès — **gardent** leur avancement.
 */

/** Ids des séquences qui donnent de l'alignement (tous camps confondus). */
export async function alignmentSequenceIds(): Promise<Set<string>> {
  const rows = await db.guideSequence.findMany({
    select: { id: true, activityTags: true },
  });
  const ids = new Set<string>();
  for (const row of rows) {
    const tags = Array.isArray(row.activityTags) ? (row.activityTags as Array<{ type?: string }>) : [];
    if (tags.some((tag) => tag?.type === "alignment_set")) ids.add(row.id);
  }
  return ids;
}

/**
 * Retire de la progression les quêtes d'alignement d'un personnage.
 *
 * @param keepSeqId la quête qui vient d'être cochée (elle reste cochée) — le joueur
 *   repart de la première quête du NOUVEAU camp, pas de zéro absolu.
 * @returns le nombre de coches retirées.
 */
export async function resetAlignmentQuests(
  profileId: string,
  characterSlot: string,
  keepSeqId?: string
): Promise<number> {
  const ids = await alignmentSequenceIds();
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
    // Aucune donnée personnelle : seulement un volume.
    logger.info("[RushAlignment] quêtes d'alignement réinitialisées", { cleared });
  }
  return cleared;
}
