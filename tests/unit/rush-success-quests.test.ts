/**
 * Fiche d'un succès — **toutes** ses quêtes, y compris celles hors du guide.
 *
 * 🎯 Mesure du 23/11/2026 : « La grande biblioquête » référence 4 quêtes ;
 * `SuccessChip` ne listait que celles présentes dans le guide et affichait
 * « les 4 quêtes ne sont pas dans le guide » / 0-0 dès qu'une manquait.
 *
 * 🛡️ Ce que ce test verrouille :
 *  · l'ordre et le dédoublonnage des ids du succès ;
 *  · une quête hors guide reste listée, décochée, avec `inGuide: false` ;
 *  · le nom vient du guide, sinon du catalogue, sinon de `Quête #id` ;
 *  · aucun état deviné (une quête hors guide n'est jamais « validée »).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildSuccessQuestRows } from "@/lib/rush-success-quests";

const GUIDE = [
  { id: 1989, name: "Restauration rapide", done: true },
  { id: 1990, name: "De vrais rats de bibliothèque", done: false },
  { id: 1991, name: "Légende d'automne", done: true },
];

describe("buildSuccessQuestRows", () => {
  it("liste les 4 quêtes d'un succès, dont celle absente du guide", () => {
    const rows = buildSuccessQuestRows([1988, 1989, 1990, 1991], GUIDE, {
      1988: "L'histoire en mouvement",
    });

    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({
      id: 1988,
      name: "L'histoire en mouvement",
      done: false,
      inGuide: false,
    });
    expect(rows.filter((row) => row.inGuide)).toHaveLength(3);
    expect(rows.filter((row) => row.done)).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual([1988, 1989, 1990, 1991]);
  });

  it("replie sur le libellé neutre quand aucun nom n'est connu", () => {
    expect(buildSuccessQuestRows([1988], GUIDE)).toEqual([
      { id: 1988, name: "Quête #1988", done: false, inGuide: false },
    ]);
  });

  it("accepte un catalogue sous forme de Map", () => {
    const names = new Map<number, string>([[1988, "L'histoire en mouvement"]]);
    expect(buildSuccessQuestRows([1988], [], names)[0].name).toBe("L'histoire en mouvement");
  });

  it("dédoublonne les ids et écarte les valeurs invalides", () => {
    const rows = buildSuccessQuestRows(
      [1989, 1989, Number.NaN, -3, 0, 1990] as number[],
      GUIDE
    );
    expect(rows.map((row) => row.id)).toEqual([1989, 1990]);
  });

  it("ne rend rien sans ids", () => {
    expect(buildSuccessQuestRows([], GUIDE)).toEqual([]);
    expect(buildSuccessQuestRows(null, GUIDE)).toEqual([]);
    expect(buildSuccessQuestRows(undefined, GUIDE)).toEqual([]);
  });

  it("la fiche partagée applique la règle et l'icône de succès", () => {
    const source = readFileSync("src/components/dofus-quests/rush/SuccessChip.tsx", "utf8");
    expect(source).toContain("buildSuccessQuestRows");
    expect(source).toContain("Hors guide");
    expect(source).not.toContain("successIconUrl");
  });
});
