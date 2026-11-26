import { describe, it, expect } from "vitest";
import {
  dofusQuestRefsForMilestone,
  dofusQuestStats,
  isQuestDone,
  isQuestDoneBySequenceIds,
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

describe("dofusQuestStats — % personnel au grain de la quête", () => {
  const MILESTONES = [
    {
      id: "m1",
      dofusId: "pourpre",
      sequences: [
        { id: "q1" },
        { id: "q2" },
        { id: "succes", isSuccess: true },
        { id: "info", activityTags: [{ type: "info_sequence" }] },
      ],
    },
    { id: "m2", dofusId: "pourpre", sequences: [{ id: "q3" }] },
    { id: "m3", dofusId: "inconnu", sequences: [{ id: "q4" }] },
  ];

  it("compte les quêtes, écarte succès et encarts INFO", () => {
    expect(dofusQuestStats(MILESTONES, [])).toEqual([
      expect.objectContaining({ id: "pourpre", done: 0, total: 3, pct: 0 }),
    ]);
  });

  it("grimpe dès qu'une seule quête est cochée", () => {
    expect(dofusQuestStats(MILESTONES, ["q1"])[0]).toMatchObject({ done: 1, total: 3, pct: 33 });
    expect(dofusQuestStats(MILESTONES, ["q1", "q2", "q3"])[0]).toMatchObject({
      done: 3,
      total: 3,
      pct: 100,
    });
  });

  it("ignore un Dofus inconnu au lieu d'inventer une ligne", () => {
    expect(dofusQuestStats(MILESTONES, ["q4"]).some((stat) => stat.id === "inconnu")).toBe(false);
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

describe("étape à choix — une seule quête dans la fiche Dofus", () => {
  const choice = (id: string, step: string, group = "66") => ({
    id,
    subGuideRef: step,
    subGuideName: step,
    activityTags: [{ type: "choice_group", name: group }],
  });
  const simple = (id: string, step: string) => ({
    id,
    subGuideRef: step,
    subGuideName: step,
    activityTags: [],
  });

  const milestone = {
    id: "ms-turquoise",
    title: "Dofus Turquoise",
    chapterLabel: "Alignement - Partie 2/4",
    sequences: [
      simple("q1", "Quête A"),
      choice("q2", "Les ordres sont-ils les ordres ?"),
      choice("q3", "On m'appelle l'Escargot"),
    ],
  };

  it("replie les variantes en une seule quête", () => {
    const refs = dofusQuestRefsForMilestone(milestone as any);
    expect(refs).toHaveLength(2);
    expect(refs[1]).toMatchObject({
      label: "Les ordres sont-ils les ordres ?",
      variantCount: 2,
      variantSteps: ["Les ordres sont-ils les ordres ?", "On m'appelle l'Escargot"],
    });
  });

  it("une variante validée suffit pour la quête et pour le 100 %", () => {
    const refs = dofusQuestRefsForMilestone(milestone as any);
    expect(isQuestDone(refs[1], new Set(["On m'appelle l'Escargot-all"]))).toBe(true);
    expect(isQuestDoneBySequenceIds(refs[1], new Set(["q3"]))).toBe(true);
    const progress = memberDofusProgress(
      refs,
      new Set(["Quête A-all", "On m'appelle l'Escargot-all"]),
      null
    );
    expect(progress).toMatchObject({ done: 2, total: 2, pct: 100 });
  });
});
