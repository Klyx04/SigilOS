/**
 * Seed `game-data` — les descriptions de succès ne sont jamais des gabarits.
 *
 * Mesure du 21/11/2026 : le challenge « Liberte » portait
 * `"Challenge généré automatiquement"` **dans le seed**, donc le texte s'affichait partout
 * (God, fiche interne, publique) même quand DofusDB publie la vraie mécanique. Le seed est
 * un **upsert** (`prisma/seed-data/seed.ts`) : une correction ici s'applique au déploiement.
 *
 * La description officielle de « Liberté » (DofusDB, challenge 207) est
 * « Ne pas tenter de retirer de PM ou de PO aux adversaires pendant toute la durée du combat. »
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = JSON.parse(readFileSync("prisma/seed-data/game-data.json", "utf8")) as {
    data?: { challenges?: Array<{ slug: string; name: string; description: string | null }> };
};
const challenges = seed.data?.challenges ?? [];

describe("seed game-data — descriptions de succès", () => {
    it("aucun challenge ne porte le texte générique du seed", () => {
        const generiques = challenges.filter((challenge) =>
            /challenge g[ée]n[ée]r[ée] automatiquement/i.test(challenge.description ?? ""),
        );
        expect(generiques.map((challenge) => challenge.slug)).toEqual([]);
    });

    it("« Liberté » porte la description officielle, sur ses deux entrées", () => {
        for (const slug of ["liberte", "libert"]) {
            const row = challenges.find((challenge) => challenge.slug === slug);
            expect(row, slug).toBeTruthy();
            expect(row?.description, slug).toContain("Ne pas tenter de retirer de PM ou de PO");
        }
    });
});
