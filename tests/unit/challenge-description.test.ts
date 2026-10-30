/**
 * Texte d'un succès **côté écran** (A5 bis du 30/10/2026).
 *
 * Mesure : 3 donjons (`dechireuse`, `blop-indigo-royal`, `dramak`) affichaient encore le gabarit
 * du seed « Vaincre tel boss dans son donjon en validant le challenge dédié. » alors que le vrai
 * succès existe chez DofusDB. Tant que la donnée n'est pas résolue, l'écran doit le **dire**.
 */

import { describe, it, expect } from "vitest";
import {
    PLACEHOLDER_CHALLENGE_DESCRIPTION,
    displayAchievementDescription,
    isPlaceholderChallengeDescription,
} from "@/lib/challenge-description";

describe("description d'un succès — jamais un gabarit déguisé en mécanique", () => {
    it("reconnaît le gabarit du seed, quelle que soit la casse", () => {
        expect(isPlaceholderChallengeDescription(PLACEHOLDER_CHALLENGE_DESCRIPTION)).toBe(true);
        expect(isPlaceholderChallengeDescription("Vaincre Tel Boss dans son donjon en validant le challenge Compagnon.")).toBe(true);
        expect(isPlaceholderChallengeDescription("À partir du tour 2, Mob l'éponge doit être poussé.")).toBe(false);
        expect(isPlaceholderChallengeDescription(null)).toBe(false);
    });

    it("le succès « Spécial » encore au gabarit dit qu'il n'est pas documenté", () => {
        expect(
            displayAchievementDescription({ description: PLACEHOLDER_CHALLENGE_DESCRIPTION, slug: "sp-cial" })
        ).toBe("Mécanique non documentée pour ce donjon.");
    });

    it("une vraie mécanique passe telle quelle, même sur le succès « Spécial »", () => {
        const reelle = "Les invocations ennemies ne doivent subir aucun dommage.";
        expect(displayAchievementDescription({ description: reelle, slug: "sp-cial" })).toBe(reelle);
    });

    it("une description vide reste vide (l'appelant décide de la suite)", () => {
        expect(displayAchievementDescription({ description: null, slug: "sp-cial" })).toBeNull();
        expect(displayAchievementDescription({ description: "   ", slug: "trio" })).toBeNull();
    });

    it("hors « Spécial », le texte est rendu sans réécriture", () => {
        expect(displayAchievementDescription({ description: "Vaincre le boss sans mourir.", slug: "trio" }))
            .toBe("Vaincre le boss sans mourir.");
    });
});
