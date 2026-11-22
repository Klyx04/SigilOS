import { describe, expect, it } from "vitest";

import { buildRushMapAtUrl } from "@/lib/rush-map-at";

/**
 * URL de la carte HD — le monde ne vit pas dans `[x,y]`.
 *
 * Mesure du 22/11/2026 : 112 positions du guide sur 527 tombent sur une case
 * présente dans plusieurs mondes. Sans `&world`, la carte peut être celle d'un
 * autre monde : l'URL est donc le contrat à verrouiller.
 */
describe("carte HD — URL de la position", () => {
  it("transmet le monde du pos_tags et la carte imposée en God", () => {
    expect(buildRushMapAtUrl({ x: -32, y: -58, worldId: 9, mapId: 5 })).toBe(
      "/api/rush/map-at?x=-32&y=-58&world=9&mapId=5"
    );
  });

  it("n'invente ni monde ni carte quand ils manquent", () => {
    expect(buildRushMapAtUrl({ x: 1, y: 2 })).toBe("/api/rush/map-at?x=1&y=2");
  });

  it("ignore un monde ou une carte invalides", () => {
    expect(buildRushMapAtUrl({ x: 1, y: 2, worldId: 0, mapId: -5 })).toBe(
      "/api/rush/map-at?x=1&y=2"
    );
  });
});
