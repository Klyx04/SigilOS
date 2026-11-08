/**
 * Overlay — finitions **V2f** (F8 → F11), brief du 08/11/2026.
 *
 * Quatre demandes du mainteneur, et pour chacune ce que la mesure avait établi :
 *
 *  • **F8** — « Rush Sylvestre » et « Graine » sont redondants. Mesuré : « Graine »
 *    n'était pas un libellé écrit dans le bandeau, c'était le **palier 0** de
 *    `rush-dofus-stage` affiché par la frise ; le titre venait de `guideName`.
 *    Les deux partent, le `h1` reste masqué (un en-tête sans titre n'en est plus un).
 *  • **F9** — le « rappel » sous Toutes / En cours / Faites / Verrouillées est
 *    `.da-banner` : il redisait le titre du chapitre (dock) et son avancement
 *    (dock + jauge). La description du bloc, elle, reste — c'est la seule à dire
 *    ce que le chapitre regroupe.
 *  • **F10** — le thème vivait dans `localStorage`, lu dans un `useEffect` : un
 *    premier cadre sombre était peint avant la bascule. Un *layout effect* corrige ça.
 *  • **F11** — le panneau était monté **dans** `<header class="da-hero">`
 *    (`position: relative; overflow: hidden`) : il passait sous le contenu quel que
 *    soit son `z-index`. Il est monté par l'hôte, en fin de racine, et porte le lien
 *    du Discord support.
 *
 * Lecture seule : aucun rendu navigateur, aucune base.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const HEADER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader.tsx";
const SHELL = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const PANEL = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayFeedbackPanel.tsx";
const STAGE_MODULE = "src/lib/rush-dofus-stage.ts";
const STAGE_TEST = "tests/unit/rush-dofus-stage.test.ts";

const read = (path: string) => readFileSync(path, "utf8");

describe("F8 — le bandeau ne répète plus ni le nom du guide ni « Graine »", () => {
    it("le titre visible et la frise de stades ont quitté l'en-tête", () => {
        const header = read(HEADER);
        expect(header).not.toMatch(/className="da-logo"/);
        expect(header).not.toMatch(/da-stage|da-pips/);
        // ... mais l'en-tête garde un titre pour les lecteurs d'écran.
        expect(header).toMatch(/<h1 className="sr-only">\{guideName\}<\/h1>/);
    });

    it("la règle de stade n'est pas laissée en code mort", () => {
        // Décision produit : la frise disparaît. Le module n'avait plus aucun
        // consommateur — le garder avec son test aurait été du code mort verdi.
        expect(existsSync(STAGE_MODULE)).toBe(false);
        expect(existsSync(STAGE_TEST)).toBe(false);
    });
});

describe("F9 — le rappel sous les filtres est retiré, la description reste", () => {
    it("le shell ne monte plus de bandeau de bloc", () => {
        const shell = read(SHELL);
        expect(shell).not.toMatch(/da-banner/);
        expect(shell).not.toMatch(/currentMsDoneCount/);
        expect(shell).not.toMatch(/bannerArt/);
    });

    it("la description du bloc, elle, est conservée", () => {
        expect(read(SHELL)).toMatch(/className="da-blockdesc"/);
    });
});

describe("F10 — le thème clair est posé avant la peinture", () => {
    it("la lecture de `localStorage` passe par un layout effect", () => {
        const shell = read(SHELL);
        expect(shell).toMatch(/const useIsomorphicLayoutEffect\s*=/);
        expect(shell).toMatch(/useIsomorphicLayoutEffect\(\(\) => \{[\s\S]{0,200}sigil_overlay_theme/);
    });
});

describe("F11 — la fenêtre de retour passe devant et mène au support", () => {
    it("le panneau est monté par l'hôte, plus dans l'en-tête", () => {
        expect(read(HEADER)).not.toMatch(/RushOverlayFeedbackPanel/);
        expect(read(SHELL)).toMatch(/<RushOverlayFeedbackPanel/);
    });

    it("l'en-tête ouvre le panneau par un callback, sans état local", () => {
        const header = read(HEADER);
        expect(header).toMatch(/onOpenFeedback\?: \(\) => void/);
        expect(header).not.toMatch(/feedbackOpen/);
    });

    it("le panneau porte le lien du Discord support", () => {
        const panel = read(PANEL);
        expect(panel).toMatch(/NEXT_PUBLIC_DISCORD_INVITE_URL/);
        expect(panel).toMatch(/Rejoindre le Discord support/);
    });
});