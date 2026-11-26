import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushOverlayHeader } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader";
import { RushOverlayChapterBar } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayChapterBar";
import { RushOverlayToolbar } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayToolbar";
import { RushOverlayQuestListItem } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem";

const BASE = "src/app/overlay/guide/[guildId]/[slug]";
const HEADER = `${BASE}/components/RushOverlayHeader.tsx`;
const SHELL = `${BASE}/GuideOverlayClient.tsx`;
const DOCK = `${BASE}/components/RushOverlayChapterBar.tsx`;
const CSS = "src/app/da-wakfu.css";

const read = (path: string) => readFileSync(path, "utf8");

const CHAPTER = {
    id: "ms-3",
    chapter: 3,
    chapterLabel: "Chapitre 3",
    title: "Prérequis Dofus Sylvestre",
    isOptional: false,
    order: 3,
    type: "QUETE_SERIE",
    sequences: [
        { id: "s1", subGuideRef: "s1", subGuideName: "Balade en forêt", isOptional: false, order: 0 },
        { id: "s2", subGuideRef: "s2", subGuideName: "Les gardiens du bois", isOptional: false, order: 1 },
    ],
} as any;

const CHAPTER_2 = {
    ...CHAPTER,
    id: "ms-4",
    chapter: 4,
    title: "Chapitre suivant",
    order: 4,
    sequences: [{ id: "s3", subGuideRef: "s3", subGuideName: "La suite", isOptional: false, order: 0 }],
} as any;

const headerHtml = (narrow: boolean) =>
    renderToStaticMarkup(
        React.createElement(RushOverlayHeader, {
            guideName: "Rush Sylvestre",
            guideSlug: "rush-sylvestre",
            guildId: "public",
            dofusImageUrl: "/module-dofus/Dofus_Sylvestre.png",
            totalSteps: 397,
            completedSteps: 286,
            overallPct: 72,
            hideCompleted: false,
            onToggleHideCompleted: () => {},
            onOpenTutorial: () => {},
            isNarrow: narrow,
            onOpenSearch: () => {},
            searchOpen: false,
            onResetChapter: () => {},
            activeChapterTitle: "Prérequis Dofus Sylvestre",
        }),
    );

const dockHtml = (compact: boolean) =>
    renderToStaticMarkup(
        React.createElement(RushOverlayChapterBar, {
            chapters: [CHAPTER, CHAPTER_2],
            activeMsId: CHAPTER.id,
            onSelectChapter: () => {},
            completedMsIds: new Set<string>(),
            doneByMs: new Map([["ms-3", new Set(["s1"])]]),
            onToggleChapter: () => {},
            onResetChapter: () => {},
            onPrevChapter: () => {},
            onNextChapter: () => {},
            canPrevChapter: true,
            canNextChapter: true,
            compact,
        }),
    );

const toolbarHtml = () =>
    renderToStaticMarkup(
        React.createElement(RushOverlayToolbar, {
            filter: "all" as const,
            counts: { all: 12, active: 2, done: 8, locked: 2 },
            onFilterChange: () => {},
            onResume: () => {},
            onOpenResources: () => {},
            checked: 0,
            total: 19,
            members: [
                { name: "Alpha", avatar: null },
                { name: "Beta", avatar: null },
                { name: "Gamma", avatar: null },
            ],
            onOpenMembers: () => {},
        }),
    );

describe("overlay tight — en-tête micro", () => {
    it("descend à 34 px : œuf + % + compteur, loupe + ⋮, jauge 2 px", () => {
        const html = headerHtml(true);
        expect(html).toContain('data-density="micro"');
        expect(html).toContain("da-micro-row");
        expect(html).toContain("72 %");
        expect(html).toContain("286/397");
        expect(html).toContain('aria-label="Rechercher"');
        expect(html).toContain("da-micro-track");
        // Une seule jauge par rendu, même si la source porte deux branches.
        expect((html.match(/role="progressbar"/g) ?? []).length).toBe(1);
        // Le hero haut (métadonnées + jauge 9 px) n'est plus rendu.
        expect(html).not.toContain("da-meta");
    });

    it("le mode large garde la structure historique", () => {
        const html = headerHtml(false);
        expect(html).not.toContain('data-density="micro"');
        expect(html).toContain("da-meta");
        expect(html).toContain("da-track");
        expect((html.match(/role="progressbar"/g) ?? []).length).toBe(1);
    });

    it("le reset du bloc vit dans le menu ⋮ avec une confirmation en 2 temps", () => {
        const code = read(HEADER);
        expect(code).toContain("Réinitialiser ce bloc");
        expect(code).toContain("Confirmer le reset du bloc");
        expect(code).toContain("onResetChapter");
        expect(code).toContain("activeChapterTitle");
    });
});

describe("overlay tight — quête verrouillée", () => {
    const lockedHtml = () =>
        renderToStaticMarkup(
            React.createElement(RushOverlayQuestListItem, {
                seq: {
                    id: "s1",
                    subGuideRef: "s1",
                    subGuideName: "Chasse au trésor archéologique",
                    isOptional: false,
                    order: 0,
                } as any,
                isDone: false,
                isBookmarked: false,
                isLocked: true,
                prereqs: [
                    { seqId: "s0", milestoneId: "ms-1", name: "Comment perdre ses plumes" },
                ],
                missingDungeons: [],
                onToggle: () => {},
                onBookmark: () => {},
                onOpenDetail: () => {},
            }),
        );

    it("conserve le bandeau d'icônes, même verrouillée", () => {
        // Retour user du 26/11/2026 : « je souhaite conserver le bandeau avec les
        // icônes dans l'overlay pour les quêtes bloquées, c'est plus pratique ».
        // Le bandeau (position, donjon, succès, repère, détails) reste donc rendu.
        const html = lockedHtml();
        expect(html).toContain("Chasse au trésor archéologique");
        expect(html).toContain("Comment perdre ses plumes");
        expect(html).toContain("Détails");
        expect(html).toContain("Quête verrouillée — repère indisponible");
        expect(html).toContain("Liens de la quête");
        expect(html).toContain("Verrouillée");
    });

    it("garde la pastille donjon pour pouvoir cocher le requis", () => {
        // Bug mesuré le 26/11/2026 : en cachant tout le bandeau, la phrase
        // « Donjons requis non validés » ouvrait un panneau qui n'était plus monté.
        // La pastille donjon reste donc la seule action de la carte verrouillée.
        const html = renderToStaticMarkup(
            React.createElement(RushOverlayQuestListItem, {
                seq: {
                    id: "s2",
                    subGuideRef: "s2",
                    subGuideName: "Aventure miniature",
                    isOptional: false,
                    order: 0,
                    dungeons: [{ id: "d1", name: "Donjon des Bworks" }],
                } as any,
                isDone: false,
                isBookmarked: false,
                isLocked: true,
                prereqs: [],
                missingDungeons: [{ key: "d1", name: "Donjon des Bworks" }],
                onToggle: () => {},
                onBookmark: () => {},
                onOpenDetail: () => {},
            }),
        );
        expect(html).toContain("Aventure miniature");
        expect(html).toContain("Donjons requis non validés");
        expect(html).toContain('aria-label="Donjons de cette quête (fait / à faire)"');
    });
});

describe("overlay tight — recherche", () => {
    it("la frappe est différée et l'index de recherche est construit une fois", () => {
        // Mesure du 26/11/2026 : chaque touche rescannait tout le guide et
        // re-rendait l'overlay. `useDeferredValue` garde le champ réactif.
        const shell = read(SHELL);
        expect(shell).toContain("useDeferredValue(search)");
        expect(shell).toContain("const searchIndex = useMemo(");
        expect(shell).toContain("entry.haystack.includes(q)");
    });
});

describe("overlay tight — dock et toolbar", () => {
    it("le voile du dropdown ne vole pas la largeur du titre (backdrop fixed)", () => {
        // Bug mesuré le 26/11/2026 : `.da-dock button { position:relative; flex:1 }`
        // écrasait le `fixed` Tailwind du voile ; il devenait un flex item de ~190 px
        // et le nom du bloc était réduit à « ELI… » dès l'ouverture.
        expect(read(DOCK)).toContain("da-dock-backdrop");
        expect(read(CSS)).toContain(".da-dock button.da-dock-backdrop");
    });

    it("le dock compact garde le titre et 10/12, sans reset, sans flèches, sans 3/34", () => {
        const html = dockHtml(true);
        expect(html).toContain("Prérequis Dofus Sylvestre");
        expect(html).toContain("da-plank");
        expect(html).not.toContain("Réinitialiser");
        expect(html).not.toContain("da-dock-nav");
        expect(html).not.toContain('aria-label="Bloc 1 sur 2"');
    });

    it("le dock large garde reset + flèches + position", () => {
        const html = dockHtml(false);
        expect(html).toContain("Réinitialiser");
        expect(html).toContain("da-dock-nav");
        expect(html).toContain('aria-label="Bloc 1 sur 2"');
    });

    it("le toolbar tient filtre + Reprendre + ressources + avatars sur une rangée", () => {
        const html = toolbarHtml();
        expect(html).toContain('data-testid="rush-overlay-toolbar"');
        expect(html).toContain("Toutes");
        expect(html).toContain("Reprendre");
        expect(html).toContain("0/19");
        expect(html).toContain('data-slot="member-avatar"');
    });

    it("le client monte le toolbar en tight et garde les blocs larges sinon", () => {
        const shell = read(SHELL);
        expect(shell).toContain("<RushOverlayToolbar");
        expect(shell).toContain("isTight ? (");
        expect(shell).toContain("compact={isTight}");
        expect(shell).toContain("searchOpen");
        expect(shell).toContain("onOpenSearch");
    });

    it("la feuille DA porte le micro, le dock compact et le toolbar", () => {
        const css = read(CSS);
        expect(css).toContain('.da-hero[data-density="micro"]');
        expect(css).toContain(".da-micro-track");
        expect(css).toContain(".da-toolbar");
        expect(css).toContain('.da-window[data-compact="true"] .da-dock .da-dock-label');
    });
});
