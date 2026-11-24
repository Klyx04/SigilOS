/**
 * **Graphe des succès** — quête ↔ succès, règle pure.
 *
 * Le client expose deux types d'objectifs sur un succès (`achievements.json`) :
 *  · `Qf=<questId>` → `questIds` : les quêtes qui composent le succès ;
 *  · `OA=<achievementId>` → `successIds` : les **succès prérequis**.
 *
 * Un succès n'est donc pas une case : c'est un nœud **dérivé**.
 * `done(S) = toutes ses Qf sont cochées ET tous ses OA sont done`.
 * Si une Qf ou un OA est hors guide, le succès n'est pas « obtenu » : il est
 * `unknown` (affiché « hors guide »), jamais coché par défaut.
 *
 * Les arêtes **quête → succès** (une quête qui exige un succès) sont supportées par
 * `questSuccessPrerequisites` ; elles viendront des conditions de quête du client ou
 * d'un tag `prereq_success` du studio. Le graphe ne les invente pas.
 *
 * Pur : aucun accès réseau, aucune mutation. Les appelants passent le catalogue et
 * les quêtes du guide (avec leur état `done`).
 */

import type { RushGuideQuestRef } from "./rush-guide-utils";
import { buildSuccessQuestRows, type RushSuccessQuestRow } from "./rush-success-quests";

/** Une entrée utile de `achievements.json`. */
export type RushSuccessCatalogRow = {
  id: number;
  name: string;
  questIds: readonly number[];
  successIds: readonly number[];
};

export type RushSuccessCatalog = ReadonlyMap<number, RushSuccessCatalogRow>;

export type RushSuccessState = "done" | "pending" | "unknown";

export type RushSuccessPrerequisite = {
  id: number;
  name: string;
  state: RushSuccessState;
};

export type RushSuccessEvaluation = {
  id: number;
  name: string;
  state: RushSuccessState;
  /** Quêtes du succès (Qf), avec l'état du guide. */
  questRows: RushSuccessQuestRow[];
  /** Succès prérequis directs (OA), avec leur état récursif. */
  prerequisites: RushSuccessPrerequisite[];
  /** Qf présentes dans le guide mais pas encore cochées. */
  missingQuestIds: number[];
  /** Qf absentes du guide : non vérifiables. */
  outsideGuideQuestIds: number[];
  /** OA directs non terminés. */
  missingSuccessIds: number[];
  /** OA directs hors catalogue / hors guide / cycle. */
  outsideGuideSuccessIds: number[];
};

export type RushSuccessEvaluationInput = {
  catalog: RushSuccessCatalog;
  guideQuests: readonly RushGuideQuestRef[];
  questNames?: Readonly<Record<number, string>> | ReadonlyMap<number, string>;
};

/**
 * Évalue un succès, ses Qf et ses OA, récursivement.
 * Les cycles sont absorbés : un nœud déjà en cours d'évaluation est `unknown`.
 */
export function evaluateSuccess(
  id: number,
  input: RushSuccessEvaluationInput,
  memo: Map<number, RushSuccessEvaluation> = new Map(),
  visiting: Set<number> = new Set()
): RushSuccessEvaluation {
  const cached = memo.get(id);
  if (cached) return cached;

  const row = input.catalog.get(id);
  if (!row) {
    const unknown = unknownEvaluation(id);
    memo.set(id, unknown);
    return unknown;
  }
  if (visiting.has(id)) {
    const cycle = unknownEvaluation(id);
    memo.set(id, cycle);
    return cycle;
  }

  visiting.add(id);
  const questRows = buildSuccessQuestRows(row.questIds, input.guideQuests, input.questNames);
  const missingQuestIds = questRows
    .filter((quest) => quest.inGuide && !quest.done)
    .map((quest) => quest.id);
  const outsideGuideQuestIds = questRows
    .filter((quest) => !quest.inGuide)
    .map((quest) => quest.id);

  const prerequisites: RushSuccessPrerequisite[] = row.successIds.map((successId) => {
    const prereq = evaluateSuccess(successId, input, memo, visiting);
    return { id: successId, name: prereq.name, state: prereq.state };
  });
  visiting.delete(id);

  const missingSuccessIds = prerequisites
    .filter((prereq) => prereq.state === "pending")
    .map((prereq) => prereq.id);
  const outsideGuideSuccessIds = prerequisites
    .filter((prereq) => prereq.state === "unknown")
    .map((prereq) => prereq.id);

  let state: RushSuccessState;
  if (missingQuestIds.length > 0 || missingSuccessIds.length > 0) {
    state = "pending";
  } else if (outsideGuideQuestIds.length > 0 || outsideGuideSuccessIds.length > 0) {
    state = "unknown";
  } else if (questRows.length === 0 && row.successIds.length === 0) {
    // Un succès sans Qf ni OA n'est pas vérifiable : jamais « done » par défaut.
    state = "unknown";
  } else {
    state = "done";
  }

  const evaluation: RushSuccessEvaluation = {
    id,
    name: row.name,
    state,
    questRows,
    prerequisites,
    missingQuestIds,
    outsideGuideQuestIds,
    missingSuccessIds,
    outsideGuideSuccessIds,
  };
  memo.set(id, evaluation);
  return evaluation;
}

/** Les succès prérequis directs (OA) d'un succès, avec leur état. */
export function successPrerequisiteRows(
  id: number,
  input: RushSuccessEvaluationInput
): RushSuccessPrerequisite[] {
  return evaluateSuccess(id, input).prerequisites;
}

/**
 * Fermeture des succès prérequis (OA), sans les quêtes.
 * Utile pour l'aperçu « Valider les prérequis » et les tests de cycles.
 */
export function successClosure(
  id: number,
  catalog: RushSuccessCatalog
): { ids: number[]; outsideCatalog: number[]; cycles: number[] } {
  const ids = new Set<number>();
  const outsideCatalog = new Set<number>();
  const cycles = new Set<number>();
  const visiting = new Set<number>();

  const visit = (current: number) => {
    if (visiting.has(current)) {
      cycles.add(current);
      return;
    }
    if (ids.has(current)) return;
    const row = catalog.get(current);
    if (!row?.successIds?.length) {
      ids.add(current);
      return;
    }
    visiting.add(current);
    ids.add(current);
    for (const prereq of row.successIds) {
      if (!catalog.has(prereq)) {
        outsideCatalog.add(prereq);
        continue;
      }
      visit(prereq);
    }
    visiting.delete(current);
  };

  visit(id);
  return { ids: [...ids], outsideCatalog: [...outsideCatalog], cycles: [...cycles] };
}

/**
 * Quêtes feuilles d'un succès et de sa fermeture OA : les Qf de chaque succès.
 * Les quêtes absentes du guide sont renvoyées à part (jamais inventées).
 */
export function successQuestLeaves(
  id: number,
  catalog: RushSuccessCatalog,
  guideQuestIds: ReadonlySet<number>
): { questIds: number[]; outsideGuideQuestIds: number[]; successIds: number[]; outsideCatalog: number[]; cycles: number[] } {
  const closure = successClosure(id, catalog);
  const questIds = new Set<number>();
  const outsideGuideQuestIds = new Set<number>();
  for (const successId of closure.ids) {
    const row = catalog.get(successId);
    if (!row) continue;
    for (const questId of row.questIds) {
      if (guideQuestIds.has(questId)) questIds.add(questId);
      else outsideGuideQuestIds.add(questId);
    }
  }
  return {
    questIds: [...questIds],
    outsideGuideQuestIds: [...outsideGuideQuestIds],
    successIds: closure.ids,
    outsideCatalog: closure.outsideCatalog,
    cycles: closure.cycles,
  };
}

/**
 * Arêtes **quête → succès** : une quête qui exige un succès. Le graphe ne devine
 * pas la source ; l'appelant fournit la map (conditions de quête du client ou tag
 * `prereq_success`).
 */
export function questSuccessPrerequisites(
  questId: number,
  map: ReadonlyMap<number, readonly number[]> | null | undefined
): number[] {
  if (!map) return [];
  return [...new Set(map.get(questId) ?? [])];
}

function unknownEvaluation(id: number): RushSuccessEvaluation {
  return {
    id,
    name: `Succès ${id}`,
    state: "unknown",
    questRows: [],
    prerequisites: [],
    missingQuestIds: [],
    outsideGuideQuestIds: [],
    missingSuccessIds: [],
    outsideGuideSuccessIds: [],
  };
}
