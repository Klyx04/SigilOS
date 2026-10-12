/**
 * Import d'une page HTML dans la documentation — le format attendu, noir sur blanc.
 *
 * Demande user du 10/12/2026 : « j'aimerais pouvoir importer des pages html directement de
 * documentation bien formatée etc comme celle-ci ». Le bouton « Importer un .html » du God
 * (`src/app/god/docs/_components/doc-editor.tsx`) attend donc un fichier **déjà mis en forme**
 * (du HTML sémantique, pas du Markdown) ; ce test fige ce contrat sur l'exemple qui a servi à
 * écrire la fiche « songes ».
 *
 * 🧹 Hygiène : ce sample vivait dans `public/` (donc **servi en production**) sous le nom
 * `__songes-doc-import.html`, et son propre `<title>` disait « IMPORT TEMPORAIRE (à supprimer
 * après collage) ». Il est désormais une **fixture** versionnée, hors du dossier public.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FIXTURE = "tests/fixtures/songes-doc-exemple.html";
const html = () => readFileSync(FIXTURE, "utf8");

describe("sample d'import HTML (fixture)", () => {
    it("reste hors de `public/` : un artefact de collage ne se sert pas en prod", () => {
        expect(existsSync("public/__songes-doc-import.html")).toBe(false);
        expect(existsSync(FIXTURE)).toBe(true);
    });

    it("porte le HTML sémantique que l'éditeur attend (titres + paragraphes)", () => {
        const content = html();
        expect(content).toContain("<body>");
        expect(content).toMatch(/<h2>/);
        expect(content).toMatch(/<p>/);
        // L'import ne garde que le corps : rien à jeter (script/style/link/meta) dans un sample propre.
        expect(content).not.toMatch(/<script/i);
    });

    it("a bien servi à écrire la fiche « songes » du catalogue", () => {
        const titles = html().match(/<h2>([^<]+)<\/h2>/g) ?? [];
        expect(titles.length).toBeGreaterThanOrEqual(3);
    });
});
