import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Verrous du 25/11/2026 — retours user sur l'overlay :
 *   · les notifications d'une copie de position doivent rester DANS la PiP ;
 *   · chaque bloc de quête porte un bandeau d'icônes au-dessus du nom, pour que
 *     le titre « respire » au lieu d'être tronqué par les actions.
 */
const ITEM = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const TOAST_SHARED = [
  "src/components/dofus-quests/rush/RushPositionMenu.tsx",
  "src/components/dofus-quests/rush/SuccessChip.tsx",
  "src/components/dofus-quests/rush/QuestItemResourceGrid.tsx",
  "src/components/dofus-quests/rush/DungeonAchievementsPanel.tsx",
  "src/components/dofus-quests/rush/AlignmentChoiceForm.tsx",
];
const code = (path: string) => readFileSync(path, "utf8");

describe("overlay — notifications et bandeau de quête", () => {
  it("les composants partagés routent leurs toasts vers le Toaster de la PiP", () => {
    for (const path of TOAST_SHARED) {
      const src = code(path);
      expect(src, path).toContain("useOverlayToast");
      expect(src, path).not.toContain('from "sonner"');
    }
    // Le Toaster dédié est bien monté dans le portail de l'overlay.
    expect(code(OVERLAY)).toContain("OverlayToaster");
  });

  it("chaque bloc porte un bandeau d'icônes au-dessus du nom", () => {
    const src = code(ITEM);
    expect(src).toContain("const rowActions = (");
    // Le bandeau est rendu AVANT la ligne du titre (ordre du source).
    expect(src.indexOf("{rowActions}")).toBeLessThan(src.indexOf("className=\"da-qtitle"));
    // L'ancienne rangée d'icônes à droite du titre a disparu (pas de doublon).
    expect(src).not.toContain('<div className="flex shrink-0 items-center gap-0.5">');
    expect(src).toContain('className="ml-auto flex shrink-0 items-center gap-0.5"');
  });

  it("le numéro d'alignement vit avec le titre, pas dans une 2e ligne", () => {
    const src = code(ITEM);
    const titleBlock = src.slice(src.indexOf("flex min-w-0 flex-wrap items-center gap-1.5"));
    expect(titleBlock).toContain("<RushAlignmentBadge");
    expect(titleBlock).toContain("da-qtitle");
  });
});
