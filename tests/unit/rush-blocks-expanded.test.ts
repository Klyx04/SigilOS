import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Retour du 20/11/2026 : « de base dans les guides navigateurs les blocs
 * soient dépliés, c'est chiant de devoir déplier chaque fois les quêtes ».
 *
 * Les deux surfaces doivent démarrer **tous les blocs ouverts** : le public
 * (`expandedMs` initialisé avec tous les ids) et l'interne (`MilestoneRow`
 * commence à `true`). Le pliage manuel reste possible.
 */

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

const PUBLIC = read("src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx");
const INTERNAL = read(
  "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx"
);

describe("blocs dépliés par défaut", () => {
  it("le guide public ouvre tous les blocs : premier rendu, reset et restauration", () => {
    const allOpen = PUBLIC.match(/new Set\(milestones\.map\(\(ms\) => ms\.id\)\)/g) ?? [];
    expect(allOpen).toHaveLength(3);
    // Plus aucun état initial limité au premier bloc.
    expect(PUBLIC).not.toContain("milestones[0]?.id");
  });

  it("le guide interne démarre chaque bloc ouvert", () => {
    expect(INTERNAL).toContain("const [expanded,setExpanded]=useState(true);");
    expect(INTERNAL).not.toContain("const [expanded,setExpanded]=useState(false);");
  });
});
