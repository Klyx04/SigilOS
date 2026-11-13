/**
 * Gardes — **règles pures du studio God Rush** (lot E1, 05/11/2026).
 *
 * 🎯 Ce que le lot devait rendre possible, mesuré avant : **492 quêtes** dans une seule
 * liste, aucune recherche, aucun filtre, aucune notion de position. Ces règles vivent
 * dans `src/lib/rush-editor-selection.ts` (sans React) : c'est ici qu'on teste le
 * **comportement** — l'arbre, la recherche (nom, qid, bloc, cité, Ordre, classe),
 * les filtres, la sélection après suppression et l'index `Ctrl+K`.
 *
 * 🛡️ Le câblage (3 panneaux, garde, palette, aucun formulaire dans la liste) est tenu
 * par `rush-editor-shell.test.ts`.
 */

import { describe, it, expect } from "vitest";
import {
  EMPTY_RUSH_EDITOR_FILTERS,
  RUSH_EDITOR_CHAPTER_ZERO_LABEL,
  buildRushEditorCommands,
  buildRushEditorTree,
  countRushEditorQuests,
  filterRushEditorCommands,
  filterRushEditorTree,
  findRushEditorBlock,
  findRushEditorQuest,
  hasActiveRushEditorFilters,
  matchRushEditorQuest,
  normalizeRushEditorQuery,
  selectionAfterRushEditorBlockRemoved,
  selectionAfterRushEditorQuestRemoved,
  type RushEditorMilestoneInput,
} from "@/lib/rush-editor-selection";

/** Guide de test : deux chapitres, un bloc hors chapitre (Tips) et un séparateur. */
function guide(): RushEditorMilestoneInput[] {
  return [
    {
      id: "b1",
      title: "Prérequis",
      chapter: 1,
      chapterLabel: "Débuts",
      type: "PREREQUIS",
      order: 0,
      sequences: [
        {
          id: "q1",
          subGuideName: "La grande bibliothèque",
          order: 0,
          tips: "Aller en [-55,15]",
          alignReq: "bontarien",
          alignOrderCode: "coeur_vaillant",
          alignLevelReq: 20,
          questDbIds: [42],
        },
        { id: "q2", subGuideRef: "Quête sans nom", order: 1 },
      ],
    },
    {
      id: "b2",
      title: "Alignement Brâkmarien — palier 20",
      chapter: 2,
      chapterLabel: "Cité",
      type: "ALIGNEMENT",
      order: 1,
      sequences: [
        { id: "q3", subGuideName: "Quête de classe", order: 0, alignReq: "brakmarien", classReq: "cra" },
      ],
    },
    { id: "b3", title: "Conseil du jour", chapter: 0, type: "INFO", order: 2, sequences: [] },
    { id: "b4", title: "Section libre", chapter: 0, type: "SEPARATEUR", order: 3, sequences: [] },
  ];
}

const tree = () => buildRushEditorTree(guide());

describe("arbre — chapitres → blocs → quêtes", () => {
  it("groupe les blocs par chapitre, dans l'ordre du guide", () => {
    const chapters = tree();
    expect(chapters.map((c) => c.chapter)).toEqual([0, 1, 2]);
    expect(chapters[1].label).toBe("Débuts");
    expect(chapters[1].blocks.map((b) => b.id)).toEqual(["b1"]);
  });

  it("range les blocs hors chapitre sous « Hors chapitre » (chapitre 0)", () => {
    const zero = tree()[0];
    expect(zero.label).toBe(RUSH_EDITOR_CHAPTER_ZERO_LABEL);
    expect(zero.blocks.map((b) => b.id)).toEqual(["b3", "b4"]);
    expect(zero.blocks[0].isTips).toBe(true);
    expect(zero.blocks[1].isSeparator).toBe(true);
  });

  it("compte les quêtes visibles par chapitre et au total", () => {
    expect(tree().map((c) => c.questCount)).toEqual([0, 2, 1]);
    expect(countRushEditorQuests(tree())).toBe(3);
  });

  it("porte la route de chaque quête (cité, Ordre, palier, classe, qid)", () => {
    const quest = findRushEditorQuest(tree(), "q1")?.quest;
    expect(quest).toMatchObject({
      name: "La grande bibliothèque",
      camp: "bontarien",
      orderCode: "coeur_vaillant",
      level: 20,
      classReq: null,
      qids: [42],
      hasTips: true,
      blockId: "b1",
    });
  });

  it("se rabat sur la référence du guide quand le nom manque", () => {
    expect(findRushEditorQuest(tree(), "q2")?.quest.name).toBe("Quête sans nom");
  });
});

describe("recherche — nom, qid, bloc, cité, Ordre, classe, tags", () => {
  it("normalise accents, casse et ligatures", () => {
    expect(normalizeRushEditorQuery("  Cœur   VAILLANT ")).toBe("coeur vaillant");
    expect(normalizeRushEditorQuery("Féca")).toBe("feca");
  });

  it("trouve une quête par son nom, sans accent ni casse", () => {
    const visible = filterRushEditorTree(tree(), { ...EMPTY_RUSH_EDITOR_FILTERS, query: "bibliotheque" });
    expect(countRushEditorQuests(visible)).toBe(1);
    expect(visible[0].blocks[0].quests[0].id).toBe("q1");
  });

  it("trouve une quête par son qid", () => {
    const visible = filterRushEditorTree(tree(), { ...EMPTY_RUSH_EDITOR_FILTERS, query: "42" });
    expect(countRushEditorQuests(visible)).toBe(1);
    expect(visible[0].blocks[0].quests[0].id).toBe("q1");
  });

  it("un bloc dont le titre répond garde toutes ses quêtes", () => {
    const visible = filterRushEditorTree(tree(), { ...EMPTY_RUSH_EDITOR_FILTERS, query: "palier 20" });
    expect(countRushEditorQuests(visible)).toBe(1);
    expect(visible[0].blocks[0].id).toBe("b2");
  });

  it("cherche aussi dans la cité, l'Ordre et la classe", () => {
    for (const query of ["bontarien", "coeur vaillant", "cra"]) {
      const visible = filterRushEditorTree(tree(), { ...EMPTY_RUSH_EDITOR_FILTERS, query });
      expect(countRushEditorQuests(visible), `requête « ${query} »`).toBe(1);
    }
  });

  it("garde un bloc vide (Conseil / Tips) quand la recherche le nomme", () => {
    const visible = filterRushEditorTree(tree(), { ...EMPTY_RUSH_EDITOR_FILTERS, query: "conseil" });
    expect(visible).toHaveLength(1);
    expect(visible[0].blocks.map((b) => b.id)).toEqual(["b3"]);
    expect(visible[0].questCount).toBe(0);
  });

  it("ne rend rien quand rien ne correspond", () => {
    expect(filterRushEditorTree(tree(), { ...EMPTY_RUSH_EDITOR_FILTERS, query: "zzz-introuvable" })).toEqual([]);
  });

  it("une quête sans route ne répond pas à un filtre de cité", () => {
    const quest = findRushEditorQuest(tree(), "q2")!.quest;
    expect(matchRushEditorQuest(quest, "bontarien")).toBe(false);
  });
});

describe("filtres — cité, Ordre, classe, sans conseil", () => {
  it("détecte les filtres actifs (la recherche seule n'en est pas un)", () => {
    expect(hasActiveRushEditorFilters({ ...EMPTY_RUSH_EDITOR_FILTERS, query: "abc" })).toBe(false);
    expect(hasActiveRushEditorFilters({ ...EMPTY_RUSH_EDITOR_FILTERS, camp: "bontarien" })).toBe(true);
    expect(hasActiveRushEditorFilters({ ...EMPTY_RUSH_EDITOR_FILTERS, withoutTips: true })).toBe(true);
  });

  it("ne garde que la cité demandée", () => {
    const visible = filterRushEditorTree(tree(), { ...EMPTY_RUSH_EDITOR_FILTERS, camp: "brakmarien" });
    expect(visible.flatMap((c) => c.blocks.flatMap((b) => b.quests.map((q) => q.id)))).toEqual(["q3"]);
  });

  it("« sans conseil » écarte les quêtes qui en portent un", () => {
    const visible = filterRushEditorTree(tree(), { ...EMPTY_RUSH_EDITOR_FILTERS, withoutTips: true });
    expect(visible.flatMap((c) => c.blocks.flatMap((b) => b.quests.map((q) => q.id)))).toEqual(["q2", "q3"]);
  });

  it("classe et cité se cumulent", () => {
    const visible = filterRushEditorTree(tree(), {
      ...EMPTY_RUSH_EDITOR_FILTERS,
      camp: "brakmarien",
      classReq: "cra",
    });
    expect(countRushEditorQuests(visible)).toBe(1);
    const none = filterRushEditorTree(tree(), {
      ...EMPTY_RUSH_EDITOR_FILTERS,
      camp: "bontarien",
      classReq: "cra",
    });
    expect(none).toEqual([]);
  });
});

describe("sélection — elle ne pointe jamais une épave", () => {
  it("retrouve un bloc et une quête par leur id", () => {
    expect(findRushEditorBlock(tree(), "b2")?.title).toContain("Brâkmarien");
    expect(findRushEditorQuest(tree(), "q3")?.block.id).toBe("b2");
    expect(findRushEditorQuest(tree(), "inconnue")).toBeNull();
  });

  it("après la suppression d'un bloc, garde la position (suivant, sinon précédent)", () => {
    const current = { kind: "block" as const, blockId: "b1" };
    expect(selectionAfterRushEditorBlockRemoved(current, tree(), "b1")).toEqual({ kind: "block", blockId: "b2" });
    // Une sélection qui vise un AUTRE bloc ne bouge pas.
    expect(selectionAfterRushEditorBlockRemoved(current, tree(), "b4")).toEqual(current);
    // Dernier bloc du guide : plus de suivant, on recule.
    expect(selectionAfterRushEditorBlockRemoved(current, tree(), "b1")).toEqual({ kind: "block", blockId: "b2" });
    const lone = buildRushEditorTree([{ id: "b1", title: "Seul", chapter: 1, order: 0, sequences: [] }]);
    expect(selectionAfterRushEditorBlockRemoved(current, lone, "b1")).toEqual({ kind: "none" });
  });

  it("après la suppression d'une quête, glisse sur la suivante puis la précédente", () => {
    const block = findRushEditorBlock(tree(), "b1")!;
    expect(selectionAfterRushEditorQuestRemoved(
      { kind: "quest", blockId: "b1", questId: "q1" }, block, "q1",
    )).toEqual({ kind: "quest", blockId: "b1", questId: "q2" });
    // Dernière quête : on recule sur la précédente (le bloc est le repli ultime).
    expect(selectionAfterRushEditorQuestRemoved(
      { kind: "quest", blockId: "b1", questId: "q2" }, block, "q2",
    )).toEqual({ kind: "quest", blockId: "b1", questId: "q1" });
    // Quête unique : la sélection retombe sur son bloc.
    const lone = buildRushEditorTree([{ id: "b9", title: "Seul", chapter: 1, order: 0, sequences: [{ id: "q9", subGuideName: "Unique", order: 0 }] }]);
    expect(selectionAfterRushEditorQuestRemoved(
      { kind: "quest", blockId: "b9", questId: "q9" }, findRushEditorBlock(lone, "b9"), "q9",
    )).toEqual({ kind: "block", blockId: "b9" });
  });

  it("ne touche pas une sélection qui vise un autre bloc", () => {
    const current = { kind: "block" as const, blockId: "b2" };
    expect(selectionAfterRushEditorBlockRemoved(current, tree(), "b1")).toEqual(current);
  });
});

describe("palette Ctrl+K — index et filtrage", () => {
  it("indexe chaque bloc puis ses quêtes", () => {
    const commands = buildRushEditorCommands(tree());
    expect(commands.filter((c) => c.kind === "block")).toHaveLength(4);
    expect(commands.filter((c) => c.kind === "quest")).toHaveLength(3);
    expect(commands[0].id).toBe("block:b3");
  });

  it("filtre par nom de quête et par qid", () => {
    const commands = buildRushEditorCommands(tree());
    expect(filterRushEditorCommands(commands, "bibliotheque").map((c) => c.id)).toEqual(["quest:q1"]);
    expect(filterRushEditorCommands(commands, "42").map((c) => c.id)).toEqual(["quest:q1"]);
  });

  it("une commande de quête porte la sélection complète", () => {
    const command = buildRushEditorCommands(tree()).find((c) => c.id === "quest:q3")!;
    expect(command.selection).toEqual({ kind: "quest", blockId: "b2", questId: "q3" });
    expect(command.hint).toContain("Brâkmarien");
  });
});
