/**
 * Saut vers une quête cible depuis l'overlay Rush.
 *
 * Le guide interne sait déjà le faire (`handleScrollToPrereq`) : un prérequis
 * peut vivre dans un AUTRE bloc, il faut donc ouvrir le bon chapitre avant de
 * chercher la ligne. Cette règle est extraite ici pour être testable sans DOM
 * et pour rester fail-closed : une cible inconnue ne déclenche aucun saut.
 */

import { matchesRushQuestFilter, type RushQuestFilter } from "@/lib/rush-quest-filter";

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

export type OverlayFilterState = {
  search: string;
  hideCompleted: boolean;
  questFilter: RushQuestFilter;
};

export type OverlayTargetState = {
  isDone: boolean;
  isLocked: boolean;
};

export type OverlayFilterRelease = {
  clearSearch: boolean;
  showCompleted: boolean;
  resetQuestFilter: boolean;
};

/**
 * Quels filtres de la vue relâcher pour que la cible soit rendue.
 *
 * On ne touche à rien si la cible est déjà visible : le saut ne doit pas
 * changer la vue du joueur sans raison. La recherche est toujours vidée
 * quand elle est active : la cible peut être dans un autre chapitre et le
 * mode « résultats globaux » ne la rend pas forcément.
 */
export function releaseOverlayFilters(
  filters: OverlayFilterState,
  target: OverlayTargetState
): OverlayFilterRelease {
  return {
    clearSearch: filters.search.trim().length > 0,
    showCompleted: filters.hideCompleted && target.isDone,
    resetQuestFilter:
      filters.questFilter !== "all" &&
      !matchesRushQuestFilter(target, filters.questFilter),
  };
}
