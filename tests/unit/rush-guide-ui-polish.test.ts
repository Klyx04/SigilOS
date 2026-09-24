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

/**
 * Guide public — retours user du 22/09/2026 (2 correctifs, dont une cause mesurée) :
 *
 *  1. **« le scroll cache le composant de droite »** : la barre de contrôle était collante
 *     (`sticky top-16 z-30`) et faisait **337 px** de haut. Mesuré au navigateur
 *     (1291×712) : 337 px de barre + 596 px de rail pour 712 px de viewport ⇒ la barre
 *     recouvrait le rail (`elementFromPoint` au sommet du rail = un bouton de la barre),
 *     et le rail sortait de l'écran dès `scrollY ≈ 1140` (course collante = hauteur de
 *     rangée 880 − hauteur de rail 596). Le panneau défile donc avec la page, et c'est le
 *     rail qui reste affiché — borné au viewport (616 px disponibles sous l'en-tête
 *     public) avec défilement interne, sinon sa fin (objets requis) restait hors écran.
 *  2. **« vire le sommaire inutile »** : le `<details>` « Sommaire — N chapitres »
 *     doublonnait le rail (liste des chapitres, avancement « n/N », clic = navigation) et
 *     le pager haut/bas.
 */
describe("guide public — le rail de droite reste affiché au scroll (retour user 22/09)", () => {
    it("la barre de contrôle n'est plus collante (elle recouvrait le rail)", () => {
        const code = codeOf(PUBLIC);
        expect(code).not.toContain("sticky top-16 z-30");
        expect(code).toContain('<div className="mb-8 reg-panel bg-background p-4 sm:p-5 space-y-4">');
    });

    it("le rail est collant, borné au viewport et défilable en interne", () => {
        expect(codeOf(PUBLIC)).toContain(
            'className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto custom-scrollbar"'
        );
    });

    it("le sommaire repliable est supprimé (les ancres partageables restent)", () => {
        const code = codeOf(PUBLIC);
        expect(code).not.toContain("group/som");
        expect(code).not.toContain("Sommaire —");
        expect(code).toContain("id={`bloc-${ms.id}`}");
    });
});
