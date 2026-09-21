import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Guide Rush — retours user du 21/09/2026 (3 correctifs d'interface) :
 *
 *  1. **la flèche de repli du guide public ne marchait pas** : le chapitre de la page
 *     courante était **forcé déplié** (`isExpanded = … || pagedChapterId === ms.id`), donc
 *     replier n'avait aucun effet visible. Il est maintenant déplié **à l'arrivée** sur la
 *     page (effet) et **repliable** ensuite ;
 *  2. **le bouton « mode compact » était au pied de page**, entre « Précédent » et
 *     « Suivant » : c'est un réglage d'affichage, il rejoint l'en-tête à côté du thème ;
 *  3. **l'overlay manquait d'air** : un peu de respiration entre recherche, sélecteur de
 *     chapitre et barre de chapitre.
 */
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const HEADER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader.tsx";
const FOOTER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayFooter.tsx";
const SEARCH = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlaySearch.tsx";
const TREE = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayChapterTree.tsx";

const codeOf = (p: string) => readFileSync(p, "utf8");

describe("guide public — la flèche de repli fonctionne", () => {
    it("le chapitre courant n'est plus forcé déplié", () => {
        const code = codeOf(PUBLIC);
        expect(code).not.toMatch(/expandedMs\.has\(ms\.id\) \|\| isSearching \|\| pagedChapterId === ms\.id/);
        expect(code).toMatch(/const isExpanded = isSearching \|\| expandedMs\.has\(ms\.id\);/);
    });

    it("il est déplié automatiquement à l'arrivée sur la page (jamais un chapitre replié par défaut)", () => {
        const code = codeOf(PUBLIC);
        expect(code).toMatch(/setExpandedMs\(\(prev\) => \(prev\.has\(pagedChapterId\)/);
        expect(code).toMatch(/\}, \[pagedChapterId\]\);/);
    });

    it("la flèche reste câblée sur le même bouton que le titre (clic = repli)", () => {
        const code = codeOf(PUBLIC);
        expect(code).toMatch(/onClick=\{\(\) => toggleChapter\(ms\.id\)\}/);
        expect(code).toMatch(/isExpanded && "rotate-180"/);
        expect(code).toMatch(/next\.has\(msId\) \? next\.delete\(msId\) : next\.add\(msId\)/);
    });
});

describe("overlay — le mode compact est un réglage d'affichage (en-tête, pas pied de page)", () => {
    it("l'en-tête porte le bouton, branché sur l'entrée en mode compact", () => {
        const header = codeOf(HEADER);
        expect(header).toMatch(/onEnterCompact\?: \(\) => void;/);
        expect(header).toMatch(/onClick=\{onEnterCompact\}/);
        expect(header).toMatch(/title="Mode compact"/);
        expect(codeOf(OVERLAY)).toMatch(/onEnterCompact=\{enterGameMode\}/);
    });

    it("le pied de page n'a plus AUCUN bouton de compactage", () => {
        const footer = codeOf(FOOTER);
        expect(footer).not.toMatch(/onToggleCompact/);
        expect(footer).not.toMatch(/Minimize2/);
        expect(codeOf(OVERLAY)).not.toMatch(/onToggleCompact=\{enterGameMode\}/);
        // La navigation Précédent / Suivant reste intacte.
        expect(footer).toContain("Précédent");
        expect(footer).toContain("Suivant");
    });

    it("la pile d'en-tête respire (recherche, sélecteur, barre de chapitre)", () => {
        // Renfort visuel verrouillé pour éviter un retour en arrière silencieux.
        expect(codeOf(SEARCH)).toContain("mx-3 mt-3 mb-2.5");
        expect(codeOf(TREE)).toContain("px-3 py-2.5 border-b");
        expect(codeOf(OVERLAY)).toContain("px-4 py-2.5 border-y");
    });
});
