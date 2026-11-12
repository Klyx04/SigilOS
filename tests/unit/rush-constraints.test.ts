import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseRushConstraints, RUSH_CONSTRAINT_LABELS } from "@/lib/rush-constraints";

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
