import { describe, expect, it } from "vitest";

import {
  planPrerequisiteCascade,
  planPrerequisiteRemoval,
  prerequisiteClosure,
  type RushCascadeMilestone,
  type RushCascadeSequence,
} from "@/lib/rush-prereq-cascade";

function seq(
  id: string,
  name: string,
  tags: Array<Record<string, unknown>> = [],
  extra: Partial<RushCascadeSequence> = {}
): RushCascadeSequence {
  return {
    id,
    subGuideName: name,
    subGuideRef: name,
    activityTags: tags as never,
    questDbIds: [],
    alignReq: null,
    alignOrderCode: null,
    alignLevelReq: null,
    ...extra,
  };
}

function milestone(
  id: string,
  type: string,
  sequences: RushCascadeSequence[]
): RushCascadeMilestone {
  return { id, type, sequences };
}

const emeraude = milestone("emeraude", "DOFUS", [
  seq("e1", "Retourner voir le Dark Vlad, toujours sans mourir", [
    { type: "prereq_text", name: "La magicienne des marécages" },
  ]),
]);

const prerequis = milestone("prerequis", "QUETE_SERIE", [
  seq("m1", "La magicienne des marécages", [
    { type: "prereq_text", name: "Voir le Dark Vlad et mourir... ou pas" },
  ]),
  seq("v1", "Voir le Dark Vlad et mourir... ou pas"),
]);

const guide = [emeraude, prerequis];

describe("planPrerequisiteCascade", () => {
  it("valide la chaîne montante : magicienne puis Dark Vlad", () => {
    const plan = planPrerequisiteCascade({
      milestones: guide,
      completed: new Set<string>(),
      targetMilestoneId: "emeraude",
    });

    expect(plan.target).toEqual(["e1"]);
    expect(plan.added).toEqual(["m1", "v1"]);
    expect(new Set(plan.closure)).toEqual(new Set(["e1", "m1", "v1"]));
  });

  it("un périmètre ne cascade que ses propres prérequis", () => {
    const bloc = milestone("bloc", "QUETE_SERIE", [
      seq("a1", "A1", [{ type: "prereq_text", id: "m1", name: "M1" }]),
      seq("a2", "A2", [{ type: "prereq_text", id: "m2", name: "M2" }]),
    ]);
    const prerequis = milestone("p", "QUETE_SERIE", [
      seq("m1", "M1"),
      seq("m2", "M2"),
    ]);
    const guideScope = [bloc, prerequis];

    const partiel = planPrerequisiteCascade({
      milestones: guideScope,
      completed: new Set<string>(),
      targetMilestoneId: "bloc",
      targetSequenceIds: ["a1"],
    });
    expect(partiel.target).toEqual(["a1"]);
    expect(partiel.added).toEqual(["m1"]);

    const complet = planPrerequisiteCascade({
      milestones: guideScope,
      completed: new Set<string>(),
      targetMilestoneId: "bloc",
    });
    expect(complet.target).toEqual(["a1", "a2"]);
    expect(complet.added).toEqual(["m1", "m2"]);
  });

  it("ne rajoute rien quand la chaîne est déjà validée", () => {
    const plan = planPrerequisiteCascade({
      milestones: guide,
      completed: new Set(["e1", "m1", "v1"]),
      targetMilestoneId: "emeraude",
    });

    expect(plan.added).toEqual([]);
  });

  it("traverse aussi une chaîne dont le premier prérequis est déjà coché", () => {
    const plan = planPrerequisiteCascade({
      milestones: guide,
      completed: new Set(["m1"]),
      targetMilestoneId: "emeraude",
    });

    expect(plan.added).toEqual(["v1"]);
  });

  it("groupe OU : une seule alternative est cochée, celle déjà faite de préférence", () => {
    const guideOu = [
      milestone("bloc", "QUETE_SERIE", [
        seq("a", "Supermilicien", [
          {
            type: "prereq_expr",
            alternatives: [{ questId: 272 }, { questId: 273 }],
          },
        ]),
      ]),
      milestone("autre", "QUETE_SERIE", [
        seq("q272", "Quête 272", [], { questDbIds: [272] }),
        seq("q273", "Quête 273", [], { questDbIds: [273] }),
      ]),
    ];

    const vide = planPrerequisiteCascade({
      milestones: guideOu,
      completed: new Set<string>(),
      targetMilestoneId: "bloc",
    });
    expect(vide.added).toEqual(["q272"]);

    const deja273 = planPrerequisiteCascade({
      milestones: guideOu,
      completed: new Set(["q273"]),
      targetMilestoneId: "bloc",
    });
    expect(deja273.added).toEqual([]);
  });

  it("absorbe un cycle A ⇄ B", () => {
    const cycle = [
      milestone("a", "QUETE_SERIE", [
        seq("a1", "A", [{ type: "prereq_text", id: "b1", name: "B" }]),
      ]),
      milestone("b", "QUETE_SERIE", [
        seq("b1", "B", [{ type: "prereq_text", id: "a1", name: "A" }]),
      ]),
    ];

    const plan = planPrerequisiteCascade({
      milestones: cycle,
      completed: new Set<string>(),
      targetMilestoneId: "a",
    });
    expect(plan.added).toEqual(["b1"]);
  });

  it("n'ajoute jamais une cible d'un bloc non cochable", () => {
    const avecInfo = [
      milestone("a", "QUETE_SERIE", [
        seq("a1", "A", [{ type: "prereq_text", id: "i1", name: "Info" }]),
      ]),
      milestone("info", "INFO", [seq("i1", "Info")]),
    ];

    const plan = planPrerequisiteCascade({
      milestones: avecInfo,
      completed: new Set<string>(),
      targetMilestoneId: "a",
    });
    expect(plan.added).toEqual([]);
  });

  it("une cible de prérequis absente du guide n'ajoute rien", () => {
    const plan = planPrerequisiteCascade({
      milestones: [emeraude],
      completed: new Set<string>(),
      targetMilestoneId: "emeraude",
    });
    expect(plan.added).toEqual([]);
  });
});

describe("planPrerequisiteRemoval", () => {
  const a = milestone("a", "QUETE_SERIE", [
    seq("a1", "A", [{ type: "prereq_text", id: "m1", name: "M" }]),
  ]);
  const b = milestone("b", "QUETE_SERIE", [seq("b1", "B")]);
  const p = milestone("p", "QUETE_SERIE", [seq("m1", "M")]);
  const guideRemoval = [a, b, p];

  it("retire le prérequis qui n'était impliqué que par le bloc dévalidé", () => {
    const plan = planPrerequisiteRemoval({
      milestones: guideRemoval,
      completed: new Set(["a1", "b1", "m1"]),
      completedMilestoneIds: new Set(["a", "b"]),
      removedMilestoneId: "a",
    });

    expect(plan.remove).toEqual(["m1"]);
  });

  it("garde le prérequis si un autre bloc validé l'exige aussi", () => {
    const bAvecM = milestone("b", "QUETE_SERIE", [
      seq("b1", "B", [{ type: "prereq_text", id: "m1", name: "M" }]),
    ]);
    const plan = planPrerequisiteRemoval({
      milestones: [a, bAvecM, p],
      completed: new Set(["a1", "b1", "m1"]),
      completedMilestoneIds: new Set(["a", "b"]),
      removedMilestoneId: "a",
    });

    expect(plan.remove).toEqual([]);
  });

  it("n'inclut jamais les séquences du bloc cible dans le retrait", () => {
    const plan = planPrerequisiteRemoval({
      milestones: guideRemoval,
      completed: new Set(["a1", "m1"]),
      completedMilestoneIds: new Set(["a"]),
      removedMilestoneId: "a",
    });

    expect(plan.remove).toEqual(["m1"]);
    expect(plan.remove).not.toContain("a1");
  });
});

describe("prerequisiteClosure", () => {
  it("ferme la chaîne depuis n'importe quelle graine", () => {
    expect([...prerequisiteClosure(guide, ["e1"])]).toEqual(["e1", "m1", "v1"]);
  });
});
