import { describe, expect, it } from "vitest";

import { resolveRushRoute } from "@/lib/rush-route";
import type { RushMilestone } from "@/types/rush-guide-types";

/**
 * Mesure du 22/11/2026 : une bannière « Obtention Dofus » créée dans le studio
 * était bien enregistrée (arbre God : `test · 0 quêtes · hors chapitre`) mais
 * **invisible** dans le guide. Cause racine : `resolveRushRoute` ne conservait
 * que `SEPARATEUR`, `INFO` ou un bloc portant au moins une quête — les types
 * `DOFUS_OBTAINED` / `COMBAT_*` étaient supprimés côté serveur, donc sur les
 * trois surfaces (dashboard, guide public, overlay).
 */
const ms = (type: string, sequences: RushMilestone["sequences"] = []): RushMilestone =>
  ({
    id: `ms-${type}`,
    type,
    chapter: 0,
    order: 1,
    title: type,
    sequences,
  }) as unknown as RushMilestone;

describe("resolveRushRoute — bandeaux hors quête", () => {
  it("conserve la bannière Obtention Dofus, qui ne porte aucune quête", () => {
    const route = resolveRushRoute([ms("DOFUS_OBTAINED")]);
    expect(route.map((m) => m.type)).toEqual(["DOFUS_OBTAINED"]);
  });

  it("conserve les deux blocs Combat tactique et semi-tactique", () => {
    const route = resolveRushRoute([ms("COMBAT_TACTIQUE"), ms("COMBAT_SEMI_TACTIQUE")]);
    expect(route.map((m) => m.type)).toEqual(["COMBAT_TACTIQUE", "COMBAT_SEMI_TACTIQUE"]);
  });

  it("conserve les conseils et séparateurs historiques", () => {
    const route = resolveRushRoute([ms("INFO"), ms("SEPARATEUR")]);
    expect(route.map((m) => m.type)).toEqual(["INFO", "SEPARATEUR"]);
  });

  it("écarte toujours un bloc cochable resté vide", () => {
    const route = resolveRushRoute([ms("ZONE"), ms("DOFUS_OBTAINED")]);
    expect(route.map((m) => m.type)).toEqual(["DOFUS_OBTAINED"]);
  });
});
