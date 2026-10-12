/**
 * Tutoriel (tour) — verrou **BUG-7** : « les bulles du tuto sortent de l'écran et
 * les gens sont bloqués ».
 *
 * Constat : la bulle s'affichait avec son titre et sa description, mais **sans sa
 * barre de navigation** — impossible d'avancer, aucun moyen de fermer.
 *
 * Trois causes, trois verrous (même méthode que le test BUG-6 : on lit la source
 * pour qu'une régression fasse échouer la CI au lieu de bloquer les membres) :
 *   1. la mesure de la bulle ne partait **jamais** (le nœud est monté après le
 *      spotlight, et l'effet de mesure ne se relançait pas) ⇒ position calculée
 *      avec la hauteur codée en dur 180 au lieu de la hauteur réelle ;
 *   2. la bulle pouvait dépasser le bas de la fenêtre, et l'overlay racine est
 *      `overflow-hidden` ⇒ barre de navigation rognée, incliquable ;
 *   3. aucune sortie de secours ⇒ utilisateur piégé.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const TOUR_OVERLAY = "src/components/tour/tour-overlay.tsx";
const TOUR_PROVIDER = "src/components/tour/tour-provider.tsx";
const PROFILE_BENTO = "src/components/profile/profile-bento-grid.tsx";

function overlaySource(): string {
    return readFileSync(TOUR_OVERLAY, "utf8");
}

function providerSource(): string {
    return readFileSync(TOUR_PROVIDER, "utf8");
}

/** Bloc source de `setTooltipNode` (borné par sa liste de dépendances `useCallback`). */
function measureBlock(source: string): string {
    const start = source.indexOf("const setTooltipNode = useCallback(");
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("}, [measureTooltip]);", start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
}

describe("BUG-7 — la bulle du tutoriel reste dans la fenêtre", () => {
    it("mesure la bulle **au montage réel du nœud**, pas via un effet qui ne se relance jamais", () => {
        const overlay = overlaySource();
        const block = measureBlock(overlay);

        // Callback ref (monté après le spotlight) + ResizeObserver branché dessus.
        expect(block).toMatch(/tooltipRef\.current = node/);
        expect(block).toMatch(/new ResizeObserver/);
        expect(block).toMatch(/observer\.observe\(node\)/);
        expect(overlay).toMatch(/ref=\{setTooltipNode\}/);

        // L'ancien effet ne se relançait pas : sa liste de dépendances ne changeait
        // plus une fois le spotlight posé (ni mesure, ni observateur).
        expect(overlay).not.toMatch(/\}, \[isActive, activeStepData, currentStep\]\);/);
    });

    it("recadre la bulle sur les 4 bords avec sa taille **mesurée**", () => {
        const overlay = overlaySource();

        expect(overlay).toMatch(/const bubbleWidth = Math\.min\(tooltipWidth, maxWidth\)/);
        expect(overlay).toMatch(/const bubbleHeight = Math\.min\(tooltipHeight, maxHeight\)/);
        expect(overlay).toMatch(/const clampTop = \(value: number\)/);
        expect(overlay).toMatch(/const clampLeft = \(value: number\)/);
        // Toutes les positions passent par les clamps : plus aucun dépassement.
        expect(overlay).toMatch(/top: clampTop\(/);
        expect(overlay).toMatch(/left: clampLeft\(/);
        // Flip horizontal en plus du vertical (une étape `left`/`right` sans place
        // sortait de l'écran).
        expect(overlay).toMatch(/finalPlacement = "left"/);
        expect(overlay).toMatch(/finalPlacement = "right"/);
    });

    it("plafonne la largeur à la largeur de design (le `maxWidth` inline écrasait les classes)", () => {
        const overlay = overlaySource();

        // `max-width` en style inline > `max-w-[320px] sm:max-w-[340px]` : sans ce
        // plafond, la bulle prenait toute la largeur de la fenêtre (barre de 1900 px).
        expect(overlay).toMatch(/const designMaxWidth = windowSize\.width >= 640 \? 340 : 320/);
        expect(overlay).toMatch(/const maxWidth = Math\.max\(240, Math\.min\(designMaxWidth, windowSize\.width - margin \* 2\)\)/);
    });

    it("borne la hauteur de la bulle : la barre de navigation reste toujours visible", () => {
        const overlay = overlaySource();

        expect(overlay).toMatch(/const maxHeight = Math\.max\(180, windowSize\.height - margin \* 2\)/);
        // La carte est bornée…
        expect(overlay).toMatch(/style=\{\{ maxHeight \}\}/);
        // …et seule la zone de texte défile ; le pied (points + boutons) ne rétrécit pas.
        expect(overlay).toMatch(/overflow-y-auto pr-6/);
        expect(overlay).toMatch(/pt-2 border-t border-border shrink-0/);
    });

    it("offre une sortie de secours : bouton « Passer » + touche Échap", () => {
        const overlay = overlaySource();

        expect(overlay).toMatch(/onClick=\{skipTour\}/);
        expect(overlay).toMatch(/aria-label="Passer le tutoriel"/);
        expect(overlay).toMatch(/event\.key !== "Escape"/);
        expect(overlay).toMatch(/window\.addEventListener\("keydown", handleKeyDown\)/);
        expect(overlay).toMatch(/window\.removeEventListener\("keydown", handleKeyDown\)/);
        // Le bouton est placé **en haut de la carte** (top-3) et **hors** du
        // conteneur `space-y-4` : il reste donc visible et cliquable même quand le
        // texte est long (une marge `space-y` décalait sa position).
        const skipIndex = overlay.indexOf('aria-label="Passer le tutoriel"');
        const cardCloseIndex = overlay.indexOf("</motion.div>");
        expect(skipIndex).toBeGreaterThan(-1);
        expect(cardCloseIndex).toBeGreaterThan(-1);
        expect(skipIndex).toBeGreaterThan(cardCloseIndex);
        expect(overlay.slice(skipIndex, skipIndex + 400)).toMatch(/absolute top-3 right-3/);
    });

    it("expose `skipTour` dans le provider, sans écran de célébration", () => {
        const provider = providerSource();

        // Contrat du contexte (typé) + valeur réellement fournie aux consommateurs.
        const typeDeclaration = provider.indexOf("skipTour: () => void;");
        expect(typeDeclaration).toBeGreaterThan(-1);
        expect(provider.lastIndexOf('skipTour: () => void;')).toBe(typeDeclaration);
        expect(provider).toMatch(/\r?\n\s+skipTour,\r?\n/);

        const start = provider.indexOf("const skipTour = useCallback(");
        expect(start).toBeGreaterThan(-1);
        const end = provider.indexOf("}, [guildId, tourPhase]);", start);
        expect(end).toBeGreaterThan(start);
        const body = provider.slice(start, end);

        // Passer masque la bulle, nettoie la progression et marque le tour fait
        // (sinon l'auto-start relancerait le tour en boucle)…
        expect(body).toMatch(/setIsActive\(false\)/);
        expect(body).toMatch(/sigilos-tour-done-\$\{guildId\}`,\s*"true"/);
        expect(body).toMatch(/localStorage\.removeItem\(`sigilos-tour-step-\$\{guildId\}`\)/);
        // …sans confettis : passer n'est pas terminer.
        expect(body).not.toMatch(/setCelebrationActive/);
    });
});

describe("Étape « Tes préférences » — l'onglet visé est rendu visible", () => {
    it("amène l'onglet du bandeau défilable dans le cadre", () => {
        const bento = readFileSync(PROFILE_BENTO, "utf8");

        // Le bandeau est `overflow-x-auto` avec des onglets `min-w-max` : le dernier
        // onglet (« Réglages ») est hors cadre, d'où un spotlight sur du vide.
        expect(bento).toMatch(/overflow-x-auto/);
        expect(bento).toMatch(/min-w-max/);
        // L'onglet visé vient de l'étape courante du tour (aucune ancre en dur).
        expect(bento).toMatch(/if \(!target\.includes\("profile-tab-"\)\) return;/);
        expect(bento).toMatch(/tabsScrollRef\.current/);
        // On ne défile que si l'onglet n'est pas déjà entièrement visible.
        expect(bento).toMatch(/tabRect\.left >= stripRect\.left && tabRect\.right <= stripRect\.right/);
        expect(bento).toMatch(/strip\.scrollTo\(\{ left: strip\.scrollLeft \+ delta, behavior: "smooth" \}\)/);
    });
});
