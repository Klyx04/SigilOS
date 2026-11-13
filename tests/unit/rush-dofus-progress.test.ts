import { describe, it, expect } from "vitest";
import {
  isQuestDone,
  memberDofusProgress,
  questStepKeys,
  type DofusQuestRef,
} from "@/lib/rush-dofus-progress";

/**
 * Garde de la modale « Progression Guilde par Dofus » : elle doit dire **où en est
 * chaque membre sur une quête de ce Dofus**, à partir des seules clés d'étapes
 * (`<subGuideRef>-<n>`) et de l'étape courante — sans rien inventer.
 */
const q = (label: string, step: string, steps = 1, category = "Dofus Émeraude"): DofusQuestRef => ({
  milestoneId: `ms-${step}`,
  category,
  label,
  step,
  steps,
});

const QUESTS = [q("Quête A", "A"), q("Quête B", "B", 3), q("Quête C", "C")];

describe("rush-dofus-progress — étapes d'une quête", () => {
  it("déplie une quête découpée, et accepte `-all`/`-1` pour une quête d'un seul tenant", () => {
    expect(questStepKeys(q("A", "A"))).toEqual(["A-all", "A-1"]);
    expect(questStepKeys(q("B", "B", 3))).toEqual(["B-1", "B-2", "B-3"]);
  });

  it("une quête est faite seulement quand TOUTES ses étapes le sont", () => {
    expect(isQuestDone(q("B", "B", 3), new Set(["B-1", "B-2"]))).toBe(false);
    expect(isQuestDone(q("B", "B", 3), new Set(["B-1", "B-2", "B-3"]))).toBe(true);
    expect(isQuestDone(q("A", "A"), new Set(["A-all"]))).toBe(true);
    expect(isQuestDone(q("A", "A"), new Set(["A-1"]))).toBe(true);
  });
});

describe("rush-dofus-progress — où en est un membre", () => {
  it("sans progression : première quête en cours, 0 %", () => {
    const progress = memberDofusProgress(QUESTS, [], null);
    expect(progress).toMatchObject({ done: 0, total: 3, pct: 0, currentIndex: 1, lastDone: null });
    expect(progress.current?.label).toBe("Quête A");
  });

  it("suit l'étape courante du joueur quand elle appartient au Dofus", () => {
    const progress = memberDofusProgress(QUESTS, ["A-all", "B-1"], "B-2");
    expect(progress.current?.label).toBe("Quête B");
    expect(progress.currentIndex).toBe(2);
    expect(progress.lastDone?.label).toBe("Quête A");
    expect(progress.pct).toBe(33);
  });

  it("sans étape courante, reprend à la première quête non terminée", () => {
    const progress = memberDofusProgress(QUESTS, ["A-all", "B-1", "B-2", "B-3"], null);
    expect(progress.current?.label).toBe("Quête C");
    expect(progress.done).toBe(2);
  });

  it("Dofus terminé : plus de quête courante, 100 %", () => {
    const progress = memberDofusProgress(QUESTS, ["A-all", "B-1", "B-2", "B-3", "C-all"], null);
    expect(progress).toMatchObject({ done: 3, total: 3, pct: 100, current: null, currentIndex: 0 });
    expect(progress.lastDone?.label).toBe("Quête C");
  });

  it("ignore une étape courante qui n'appartient pas à ce Dofus", () => {
    const progress = memberDofusProgress(QUESTS, [], "Z-1");
    expect(progress.current?.label).toBe("Quête A");
  });

  it("Dofus vide : aucune division par zéro", () => {
    expect(memberDofusProgress([], ["A-all"], null)).toMatchObject({ done: 0, total: 0, pct: 0, current: null });
  });
});
