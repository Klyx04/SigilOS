/**
 * Gardes — **seed Trame → import God** (17/11/2026).
 *
 * 🎯 Ce que le lot devait rendre possible : produire une route complète depuis la
 * corrélation Tougli × Dofusyelle, **sans recopier** les textes tiers, avec les
 * conditions (classe, cité, Ordre, palier), les ressources et les succès.
 *
 * 🛡️ Ce que ce test verrouille :
 *  · les conditions viennent des branches (`classReq`, `alignReq`, `alignOrderCode`,
 *    `alignLevelReq`) — jamais d'une déduction sur le nom ;
 *  · une **ligne de corps** Yelle sans id n'est pas une quête ;
 *  · la liste `quetes` Yelle est la référence ; les succès/donjons sont repris ;
 *  · les ressources deviennent des tags `item` bornés ;
 *  · une quête non appariée est créée **sans id** et signalée, jamais perdue ;
 *  · les deux spines (Tougli / Yelle) restent des fonctions pures.
 */

import { describe, it, expect } from "vitest";
import { buildRushSeedFromTrame, type TrameInput } from "@/lib/rush-trame-seed";

const TRAME: TrameInput = {
  referentials: {
    ordres: [{ code: "coeur_vaillant", camp: "bontarien", paliers: [20, 40, 60, 80, 100] }],
  },
  blocks: [
    {
      id: 1,
      order: 0,
      title: "Astrub",
      items: [
        { kind: "quest", questId: 1958, name: "Q1" },
        {
          kind: "choice",
          branches: [
            {
              condition: { kind: "classe", raw: "Feca", value: "feca" },
              items: [{ kind: "quest", questId: 1963, name: "Classe Feca" }],
            },
            {
              condition: { kind: "classe", raw: "Cra", value: "cra" },
              items: [{ kind: "quest", questId: 1971, name: "Classe Cra" }],
            },
          ],
        },
      ],
    },
    {
      id: 2,
      order: 1,
      title: "Dofus des Veilleurs",
      items: [
        {
          kind: "choice",
          branches: [
            {
              condition: { kind: "camp", raw: "Bonta", value: "bontarien" },
              items: [{ kind: "quest", questId: 55, name: "Bonta 1" }],
            },
            {
              condition: { kind: "camp", raw: "Brak", value: "brakmarien" },
              items: [{ kind: "quest", questId: 375, name: "Brak 1" }],
            },
            {
              condition: { kind: "camp", raw: "Neutre", value: null },
              items: [{ kind: "quest", questId: 1316, name: "La rivalité" }],
            },
          ],
        },
      ],
    },
    {
      id: 3,
      order: 2,
      title: "Ordres",
      items: [
        {
          kind: "choice",
          branches: [
            {
              condition: { kind: "ordre", raw: "CV", value: "coeur_vaillant" },
              items: [
                { kind: "quest", questId: 433, name: "CV 20" },
                { kind: "quest", questId: 109, name: "CV 40" },
              ],
            },
          ],
        },
      ],
    },
  ],
  quests: {
    "1958": {
      id: 1958,
      name: "Q1",
      items: [{ id: 421, name: "Ortie", count: 50 }],
      constraints: [{ type: "combat", detail: "solo · X", refs: { mode: "solo" } }],
      dungeonIds: [13],
      dungeonOurIds: ["cmolalham001zccog1jauzddn"],
      dungeonNames: ["Donjon des Bworks"],
    },
    "1963": { id: 1963, name: "Classe Feca" },
    "1971": { id: 1971, name: "Classe Cra" },
    "55": { id: 55, name: "Bonta 1" },
    "375": { id: 375, name: "Brak 1" },
    "1316": { id: 1316, name: "La rivalité" },
    "433": { id: 433, name: "CV 20" },
    "109": { id: 109, name: "CV 40" },
  },
  dofusyelle: {
    steps: [
      { n: 1, category: "Départ", title: "Avant de commencer", body: ["une ligne"], quetes: [], succes: [] },
      {
        n: 2,
        category: "Départ",
        title: "Quêtes Incarnam, Astrub",
        body: ["une ligne"],
        quetes: [{ t: "Q1" }],
        succes: [{ t: "Succès 1" }],
        donjons: [{ name: "Donjon 1" }],
      },
      {
        n: 3,
        category: "Alignement Bonta",
        title: "Quêtes Alignement Bonta",
        body: [],
        quetes: [{ t: "Bonta 1" }],
        succes: [],
      },
    ],
    correlation: [
      { step: 2, title: "Q1", questIds: [1958], matched: true },
      { step: 3, title: "Bonta 1", questIds: [55], matched: true },
      // Ligne de corps : elle ne doit JAMAIS devenir une quête.
      { step: 2, title: "Bloqué par un horaire, en attendant faire :", questIds: [], matched: false },
    ],
  },
};

const names = (blockIndex: number, result: ReturnType<typeof buildRushSeedFromTrame>) =>
  result.payload.blocks[blockIndex].sequences.map((sequence) => sequence.subGuideName);

describe("spine Tougli — conditions, ressources, Ordres", () => {
  const result = buildRushSeedFromTrame(TRAME, { spine: "tougli" });

  it("garde les trois blocs et leurs types", () => {
    expect(result.payload.blocks).toHaveLength(3);
    expect(result.payload.blocks.map((block) => block.type)).toEqual([
      "QUETE_SERIE",
      "DOFUS",
      "ALIGNEMENT",
    ]);
    expect(names(0, result)).toEqual(["Q1", "Classe Feca", "Classe Cra"]);
  });

  it("écrit la classe, la cité, l'Ordre et le palier depuis les branches", () => {
    const [q1, feca, cra] = result.payload.blocks[0].sequences;
    expect(q1.classReq).toBeUndefined();
    expect(feca.classReq).toBe("feca");
    expect(cra.classReq).toBe("cra");

    const veilleurs = result.payload.blocks[1].sequences;
    expect(veilleurs.map((sequence) => sequence.alignReq)).toEqual([
      "bontarien",
      "brakmarien",
      "neutre",
    ]);

    const ordres = result.payload.blocks[2].sequences;
    expect(ordres[0]).toMatchObject({
      alignReq: "bontarien",
      alignOrderCode: "coeur_vaillant",
      alignLevelReq: 20,
    });
    expect(ordres[1].alignLevelReq).toBe(40);
  });

  it("transforme les ressources et les contraintes en tags bornés", () => {
    const tags = result.payload.blocks[0].sequences[0].activityTags ?? [];
    expect(tags).toEqual(
      expect.arrayContaining([
        { type: "item", name: "Ortie", id: "421", quantity: 50 },
        { type: "combat_solo", name: "solo · X" },
      ])
    );
    expect(result.report.resources).toBe(1);
  });

  it("transporte l'id DofusDB du donjon, jamais le cuid local", () => {
    const sequence = result.payload.blocks[0].sequences[0];
    expect(sequence.dungeonDbIds).toEqual([13]);
    expect(sequence.dungeonIds).toBeUndefined();
  });
});

describe("spine Yelle — liste de quêtes, succès, classes et neutre", () => {
  const result = buildRushSeedFromTrame(TRAME, { spine: "yelle" });

  it("crée l'étape 1 en INFO vide (un conseil rédigé remplace le texte source)", () => {
    const first = result.payload.blocks[0];
    expect(first.title).toContain("Étape 1");
    expect(first.type).toBe("INFO");
    expect(first.sequences).toHaveLength(0);
    expect(first.tips).toContain("Éternelle Moisson");
  });

  it("n'ajoute jamais une ligne de corps comme quête", () => {
    const step2 = result.payload.blocks.find((block) => block.title.includes("Étape 2"));
    expect(step2).toBeDefined();
    expect(step2?.sequences.map((sequence) => sequence.subGuideName)).not.toContain(
      "Bloqué par un horaire, en attendant faire :"
    );
    expect(result.report.unmatched).toHaveLength(0);
  });

  it("ajoute les 19 classes (ici 2) et les succès, et cite les donjons", () => {
    const step2 = result.payload.blocks.find((block) => block.title.includes("Étape 2"));
    const sequences = step2?.sequences ?? [];
    expect(sequences.map((sequence) => sequence.subGuideName)).toEqual(
      expect.arrayContaining(["Q1", "Classe Feca", "Classe Cra", "Succès 1"])
    );
    expect(sequences.filter((sequence) => sequence.isSuccess)).toHaveLength(1);
    expect(sequences.find((sequence) => sequence.subGuideName === "Classe Cra")?.classReq).toBe("cra");
    expect(step2?.description).toContain("Donjon 1");
    expect(result.report.successes).toBe(1);
  });

  it("ajoute « La rivalité » à la première étape d'alignement", () => {
    const step3 = result.payload.blocks.find((block) => block.title.includes("Étape 3"));
    expect(step3?.type).toBe("ALIGNEMENT");
    expect(step3?.sequences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subGuideName: "Bonta 1", alignReq: "bontarien" }),
        expect.objectContaining({ subGuideName: "La rivalité", alignReq: "neutre" }),
      ])
    );
  });

  it("laisse une quête non appariée sans id, avec une note explicite", () => {
    const trame: TrameInput = {
      ...TRAME,
      dofusyelle: {
        ...TRAME.dofusyelle,
        steps: [
          ...(TRAME.dofusyelle?.steps ?? []),
          { n: 4, category: "Annexes", title: "Étape inconnue", body: [], quetes: [{ t: "Introuvable" }], succes: [] },
        ],
        correlation: [
          ...(TRAME.dofusyelle?.correlation ?? []),
          { step: 4, title: "Introuvable", questIds: [], matched: false },
        ],
      },
    };
    const withUnknown = buildRushSeedFromTrame(trame, { spine: "yelle" });
    expect(withUnknown.report.unmatched).toEqual([
      { step: 4, title: "Introuvable", reason: "Aucun id DofusDB" },
    ]);
    const block = withUnknown.payload.blocks.find((candidate) => candidate.title.includes("Étape 4"));
    expect(block?.sequences[0]).toMatchObject({ subGuideName: "Introuvable", questDbIds: [] });
  });
});

describe("DofusDex — la checklist officielle enrichit le bloc", () => {
  const DOFUSDEX = {
    dofus: [
      {
        name: "Dofus des Veilleurs",
        minLevel: 100,
        maxLevel: 200,
        prerequisites: [{ name: "Mais où sont les Dofus ?" }],
        steps: [
          {
            type: "achievement",
            id: 1958,
            name: "Les principes d'Archie m'aident",
            level: 15,
            objectives: [
              { type: "achievement", id: 1958, name: "Les principes d'Archie m'aident", level: 15 },
              { type: "quest", id: 1959, name: "On marche sur des œufs", level: 15 },
            ],
          },
        ],
      },
    ],
  };

  it("pose les objectifs, les prérequis et le dofusId sur le bloc DOFUS", () => {
    const result = buildRushSeedFromTrame(TRAME, { spine: "tougli", dofusdex: DOFUSDEX });
    const block = result.payload.blocks.find((candidate) => candidate.title === "Dofus des Veilleurs");
    expect(block?.tips).toContain("DofusDex officiel");
    expect(block?.tips).toContain("Les principes d'Archie m'aident");
    expect(block?.tips).toContain("On marche sur des œufs");
    expect(block?.tips).toContain("Prérequis");
    expect(block?.dofusId).toBe("des_veilleurs");
    expect(result.report.dofusDexTagged).toBe(1);
  });

  it("borne les conseils à 4 000 caractères (limite du schéma d'import)", () => {
    const huge = {
      dofus: [
        {
          name: "Dofus des Veilleurs",
          steps: [
            {
              type: "achievement",
              name: "Succès",
              objectives: Array.from({ length: 300 }, (_, index) => ({
                type: "quest",
                id: index + 1,
                name: `Objectif très long numéro ${index} avec un libellé qui remplit la ligne`,
                level: 200,
              })),
            },
          ],
        },
      ],
    };
    const result = buildRushSeedFromTrame(TRAME, { spine: "tougli", dofusdex: huge });
    const block = result.payload.blocks.find((candidate) => candidate.title === "Dofus des Veilleurs");
    expect(block?.tips?.length ?? 0).toBeLessThanOrEqual(4000);
  });
});

describe("pureté et bornes du générateur", () => {
  it("ne mute jamais la Trame d'origine", () => {
    const before = JSON.stringify(TRAME);
    buildRushSeedFromTrame(TRAME, { spine: "yelle" });
    expect(JSON.stringify(TRAME)).toBe(before);
  });

  it("respecte le plafond de séquences par bloc", () => {
    const capped = buildRushSeedFromTrame(TRAME, { spine: "tougli", maxSequencesPerBlock: 2 });
    expect(capped.payload.blocks[0].sequences).toHaveLength(2);
  });

  it("une condition inconnue est signalée et n'ouvre aucune route", () => {
    const trame: TrameInput = {
      ...TRAME,
      blocks: [
        {
          title: "Bloc",
          items: [
            {
              kind: "choice",
              branches: [
                {
                  condition: { kind: "pirate", raw: "Pirate=X", value: "x" },
                  items: [{ kind: "quest", questId: 1958, name: "Q1" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const result = buildRushSeedFromTrame(trame, { spine: "tougli" });
    expect(result.report.warnings.join(" ")).toContain("Condition inconnue");
    expect(result.payload.blocks[0].sequences[0].alignReq).toBeUndefined();
    expect(result.payload.blocks[0].sequences[0].classReq).toBeUndefined();
  });
});
