/**
 * Garde de non-régression — **la section « Conseils & notes » ne doit plus être
 * conditionnée aux seuls `tips`/`note`**.
 *
 * Mesure du 24/11/2026 : 325 séquences du guide ont des conditions structurées
 * (combats, métiers, horaires) mais **aucun** `tips`. Les trois surfaces cachaient
 * alors tout le backfill. La règle unique vit dans `hasRushHints`
 * (`src/lib/rush-constraints.ts`, testée par `rush-constraints.test.ts`).
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SURFACES = [
  "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx",
  "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx",
  "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal.tsx",
];

describe("section Conseils & notes — les conditions seules suffisent", () => {
  it("les trois surfaces passent par la règle unique hasRushHints", () => {
    for (const file of SURFACES) {
      const code = readFileSync(file, "utf8");
      expect(code, file).toContain("hasRushHints");
    }
  });

  it("aucune surface ne referme la section sur tips/note uniquement", () => {
    for (const file of SURFACES) {
      const code = readFileSync(file, "utf8");
      expect(code, file).not.toContain("if (!tipsText && !seq.note) return null;");
      expect(code, file).not.toContain("{(seq.tips || seq.note) &&");
    }
  });
});
