import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluateSuccess,
  questSuccessPrerequisites,
  successClosure,
  successPrerequisiteRows,
  successQuestLeaves,
  type RushSuccessCatalog,
  type RushSuccessCatalogRow,
} from "@/lib/rush-success-graph";
import type { RushGuideQuestRef } from "@/lib/rush-guide-utils";

const CATALOG: RushSuccessCatalog = new Map<number, RushSuccessCatalogRow>([
  [1, { id: 1, name: "Six sur six", questIds: [10, 11], successIds: [2, 3] }],
  [2, { id: 2, name: "Quatre sur six", questIds: [20, 21], successIds: [] }],
  [3, { id: 3, name: "Dofus Émeraude", questIds: [30], successIds: [] }],
]);

function guideQuest(id: number, done: boolean): RushGuideQuestRef {
  return { id, name: `Quête ${id}`, done };
}

const GUIDE = [
  guideQuest(10, true),
  guideQuest(11, true),
  guideQuest(20, true),
  guideQuest(21, false),
  guideQuest(30, true),
];

describe("graphe des succès — succès dérivé", () => {
  it("un succès n'est done qu'avec ses Qf ET ses OA", () => {
    const pending = evaluateSuccess(1, { catalog: CATALOG, guideQuests: GUIDE });
    expect(pending.state).toBe("pending");
    expect(pending.missingSuccessIds).toEqual([2]);
    expect(pending.prerequisites.map((row) => [row.id, row.state])).toEqual([
      [2, "pending"],
      [3, "done"],
    ]);

    const done = evaluateSuccess(1, {
      catalog: CATALOG,
      guideQuests: [...GUIDE.slice(0, 3), guideQuest(21, true), GUIDE[4]],
    });
    expect(done.state).toBe("done");
    expect(done.missingSuccessIds).toEqual([]);
  });

  it("une Qf hors guide rend le succès non vérifiable, jamais coché", () => {
    const evaluation = evaluateSuccess(1, {
      catalog: CATALOG,
      guideQuests: [guideQuest(10, true), guideQuest(20, true), guideQuest(21, true), guideQuest(30, true)],
    });

    expect(evaluation.state).toBe("unknown");
    expect(evaluation.outsideGuideQuestIds).toEqual([11]);
    expect(evaluation.questRows.find((row) => row.id === 11)?.inGuide).toBe(false);
  });

  it("descend les OA récursivement et absorbe les cycles", () => {
    const cycle: RushSuccessCatalog = new Map([
      [1, { id: 1, name: "A", questIds: [], successIds: [2] }],
      [2, { id: 2, name: "B", questIds: [], successIds: [1] }],
    ]);

    const evaluation = evaluateSuccess(1, { catalog: cycle, guideQuests: [] });
    expect(evaluation.state).toBe("unknown");
    expect(evaluation.outsideGuideSuccessIds).toContain(2);

    const closure = successClosure(1, cycle);
    expect(closure.ids).toEqual(expect.arrayContaining([1, 2]));
    expect(closure.cycles.length).toBeGreaterThan(0);
  });

  it("renvoie les prérequis directs et les quêtes feuilles du guide", () => {
    expect(successPrerequisiteRows(1, { catalog: CATALOG, guideQuests: GUIDE })).toEqual([
      { id: 2, name: "Quatre sur six", state: "pending" },
      { id: 3, name: "Dofus Émeraude", state: "done" },
    ]);

    const leaves = successQuestLeaves(1, CATALOG, new Set([10, 11, 20, 30]));
    expect(leaves.questIds).toEqual(expect.arrayContaining([10, 11, 20, 30]));
    expect(leaves.outsideGuideQuestIds).toEqual([21]);
  });

  it("ne devine pas une arête quête → succès absente de la map", () => {
    expect(questSuccessPrerequisites(10, null)).toEqual([]);
    expect(questSuccessPrerequisites(10, new Map([[10, [3]]]))).toEqual([3]);
  });
});

describe("graphe des succès — données réelles", () => {
  it("Six sur six (1705) porte bien les 11 OA du client, dont 565", () => {
    const payload = JSON.parse(
      readFileSync(path.join(process.cwd(), "public/game-data/achievements.json"), "utf8")
    ) as {
      achievements: Array<{
        id: number;
        name: string;
        questIds?: number[];
        successIds?: number[];
      }>;
    };
    const six = payload.achievements.find((row) => row.id === 1705);
    expect(six?.name).toBe("Six sur six");
    expect(six?.questIds).toEqual([2048, 2049, 2050]);
    expect(six?.successIds).toEqual(
      expect.arrayContaining([565, 1036, 1048, 1101, 1378, 1385, 1543, 1622, 1678, 1704, 5220])
    );
    expect(six?.successIds).toHaveLength(11);
  });
});
