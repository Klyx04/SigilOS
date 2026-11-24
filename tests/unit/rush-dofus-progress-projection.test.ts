import { describe, expect, it } from "vitest";

import {
  memberCompletedStepKeys,
  projectRushStepKeys,
  questStatusForMembers,
  rushStepKeysBySequenceId,
} from "@/lib/rush-dofus-progress";

/**
 * La base stocke `PlayerGuideProgress.completedSteps` en **ids de séquence**
 * pour le Rush ; les règles de statut attendent des clés `<subGuideRef>-<n>`.
 * Mesure du 20/11/2026 : 4 blocs terminés en base, modale « Progression Guilde
 * par Dofus » à 0/8 — aucune quête n'était reconnue validée.
 */

const MILESTONES = [
  {
    sequences: [
      { id: "seq-a", subGuideRef: "Ali-1", stepFrom: null, stepTo: null },
      { id: "seq-b", subGuideRef: "GP7", stepFrom: 1, stepTo: 2 },
    ],
  },
];

const QUEST_A = { milestoneId: "m", category: "c", label: "Ali 1", step: "Ali-1", steps: 1 };
const QUEST_B = { milestoneId: "m", category: "c", label: "GP 7", step: "GP7", steps: 2 };

describe("projection des étapes Rush", () => {
  it("projette un id de séquence vers ses clés d'étape", () => {
    const map = rushStepKeysBySequenceId(MILESTONES);
    expect(projectRushStepKeys(["seq-a"], map)).toEqual(["Ali-1-all"]);
    expect(projectRushStepKeys(["seq-b"], map)).toEqual(["GP7-1", "GP7-2"]);
  });

  it("conserve une clé déjà au format Ganymède", () => {
    const map = rushStepKeysBySequenceId(MILESTONES);
    expect(projectRushStepKeys(["GP7-6"], map)).toEqual(["GP7-6"]);
  });

  it("reconnaît une quête validée après projection", () => {
    const map = rushStepKeysBySequenceId(MILESTONES);
    const member = { completedSteps: projectRushStepKeys(["seq-a"], map), currentStep: null };
    expect(questStatusForMembers([QUEST_A], [member])[0].done).toBe(true);
  });

  it("exige toutes les étapes d'une quête découpée", () => {
    const map = rushStepKeysBySequenceId(MILESTONES);
    const partial = { completedSteps: projectRushStepKeys(["seq-b"], map).slice(0, 1), currentStep: null };
    expect(questStatusForMembers([QUEST_B], [partial])[0].done).toBe(false);
  });

  it("un bloc isCompleted vaut toutes ses séquences, même sans completedSteps", () => {
    const map = rushStepKeysBySequenceId(MILESTONES);
    const sequenceIdsByMilestone = new Map([["m", ["seq-a", "seq-b"]]]);
    const keys = memberCompletedStepKeys({
      rows: [{ milestoneId: "m", isCompleted: true, completedSteps: [] }],
      sequenceIdsByMilestone,
      stepKeysBySequenceId: map,
    });

    expect(keys).toEqual(["Ali-1-all", "GP7-1", "GP7-2"]);
    const status = questStatusForMembers(
      [QUEST_A, QUEST_B],
      [{ completedSteps: keys, currentStep: null }]
    );
    expect(status.every((quest) => quest.done)).toBe(true);
  });

  it("un bloc incomplet ne vaut que ses completedSteps", () => {
    const map = rushStepKeysBySequenceId(MILESTONES);
    const sequenceIdsByMilestone = new Map([["m", ["seq-a", "seq-b"]]]);
    const keys = memberCompletedStepKeys({
      rows: [{ milestoneId: "m", isCompleted: false, completedSteps: ["seq-a"] }],
      sequenceIdsByMilestone,
      stepKeysBySequenceId: map,
    });

    expect(keys).toEqual(["Ali-1-all"]);
  });
});
