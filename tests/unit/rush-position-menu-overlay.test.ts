import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MENU = "src/components/dofus-quests/rush/RushPositionMenu.tsx";

describe("RushPositionMenu — modale dans la fenêtre de l'overlay", () => {
  it("porte dans le document du nœud, jamais dans la page principale", () => {
    const src = readFileSync(MENU, "utf8");
    expect(src).toContain("ownerDocument");
    expect(src).toContain("doc.body");
    expect(src).not.toContain("document.body");
  });

  it("propose le zaap + trajet quand la position en a un", () => {
    const src = readFileSync(MENU, "utf8");
    expect(src).toContain("Zaap + trajet");
    expect(src).toContain("/zaap ");
    expect(src).toContain("/travel ");
  });

  it("résout le zaap à l'ouverture avec la règle DPLN (tactile et PiP, sans survol)", () => {
    // La puce de l'overlay est tactile et vit dans la PiP : le minuteur de survol
    // de `RushCoordinateChip` n'y passe jamais. La modale calcule elle-même,
    // avec la liste DPLN — jamais `zaaps.json` (39 zaaps ≠ 37 DPLN).
    const src = readFileSync(MENU, "utf8");
    expect(src).toContain("allowZaap");
    expect(src).toContain("dplnNearestZaap");
    expect(src).not.toContain("resolveMapWorldAction");
  });
});
