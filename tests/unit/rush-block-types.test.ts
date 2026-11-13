/**
 * Gardes — **types de bloc Combat** du Rush (12/11/2026).
 *
 * 🎯 Deux blocs d'information sont ajoutés : `COMBAT_TACTIQUE` et
 * `COMBAT_SEMI_TACTIQUE`. Ils ne portent pas de quête, ne se cochent pas et ne
 * comptent pas dans la progression — exactement comme `INFO`.
 *
 * 🛡️ La règle est **unique** (`isRushInfoBlock` / `isRushNonQuestBlock`) : les
 * trois surfaces et le studio la partagent, sinon chaque écran filtrerait les
 * types à sa façon.
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import {
  RUSH_COMBAT_BLOCK_META,
  RUSH_COMBAT_BLOCK_TYPES,
  isRushCombatBlock,
  isRushInfoBlock,
  isRushNonQuestBlock,
  rushCombatBlockMeta,
} from "@/lib/rush-block-types";

describe("types Combat", () => {
  it("les deux types sont déclarés et ont une méta", () => {
    expect([...RUSH_COMBAT_BLOCK_TYPES]).toEqual(["COMBAT_TACTIQUE", "COMBAT_SEMI_TACTIQUE"]);
    expect(isRushCombatBlock("COMBAT_TACTIQUE")).toBe(true);
    expect(isRushCombatBlock("COMBAT_SEMI_TACTIQUE")).toBe(true);
    expect(isRushCombatBlock("INFO")).toBe(false);
    expect(isRushCombatBlock(null)).toBe(false);
  });

  it("chaque type porte un libellé, une image et un filet de registre", () => {
    for (const type of RUSH_COMBAT_BLOCK_TYPES) {
      const meta = RUSH_COMBAT_BLOCK_META[type];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.image.startsWith("/assets/rush/blocks/")).toBe(true);
      expect(["success", "warning"]).toContain(meta.rail);
    }
  });

  it("les illustrations par défaut existent réellement dans public/", () => {
    for (const type of RUSH_COMBAT_BLOCK_TYPES) {
      expect(existsSync(`public${RUSH_COMBAT_BLOCK_META[type].image}`)).toBe(true);
    }
  });

  it("`rushCombatBlockMeta` renvoie la bonne fiche, ou null", () => {
    expect(rushCombatBlockMeta("COMBAT_TACTIQUE")?.label).toBe("Combat tactique");
    expect(rushCombatBlockMeta("COMBAT_SEMI_TACTIQUE")?.rail).toBe("warning");
    expect(rushCombatBlockMeta("DONJON")).toBeNull();
  });
});

describe("blocs d'information et blocs non cochables", () => {
  it("INFO et les deux Combat sont des blocs d'information", () => {
    expect(isRushInfoBlock("INFO")).toBe(true);
    expect(isRushInfoBlock("COMBAT_TACTIQUE")).toBe(true);
    expect(isRushInfoBlock("COMBAT_SEMI_TACTIQUE")).toBe(true);
    expect(isRushInfoBlock("QUETE_SERIE")).toBe(false);
  });

  it("les blocs non cochables incluent séparateur et Dofus obtenu", () => {
    for (const type of ["INFO", "COMBAT_TACTIQUE", "COMBAT_SEMI_TACTIQUE", "SEPARATEUR", "DOFUS_OBTAINED"]) {
      expect(isRushNonQuestBlock(type), type).toBe(true);
    }
    for (const type of ["QUETE_SERIE", "DONJON", "PREREQUIS", "ALIGNEMENT"]) {
      expect(isRushNonQuestBlock(type), type).toBe(false);
    }
  });
});
