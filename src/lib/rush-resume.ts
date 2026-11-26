/**
 * Cible du bouton « Reprendre » de l'overlay — **règle pure**, testable sans DOM.
 *
 * Mesure du 26/11/2026 : le bouton cherchait `[data-state="next"], [data-state="todo"]`
 * dans le bloc affiché. Sans repère « je suis ici », un bloc entièrement verrouillé
 * (ou terminé) ne rendait aucune de ces deux valeurs → **clic muet**. La règle ci-dessous
 * garantit une cible dès qu'il reste une quête non terminée dans le guide :
 *
 *  1. le repère « je suis ici » encore valide (choix explicite du joueur) ;
 *  2. la prochaine quête disponible du bloc affiché (`preferredSeqId`) ;
 *  3. la première quête disponible **après** le bloc courant, puis depuis le début ;
 *  4. à défaut, la première quête non terminée même verrouillée (on montre son prérequis) ;
 *  5. `done` : plus rien à faire (l'appelant affiche un message, jamais un clic muet).
 */

export type RushResumeCandidate = {
  seqId: string;
  milestoneId: string;
  isDone: boolean;
  isLocked: boolean;
};

export type RushResumeBookmark = {
  seqId: string;
  milestoneId: string;
};

export type RushResumeTarget =
  | {
      kind: "bookmark" | "preferred" | "global" | "locked";
      seqId: string;
      milestoneId: string;
    }
  | { kind: "done" };

export type RushResumeChoice = {
  seqId: string;
  milestoneId: string;
  name: string;
  blockTitle: string;
};

/** Vue minimale d'un bloc pour construire les choix de reprise (aucun couplage UI). */
export type RushResumeChoiceMilestone = {
  id: string;
  title?: string | null;
  sequences?: readonly {
    id: string;
    name?: string | null;
    isInfo?: boolean;
  }[];
};

/**
 * Construit la liste des repères « je suis ici » ENCORE VALIDES, dans l'ordre du guide.
 * Un repère sur une quête validée, un encart info ou une quête disparue est ignoré.
 * Avec 0 ou 1 choix, l'appelant saute directement ; avec 2+, il ouvre le sélecteur.
 */
export function buildRushResumeChoices({
  milestones,
  bookmarks,
  isDone,
}: {
  milestones: readonly RushResumeChoiceMilestone[];
  bookmarks: ReadonlyMap<string, string>;
  isDone: (milestoneId: string, seqId: string) => boolean;
}): RushResumeChoice[] {
  const out: RushResumeChoice[] = [];
  for (const ms of milestones) {
    const seqId = bookmarks.get(ms.id);
    if (!seqId) continue;
    const seq = (ms.sequences ?? []).find((candidate) => candidate.id === seqId);
    if (!seq || seq.isInfo || isDone(ms.id, seqId)) continue;
    out.push({
      seqId,
      milestoneId: ms.id,
      name: seq.name || "Quête",
      blockTitle: ms.title || "Bloc",
    });
  }
  return out;
}

export function findRushResumeTarget({
  candidates,
  bookmarks = [],
  preferredSeqId = null,
  currentMilestoneId = null,
}: {
  /** Toutes les quêtes cochables, dans l'ordre du guide (les encarts info sont exclus). */
  candidates: readonly RushResumeCandidate[];
  /** Repères « je suis ici » (milestone → quête), dans l'ordre d'insertion. */
  bookmarks?: readonly RushResumeBookmark[];
  /** Quête « à faire maintenant » de la liste affichée (`nextQuestId`). */
  preferredSeqId?: string | null;
  /** Bloc affiché : sert à ordonner le parcours global. */
  currentMilestoneId?: string | null;
}): RushResumeTarget {
  const bySeq = new Map(candidates.map((candidate) => [candidate.seqId, candidate]));

  // 1. Le repère posé par le joueur passe avant tout — s'il vise encore une quête
  //    non validée. Un repère orphelin (quête disparue) ou validé est ignoré.
  for (const bookmark of bookmarks) {
    const candidate = bySeq.get(bookmark.seqId);
    if (!candidate || candidate.isDone) continue;
    return { kind: "bookmark", seqId: candidate.seqId, milestoneId: candidate.milestoneId };
  }

  // 2. Prochaine quête disponible du bloc affiché (même règle que le nœud accentué).
  if (preferredSeqId) {
    const candidate = bySeq.get(preferredSeqId);
    if (candidate && !candidate.isDone) {
      return { kind: "preferred", seqId: candidate.seqId, milestoneId: candidate.milestoneId };
    }
  }

  // 3/4. Parcours global : après le bloc courant, le bloc courant, puis le début.
  const milestoneOrder: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.milestoneId)) continue;
    seen.add(candidate.milestoneId);
    milestoneOrder.push(candidate.milestoneId);
  }
  const currentIndex = currentMilestoneId ? milestoneOrder.indexOf(currentMilestoneId) : -1;
  const ordered = [
    ...milestoneOrder.slice(currentIndex + 1),
    ...(currentIndex >= 0 ? [milestoneOrder[currentIndex]] : []),
    ...milestoneOrder.slice(0, Math.max(0, currentIndex)),
  ];

  let lockedFallback: RushResumeTarget | null = null;
  for (const milestoneId of ordered) {
    for (const candidate of candidates) {
      if (candidate.milestoneId !== milestoneId || candidate.isDone) continue;
      if (!candidate.isLocked) {
        return { kind: "global", seqId: candidate.seqId, milestoneId: candidate.milestoneId };
      }
      if (!lockedFallback) {
        lockedFallback = {
          kind: "locked",
          seqId: candidate.seqId,
          milestoneId: candidate.milestoneId,
        };
      }
    }
  }

  return lockedFallback ?? { kind: "done" };
}
