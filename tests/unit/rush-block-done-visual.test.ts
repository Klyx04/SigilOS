import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Verrou du 25/11/2026 — un bloc entièrement validé doit se VOIR.
 *
 * Mesure user : l'ancien rendu posait `opacity-80` sur le panneau public (le
 * titre grisait) et le bloc terminé ne se distinguait pas d'un bloc désactivé.
 * Le sceau, le filet vert et le repère du sommaire sont désormais partagés par
 * les trois surfaces ; ce test empêche leur disparition silencieuse.
 */
const PUB = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const DASH = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const NAV = "src/components/dofus-quests/rush/RushChapterNav.tsx";
const BAR = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayChapterBar.tsx";
const SEAL = "src/components/dofus-quests/rush/RushBlockDoneSeal.tsx";
const CSS = "src/app/da-wakfu.css";

const code = (path: string) => readFileSync(path, "utf8");

describe("bloc validé — repère visuel partagé", () => {
  it("le sceau et le panneau sont les mêmes sur le public et le dashboard", () => {
    expect(code(SEAL)).toContain("rush-block-done-seal");
    for (const path of [PUB, DASH]) {
      expect(code(path), path).toContain("RushBlockDoneSeal");
      expect(code(path), path).toContain("rush-block-done");
    }
    expect(code(CSS)).toContain(".rush-block-done {");
    expect(code(CSS)).toContain(".rush-block-done-seal {");
  });

  it("le sommaire de gauche et la barre de l'overlay marquent les blocs terminés", () => {
    expect(code(NAV)).toContain('data-done={isDone ? "true" : undefined}');
    expect(code(BAR)).toContain('data-done={msDone ? "true" : undefined}');
    expect(code(CSS)).toContain('.da-guide-nav-item[data-done="true"]');
    expect(code(CSS)).toContain('.da-dock[data-done="true"]');
  });

  it("un bloc terminé n'est plus grisé par une opacité", () => {
    expect(code(PUB)).not.toContain("border-success/30 opacity-80");
    expect(code(DASH)).not.toContain('"border-success/30 bg-surface"');
  });
});
