import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushOverlayHeader } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader";
import { RushOverlayChapterBar } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayChapterBar";
import { RushOverlayToolbar } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayToolbar";

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

describe("overlay tight — dock et toolbar", () => {
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
