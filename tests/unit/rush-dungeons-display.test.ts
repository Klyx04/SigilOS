import { describe, expect, it } from "vitest";

import { dungeonDisplayState } from "@/lib/rush-dungeons";

describe("dungeonDisplayState — affichage « À faire » par défaut", () => {
  it("lit l'absence de décision comme « À faire », sans écrire d'état", () => {
    expect(dungeonDisplayState(null)).toBe("todo");
    expect(dungeonDisplayState(undefined)).toBe("todo");
    expect(dungeonDisplayState("todo")).toBe("todo");
  });

  it("laisse « Fait » tel quel", () => {
    expect(dungeonDisplayState("done")).toBe("done");
  });
});
