/**
 * Typographie des pages publiques — le scope `.registre` doit RÉELLEMENT s'appliquer.
 *
 * Constat user du 10/12/2026 : « les polices des gros titres dans les pages sont très
 * reconnaissables du vibe coding IA je ne sais pas comment l'expliquer ».
 *
 * Mesure : les pages publiques portent `className="registre … font-sans …"` sur le MÊME élément
 * (`almanax`, `auth/error`, `auth/signout`, `bestiaire`, `boss`, …). Or `font-sans`
 * (couche `utilities`) gagne sur `.registre` (couche `components`) et vaut `--font-sans`, c'est-à-dire
 * **Inter** — la police de hero des templates IA. `--font-heading` vaut **Space Grotesk**, l'autre
 * cliché. Le bloc `.registre` annonçait pourtant « remplace la typographie héritée
 * (Inter / Space Grotesk) par Source Sans 3 + IBM Plex Mono » : il ne le faisait pas.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");
const CSS = "src/app/globals.css";

describe("typographie publique — Source Sans 3, pas Inter / Space Grotesk", () => {
    it("le scope `.registre` réaligne `font-sans` ET `font-heading` sur Source Sans 3", () => {
        const css = read(CSS);
        const start = css.indexOf("@layer components {");
        expect(start).toBeGreaterThan(-1);
        const scope = css.slice(start, css.indexOf("html:has(.registre)", start));
        expect(scope).toContain("--font-sans: var(--font-source-sans)");
        expect(scope).toContain("--font-heading: var(--font-source-sans)");
        // Et la police de base du scope reste Source Sans 3.
        expect(scope).toContain("font-family: var(--font-source-sans)");
    });

    it("les pages publiques portent bien `registre` ET `font-sans` ensemble (la raison du réalignement)", () => {
        // Si un jour les wrappers lâchent `font-sans`, ce test le dira : le correctif devient inutile
        // le jour où plus personne n'écrase la variable dans le scope.
        const page = read("src/app/almanax/page.tsx");
        expect(page).toContain('className="registre');
        expect(page).toMatch(/className="registre[^"]*font-sans/);
    });

    it("le titre de hero ne porte plus la recette « template IA » (tracking serré + interligne 1.06)", () => {
        const hero = read("src/components/landing/registre/hero.tsx");
        expect(hero).not.toContain("tracking-tight");
        expect(hero).not.toContain("leading-[1.06]");
        expect(hero).toContain("tracking-[-0.012em]");
    });
});
