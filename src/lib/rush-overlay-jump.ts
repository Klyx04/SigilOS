/**
 * Saut vers une quête cible depuis l'overlay Rush.
 *
 * Le guide interne sait déjà le faire (`handleScrollToPrereq`) : un prérequis
 * peut vivre dans un AUTRE bloc, il faut donc ouvrir le bon chapitre avant de
 * chercher la ligne. Cette règle est extraite ici pour être testable sans DOM
 * et pour rester fail-closed : une cible inconnue ne déclenche aucun saut.
 */

export type OverlayJumpTarget = {
  seqId: string;
  milestoneId: string;
};

export type OverlayJumpPlan = {
  /** Index du bloc cible dans la liste filtrée `milestones`. */
  milestoneIndex: number;
  /** Quête à mettre en vue. */
  seqId: string;
  /** Nom affiché de la cible (toast, libellé). */
  name: string;
};

/** Origine d'un saut : la quête que le joueur a quittée. */
export type OverlayJumpOrigin = {
  milestoneId: string;
  seqId: string;
  name: string;
};

type JumpMilestone = {
  id: string;
  sequences: ReadonlyArray<{ id: string; subGuideName: string }>;
};

/**
 * Résout le bloc + la quête cible. `null` si le bloc ou la quête n'existe pas
 * dans le guide : l'appelant affiche l'erreur, on ne devine jamais.
 */
export function planOverlayJump(
  milestones: ReadonlyArray<JumpMilestone>,
  target: OverlayJumpTarget
): OverlayJumpPlan | null {
  const milestoneIndex = milestones.findIndex((ms) => ms.id === target.milestoneId);
  if (milestoneIndex < 0) return null;
  const seq = milestones[milestoneIndex]?.sequences.find((s) => s.id === target.seqId);
  if (!seq) return null;
  return { milestoneIndex, seqId: seq.id, name: seq.subGuideName };
}
