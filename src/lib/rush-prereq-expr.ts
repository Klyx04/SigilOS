/**
 * Rush Sylvestre — **prérequis « au choix »** (groupes OU), règle pure.
 *
 * Le client expose `(Qf=272|Qf=273|Qf=274)` : **une** de ces quêtes suffit. La Trame,
 * elle, est plate (`prereqIds: [272,273,274]`) et le moteur `prereq_text` la lisait donc
 * en **ET** — « Supermilicien » exigeait les trois alors qu'une seule ouvre la quête.
 *
 * Modèle : un tag `prereq_expr` porte un groupe d'alternatives **par id DofusDB**, résolu
 * contre les `questDbIds` des séquences (aucune migration, aucun id de séquence requis).
 *
 * Invariant : une alternative **absente du guide** n'est pas vérifiable. Dans ce cas le
 * groupe ne bloque **jamais** (un prérequis qu'on ne peut pas prouver ne doit pas
 * verrouiller à vie) ; il est signalé à l'affichage.
 */

import type {
  RushMilestone,
  RushPrereqAlternative,
  RushSequence,
} from "@/types/rush-guide-types";

/** Bornes de lecture : un tag malformé est ignoré, jamais interprété de travers. */
export const RUSH_PREREQ_EXPR_MAX_GROUPS = 4;
export const RUSH_PREREQ_EXPR_MAX_ALTERNATIVES = 8;

export type RushPrereqChoiceRef = { seqId: string; milestoneId: string; name: string };

export type RushPrereqChoiceGroup = {
  alternatives: RushPrereqAlternative[];
  /** Alternatives présentes dans le guide (cliquables). */
  known: RushPrereqChoiceRef[];
  /** Alternatives hors guide : non vérifiables, donc jamais bloquantes. */
  unknown: number;
};

export type RushPrereqExprEvaluation = {
  blocked: boolean;
  groups: Array<{
    alternatives: RushPrereqAlternative[];
    known: number;
    satisfied: boolean;
    unverifiable: boolean;
  }>;
};

function isQuestId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Groupes OU portés par une séquence. Un tag de moins de **deux** alternatives n'est pas
 * un choix : il est ignoré (le prérequis simple vit dans `prereq_text`).
 */
export function readPrereqExprGroups(
  seq: Pick<RushSequence, "activityTags"> | null | undefined
): RushPrereqAlternative[][] {
  const tags = Array.isArray(seq?.activityTags)
    ? seq.activityTags.filter((tag) => tag.type === "prereq_expr")
    : [];

  const groups: RushPrereqAlternative[][] = [];
  for (const tag of tags.slice(0, RUSH_PREREQ_EXPR_MAX_GROUPS)) {
    const seen = new Set<number>();
    const alternatives: RushPrereqAlternative[] = [];
    for (const alternative of Array.isArray(tag.alternatives) ? tag.alternatives : []) {
      if (!alternative || !isQuestId(alternative.questId)) continue;
      if (seen.has(alternative.questId)) continue;
      seen.add(alternative.questId);
      alternatives.push(alternative);
      if (alternatives.length >= RUSH_PREREQ_EXPR_MAX_ALTERNATIVES) break;
    }
    if (alternatives.length >= 2) groups.push(alternatives);
  }
  return groups;
}

/** Séquence qui porte cette quête (par `questDbIds`), ou `null` si elle est hors guide. */
export function resolvePrereqAlternative(
  alternative: RushPrereqAlternative,
  allMilestones: readonly RushMilestone[]
): RushPrereqChoiceRef | null {
  for (const milestone of allMilestones) {
    for (const seq of milestone.sequences ?? []) {
      if ((seq.questDbIds ?? []).includes(alternative.questId)) {
        return {
          seqId: seq.id,
          milestoneId: milestone.id,
          name:
            seq.subGuideName ||
            seq.subGuideRef ||
            alternative.name ||
            `Quête ${alternative.questId}`,
        };
      }
    }
  }
  return null;
}

/** Groupes OU prêts à afficher (noms résolus, nombre d'alternatives hors guide). */
export function getPrereqChoiceGroups(
  seq: Pick<RushSequence, "activityTags"> | null | undefined,
  allMilestones: readonly RushMilestone[]
): RushPrereqChoiceGroup[] {
  return readPrereqExprGroups(seq).map((alternatives) => {
    const known: RushPrereqChoiceRef[] = [];
    let unknown = 0;
    for (const alternative of alternatives) {
      const hit = resolvePrereqAlternative(alternative, allMilestones);
      if (hit) known.push(hit);
      else unknown += 1;
    }
    return { alternatives, known, unknown };
  });
}

/**
 * Évaluation d'un ensemble de groupes OU.
 *
 * | Cas | Résultat |
 * |---|---|
 * | une alternative **cochée** | groupe satisfait |
 * | toutes les alternatives sont dans le guide, aucune cochée | **bloqué** |
 * | au moins une alternative est **hors guide** | non vérifiable → **jamais bloqué** |
 */
export function evaluatePrereqExprGroups(
  groups: readonly RushPrereqAlternative[][],
  resolve: (alternative: RushPrereqAlternative) => { seqId: string } | null,
  isCompleted: (seqId: string) => boolean
): RushPrereqExprEvaluation {
  let blocked = false;

  const details = groups.map((alternatives) => {
    let known = 0;
    let satisfied = false;
    for (const alternative of alternatives) {
      const hit = resolve(alternative);
      if (!hit) continue;
      known += 1;
      if (isCompleted(hit.seqId)) satisfied = true;
    }
    const unverifiable = !satisfied && known < alternatives.length;
    if (!satisfied && !unverifiable) blocked = true;
    return { alternatives: [...alternatives], known, satisfied, unverifiable };
  });

  return { blocked, groups: details };
}
