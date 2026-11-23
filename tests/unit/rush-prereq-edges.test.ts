/**
 * Garde des **37 arêtes de prérequis** du checkup Rush (23/11/2026).
 *
 * 🎯 Mesure : 9 arêtes viennent de `public/game-data/quest-prerequisites.json`
 * (client), 28 de l'API DofusDB sur les quêtes hors catalogue client.
 * `626 Le pic qui glace` est requis par 2014 et 1910.
 *
 * 🛡️ Ce que ce test verrouille : le nombre et la source des arêtes, l'absence
 * d'auto-arête/doublon, la présence des 9 arêtes client dans le fichier client,
 * et les deux dépendants de 626.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RUSH_MISSING_QUEST_626, RUSH_PREREQ_EDGES } from "@/lib/rush-prereq-edges";

const CLIENT = (
  JSON.parse(
    readFileSync("public/game-data/quest-prerequisites.json", "utf8")
  ) as { quests: Array<{ questId: number; qfTargets?: number[] }> }
).quests;

describe("arêtes de prérequis du checkup", () => {
  it("contient 9 arêtes client et 28 arêtes DofusDB", () => {
    expect(RUSH_PREREQ_EDGES).toHaveLength(37);
    expect(RUSH_PREREQ_EDGES.filter((edge) => edge.source === "client")).toHaveLength(9);
    expect(RUSH_PREREQ_EDGES.filter((edge) => edge.source === "dofusdb")).toHaveLength(28);
  });

  it("ne contient ni auto-arête ni doublon", () => {
    const keys = new Set<string>();
    for (const edge of RUSH_PREREQ_EDGES) {
      expect(edge.questId).not.toBe(edge.prereqId);
      const key = `${edge.questId}>${edge.prereqId}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });

  it("les 9 arêtes client existent dans quest-prerequisites.json", () => {
    for (const edge of RUSH_PREREQ_EDGES.filter((item) => item.source === "client")) {
      const entry = CLIENT.find((row) => row.questId === edge.questId);
      expect(entry, `quête ${edge.questId}`).toBeTruthy();
      expect(entry?.qfTargets ?? []).toContain(edge.prereqId);
    }
  });

  it("626 est requis par 2014 et 1910 dans le fichier client", () => {
    expect(RUSH_MISSING_QUEST_626.id).toBe(626);
    expect([...RUSH_MISSING_QUEST_626.dependents]).toEqual([2014, 1910]);
    for (const dependent of RUSH_MISSING_QUEST_626.dependents) {
      const entry = CLIENT.find((row) => row.questId === dependent);
      expect(entry, `quête ${dependent}`).toBeTruthy();
      expect(entry?.qfTargets ?? []).toContain(626);
    }
  });
});
