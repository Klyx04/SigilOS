import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DARK_SURFACE,
  LIGHT_SURFACE,
  MIN_CONTRAST,
  bestTextOn,
  contrastRatio,
  mixHex,
  parseHex,
  readableEverywhere,
  readableOn,
  relativeLuminance,
  toHex,
} from "@/lib/rush-dofus-accent";
import { RUSH_DOFUS_META } from "@/lib/rush-dofus-meta";

/**
 * Garde du contraste des accents Dofus (T-4 / O14). La couleur **canonique** est
 * arbitrée ailleurs (`rush-dofus-meta`) : ici on vérifie qu'elle reste **lisible**
 * sur le thème clair comme sur le thème sombre, sans changer la teinte.
 */
describe("rush-dofus-accent — mathématiques WCAG", () => {
  it("lit et écrit un hexadécimal, et refuse le reste", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("709030")).toEqual([112, 144, 48]);
    expect(parseHex("#70")).toBeNull();
    expect(parseHex("rouge")).toBeNull();
    expect(toHex([112, 144, 48])).toBe("#709030");
  });

  it("donne les ancres WCAG connues", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("mélange deux couleurs et reste dans les bornes", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#000000", "#ffffff", 7)).toBe("#ffffff");
  });
});

describe("rush-dofus-accent — lisibilité des accents", () => {
  it("laisse passer un accent déjà lisible", () => {
    const accent = readableOn("#f59e0b", DARK_SURFACE);
    expect(accent.adjusted).toBe(false);
    expect(accent.color).toBe("#f59e0b");
    expect(accent.ratio).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("éclaircit un accent sombre sur fond sombre (Ébène) et assombrit Ivoire sur fond clair", () => {
    const ebene = readableOn("#52525b", DARK_SURFACE);
    expect(ebene.adjusted).toBe(true);
    expect(ebene.ratio).toBeGreaterThanOrEqual(MIN_CONTRAST);

    const ivoire = readableOn("#e2e8f0", LIGHT_SURFACE);
    expect(ivoire.adjusted).toBe(true);
    expect(ivoire.ratio).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("ne devine rien : une valeur illisible est rendue telle quelle", () => {
    expect(readableOn("pas-une-couleur")).toEqual({ color: "pas-une-couleur", ratio: 0, adjusted: false });
  });

  it("choisit le texte lisible sur un aplat", () => {
    expect(bestTextOn("#f59e0b")).toBe("#000000");
    expect(bestTextOn("#52525b")).toBe("#ffffff");
  });

  it("les 24 accents du référentiel atteignent 4,5:1 dans les deux thèmes", () => {
    for (const dofus of RUSH_DOFUS_META) {
      const dark = readableOn(dofus.color, DARK_SURFACE);
      const light = readableOn(dofus.color, LIGHT_SURFACE);
      expect(dark.ratio, `${dofus.id} sur fond sombre`).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(light.ratio, `${dofus.id} sur fond clair`).toBeGreaterThanOrEqual(MIN_CONTRAST);

      // `readableEverywhere` retient la contrainte la plus forte : elle doit passer aussi.
      const both = readableEverywhere(dofus.color);
      expect(both.ratio, `${dofus.id} dans les deux thèmes`).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
});

/** T2 — le filtre Dofus est un bouton : son état doit être **annoncé**, pas seulement peint. */
describe("rush-dofus-accent — état accessible du filtre Dofus (T2)", () => {
  const strip = readFileSync(
    path.join(process.cwd(), "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/DofusProgressStrip.tsx"),
    "utf8"
  );

  it("expose aria-pressed et un libellé explicite sur chaque bouton de Dofus", () => {
    expect(strip).toContain("aria-pressed={isActive}");
    expect(strip).toMatch(/aria-label=\{`Filtrer sur le Dofus/);
  });
});
