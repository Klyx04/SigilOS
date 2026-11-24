import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildSuccessByQuestId,
  evaluateSuccess,
  parseRushSuccessMeta,
  successClosure,
  successQuestLeaves,
  type RushQuestCriteria,
  type RushQuestCriteriaMap,
  type RushSuccessCatalog,
  type RushSuccessCatalogRow,
} from "@/lib/rush-success-graph";

/**
 * Données **réelles** DofusDB (`success-graph.json`, 2c) : les trois exemples DPLN
 * doivent être couverts, pas seulement Six sur six.
 *  · 1048 Vert émeraude → 1036 Mais où sont les Dofus ? (via 1463 → 1462) ;
 *  · 5222 Prologue → 1705 Six sur six (via 2409 `OA=1705`) ;
 *  · 7761 En attendant le printemps → 5222, 7760, 5933 L'héritage (override DPLN).
 */

const payload = JSON.parse(
  readFileSync(path.join(process.cwd(), "public/game-data/success-graph.json"), "utf8")
) as {
  achievements: Array<{
    id: number;
    name: string;
    questIds: number[];
    successIds: number[];
    itemIds: number[];
  }>;
  quests: Array<{
    id: number;
    name: string;
    questIds: number[];
    successIds: number[];
    itemIds: number[];
    criterion: string;
    level: number | null;
  }>;
  items: Array<{ id: number; name: string; iconId: number | null }>;
};

const catalog: RushSuccessCatalog = new Map<number, RushSuccessCatalogRow>(
  payload.achievements.map((row) => [
    row.id,
    {
      id: row.id,
      name: row.name,
      questIds: row.questIds,
      successIds: row.successIds,
      itemIds: row.itemIds,
    },
  ])
);

const questCriteria: RushQuestCriteriaMap = new Map<number, RushQuestCriteria>(
  payload.quests.map((row) => [
    row.id,
    {
      id: row.id,
      name: row.name,
      level: row.level,
      questIds: row.questIds,
      successIds: row.successIds,
      itemIds: row.itemIds,
      criterion: row.criterion,
    },
  ])
);

const meta = parseRushSuccessMeta(
  JSON.parse(
    readFileSync(path.join(process.cwd(), "public/game-data/rush-success-meta.json"), "utf8")
  )
);

const input = {
  catalog,
  questCriteria,
  overrides: meta.overrides,
  guideQuests: [],
};

describe("DofusDB — graphe réel", () => {
  it("a bien les 2 777 succès, 1 984 quêtes et 478 objets nommés", () => {
    expect(payload.achievements.length).toBe(2777);
    expect(payload.quests.length).toBe(1984);
    expect(payload.items.length).toBe(478);
    const heritage = payload.achievements.find((row) => row.id === 5933);
    expect(heritage?.name).toBe("L'héritage de l'île brisée");
    expect(heritage?.successIds).toEqual([5925, 5928, 5931, 5932]);
  });

  it("nomme les possessions : les six Dofus et le Dom de Pin", () => {
    const items = new Map(payload.items.map((row) => [row.id, row.name]));
    expect(items.get(27803)).toBe("Dom de Pin");
    const six = payload.achievements.find((row) => row.id === 1705);
    expect((six?.itemIds ?? []).map((id) => items.get(id))).toEqual([
      "Dofus Émeraude",
      "Dofus Pourpre",
      "Dofus Turquoise",
      "Dofus Ocre",
      "Dofus Ivoire",
      "Dofus Ébène",
    ]);
  });

  it("Six sur six garde ses 11 OA et ses 6 possessions", () => {
    const evaluation = evaluateSuccess(1705, input);
    expect(evaluation.prerequisites).toHaveLength(11);
    expect(evaluation.prerequisites.map((row) => row.id)).toEqual(
      expect.arrayContaining([565, 1036, 1048, 1101, 1378, 1385, 1543, 1622, 1678, 1704, 5220])
    );
    expect(evaluation.requiredItemIds).toHaveLength(6);
  });

  it("Vert émeraude 1048 remonte à Mais où sont les Dofus ? 1036", () => {
    const evaluation = evaluateSuccess(1048, input);
    expect(evaluation.prerequisites.map((row) => row.id)).toContain(1036);
    // 1463 exige 1462, qui appartient à 1036.
    expect(buildSuccessByQuestId(catalog).get(1462)).toBe(1036);
  });

  it("Prologue 5222 remonte à Six sur six 1705", () => {
    expect(questCriteria.get(2409)?.successIds).toEqual([1705]);
    const evaluation = evaluateSuccess(5222, input);
    expect(evaluation.prerequisites.map((row) => row.id)).toContain(1705);
  });

  it("Dom de Pin 7761 remonte à Prologue, L'arbre et L'héritage (override)", () => {
    const evaluation = evaluateSuccess(7761, input);
    const ids = evaluation.prerequisites.map((row) => row.id);
    expect(ids).toEqual(expect.arrayContaining([5222, 7760, 5933]));
    expect(meta.overrides["7761"]).toEqual([5933]);

    const closure = successClosure(7761, catalog, {
      questCriteria,
      overrides: meta.overrides,
    });
    expect(closure.ids).toEqual(
      expect.arrayContaining([5222, 7760, 5933, 5925, 5928, 5931, 5932])
    );
  });

  it("les quêtes feuilles ne gardent que le guide et listent le reste", () => {
    const guideQuestIds = new Set([
      2489, 2409, 2420, 2449, 2463, 2464, 2465, 2466, 2468, 2471, 2472, 2473, 2474,
      2475, 2477, 2478, 2479, 2480, 2481, 2482,
    ]);
    const leaves = successQuestLeaves(7761, catalog, guideQuestIds, {
      questCriteria,
      overrides: meta.overrides,
    });
    expect(leaves.questIds).toContain(2489);
    expect(leaves.questIds).toContain(2463);
    expect(leaves.outsideGuideQuestIds.length).toBeGreaterThan(0);
  });
});
