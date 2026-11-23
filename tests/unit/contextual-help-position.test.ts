/**
 * Bulles d'aide — la bulle reste **dans la fenêtre** (390/768/1024/1440).
 *
 * 🎯 Mesure du 23/11/2026 : la bulle de progression s'ouvrait en `absolute`
 * `bottom-full` et sortait de l'écran (capture user). Elle est désormais portée
 * dans le `body` en `fixed`, avec bascule haut/bas et clamp horizontal.
 */

import { describe, it, expect } from "vitest";
import {
  placeContextualHelp,
  HELP_MARGIN,
  HELP_POPOVER_WIDTH,
} from "@/lib/contextual-help-position";

const trigger = (over: Partial<{ top: number; bottom: number; left: number; width: number }>) => ({
  top: 100,
  bottom: 120,
  left: 200,
  width: 20,
  ...over,
});

const SIZE = { width: HELP_POPOVER_WIDTH, height: 120 };

describe("placeContextualHelp", () => {
  it("ouvre au-dessus quand la place le permet", () => {
    const pos = placeContextualHelp(trigger({ top: 400, bottom: 420 }), { width: 1024, height: 800 }, SIZE);
    expect(pos.placement).toBe("top");
    expect(pos.top).toBe(400 - 120 - 8);
    expect(pos.left).toBe(200 + 10 - HELP_POPOVER_WIDTH / 2);
    expect(pos.width).toBe(HELP_POPOVER_WIDTH);
  });

  it("bascule en dessous quand le haut manque", () => {
    const pos = placeContextualHelp(trigger({ top: 20, bottom: 40 }), { width: 390, height: 800 }, SIZE);
    expect(pos.placement).toBe("bottom");
    expect(pos.top).toBe(48);
  });

  it("ramène la bulle dans la fenêtre à gauche et à droite", () => {
    const left = placeContextualHelp(trigger({ left: 0 }), { width: 390, height: 800 }, SIZE);
    expect(left.left).toBe(HELP_MARGIN);
    expect(left.arrowLeft).toBeGreaterThanOrEqual(12);

    const right = placeContextualHelp(trigger({ left: 370 }), { width: 390, height: 800 }, SIZE);
    expect(right.left).toBe(390 - HELP_POPOVER_WIDTH - HELP_MARGIN);
    expect(right.left + right.width).toBeLessThanOrEqual(390 - HELP_MARGIN);
    expect(right.arrowLeft).toBe(right.width - 20);
  });

  it("borne la hauteur d'une bulle plus haute que la fenêtre", () => {
    const pos = placeContextualHelp(
      trigger({ top: 10, bottom: 30 }),
      { width: 390, height: 400 },
      { width: HELP_POPOVER_WIDTH, height: 700 }
    );
    expect(pos.maxHeight).toBe(400 - HELP_MARGIN * 2);
    expect(pos.top).toBe(HELP_MARGIN);
  });

  it("plafonne la largeur et la hauteur à la fenêtre", () => {
    const pos = placeContextualHelp(trigger({}), { width: 200, height: 160 }, SIZE);
    expect(pos.width).toBe(200 - HELP_MARGIN * 2);
    expect(pos.maxHeight).toBe(160 - HELP_MARGIN * 2);
    expect(pos.top).toBeGreaterThanOrEqual(HELP_MARGIN);
  });

  it("ne déborde jamais aux quatre largeurs du dépôt", () => {
    for (const width of [390, 768, 1024, 1440]) {
      for (const left of [0, width - 20]) {
        const pos = placeContextualHelp(
          trigger({ top: 10, bottom: 30, left }),
          { width, height: 800 },
          SIZE
        );
        expect(pos.left).toBeGreaterThanOrEqual(HELP_MARGIN);
        expect(pos.left + pos.width).toBeLessThanOrEqual(width - HELP_MARGIN);
        expect(pos.top).toBeGreaterThanOrEqual(HELP_MARGIN);
        expect(pos.top + Math.min(SIZE.height, pos.maxHeight)).toBeLessThanOrEqual(800 - HELP_MARGIN);
      }
    }
  });
});
