import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Temps réel de la progression (fiche Dofus + bandeau).
 *
 * `guildProgress` est une **prop serveur** : le WebSocket ne nourrissait que le
 * ticker d'activité, donc valider une quête ne changeait ni le bandeau ni la fiche.
 * Le correctif déclenche UN rendu serveur débouncé (900 ms) :
 *  · après une validation locale (quête ou bloc) ;
 *  · sur un event WS d'un autre membre (`step:validated`, `batch`, `milestone:completed`).
 * Aucun polling, aucune duplication de la logique de progression.
 */

const CODE = readFileSync(
  path.join(
    process.cwd(),
    "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx"
  ),
  "utf8"
);

describe("temps réel de la progression", () => {
  it("un refresh serveur débouncé est exposé aux handlers et aux events", () => {
    expect(CODE).toContain("const scheduleLiveRefresh = React.useCallback");
    expect(CODE).toContain("}, 900);");
    expect(CODE).toContain("router.refresh();");
  });

  it("les trois events de progression déclenchent le refresh", () => {
    expect(CODE).toContain('last.type === "step:validated"');
    expect(CODE).toContain('last.type === "step:validated:batch"');
    expect(CODE).toContain('last.type === "milestone:completed"');
  });

  it("la validation locale (quête et bloc) déclenche aussi le refresh", () => {
    const calls = CODE.match(/scheduleLiveRefresh\(\);/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });
});
