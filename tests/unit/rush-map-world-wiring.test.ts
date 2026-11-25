import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Câblage de la carte Rush — les trois maillons qui cassaient le « bon monde » :
 *  - le proxy doit laisser un **visiteur non connecté** lire la carte HD ;
 *  - la puce doit transmettre le `worldId` du `pos_tags` au menu **et** au zaap ;
 *  - les listes (dashboard, guide public) doivent fournir ce `worldId`.
 *
 * Ces assertions lisent la source : elles protègent un câblage JSX que les tests
 * purs (`rush-map-at-url`, `rush-map-at-route`) ne peuvent pas voir.
 */
const read = (path: string) => readFileSync(path, "utf8");

describe("carte Rush — accès visiteur et bon monde", () => {
  it("le proxy autorise la lecture de la carte HD sans session", () => {
    const proxy = read("src/proxy.ts");
    expect(proxy).toContain('nextUrl.pathname.startsWith("/api/rush/map-at")');
  });

  it("la puce transmet le monde au menu et au calcul du zaap", () => {
    const chip = read("src/components/dofus-quests/rush/RushCoordinateChip.tsx");
    expect(chip).toContain("worldId={resolvedWorldId");
    // 25/11/2026 — le zaap du guide est calculé avec la liste DPLN exacte (pure),
    // jamais avec `resolveMapWorldAction` (zaaps.json, 39 en monde 1 ≠ 37 DPLN).
    expect(chip).toContain("dplnNearestZaap(parsed.x, parsed.y, resolvedWorldId");
  });

  it("les listes passent le worldId du pos_tags à la puce", () => {
    const dashboard = read(
      "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx"
    );
    expect(dashboard).toContain("worldId={coord.worldId ?? null}");
    expect(dashboard).toContain("worldId={headerCoord.worldId ?? null}");

    const publicGuide = read(
      "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx"
    );
    expect(publicGuide).toContain("worldId={parsedCoord.worldId ?? null}");
  });

  it("l'overlay ne monte pas de carte mais garde le bon monde pour le zaap", () => {
    const item = read(
      "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx"
    );
    expect(item).toContain("worldId={parsedCoord.worldId ?? null}");

    const detail = read(
      "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal.tsx"
    );
    expect(detail).toContain("worldId={coord.worldId ?? null}");
    // Décision du 22/11/2026 : pas de carte ni de pion dans la PiP.
    expect(detail).not.toContain("<RushPositionMenu");
  });
});
