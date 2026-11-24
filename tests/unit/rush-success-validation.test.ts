import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  planSuccessValidation,
  planSuccessValidationWrites,
  successPossessionItems,
} from "@/lib/rush-success-validation";
import type { RushGuideQuestRef } from "@/lib/rush-guide-utils";
import {
  parseRushSuccessMeta,
  type RushSuccessCatalog,
  type RushSuccessCatalogRow,
} from "@/lib/rush-success-graph";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

const CATALOG: RushSuccessCatalog = new Map<number, RushSuccessCatalogRow>([
  [
    100,
    {
      id: 100,
      name: "Dofus Émeraude",
      questIds: [1, 2],
      successIds: [200],
      itemIds: [900],
    },
  ],
  [
    200,
    {
      id: 200,
      name: "Mais où sont les Dofus ?",
      questIds: [3],
      successIds: [],
      // Objet du PRÉREQUIS : ne doit jamais apparaître sur la fiche de 100.
      itemIds: [901],
    },
  ],
]);

function sequence(
  id: string,
  questDbIds: number[],
  prereqSeqId?: string
): RushSequence {
  return {
    id,
    subGuideRef: id,
    subGuideName: `Quête ${id}`,
    isOptional: false,
    order: 0,
    questDbIds,
    activityTags: prereqSeqId
      ? [{ type: "prereq_text", id: prereqSeqId, name: `Quête ${prereqSeqId}` } as never]
      : [],
  };
}

const MILESTONES: RushMilestone[] = [
  {
    id: "ms-a",
    chapter: 1,
    chapterLabel: "Chapitre 1",
    title: "Bloc Émeraude",
    isOptional: false,
    order: 0,
    sequences: [sequence("s1", [1]), sequence("s2", [2])],
  },
  {
    id: "ms-b",
    chapter: 2,
    chapterLabel: "Chapitre 2",
    title: "Bloc des Dofus",
    isOptional: false,
    order: 1,
    sequences: [sequence("s0", [4]), sequence("s3", [3], "s0")],
  },
];

const GUIDE: RushGuideQuestRef[] = [
  { id: 1, name: "Quête 1", done: false, sequenceId: "s1" },
  { id: 2, name: "Quête 2", done: false, sequenceId: "s2" },
  { id: 3, name: "Quête 3", done: false, sequenceId: "s3" },
  { id: 4, name: "Prérequis de route", done: false, sequenceId: "s0" },
];

describe("planSuccessValidation — aperçu avant écriture", () => {
  it("liste les blocs, les quêtes cibles et la cascade de route", () => {
    const plan = planSuccessValidation({
      successId: 100,
      catalog: CATALOG,
      guideQuests: GUIDE,
      milestones: MILESTONES,
      itemNames: { 900: "Dom de Pin", 901: "Objet du prérequis" },
      questNames: { 5: "Quête hors guide" },
    });

    expect(plan).not.toBeNull();
    expect(plan?.targetCount).toBe(3);
    expect(plan?.blocks.map((block) => block.milestoneId)).toEqual(["ms-a", "ms-b"]);
    expect(plan?.blocks[0].targetSequenceIds).toEqual(["s1", "s2"]);
    // La quête 3 exige la séquence s0 : la cascade du guide l'ajoute.
    expect(plan?.blocks[1].targetSequenceIds).toEqual(["s3"]);
    expect(plan?.blocks[1].cascadedSequenceIds).toEqual(["s0"]);
    expect(plan?.cascadedCount).toBe(1);
    expect(plan?.possessionNames).toEqual(["Dom de Pin"]);
  });

  it("porte l'iconId siphonné pour l'image officielle de l'objet", () => {
    const result = successPossessionItems({
      successId: 100,
      catalog: CATALOG,
      guideQuests: GUIDE,
      milestones: MILESTONES,
      itemNames: { 900: "Dom de Pin" },
      itemIcons: { 900: 23035 },
    });
    expect(result.items.find((item) => item.id === 900)?.iconId).toBe(23035);
    expect(result.extras.map((item) => item.name)).toEqual(["Dom de Pin"]);
  });

  it("n'agrège pas les objets d'un succès prérequis (2299 / 2302)", () => {
    const plan = planSuccessValidation({
      successId: 100,
      catalog: CATALOG,
      guideQuests: GUIDE,
      milestones: MILESTONES,
      itemNames: { 900: "Dom de Pin", 901: "Objet du prérequis" },
    });
    expect(plan?.possessionNames).toEqual(["Dom de Pin"]);
    expect(plan?.possessionNames).not.toContain("Objet du prérequis");
  });

  it("ne compte pas une quête déjà validée et n'invente aucune cible hors guide", () => {
    const plan = planSuccessValidation({
      successId: 100,
      catalog: CATALOG,
      guideQuests: GUIDE.map((quest) =>
        quest.id === 1 ? { ...quest, done: true } : quest
      ),
      milestones: MILESTONES,
    });
    expect(plan?.targetCount).toBe(2);
    expect(plan?.blocks[0].targetSequenceIds).toEqual(["s2"]);
    expect(plan?.blocks.flatMap((block) => block.targetSequenceIds)).not.toContain("s1");
  });

  it("rend un plan vide quand tout est fait, sans écrire", () => {
    const plan = planSuccessValidation({
      successId: 100,
      catalog: CATALOG,
      guideQuests: GUIDE.map((quest) => ({ ...quest, done: true })),
      milestones: MILESTONES,
    });
    expect(plan?.targetCount).toBe(0);
    expect(plan?.blocks).toEqual([]);
  });

  it("signale les quêtes Qf hors guide sans les proposer à la validation", () => {
    const catalog: RushSuccessCatalog = new Map([
      [300, { id: 300, name: "Hors guide", questIds: [1, 5], successIds: [] }],
    ]);
    const plan = planSuccessValidation({
      successId: 300,
      catalog,
      guideQuests: GUIDE,
      milestones: MILESTONES,
      questNames: { 5: "Quête hors guide" },
    });
    expect(plan?.targetCount).toBe(1);
    expect(plan?.outsideQuestNames).toEqual(["Quête hors guide"]);
  });

  it("retourne null pour un succès absent du catalogue", () => {
    expect(
      planSuccessValidation({
        successId: 999,
        catalog: CATALOG,
        guideQuests: GUIDE,
        milestones: MILESTONES,
      })
    ).toBeNull();
  });

  it("le périmètre serveur inclut un prérequis de route du MÊME bloc", () => {
    const plan = planSuccessValidation({
      successId: 100,
      catalog: CATALOG,
      guideQuests: GUIDE,
      milestones: MILESTONES,
    });
    const writes = planSuccessValidationWrites(plan!, MILESTONES);
    expect(writes.map((write) => write.milestoneId)).toEqual(["ms-a", "ms-b"]);
    // s0 (prérequis de s3) vit dans ms-b : sans lui dans le périmètre, le serveur
    // ne l'écrirait pas (applyCascadeProgress ignore le bloc cible).
    expect(writes[1].scopeSequenceIds).toEqual(["s3", "s0"]);
    expect(writes[1].updates).toEqual([
      { milestoneId: "ms-b", sequenceIds: ["s3", "s0"] },
    ]);
  });

  it("une cascade inter-blocs range chaque séquence sous son propriétaire", () => {
    const catalog: RushSuccessCatalog = new Map([
      [500, { id: 500, name: "Inter-blocs", questIds: [3], successIds: [] }],
    ]);
    const interBlocks: RushMilestone[] = [
      {
        id: "ms-a",
        chapter: 1,
        chapterLabel: "Chapitre 1",
        title: "Bloc A",
        type: "QUETE_SERIE",
        isOptional: false,
        order: 0,
        sequences: [sequence("s0", [4])],
      },
      {
        id: "ms-b",
        chapter: 2,
        chapterLabel: "Chapitre 2",
        title: "Bloc B",
        type: "QUETE_SERIE",
        isOptional: false,
        order: 1,
        sequences: [sequence("s3", [3], "s0")],
      },
    ];
    const plan = planSuccessValidation({
      successId: 500,
      catalog,
      guideQuests: GUIDE,
      milestones: interBlocks,
    });
    const writes = planSuccessValidationWrites(plan!, interBlocks);
    expect(writes[0].scopeSequenceIds).toEqual(["s3"]);
    expect(writes[0].updates).toEqual([
      { milestoneId: "ms-b", sequenceIds: ["s3"] },
      { milestoneId: "ms-a", sequenceIds: ["s0"] },
    ]);
  });

  it("garde le PO d'une quête HORS guide (aucun détail ne l'affiche)", () => {
    const catalog: RushSuccessCatalog = new Map([
      [600, { id: 600, name: "Hors guide", questIds: [5], successIds: [] }],
    ]);
    const questCriteria = new Map([
      [
        5,
        {
          id: 5,
          name: "Quête hors guide",
          level: null,
          questIds: [],
          successIds: [],
          itemIds: [999],
          criterion: "PO=999",
        },
      ],
    ]);
    const plan = planSuccessValidation({
      successId: 600,
      catalog,
      questCriteria,
      guideQuests: GUIDE,
      milestones: MILESTONES,
      itemNames: { 999: "Objet hors guide" },
    });
    expect(plan?.targetCount).toBe(0);
    expect(plan?.outsideQuestNames).toEqual(["Quête 5"]);
    expect(plan?.possessionNames).toEqual(["Objet hors guide"]);
    expect(plan?.coveredPossessionCount).toBe(0);
  });

  it("ne répète pas les ressources déjà listées dans le détail d'une quête", () => {
    const catalog: RushSuccessCatalog = new Map([
      [
        400,
        {
          id: 400,
          name: "Le bouquet final",
          questIds: [],
          successIds: [],
          itemIds: [901, 902, 903],
        },
      ],
    ]);
    const resourceMilestones: RushMilestone[] = [
      {
        id: "ms-res",
        chapter: 1,
        chapterLabel: "Chapitre 1",
        title: "Valonia",
        type: "QUETE_SERIE",
        isOptional: false,
        order: 0,
        sequences: [
          {
            id: "s-res",
            subGuideRef: "s-res",
            subGuideName: "Par l'héritage qui vous lie",
            isOptional: false,
            order: 0,
            activityTags: [
              { type: "item", name: "Chanvre", id: 901, count: 10 },
              { type: "item", name: "Ronce éphédryenne", id: 903, count: 1 },
            ] as never,
          },
        ],
      },
    ];
    const plan = planSuccessValidation({
      successId: 400,
      catalog,
      guideQuests: [],
      milestones: resourceMilestones,
      itemNames: { 901: "Chanvre", 902: "Dom de Pin", 903: "Ronce ephedryenne" },
    });
    expect(plan?.possessionNames).toEqual(["Dom de Pin"]);
    expect(plan?.coveredPossessionCount).toBe(2);
  });
});

describe("planSuccessValidation — données réelles (guide seed + DofusDB)", () => {
  const payload = JSON.parse(
    readFileSync(path.join(process.cwd(), "public/game-data/success-graph.json"), "utf8")
  ) as {
    achievements: Array<{
      id: number;
      name: string;
      questIds: number[];
      successIds: number[];
      itemIds: number[];
    }>;
    quests: Array<{
      id: number;
      name: string;
      level: number | null;
      questIds: number[];
      successIds: number[];
      itemIds: number[];
      criterion: string;
    }>;
    items: Array<{ id: number; name: string }>;
  };
  const meta = parseRushSuccessMeta(
    JSON.parse(
      readFileSync(
        path.join(process.cwd(), "public/game-data/rush-success-meta.json"),
        "utf8"
      )
    )
  );
  const catalog: RushSuccessCatalog = new Map(
    payload.achievements.map((row) => [row.id, row])
  );
  const questCriteria = new Map(
    payload.quests.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        level: row.level,
        questIds: row.questIds,
        successIds: row.successIds,
        itemIds: row.itemIds,
        criterion: row.criterion,
      },
    ])
  );
  const itemNames = Object.fromEntries(payload.items.map((row) => [row.id, row.name]));

  // Guide seed réel : un bloc = un titre `milestone`, une séquence = une quête.
  const seed = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "src/data/rush-sylvestre-guide.enriched.json"),
      "utf8"
    )
  ) as {
    quests: Array<{
      name: string;
      milestone: string;
      questDbIds: number[];
      activityTags: unknown[];
    }>;
  };
  const byBlock = new Map<string, RushSequence[]>();
  const guideQuests: RushGuideQuestRef[] = [];
  seed.quests.forEach((row, index) => {
    const sequenceId = `seed-${index}`;
    const sequence: RushSequence = {
      id: sequenceId,
      subGuideRef: sequenceId,
      subGuideName: row.name,
      isOptional: false,
      order: index,
      questDbIds: row.questDbIds,
      activityTags: row.activityTags as never,
    };
    const list = byBlock.get(row.milestone) ?? [];
    list.push(sequence);
    byBlock.set(row.milestone, list);
    for (const id of row.questDbIds) {
      guideQuests.push({
        id,
        name: row.name,
        done: false,
        sequenceId,
      });
    }
  });
  const milestones: RushMilestone[] = [...byBlock.entries()].map(
    ([title, sequences], index) => ({
      id: `seed-ms-${index}`,
      chapter: 1,
      chapterLabel: "Seed",
      title,
      type: "QUETE_SERIE",
      isOptional: false,
      order: index,
      sequences,
    })
  );

  it("Six sur six 1705 prévoit ses 3 Qf et les six Dofus en possession", () => {
    const plan = planSuccessValidation({
      successId: 1705,
      catalog,
      questCriteria,
      overrides: meta.overrides,
      guideQuests,
      milestones,
      itemNames,
    });
    expect(plan).not.toBeNull();
    const targetNames = plan!.blocks.flatMap((block) => block.targetNames);
    expect(targetNames).toEqual(
      expect.arrayContaining([
        "Dans la gueule du dragon",
        "S'armer contre le destin",
        "La fin ou le commencement",
      ])
    );
    expect(plan!.possessionNames).toEqual(
      expect.arrayContaining([
        "Dofus Émeraude",
        "Dofus Pourpre",
        "Dofus Turquoise",
        "Dofus Ocre",
        "Dofus Ivoire",
        "Dofus Ébène",
      ])
    );
  });

  it("aucune séquence inventée : toutes les cibles existent dans le guide", () => {
    const plan = planSuccessValidation({
      successId: 1705,
      catalog,
      questCriteria,
      overrides: meta.overrides,
      guideQuests,
      milestones,
      itemNames,
    });
    const known = new Set(guideQuests.map((quest) => quest.sequenceId));
    for (const block of plan!.blocks) {
      for (const id of [...block.targetSequenceIds, ...block.cascadedSequenceIds]) {
        expect(known.has(id)).toBe(true);
      }
    }
  });
});

const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("branchement des surfaces — « Valider les prérequis »", () => {
  const CHIP = "src/components/dofus-quests/rush/SuccessChip.tsx";

  it("la fiche liste les objets directs du succès et reste en lecture seule sans contexte", () => {
    const src = codeOf(CHIP);
    expect(src).toContain("Objets requis par ce succès");
    expect(src).toContain("les objets des succès prérequis ont leur");
    expect(src).toContain("ItemsModal");
    expect(src).toContain("Voir les ");
    expect(src).toContain("/api/assets-dofus/items/");
    expect(src).toContain("planSuccessValidation");
    expect(src).toContain("validation?: SuccessValidationContext");
    expect(src).toContain("if (!validation || validationWrites.length === 0");
  });

  it("les quêtes du guide sont cliquables, les hors-guide restent sans cible", () => {
    const src = codeOf(CHIP);
    expect(src).toContain("onGoToQuest?.(row.sequenceId!)");
    expect(src).toContain('row.inGuide ? "À faire" : "Hors guide"');
    expect(src).toContain("canJump = !!row.sequenceId && !!onGoToQuest");
  });

  it("le dashboard, l'overlay et le public branchent le saut vers la quête", () => {
    const dash = codeOf(
      "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx"
    );
    expect(dash).toMatch(/onGoToQuest=\{\(sequenceId\) => scrollToPrereq/);
    expect(dash).toMatch(/validation=\{\{[\s\S]{0,200}?guildId/);
    const overlay = codeOf(
      "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx"
    );
    expect(overlay).toMatch(/onGoToQuest=\{handleGoToDungeonStep\}/);
    expect(overlay.split("successValidation=").length - 1).toBeGreaterThanOrEqual(3);
    const pub = codeOf(
      "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx"
    );
    expect(pub).toMatch(/onGoToQuest=\{scrollToStep\}/);
    // Le public ne reçoit AUCUN contexte d'écriture.
    expect(pub).not.toContain("successValidation=");
  });
});
