import { describe, expect, it } from "vitest";
import {
  planRushChoiceVariants,
  RUSH_CHOICE_VARIANTS,
  type RushChoiceVariantSequence,
} from "@/lib/rush-choice-variants";

/**
 * Garde — données des étapes à variantes exclusives (Brak 55/66).
 *
 * Mesure du 25/11/2026 : la base ne porte qu'une branche (273 et 311). Le plan doit
 * ajouter les sœurs sans doublon, décaler les ordres suivants, et être **idempotent**
 * (un second passage ne réécrit rien).
 */

const seq = (
  id: string,
  name: string,
  order: number,
  questDbIds: number[],
  activityTags: unknown = []
): RushChoiceVariantSequence => ({ id, subGuideName: name, order, questDbIds, activityTags });

const DEF = RUSH_CHOICE_VARIANTS[0];

describe("planRushChoiceVariants — étape 55", () => {
  const block = [
    seq("avant", "Un maître ès pion", 1, [271], [{ type: "prereq_text", name: "Mon nom est poison" }]),
    seq("magnanime", "Le magnanime", 2, [273], [
      { type: "item", id: "1", name: "Objet" },
      { type: "prereq_text", name: "Un maître ès pion" },
    ]),
    seq("apres", "Supermilicien", 3, [275], [{ type: "prereq_text", name: "Le magnanime" }]),
  ];

  it("crée les deux variantes après le repère et décale la suite", () => {
    const plan = planRushChoiceVariants(block, DEF);
    expect(plan.sibling?.id).toBe("magnanime");
    expect(plan.inserts.map((insert) => [insert.name, insert.questDbId, insert.order])).toEqual([
      ["Les kamas résolvent tout", 274, 3],
      ["Assassinat effectué", 272, 4],
    ]);
    expect(plan.shifts).toEqual([{ id: "apres", name: "Supermilicien", fromOrder: 3, toOrder: 5 }]);
    expect(plan.noop).toBe(false);
  });

  it("pose le groupe et les textes sans perdre les autres tags du repère", () => {
    const plan = planRushChoiceVariants(block, DEF);
    const update = plan.updates.find((entry) => entry.id === "magnanime");
    expect(update).toBeDefined();
    expect(update!.activityTags.map((tag) => tag.type)).toEqual([
      "choice_group",
      "choice_group_label",
      "choice_group_note",
      "item",
      "prereq_text",
    ]);
  });

  it("un second passage sur le résultat est un no-op", () => {
    const applied = [
      ...block,
      seq("kamas", "Les kamas résolvent tout", 3, [274], [
        { type: "choice_group", name: "55" },
        { type: "choice_group_label", name: DEF.label },
        { type: "choice_group_note", name: DEF.note },
        { type: "item", id: "1", name: "Objet" },
        { type: "prereq_text", name: "Un maître ès pion" },
      ]),
      seq("assassinat", "Assassinat effectué", 4, [272], [
        { type: "choice_group", name: "55" },
        { type: "choice_group_label", name: DEF.label },
        { type: "choice_group_note", name: DEF.note },
        { type: "item", id: "1", name: "Objet" },
        { type: "prereq_text", name: "Un maître ès pion" },
      ]),
      seq("apres", "Supermilicien", 5, [275], [{ type: "prereq_text", name: "Le magnanime" }]),
    ];
    // Le repère reçoit ses tags (comme après `--apply`).
    applied[1] = seq("magnanime", "Le magnanime", 2, [273], [
      { type: "choice_group", name: "55" },
      { type: "choice_group_label", name: DEF.label },
      { type: "choice_group_note", name: DEF.note },
      { type: "item", id: "1", name: "Objet" },
      { type: "prereq_text", name: "Un maître ès pion" },
    ]);
    const plan = planRushChoiceVariants(applied, DEF);
    expect(plan.inserts).toEqual([]);
    expect(plan.shifts).toEqual([]);
    expect(plan.noop).toBe(true);
  });

  it("ne recrée jamais une variante déjà présente par son id DofusDB", () => {
    const withKamas = [...block, seq("kamas", "Nom local histoire", 3, [274])];
    const plan = planRushChoiceVariants(withKamas, DEF);
    expect(plan.inserts.map((insert) => insert.questDbId)).toEqual([272]);
    expect(plan.updates.map((update) => update.id)).toContain("kamas");
  });

  it("sans repère, aucun plan (le script refuse d'écrire)", () => {
    const plan = planRushChoiceVariants([seq("autre", "Autre", 1, [1])], DEF);
    expect(plan.sibling).toBeNull();
    expect(plan.inserts).toEqual([]);
    expect(plan.noop).toBe(false);
  });
});
