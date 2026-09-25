import { describe, it, expect } from "vitest";
import { buildRushGuideView, isCountableBlock, computeRushAlignment, alignmentCrest, alignmentLabel } from "@/lib/rush-guide-view";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

// ─── Fixtures : des BLOCS poussés par le GOD (types + dépendances) ────────────

const seq = (id: string, over: Partial<RushSequence> = {}): RushSequence => ({
  id,
  subGuideRef: id,
  subGuideName: id,
  isOptional: false,
  order: 0,
  ...over,
});

const block = (
  id: string,
  type: string,
  chapter: number,
  sequences: RushSequence[],
  over: Partial<RushMilestone> = {}
): RushMilestone => ({
  id,
  chapter,
  chapterLabel: `Chapitre ${chapter}`,
  title: id,
  type,
  order: 0,
  isOptional: false,
  sequences,
  ...over,
});

// Bloc fait : une étape terminée, qui porte une ressource.
const S_DONE = seq("s-done", {
  subGuideName: "Parler à Pandala",
  activityTags: [{ type: "item", name: "Pépite", id: "14635", count: 3 }],
});
// Bloc verrouillé : sa seule étape dépend d'une quête d'un AUTRE bloc.
const S_BLOCKED = seq("s-blocked", {
  subGuideName: "Protection divine",
  tips: "Allez en [12, -21]",
  activityTags: [{ type: "prereq_text", name: "le réceptacle des dofus" }],
});
// Le prérequis lui-même : une étape actionnable, avec une coordonnée pos_tags.
const S_PREREQ = seq("s-prereq", {
  subGuideName: "Le réceptacle des Dofus",
  activityTags: [
    { type: "pos_tags", name: "4, -19" },
    { type: "combat_tactique" },
    { type: "metier", name: "Façonneur", level: 65 },
  ],
});
const S_TAIL = seq("s-tail", {
  subGuideName: "Vaincre 4 Pandikazes",
  activityTags: [{ type: "combat_solo" }],
});

const M_DONE = block("m-done", "DONJON", 1, [S_DONE]);
const M_LOCKED = block("m-locked", "QUETE_SERIE", 1, [S_BLOCKED]);
const M_PREREQ = block("m-prereq", "DONJON", 2, [S_PREREQ]);
const M_TAIL = block("m-tail", "DOFUS", 2, [S_TAIL]);
const M_INFO = block("m-info", "INFO", 1, [
  seq("s-info", { activityTags: [{ type: "info_sequence" }] }),
  seq("s-info-real", { activityTags: [{ type: "item", name: "Riz", id: "7018", count: 1 }] }),
]);
const M_SEP = block("m-sep", "SEPARATEUR", 1, []);

const GUIDE = [M_DONE, M_INFO, M_SEP, M_LOCKED, M_PREREQ, M_TAIL];

// Bloc « alignement » : deux quêtes qui DONNENT un camp (tag `alignment_set`), dans
// l'ordre du guide — c'est le modèle chaîné 1 → 100 du module, ici seulement LU.
const M_ALIGN = block("m-align", "QUETE_SERIE", 3, [
  seq("s-align-bonta", {
    subGuideName: "Devenir Bontarien",
    activityTags: [{ type: "alignment_set", name: "bontarien", level: 12 }],
  }),
  seq("s-align-brak", {
    subGuideName: "Basculer Brâkmarien",
    activityTags: [{ type: "alignment_set", name: "brakmarien", level: 30 }],
  }),
]);
const GUIDE_ALIGN = [...GUIDE, M_ALIGN];

describe("computeRushAlignment (alignement acquis, en temps réel)", () => {
  it("ne rend rien tant qu'aucune quête d'alignement n'est validée", () => {
    expect(computeRushAlignment(GUIDE, [])).toBeNull();
    expect(computeRushAlignment(GUIDE, ["s-done"])).toBeNull();
    expect(
      buildRushGuideView({ milestones: GUIDE, completedSeqIds: ["s-done"] }).alignment
    ).toBeNull();
  });

  it("rend le camp, la tranche, le blason et l'étape qui l'a donné", () => {
    expect(computeRushAlignment(GUIDE_ALIGN, ["s-align-bonta"])).toEqual({
      camp: "bontarien",
      label: "Bontarien",
      level: 12,
      crestSrc: "/ordres/bonta.png",
      seqId: "s-align-bonta",
      stepTitle: "Devenir Bontarien",
      chapter: 3,
      chapterLabel: "Chapitre 3",
    });
  });

  it("garde la DERNIÈRE quête validée : en décocher une revient à la précédente", () => {
    const deux = computeRushAlignment(GUIDE_ALIGN, ["s-align-bonta", "s-align-brak"]);
    expect(deux?.camp).toBe("brakmarien");
    expect(deux?.crestSrc).toBe("/ordres/brakmar.png");
    expect(deux?.level).toBe(30);
    // Décocher la plus avancée : retour au camp précédent, sans état intermédiaire.
    expect(computeRushAlignment(GUIDE_ALIGN, ["s-align-bonta"])?.camp).toBe("bontarien");
  });

  it("est exposé par la vue partagée (les deux surfaces lisent la même chose)", () => {
    const view = buildRushGuideView({
      milestones: GUIDE_ALIGN,
      completedSeqIds: ["s-align-brak"],
    });
    expect(view.alignment?.label).toBe("Brakmarien");
  });

  it("tolère le nom du blason et retombe sur le blason neutre", () => {
    const alias: RushMilestone[] = [
      block("m-alias", "QUETE_SERIE", 1, [
        seq("s-alias", { activityTags: [{ type: "alignment_set", name: "brakmar", level: 0 }] }),
      ]),
    ];
    expect(computeRushAlignment(alias, ["s-alias"])?.crestSrc).toBe("/ordres/brakmar.png");
    expect(alignmentCrest(null)).toBe("/ordres/neutre.png");
    expect(alignmentCrest("camp-inconnu")).toBe("/ordres/neutre.png");
    expect(alignmentLabel("camp-inconnu")).toBe("camp-inconnu");
  });
});

describe("rush-guide-view (vue partagée public ↔ guilde)", () => {
  describe("compteurs", () => {
    it("ne compte que les vraies étapes : ni INFO, ni SEPARATEUR", () => {
      const view = buildRushGuideView({ milestones: GUIDE, completedSeqIds: ["s-done"] });
      // 4 étapes réelles (done, blocked, prereq, tail) — les 2 du bloc INFO sont exclues.
      expect(view.counters.totalSteps).toBe(4);
      expect(view.counters.doneSteps).toBe(1);
      expect(view.counters.remainingSteps).toBe(3);
      expect(view.counters.percent).toBe(25);
      expect(view.counters.totalBlocks).toBe(4);
      expect(view.counters.label).toBe("1 / 4 étapes");
    });

    it("expose les chapitres avec leur avancement, dans l'ordre", () => {
      const view = buildRushGuideView({ milestones: GUIDE, completedSeqIds: ["s-done"] });
      expect(view.chapters.map((c) => c.chapter)).toEqual([1, 2]);
      expect(view.chapters[0]).toMatchObject({ blocks: 2, done: 1, total: 2 });
      expect(view.chapters[1]).toMatchObject({ blocks: 2, done: 0, total: 2 });
    });

    it("ne divise pas par zéro sur un guide vide", () => {
      const view = buildRushGuideView({ milestones: [] });
      expect(view.active).toBeNull();
      expect(view.counters).toMatchObject({ totalSteps: 0, percent: 0, label: "0 / 0 étapes" });
      expect(view.journal).toEqual([]);
      expect(view.landmarks).toEqual([]);
    });

    it("reconnaît les blocs qui comptent (règle du module)", () => {
      expect(isCountableBlock({ type: "DONJON" })).toBe(true);
      expect(isCountableBlock({ type: "INFO" })).toBe(false);
      expect(isCountableBlock({ type: "SEPARATEUR" })).toBe(false);
    });
  });

  describe("étape active — une seule action", () => {
    it("prend la première étape non terminée et actionnable", () => {
      const view = buildRushGuideView({ milestones: GUIDE, completedSeqIds: ["s-done"] });
      // Le bloc verrouillé vient avant, mais son étape dépend d'un prérequis non
      // fait : l'action du moment est donc le PRÉREQUIS lui-même.
      expect(view.active?.id).toBe("s-prereq");
      expect(view.active?.blockId).toBe("m-prereq");
    });

    it("ignore les séquences informatives", () => {
      const view = buildRushGuideView({ milestones: [M_INFO, M_TAIL], completedSeqIds: [] });
      expect(view.active?.id).toBe("s-tail");
    });

    it("respecte le repère du joueur quand il est encore actionnable", () => {
      const view = buildRushGuideView({
        milestones: GUIDE,
        completedSeqIds: ["s-done"],
        bookmarkedSeqId: "s-tail",
      });
      expect(view.active?.id).toBe("s-tail");
    });

    it("expose nature, conditions, coordonnée et commande de jeu", () => {
      const view = buildRushGuideView({ milestones: GUIDE, completedSeqIds: ["s-done"] });
      const active = view.active!;
      expect(active.coord).toMatchObject({ x: 4, y: -19 });
      expect(active.travelCommand).toBe("/travel 4,-19");
      expect(active.nature.map((t) => t.type)).toEqual(["combat_tactique"]);
      expect(active.conditions.map((t) => t.type)).toEqual(["metier"]);
      expect(active.blockTitle).toBe("m-prereq");
      expect(active.chapter).toBe(2);
    });
  });

  describe("journal — un bloc, un état, une dépendance", () => {
    it("distingue terminé / verrouillé / en cours / à venir", () => {
      const view = buildRushGuideView({ milestones: GUIDE, completedSeqIds: ["s-done"] });
      const byId = Object.fromEntries(view.journal.map((b) => [b.id, b]));
      expect(byId["m-done"].state).toBe("done");
      expect(byId["m-locked"].state).toBe("locked");
      expect(byId["m-prereq"].state).toBe("current");
      expect(byId["m-tail"].state).toBe("todo");
    });

    it("nomme la dépendance qui verrouille (celle du GOD)", () => {
      const view = buildRushGuideView({ milestones: GUIDE, completedSeqIds: ["s-done"] });
      const locked = view.journal.find((b) => b.id === "m-locked")!;
      expect(locked.blockedBy.map((p) => p.name)).toEqual(["Le réceptacle des Dofus"]);
      expect(locked.blockedBy[0].seqId).toBe("s-prereq");
      expect(locked.coord).toMatchObject({ x: 12, y: -21 });
    });

    it("déverrouille dès que la dépendance est cochée", () => {
      const view = buildRushGuideView({
        milestones: GUIDE,
        completedSeqIds: ["s-done", "s-prereq"],
      });
      const unlocked = view.journal.find((b) => b.id === "m-locked")!;
      expect(unlocked.state).toBe("current");
      expect(unlocked.blockedBy).toEqual([]);
      expect(view.active?.id).toBe("s-blocked");
      expect(view.counters.doneBlocks).toBe(2);
    });

    it("n'expose jamais les blocs INFO / SEPARATEUR comme lignes de journal", () => {
      const view = buildRushGuideView({ milestones: GUIDE, completedSeqIds: [] });
      expect(view.journal.map((b) => b.id)).not.toContain("m-info");
      expect(view.journal.map((b) => b.id)).not.toContain("m-sep");
    });
  });

  describe("repères et préparation", () => {
    it("liste chaque coordonnée copiable en commande de jeu", () => {
      const view = buildRushGuideView({ milestones: GUIDE, completedSeqIds: [] });
      expect(view.landmarks.map((l) => l.travelCommand)).toEqual(["/travel 12,-21", "/travel 4,-19"]);
      expect(view.landmarks[1].label).toBe("Le réceptacle des Dofus");
      expect(view.landmarks[1].isDone).toBe(false);
    });

    it("marque les repères déjà franchis", () => {
      const view = buildRushGuideView({ milestones: GUIDE, completedSeqIds: ["s-prereq"] });
      expect(view.landmarks.find((l) => l.seqId === "s-prereq")?.isDone).toBe(true);
    });

    it("sépare le total des ressources de celles qu'il reste à prévoir", () => {
      const view = buildRushGuideView({ milestones: GUIDE, completedSeqIds: ["s-done"] });
      expect(view.resources.total.map((r) => r.name).sort()).toEqual(["Pépite", "Riz"]);
      expect(view.resources.remaining.map((r) => r.name)).toEqual(["Riz"]);
    });

    it("remonte les métiers requis agrégés du guide", () => {
      const view = buildRushGuideView({ milestones: GUIDE, completedSeqIds: [] });
      expect(view.metiers).toEqual([{ id: "faconneur", name: "Façonneur", level: 65 }]);
    });
  });
});
