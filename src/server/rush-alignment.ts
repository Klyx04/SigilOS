import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { alignmentChangeReset, alignmentResetSeeds, cascadeResetIds, orderResetSeeds } from "@/lib/rush-guide-utils";
import type { RushMilestone } from "@/types/rush-guide-types";

/**
 * **Logique jeu du rush** : les quêtes d'alignement et leur cascade.
 *
 * Aucun guide n'est codé en dur : on lit ce que le studio God a marqué (`alignment_set`).
 * Un changement de cité **réinitialise** les quêtes d'alignement **et toutes les quêtes
 * qui en dépendent** (prérequis, puis leurs dépendants, etc.). Un changement d'**Ordre**
 * ne décoche que les **5 quêtes de l'Ordre quitté** (L2) : la progression de cité reste
 * acquise. Le reste — quêtes communes, donjons, succès indépendants — **garde** son
 * avancement.
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
 * Reset de progression quand l'alignement d'un personnage **change**.
 *
 * Une seule règle pour le profil principal et les mules : la décision vient de
 * `alignmentChangeReset` (pure, testée), l'écriture réutilise `resetAlignmentQuests` /
 * `resetOrderQuests`. Appelée par les actions qui écrivent l'alignement
 * (`updateUserProfile`, `updateMuleAlignment`) **avant** l'écriture, pour que l'ancienne
 * cité soit encore lisible en base.
 *
 * @returns le nombre de coches retirées (0 si rien ne change).
 */
export async function resetProgressOnAlignmentChange(input: {
  profileId: string;
  characterSlot: string;
  current: { alignment?: string | null; alignmentOrder?: string | null };
  next: { alignment?: string | null; alignmentOrder?: string | null };
}): Promise<number> {
  const decision = alignmentChangeReset(input);
  if (decision === "camp") {
    return resetAlignmentQuests(input.profileId, input.characterSlot, input.current.alignment ?? null);
  }
  if (decision === "order") {
    return resetOrderQuests(
      input.profileId,
      input.characterSlot,
      input.current.alignment ?? null,
      input.current.alignmentOrder ?? null
    );
  }
  return 0;
}

/**
 * Retire de la progression les quêtes d'un ensemble d'ids, pour un personnage.
 *
 * Mécanique **unique** des deux resets d'alignement (cité et Ordre) : on ne réécrit pas
 * deux fois le décochage — seule la façon de calculer les ids change.
 *
 * @param keepSeqId la quête qui vient d'être cochée (elle reste cochée).
 * @returns le nombre de coches retirées.
 */
async function clearQuestsByIds(
  profileId: string,
  characterSlot: string,
  ids: Set<string>,
  label: "cité" | "ordre",
  keepSeqId?: string
): Promise<number> {
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
    logger.info(`[RushAlignment] quêtes réinitialisées (${label})`, {
      cleared,
      roots: ids.size,
    });
  }
  return cleared;
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
  return clearQuestsByIds(profileId, characterSlot, ids, "cité", keepSeqId);
}

/**
 * **Changement d'Ordre** (L2) : ids des 5 quêtes de l'Ordre que le personnage quitte.
 *
 * Sans cascade, volontairement : la règle de jeu ne décoche que l'ancien Ordre (voir
 * `orderResetSeeds`). Un Ordre ou une cité inconnus ⇒ ensemble vide (rien n'est décoché).
 */
export async function orderResetIds(
  camp?: string | null,
  order?: string | null
): Promise<Set<string>> {
  const milestones = await loadGuideMilestones();
  return new Set(orderResetSeeds(milestones, camp, order));
}

/**
 * Retire de la progression les **5 quêtes de l'ancien Ordre** (changement d'Ordre).
 *
 * La cité passée est celle du profil **au moment du reset** (lue côté serveur dans
 * l'action) ; l'Ordre est celui que le personnage quitte. La progression de cité n'est
 * jamais touchée.
 *
 * @returns le nombre de coches retirées.
 */
export async function resetOrderQuests(
  profileId: string,
  characterSlot: string,
  camp?: string | null,
  order?: string | null
): Promise<number> {
  const ids = await orderResetIds(camp, order);
  return clearQuestsByIds(profileId, characterSlot, ids, "ordre");
}
