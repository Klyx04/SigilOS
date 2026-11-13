/**
 * Garde — **un seul mot par chose** dans le Rush (12/11/2026).
 *
 * 🎯 Mesure du 12/11/2026 : le mot « étapes » comptait des **quêtes** dans quatre écrans
 * (overlay, dashboard, guide public) et des **blocs** dans un cinquième
 * (`OptimizedGuideClient`) — d'où trois chiffres incomparables pour le même guide
 * (« 50 / 352 étapes », « 5 chapitres », « CH.1 : 50 »).
 *
 * Désormais : **quête** = une ligne cochable, **bloc** = un regroupement du guide,
 * **chapitre** = un regroupement de blocs (la pagination du guide).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const OVERLAY_HEADER = read("src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader.tsx");
const DASHBOARD = read("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx");
const PUBLIC_GUIDE = read("src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx");
const LEGACY_GUIDE = read("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/OptimizedGuideClient.tsx");

describe("vocabulaire du Rush — un mot par chose", () => {
  it("les compteurs de quêtes disent « quêtes » (plus « étapes »)", () => {
    expect(OVERLAY_HEADER).toContain("{totalSteps} quêtes");
    expect(DASHBOARD).toContain("{cs} / {totalQuests} quêtes");
    expect(DASHBOARD).toContain("{ci} / {ti} quêtes");
    expect(PUBLIC_GUIDE).toContain("{chapterSteps.length} quêtes");
  });

  it("le compteur de blocs dit « blocs » (il compte des jalons, pas des quêtes)", () => {
    expect(LEGACY_GUIDE).toContain("{milestones.length} blocs complétés");
  });

  it("plus aucun compteur ne dit « étapes » suivi d'un pourcentage", () => {
    for (const [name, code] of [
      ["RushOverlayHeader", OVERLAY_HEADER],
      ["RushTimelineClient", DASHBOARD],
      ["PublicRushGuideClient", PUBLIC_GUIDE],
      ["OptimizedGuideClient", LEGACY_GUIDE],
    ] as const) {
      expect(code, `${name} compte encore en « étapes »`).not.toMatch(/\}\s*étapes\s*(complétées)?\s*\(/);
    }
  });
});
