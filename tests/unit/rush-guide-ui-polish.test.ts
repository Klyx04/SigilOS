import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

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
const TREE = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayChapterBar.tsx";

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

describe("overlay — le mode compact est supprimé (retour user 07/10/2026)", () => {
    it("l'en-tête n'a plus de bouton compact et l'overlay ne connaît plus la vue de jeu", () => {
        const header = codeOf(HEADER);
        expect(header).not.toMatch(/onEnterCompact/);
        expect(header).not.toMatch(/Minimize2/);
        expect(header).not.toMatch(/title="Mode compact"/);
        const overlay = codeOf(OVERLAY);
        expect(overlay).not.toMatch(/isCompactMode/);
        expect(overlay).not.toMatch(/enterGameMode/);
        expect(overlay).not.toMatch(/RushOverlayCompact/);
    });

    it("le composant de vue jeu n'existe plus (aucun code mort)", () => {
        expect(existsSync("src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayCompact.tsx")).toBe(false);
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

    it("la pile d'en-tête respire (recherche, UNE barre de chapitre)", () => {
        // Renfort visuel verrouillé pour éviter un retour en arrière silencieux.
        expect(codeOf(SEARCH)).toContain("mx-3 mt-3 mb-2.5");
        expect(codeOf(TREE)).toContain("px-3 py-2.5 border-b");
        // Depuis le 08/10/2026, l'overlay n'a PLUS de 2ᵉ barre « chapitre courant » empilée
        // (les trois blocs qui coûtaient ~120 px sont fusionnés dans `RushOverlayChapterBar`) :
        // cette classe-là ne doit pas revenir dans le client.
        expect(codeOf(OVERLAY)).not.toContain("px-4 py-2.5 border-y");
        expect(codeOf(OVERLAY)).toContain("<RushOverlayChapterBar");
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

    it("le rail est collant, borné au scrollport et défilable en interne", () => {
        // `100dvh` (et non `100vh`) : sur mobile la barre d'URL fait varier la hauteur
        // visible — `dvh` suit la hauteur VISIBLE, `vh` la maximale (mesure du 08/10/2026).
        expect(codeOf(PUBLIC)).toContain(
            'className="xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto custom-scrollbar"'
        );
    });

    it("le sommaire repliable est supprimé (les ancres partageables restent)", () => {
        const code = codeOf(PUBLIC);
        expect(code).not.toContain("group/som");
        expect(code).not.toContain("Sommaire —");
        expect(code).toContain("id={`bloc-${ms.id}`}");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Encart « Personnage Actif » — primitives du design system, jamais de pastille
// bricolée. Retour user (08/10/2026, verbatim) : « uniformise au bon format
// dashboard les bouton main, choix du perso etc, bouton reset ai slop etc ».
// ─────────────────────────────────────────────────────────────────────────────
const DASHBOARD_RUSH = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";

describe("guide interne — encart « Personnage Actif » aligné sur le design system", () => {
    it("le statut Main/Mule n'est plus une pastille faite main : il vit dans le menu du personnage", () => {
        const code = codeOf(DASHBOARD_RUSH);
        // 26/10/2026 — le `Badge` « Main » de la rangée a été retiré à la demande du
        // propriétaire (« vire le bandeau ai slop autour du pseudo ») : le statut est
        // porté par le menu du personnage, pas par une pastille collée à côté du nom.
        expect(code).not.toMatch(/<Badge/);
        expect(code).not.toMatch(/inline-flex items-center gap-1 text-caption font-medium text-warning border/);
        expect(code).not.toMatch(/inline-flex items-center gap-1 text-caption font-medium text-info border/);
        expect(code).toMatch(/<DropdownMenuRadioItem value="PRINCIPAL"/);
    });

    it("le choix du perso est un menu (role combobox) + RadioItems, sans pastille", () => {
        const code = codeOf(DASHBOARD_RUSH);
        // Déclencheur sobre : plus de bouton à bordure qui doublait le badge.
        expect(code).toMatch(/<Button variant="ghost" size="sm" role="combobox"/);
        expect(code).toMatch(/<DropdownMenuRadioGroup value=\{selectedCharacter\} onValueChange=\{handleSelect\}>/);
        expect(code).toMatch(/<DropdownMenuRadioItem value="PRINCIPAL"/);
        // Plus d'item maison souligné en vert.
        expect(code).not.toMatch(/rounded-lg cursor-pointer transition-colors \$\{selectedCharacter/);
    });

    it("le reset est atteignable depuis le menu du personnage, et nommé", () => {
        const code = codeOf(DASHBOARD_RUSH);
        // Le gros bouton rouge de la rangée a été retiré (même demande) ; l'action
        // reste disponible, par personnage, depuis le menu.
        expect(code).toMatch(/onRequestReset/);
        expect(code).toMatch(/Réinitialiser \{?"?«? ?\{currentLabel\}/);
        expect(code).toMatch(/<RotateCcw className="size-3\.5"\/>/);
        expect(code).not.toMatch(/size="icon-sm"[\s\S]{0,200}setResetModalOpen/);
    });

    it("les appairages (pseudo, Metamob) passent par `Button` : plus de pastille ambre qui brille", () => {
        const code = codeOf(DASHBOARD_RUSH);
        // Deux appairages restants (pseudo + Metamob) : le troisième bouton de la
        // rangée était le reset, désormais dans le menu (voir cas précédent).
        expect(code.match(/variant="outline" size="sm"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(code).not.toMatch(/bg-warning\/10 hover:bg-warning\/20 px-2\.5 py-1/);
    });

    it("une seule anatomie pour les cinq blocs : asset nu 28 px, libellé 11 px (pas de `font-serif`)", () => {
        const code = codeOf(DASHBOARD_RUSH);
        expect(code).toContain('text-[11px] text-muted-foreground">Personnage actif');
        expect(code).toContain('text-[11px] text-muted-foreground">Rush Live');
        // La seule `font-serif` restante est le titre du guide (H1), pas un libellé.
        expect(code.match(/font-serif/g)?.length ?? 0).toBe(1);
        const serifLine = code.split("\n").find((line) => line.includes("font-serif"));
        expect(serifLine).toContain("<h1");
    });

    it("« Rush Live » porte un asset du jeu, pas un picto générique dans une tuile", () => {
        const code = codeOf(DASHBOARD_RUSH);
        expect(code).toContain("/assets/dofus/modules/guild.png");
        expect(code).not.toMatch(/bg-success\/15 border border-success\/30 flex items-center justify-center/);
    });
});

