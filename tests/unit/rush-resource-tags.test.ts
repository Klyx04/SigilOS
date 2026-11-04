/**
 * Fusion additive des ressources d'une quête — règle pure (`src/lib/rush-resource-tags.ts`).
 *
 * Verrouille le comportement qui permet de remplir les quêtes Brâkmarien sans casser l'existant :
 * on AJOUTE les objets absents, on ne réécrit ni ne supprime jamais un tag (éditions God), et un
 * id déjà présent garde SON nom — la clé `id|nom` de `rushResourceKey` reste donc unique.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mergeItemTags, rushItemId } from "@/lib/rush-resource-tags";

const ROOT = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

describe("rushItemId — un id DofusDB exploitable", () => {
  it("accepte un entier positif, refuse tout le reste", () => {
    expect(rushItemId(594)).toBe(594);
    expect(rushItemId("6736")).toBe(6736);
    // Kamas : id synthétique du guide, il doit passer.
    expect(rushItemId(10000000001)).toBe(10000000001);
    expect(rushItemId(0)).toBeNull();
    expect(rushItemId(-3)).toBeNull();
    expect(rushItemId("")).toBeNull();
    expect(rushItemId(null)).toBeNull();
    expect(rushItemId(Number.NaN)).toBeNull();
    expect(rushItemId(12.5)).toBeNull();
  });
});

describe("mergeItemTags — ajouter sans jamais écraser", () => {
  it("ajoute un objet absent avec son id, son nom et sa quantité", () => {
    const { tags, added } = mergeItemTags([], [{ id: 594, name: "Edelweiss", count: 40 }]);
    expect(added).toEqual([{ type: "item", id: 594, name: "Edelweiss", count: 40 }]);
    expect(tags).toEqual(added);
  });

  it("ne réécrit pas un objet déjà présent (le nom et la quantité du guide gagnent)", () => {
    const existing = [{ type: "item", id: 594, name: "Edelweiss (guide)", count: 12 }];
    const { tags, added } = mergeItemTags(existing, [{ id: 594, name: "Edelweiss", count: 40 }]);
    expect(added).toEqual([]);
    expect(tags).toEqual(existing);
  });

  it("réutilise le nom canonique pour un id déjà affiché ailleurs", () => {
    const canonicalNames = new Map([["594", "Edelweiss"]]);
    const { added } = mergeItemTags([], [{ id: 594, name: "Edelweiss d'hiver", count: 2 }], { canonicalNames });
    expect(added[0].name).toBe("Edelweiss");
  });

  it("ignore un id absent ou invalide et les compte", () => {
    const { tags, added, skipped } = mergeItemTags(
      [],
      [{ id: null, name: "Sans id" }, { id: 0, name: "Zéro" }, { id: 594, name: "Edelweiss" }],
    );
    expect(added).toHaveLength(1);
    expect(skipped).toBe(2);
    expect(tags).toHaveLength(1);
  });

  it("ignore un nom vide et retombe sur une quantité de 1", () => {
    const { added, skipped } = mergeItemTags(
      [],
      [{ id: 594, name: "   ", count: 3 }, { id: 6736, name: "Bourgeon", count: 0 }, { id: 6737, name: "Sans quantité" }],
    );
    expect(skipped).toBe(1);
    expect(added).toEqual([
      { type: "item", id: 6736, name: "Bourgeon", count: 1 },
      { type: "item", id: 6737, name: "Sans quantité", count: 1 },
    ]);
  });

  it("borne la liste sans jamais retirer un tag existant", () => {
    const existing = [
      { type: "item", id: 1, name: "Un" },
      { type: "item", id: 2, name: "Deux" },
    ];
    const { tags, added, skipped } = mergeItemTags(
      existing,
      [{ id: 3, name: "Trois" }, { id: 4, name: "Quatre" }],
      { maxTags: 3 },
    );
    expect(tags.map((tag) => tag.id)).toEqual([1, 2, 3]);
    expect(added).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it("préserve les autres tags et leur ordre", () => {
    const existing = [
      { type: "donjon", name: "Tanière du Meulou" },
      { type: "item", id: 594, name: "Edelweiss", count: 4 },
      { type: "pos_tags", name: "Incarnam" },
    ];
    const { tags } = mergeItemTags(existing, [{ id: 6736, name: "Bourgeon", count: 2 }]);
    expect(tags.slice(0, 3)).toEqual(existing);
    expect(tags[3]).toEqual({ type: "item", id: 6736, name: "Bourgeon", count: 2 });
  });

  it("est idempotent : le 2ᵉ passage n'ajoute rien", () => {
    const incoming = [{ id: 594, name: "Edelweiss", count: 40 }];
    const first = mergeItemTags([], incoming);
    const second = mergeItemTags(first.tags, incoming);
    expect(first.added).toHaveLength(1);
    expect(second.added).toHaveLength(0);
    expect(second.tags).toEqual(first.tags);
  });
});

describe("le script d'enrichissement ne peut pas détruire un tag", () => {
  const SCRIPT = "scripts/enrich-rush-guide-resources.ts";

  it("passe par la règle pure et écrit seulement sous --apply", () => {
    const source = read(SCRIPT);
    expect(source).toContain('from "../src/lib/rush-resource-tags"');
    expect(source).toContain("mergeItemTags(");
    expect(source).toContain('argv.includes("--apply")');
  });

  it("remappe l'id fautif mesuré 22058 vers 32079 (ne réintroduit jamais l'id invalide)", () => {
    // Même table que `scripts/fix-rush-guide-item-ids.mjs` : la trame porte encore 22058.
    expect(read(SCRIPT)).toContain("[[22058, 32079]]");
  });

  it("ne retire que sur demande explicite et whiteliste le Kamas synthétique", () => {
    const source = read(SCRIPT);
    expect(source).toContain('argv.includes("--prune-unknown")');
    expect(source).toContain('valueOf("--drop-ids", "")');
    expect(source).toContain("new Set<number>([10000000001])");
    // Un id absent du catalogue n'a pas d'icône fiable (l'API renvoie l'item de repli 666).
    expect(source).toContain("db.gameItem.findMany");
    expect(source).toContain("isKnownItem(id)");
  });

  it("ne supprime ni ne remplace en masse (jamais de re-seed, jamais d'écrasement)", () => {
    const source = read(SCRIPT);
    expect(source).not.toContain("deleteMany");
    expect(source).not.toContain("activityTags = []");
    expect(source).not.toContain("seedRushSylvestre");
  });
});
