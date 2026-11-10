/**
 * V-H — Donjon ocre « capturé / à capturer » : verrou de la règle pure.
 *
 * Deux familles d'assertions :
 *  1. la **normalisation** des noms (accents, casse, article « Donjon du/de la/des/d' ») ;
 *  2. la **décision** : capturé seulement sur une correspondance exacte, `unknown` sans
 *     capture (compte non lié) — jamais un faux « à capturer ».
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeOcreDungeonName, ocreDungeonCapture } from "@/lib/ocre-dungeons";
import { RushOverlayDungeonCard } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonCard";

const read = (path: string) => readFileSync(path, "utf8");

describe("Donjon ocre — nom normalisé", () => {
    it("retire l'article du donjon, les accents et la casse", () => {
        expect(normalizeOcreDungeonName("Donjon du Bouftou Royal")).toBe("bouftou royal");
        expect(normalizeOcreDungeonName("Donjon de la Cour du Bouftou")).toBe("cour du bouftou");
        expect(normalizeOcreDungeonName("Donjon des Blops")).toBe("blops");
        expect(normalizeOcreDungeonName("Donjon d'Écaflip")).toBe("ecaflip");
        expect(normalizeOcreDungeonName("  BOUFTOU   Royal ")).toBe("bouftou royal");
    });

    it("retire « Donjon » même sans article", () => {
        expect(normalizeOcreDungeonName("Donjon Bouftou")).toBe("bouftou");
    });
});

describe("Donjon ocre — la décision ne ment jamais", () => {
    it("capturé quand le boss du donjon est dans les captures", () => {
        expect(
            ocreDungeonCapture(
                { name: "Donjon du Bouftou Royal", bossName: "Bouftou Royal" },
                ["Bouftou Royal"]
            )
        ).toBe("captured");
    });

    it("le nom du donjon sert de repli quand le boss n'est pas nommé", () => {
        expect(ocreDungeonCapture({ name: "Donjon des Blops" }, ["Blops"])).toBe("captured");
    });

    it("à capturer quand aucune capture ne correspond", () => {
        expect(
            ocreDungeonCapture(
                { name: "Donjon du Bouftou Royal", bossName: "Bouftou Royal" },
                ["Blop Coco Royal"]
            )
        ).toBe("to-capture");
    });

    it("ne confond pas un monstre avec son variant (comparaison exacte, pas includes)", () => {
        expect(
            ocreDungeonCapture({ name: "Donjon du Bouftou", bossName: "Bouftou" }, [
                "Bouftou Royal",
            ])
        ).toBe("to-capture");
    });

    it("unknown sans capture (compte non lié) ou sans identité", () => {
        expect(ocreDungeonCapture({ name: "Donjon du Bouftou Royal" }, [])).toBe("unknown");
        expect(ocreDungeonCapture({ name: "Donjon du Bouftou Royal" }, null)).toBe("unknown");
        expect(ocreDungeonCapture({}, ["Bouftou Royal"])).toBe("unknown");
    });
});

describe("Donjon ocre — le rendu dit l'état et l'action", () => {
    const html = renderToStaticMarkup(
        React.createElement(RushOverlayDungeonCard, {
            dungeons: [
                {
                    id: "dj-bouftou",
                    name: "Donjon du Bouftou Royal",
                    bossName: "Bouftou Royal",
                    imageUrl: undefined,
                    isOcre: true,
                },
            ],
            guildId: "public",
            capturedOcreNames: ["Bouftou Royal"],
            onOpenOcre: () => {},
        })
    );

    it("affiche « Ocre : capturé » et le bouton qui ouvre le suivi", () => {
        expect(html).toContain("Ocre : capturé");
        expect(html).toContain("Ocre ✓");
        expect(html).toContain("déjà capturé — ouvrir le suivi");
        expect(html).toContain("Quête Ocre");
    });

    it("sans capture connue, n'invente pas « à capturer »", () => {
        const unknown = renderToStaticMarkup(
            React.createElement(RushOverlayDungeonCard, {
                dungeons: [
                    {
                        id: "dj-bouftou",
                        name: "Donjon du Bouftou Royal",
                        bossName: "Bouftou Royal",
                        imageUrl: undefined,
                        isOcre: true,
                    },
                ],
                guildId: "public",
                capturedOcreNames: [],
                onOpenOcre: () => {},
            })
        );
        expect(unknown).not.toContain("Ocre : à capturer");
        expect(unknown).not.toContain("reste à capturer");
        expect(unknown).not.toContain("à capturer — ouvrir le suivi");
    });
});

describe("Donjon ocre — câblage des surfaces (V-H)", () => {
    const CARD = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonCard.tsx";
    const PANEL = "src/components/dofus-quests/rush/RushQuestDungeonsPanel.tsx";
    const POPOVER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonPopover.tsx";
    const DETAIL = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal.tsx";
    const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
    const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
    const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
    const UTILS = "src/app/overlay/guide/[guildId]/[slug]/components/overlay-utils.ts";

    it("la carte partagée applique la règle pure et porte les deux props", () => {
        const card = read(CARD);
        expect(card).toContain("ocreDungeonCapture(");
        expect(card).toContain("capturedOcreNames");
        expect(card).toContain("onOpenOcre");
    });

    it("le panneau, la popover et la fiche détail transmettent l'état et l'action", () => {
        for (const path of [PANEL, POPOVER, DETAIL]) {
            const code = read(path);
            expect(code, path).toContain("capturedOcreNames");
            expect(code, path).toContain("onOpenOcre");
        }
    });

    it("le dashboard alimente la carte avec les captures du membre et ouvre la modale Ocre", () => {
        const dash = read(DASHBOARD);
        expect(dash).toContain("capturedOcreNames={capturedMonsterNames}");
        expect(dash).toContain("onOpenOcre={onOpenOcre}");
        expect(dash).toContain("OpenOcreCtx");
        expect(dash).toContain("setOcreModalOpen(true)");
    });

    it("l'overlay dérive les captures du payload Ocre déjà chargé, sans appel réseau", () => {
        const overlay = read(OVERLAY);
        expect(overlay).toContain("ocre?.monsters");
        expect(overlay).toContain("capturedOcreNames={capturedOcreNames}");
        expect(overlay).toContain("onOpenOcre={openOcre}");
    });

    it("le guide PUBLIC ne reçoit jamais l'action Ocre", () => {
        const pub = read(PUBLIC);
        expect(pub).not.toContain("capturedOcreNames");
        expect(pub).not.toContain("onOpenOcre");
    });

    it("un tag ocre ne marque plus TOUS les donjons de la séquence", () => {
        const utils = read(UTILS);
        expect(utils).toContain("isOcreTagged");
        expect(utils).not.toContain("isOcre: !!(seq.activityTags?.some");
    });
});

