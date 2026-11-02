/**
 * Gardes — **L2 : la chaîne des rangs d'un Ordre** (02/11/2026).
 *
 * 🎯 Défaut mesuré : les **30** quêtes d'Ordre (2 cités × 3 Ordres × 5) ne portent
 * **aucun** `prereq_text`. Le rang 5 (« Héros Légendaire », palier 100) se cochait donc
 * sans avoir fait les rangs 1 → 4, et la carte bloquée affichait « 0 prérequis à
 * terminer » (aucun tag à lister).
 *
 * 🛡️ Ce que ces verrous interdisent :
 *  · un rang N validable sans son rang N−1 ;
 *  · une chaîne qui traverse un autre Ordre ou l'autre cité ;
 *  · un verrou de palier qui disparaît (le rang 1 exige toujours ses quêtes de cité) ;
 *  · une route recalculée sans l'Ordre du personnage sélectionné (mule comprise).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { previousOrderRank, resolveRushRoute } from "@/lib/rush-route";
import { getPrereqRefs, isSequenceBlockedByPrereqs } from "@/lib/rush-guide-utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const seq = (id: string, over: Partial<RushSequence> = {}): RushSequence =>
  ({
    id,
    subGuideName: `Quête ${id}`,
    subGuideRef: id,
    order: 0,
    isOptional: false,
    ...over,
  }) as unknown as RushSequence;

const ms = (id: string, sequences: RushSequence[]): RushMilestone =>
  ({
    id,
    type: "QUETE_SERIE",
    chapter: 1,
    chapterLabel: id,
    title: id,
    order: 0,
    isOptional: false,
    sequences,
  }) as unknown as RushMilestone;

/** Les 5 rangs d'un Ordre : paliers 20 / 40 / 60 / 80 / 100. */
const ranks = (prefix: string, camp: "bontarien" | "brakmarien", order: string): RushSequence[] =>
  [20, 40, 60, 80, 100].map((level, i) =>
    seq(`${prefix}-${i + 1}`, {
      subGuideName: `${prefix} rang ${i + 1}`,
      alignReq: camp,
      alignOrderCode: order,
      alignLevelReq: level,
    })
  );

/** 40 quêtes de cité bontarienne : de quoi satisfaire les paliers 20 et 40. */
const citeBonta = Array.from({ length: 40 }, (_, i) => seq(`b-cite-${i}`, { alignReq: "bontarien" }));

const GUIDE: RushMilestone[] = [
  ms("cite", [...citeBonta, seq("commune")]),
  ms("vaillant", ranks("vaillant", "bontarien", "coeur_vaillant")),
  ms("attentif", ranks("attentif", "bontarien", "oeil_attentif")),
  ms("saignant", ranks("saignant", "brakmarien", "coeur_saignant")),
];

const allIds = (milestones: RushMilestone[]) => milestones.flatMap((m) => m.sequences.map((s) => s.id));
const done = (...ids: string[]) => new Set(ids);
const findSeq = (id: string) => GUIDE.flatMap((m) => m.sequences).find((s) => s.id === id)!;

describe("previousOrderRank — le rang N−1, et rien d'autre", () => {
  it("le rang 2 pointe le rang 1 de son Ordre (nom lisible fourni)", () => {
    expect(previousOrderRank(findSeq("vaillant-2"), GUIDE)).toEqual({
      seqId: "vaillant-1",
      milestoneId: "vaillant",
      name: "vaillant rang 1",
    });
  });

  it("le rang 5 pointe le rang 4 — palier immédiatement inférieur, pas le premier venu", () => {
    expect(previousOrderRank(findSeq("vaillant-5"), GUIDE)?.seqId).toBe("vaillant-4");
  });

  it("le rang 1 n'a pas de rang précédent (la chaîne ne le verrouille pas)", () => {
    expect(previousOrderRank(findSeq("vaillant-1"), GUIDE)).toBeNull();
  });

  it("la chaîne ne traverse ni un autre Ordre, ni l'autre cité", () => {
    expect(previousOrderRank(findSeq("attentif-2"), GUIDE)?.seqId).toBe("attentif-1");
    expect(previousOrderRank(findSeq("saignant-2"), GUIDE)?.seqId).toBe("saignant-1");
  });

  it("accepte les deux vocabulaires d'Ordre (id court historique du studio)", () => {
    const legacy = ms("legacy", [
      seq("legacy-1", { alignReq: "bontarien", alignOrderCode: "vaillant", alignLevelReq: 20 }),
      seq("legacy-2", { alignReq: "bontarien", alignOrderCode: "vaillant", alignLevelReq: 40 }),
    ]);
    expect(previousOrderRank(legacy.sequences[1], [legacy])?.seqId).toBe("legacy-1");
  });

  it("ne devine rien : Ordre inconnu ou palier absent ⇒ null", () => {
    const inconnu = seq("x", { alignReq: "bontarien", alignOrderCode: "pirate", alignLevelReq: 40 });
    const sansPalier = seq("y", { alignReq: "bontarien", alignOrderCode: "coeur_vaillant" });
    expect(previousOrderRank(inconnu, GUIDE)).toBeNull();
    expect(previousOrderRank(sansPalier, GUIDE)).toBeNull();
  });
});

describe("verrou — le rang N exige le rang N−1", () => {
  it("sans rang 1 validé, le rang 2 reste bloqué même avec les 40 quêtes de cité", () => {
    const completed = done(...allIds([GUIDE[0]]));
    expect(isSequenceBlockedByPrereqs(findSeq("vaillant-2"), completed, GUIDE)).toBe(true);
  });

  it("le rang 1 validé débloque le rang 2", () => {
    const completed = done(...allIds([GUIDE[0]]), "vaillant-1");
    expect(isSequenceBlockedByPrereqs(findSeq("vaillant-2"), completed, GUIDE)).toBe(false);
  });

  it("le rang 1 de l'Ordre d'à côté ne débloque pas le rang 2", () => {
    const completed = done(...allIds([GUIDE[0]]), "attentif-1");
    expect(isSequenceBlockedByPrereqs(findSeq("vaillant-2"), completed, GUIDE)).toBe(true);
  });

  it("le verrou de PALIER reste actif : le rang 1 exige 20 quêtes de cité", () => {
    const rank1 = findSeq("vaillant-1");
    expect(isSequenceBlockedByPrereqs(rank1, done(), GUIDE)).toBe(true);
    const vingt = done(...citeBonta.slice(0, 20).map((s) => s.id));
    expect(isSequenceBlockedByPrereqs(rank1, vingt, GUIDE)).toBe(false);
  });

  it("une quête commune n'est jamais touchée par la chaîne", () => {
    expect(isSequenceBlockedByPrereqs(findSeq("commune"), done(), GUIDE)).toBe(false);
  });
});

describe("getPrereqRefs — la carte bloquée nomme le rang précédent", () => {
  it("le rang 2 liste le rang 1 (les quêtes d'Ordre n'ont aucun tag)", () => {
    const refs = getPrereqRefs(findSeq("vaillant-2"), GUIDE);
    expect(refs).toHaveLength(1);
    expect(refs[0].seqId).toBe("vaillant-1");
    expect(refs[0].name).toBe("vaillant rang 1");
  });

  it("le rang 1 n'annonce aucun prérequis (c'est le palier qui parle)", () => {
    expect(getPrereqRefs(findSeq("vaillant-1"), GUIDE)).toEqual([]);
  });

  it("pas de doublon quand un tag explicite vise déjà le rang précédent", () => {
    const guide = [
      ms("o", [
        seq("r1", { alignReq: "bontarien", alignOrderCode: "coeur_vaillant", alignLevelReq: 20 }),
        seq("r2", {
          alignReq: "bontarien",
          alignOrderCode: "coeur_vaillant",
          alignLevelReq: 40,
          activityTags: [{ type: "prereq_text", id: "r1" }] as never,
        }),
      ]),
    ];
    expect(getPrereqRefs(guide[0].sequences[1], guide).map((r) => r.seqId)).toEqual(["r1"]);
  });
});

describe("route — l'Ordre du personnage sélectionné (mule comprise)", () => {
  it("resolveRushRoute ne garde que l'Ordre choisi, plus le tronc commun", () => {
    const route = resolveRushRoute(GUIDE, { camp: "bontarien", order: "vaillant" });
    const kept = route.flatMap((m) => m.sequences.map((s) => s.id));
    expect(kept).toContain("vaillant-1");
    expect(kept).toContain("vaillant-5");
    expect(kept).not.toContain("attentif-1");
    expect(kept).not.toContain("saignant-1");
    expect(kept).toContain("commune");
  });

  it("le dashboard passe l'Ordre du personnage sélectionné (mule incluse)", () => {
    const page = read("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/page.tsx");
    expect(page).toContain("const routeOrder = selectedMule ? selectedMule.alignmentOrder");
    expect(page).toMatch(/order: routeOrder/);
  });

  it("l'overlay autonome calcule la route (camp + Ordre + classe) et lit la classe de la mule", () => {
    const page = read("src/app/overlay/guide/[guildId]/[slug]/page.tsx");
    expect(page).toContain("resolveRushRoute");
    expect(page).toMatch(/order: routeOrder/);
    expect(page).toMatch(/playerClass: routeClass/);
    expect(page).toContain("selectedMule?.classe");
    // Les jalons passés au client sont les jalons FILTRÉS, pas les bruts.
    expect(page).toContain("milestones={routeMilestones");
  });
});

