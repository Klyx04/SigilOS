/**
 * **Graphe des succès** — quête ↔ succès, règle pure.
 *
 * Le client/ DofusDB exposent plusieurs portes :
 *  · `Qf=<questId>` : les quêtes qui composent un succès (ou qui sont exigées par une quête) ;
 *  · `OA=<achievementId>` : un succès prérequis (succès → succès, ou quête → succès) ;
 *  · `PO=<itemId>` : un objet à posséder (possession, pas ressource de quête) ;
 *  · `PL>` : un niveau.
 *
 * Un succès n'est donc pas une case : c'est un nœud **dérivé**.
 * `done(S) = toutes ses Qf sont cochées ET tous ses OA sont done`.
 * Si une Qf ou un OA est hors guide, le succès est `unknown` (affiché « hors guide »),
 * jamais coché par défaut.
 *
 * Les arêtes **quête → succès** viennent des `startCriterion` des quêtes (DofusDB) :
 * une quête qui exige un succès, ou une quête dont la quête prérequise appartient à
 * une autre série (ex. Vert émeraude → Mais où sont les Dofus ?). Les méta-succès
 * purement éditoriaux (ex. Dom de Pin → L'héritage) passent par `overrides`.
 *
 * Pur : aucun accès réseau, aucune mutation. L'appelant fournit le catalogue,
 * les conditions de quête et les quêtes du guide avec leur état.
 */

import type { RushGuideQuestRef } from "./rush-guide-utils";
import { buildSuccessQuestRows, type RushSuccessQuestRow } from "./rush-success-quests";

/** Une entrée de `success-graph.json` (succès). */
export type RushSuccessCatalogRow = {
  id: number;
  name: string;
  questIds: readonly number[];
  successIds: readonly number[];
  /** Possessions (`need.items`) — pas les ressources de quête. */
  itemIds?: readonly number[];
};

export type RushSuccessCatalog = ReadonlyMap<number, RushSuccessCatalogRow>;

/** Conditions de départ d'une quête (DofusDB `startCriterion`). */
export type RushQuestCriteria = {
  id: number;
  name?: string;
  level?: number | null;
  questIds: readonly number[];
  successIds: readonly number[];
  itemIds: readonly number[];
  criterion?: string;
};

export type RushQuestCriteriaMap = ReadonlyMap<number, RushQuestCriteria>;

export type RushSuccessGraphOptions = {
  questCriteria?: RushQuestCriteriaMap;
  /** Règles éditoriales : succès → succès supplémentaires. */
  overrides?: Readonly<Record<string, readonly number[]>>;
  /** Index questId → succès parent, précalculé pour les gros parcours. */
  successByQuestId?: ReadonlyMap<number, number>;
};

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
  /** Succès prérequis directs (OA dérivés), avec leur état récursif. */
  prerequisites: RushSuccessPrerequisite[];
  /** Qf présentes dans le guide mais pas encore cochées. */
  missingQuestIds: number[];
  /** Qf absentes du guide : non vérifiables. */
  outsideGuideQuestIds: number[];
  /** OA directs non terminés. */
  missingSuccessIds: number[];
  /** OA directs hors catalogue / hors guide / cycle. */
  outsideGuideSuccessIds: number[];
  /** Possessions (succès + Qf) — jamais les ressources de quête. */
  requiredItemIds: number[];
};

export type RushSuccessEvaluationInput = {
  catalog: RushSuccessCatalog;
  guideQuests: readonly RushGuideQuestRef[];
  questNames?: Readonly<Record<number, string>> | ReadonlyMap<number, string>;
} & RushSuccessGraphOptions;

/** Méta éditorial (`rush-success-meta.json`) borné. */
export type RushSuccessMeta = {
  overrides: Record<string, number[]>;
  notes: Record<string, string>;
};

export function parseRushSuccessMeta(raw: unknown): RushSuccessMeta {
  const overrides: Record<string, number[]> = {};
  const notes: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return { overrides, notes };
  const source = raw as { overrides?: unknown; notes?: unknown };
  if (source.overrides && typeof source.overrides === "object") {
    for (const [key, value] of Object.entries(source.overrides)) {
      if (!/^\d+$/.test(key) || !Array.isArray(value)) continue;
      const ids = [
        ...new Set(
          value
            .map(Number)
            .filter((id) => Number.isSafeInteger(id) && id > 0)
        ),
      ].slice(0, 50);
      if (ids.length > 0) overrides[key] = ids;
    }
  }
  if (source.notes && typeof source.notes === "object") {
    for (const [key, value] of Object.entries(source.notes)) {
      if (!/^\d+$/.test(key) || typeof value !== "string") continue;
      const note = value.trim().slice(0, 300);
      if (note) notes[key] = note;
    }
  }
  return { overrides, notes };
}

/** Index questId → succès parent (le premier déclaré), pour les séries. */
export function buildSuccessByQuestId(
  catalog: RushSuccessCatalog
): Map<number, number> {
  const byQuest = new Map<number, number>();
  for (const row of catalog.values()) {
    for (const questId of row.questIds) {
      if (!byQuest.has(questId)) byQuest.set(questId, row.id);
    }
  }
  return byQuest;
}

/**
 * Succès prérequis **effectifs** d'un succès :
 *  · OA explicites (`successIds`) ;
 *  · overrides éditoriaux ;
 *  · OA des quêtes qui le composent (`questCriteria.successIds`) ;
 *  · succès parent d'une quête prérequise par une de ses Qf (séries).
 */
export function effectiveSuccessIds(
  id: number,
  input: {
    catalog: RushSuccessCatalog;
    questCriteria?: RushQuestCriteriaMap;
    overrides?: Readonly<Record<string, readonly number[]>>;
    successByQuestId?: ReadonlyMap<number, number>;
  }
): number[] {
  const row = input.catalog.get(id);
  if (!row) return [];
  const out = new Set<number>();
  for (const successId of row.successIds) out.add(successId);
  for (const successId of input.overrides?.[String(id)] ?? []) out.add(successId);
  if (!input.questCriteria) return [...out];

  const byQuest =
    input.successByQuestId ?? buildSuccessByQuestId(input.catalog);
  for (const questId of row.questIds) {
    const criteria = input.questCriteria.get(questId);
    if (!criteria) continue;
    for (const successId of criteria.successIds) out.add(successId);
    for (const requiredQuestId of criteria.questIds) {
      const parent = byQuest.get(requiredQuestId);
      if (parent != null && parent !== id) out.add(parent);
    }
  }
  out.delete(id);
  return [...out];
}

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

  const prerequisites: RushSuccessPrerequisite[] = effectiveSuccessIds(id, input).map(
    (successId) => {
      const prereq = evaluateSuccess(successId, input, memo, visiting);
      return { id: successId, name: prereq.name, state: prereq.state };
    }
  );
  visiting.delete(id);

  const missingSuccessIds = prerequisites
    .filter((prereq) => prereq.state === "pending")
    .map((prereq) => prereq.id);
  const outsideGuideSuccessIds = prerequisites
    .filter((prereq) => prereq.state === "unknown")
    .map((prereq) => prereq.id);

  const requiredItemIds = new Set<number>(row.itemIds ?? []);
  for (const questId of row.questIds) {
    for (const itemId of input.questCriteria?.get(questId)?.itemIds ?? []) {
      if (Number.isSafeInteger(itemId) && itemId > 0) requiredItemIds.add(itemId);
    }
  }

  let state: RushSuccessState;
  if (missingQuestIds.length > 0 || missingSuccessIds.length > 0) {
    state = "pending";
  } else if (outsideGuideQuestIds.length > 0 || outsideGuideSuccessIds.length > 0) {
    state = "unknown";
  } else if (questRows.length === 0 && prerequisites.length === 0) {
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
    requiredItemIds: [...requiredItemIds],
  };
  memo.set(id, evaluation);
  return evaluation;
}

/** Les succès prérequis directs (OA dérivés) d'un succès, avec leur état. */
export function successPrerequisiteRows(
  id: number,
  input: RushSuccessEvaluationInput
): RushSuccessPrerequisite[] {
  return evaluateSuccess(id, input).prerequisites;
}

/**
 * Fermeture des succès prérequis (OA dérivés), sans les quêtes.
 * Utile pour l'aperçu « Valider les prérequis » et les tests de cycles.
 */
export function successClosure(
  id: number,
  catalog: RushSuccessCatalog,
  options: RushSuccessGraphOptions = {}
): { ids: number[]; outsideCatalog: number[]; cycles: number[] } {
  const ids = new Set<number>();
  const outsideCatalog = new Set<number>();
  const cycles = new Set<number>();
  const visiting = new Set<number>();
  const byQuest =
    options.successByQuestId ?? buildSuccessByQuestId(catalog);

  const visit = (current: number) => {
    if (visiting.has(current)) {
      cycles.add(current);
      return;
    }
    if (ids.has(current)) return;
    const row = catalog.get(current);
    if (!row) {
      outsideCatalog.add(current);
      return;
    }
    const direct = effectiveSuccessIds(current, {
      catalog,
      questCriteria: options.questCriteria,
      overrides: options.overrides,
      successByQuestId: byQuest,
    });
    visiting.add(current);
    ids.add(current);
    for (const prereq of direct) {
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
  guideQuestIds: ReadonlySet<number>,
  options: RushSuccessGraphOptions = {}
): {
  questIds: number[];
  outsideGuideQuestIds: number[];
  successIds: number[];
  outsideCatalog: number[];
  cycles: number[];
} {
  const closure = successClosure(id, catalog, options);
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
 * Arêtes **quête → succès** génériques : une quête qui exige un succès.
 * Le graphe ne devine pas la source ; l'appelant fournit la map.
 */
export function questSuccessPrerequisites(
  questId: number,
  map: ReadonlyMap<number, readonly number[]> | null | undefined
): number[] {
  if (!map) return [];
  return [...new Set(map.get(questId) ?? [])];
}

/** Succès exigés par une quête, lus directement dans ses conditions DofusDB. */
export function questCriteriaSuccessIds(
  questId: number,
  criteria: RushQuestCriteriaMap | null | undefined
): number[] {
  if (!criteria) return [];
  return [...new Set(criteria.get(questId)?.successIds ?? [])];
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
    requiredItemIds: [],
  };
}
