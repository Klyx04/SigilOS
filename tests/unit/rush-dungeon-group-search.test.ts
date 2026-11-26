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

    it("ouvre une grille bento au lieu d'un dropdown vertical", () => {
        // Retour user du 26/11/2026 : au-delà de quelques donjons, la liste
        // déroulante devenait illisible. La grille garde une carte par donjon.
        expect(DASH).toContain("setDungeonSearchOpen(true)");
        expect(DASH).toContain("open={dungeonSearchOpen}");
        expect(DASH).toMatch(/grid[^"]*grid-cols-1[^"]*sm:grid-cols-2/);
    });

    it("chaque carte de la grille porte la vraie image du donjon (repli picto du jeu)", () => {
        // Le menu affichait un glyphe `DoorOpen` Lucide pour chaque donjon. On
        // affiche la vignette réelle (`imageUrl`), sinon le picto donjon du jeu —
        // jamais un glyphe d'interface.
        expect(DASH).toContain("dungeon.imageUrl");
        expect(DASH).toContain('src="/assets/dofus-ui/pictos/donjon.png"');
        expect(DASH).not.toContain("DoorOpen");
    });
});
