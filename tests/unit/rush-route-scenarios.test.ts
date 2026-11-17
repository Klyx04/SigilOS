/**
 * Gardes — **scénarios de route** du Rush Sylvestre (17/11/2026).
 *
 * 🎯 Ce que le lot devait trancher, mesuré sur Tougli le 17/11/2026 :
 *  · une classe (Crâ) ne montre **que** sa quête de classe (1971), pas les 19 ;
 *  · aucun alignement ⇒ une seule quête neutre (1316 « La rivalité »), cités et
 *    Ordres masqués — jamais les 100 + 102 quêtes des deux camps ;
 *  · un alignement choisi ⇒ une seule cité, et **aucune** quête d'Ordre tant que
 *    l'Ordre n'est pas choisi (Tougli les cache aussi) ;
 *  · un changement de cité / d'Ordre ⇒ plan de reset explicite, progression du
 *    reste conservée ;
 *  · une valeur inconnue (classe, cité, Ordre) est **fail-closed**.
 */

import { describe, it, expect } from "vitest";
import { resolveRushScenario } from "@/lib/rush-route-scenarios";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

const seq = (id: string, patch: Partial<RushSequence> = {}): RushSequence => ({
  id,
  subGuideRef: id,
  subGuideName: id,
  isOptional: false,
  order: 0,
  ...patch,
});

const block = (
  id: string,
  sequences: RushSequence[],
  type: RushMilestone["type"] = "QUETE_SERIE"
): RushMilestone => ({
  id,
  chapter: 1,
  chapterLabel: "C1",
  title: id,
  isOptional: false,
  order: 0,
  type,
  sequences,
});

const bonta = Array.from({ length: 20 }, (_, i) =>
  seq(`bonta-${i + 1}`, { alignReq: "bontarien" })
);
const brak = Array.from({ length: 3 }, (_, i) => seq(`brak-${i + 1}`, { alignReq: "brakmarien" }));
const cv = [20, 40, 60, 80, 100].map((level, i) =>
  seq(`cv-${i + 1}`, { alignReq: "bontarien", alignOrderCode: "coeur_vaillant", alignLevelReq: level })
);
const oa = [20, 40, 60, 80, 100].map((level, i) =>
  seq(`oa-${i + 1}`, { alignReq: "bontarien", alignOrderCode: "oeil_attentif", alignLevelReq: level })
);
const cs = [20, 40, 60, 80, 100].map((level, i) =>
  seq(`cs-${i + 1}`, { alignReq: "brakmarien", alignOrderCode: "coeur_saignant", alignLevelReq: level })
);

const GUIDE: RushMilestone[] = [
  block("prologue", [seq("commun")]),
  block("classes", [
    seq("feca", { classReq: "feca" }),
    seq("cra", { classReq: "cra" }),
    seq("iop", { classReq: "iop" }),
  ]),
  block("cites", [
    ...bonta,
    ...brak,
    seq("neutre", { alignReq: "neutre" }),
    seq("cite-inconnue", { alignReq: "pirate" }),
  ]),
  block("ordres", [
    ...cv,
    ...oa,
    ...cs,
    seq("ordre-inconnu", { alignReq: "bontarien", alignOrderCode: "pirate" }),
  ]),
];

const ids = (route: RushMilestone[]) =>
  route.flatMap((milestone) => milestone.sequences.map((sequence) => sequence.id));

describe("classe — une seule quête de classe visible", () => {
  it("un Crâ voit 1971, jamais les 19 variantes", () => {
    const result = resolveRushScenario({ milestones: GUIDE, playerClass: "cra", camp: "bontarien" });
    const visible = ids(result.route);
    expect(visible).toContain("cra");
    expect(visible).not.toContain("feca");
    expect(visible).not.toContain("iop");
    expect(result.counts.classQuests).toBe(3);
    expect(result.counts.hiddenByClass).toBe(2);
    expect(result.needsClassChoice).toBe(false);
  });

  it("sans classe déclarée, les quêtes de classe sont masquées et un prompt apparaît", () => {
    const result = resolveRushScenario({ milestones: GUIDE, playerClass: null, camp: "bontarien" });
    expect(ids(result.route)).toEqual(["commun", ...bonta.map((s) => s.id)]);
    expect(result.counts.hiddenByClass).toBe(3);
    expect(result.needsClassChoice).toBe(true);
    expect(result.warnings.join(" ")).toContain("Aucune classe déclarée");
  });

  it("une classe inconnue est fail-closed", () => {
    const result = resolveRushScenario({ milestones: GUIDE, playerClass: "pirate", camp: "bontarien" });
    expect(result.playerClass).toBeNull();
    expect(result.needsClassChoice).toBe(true);
    expect(result.warnings.join(" ")).toContain("inconnue");
  });
});

describe("alignement — aucun choix, neutre, puis cité", () => {
  it("aucun alignement : seules les quêtes communes, la classe et « La rivalité »", () => {
    const result = resolveRushScenario({ milestones: GUIDE, playerClass: "cra", camp: null });
    expect(result.kind).toBe("no-alignment");
    expect(ids(result.route)).toEqual(["commun", "cra", "neutre"]);
    expect(result.needsCampChoice).toBe(true);
    expect(result.canChooseCamp).toBe(true);
    expect(result.counts.neutralQuests).toBe(1);
    expect(result.warnings.join(" ")).toContain("La rivalité");
  });

  it("neutre explicite : même route, mais le choix de cité reste proposé", () => {
    const result = resolveRushScenario({ milestones: GUIDE, playerClass: "cra", camp: "neutre" });
    expect(result.kind).toBe("neutral");
    expect(result.neutral).toBe(true);
    expect(result.camp).toBeNull();
    expect(ids(result.route)).toEqual(["commun", "cra", "neutre"]);
    expect(result.needsCampChoice).toBe(false);
    expect(result.canChooseCamp).toBe(true);
  });

  it("une cité choisie ouvre sa série (20 quêtes) et ferme l'autre + la neutre", () => {
    const result = resolveRushScenario({ milestones: GUIDE, playerClass: "cra", camp: "bontarien" });
    expect(result.kind).toBe("aligned");
    expect(ids(result.route)).toEqual(["commun", "cra", ...bonta.map((s) => s.id)]);
    expect(result.counts.hiddenByCamp).toBe(10); // 3 brak + neutre + inconnue + 5 CS
    expect(result.needsCampChoice).toBe(false);
  });

  it("une cité inconnue reste sans alignement (fail-closed)", () => {
    const result = resolveRushScenario({ milestones: GUIDE, playerClass: "cra", camp: "pirate" });
    expect(result.kind).toBe("no-alignment");
    expect(result.camp).toBeNull();
    expect(result.needsCampChoice).toBe(true);
    expect(result.warnings.join(" ")).toContain("Cité « pirate » inconnue");
  });
});

describe("Ordres — 5 quêtes, un palier, jamais 15", () => {
  it("sans Ordre choisi, aucune quête d'Ordre n'apparaît", () => {
    const result = resolveRushScenario({ milestones: GUIDE, playerClass: "cra", camp: "bontarien" });
    expect(ids(result.route).some((id) => id.startsWith("cv-") || id.startsWith("oa-") || id.startsWith("cs-"))).toBe(false);
    expect(result.canChooseOrder).toBe(false);
    expect(result.needsOrderChoice).toBe(false);
    expect(result.nextOrderThreshold).toBe(20);
  });

  it("à 20 quêtes de cité, le choix d'Ordre devient possible", () => {
    const completed = bonta.slice(0, 20).map((s) => s.id);
    const result = resolveRushScenario({
      milestones: GUIDE,
      playerClass: "cra",
      camp: "bontarien",
      completedSeqIds: completed,
    });
    expect(result.cityCompleted).toBe(20);
    expect(result.canChooseOrder).toBe(true);
    expect(result.needsOrderChoice).toBe(true);
    expect(result.nextOrderThreshold).toBe(40);
    expect(ids(result.route)).toEqual(["commun", "cra", ...bonta.map((s) => s.id)]);
  });

  it("un Ordre choisi n'ouvre que ses 5 quêtes, pas les 15 de la cité", () => {
    const completed = bonta.slice(0, 20).map((s) => s.id);
    const result = resolveRushScenario({
      milestones: GUIDE,
      playerClass: "cra",
      camp: "bontarien",
      order: "coeur_vaillant",
      completedSeqIds: completed,
    });
    expect(result.order).toBe("coeur_vaillant");
    expect(result.needsOrderChoice).toBe(false);
    const visible = ids(result.route);
    expect(visible).toContain("cv-1");
    expect(visible).toContain("cv-5");
    expect(visible).not.toContain("oa-1");
    expect(visible).not.toContain("cs-1");
  });

  it("un Ordre du camp opposé est ignoré avec un avertissement", () => {
    const completed = bonta.slice(0, 20).map((s) => s.id);
    const result = resolveRushScenario({
      milestones: GUIDE,
      playerClass: "cra",
      camp: "bontarien",
      order: "coeur_saignant",
      completedSeqIds: completed,
    });
    expect(result.order).toBeNull();
    expect(result.needsOrderChoice).toBe(true);
    expect(result.warnings.join(" ")).toContain("n'appartient pas");
    expect(ids(result.route)).not.toContain("cs-1");
  });

  it("un Ordre inconnu est fail-closed", () => {
    const completed = bonta.slice(0, 20).map((s) => s.id);
    const result = resolveRushScenario({
      milestones: GUIDE,
      playerClass: "cra",
      camp: "bontarien",
      order: "pirate",
      completedSeqIds: completed,
    });
    expect(result.order).toBeNull();
    expect(result.needsOrderChoice).toBe(true);
    expect(result.warnings.join(" ")).toContain("Ordre « pirate » inconnu");
  });
});

describe("changement en cours de route — la progression du reste est conservée", () => {
  it("changement de cité : la branche quittée est listée pour le reset", () => {
    const result = resolveRushScenario({
      milestones: GUIDE,
      playerClass: "cra",
      camp: "brakmarien",
      previousCamp: "bontarien",
      completedSeqIds: ["commun", "bonta-1", "brak-1"],
    });
    expect(result.kind).toBe("camp-switch");
    expect(result.switchPlan?.kind).toBe("camp");
    expect(result.switchPlan?.resetCompletedSeqIds).toEqual(["bonta-1"]);
    expect(result.switchPlan?.keptCompletedSeqIds).toEqual(expect.arrayContaining(["commun", "brak-1"]));
    expect(result.switchPlan?.resetSeqIds).toEqual(expect.arrayContaining(["bonta-1", "cv-1", "oa-1"]));
    expect(ids(result.route)).toEqual(["commun", "cra", ...brak.map((s) => s.id)]);
    expect(result.warnings.join(" ")).toContain("Changement de cité");
  });

  it("changement d'Ordre seul : seules les 5 quêtes de l'ancien Ordre sont listées", () => {
    const result = resolveRushScenario({
      milestones: GUIDE,
      playerClass: "cra",
      camp: "bontarien",
      previousCamp: "bontarien",
      previousOrder: "coeur_vaillant",
      order: "oeil_attentif",
      completedSeqIds: ["commun", "cv-1", "cv-2"],
    });
    expect(result.kind).toBe("order-switch");
    expect(result.switchPlan?.kind).toBe("order");
    expect(result.switchPlan?.resetSeqIds).toEqual(cv.map((s) => s.id));
    expect(result.switchPlan?.resetCompletedSeqIds).toEqual(["cv-1", "cv-2"]);
    expect(result.switchPlan?.keptCompletedSeqIds).toEqual(["commun"]);
    expect(ids(result.route)).toContain("oa-1");
    expect(ids(result.route)).not.toContain("cv-1");
    expect(result.warnings.join(" ")).toContain("Changement d'Ordre");
  });

  it("le passage de « neutre » à une cité n'est pas un reset", () => {
    const result = resolveRushScenario({
      milestones: GUIDE,
      playerClass: "cra",
      camp: "bontarien",
      previousCamp: "neutre",
      completedSeqIds: ["commun", "neutre"],
    });
    expect(result.kind).toBe("aligned");
    expect(result.switchPlan).toBeNull();
  });

  it("les compteurs de diagnostic additionnent exactement les quêtes masquées", () => {
    const result = resolveRushScenario({ milestones: GUIDE, playerClass: "cra", camp: "bontarien" });
    const hidden =
      result.counts.hiddenByClass + result.counts.hiddenByCamp + result.counts.hiddenByOrder;
    expect(result.counts.total - result.counts.visible).toBe(hidden);
  });

  it("ne mute jamais les jalons d'origine", () => {
    const before = GUIDE.map((milestone) => milestone.sequences.length);
    resolveRushScenario({
      milestones: GUIDE,
      playerClass: "cra",
      camp: "brakmarien",
      previousCamp: "bontarien",
    });
    expect(GUIDE.map((milestone) => milestone.sequences.length)).toEqual(before);
  });
});
