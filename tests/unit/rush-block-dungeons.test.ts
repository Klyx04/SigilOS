import { describe, expect, it } from "vitest";

import {
  planRequiredDungeonChecks,
  type RushBlockDungeonSequence,
} from "@/lib/rush-block-dungeons";
import type { RushSequence } from "@/types/rush-guide-types";

function sequence(
  id: string,
  dungeons: Array<Record<string, unknown>>,
  activityTags: Array<Record<string, unknown>> = []
): RushBlockDungeonSequence {
  return {
    id,
    sequence: { dungeons, activityTags } as unknown as RushSequence,
  };
}

describe("planRequiredDungeonChecks", () => {
  it("coche un donjon requis simple", () => {
    const plan = planRequiredDungeonChecks([
      sequence("s1", [{ id: "d1", name: "Donjon 1" }]),
    ]);

    expect(plan).toEqual([{ sequenceId: "s1", dungeonKey: "d1" }]);
  });

  it("ne coche jamais un donjon optionnel", () => {
    const plan = planRequiredDungeonChecks([
      sequence("s1", [{ id: "d1", name: "Donjon 1", isOptional: true }]),
    ]);

    expect(plan).toEqual([]);
  });

  it("groupe « au choix » : une seule alternative, la première", () => {
    const plan = planRequiredDungeonChecks([
      sequence(
        "s1",
        [
          { id: "a", name: "Donjon A" },
          { id: "b", name: "Donjon B" },
        ],
        [{ type: "donjon", name: "Donjon A / Donjon B — selon le niveau" }]
      ),
    ]);

    expect(plan).toHaveLength(1);
    expect(plan[0].sequenceId).toBe("s1");
    expect(["a", "b"]).toContain(plan[0].dungeonKey);
  });

  it("préfère l'alternative déjà cochée", () => {
    const plan = planRequiredDungeonChecks(
      [
        sequence(
          "s1",
          [
            { id: "a", name: "Donjon A" },
            { id: "b", name: "Donjon B" },
          ],
          [{ type: "donjon", name: "Donjon A / Donjon B — selon le niveau" }]
        ),
      ],
      ["b"]
    );

    expect(plan).toEqual([{ sequenceId: "s1", dungeonKey: "b" }]);
  });

  it("ne coche que les donjons requis quand un groupe et un simple coexistent", () => {
    const plan = planRequiredDungeonChecks([
      sequence(
        "s1",
        [
          { id: "a", name: "Donjon A" },
          { id: "b", name: "Donjon B" },
          { id: "c", name: "Donjon C" },
        ],
        [{ type: "donjon", name: "Donjon A / Donjon B — selon le niveau" }]
      ),
    ]);

    // Le groupe « au choix » = 1, le donjon C = 1.
    expect(plan).toHaveLength(2);
    expect(plan.map((check) => check.dungeonKey)).toContain("c");
  });
});
