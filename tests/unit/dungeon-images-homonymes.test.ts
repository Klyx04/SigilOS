/**
 * Une image de donjon appartient à un **boss**, jamais à un nom de donjon.
 *
 * 🐛 Mesure du 11/10/2026 (capture God « Donjons ») : trois entrées
 * « Protecteurs du Sanctuaire … », mêmes `name` mais boss différents (Reine Écarlate,
 * Gardien du Clos, Princesse Maudite), affichaient **la même image** — sans le moindre
 * signal à l'écran. Le modèle autorise plusieurs entrées pour un même emplacement
 * (cf. texte d'aide de la modale) : chacune doit donc porter **l'image de son boss**.
 *
 * 🔒 Ce que la garde verrouille : la détection ne dépend d'**aucune** requête ni du
 * `dofusdbId` (la liste God ne le connaît pas) — elle juge sur ce qu'elle a sous les
 * yeux. Et elle ne se déclenche **pas** sur un donjon seul, ni sur deux entrées dont
 * les images diffèrent, ni sur deux entrées de même nom **et** même boss.
 */
import { describe, expect, it } from "vitest";

import { ambiguousDungeonImageIds, type DungeonImageCandidate } from "@/lib/dungeon-image-ambiguity";

function dj(id: string, name: string, bossName: string, imageUrl?: string | null): DungeonImageCandidate {
    return { id, name, bossName, imageUrl };
}

describe("images de donjons — homonymes et boss distincts", () => {
    it("① la capture du 11/10/2026 : 3 homonymes, 3 boss, 1 seule image ⇒ les 3 sont ambiguës", () => {
        const liste = [
            dj("1", "Protecteurs du Sanctuaire", "Reine Écarlate", "/game-data/dungeons/sanctuaire.webp"),
            dj("2", "Protecteurs du Sanctuaire", "Gardien du Clos", "/game-data/dungeons/sanctuaire.webp"),
            dj("3", "Protecteurs du Sanctuaire", "Princesse Maudite", "/game-data/dungeons/sanctuaire.webp"),
        ];
        expect([...ambiguousDungeonImageIds(liste)].sort()).toEqual(["1", "2", "3"]);
    });

    it("② homonymes avec des images différentes ⇒ aucune ambiguïté (chacun la sienne)", () => {
        const liste = [
            dj("1", "Donjon du Comte Harebourg", "Comte Harebourg", "/game-data/dungeons/comte.webp"),
            dj("2", "Donjon du Comte Harebourg", "Sylargh", "/game-data/dungeons/sylargh.webp"),
        ];
        expect(ambiguousDungeonImageIds(liste).size).toBe(0);
    });

    it("③ un donjon seul, une image vide, ou deux entrées de même boss ⇒ jamais ambigu", () => {
        expect(ambiguousDungeonImageIds([dj("1", "Antre du Kralamoure", "Kralamoure Géant", "/x.webp")]).size).toBe(0);
        expect(
            ambiguousDungeonImageIds([
                dj("1", "Antre", "Boss A", null),
                dj("2", "Antre", "Boss B", null),
            ]).size,
        ).toBe(0);
        expect(
            ambiguousDungeonImageIds([
                dj("1", "Antre", "Boss A", "/x.webp"),
                dj("2", "Antre", "Boss A", "/x.webp"),
            ]).size,
        ).toBe(0);
    });

    it("④ la comparaison ignore casse et espaces superflus", () => {
        const liste = [
            dj("1", "  antre  DU kralamoure ", "Boss A", "/x.webp"),
            dj("2", "Antre du Kralamoure", "Boss B", "/x.webp"),
        ];
        expect(ambiguousDungeonImageIds(liste).size).toBe(2);
    });
});
