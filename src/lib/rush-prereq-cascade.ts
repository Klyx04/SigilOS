/**
 * **Cascade de prérequis à la validation d'un bloc** — règle pure.
 *
 * Décision du 23/11/2026 : valider un bloc est un geste de **confort** (aucun refus),
 * mais il doit rester **cohérent**. Si un bloc contient une quête qui exige une autre
 * quête, valider le bloc coche aussi les prérequis **manquants**, récursivement, dans
 * les autres blocs. On ne valide **jamais** les dépendants : la cascade ne remonte que
 * le graphe des prérequis (flèche « A exige B »), jamais l'inverse.
 *
 * Sources de prérequis (mêmes règles que l'affichage) :
 *  · `prereq_text` (ET), résolu par id puis libellé ;
 *  · chaîne des rangs d'Ordre (`previousOrderRank`) ;
 *  · groupes « OU » (`prereq_expr`) : **une** alternative suffit. On en coche **une**
 *    seule — celle déjà faite si elle existe, sinon la première connue du guide.
 *
 * Invariants :
 *  · aucune alternative hors guide n'est ajoutée (on ne devine pas) ;
 *  · les blocs non-cochables (INFO / SÉPARATEUR / DOFUS_OBTAINED) ne reçoivent rien ;
 *  · cycles absorbés par l'ensemble `visited` ;
 *  · au **reset / dévalidation**, on recalcule la fermeture des blocs encore validés et
 *    on retire les séquences qui n'étaient impliquées que par le bloc retiré.
 *
 * Pur : aucun accès base, aucune mutation. Le serveur écrit le plan.
 */

import { isRushNonQuestBlock, isRushSequenceBannerMarker } from "./rush-block-types";
import { getPrereqRefs } from "./rush-guide-utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { readPrereqExprGroups, resolvePrereqAlternative } from "./rush-prereq-expr";

/** Forme minimale d'une séquence pour la cascade (les champs lus par les règles). */
export type RushCascadeSequence = Pick<
  RushSequence,
  | "id"
  | "subGuideName"
  | "subGuideRef"
  | "activityTags"
  | "questDbIds"
  | "alignReq"
  | "alignOrderCode"
  | "alignLevelReq"
>;

/** Forme minimale d'un bloc : son type et ses séquences. */
export type RushCascadeMilestone = {
  id: string;
  type: string;
  sequences: readonly RushCascadeSequence[];
};

export type RushPrerequisiteCascadePlan = {
  /** Séquences ajoutées par la cascade (hors séquences du bloc cible). */
  added: string[];
  /** Séquences du bloc cible (déjà considérées comme validées). */
  target: string[];
  /** Fermeture complète après validation (cible + prérequis). */
  closure: string[];
};

/**
 * Fermeture transitive des prérequis à partir d'un ensemble de séquences déjà validées.
 * Utilisée pour le calcul de retrait (blocs encore validés) et pour la validation.
 */
export function prerequisiteClosure(
  milestones: readonly RushCascadeMilestone[],
  seeds: Iterable<string>
): Set<string> {
  const byId = indexSequences(milestones);
  const closure = new Set<string>();
  const queue: string[] = [];

  for (const id of seeds) {
    if (!byId.has(id) || closure.has(id)) continue;
    closure.add(id);
    queue.push(id);
  }

  expandQueue(milestones, byId, closure, queue, null);
  return closure;
}

/**
 * Plan de validation d'un bloc :
 *  · ajoute les séquences du bloc cible à l'ensemble déjà validé ;
 *  · remonte les prérequis manquants (ET + un par groupe OU), récursivement ;
 *  · ne valide aucun dépendant.
 */
export function planPrerequisiteCascade(input: {
  milestones: readonly RushCascadeMilestone[];
  completed: Iterable<string>;
  targetMilestoneId: string;
}): RushPrerequisiteCascadePlan {
  const { milestones, targetMilestoneId } = input;
  const targetMilestone = milestones.find((milestone) => milestone.id === targetMilestoneId);
  const target = (targetMilestone?.sequences ?? [])
    .filter((sequence) => !isInfoSequence(sequence))
    .map((sequence) => sequence.id);
  const byId = indexSequences(milestones);

  const closure = new Set<string>();
  const queue: string[] = [];
  for (const id of input.completed) {
    if (byId.has(id)) closure.add(id);
  }
  for (const id of target) {
    if (!byId.has(id)) continue;
    if (!closure.has(id)) closure.add(id);
    queue.push(id);
  }

  const added: string[] = [];
  expandQueue(milestones, byId, closure, queue, (sequenceId) => {
    if (!target.includes(sequenceId)) added.push(sequenceId);
  });

  return {
    added: unique(added),
    target: unique(target),
    closure: [...closure],
  };
}

/**
 * Plan de retrait après **dévalidation / reset** d'un bloc :
 *  · `oldClosure` = fermeture des blocs encore marqués complétés **avant** (cible incluse) ;
 *  · `newClosure` = fermeture des blocs complétés **après** (cible exclue) ;
 *  · on retire ce qui n'est plus impliqué, en excluant les séquences du bloc cible
 *    (sa propre ligne de progression est réinitialisée par l'appelant).
 *
 * Le résultat est restreint aux séquences réellement présentes dans `completed` :
 * on ne retire jamais une écriture qui n'existe pas.
 */
export function planPrerequisiteRemoval(input: {
  milestones: readonly RushCascadeMilestone[];
  completed: Iterable<string>;
  completedMilestoneIds: Iterable<string>;
  removedMilestoneId: string;
}): { remove: string[]; oldClosure: string[]; newClosure: string[] } {
  const { milestones, removedMilestoneId } = input;
  const completedSet = new Set(input.completed);
  const completedIds = new Set(input.completedMilestoneIds);

  const oldSeeds = seedsForMilestones(milestones, completedIds);
  const newSeeds = seedsForMilestones(
    milestones,
    new Set([...completedIds].filter((id) => id !== removedMilestoneId))
  );
  const oldClosure = prerequisiteClosure(milestones, oldSeeds);
  const newClosure = prerequisiteClosure(milestones, newSeeds);
  const target = new Set(
    milestones
      .find((milestone) => milestone.id === removedMilestoneId)
      ?.sequences.map((sequence) => sequence.id) ?? []
  );

  const remove: string[] = [];
  for (const id of oldClosure) {
    if (newClosure.has(id)) continue;
    if (target.has(id)) continue;
    if (!completedSet.has(id)) continue;
    remove.push(id);
  }

  return {
    remove: unique(remove),
    oldClosure: [...oldClosure],
    newClosure: [...newClosure],
  };
}

// ─── Interne ─────────────────────────────────────────────────────────────────

function isInfoSequence(sequence: RushCascadeSequence): boolean {
  return (
    Array.isArray(sequence.activityTags) &&
    sequence.activityTags.some((tag) => isRushSequenceBannerMarker(tag))
  );
}

function indexSequences(
  milestones: readonly RushCascadeMilestone[]
): Map<string, { sequence: RushCascadeSequence; milestone: RushCascadeMilestone }> {
  const byId = new Map<string, { sequence: RushCascadeSequence; milestone: RushCascadeMilestone }>();
  for (const milestone of milestones) {
    for (const sequence of milestone.sequences) {
      byId.set(sequence.id, { sequence, milestone });
    }
  }
  return byId;
}

function seedsForMilestones(
  milestones: readonly RushCascadeMilestone[],
  milestoneIds: ReadonlySet<string>
): string[] {
  const out: string[] = [];
  for (const milestone of milestones) {
    if (!milestoneIds.has(milestone.id)) continue;
    for (const sequence of milestone.sequences) out.push(sequence.id);
  }
  return out;
}

/**
 * Déplie la file de prérequis. `onAdded` est appelé **une fois** par séquence
 * nouvellement ajoutée à la fermeture (jamais pour une séquence déjà présente).
 */
function expandQueue(
  milestones: readonly RushCascadeMilestone[],
  byId: Map<string, { sequence: RushCascadeSequence; milestone: RushCascadeMilestone }>,
  closure: Set<string>,
  queue: string[],
  onAdded: ((sequenceId: string) => void) | null
): void {
  const visited = new Set<string>();

  const add = (id: string, milestoneId: string | null) => {
    if (!byId.has(id)) return;
    const milestone = milestoneId
      ? milestones.find((entry) => entry.id === milestoneId)
      : byId.get(id)?.milestone;
    if (milestone && isRushNonQuestBlock(milestone.type)) return;
    if (closure.has(id)) {
      if (!visited.has(id)) queue.push(id);
      return;
    }
    closure.add(id);
    onAdded?.(id);
    queue.push(id);
  };

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const entry = byId.get(id);
    if (!entry) continue;

    // 1. Prérequis explicites (ET) + chaîne des rangs.
    for (const ref of getPrereqRefs(entry.sequence as RushSequence, milestones as RushMilestone[])) {
      add(ref.seqId, ref.milestoneId);
    }

    // 2. Groupes OU : une seule alternative par groupe.
    for (const alternatives of readPrereqExprGroups(entry.sequence as RushSequence)) {
      const known = alternatives
        .map((alternative) =>
          resolvePrereqAlternative(alternative, milestones as RushMilestone[])
        )
        .filter((hit): hit is NonNullable<typeof hit> => Boolean(hit));
      if (known.length === 0) continue;
      if (known.some((hit) => closure.has(hit.seqId))) {
        // Une alternative est déjà validée : on la traverse pour sa propre chaîne,
        // sans ajouter les autres.
        const satisfied = known.find((hit) => closure.has(hit.seqId));
        if (satisfied && !visited.has(satisfied.seqId)) queue.push(satisfied.seqId);
        continue;
      }
      add(known[0].seqId, known[0].milestoneId);
    }
  }
}

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)];
}
