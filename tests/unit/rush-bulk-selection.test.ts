/**
 * Gardes — **sélection multiple du studio God Rush** (E3c, 12/11/2026).
 *
 * 🎯 Comportement visé : cocher plusieurs quêtes d'un bloc, savoir combien sont
 * sélectionnées, tout cocher, et ne jamais garder une quête disparue dans la
 * sélection (une action de masse ne doit pas viser une cible absente).
 *
 * Les règles vivent dans `src/lib/rush-bulk-selection.ts`, sans React ; ce fichier
 * ne teste que le comportement, pas le rendu.
 */

import { describe, it, expect } from "vitest";
import {
  pruneRushBulkSelection,
  rushBulkSelectionState,
  selectAllRushBulk,
  toggleRushBulkSelection,
} from "@/lib/rush-bulk-selection";

describe("cocher / décocher une quête", () => {
  it("ajoute une quête absente sans muter l'ensemble d'origine", () => {
    const initial = new Set<string>(["q1"]);
    const next = toggleRushBulkSelection(initial, "q2");

    expect([...next]).toEqual(["q1", "q2"]);
    expect([...initial]).toEqual(["q1"]);
  });

  it("retire une quête déjà cochée", () => {
    const next = toggleRushBulkSelection(new Set(["q1", "q2"]), "q1");
    expect([...next]).toEqual(["q2"]);
  });

  it("un double basculement revient à l'état de départ", () => {
    const initial = new Set(["q1"]);
    const back = toggleRushBulkSelection(toggleRushBulkSelection(initial, "q2"), "q2");
    expect([...back]).toEqual(["q1"]);
  });
});

describe("état de la sélection face à la liste affichée", () => {
  const ids = ["q1", "q2", "q3"];

  it("aucune sélection : compte zéro, ni tout ni partiel", () => {
    expect(rushBulkSelectionState(new Set(), ids)).toEqual({ count: 0, all: false, some: false });
  });

  it("sélection partielle : compte juste, `some` vrai, `all` faux", () => {
    expect(rushBulkSelectionState(new Set(["q1", "q3"]), ids)).toEqual({
      count: 2,
      all: false,
      some: true,
    });
  });

  it("toute la liste cochée : `all` vrai, `some` faux", () => {
    expect(rushBulkSelectionState(new Set(ids), ids)).toEqual({ count: 3, all: true, some: false });
  });

  it("un id hors liste n'est pas compté (la liste affichée fait foi)", () => {
    expect(rushBulkSelectionState(new Set(["q1", "autre-bloc"]), ids)).toEqual({
      count: 1,
      all: false,
      some: true,
    });
  });

  it("liste vide : jamais `all`, même avec une sélection résiduelle", () => {
    expect(rushBulkSelectionState(new Set(["q1"]), [])).toEqual({ count: 0, all: false, some: false });
  });
});

describe("tout sélectionner et purge", () => {
  it("sélectionne exactement les ids fournis", () => {
    expect([...selectAllRushBulk(["q1", "q2"])]).toEqual(["q1", "q2"]);
  });

  it("la purge retire les quêtes qui ne sont plus dans la liste", () => {
    const purged = pruneRushBulkSelection(new Set(["q1", "q2", "disparue"]), ["q1", "q2", "q3"]);
    expect([...purged]).toEqual(["q1", "q2"]);
  });

  it("la purge ne crée aucun id et ne mute pas l'ensemble d'origine", () => {
    const initial = new Set(["q1", "disparue"]);
    const purged = pruneRushBulkSelection(initial, ["q1", "q2"]);
    expect([...purged]).toEqual(["q1"]);
    expect([...initial]).toEqual(["q1", "disparue"]);
  });
});
