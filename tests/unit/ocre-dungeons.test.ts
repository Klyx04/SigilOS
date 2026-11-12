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
import { getDungeons } from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";

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
        // Le badge collé sur la vignette a disparu (11/11/2026) : l'asset Ocre vit dans
        // la ligne de texte, plus sur l'image du boss.
        expect(html).not.toContain("Ocre ✓");
        expect(html).toContain('src="/assets/icons/ocre.png"');
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

describe("Donjon ocre — la colonne `Dungeon.isOcreQuest` fait foi", () => {
    const base = {
        id: "seq-1",
        subGuideRef: "GP1",
        subGuideName: "Qui botte le cul des Culs Bottés ?",
        order: 1,
        dungeon: {
            id: "dj-meulou",
            slug: "meulou",
            name: "Tanière du Meulou",
            bossName: "Meulou",
            imageUrl: null,
            isOcreQuest: true,
            isOptional: false,
        },
        activityTags: [{ type: "donjon", name: "Tanière du Meulou" }],
    } as any;

    it("un donjon `isOcreQuest` sans tag ocre reste ocre (cas Meulou mesuré le 10/11)", () => {
        expect(getDungeons(base)[0].isOcre).toBe(true);
        expect(getDungeons(base)[0].isOcreQuest).toBe(true);
    });

    it("le tag `ocre_dungeon` reste un repli quand la colonne est fausse", () => {
        const seq = {
            ...base,
            dungeon: { ...base.dungeon, isOcreQuest: false },
            activityTags: [{ type: "ocre_dungeon", name: "dj-meulou" }],
        };
        expect(getDungeons(seq)[0].isOcre).toBe(true);
    });

    it("le payload des deux surfaces sélectionne la colonne", () => {
        const actions = read("src/server/actions/optimized-guide-actions.ts");
        expect((actions.match(/isOcreQuest: true/g) ?? []).length).toBeGreaterThanOrEqual(2);
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

    it("le guide PUBLIC propose la même vue Ocre, via le pont voisin (pas la modale interne)", () => {
        const pub = read(PUBLIC);
        expect(pub).toContain("PublicOcreDungeonBridge");
        expect(pub).toContain("capturedOcreNames={capturedOcreNames}");
        expect(pub).toContain("onOpenOcre={() => setMetamobOpen(true)}");
        // La modale interne reste interdite sur le public : c'est `PublicMetamobModal` qui s'ouvre.
        expect(pub).not.toContain("RushOverlayOcreModal");
        const bridge = read("src/components/dofus-quests/rush/PublicOcreDungeonBridge.tsx");
        expect(bridge).toContain("getPublicOcreProgress");
        expect(bridge).toContain("owned > 0");
    });

    it("la fiche détail porte les deux coches, avec la même source que le panneau", () => {
        const detail = read(DETAIL);
        expect(detail).toContain("dungeonStates");
        expect(detail).toContain("onSetDungeon");
        expect(detail).toContain("sequenceId={seq.id}");
        expect(read(DASHBOARD)).toContain("dungeonStates={dungeonActions.states}");
        expect(read(OVERLAY)).toContain("dungeonStates={dungeonActions?.states}");
        expect(read(PUBLIC)).toContain("dungeonStates={dungeonStates}");
    });

    it("un tag ocre ne marque plus TOUS les donjons de la séquence", () => {
        const utils = read(UTILS);
        expect(utils).toContain("isOcreTagged");
        expect(utils).not.toContain("isOcre: !!(seq.activityTags?.some");
    });
});

