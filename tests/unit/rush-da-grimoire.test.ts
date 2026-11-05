/**
 * Garde — DA « Grimoire Sylvestre » (lot T-4).
 *
 * 🎯 Demande user (02/11/2026) : une direction artistique de **grimoire** (cadre
 * ouvragé, or vieilli, états rouge/vert) reprise de la maquette d'overlay, mais
 * **sans** les défauts anti-slop du legacy : verre, ombres diffuses, `font-black`,
 * dégradés, animations gratuites.
 *
 * 🛡️ Ce que ce verrou tient (règles UI de `docs/RULES.md`) :
 *  • en-tête et barre de chapitre : plus de `font-black`, de dégradé, de verre,
 *    d'ombre diffuse, de `animate-pulse` ni de `drop-shadow` ;
 *  • le titre est en **serif** et l'accent de la jauge est l'**or** (`bg-gold`) ;
 *  • chaque mouvement porte `motion-reduce` (O15) ;
 *  • aucun rayon > 12 px (`rounded-2xl`/`rounded-3xl`) sur les fichiers de la DA.
 *
 * Lecture seule : aucun rendu navigateur, aucune base.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const HEADER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader.tsx";
const CHAPTER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayChapterBar.tsx";
const SHELL = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";

const codeOf = (path: string) => readFileSync(path, "utf8");

const SLOP = /bg-gradient|backdrop-blur|\bshadow-2xl\b|drop-shadow|\bfont-black\b|animate-pulse/;

describe("DA « Grimoire Sylvestre » — en-tête", () => {
    it("le titre est un serif d'or souligné d'un filet, pas un `font-black`", () => {
        const src = codeOf(HEADER);
        // DA « Gouache Wakfu » : le titre se scinde comme la maquette —
        // premier mot en surtitre espacé, le reste en grand condensé.
        expect(src).toMatch(/<h1 className="da-logo">/);
        expect(src).toMatch(/className="da-logo-a"/);
        expect(src).toMatch(/className="da-logo-b"/);
    });

    it("aucun slop : ni dégradé, ni verre, ni ombre diffuse, ni `font-black`", () => {
        expect(codeOf(HEADER)).not.toMatch(SLOP);
    });

    it("la jauge globale est un trait d'or à losange et respecte `motion-reduce`", () => {
        const src = codeOf(HEADER);
        expect(src).toMatch(/h-\[2px\] w-full overflow-hidden rounded-full bg-elevated/);
        expect(src).toMatch(/bg-gold transition-\[width\] duration-150 ease-out motion-reduce:transition-none/);
        expect(src).toMatch(/rotate-45 bg-gold/);
    });
});

describe("DA « Grimoire Sylvestre » — barre de chapitre", () => {
    it("les jetons de thème remplacent les couleurs codées en dur", () => {
        const src = codeOf(CHAPTER);
        // DA « Gouache Wakfu » : la barre de chapitre est le dock de la maquette
        // — sa matière vient de `.da-dock`, donc d'un jeton, jamais d'un hex.
        expect(src).toContain("da-dock");
        expect(src).not.toMatch(/bg-\[#0d1014\]|bg-\[#181c22\]|bg-\[#161b21\]/);
    });

    it("aucun slop dans la barre ni son sélecteur", () => {
        expect(codeOf(CHAPTER)).not.toMatch(SLOP);
    });

    it("le titre du chapitre suit le dock et la jauge en or", () => {
        const src = codeOf(CHAPTER);
        // DA « Gouache Wakfu » : le titre vit dans `.da-dock-label` (13 px condensé,
        // jamais tronqué) — la taille et la fonte sont des jetons, pas du Tailwind.
        expect(src).toMatch(/da-dock-label/);
        expect(src).not.toMatch(/truncate text-left font-serif text-\[12px\]/);
        expect(src).toMatch(/bg-gold transition-\[width\][^"]*motion-reduce/);
    });
});

describe("DA « Grimoire Sylvestre » — cadre", () => {
    it("la coque suit les jetons et pose un seul filet de reliure", () => {
        const src = codeOf(SHELL);
        expect(src).toMatch(/rush-overlay[^`]*bg-background text-foreground/);
        expect(src).toMatch(/absolute inset-0 border border-border-strong\/60/);
    });

    it("aucun rayon > 12 px dans les fichiers de la DA", () => {
        for (const path of [HEADER, CHAPTER, SHELL]) {
            expect(codeOf(path), path).not.toMatch(/rounded-(2xl|3xl)/);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Matières : les blocs, la carte de quête et les deux modales suivent la même DA.
// ─────────────────────────────────────────────────────────────────────────────
const BANNER = "src/components/dofus-quests/rush/RushInfoBanner.tsx";
const SEQUENCE = "src/components/dofus-quests/rush/RushInfoSequenceBanner.tsx";
const CARD = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx";
const DETAIL = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal.tsx";
const ALIGN = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayAlignmentModal.tsx";
const SEARCH = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlaySearch.tsx";
const RESOURCES = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayResourcesModal.tsx";
const FOOTER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayFooter.tsx";
const PREREQ = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayPrereqModal.tsx";
const POPOVER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonPopover.tsx";

describe("DA « Carnet de campagne » — blocs de conseil", () => {
    it("un seul panneau de matière, plus de dégradé ni d'emoji", () => {
        for (const path of [BANNER, SEQUENCE]) {
            const src = codeOf(path);
            expect(src, path).toContain("rush-carnet");
            expect(src, path).toContain('data-tone={tone.tone}');
            expect(src, path).not.toMatch(/bg-gradient/);
            expect(src, path).not.toMatch(/[⚠📖🔮💡]/u);
        }
    });

    it("le registre est sémantique (danger / or / jade), jamais une teinte arbitraire", () => {
        const src = codeOf(BANNER);
        expect(src).toMatch(/attention:\s*"bg-danger"/);
        expect(src).toMatch(/info:\s*"bg-gold"/);
        expect(src).toMatch(/conseil:\s*"bg-success"/);
    });
});

describe("DA « Carnet de campagne » — carte de quête verrouillée", () => {
    it("un filet terre cuite à gauche remplace le cadre rouge complet", () => {
        const src = codeOf(CARD);
        // DA « Gouache Wakfu » : l'état est porté par un attribut et peint par
        // `src/app/da-wakfu.css`. Depuis E1e, la première quête ni validée ni
        // verrouillée porte `next` (nœud accentué) — même règle que « Reprendre ».
        expect(src).toMatch(/data-state=\{isDone \? "done" : isLocked \? "locked" : isNext \? "next" : "todo"\}/);
        expect(src).not.toMatch(/border-danger\/30 bg-danger\//);
    });

    it("un seul cadenas dans la ligne (la case d'état)", () => {
        const src = codeOf(CARD);
        expect(src.match(/pictos\/verrou\.png/g)?.length ?? 0).toBe(1);
    });

    it("le blocage nomme le prérequis au lieu d'un texte générique", () => {
        const src = codeOf(CARD);
        expect(src).toContain("Terminer :");
        expect(src).toContain("prereqs[0].name");
        expect(src).not.toContain("Quête à terminer avant");
    });

    it("le repère n'est plus rendu sur une quête verrouillée", () => {
        expect(codeOf(CARD)).toMatch(/\{!isLocked && \(/);
    });
});

describe("DA « Carnet de campagne » — fiche de quête et alignement", () => {
    it("la fiche a un titre serif, un filet d'or et les conseils en filet", () => {
        const src = codeOf(DETAIL);
        expect(src).toMatch(/font-serif text-\[16px\] font-semibold/);
        expect(src).toMatch(/border-l-2 border-l-gold\/70/);
        // Anatomie « Gouache Wakfu » depuis le 05/11/2026 : la fiche ne porte plus
        // le cadre du carnet (`.rush-carnet`), elle prend la matière de la modale
        // de la DA et reçoit sa portée de jetons — elle sort de l'arbre.
        expect(src).toMatch(/da-modal da-portal/);
        expect(src).toMatch(/\{\.\.\.daScope\}/);
    });

    it("la modale d'alignement ne force plus une hauteur pleine (fin du vide)", () => {
        const src = codeOf(ALIGN);
        expect(src).not.toMatch(/flex h-full max-h-full/);
        expect(src).toMatch(/rush-carnet relative z-10 flex max-h-full/);
    });
});

describe("DA « Carnet de campagne » — recherche", () => {
    it("la recherche est une plaque de carnet, sans palette legacy", () => {
        const src = codeOf(SEARCH);
        expect(src).toContain("da-search");
        expect(src).not.toMatch(/bg-\[#|text-\[#|border-\[#/);
    });
});

describe("DA « Carnet de campagne » — ressources à prévoir", () => {
    it("la modale overlay suit le carnet, sans verre ni ombre diffuse", () => {
        const src = codeOf(RESOURCES);
        expect(src).toContain("rush-carnet");
        expect(src).not.toMatch(/backdrop-blur|rounded-2xl|shadow-2xl/);
        expect(src).not.toMatch(/bg-\[#|text-\[#|border-\[#/);
    });

    it("le titre est serif et les quantités passent à l'or", () => {
        const src = codeOf(RESOURCES);
        expect(src).toMatch(/font-serif text-foreground/);
        expect(src).toMatch(/font-mono text-gold/);
    });
});

describe("DA « Carnet de campagne » — navigation et portails", () => {
    it("le footer suit les jetons (plus de palette legacy)", () => {
        const src = codeOf(FOOTER);
        expect(src).toMatch(/border-t border-border-strong bg-surface/);
        // « Suivant » est l'action principale : bouton planche accentué.
        expect(src).toMatch(/data-variant="main"/);
        expect(src).not.toMatch(/bg-\[#|text-\[#|border-\[#/);
    });

    it("les portails portent la classe de jetons du carnet", () => {
        for (const path of [PREREQ, POPOVER]) {
            const src = codeOf(path);
            expect(src, path).toContain("rush-carnet-theme");
            expect(src, path).toContain("rush-carnet");
            expect(src, path).not.toMatch(/rounded-2xl|backdrop-blur|shadow-2xl/);
        }
    });

    it("aucun rayon > 12 px sur la navigation et les portails", () => {
        for (const path of [FOOTER, PREREQ, POPOVER]) {
            expect(codeOf(path), path).not.toMatch(/rounded-(2xl|3xl)/);
        }
    });
});

describe("DA « Carnet de campagne » — jetons de matière", () => {
    it("l'overlay a sa propre palette (vert forêt / ivoire / bronze / ambre) dans les deux thèmes", () => {
        const css = readFileSync("src/app/globals.css", "utf8");
        expect(css).toMatch(/\.rush-overlay,\s*\.rush-carnet-theme \{[\s\S]*?--background: oklch\(0\.155 0\.014 155\)/);
        expect(css).toMatch(/--sigil-gold: oklch\(0\.76 0\.12 78\)/);
        expect(css).toMatch(/\.rush-overlay\.light,\s*\.rush-carnet-theme\.light \{[\s\S]*?--background: oklch\(0\.96 0\.012 90\)/);
        expect(css).toContain(".rush-carnet-frame");
    });
});
