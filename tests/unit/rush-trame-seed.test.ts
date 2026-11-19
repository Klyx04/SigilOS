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

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { buildRushSeedFromTrame, type TrameInput } from "@/lib/rush-trame-seed";
import { MAX_RUSH_DUNGEONS_PER_SEQUENCE } from "@/lib/rush-dungeon-names";

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
      constraints: [
        { type: "combat", detail: "solo · X", refs: { mode: "solo" } },
        { type: "combat", detail: "Piou Rouge", refs: { mode: "solo" } },
      ],
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

  it("résout les monstres d'un combat contre le bestiaire, sans inventer les inconnus", () => {
    const tags = result.payload.blocks[0].sequences[0].activityTags ?? [];
    const piou = tags.find((tag) => tag.type === "combat_solo" && tag.name === "Piou Rouge");
    expect(piou?.monsters).toEqual([
      { name: "Piou Rouge", slug: "piou-rouge", monsterId: 489, gfxId: 273 },
    ]);
    const unknown = tags.find((tag) => tag.type === "combat_solo" && tag.name === "solo · X");
    expect(unknown?.monsters).toBeUndefined();
  });

  it("pose la position de lancement DPLN en tag pos_tags", () => {
    const q1 = result.payload.blocks[0].sequences[0];
    const tag = (q1.activityTags ?? []).find((candidate) => candidate.type === "pos_tags");
    expect(tag).toMatchObject({ type: "pos_tags", name: "[6,-19]", allowZaap: true, worldId: 1 });
  });

  it("transporte l'id DofusDB du donjon, jamais le cuid local", () => {
    const sequence = result.payload.blocks[0].sequences[0];
    expect(sequence.dungeonDbIds).toEqual([13]);
    expect(sequence.dungeonIds).toBeUndefined();
    expect(sequence.dungeonNames).toEqual(["Donjon des Bworks"]);
  });

  it("n'expose aucun nom de source dans le payload", () => {
    const payload = JSON.stringify(result.payload).toLowerCase();
    for (const token of ["tougli", "touglie", "dofusyelle", "laniyelle", "marcellusito", "barbofus"]) {
      expect(payload).not.toContain(token);
    }
  });
});

describe("spine Yelle — liste de quêtes, succès, classes et neutre", () => {
  const result = buildRushSeedFromTrame(TRAME, { spine: "yelle", includeSuccesses: true });

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

  it("n'expose aucun nom de source dans le payload", () => {
    const payload = JSON.stringify(result.payload).toLowerCase();
    for (const token of ["tougli", "touglie", "dofusyelle", "laniyelle", "marcellusito", "barbofus"]) {
      expect(payload).not.toContain(token);
    }
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

const ENRICH_TRAME: TrameInput = {
  ...TRAME,
  blocks: [
    ...(TRAME.blocks ?? []),
    {
      id: 4,
      order: 3,
      title: "Pandala",
      items: [{ kind: "quest", questId: 500, name: "Q Domakuro" }],
    },
  ],
  quests: { ...(TRAME.quests ?? {}), "500": { id: 500, name: "Q Domakuro" } },
  dofusyelle: {
    steps: [
      ...(TRAME.dofusyelle?.steps ?? []),
      {
        n: 99,
        category: "Pandala",
        title: "Quêtes Pandala - Domakuro",
        body: ["une ligne"],
        quetes: [{ t: "Q Domakuro" }],
        succes: [{ t: "Succès Domakuro" }],
        donjons: [{ name: "Donjon Domakuro" }],
      },
      {
        n: 23,
        category: "Départ",
        title: "Q1 encore",
        body: [],
        quetes: [{ t: "Q1" }],
        succes: [],
        donjons: [],
      },
    ],
    correlation: [
      ...(TRAME.dofusyelle?.correlation ?? []),
      { step: 99, title: "Q Domakuro", questIds: [500], matched: true },
      { step: 23, title: "Q1", questIds: [1958], matched: true },
    ],
  },
};

const DOFUSDEX_ENRICH = {
  dofus: [
    {
      name: "Domakuro",
      minLevel: 100,
      maxLevel: 120,
      steps: [{ objectives: [{ name: "Objectif Domakuro", level: 110 }] }],
    },
  ],
};

const ACHIEVEMENTS_ENRICH = [{ id: 900, name: "Succès 1", questIds: [1958] }];

describe("Touglie enrichi — la trame Tougli + les données Yelle", () => {
  const result = buildRushSeedFromTrame(ENRICH_TRAME, {
    spine: "tougli",
    enrichFromYelle: true,
    dofusdex: DOFUSDEX_ENRICH,
    achievements: ACHIEVEMENTS_ENRICH,
  });
  const byTitle = (title: string) => result.payload.blocks.find((block) => block.title === title);

  it("attache le succès officiel à sa quête, sans créer de ligne cochable", () => {
    const astrub = byTitle("Astrub");
    // Aucune 2ᵉ ligne « succès » : le succès est une propriété de la quête.
    expect(astrub?.sequences.map((sequence) => sequence.subGuideName)).not.toContain("Succès 1");
    expect(astrub?.sequences.filter((sequence) => sequence.isSuccess)).toHaveLength(0);
    const q1 = astrub?.sequences.find((sequence) => sequence.subGuideName === "Q1");
    const tags = (q1?.activityTags ?? []).filter((tag) => tag.type === "succes");
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ name: "Succès 1", id: "900" });
    expect(result.report.successTags).toBeGreaterThanOrEqual(1);
    expect(result.report.successQuests).toBeGreaterThanOrEqual(1);
  });

  it("pose le conseil Yelle rédigé sur la quête corrélée, pas sur le bloc", () => {
    const q1 = byTitle("Astrub")?.sequences.find((sequence) => sequence.subGuideName === "Q1");
    expect(q1?.tips).toContain("Prends toutes les quêtes");
    expect(byTitle("Astrub")?.tips ?? "").not.toContain("Prends toutes les quêtes");
  });

  it("pose le conseil d'une étape sans quête cible sur le bloc de sa catégorie", () => {
    expect(byTitle("Astrub")?.tips).toContain("Éternelle Moisson");
  });

  it("ajoute le conseil d'une deuxième étape sur la même quête, sans écraser le premier", () => {
    const q1 = byTitle("Astrub")?.sequences.find((sequence) => sequence.subGuideName === "Q1");
    expect(q1?.tips).toContain("Prends toutes les quêtes");
    expect(q1?.tips).toContain("Un seul Kanigroula");
  });

  it("applique le DofusDex d'une étape à un bloc Tougli dont le titre diffère", () => {
    const pandala = byTitle("Pandala");
    expect(pandala?.tips).toContain("DofusDex officiel");
    expect(pandala?.tips).toContain("Objectif Domakuro");
    expect(pandala?.dofusId).toBe("domakuro");
    expect(result.report.yelleDofusDexMerged).toBeGreaterThanOrEqual(1);
  });

  it("conserve les donjons Yelle en conseil du bloc", () => {
    expect(byTitle("Pandala")?.tips).toContain("Donjon Domakuro");
    expect(byTitle("Astrub")?.tips).toContain("Donjon 1");
  });

  it("laisse dans « conseils à rédiger » ce qui n'a pas été rédigé", () => {
    expect(result.report.tipsToWrite.some((tip) => tip.step === 99)).toBe(true);
  });

  it("n'expose aucun nom de source dans le payload enrichi", () => {
    const payload = JSON.stringify(result.payload).toLowerCase();
    for (const token of ["tougli", "touglie", "dofusyelle", "laniyelle", "marcellusito", "barbofus"]) {
      expect(payload).not.toContain(token);
    }
  });

  it("sans l'option, le spine Tougli reste inchangé", () => {
    const plain = buildRushSeedFromTrame(ENRICH_TRAME, {
      spine: "tougli",
      dofusdex: DOFUSDEX_ENRICH,
    });
    expect(plain.report.successes).toBe(0);
    expect(plain.report.yelleSuccesses).toBe(0);
    const plainPandala = plain.payload.blocks.find((block) => block.title === "Pandala");
    expect(plainPandala?.tips ?? "").not.toContain("Donjon Domakuro");
  });
});

const TRAME_PREREQ: TrameInput = {
  blocks: [
    {
      title: "Astrub",
      items: [
        { kind: "quest", questId: 1 },
        { kind: "quest", questId: 2 },
        { kind: "quest", questId: 3 },
        { kind: "quest", questId: 4 },
        { kind: "quest", questId: 5 },
      ],
    },
    {
      title: "Bonta",
      items: [
        {
          kind: "choice",
          branches: [
            {
              condition: { kind: "camp", raw: "Bonta", value: "bontarien" },
              items: [{ kind: "quest", questId: 6 }],
            },
          ],
        },
      ],
    },
    {
      title: "Brakmar",
      items: [
        {
          kind: "choice",
          branches: [
            {
              condition: { kind: "camp", raw: "Brak", value: "brakmarien" },
              items: [{ kind: "quest", questId: 7 }],
            },
          ],
        },
      ],
    },
  ],
  quests: {
    "1": { id: 1, name: "Début" },
    "2": { id: 2, name: "Suite", prereqIds: [1] },
    "3": { id: 3, name: "Cible absente", prereqIds: [999] },
    "4": { id: 4, name: "Soi-même", prereqIds: [4] },
    "5": { id: 5, name: "Croisée", prereqIds: [7] },
    "6": { id: 6, name: "Bonta 1", prereqIds: [1] },
    "7": { id: 7, name: "Brak 1", prereqIds: [1] },
  },
};

const prereqNamesOf = (result: ReturnType<typeof buildRushSeedFromTrame>, name: string) =>
  result.payload.blocks
    .flatMap((block) => block.sequences)
    .find((sequence) => sequence.subGuideName === name)
    ?.activityTags?.filter((tag) => tag.type === "prereq_text")
    .map((tag) => tag.name) ?? [];

describe("Prérequis entre quêtes — prereq_text par nom", () => {
  const result = buildRushSeedFromTrame(TRAME_PREREQ, { spine: "tougli", routeOrderLock: false });

  it("pose le prérequis par nom, jamais par un id inventé", () => {
    expect(prereqNamesOf(result, "Suite")).toEqual(["Début"]);
    expect(result.report.prereqTags).toBeGreaterThan(0);
  });

  it("n'invente rien quand la cible n'existe pas et ne se référence pas elle-même", () => {
    expect(prereqNamesOf(result, "Cible absente")).toEqual([]);
    expect(prereqNamesOf(result, "Soi-même")).toEqual([]);
  });

  it("refuse une cible d'une autre cité (aucun blocage à vie)", () => {
    // « Croisée » n'a pas de cité ; sa cible est brâkmarienne : l'arête est écartée.
    expect(prereqNamesOf(result, "Croisée")).toEqual([]);
    expect(result.report.prereqSkipped).toBeGreaterThanOrEqual(3);
  });

  it("garde une arête dès que la cible n'est pas conditionnée autrement", () => {
    expect(prereqNamesOf(result, "Bonta 1")).toEqual(["Début"]);
    expect(prereqNamesOf(result, "Brak 1")).toEqual(["Début"]);
  });
});

describe("Prérequis « au choix » — prereq_expr", () => {
  const result = buildRushSeedFromTrame(TRAME_PREREQ, {
    spine: "tougli",
    routeOrderLock: false,
    prereqOr: { 2: [[1, 3]] },
  });
  const tagsOf = (name: string) =>
    result.payload.blocks
      .flatMap((block) => block.sequences)
      .find((sequence) => sequence.subGuideName === name)
      ?.activityTags ?? [];

  it("pose un groupe OU et NE repose PAS l'arête en ET", () => {
    const tags = tagsOf("Suite");
    const expr = tags.filter((tag) => tag.type === "prereq_expr");
    expect(expr).toHaveLength(1);
    expect(expr[0].alternatives?.map((alt) => alt.questId)).toEqual([1, 3]);
    // Le membre du groupe n'est plus un prérequis obligatoire.
    expect(prereqNamesOf(result, "Suite")).toEqual([]);
    expect(result.report.prereqChoiceTags).toBe(1);
  });

  it("le verrou d'ORDRE ne verrouille jamais une alternative", () => {
    // « Suite » a pour précédente « Début » (quête 1) : si 1 est une alternative du
    // groupe, l'ordre ne doit pas la reposer en ET (défaut mesuré sur Supermilicien).
    const locked = buildRushSeedFromTrame(TRAME_PREREQ, {
      spine: "tougli",
      prereqOr: { 2: [[1, 4]] },
    });
    expect(prereqNamesOf(locked, "Suite")).toEqual([]);
    const expr = locked.payload.blocks
      .flatMap((block) => block.sequences)
      .find((sequence) => sequence.subGuideName === "Suite")
      ?.activityTags?.find((tag) => tag.type === "prereq_expr");
    expect(expr?.alternatives?.map((alt) => alt.questId)).toEqual([1, 4]);
  });

  it("ignore un groupe d'une seule alternative (ce n'est pas un choix)", () => {
    const single = buildRushSeedFromTrame(TRAME_PREREQ, {
      spine: "tougli",
      routeOrderLock: false,
      prereqOr: { 2: [[1]] },
    });
    expect(single.report.prereqChoiceTags).toBe(0);
    expect(prereqNamesOf(single, "Suite")).toEqual(["Début"]);
  });


  it("ne dépasse jamais 30 tags par séquence (schéma d'import)", () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
      name: `Ressource ${index + 1}`,
      count: 1,
    }));
    const trame: TrameInput = {
      blocks: [
        { title: "Bloc", items: [{ kind: "quest", questId: 1 }, { kind: "quest", questId: 2 }] },
      ],
      quests: {
        "1": { id: 1, name: "Prérequis" },
        "2": { id: 2, name: "Chargée", items, prereqIds: [1] },
      },
    };
    const built = buildRushSeedFromTrame(trame, { spine: "tougli" });
    const sequence = built.payload.blocks[0].sequences.find((s) => s.subGuideName === "Chargée");
    expect(sequence?.activityTags).toHaveLength(30);
    expect(sequence?.activityTags?.some((tag) => tag.type === "prereq_text")).toBe(false);
  });
});

describe("Verrou d'ordre de la route (option C)", () => {
  const TRAME_ORDER: TrameInput = {
    blocks: [
      {
        title: "Ordre",
        items: [
          { kind: "quest", questId: 1 },
          { kind: "quest", questId: 2 },
          { kind: "group", items: [{ kind: "quest", questId: 3 }, { kind: "quest", questId: 4 }] },
          { kind: "quest", questId: 5 },
          {
            kind: "choice",
            branches: [
              { condition: { kind: "camp", value: "bontarien" }, items: [{ kind: "quest", questId: 6 }] },
              { condition: { kind: "camp", value: "brakmarien" }, items: [{ kind: "quest", questId: 7 }] },
            ],
          },
        ],
      },
      {
        title: "Avance",
        items: [
          { kind: "take_quests", questIds: [8] },
          { kind: "quest", questId: 9 },
        ],
      },
    ],
    quests: {
      "1": { id: 1, name: "Q1" },
      "2": { id: 2, name: "Q2" },
      "3": { id: 3, name: "Q3" },
      "4": { id: 4, name: "Q4" },
      "5": { id: 5, name: "Q5" },
      "6": { id: 6, name: "Q6" },
      "7": { id: 7, name: "Q7" },
      "8": { id: 8, name: "Q8" },
      "9": { id: 9, name: "Q9" },
    },
  };

  const built = buildRushSeedFromTrame(TRAME_ORDER, { spine: "tougli" });
  const prereqsOf = (name: string) =>
    (built.payload.blocks
      .flatMap((block) => block.sequences)
      .find((sequence) => sequence.subGuideName === name)?.activityTags ?? [])
      .filter((tag) => tag.type === "prereq_text")
      .map((tag) => tag.name);

  it("chaque quête exige la précédente de sa branche", () => {
    expect(prereqsOf("Q2")).toEqual(["Q1"]);
    expect(prereqsOf("Q1")).toEqual([]);
    expect(built.report.routePrereqs).toBeGreaterThanOrEqual(2);
  });

  it("une quête « à prendre à l'avance » ne verrouille rien", () => {
    expect(prereqsOf("Q8")).toEqual([]);
    expect(prereqsOf("Q9")).toEqual([]);
  });

  it("les quêtes parallèles ne s'enchaînent pas entre elles", () => {
    expect(prereqsOf("Q3")).toEqual([]);
    expect(prereqsOf("Q4")).toEqual([]);
  });

  it("une quête d'une branche n'exige jamais celle de l'autre", () => {
    expect(prereqsOf("Q6")).toEqual([]);
    expect(prereqsOf("Q7")).toEqual([]);
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

  it("le dataset historique ne contient plus de nom de source", () => {
    const dataset = readFileSync("src/data/rush-sylvestre-guide.json", "utf8").toLowerCase();
    for (const token of ["tougli", "touglie", "dofusyelle", "laniyelle", "marcellusito", "barbofus"]) {
      expect(dataset).not.toContain(token);
    }
  });

  it("transporte les 29 alternatives d'un tag multi, pas 12", () => {
    const names = Array.from({ length: 29 }, (_, index) => `Donjon ${index + 1}`);
    const trame: TrameInput = {
      ...TRAME,
      blocks: [
        {
          title: "Zone Guerre",
          items: [{ kind: "quest", questId: 2425, name: "Les totems de Maïmane" }],
        },
      ],
      quests: {
        ...TRAME.quests,
        "2425": {
          id: 2425,
          name: "Les totems de Maïmane",
          dungeonIds: Array.from({ length: 29 }, (_, index) => 100 + index),
          dungeonNames: names,
        },
      },
    };

    const result = buildRushSeedFromTrame(trame, { spine: "tougli" });
    const sequence = result.payload.blocks[0].sequences[0];

    // L'ancien plafond de 12 perdait 17 donjons : la quête se débloquait avec 3 totems.
    expect(sequence.dungeonNames).toHaveLength(29);
    expect(sequence.dungeonDbIds).toHaveLength(29);
    expect(MAX_RUSH_DUNGEONS_PER_SEQUENCE).toBeGreaterThanOrEqual(29);
  });
});
