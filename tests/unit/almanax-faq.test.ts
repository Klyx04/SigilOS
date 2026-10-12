import { describe, it, expect } from "vitest";
import { ALMANAX_FAQ } from "@/lib/almanax-faq";

/**
 * La FAQ `/almanax` alimente deux sorties qui doivent rester alignées : la
 * section visible « Questions fréquentes » (`.reg-faq`) et le JSON-LD `FAQPage`.
 * Une liste vide produirait un balisage `FAQPage` sans `mainEntity`, une réponse
 * vide un `acceptedAnswer.text` invalide — d'où ces garde-fous structurels.
 */
describe("almanax-faq — source unique de la FAQ /almanax", () => {
    it("n'est jamais vide", () => {
        expect(ALMANAX_FAQ.length).toBeGreaterThan(0);
    });

    it("porte une question et une réponse non vides pour chaque entrée", () => {
        for (const item of ALMANAX_FAQ) {
            expect(item.q.trim()).not.toBe("");
            expect(item.a.trim()).not.toBe("");
            expect(item.q).toBe(item.q.trim());
            expect(item.a).toBe(item.a.trim());
        }
    });

    it("n'a pas de question dupliquée", () => {
        const questions = ALMANAX_FAQ.map((item) => item.q);
        expect(new Set(questions).size).toBe(questions.length);
    });

    it("reste du texte brut, injectable tel quel dans le JSON-LD", () => {
        // `acceptedAnswer.text` de schema.org attend du texte, pas du balisage :
        // une balise en dur ferait échouer les validateurs de données structurées.
        for (const item of ALMANAX_FAQ) {
            expect(item.q).not.toMatch(/[<>]/);
            expect(item.a).not.toMatch(/[<>]/);
        }
    });
});
