/**
 * Icônes de succès — **jamais un trophée par accident**.
 *
 * 📏 Mesure du 23/10/2026 (captures user : « Nomade », « Trio », « En ligne de mire » en
 * trophée gris dans la création DJ, le détail ET la clôture) : un seul candidat d'URL était
 * tenté. Une valeur nulle, pré-résolue, ou un 404 en cache suffisait à figer le repli.
 *
 * 🔒 Verrouillé ici : la liste des candidats (stocké → asset local du slug), sa déduplication,
 * et le fait qu'une valeur morte laisse une **seconde** chance à l'asset local.
 */
import { describe, it, expect } from "vitest";
import { achievementIconCandidates } from "@/lib/achievement-icon";
import { normalizeChallengeIconUrl } from "@/lib/dofus-image-url";

describe("achievementIconCandidates", () => {
    it("valeurs identiques (stocké = asset local) ⇒ un seul candidat", () => {
        expect(achievementIconCandidates("/game-data/achievements/nomade.png", "nomade"))
            .toEqual(["/game-data/achievements/nomade.png"]);
    });

    it("sans valeur stockée, l'asset local du slug prend le relais", () => {
        expect(achievementIconCandidates(null, "trio")).toEqual(["/game-data/achievements/trio.png"]);
        expect(achievementIconCandidates(undefined, "en-ligne-de-mire"))
            .toEqual(["/game-data/achievements/en-ligne-de-mire.png"]);
    });

    it("une valeur morte laisse une SECONDE chance (asset local du slug)", () => {
        const candidates = achievementIconCandidates("/game-data/achievements/mort.webp", "nomade");
        expect(candidates[0]).toBe("/game-data/achievements/mort.webp");
        expect(candidates[1]).toBe("/game-data/achievements/nomade.png");
    });

    it("rien à essayer ⇒ liste vide (l'appelant rend le glyphe de repli)", () => {
        expect(achievementIconCandidates(null, null)).toEqual([]);
        expect(achievementIconCandidates("", "")).toEqual([]);
    });

    it("un chemin accentué vise l'asset ASCII jumeau", () => {
        expect(achievementIconCandidates("/game-data/achievements/spécial.png", "sp-cial")[0])
            .toBe("/game-data/achievements/special.png");
    });

    it("la normalisation des icônes de défi ne perd plus un chemin local accentué", () => {
        // Mesure du 23/10/2026 : la valeur ressortait `null`, donc aucune icône.
        expect(normalizeChallengeIconUrl("/game-data/achievements/spécial.png"))
            .toBe("/game-data/achievements/special.png");
        expect(normalizeChallengeIconUrl("/game-data/achievements/nomade.png"))
            .toBe("/game-data/achievements/nomade.png");
        expect(normalizeChallengeIconUrl(null)).toBeNull();
    });
});