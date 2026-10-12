import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getAllGuides, getPublishedGuides, getGuideBySlug } from "@/content/guides";

/**
 * SEO — un guide en BROUILLON n'est jamais servi par son URL directe (constat du 24/09/2026).
 *
 * `getGuideContent()` ne filtre pas les brouillons : sans garde, un slug en `draft: true` rendait
 * son corps complet en **200**, protégé par la seule balise `noindex`. C'est insuffisant — un
 * `noindex` n'empêche ni la lecture ni la copie, il laisse seulement l'URL au catalogue de Google.
 * La garde vit dans `src/app/guides/[slug]/page.tsx` (même endroit que la résolution du slug).
 *
 * Aujourd'hui les 7 guides du registre sont publiés : c'est un risque **latent**, verrouillé ici
 * pour qu'il ne devienne pas réel le jour où un brouillon sera ajouté.
 */
const PAGE = "src/app/guides/[slug]/page.tsx";
const page = () => readFileSync(PAGE, "utf8");

describe("guide brouillon — jamais servi (vraie 404)", () => {
    it("`draft` fait partie de la condition de 404 (pas seulement des métadonnées)", () => {
        const src = page();
        expect(src).toMatch(/notFound\(\)/);
        expect(src).toMatch(/if \(!meta \|\| !content \|\| meta\.draft\)/);
    });

    it("les métadonnées d'un brouillon restent en noindex (2ᵉ ceinture)", () => {
        expect(page()).toMatch(/guide\.draft\s*\?\s*\{ index: false/);
    });

    it("le registre ne publie aucun brouillon et ignore un slug inconnu", () => {
        expect(getPublishedGuides().every((g) => !g.draft)).toBe(true);

        // Si un brouillon est ajouté un jour, ces trois contrats doivent tenir.
        for (const draft of getAllGuides().filter((g) => g.draft)) {
            expect(getPublishedGuides().some((g) => g.slug === draft.slug)).toBe(false);
        }
        expect(getGuideBySlug("slug-inexistant-3f9a")).toBeNull();
    });
});
