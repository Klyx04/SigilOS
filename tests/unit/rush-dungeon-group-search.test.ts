import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * « Chercher un groupe » — choix du donjon (26/11/2026).
 *
 * Mesure : le bouton prenait `allDungeons.find((d) => !!d.id)`, donc **toujours le
 * premier** donjon résolu, même quand la quête en exige plusieurs (Vortex + Comte
 * Harebourg). Il propose désormais un menu avec chaque donjon résolu.
 */

const DASH = readFileSync(
    path.join(
        process.cwd(),
        "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx"
    ),
    "utf8"
);

describe("chercher un groupe — choix du donjon", () => {
    it("ne prend plus systématiquement le premier donjon", () => {
        expect(DASH).not.toContain("const searchable = allDungeons.find((d) => !!d.id)");
    });

    it("liste chaque donjon résolu dans un menu", () => {
        expect(DASH).toContain("searchable.map((dungeon)");
        expect(DASH).toContain("onDungeonClick(dungeon.id as string, questName)");
        expect(DASH).toContain("Chercher un groupe pour un donjon de cette quête");
        expect(DASH).toContain("new Map(");
    });
});
