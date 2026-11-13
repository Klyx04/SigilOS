/**
 * Gardes — **slug public d'une quête Rush** (bloc B, 12/11/2026).
 *
 * 🎯 Le slug est figé à la publication : un renommage ne doit jamais casser une URL
 * déjà indexée. Ces tests couvrent la **première** publication : accents, ponctuation,
 * noms vides et collisions entre deux quêtes homonymes.
 */

import { describe, it, expect } from "vitest";
import {
  RUSH_PUBLIC_SLUG_MAX,
  slugifyRushQuestName,
  uniqueRushPublicSlug,
} from "@/lib/rush-public-slug";

describe("slugifyRushQuestName", () => {
  it("minuscule, sans accents, séparateurs en tirets", () => {
    expect(slugifyRushQuestName("La Grande Bibliothèque")).toBe("la-grande-bibliotheque");
  });

  it("déplie les ligatures et les apostrophes", () => {
    expect(slugifyRushQuestName("Cœur Vaillant")).toBe("coeur-vaillant");
    expect(slugifyRushQuestName("L'Œil du Cyclone")).toBe("l-oeil-du-cyclone");
  });

  it("ne laisse ni tiret en tête ni tiret en queue", () => {
    expect(slugifyRushQuestName("  — Quête (test) —  ")).toBe("quete-test");
  });

  it("un nom vide ou 100 % ponctuation donne `quete`", () => {
    expect(slugifyRushQuestName("")).toBe("quete");
    expect(slugifyRushQuestName("!!! ??? ...")).toBe("quete");
  });

  it("borne la longueur", () => {
    const long = "a".repeat(RUSH_PUBLIC_SLUG_MAX + 40);
    expect(slugifyRushQuestName(long).length).toBe(RUSH_PUBLIC_SLUG_MAX);
  });
});

describe("uniqueRushPublicSlug", () => {
  it("garde le slug quand il est libre", () => {
    expect(uniqueRushPublicSlug("la-grande-bibliotheque", new Set())).toBe("la-grande-bibliotheque");
  });

  it("suffixe -2, -3… sans écraser une URL existante", () => {
    const taken = new Set(["quete", "quete-2"]);
    expect(uniqueRushPublicSlug("quete", taken)).toBe("quete-3");
  });

  it("ne confond pas `quete-2` libre avec `quete` pris", () => {
    expect(uniqueRushPublicSlug("quete-2", new Set(["quete"]))).toBe("quete-2");
  });

  it("refuse au-delà de 999 collisions (fail-closed)", () => {
    const taken = new Set(["quete", ...Array.from({ length: 998 }, (_, i) => `quete-${i + 2}`)]);
    expect(() => uniqueRushPublicSlug("quete", taken)).toThrow("Trop de collisions");
  });
});
