import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dplnNearestZaap } from "@/lib/dpln-zaap";

/**
 * Verrou « iso dofuspourlesnoobs » (25/11/2026).
 *
 * DPLN calcule le zaap avec SA liste de 37 zaaps (`autopilotage.js`), pas avec
 * `public/game-data/zaaps.json` (39 en monde 1, dont Bonta `[-32,-56]`).
 * Ces cas figent la différence : sans eux, un retour au calcul générique ferait
 * proposer un autre zaap que le bouton DPLN sur la même quête.
 */
describe("dplnNearestZaap — règle DPLN exacte", () => {
  it("L'épée maudite [-25,33] → zaap [-26,37] (5 maps), pas le [-26,35] de zaaps.json", () => {
    expect(dplnNearestZaap(-25, 33)).toMatchObject({ x: -26, y: 37, distance: 5, sameWorld: true });
  });

  it("Bonta [-32,-57] → [-31,-56], pas le [-32,-56] de zaaps.json", () => {
    expect(dplnNearestZaap(-32, -57)).toMatchObject({ x: -31, y: -56, distance: 2 });
  });

  it("hors monde 1 : aucun zaap proposé (la commande ne traverserait pas)", () => {
    expect(dplnNearestZaap(-25, 33, 2)?.sameWorld).toBe(false);
    expect(dplnNearestZaap(-25, 33, 1)?.sameWorld).toBe(true);
    expect(dplnNearestZaap(-25, 33, null)?.sameWorld).toBe(true);
  });

  it("coordonnée inexploitable : jamais de zaap inventé", () => {
    expect(dplnNearestZaap(Number.NaN, 1)).toBeNull();
    expect(dplnNearestZaap(1.5, 2)).toBeNull();
  });

  it("la puce et le menu utilisent la règle DPLN, jamais le worldmap", () => {
    for (const path of [
      "src/components/dofus-quests/rush/RushCoordinateChip.tsx",
      "src/components/dofus-quests/rush/RushPositionMenu.tsx",
    ]) {
      const src = readFileSync(path, "utf8");
      expect(src, path).toContain("dplnNearestZaap");
      expect(src, path).not.toContain("resolveMapWorldAction");
    }
  });
});
