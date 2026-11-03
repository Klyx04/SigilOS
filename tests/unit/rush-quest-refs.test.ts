/**
 * `resolveQuestRefs` — les références de quête `&n` deviennent des noms, jamais des placeholders.
 *
 * Mesure du 03/11/2026 : 37 séquences du guide affichent « &1 » à l'écran (15 textes distincts).
 * La preuve croisée est verrouillée ici : le `&1` de « Faites &1 jusqu'à parler a Mage Ax » est la
 * quête **1989 « Restauration rapide »** — exactement ce que la source affiche.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { hasUnresolvedQuestRef, resolveQuestRefs } from "@/lib/rush-quest-refs";

/**
 * Table `&n` → nom, indexée par la **position** dans le payload Tougli (`&1` = 1ʳᵉ quête),
 * jamais par l'id DofusDB — c'est la règle mesurée le 03/11/2026.
 */
const NOMS = new Map<number, string>([
  [1, "Restauration rapide"],
  [2, "Première"],
  [3, "Deuxième"],
  [4, "Troisième"],
  [5, "Quatrième"],
]);

describe("resolveQuestRefs — une référence devient un nom de quête", () => {
  it("remplace `&1` par le nom (preuve : « Restauration rapide »)", () => {
    expect(resolveQuestRefs("💡 Faites &1 jusqu'à parler a Mage Ax", NOMS)).toBe(
      "💡 Faites Restauration rapide jusqu'à parler a Mage Ax",
    );
  });

  it("résout plusieurs références, chacune à sa place", () => {
    expect(
      resolveQuestRefs("Prenez la quête &1 qui demandera de faire &2, &3 et &4", NOMS),
    ).toBe(
      "Prenez la quête Restauration rapide qui demandera de faire Première, Deuxième et Troisième",
    );
  });

  it("lit `&10` comme la dixième quête, pas comme `&1` suivie de `0`", () => {
    const noms = new Map<number, string>([
      [1, "Un"],
      [10, "Dix"],
    ]);
    expect(resolveQuestRefs("&10 puis &1", noms)).toBe("Dix puis Un");
  });

  it("retire une référence sans nom, sans laisser de trou ni de ponctuation orpheline", () => {
    expect(resolveQuestRefs("Prenez &1 pour continuer", new Map())).toBe("Prenez pour continuer");
    expect(resolveQuestRefs("Voir &9.", new Map())).toBe("Voir.");
    expect(resolveQuestRefs("&1", new Map())).toBe("");
  });

  it("ne touche pas aux textes sans référence, ni aux liens ou positions", () => {
    const intact = "Prendre [Eternelle Moisson](https://exemple.test/x.html) en [-55,15] + /travel -55,15";
    expect(resolveQuestRefs(intact, NOMS)).toBe(intact);
    expect(resolveQuestRefs("R&D et 100 % & ok", NOMS)).toBe("R&D et 100 % & ok");
  });

  it("préserve les sauts de ligne (les conseils sont des puces)", () => {
    expect(resolveQuestRefs("Ligne 1\n&1", NOMS)).toBe("Ligne 1\nRestauration rapide");
  });

  it("est idempotente : une seconde passe ne change plus rien", () => {
    const once = resolveQuestRefs("Faites &1 puis &2", NOMS);
    expect(resolveQuestRefs(once, NOMS)).toBe(once);
  });
});

describe("hasUnresolvedQuestRef — la garde d'écriture", () => {
  it("détecte une référence, même noyée dans un texte", () => {
    expect(hasUnresolvedQuestRef("Prenez &1")).toBe(true);
    expect(hasUnresolvedQuestRef("&10")).toBe(true);
  });

  it("ne signale ni un texte propre, ni un `&` isolé, ni une valeur vide", () => {
    expect(hasUnresolvedQuestRef("Restauration rapide")).toBe(false);
    expect(hasUnresolvedQuestRef("R&D & co")).toBe(false);
    expect(hasUnresolvedQuestRef(null)).toBe(false);
    expect(hasUnresolvedQuestRef("")).toBe(false);
  });
});

describe("câblage — le studio God refuse une référence non résolue", () => {
  const CODE = readFileSync("src/server/actions/optimized-guide-actions.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  it("la règle est importée et appliquée aux deux champs de conseil", () => {
    expect(CODE).toMatch(/import \{ hasUnresolvedQuestRef \} from "@\/lib\/rush-quest-refs"/);
    expect(CODE).toMatch(/\[\s*"tips",\s*data\.tips\s*\]/);
    expect(CODE).toMatch(/\[\s*"note",\s*data\.note\s*\]/);
    expect(CODE).toMatch(/if \(hasUnresolvedQuestRef\(value\)\)/);
  });
});
