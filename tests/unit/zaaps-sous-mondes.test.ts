/**
 * Garde — zaaps des **sous-mondes** : Incarnam, Château de Harebourg, Crocuzko.
 *
 * 🎯 Demande user (08/10/2026) : « zaap à ajouter dans les sous monde » — Incarnam (Pâturages
 * 2,-5 · Route des âmes -1,-3 **et 4,-3** · Cimetière 3,0), Château de Harebourg (entrée -67,-77)
 * et Crocuzko (-83,-15).
 *
 * 🔍 Mesure (vrai `worldmap.json`, pas une supposition) : la case **(-67,-77) n'existe que dans le
 * monde 12** (« Entrée du château de Harebourg », sa 616) et **(-83,-15) que dans le monde 22**
 * (« Crocuzko », sa 917). Déclarés en **monde 1**, ces deux zaaps pouvaient donc être proposés
 * comme « le plus proche » à des positions du Monde des Douze, à des dizaines de maps — le calcul
 * filtre par monde depuis `tests/unit/nearest-zaap.test.ts`. Le second zaap de la Route des âmes
 * (4,-3) manquait. **Frigost** (La Bourgade, Village enseveli) reste légitimement en monde 1.
 *
 * 🛡️ Deux niveaux : ① le fichier **servi** (`public/game-data/zaaps.json`) et son **générateur**
 * (`scripts/compile-harvest-and-zaaps.ts`) doivent dire exactement la même chose — c'est un artefact,
 * il ne doit pas dériver ; ② le **comportement réel** de `findNearestZaap` sur ces sous-mondes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { findNearestZaap, type ZaapEntry } from "@/lib/nearest-zaap";

const JSON_PATH = "public/game-data/zaaps.json";
const SCRIPT_PATH = "scripts/compile-harvest-and-zaaps.ts";

const ZAAPS = JSON.parse(readFileSync(JSON_PATH, "utf8")) as ZaapEntry[];

/** Entrées lues dans le GÉNÉRATEUR (`DOFUS_ZAAPS`), pour détecter toute dérive du fichier servi. */
const FROM_SCRIPT = [
  ...readFileSync(SCRIPT_PATH, "utf8").matchAll(
    /\{\s*id:\s*(\d+),\s*name:\s*"([^"]*)",\s*x:\s*(-?\d+),\s*y:\s*(-?\d+),\s*worldId:\s*(\d+),\s*subArea:\s*"([^"]*)"\s*\}/g
  ),
].map((m) => ({
  id: Number(m[1]),
  name: m[2],
  x: Number(m[3]),
  y: Number(m[4]),
  worldId: Number(m[5]),
  subArea: m[6],
}));

/** Zaaps servis à une case, éventuellement restreints à un monde. */
const at = (x: number, y: number, worldId?: number) =>
  ZAAPS.filter((z) => z.x === x && z.y === y && (worldId === undefined || z.worldId === worldId));

describe("zaaps — sous-mondes (Incarnam, Château de Harebourg, Crocuzko)", () => {
  it("le fichier servi dit exactement ce que son générateur écrit", () => {
    expect(FROM_SCRIPT.length).toBeGreaterThan(0);
    expect(FROM_SCRIPT).toEqual(ZAAPS);
  });

  it("aucun id en double (identifiant stable pour les consommateurs)", () => {
    expect(new Set(ZAAPS.map((z) => z.id)).size).toBe(ZAAPS.length);
  });

  it("Incarnam : les quatre positions demandées, toutes en monde 2", () => {
    const attendus = [
      [2, -5, "Pâturages"],
      [-1, -3, "Route des âmes"],
      [4, -3, "Route des âmes"],
      [3, 0, "Cimetière"],
    ] as const;
    for (const [x, y, subArea] of attendus) {
      const hits = at(x, y, 2);
      expect(hits.length, `zaap manquant en monde 2 à (${x},${y})`).toBeGreaterThan(0);
      expect(hits.map((h) => h.subArea)).toContain(subArea);
    }
  });

  it("Château de Harebourg : (-67,-77) est en monde 12, et plus en monde 1", () => {
    const chateau = at(-67, -77, 12);
    expect(chateau).toHaveLength(1);
    expect(chateau[0].subArea).toBe("Entrée du château de Harebourg");
    expect(at(-67, -77, 1)).toHaveLength(0);
  });

  it("Crocuzko : (-83,-15) est en monde 22, et plus en monde 1", () => {
    const crocuzko = at(-83, -15, 22);
    expect(crocuzko).toHaveLength(1);
    expect(crocuzko[0].subArea).toBe("Crocuzko");
    expect(at(-83, -15, 1)).toHaveLength(0);
  });

  it("Frigost reste en monde 1 (corrigé, pas cassé)", () => {
    expect(at(-78, -41, 1)).toHaveLength(1);
    expect(at(-77, -73, 1)).toHaveLength(1);
  });

  it("comportement réel : chaque sous-monde trouve SON zaap, marqué sameWorld", () => {
    const chateau = findNearestZaap(ZAAPS, { x: -66, y: -77, worldId: 12 });
    expect(chateau?.sameWorld).toBe(true);
    expect(chateau?.zaap.subArea).toBe("Entrée du château de Harebourg");

    const crocuzko = findNearestZaap(ZAAPS, { x: -82, y: -14, worldId: 22 });
    expect(crocuzko?.sameWorld).toBe(true);
    expect(crocuzko?.zaap.subArea).toBe("Crocuzko");

    const route = findNearestZaap(ZAAPS, { x: 4, y: -3, worldId: 2 });
    expect(route?.sameWorld).toBe(true);
    expect(route?.zaap.subArea).toBe("Route des âmes");
  });
});
