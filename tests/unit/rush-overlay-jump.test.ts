import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { planOverlayJump, releaseOverlayFilters } from "@/lib/rush-overlay-jump";

const read = (path: string) => readFileSync(path, "utf8");

const MILESTONES = [
  {
    id: "ms-1",
    sequences: [
      { id: "seq-a", subGuideName: "Première" },
      { id: "seq-b", subGuideName: "Deuxième" },
    ],
  },
  {
    id: "ms-2",
    sequences: [{ id: "seq-c", subGuideName: "Autre bloc" }],
  },
];

/**
 * Saut vers un prérequis dans l'overlay.
 *
 * Bug mesuré le 22/11/2026 : `handleGoToPrereq` cherchait `overlay-seq-*` avec
 * le `document` GLOBAL — dans une PiP, c'est le document hôte. Le bloc changeait
 * bien, mais la ligne cible n'était jamais trouvée. Aucun retour n'était proposé.
 */
describe("overlay Rush — saut vers un prérequis", () => {
  it("trouve la quête cible dans le même bloc", () => {
    expect(planOverlayJump(MILESTONES, { milestoneId: "ms-1", seqId: "seq-b" })).toEqual({
      milestoneIndex: 0,
      seqId: "seq-b",
      name: "Deuxième",
    });
  });

  it("trouve la quête cible dans un autre bloc", () => {
    expect(planOverlayJump(MILESTONES, { milestoneId: "ms-2", seqId: "seq-c" })).toEqual({
      milestoneIndex: 1,
      seqId: "seq-c",
      name: "Autre bloc",
    });
  });

  it("refuse un bloc inconnu (fail-closed)", () => {
    expect(planOverlayJump(MILESTONES, { milestoneId: "ms-x", seqId: "seq-a" })).toBeNull();
  });

  it("refuse une quête absente du bloc (fail-closed)", () => {
    expect(planOverlayJump(MILESTONES, { milestoneId: "ms-1", seqId: "seq-c" })).toBeNull();
  });

  it("ne relâche aucun filtre quand la cible est déjà visible", () => {
    expect(
      releaseOverlayFilters(
        { search: "", hideCompleted: false, questFilter: "all" },
        { isDone: false, isLocked: false }
      )
    ).toEqual({ clearSearch: false, showCompleted: false, resetQuestFilter: false });
  });

  it("vide la recherche active pour rendre la cible d'un autre bloc", () => {
    expect(
      releaseOverlayFilters(
        { search: "sang", hideCompleted: false, questFilter: "all" },
        { isDone: false, isLocked: false }
      ).clearSearch
    ).toBe(true);
  });

  it("réaffiche les quêtes faites seulement si la cible est faite", () => {
    const filters = { search: "", hideCompleted: true, questFilter: "all" as const };
    expect(releaseOverlayFilters(filters, { isDone: true, isLocked: false }).showCompleted).toBe(true);
    expect(releaseOverlayFilters(filters, { isDone: false, isLocked: false }).showCompleted).toBe(false);
  });

  it("repasse le filtre à Toutes seulement si la cible ne matche pas", () => {
    const active = { search: "", hideCompleted: false, questFilter: "active" as const };
    expect(releaseOverlayFilters(active, { isDone: false, isLocked: false }).resetQuestFilter).toBe(false);
    expect(releaseOverlayFilters(active, { isDone: false, isLocked: true }).resetQuestFilter).toBe(true);

    const locked = { search: "", hideCompleted: false, questFilter: "locked" as const };
    expect(releaseOverlayFilters(locked, { isDone: false, isLocked: true }).resetQuestFilter).toBe(false);
    expect(releaseOverlayFilters(locked, { isDone: false, isLocked: false }).resetQuestFilter).toBe(true);

    const done = { search: "", hideCompleted: false, questFilter: "done" as const };
    expect(releaseOverlayFilters(done, { isDone: true, isLocked: false }).resetQuestFilter).toBe(false);
    expect(releaseOverlayFilters(done, { isDone: false, isLocked: false }).resetQuestFilter).toBe(true);
  });

  it("le saut cherche la ligne dans le document de l'overlay, pas dans l'hôte", () => {
    const shell = read("src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx");
    expect(shell).toContain("const doc = rootRef.current?.ownerDocument;");
    expect(shell).toContain("doc.getElementById(`overlay-seq-${pendingFocus.seqId}`)");
    expect(shell).not.toContain("document.getElementById(`overlay-seq-");
  });

  it("un prérequis unique mène directement à la quête", () => {
    const row = read(
      "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx"
    );
    expect(row).toContain("prereqs.length === 1 && onGoToPrereq");
  });

  it("le retour à la quête d'origine est proposé comme dans le guide interne", () => {
    const shell = read("src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx");
    expect(shell).toContain('label: "Revenir"');
    expect(shell).toContain("Retour à la quête d'origine");
    expect(shell).toContain("duration: 10000");
    // La ref donne au toast le `jumpToQuest` courant : sans elle, un filtre
    // changé pendant les 10 s rendrait le retour muet.
    expect(shell).toContain("jumpToQuestRef.current(origin)");
    expect(shell).toContain("jumpToQuestRef.current = jumpToQuest");
    // Un second saut avant la fin de l'anneau doit retirer l'ancien surlignage.
    expect(shell).toContain("highlighted?.classList.remove(...ring)");
  });
});
