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
import {
  findNextAlignmentCityQuest,
  getPrereqRefs,
  isSequenceBlockedByPrereqs,
} from "@/lib/rush-guide-utils";
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

  it("cas mesuré 25/11 : rang 3 validé mais 79 quêtes de CITÉ ⇒ rang 4 bloqué par le palier", () => {
    // Le joueur avait « 81 quêtes d'alignement » en comptant les 3 quêtes d'Ordre :
    // le palier 80 ne compte QUE les quêtes de cité. Le rang 3 est bien validé, mais
    // le rang 4 doit rester bloqué jusqu'à la 80e quête de cité — et l'UI doit dire
    // « Palier 80 — 79/80 », jamais « À terminer avant : rang 3 ».
    const cityBrak = Array.from({ length: 80 }, (_, i) =>
      seq(`k-cite-${i}`, { alignReq: "brakmarien" })
    );
    const guide = [ms("cite", cityBrak), ms("saignant", ranks("saignant", "brakmarien", "coeur_saignant"))];
    const rank3 = guide[1].sequences[2];
    const rank4 = guide[1].sequences[3];
    const soixanteDixNeuf = done(
      ...cityBrak.slice(0, 79).map((s) => s.id),
      rank3.id
    );
    expect(isSequenceBlockedByPrereqs(rank4, soixanteDixNeuf, guide)).toBe(true);
    const quatreVingts = done(
      ...cityBrak.slice(0, 80).map((s) => s.id),
      rank3.id
    );
    expect(isSequenceBlockedByPrereqs(rank4, quatreVingts, guide)).toBe(false);
  });

  it("une quête commune n'est jamais touchée par la chaîne", () => {
    expect(isSequenceBlockedByPrereqs(findSeq("commune"), done(), GUIDE)).toBe(false);
  });
});

describe("findNextAlignmentCityQuest — le bouton « prochaine quête de cité »", () => {
  const choice = { type: "choice_group", name: "55" } as never;

  it("ignore les variantes exclusives : elles ne sont pas des quêtes de cité à faire", () => {
    const guide = [
      ms("cite", [
        seq("city-done", { alignReq: "brakmarien" }),
        seq("choice-a", { alignReq: "brakmarien", activityTags: [choice] }),
        seq("choice-b", { alignReq: "brakmarien", activityTags: [choice] }),
        seq("city-next", { alignReq: "brakmarien" }),
      ]),
    ];
    const current = seq("order", {
      alignReq: "brakmarien",
      alignOrderCode: "coeur_saignant",
      alignLevelReq: 80,
    });
    expect(
      findNextAlignmentCityQuest(current, guide, new Set(["city-done"]))?.seqId
    ).toBe("city-next");
  });

  it("ignore l'autre cité et les quêtes d'Ordre, et rend null quand tout est fait", () => {
    const guide = [
      ms("cite", [
        seq("b-city", { alignReq: "bontarien" }),
        seq("k-order", {
          alignReq: "brakmarien",
          alignOrderCode: "coeur_saignant",
          alignLevelReq: 40,
        }),
        seq("k-city", { alignReq: "brakmarien" }),
      ]),
    ];
    const current = seq("order", {
      alignReq: "brakmarien",
      alignOrderCode: "coeur_saignant",
      alignLevelReq: 80,
    });
    expect(findNextAlignmentCityQuest(current, guide, new Set())?.seqId).toBe("k-city");
    expect(findNextAlignmentCityQuest(current, guide, new Set(["k-city"]))).toBeNull();
  });

  it("préfère une candidate non bloquée, puis retombe sur la première", () => {
    const guide = [
      ms("cite", [
        // Cible commune NON validée : elle ne bloque que la candidate suivante.
        seq("common-missing", { subGuideName: "Étape commune" }),
        seq("blocked", {
          alignReq: "brakmarien",
          activityTags: [{ type: "prereq_text", name: "Étape commune" }] as never,
        }),
        seq("free", { alignReq: "brakmarien" }),
      ]),
    ];
    const current = seq("order", {
      alignReq: "brakmarien",
      alignOrderCode: "coeur_saignant",
      alignLevelReq: 80,
    });
    expect(findNextAlignmentCityQuest(current, guide, new Set())?.seqId).toBe("free");
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

describe("carte bloquée — le verrou affiché est le VRAI (25/11/2026)", () => {
  const DASH = read("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx");
  const PUB = read("src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx");

  it("les prérequis déjà satisfaits ne sont plus affichés « À terminer avant »", () => {
    expect(DASH).toContain("const missingPrereqs = prereqRefs.filter");
    expect(DASH).toContain("const totalPrereqs = missingPrereqs.length");
    expect(PUB).toContain("const missingPrereqRefs");
    expect(PUB).toContain("missingPrereqRefs.length > 0");
  });

  it("le palier de cité passe AVANT le prérequis et dit combien il en manque", () => {
    expect(DASH).toContain("Encore ${Math.max(0, levelReq - cityCount)} quête");
    expect(PUB).toContain("Encore {Math.max(0, levelReq - cityCount)} quête");
  });

  it("un donjon manquant est nommé quand c'est le seul verrou", () => {
    expect(DASH).toContain("Il faut d'abord faire le donjon");
    expect(PUB).toContain("Il faut d'abord faire le donjon");
  });

  it("le palier vient de la donnée God, jamais d'un nombre figé dans l'UI", () => {
    const studio = read("src/components/god/rush-editor/RushEditorStudio.tsx");
    // Champ libre (1–200) + suggestions des paliers du jeu : la valeur est en base.
    expect(studio).toContain('id="rush-align-level"');
    expect(studio).toContain('type="number"');
    expect(studio).toContain('list="rush-align-level-suggestions"');
    expect(DASH).toContain("const levelReq = seq.alignLevelReq ?? 0");
    expect(PUB).toContain("const levelReq = seq.alignLevelReq ?? 0");
  });
});

