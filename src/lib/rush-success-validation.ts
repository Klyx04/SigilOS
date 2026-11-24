/**
 * **Aperçu « Valider les prérequis » d'un succès** — règle pure.
 *
 * Le succès est **dérivé** : on ne coche jamais un succès, on coche les quêtes du guide
 * qui le composent et les quêtes de sa fermeture de prérequis. L'aperçu répond à trois
 * questions avant toute écriture :
 *  · quels **blocs** sont concernés ;
 *  · quelles **quêtes du guide** seront validées (les seules que le serveur écrira) ;
 *  · quels **prérequis de route** la cascade du guide ajoutera (même règle que la
 *    validation d'un bloc, `planPrerequisiteCascade`).
 *
 * Les quêtes hors guide et les possessions sont **listées**, jamais inventées ni cochées.
 * Aucun accès base/réseau : le serveur re-vérifie tout au moment de l'écriture.
 */

import type { RushGuideQuestRef } from "./rush-guide-utils";
import {
  successClosure,
  successQuestLeaves,
  type RushQuestCriteriaMap,
  type RushSuccessCatalog,
} from "./rush-success-graph";
import {
  planPrerequisiteCascade,
  type RushCascadeMilestone,
} from "./rush-prereq-cascade";
import type { RushMilestone } from "@/types/rush-guide-types";

export type RushSuccessValidationBlock = {
  milestoneId: string;
  title: string;
  /** Séquences du succès (Qf) encore à faire. */
  targetSequenceIds: string[];
  /** Prérequis de route ajoutés par la cascade du guide. */
  cascadedSequenceIds: string[];
  targetNames: string[];
  cascadedNames: string[];
};

export type RushSuccessPossession = {
  id: number;
  name: string;
  /** Déjà listé dans les ressources `item` d'une quête du guide. */
  inGuideResources: boolean;
};

export type RushSuccessValidationPreview = {
  blocks: RushSuccessValidationBlock[];
  /** Nombre de séquences du succès encore à faire, dans le guide. */
  targetCount: number;
  /** Nombre de prérequis de route ajoutés par la cascade. */
  cascadedCount: number;
  /** Quêtes Qf du succès absentes du guide (non validables). */
  outsideQuestNames: string[];
  /** Possessions qui ne sont PAS déjà des ressources de quête. */
  possessionNames: string[];
  /** Objets `need.items` déjà couverts par les ressources d'une quête du guide. */
  coveredPossessionCount: number;
};

/** Une écriture serveur : le bloc ciblé, son périmètre et les séquences réellement validées. */
export type RushSuccessValidationWrite = {
  milestoneId: string;
  title: string;
  /**
   * Périmètre passé à `toggleMilestoneProgress` : cibles + prérequis de route du **même
   * bloc**. Le serveur n'écrit la cascade que pour les autres blocs, donc un prérequis
   * interne doit voyager dans le périmètre, sinon il reste décoché.
   */
  scopeSequenceIds: string[];
  /** Séquences validées, rangées sous leur bloc propriétaire (cascade inter-blocs). */
  updates: Array<{ milestoneId: string; sequenceIds: string[] }>;
};

export type RushSuccessValidationInput = {
  successId: number;
  catalog: RushSuccessCatalog;
  questCriteria?: RushQuestCriteriaMap;
  overrides?: Readonly<Record<string, readonly number[]>>;
  guideQuests: readonly RushGuideQuestRef[];
  milestones: readonly RushMilestone[];
  /** Noms DofusDB des quêtes hors guide. */
  questNames?: Readonly<Record<number, string>>;
  /** Noms des objets (`need.items`) pour les possessions. */
  itemNames?: Readonly<Record<number, string>>;
};

function completedSequenceIds(
  milestones: readonly RushMilestone[],
  guideQuests: readonly RushGuideQuestRef[]
): Set<string> {
  const completed = new Set<string>();
  for (const milestone of milestones) {
    const raw = milestone.playerProgress?.[0]?.completedSteps;
    const values = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : [];
    for (const id of values) {
      if (typeof id === "string") completed.add(id);
    }
  }
  // La surface peut ne pas porter `playerProgress` (public/invité) : la coche de la
  // quête du guide reste la source de vérité.
  for (const quest of guideQuests) {
    if (quest.done && quest.sequenceId) completed.add(quest.sequenceId);
  }
  return completed;
}

const normalizeResourceName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Index des ressources `item` du guide (nom normalisé + id) pour dédupliquer les possessions. */
function collectGuideResourceIndex(milestones: readonly RushMilestone[]): {
  names: Set<string>;
  ids: Set<string>;
} {
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const milestone of milestones) {
    for (const sequence of milestone.sequences) {
      for (const tag of sequence.activityTags ?? []) {
        if (tag?.type !== "item" || !tag.name) continue;
        if ((tag as { kind?: string }).kind === "instruction") continue;
        names.add(normalizeResourceName(tag.name));
        if (tag.id != null) ids.add(String(tag.id));
      }
    }
  }
  return { names, ids };
}

/**
 * Objets `need.items` d'un succès et de sa fermeture, **vérifiés contre les ressources
 * de quête du guide**. Un objet déjà listé dans le détail d'une quête n'est pas répété
 * dans la fiche du succès (retour user du 24/11/2026 : « Chanvre, Sauge… » en double).
 */
export function successPossessionItems(input: {
  successId: number;
  catalog: RushSuccessCatalog;
  milestones: readonly RushMilestone[];
  /** Quêtes du guide : un `PO=` d'une quête DU guide vit dans sa fiche, pas ici. */
  guideQuests?: readonly RushGuideQuestRef[];
  questCriteria?: RushQuestCriteriaMap;
  overrides?: Readonly<Record<string, readonly number[]>>;
  itemNames?: Readonly<Record<number, string>>;
}): {
  items: RushSuccessPossession[];
  extras: RushSuccessPossession[];
  coveredCount: number;
} {
  const index = collectGuideResourceIndex(input.milestones);
  const guideQuestIds = new Set((input.guideQuests ?? []).map((quest) => quest.id));
  const ids = new Set<number>();
  const closure = successClosure(input.successId, input.catalog, {
    questCriteria: input.questCriteria,
    overrides: input.overrides,
  });
  for (const successId of closure.ids) {
    const row = input.catalog.get(successId);
    if (!row) continue;
    for (const itemId of row.itemIds ?? []) ids.add(itemId);
    // `PO=` d'une quête HORS guide : aucun détail de quête ne l'affiche, on le garde.
    for (const questId of row.questIds) {
      if (guideQuestIds.has(questId)) continue;
      for (const itemId of input.questCriteria?.get(questId)?.itemIds ?? []) {
        ids.add(itemId);
      }
    }
  }
  const items: RushSuccessPossession[] = [...ids].map((id) => {
    const name = input.itemNames?.[id] ?? `Objet ${id}`;
    return {
      id,
      name,
      inGuideResources:
        index.names.has(normalizeResourceName(name)) || index.ids.has(String(id)),
    };
  });
  const extras = items.filter((item) => !item.inGuideResources);
  return { items, extras, coveredCount: items.length - extras.length };
}

/**
 * Traduit un aperçu en écritures serveur, bloc par bloc.
 * Pure : l'UI et les tests lisent la MÊME règle de périmètre.
 */
export function planSuccessValidationWrites(
  preview: RushSuccessValidationPreview,
  milestones: readonly RushMilestone[]
): RushSuccessValidationWrite[] {
  const owner = new Map<string, string>();
  for (const milestone of milestones) {
    for (const sequence of milestone.sequences) owner.set(sequence.id, milestone.id);
  }
  return preview.blocks.map((block) => {
    const scopeSequenceIds = [
      ...new Set([
        ...block.targetSequenceIds,
        ...block.cascadedSequenceIds.filter(
          (id) => owner.get(id) === block.milestoneId
        ),
      ]),
    ];
    const byMilestone = new Map<string, string[]>();
    for (const sequenceId of [
      ...block.targetSequenceIds,
      ...block.cascadedSequenceIds,
    ]) {
      const milestoneId = owner.get(sequenceId) ?? block.milestoneId;
      const list = byMilestone.get(milestoneId) ?? [];
      list.push(sequenceId);
      byMilestone.set(milestoneId, list);
    }
    return {
      milestoneId: block.milestoneId,
      title: block.title,
      scopeSequenceIds,
      updates: [...byMilestone].map(([milestoneId, sequenceIds]) => ({
        milestoneId,
        sequenceIds: [...new Set(sequenceIds)],
      })),
    };
  });
}

function toCascadeMilestones(
  milestones: readonly RushMilestone[]
): RushCascadeMilestone[] {
  return milestones.map((milestone) => ({
    id: milestone.id,
    type: String(milestone.type ?? ""),
    sequences: milestone.sequences.map((sequence) => ({
      id: sequence.id,
      subGuideName: sequence.subGuideName,
      subGuideRef: sequence.subGuideRef,
      activityTags: sequence.activityTags,
      questDbIds: sequence.questDbIds,
      alignReq: sequence.alignReq,
      alignOrderCode: sequence.alignOrderCode,
      alignLevelReq: sequence.alignLevelReq,
    })),
  }));
}

/**
 * Planifie l'écriture. Retourne `null` si le succès n'est pas dans le catalogue.
 * Ne valide **jamais** un nœud hors guide : `targetSequenceIds` ne contient que les
 * séquences réelles du guide, et `cascadedSequenceIds` sort de la cascade pure du guide.
 */
export function planSuccessValidation(
  input: RushSuccessValidationInput
): RushSuccessValidationPreview | null {
  const row = input.catalog.get(input.successId);
  if (!row) return null;

  const guideQuestIds = new Set(input.guideQuests.map((quest) => quest.id));
  const leaves = successQuestLeaves(input.successId, input.catalog, guideQuestIds, {
    questCriteria: input.questCriteria,
    overrides: input.overrides,
  });

  const questById = new Map<number, RushGuideQuestRef>();
  for (const quest of input.guideQuests) questById.set(quest.id, quest);

  const missingTargets: Array<RushGuideQuestRef & { sequenceId: string }> = [];
  const seenSequences = new Set<string>();
  for (const questId of leaves.questIds) {
    const quest = questById.get(questId);
    if (!quest?.sequenceId || quest.done || seenSequences.has(quest.sequenceId)) continue;
    seenSequences.add(quest.sequenceId);
    missingTargets.push({ ...quest, sequenceId: quest.sequenceId });
  }

  const sequenceToMilestone = new Map<string, string>();
  const sequenceName = new Map<string, string>();
  for (const milestone of input.milestones) {
    for (const sequence of milestone.sequences) {
      sequenceToMilestone.set(sequence.id, milestone.id);
      sequenceName.set(sequence.id, sequence.subGuideName || sequence.subGuideRef || sequence.id);
    }
  }

  const targetByMilestone = new Map<string, string[]>();
  for (const quest of missingTargets) {
    const milestoneId = sequenceToMilestone.get(quest.sequenceId);
    if (!milestoneId) continue;
    const list = targetByMilestone.get(milestoneId) ?? [];
    list.push(quest.sequenceId);
    targetByMilestone.set(milestoneId, list);
  }

  const cascadeMilestones = toCascadeMilestones(input.milestones);
  const completed = completedSequenceIds(input.milestones, input.guideQuests);
  const blocks: RushSuccessValidationBlock[] = [];
  for (const milestone of input.milestones) {
    const targetSequenceIds = [...new Set(targetByMilestone.get(milestone.id) ?? [])];
    if (targetSequenceIds.length === 0) continue;
    const plan = planPrerequisiteCascade({
      milestones: cascadeMilestones,
      completed,
      targetMilestoneId: milestone.id,
      targetSequenceIds,
    });
    for (const id of plan.target) completed.add(id);
    for (const id of plan.added) completed.add(id);
    const cascadedSequenceIds = plan.added.filter(
      (id) => !targetSequenceIds.includes(id)
    );
    blocks.push({
      milestoneId: milestone.id,
      title: milestone.title || "Bloc",
      targetSequenceIds,
      cascadedSequenceIds,
      targetNames: targetSequenceIds.map((id) => sequenceName.get(id) ?? id),
      cascadedNames: cascadedSequenceIds.map((id) => sequenceName.get(id) ?? id),
    });
  }

  // Possessions : `need.items` seuls. Les `PO=` des quêtes sont des ressources de
  // quête, déjà dans leur fiche — on ne les répète pas ici.
  const possessions = successPossessionItems({
    successId: input.successId,
    catalog: input.catalog,
    milestones: input.milestones,
    guideQuests: input.guideQuests,
    questCriteria: input.questCriteria,
    overrides: input.overrides,
    itemNames: input.itemNames,
  });

  return {
    blocks,
    targetCount: missingTargets.length,
    cascadedCount: blocks.reduce(
      (sum, block) => sum + block.cascadedSequenceIds.length,
      0
    ),
    outsideQuestNames: leaves.outsideGuideQuestIds.map(
      (id) => input.questNames?.[id] ?? `Quête ${id}`
    ),
    possessionNames: possessions.extras.map((item) => item.name),
    coveredPossessionCount: possessions.coveredCount,
  };
}
