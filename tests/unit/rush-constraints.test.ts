import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  constraintsFromLegacyTips,
  constraintsToInfos,
  isEmptyConstraints,
  parseRushConstraints,
  RUSH_CONSTRAINT_LABELS,
  sanitizeConstraints,
} from "@/lib/rush-constraints";
import { parseRushQuestConstraints } from "@/lib/rush-constraints-schema";
import type { RushQuestConstraints } from "@/types/rush-constraints";

const tips = [
  "Joueurs : 4 personnes pour des dalles",
  "Métier : Etre aidé d'un Alchimiste de niveau 100 ou plus",
  "Horaire : Entre 20h00 et 08h00",
  "Sort : Capture d'âmes",
  "Note : Avoir un métier de niveau 50",
  "Pensez à prendre la quête avant de partir",
].join("\n");

function assetExists(icon: string): boolean {
  return existsSync(path.join(process.cwd(), "public", icon.replace(/^\/+/, "")));
}

describe("parseRushConstraints", () => {
  it("sépare les conditions des conseils libres", () => {
    const { constraints, rest } = parseRushConstraints(tips);
    expect(constraints.map((constraint) => constraint.kind)).toEqual([
      "players",
      "job",
      "hours",
      "spell",
      "note",
    ]);
    expect(rest).toBe("Pensez à prendre la quête avant de partir");
  });

  it("extrait un effectif simple écrit en chiffres", () => {
    const [info] = parseRushConstraints("Joueurs : 4 personnes pour des dalles").constraints;
    expect(info).toMatchObject({ kind: "players", players: 4 });
    expect(info.icon).toBe("/assets/dofus/game-icons/party.png");
  });

  it("extrait un effectif simple écrit en toutes lettres", () => {
    const [info] = parseRushConstraints("Joueurs : Deux personnes : un membre de chaque ordre")
      .constraints;
    expect(info.players).toBe(2);
  });

  it("n'invente pas un effectif sur une répartition complexe", () => {
    const [info] = parseRushConstraints(
      "Joueurs : 3 x Alchimiste de niveau >80 + 3 x Paysan de niveau >40",
    ).constraints;
    expect(info.players).toBeUndefined();
    expect(info.jobs.map((job) => job.slug)).toEqual(["alchimiste", "paysan"]);
    expect(info.text).toContain("3 x Alchimiste");
  });

  it("reconnaît un métier et son asset Dofus", () => {
    const [info] = parseRushConstraints(
      "Métier : Etre aidé d'un Alchimiste de niveau 100 ou plus",
    ).constraints;
    expect(info.jobs).toEqual([{ slug: "alchimiste", name: "Alchimiste" }]);
    expect(info.icon).toBe("/assets/dofus/jobs/alchimiste.png");
  });

  it("reconnaît plusieurs métiers dans l'ordre du texte, sans dépasser trois", () => {
    const [info] = parseRushConstraints(
      "Métier : 1 x Mineur + 1 x Paysan + 1 x Alchimiste + 1 x Forgeron",
    ).constraints;
    expect(info.jobs.map((job) => job.slug)).toEqual(["mineur", "paysan", "alchimiste"]);
  });

  it("structure une fenêtre horaire", () => {
    const [info] = parseRushConstraints("Horaire : Entre 20h00 et 08h00").constraints;
    expect(info.hours).toEqual({ variant: "window", from: "20h00", to: "08h00" });
  });

  it("structure une attente en minutes", () => {
    const [info] = parseRushConstraints("Horaire : Attendre 3 minutes").constraints;
    expect(info.hours).toEqual({ variant: "wait", minutes: 3 });
  });

  it("structure une attente auprès d'un PNJ sans minutes", () => {
    const [info] = parseRushConstraints("Horaire : Il faudra attendre auprès d'un PNJ").constraints;
    expect(info.hours).toEqual({ variant: "wait", minutes: undefined });
  });

  it("structure un horaire « après 20 h » sans borne de fin", () => {
    const [info] = parseRushConstraints("Horaire : >20h00 (Contournable)").constraints;
    expect(info.hours).toEqual({ variant: "window", from: "20h00" });
  });

  it("associe le sort et la note à leurs icônes", () => {
    const sort = parseRushConstraints("Sort : Capture d'âmes").constraints[0];
    const note = parseRushConstraints("Note : Avoir un métier de niveau 50").constraints[0];
    expect(sort.icon).toBe("/assets/dofus/game-icons/parchment.png");
    expect(note.icon).toBe("/assets/dofus/game-icons/info.png");
  });

  it("ne touche pas un tips sans condition", () => {
    const raw = "Pensez à prendre la quête avant de partir";
    expect(parseRushConstraints(raw)).toEqual({ constraints: [], rest: raw });
  });

  it("dédoublonne une condition répétée", () => {
    const raw = "Joueurs : 4 personnes\nJoueurs : 4 personnes";
    expect(parseRushConstraints(raw).constraints).toHaveLength(1);
  });

  it("ignore un libellé inconnu", () => {
    const raw = "Astuce : pensez à prendre la quête";
    expect(parseRushConstraints(raw)).toEqual({ constraints: [], rest: raw });
  });

  it("reconnaît les libellés sans tenir compte de la casse ni des accents", () => {
    const [info] = parseRushConstraints("MÉTIER : Etre Éleveur de niveau 20").constraints;
    expect(info.kind).toBe("job");
    expect(info.jobs[0]).toEqual({ slug: "eleveur", name: "Éleveur" });
  });

  it("expose les cinq libellés attendus par le studio", () => {
    expect([...RUSH_CONSTRAINT_LABELS]).toEqual(["Joueurs", "Métier", "Horaire", "Sort", "Note"]);
  });

  it("chaque métier reconnu pointe vers un asset réel", () => {
    const names = [
      "Alchimiste",
      "Bijoutier",
      "Bricoleur",
      "Bûcheron",
      "Chasseur",
      "Cordomage",
      "Cordonnier",
      "Costumage",
      "Éleveur",
      "Façomage",
      "Façonneur",
      "Forgemage",
      "Forgeron",
      "Joaillomage",
      "Mineur",
      "Paysan",
      "Pêcheur",
      "Sculptemage",
      "Sculpteur",
      "Tailleur",
    ];
    for (const name of names) {
      const [info] = parseRushConstraints(`Métier : Etre aidé d'un ${name}`).constraints;
      expect(info.jobs[0], name).toBeDefined();
      expect(assetExists(info.icon), `${name} → ${info.icon}`).toBe(true);
    }
  });

  it("les icônes génériques existent", () => {
    for (const icon of ["party", "hammer", "pin-clock", "parchment", "info"]) {
      expect(assetExists(`/assets/dofus/game-icons/${icon}.png`), icon).toBe(true);
    }
  });
});

const validConstraints: RushQuestConstraints = {
  version: 1,
  hours: { kind: "window", from: "20:00", to: "08:00", optional: true },
  players: {
    count: 4,
    roles: [
      { kind: "job", job: "alchimiste", level: 100 },
      { kind: "class", className: "iop" },
    ],
  },
  jobs: [{ job: "forgeron", level: 180 }],
  spells: ["Capture d'âmes"],
  notes: ["Avoir un métier de niveau 50"],
};

describe("rushQuestConstraintsSchema", () => {
  it("accepte une forme complète", () => {
    expect(parseRushQuestConstraints(validConstraints)).toMatchObject(validConstraints);
  });

  it("refuse un effectif hors bornes", () => {
    expect(
      parseRushQuestConstraints({ ...validConstraints, players: { count: 41, roles: [] } }),
    ).toBeNull();
  });

  it("refuse un métier inconnu", () => {
    expect(
      parseRushQuestConstraints({ ...validConstraints, jobs: [{ job: "inconnu" }] }),
    ).toBeNull();
  });

  it("refuse une heure invalide", () => {
    expect(
      parseRushQuestConstraints({
        ...validConstraints,
        hours: { kind: "window", from: "25:00" },
      }),
    ).toBeNull();
  });

  it("refuse une classe inconnue", () => {
    expect(
      parseRushQuestConstraints({
        ...validConstraints,
        players: { roles: [{ kind: "class", className: "inconnue" }] },
      }),
    ).toBeNull();
  });

  it("refuse plus de dix rôles", () => {
    const roles = Array.from({ length: 11 }, () => ({ kind: "free" as const, text: "x" }));
    expect(
      parseRushQuestConstraints({ ...validConstraints, players: { roles } }),
    ).toBeNull();
  });

  it("accepte un horaire sans borne de fin", () => {
    const parsed = parseRushQuestConstraints({
      ...validConstraints,
      hours: { kind: "window", from: "20:00" },
    });
    expect(parsed?.hours).toEqual({ kind: "window", from: "20:00" });
  });
});

describe("constraintsToInfos", () => {
  it("rend l'horaire, les joueurs, les métiers, les sorts et les notes", () => {
    const infos = constraintsToInfos(validConstraints);
    expect(infos.map((info) => info.kind)).toEqual(["hours", "players", "job", "spell", "note"]);
    expect(infos[0].hours).toEqual({ variant: "window", from: "20h00", to: "08h00" });
    expect(infos[1].players).toBe(4);
    expect(infos[1].jobs.map((job) => job.slug)).toEqual(["alchimiste"]);
    expect(infos[2].icon).toBe("/assets/dofus/jobs/forgeron.png");
    expect(infos[4].icon).toBe("/assets/dofus/game-icons/info.png");
  });

  it("rend un horaire « à partir de » sans borne de fin", () => {
    const [info] = constraintsToInfos({
      ...validConstraints,
      hours: { kind: "window", from: "20:00" },
    });
    expect(info.text).toContain("À partir de 20h00");
    expect(info.hours).toEqual({ variant: "window", from: "20h00" });
  });

  it("rend une attente auprès d'un PNJ", () => {
    const [info] = constraintsToInfos({
      ...validConstraints,
      hours: { kind: "wait", minutes: 3, npc: true },
    });
    expect(info.text).toContain("3 minutes");
    expect(info.text).toContain("PNJ");
  });
});

describe("constraintsFromLegacyTips", () => {
  it("reprend les lignes existantes dans le modèle structuré", () => {
    const parsed = constraintsFromLegacyTips(tips);
    expect(parsed.hours).toEqual({ kind: "window", from: "20:00", to: "08:00" });
    expect(parsed.players?.count).toBe(4);
    expect(parsed.jobs.map((job) => job.job)).toEqual(["alchimiste"]);
    expect(parsed.spells).toEqual(["Capture d'âmes"]);
    expect(parsed.notes).toEqual(["Avoir un métier de niveau 50"]);
  });

  it("garde un rôle libre quand le texte des joueurs n'est pas structurable", () => {
    const parsed = constraintsFromLegacyTips("Joueurs : 4 personnes pour des dalles");
    expect(parsed.players?.count).toBe(4);
    expect(parsed.players?.roles).toEqual([{ kind: "free", text: "pour des dalles" }]);
  });

  it("ne produit rien sur un tips libre", () => {
    expect(constraintsFromLegacyTips("Pensez à prendre la quête")).toEqual({
      version: 1,
      jobs: [],
      spells: [],
      notes: [],
    });
  });
});

describe("isEmptyConstraints", () => {
  it("reconnaît un modèle vide", () => {
    expect(isEmptyConstraints({ version: 1, jobs: [], spells: [], notes: [] })).toBe(true);
    expect(isEmptyConstraints(null)).toBe(true);
  });

  it("reconnaît un modèle rempli", () => {
    expect(isEmptyConstraints(validConstraints)).toBe(false);
  });
});

describe("sanitizeConstraints", () => {
  it("retire les lignes vides de l'éditeur", () => {
    const sanitized = sanitizeConstraints({
      version: 1,
      jobs: [],
      spells: ["", "  ", "Capture d'âmes"],
      notes: ["", "  ", "Avoir un métier de niveau 50"],
      players: {
        roles: [
          { kind: "free", text: "  " },
          { kind: "job", job: "alchimiste", level: 100 },
        ],
      },
    });
    expect(sanitized.spells).toEqual(["Capture d'âmes"]);
    expect(sanitized.notes).toEqual(["Avoir un métier de niveau 50"]);
    expect(sanitized.players?.roles).toEqual([{ kind: "job", job: "alchimiste", level: 100 }]);
  });

  it("met les joueurs à null quand tout est vide", () => {
    const sanitized = sanitizeConstraints({
      version: 1,
      jobs: [],
      spells: [],
      notes: [],
      players: { roles: [{ kind: "free", text: " " }] },
    });
    expect(sanitized.players).toBeNull();
  });
});

const extraConstraints: RushQuestConstraints = {
  ...validConstraints,
  combat: {
    mode: "group",
    monsters: [
      { name: "Miss Tique", count: 1, level: 200, health: 27000, imageUrl: "/assets/dofus/monsters/1542.png" },
      { name: "Miss Teigne", count: 2, level: 200, health: 27000 },
    ],
  },
  dungeonChoice: {
    dungeons: [
      { id: "dj1", name: "Salons privés de Klime", bossName: "Klime", level: 200 },
      { name: "Aquadôme de Merkator", bossName: "Merkator", level: 200 },
    ],
    note: "Un seul donjon à faire",
  },
  bashMobs: [{ name: "Gangredogue embusqué", level: 200 }],
};

describe("conditions de combat, donjon au choix et monstres", () => {
  it("accepte la forme complète", () => {
    expect(parseRushQuestConstraints(extraConstraints)).toMatchObject(extraConstraints);
  });

  it("refuse un mode de combat inconnu", () => {
    expect(
      parseRushQuestConstraints({
        ...extraConstraints,
        combat: { mode: "inconnu", monsters: [] },
      }),
    ).toBeNull();
  });

  it("refuse un effectif de monstre à zéro", () => {
    expect(
      parseRushQuestConstraints({
        ...extraConstraints,
        combat: { mode: "solo", monsters: [{ name: "Test", count: 0 }] },
      }),
    ).toBeNull();
  });

  it("refuse plus de vingt monstres dans un combat", () => {
    const monsters = Array.from({ length: 21 }, () => ({ name: "Test", count: 1 }));
    expect(
      parseRushQuestConstraints({ ...extraConstraints, combat: { mode: "solo", monsters } }),
    ).toBeNull();
  });

  it("refuse plus de huit donjons au choix", () => {
    const dungeons = Array.from({ length: 9 }, () => ({ name: "Donjon" }));
    expect(
      parseRushQuestConstraints({
        ...extraConstraints,
        dungeonChoice: { dungeons },
      }),
    ).toBeNull();
  });

  it("rend le combat, le donjon au choix et les monstres comme infos dédiées", () => {
    const infos = constraintsToInfos(extraConstraints);
    const combat = infos.find((info) => info.kind === "combat");
    const dungeon = infos.find((info) => info.kind === "dungeon");
    const mobs = infos.find((info) => info.kind === "mobs");

    expect(combat?.label).toBe("Combat de groupe");
    expect(combat?.combat?.monsters).toHaveLength(2);
    expect(dungeon?.dungeons).toHaveLength(2);
    expect(dungeon?.dungeonNote).toBe("Un seul donjon à faire");
    expect(mobs?.mobs?.[0]?.name).toBe("Gangredogue embusqué");
  });

  it("retire les lignes vides de combat et de donjon", () => {
    const sanitized = sanitizeConstraints({
      ...extraConstraints,
      combat: {
        mode: "solo",
        monsters: [
          { name: "  ", count: 1 },
          { name: "Bagarreur clandestin", count: 1 },
        ],
      },
      dungeonChoice: {
        dungeons: [{ name: " " }, { name: "Palais du roi Nidas" }],
        note: "  ",
      },
      bashMobs: [{ name: " " }, { name: "Pistilangue embusqué" }],
    });

    expect(sanitized.combat?.monsters).toEqual([
      { name: "Bagarreur clandestin", count: 1 },
    ]);
    expect(sanitized.dungeonChoice?.dungeons).toEqual([{ name: "Palais du roi Nidas" }]);
    expect(sanitized.dungeonChoice?.note).toBeUndefined();
    expect(sanitized.bashMobs).toEqual([{ name: "Pistilangue embusqué" }]);
  });

  it("reconnaît un modèle rempli par un combat", () => {
    expect(isEmptyConstraints(extraConstraints)).toBe(false);
  });
});
