import { describe, it, expect } from "vitest";
import { guideChannel, parseStepKey } from "@/lib/guide-realtime";

describe("guide-realtime (Phase E)", () => {
  it("guideChannel concatène guildId + guideSlug", () => {
    expect(guideChannel("1290442961380835451", "progression-complete")).toBe(
      "guide:1290442961380835451:progression-complete"
    );
  });

  it("parseStepKey décompose une clé GPx-N", () => {
    expect(parseStepKey("GP7-6")).toEqual({ subGuideRef: "GP7", stepNumber: 6 });
  });

  it("parseStepKey gère les refs à plusieurs caractères", () => {
    expect(parseStepKey("GP7B-12")).toEqual({ subGuideRef: "GP7B", stepNumber: 12 });
  });

  it("parseStepKey retourne null pour les clés non numériques ou invalides", () => {
    expect(parseStepKey("GP7-all")).toBeNull();
    expect(parseStepKey("bogus")).toBeNull();
    expect(parseStepKey("GP7")).toBeNull();
  });
});
