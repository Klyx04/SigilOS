import { describe, expect, it } from "vitest";
import { nextFocusIndex } from "@/lib/focus-trap";

describe("nextFocusIndex — piege a focus d une modale", () => {
  it("avance et revient au debut a la fin", () => {
    expect(nextFocusIndex(0, 3, false)).toBe(1);
    expect(nextFocusIndex(2, 3, false)).toBe(0);
  });

  it("recule et revient a la fin au debut", () => {
    expect(nextFocusIndex(0, 3, true)).toBe(2);
    expect(nextFocusIndex(1, 3, true)).toBe(0);
  });

  it("place le focus quand il est hors liste", () => {
    expect(nextFocusIndex(-1, 3, false)).toBe(0);
    expect(nextFocusIndex(-1, 3, true)).toBe(2);
  });

  it("ne rend aucun index sur une liste vide", () => {
    expect(nextFocusIndex(0, 0, false)).toBe(-1);
  });
});