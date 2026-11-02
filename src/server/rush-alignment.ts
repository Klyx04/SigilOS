import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { alignmentResetSeeds, cascadeResetIds } from "@/lib/rush-guide-utils";
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
    // Le reset d'alignement est celui du RUSH : on ne balaie pas les autres guides.
    where: { guide: { slug: "rush-sylvestre" } },
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
          alignReq: true,
          alignOrderCode: true,
          activityTags: true,
        },
      },
    },
  });
  return milestones as unknown as RushMilestone[];
}

/**
 * Ids « stricts » (sans cascade) — utile pour l'inspection : les quêtes marquées
 * `alignment_set`, tous camps confondus.
 */
export async function alignmentSequenceIds(): Promise<Set<string>> {
  return new Set(alignmentResetSeeds(await loadGuideMilestones(), null));
}

/**
 * Ids à décocher lors d'un changement de cité : **toutes les quêtes `alignReq` de la
 * cité** (cité + Ordres) **et leur cascade de prérequis**. C'est la règle jeu : tout ce
 * qui dépend d'une quête invalidée redevient à faire.
 *
 * Sans cité (profil neutre), repli sur les tags `alignment_set` — comportement du bouton
 * « reset » historique.
 */
export async function alignmentResetIds(camp?: string | null): Promise<Set<string>> {
  const milestones = await loadGuideMilestones();
  return cascadeResetIds(milestones, alignmentResetSeeds(milestones, camp));
}

/**
 * Retire de la progression les quêtes à réinitialiser pour un personnage.
 *
 * @param camp la cité que le personnage **quitte** (`alignReq` de l'ancienne cité) ;
 *             `null` ⇒ repli sur les tags `alignment_set`.
 * @param keepSeqId la quête qui vient d'être cochée (elle reste cochée).
 * @returns le nombre de coches retirées.
 */
export async function resetAlignmentQuests(
  profileId: string,
  characterSlot: string,
  camp?: string | null,
  keepSeqId?: string
): Promise<number> {
  const ids = await alignmentResetIds(camp);
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
