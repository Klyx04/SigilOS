import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * JSON-LD des fiches boss — non-régression du 21/09/2026.
 *
 * Constat de mesure : `/boss/<slug>` ne déclarait qu'un `BreadcrumbList`. Google (et les IA)
 * comprenaient la hiérarchie, pas que la page **est un contenu à lire** ⇒ ajout d'un `Article`
 * (avec `about`, `publisher`, `mainEntityOfPage`) et d'une URL canonique **unique** partagée.
 */
const PAGE = "src/app/boss/[dungeonId]/page.tsx";
const code = () => readFileSync(PAGE, "utf8");

describe("fiche boss — JSON-LD de contenu", () => {
    it("déclare un Article, en plus du fil d'Ariane", () => {
        const src = code();
        expect(src).toMatch(/"@type": "BreadcrumbList"/);
        expect(src).toMatch(/"@type": "Article"/);
        expect(src).toMatch(/about: \{ "@type": "Thing", name: bossName \}/);
        expect(src).toMatch(/publisher: \{ "@type": "Organization", name: "SigilOS"/);
        expect(src).toMatch(/mainEntityOfPage/);
    });

    it("n'a qu'UNE source d'URL canonique (fil d'Ariane + Article + og:url)", () => {
        const src = code();
        expect(src).toMatch(/const sheetUrl = /);
        // L'ancienne construction d'URL en dur dans le fil d'Ariane ne doit pas revenir.
        expect(src).not.toMatch(/item: `\$\{getAppBaseUrl\(\)\}\/boss\/\$\{canonicalSegment/);
        expect(src).toMatch(/item: sheetUrl,/);
    });

    it("décrit la fiche par un résumé court, dans la langue de la page", () => {
        const src = code();
        expect(src).toMatch(/const sheetSummary = locale === "en"/);
        expect(src).toMatch(/inLanguage: locale === "en" \? "en" : "fr"/);
    });
});
