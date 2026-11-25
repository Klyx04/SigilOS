import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  evaluatePrereqExprGroups,
  getPrereqChoiceGroups,
  readPrereqExprGroups,
  resolvePrereqAlternative,
} from "@/lib/rush-prereq-expr";
import { isSequenceBlockedByPrereqs } from "@/lib/rush-guide-utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

/**
 * Garde — prérequis « au choix » (`prereq_expr`).
 *
 * Demande du 18/11/2026 : « pour brak il y a une quête qui a en prérequis plusieurs
 * quêtes au choix, c'est pris en compte dans le backend et l'ui ? ». Mesure : non —
 * « Supermilicien » (275) exige `(Qf=272|Qf=273|Qf=274)` côté client, mais la Trame
 * l'écrit en ET et le guide ne contient que 273.
 *
 * Ce qui est verrouillé : une alternative **hors guide** ne bloque jamais (on ne peut
 * pas la prouver) ; un groupe entièrement présent bloque tant qu'aucune n'est cochée.
 */

const seq = (id: string, overrides: Partial<RushSequence> = {}): RushSequence => ({
  id,
  subGuideRef: id,
  subGuideName: id,
  isOptional: false,
  order: 0,
  ...overrides,
});

const milestone = (id: string, order: number, sequences: RushSequence[]): RushMilestone => ({
  id,
  chapter: 1,
  chapterLabel: "Chapitre 1",
  title: id,
  isOptional: false,
  order,
  sequences,
});

const exprTag = (...questIds: number[]) => ({
  type: "prereq_expr",
  alternatives: questIds.map((questId) => ({ questId })),
});

describe("lecture des groupes", () => {
  it("lit un groupe de 3 alternatives", () => {
    const groups = readPrereqExprGroups(seq("s", { activityTags: [exprTag(272, 273, 274)] }));
    expect(groups).toHaveLength(1);
    expect(groups[0].map((a) => a.questId)).toEqual([272, 273, 274]);
  });

  it("ignore un tag d'une seule alternative (ce n'est pas un choix)", () => {
    expect(readPrereqExprGroups(seq("s", { activityTags: [exprTag(273)] }))).toEqual([]);
  });

  it("dédoublonne et borne les alternatives", () => {
    const ids = [1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const [group] = readPrereqExprGroups(seq("s", { activityTags: [exprTag(...ids)] }));
    expect(group).toHaveLength(8);
    expect(new Set(group.map((a) => a.questId)).size).toBe(8);
  });
});

describe("évaluation", () => {
  const resolve = (alternative: { questId: number }) =>
    alternative.questId >= 300 ? { seqId: `seq-${alternative.questId}` } : null;

  it("une alternative cochée suffit", () => {
    const result = evaluatePrereqExprGroups(
      [[{ questId: 300 }, { questId: 301 }, { questId: 302 }]],
      resolve,
      (id) => id === "seq-301"
    );
    expect(result.blocked).toBe(false);
    expect(result.groups[0].satisfied).toBe(true);
  });

  it("tout le groupe est dans le guide et rien n'est coché : bloqué", () => {
    const result = evaluatePrereqExprGroups(
      [[{ questId: 300 }, { questId: 301 }]],
      resolve,
      () => false
    );
    expect(result.blocked).toBe(true);
    expect(result.groups[0].unverifiable).toBe(false);
  });

  it("une alternative hors guide : jamais bloqué (non vérifiable)", () => {
    const result = evaluatePrereqExprGroups(
      [[{ questId: 272 }, { questId: 273 }, { questId: 274 }]],
      (alternative) => (alternative.questId === 273 ? { seqId: "magnanime" } : null),
      () => false
    );
    expect(result.blocked).toBe(false);
    expect(result.groups[0].unverifiable).toBe(true);
  });
});

describe("intégration au verrou de quête", () => {
  const GUIDE = [
    milestone("m", 1, [
      seq("supermilicien", {
        questDbIds: [275],
        activityTags: [exprTag(272, 273, 274)],
      }),
      seq("magnanime", { questDbIds: [273] }),
    ]),
  ];

  it("Supermilicien n'est PAS verrouillé quand 272 et 274 sont hors guide", () => {
    expect(isSequenceBlockedByPrereqs(GUIDE[0].sequences[0], new Set(), GUIDE)).toBe(false);
  });

  it("avec 273 cochée, toujours pas verrouillé", () => {
    expect(isSequenceBlockedByPrereqs(GUIDE[0].sequences[0], new Set(["magnanime"]), GUIDE)).toBe(false);
  });

  it("un groupe entièrement connu bloque tant qu'aucune n'est cochée", () => {
    const guide = [
      milestone("m", 1, [
        seq("cible", { questDbIds: [400], activityTags: [exprTag(401, 402)] }),
        seq("a", { questDbIds: [401] }),
        seq("b", { questDbIds: [402] }),
      ]),
    ];
    expect(isSequenceBlockedByPrereqs(guide[0].sequences[0], new Set(), guide)).toBe(true);
    expect(isSequenceBlockedByPrereqs(guide[0].sequences[0], new Set(["b"]), guide)).toBe(false);
  });
});

describe("prérequis d'une étape à variantes exclusives", () => {
  const choice = (name: string) => ({ type: "choice_group", name });
  const GUIDE = [
    milestone("m", 1, [
      seq("supermilicien", { subGuideName: "Supermilicien", activityTags: [{ type: "prereq_text", name: "Le magnanime" }] }),
      seq("magnanime", { subGuideName: "Le magnanime", activityTags: [choice("55")] }),
      seq("kamas", { subGuideName: "Les kamas résolvent tout", activityTags: [choice("55")] }),
      seq("assassinat", { subGuideName: "Assassinat effectué", activityTags: [choice("55")] }),
    ]),
  ];

  it("une variante sœur validée satisfait le prérequis nommé", () => {
    expect(isSequenceBlockedByPrereqs(GUIDE[0].sequences[0], new Set(["kamas"]), GUIDE)).toBe(false);
    expect(isSequenceBlockedByPrereqs(GUIDE[0].sequences[0], new Set(["assassinat"]), GUIDE)).toBe(false);
  });

  it("aucune variante validée : le prérequis bloque toujours", () => {
    expect(isSequenceBlockedByPrereqs(GUIDE[0].sequences[0], new Set(), GUIDE)).toBe(true);
  });

  it("une variante d'un autre bloc ne satisfait jamais le prérequis", () => {
    const other = milestone("autre", 2, [
      seq("kamas-ailleurs", { subGuideName: "Kamas ailleurs", activityTags: [choice("55")] }),
    ]);
    expect(isSequenceBlockedByPrereqs(GUIDE[0].sequences[0], new Set(["kamas-ailleurs"]), [...GUIDE, other])).toBe(
      true
    );
  });
});

describe("affichage", () => {
  it("nomme les alternatives connues et compte les inconnues", () => {
    const guide = [
      milestone("m", 1, [
        seq("supermilicien", { questDbIds: [275], activityTags: [exprTag(272, 273, 274)] }),
        seq("magnanime", { questDbIds: [273], subGuideName: "Le magnanime" }),
      ]),
    ];
    const [group] = getPrereqChoiceGroups(guide[0].sequences[0], guide);
    expect(group.known.map((k) => k.name)).toEqual(["Le magnanime"]);
    expect(group.unknown).toBe(2);
  });

  it("résout une alternative par son id DofusDB, jamais par son nom", () => {
    const guide = [
      milestone("m", 1, [
        seq("autre", { questDbIds: [273], subGuideName: "Vrai nom" }),
      ]),
    ];
    expect(resolvePrereqAlternative({ questId: 273, name: "Nom menteur" }, guide)?.name).toBe(
      "Vrai nom"
    );
  });
});

describe("affichage câblé — « au choix » sur les trois surfaces", () => {
  const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
  const SURFACES = [
    "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx",
    "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx",
    "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx",
  ];

  it("chaque surface calcule et affiche les groupes", () => {
    for (const rel of SURFACES) {
      expect(read(rel), rel).toContain("getPrereqChoiceGroups");
    }
    expect(read(SURFACES[0])).toContain("RushPrereqChoiceHint");
    expect(read(SURFACES[1])).toContain("RushPrereqChoiceHint");
    expect(
      read("src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx")
    ).toContain("RushPrereqChoiceHint");
  });

  it("l'overlay applique la règle serveur (palier + OU), pas la liste locale", () => {
    expect(read(SURFACES[2])).toContain("isSequenceBlockedByPrereqs(seq, gateAllCompleted, milestones)");
  });
});

