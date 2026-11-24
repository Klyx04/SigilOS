import { describe, expect, it } from "vitest";

import {
  mapTougliQuestConstraints,
  parseTougliHours,
  readFrench,
} from "@/lib/rush-constraints-tougli";
import { parseRushQuestConstraints } from "@/lib/rush-constraints-schema";

const monster = (overrides: Record<string, unknown> = {}) => ({
  id: 286,
  level: 31,
  health: 270,
  name: { fr: "Tarche" },
  ...overrides,
});

const combat = (type: string, monsters: unknown[], detail = "") => ({
  type: "combat",
  payload: {
    combat: {
      type,
      payload: monsters.map((entry) => (typeof entry === "object" && entry !== null && "monster" in entry
        ? entry
        : { count: 1, monster: entry })),
    },
    detail,
  },
});

describe("readFrench", () => {
  it("lit une chaîne, un objet { fr } et un nom imbriqué", () => {
    expect(readFrench("  Tarche  ")).toBe("Tarche");
    expect(readFrench({ fr: " Alchimiste " })).toBe("Alchimiste");
    expect(readFrench({ name: { fr: "Bworkette" } })).toBe("Bworkette");
    expect(readFrench(null)).toBe("");
  });
});

describe("parseTougliHours", () => {
  it("structure une fenêtre avec option contournable", () => {
    expect(parseTougliHours(">20h00 (Contournable)")).toEqual({
      schedule: { kind: "window", from: "20:00", optional: true },
    });
  });

  it("structure « entre X et Y »", () => {
    expect(parseTougliHours("Etre entre 20h00 et 8h00")).toEqual({
      schedule: { kind: "window", from: "20:00", to: "08:00" },
    });
  });

  it("accepte les heures sans minutes", () => {
    expect(parseTougliHours("Entre 20h et 08h00")).toEqual({
      schedule: { kind: "window", from: "20:00", to: "08:00" },
    });
    expect(parseTougliHours("12h30 – 13h")).toEqual({
      schedule: { kind: "window", from: "12:30", to: "13:00" },
    });
  });

  it("refuse une fenêtre incomplète ou invalide au lieu de l'inventer", () => {
    const incomplete = parseTougliHours("Entre 20h et plus tard");
    expect(incomplete?.schedule).toBeNull();
    expect(incomplete?.issue).toContain("incomplet");
    const invalid = parseTougliHours("Entre 25h00 et 08h00");
    expect(invalid?.schedule).toBeNull();
    expect(invalid?.issue).toContain("ambigu");
  });

  it("structure une attente en minutes", () => {
    expect(parseTougliHours("Attendre 3 minutes")).toEqual({
      schedule: { kind: "wait", minutes: 3, npc: false },
    });
  });

  it("ne devine pas un horaire illisible", () => {
    const parsed = parseTougliHours("Le soir, quand la lune est haute");
    expect(parsed?.schedule).toBeNull();
    expect(parsed?.issue).toContain("non reconnu");
  });

  it("garde un horaire illisible en note, sans inventer d'attente", () => {
    const { constraints, issues } = mapTougliQuestConstraints({
      objectives: [{ type: "hours", payload: "Le soir, quand la lune est haute" }],
    });
    expect(constraints.hours).toBeUndefined();
    expect(constraints.notes).toEqual(["Horaire : Le soir, quand la lune est haute"]);
    expect(issues.join(" ")).toContain("non reconnu");
  });
});

describe("mapTougliQuestConstraints", () => {
  it("mappe une quête complète, sans perdre l'ordre des combats", () => {
    const { constraints, issues } = mapTougliQuestConstraints({
      objectives: [
        combat("solo", [{ count: 1, monster: monster() }], "Premier combat"),
        combat("groupe", [
          { count: 2, monster: monster({ id: 1542, name: { fr: "Miss Tique" }, level: 200, health: 27000 }) },
          { count: 1, monster: monster({ id: 1543, name: { fr: "Miss Teigne" }, level: 200, health: 27000 }) },
        ]),
        {
          type: "bashMobs",
          payload: [{ id: 3238, level: 40, name: { fr: "Chafer Rōnin" } }],
        },
        { type: "needPlayer", payload: "4 Joueurs pour des dalles" },
        {
          type: "job",
          payload: {
            job: { name: { fr: "Alchimiste" } },
            detail: "Etre aidé d'un Alchimiste de niveau 100 ou plus",
          },
        },
        { type: "hours", payload: "Entre 20h00 et 08h00" },
        { type: "spell", payload: "Capture d'âmes" },
        { type: "note", payload: { fr: "Avoir un métier de niveau 50" } },
        { type: "songe", payload: "Rêves 3 ou plus" },
        { type: "url", payload: { text: "Aide", url: "https://example.test/sim" } },
        {
          type: "dungeonChoice",
          payload: {
            dungeons: [
              {
                id: 77,
                level: 100,
                name: { fr: "Fabrique de Malléfisk" },
                bosses: [{ name: { fr: "Malléfisk" } }],
              },
              { id: 85, level: 120, name: { fr: "Mégalithe de Fraktale" } },
            ],
            note: "Donjon en fonction de votre niveau",
          },
        },
        {
          type: "dungeon",
          payload: { id: 13, name: { fr: "Donjon des Bworks" } },
        },
        { type: "achievement", payload: { id: 95, name: { fr: "Ce n'est qu'un prélèvement" } } },
      ],
    });

    expect(constraints.version).toBe(2);
    expect(parseRushQuestConstraints(constraints)).not.toBeNull();
    expect(constraints.combats).toHaveLength(2);
    expect(constraints.combats?.[0]).toMatchObject({
      mode: "solo",
      detail: "Premier combat",
      monsters: [{ name: "Tarche", count: 1, level: 31, health: 270 }],
    });
    expect(constraints.combats?.[0]?.monsters[0]?.imageUrl).toBe("/api/assets-dofus/monsters/286");
    expect(constraints.combats?.[1]?.mode).toBe("group");
    expect(constraints.combats?.[1]?.monsters.map((entry) => entry.name)).toEqual([
      "Miss Tique",
      "Miss Teigne",
    ]);
    expect(constraints.jobs).toEqual([{ job: "alchimiste", level: 100 }]);
    expect(constraints.hours).toEqual({ kind: "window", from: "20:00", to: "08:00" });
    expect(constraints.players).toMatchObject({
      count: 4,
      roles: [{ kind: "free", text: "pour des dalles" }],
    });
    expect(constraints.bashMobs).toEqual([
      { name: "Chafer Rōnin", level: 40, imageUrl: "/api/assets-dofus/monsters/3238" },
    ]);
    expect(constraints.spells).toEqual(["Capture d'âmes"]);
    expect(constraints.notes).toEqual([
      "Avoir un métier de niveau 50",
      "Songes : Rêves 3 ou plus",
      "Outil : Aide — https://example.test/sim",
    ]);
    expect(constraints.dungeonChoice?.dungeons).toHaveLength(2);
    expect(constraints.dungeonChoice?.note).toBe("Donjon en fonction de votre niveau");
    expect(issues.some((issue) => issue.includes("succès ignoré"))).toBe(true);
  });

  it("ignore un combat vide au lieu d'inventer une composition", () => {
    const { constraints, issues } = mapTougliQuestConstraints({
      objectives: [combat("solo", [])],
    });
    expect(constraints.combats).toEqual([]);
    expect(issues.join(" ")).toContain("combat sans monstre");
  });

  it("garde la première fenêtre horaire et met la seconde en note", () => {
    const { constraints } = mapTougliQuestConstraints({
      objectives: [
        { type: "hours", payload: "Entre 8h00 et 20h00" },
        { type: "hours", payload: "Entre 20h00 et 08h00" },
      ],
    });
    expect(constraints.hours).toEqual({ kind: "window", from: "08:00", to: "20:00" });
    expect(constraints.notes).toEqual(["Horaire : Entre 20h00 et 08h00"]);
  });

  it("n'invente pas un métier inconnu : il part en note", () => {
    const { constraints, issues } = mapTougliQuestConstraints({
      objectives: [
        {
          type: "job",
          payload: { job: { name: { fr: "Métier imaginaire" } }, detail: "niveau 42" },
        },
      ],
    });
    expect(constraints.jobs).toEqual([]);
    expect(constraints.notes).toEqual(["Métier : Métier imaginaire"]);
    expect(issues).toEqual([]);
  });

  it("refuse de fusionner les 6 groupes de Maïmane en un seul donjon au choix", () => {
    const groups = Array.from({ length: 6 }, (_, group) => ({
      type: "dungeonChoice",
      payload: {
        dungeons: Array.from({ length: 5 }, (_, index) => ({
          id: group * 10 + index,
          name: { fr: `Donjon ${group + 1}-${index + 1}` },
        })),
      },
    }));
    const { constraints, issues } = mapTougliQuestConstraints({ objectives: groups });
    expect(constraints.dungeonChoice).toBeUndefined();
    expect(issues.join(" ")).toContain("30 propositions");
    expect(issues.join(" ")).toContain("Maïmane");
  });

  it("conserve deux combats identiques dans l'ordre, sans les fusionner", () => {
    const { constraints } = mapTougliQuestConstraints({
      objectives: [combat("solo", [monster()]), combat("solo", [monster()])],
    });
    expect(constraints.combats).toHaveLength(2);
  });

  it("conserve un niveau de monstre au-delà de 200", () => {
    const { constraints } = mapTougliQuestConstraints({
      objectives: [
        combat("solo", [
          { count: 1, monster: monster({ name: { fr: "Gros Med" }, level: 800, health: 200000 }) },
        ]),
      ],
    });
    expect(constraints.combats?.[0]?.monsters[0]).toMatchObject({
      name: "Gros Med",
      level: 800,
      health: 200000,
    });
  });

  it("dédoublonne notes, sorts et monstres (mais pas les combats)", () => {
    const { constraints } = mapTougliQuestConstraints({
      objectives: [
        combat("solo", [monster()]),
        combat("solo", [monster()]),
        { type: "note", payload: "Note unique" },
        { type: "note", payload: "Note unique" },
        { type: "spell", payload: "Capture d'âmes" },
        { type: "spell", payload: "Capture d'âmes" },
        { type: "bashMobs", payload: [monster(), monster()] },
      ],
    });
    expect(constraints.combats).toHaveLength(2);
    expect(constraints.notes).toEqual(["Note unique"]);
    expect(constraints.spells).toEqual(["Capture d'âmes"]);
    expect(constraints.bashMobs).toHaveLength(1);
  });

  it("résout un donjon par le résolveur fourni (id, nom, visuel)", () => {
    const { constraints } = mapTougliQuestConstraints(
      {
        objectives: [
          {
            type: "dungeonChoice",
            payload: {
              dungeons: [{ id: 77, level: 100, name: { fr: "Fabrique de Malléfisk" } }],
            },
          },
        ],
      },
      {
        resolveDungeon: () => ({
          id: "dj-prisma",
          name: "Fabrique de Malléfisk",
          bossName: "Malléfisk",
          level: 100,
          imageUrl: "/uploads/dungeons/mallefisk.webp",
        }),
      },
    );
    expect(constraints.dungeonChoice?.dungeons[0]).toEqual({
      id: "dj-prisma",
      name: "Fabrique de Malléfisk",
      bossName: "Malléfisk",
      level: 100,
      imageUrl: "/uploads/dungeons/mallefisk.webp",
    });
  });

  it("ne produit rien sur une quête vide", () => {
    const { constraints, issues } = mapTougliQuestConstraints({ objectives: [] });
    expect(constraints).toEqual({
      version: 2,
      jobs: [],
      spells: [],
      notes: [],
      combats: [],
    });
    expect(issues).toEqual([]);
  });
});
