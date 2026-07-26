import { describe, it, expect } from "vitest";
import { buildMilestoneStepKeys } from "../../src/lib/guide-progress-helpers";

describe("buildMilestoneStepKeys", () => {
  it("expands step ranges and preserves all-step fallback", () => {
    const sequences = [
      {
        subGuideRef: "A",
        stepFrom: 2,
        stepTo: 4,
      },
      {
        subGuideRef: "B",
        stepFrom: null,
        stepTo: null,
      },
    ] as any;

    expect(buildMilestoneStepKeys(sequences)).toEqual([
      "A-2",
      "A-3",
      "A-4",
      "B-all",
    ]);
  });
});
