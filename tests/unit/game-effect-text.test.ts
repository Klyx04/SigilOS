/**
 * Nettoyage des libellés d'effets (données Dofensive) — voir `src/lib/game-effect-text.ts`.
 *
 * Cas réel mesuré le 20/10/2026 sur la fiche du Comte Harebourg : la description affichait
 * `Dommages Eau : 7% «<span name="erosion">PV manquants du lanceur`.
 */
import { describe, expect, it } from "vitest";

import { cleanGameEffectText } from "@/lib/game-effect-text";

describe("cleanGameEffectText — effets de combat", () => {
    it("① retire la balise de variable de jeu en gardant le texte", () => {
        expect(
            cleanGameEffectText('Dommages Eau : 7% «<span name="erosion">PV manquants du lanceur')
        ).toBe("Dommages Eau : 7% «PV manquants du lanceur");
    });

    it("② retire les balises fermantes et de mise en forme", () => {
        expect(cleanGameEffectText("<b>+3 PA</b> pendant <i>1 tour</i>")).toBe("+3 PA pendant 1 tour");
    });

    it("③ décode les entités HTML et tasse les espaces", () => {
        expect(cleanGameEffectText("A&nbsp;&nbsp;B &amp; C")).toBe("A B & C");
    });

    it("④ ne fabrique jamais de contenu : non-chaîne ou vide ⇒ chaîne vide", () => {
        expect(cleanGameEffectText(null)).toBe("");
        expect(cleanGameEffectText(undefined)).toBe("");
        expect(cleanGameEffectText(42)).toBe("");
        expect(cleanGameEffectText("   ")).toBe("");
    });
});
