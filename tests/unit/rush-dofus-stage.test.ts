import { describe, expect, it } from "vitest";
import {
  RUSH_DOFUS_STAGES,
  RUSH_DOFUS_STAGE_COUNT,
  dofusStage,
} from "@/lib/rush-dofus-stage";

/**
 * Garde — frise des stades du Dofus (DA « Gouache Wakfu », lot E1e ⑥).
 *
 * Cinq losanges sous la jauge, un stade nommé : la maquette décide des seuils
 * (2 / 25 / 45 / 75 %). On teste la **règle**, pas le rendu — le composant ne fait
 * que peindre `index` et `label`.
 */
describe("dofusStage — les cinq stades de la maquette", () => {
  it("nomme les cinq stades, dans l'ordre Graine → Grand pin", () => {
    expect([...RUSH_DOFUS_STAGES]).toEqual(["Graine", "Pousse", "Jeune pin", "Pin", "Grand pin"]);
    expect(RUSH_DOFUS_STAGE_COUNT).toBe(5);
  });

  it("suit les seuils de la maquette (2 / 25 / 45 / 75 %)", () => {
    expect(dofusStage(0)).toEqual({ index: 0, label: "Graine" });
    expect(dofusStage(1.9)).toEqual({ index: 0, label: "Graine" });
    expect(dofusStage(2)).toEqual({ index: 1, label: "Pousse" });
    expect(dofusStage(24.9)).toEqual({ index: 1, label: "Pousse" });
    expect(dofusStage(25)).toEqual({ index: 2, label: "Jeune pin" });
    expect(dofusStage(45)).toEqual({ index: 3, label: "Pin" });
    expect(dofusStage(74.9)).toEqual({ index: 3, label: "Pin" });
    expect(dofusStage(75)).toEqual({ index: 4, label: "Grand pin" });
    expect(dofusStage(100)).toEqual({ index: 4, label: "Grand pin" });
  });

  it("ne descend jamais et ne sort jamais de l'échelle (entrées sales)", () => {
    let previous = -1;
    for (let pct = 0; pct <= 100; pct += 1) {
      const { index } = dofusStage(pct);
      expect(index).toBeGreaterThanOrEqual(previous);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(RUSH_DOFUS_STAGE_COUNT - 1);
      previous = index;
    }
    expect(dofusStage(-40).index).toBe(0);
    expect(dofusStage(Number.NaN).index).toBe(0);
    expect(dofusStage(Number.POSITIVE_INFINITY).index).toBe(RUSH_DOFUS_STAGE_COUNT - 1);
  });
});
