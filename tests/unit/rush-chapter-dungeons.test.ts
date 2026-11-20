import { describe, expect, it } from "vitest";

import {
    mergeRushChapterDungeons,
    rushDungeonBaseKey,
} from "@/lib/rush-chapter-dungeons";

/**
 * « Donjons à prévoir » affichait deux fois le même donjon : la version normale
 * et la variante « (niv. 50) », cette dernière sans image (picto de repli).
 * Mesure du 20/11/2026, capture God du chapitre.
 */

describe("rushDungeonBaseKey", () => {
    it("retire la variante de niveau et normalise la casse", () => {
        expect(rushDungeonBaseKey("Donjon des Bworks (niv. 50)")).toBe("donjon des bworks");
        expect(rushDungeonBaseKey("Donjon des Bworks")).toBe("donjon des bworks");
        expect(rushDungeonBaseKey("  Donjon des Forgerons (niveau 50) ")).toBe(
            "donjon des forgerons"
        );
    });

    it("laisse un donjon sans variante intact", () => {
        expect(rushDungeonBaseKey("Gelaxième dimension")).toBe("gelaxième dimension");
    });
});

describe("mergeRushChapterDungeons", () => {
    it("fusionne le donjon et sa variante « (niv. 50) »", () => {
        const merged = mergeRushChapterDungeons([
            { id: "a", name: "Donjon des Bworks", imageUrl: "/bworks.png", bossName: "Bworkette" },
            { id: "b", name: "Donjon des Bworks (niv. 50)" },
        ]);

        expect(merged).toHaveLength(1);
        expect(merged[0]).toEqual({
            id: "a",
            name: "Donjon des Bworks",
            imageUrl: "/bworks.png",
            bossName: "Bworkette",
        });
    });

    it("garde l'image même si la variante arrive en premier", () => {
        const merged = mergeRushChapterDungeons([
            { id: "b", name: "Donjon des Bworks (niv. 50)" },
            { id: "a", name: "Donjon des Bworks", imageUrl: "/bworks.png" },
        ]);

        expect(merged).toHaveLength(1);
        expect(merged[0].name).toBe("Donjon des Bworks");
        expect(merged[0].imageUrl).toBe("/bworks.png");
    });

    it("ne fusionne pas deux donjons différents", () => {
        const merged = mergeRushChapterDungeons([
            { name: "Donjon des Bworks" },
            { name: "Donjon des Larves" },
        ]);
        expect(merged.map((d) => d.name)).toEqual(["Donjon des Bworks", "Donjon des Larves"]);
    });

    it("trie par nom et ignore un libellé vide", () => {
        const merged = mergeRushChapterDungeons([
            { name: "Gelaxième dimension" },
            { name: "   " },
            { name: "Donjon des Forgerons" },
        ]);
        expect(merged.map((d) => d.name)).toEqual(["Donjon des Forgerons", "Gelaxième dimension"]);
    });
});
