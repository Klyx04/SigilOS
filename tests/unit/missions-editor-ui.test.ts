/**
 * Missions — **interface de l'éditeur** (DA, responsive, accessibilité).
 *
 * 🛡️ Ce que ce test protège (revue du 17/11/2026, capture « Éditer Slot #2 ») :
 * ① les **compteurs du catalogue** viennent du JSON (`OFFICIAL_MISSIONS_TOTAL`), jamais d'un
 *    nombre écrit à la main — l'onglet **Anomalies** manquait alors que la catégorie existe ;
 * ② la **DA** : aucune palette en dur, aucun `font-black`, `backdrop-blur`, `rounded-2xl`
 *    ni ombre colorée dans les surfaces de l'éditeur ;
 * ③ le **responsive** : hauteur dynamique (`100dvh`), aucun `max-h-[92vh]`, aucune boîte
 *    défilante à hauteur fixe dans la liste, onglets qui passent à la ligne ;
 * ④ l'**accessibilité** : `aria-pressed` sur les bascules, libellé sur la recherche, et
 *    contrôles natifs remplacés par les composants maison (`Select`, `Input`).
 *
 * Lecture seule : fonctions pures + code source.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    getAllOfficialMissions,
    searchOfficialGuildMissions,
    OFFICIAL_MISSIONS_TOTAL,
    OFFICIAL_MISSION_COUNTS,
} from "@/lib/game-data/guild-missions-catalog";

const CONFIG = "src/lib/mission-config.ts";
const SEARCH = "src/components/missions/MissionOfficialSearch.tsx";
const PREVIEW = "src/components/missions/MissionLivePreview.tsx";
const EDITOR = "src/components/missions/mission-editor.tsx";

const codeOnly = (path: string) =>
    readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("missions — compteurs du catalogue (règle pure)", () => {
    it("le total et la répartition viennent du catalogue, pas d'un nombre figé", () => {
        expect(OFFICIAL_MISSIONS_TOTAL).toBe(getAllOfficialMissions().length);
        const sum = Object.values(OFFICIAL_MISSION_COUNTS).reduce((a, b) => a + b, 0);
        expect(sum).toBe(OFFICIAL_MISSIONS_TOTAL);
        expect(OFFICIAL_MISSION_COUNTS.SONGES).toBe(23);
        expect(OFFICIAL_MISSION_COUNTS.ANOMALIE).toBe(17);
        expect(OFFICIAL_MISSION_COUNTS.REGULATION).toBe(135);
    });

    it("l'onglet Anomalies est adossé à de vraies missions (17)", () => {
        expect(searchOfficialGuildMissions({ category: "ANOMALIE", limit: 100 })).toHaveLength(17);
    });
});

describe("missions — DA de l'éditeur", () => {
    it("aucune palette en dur dans la config partagée et les surfaces de l'éditeur", () => {
        for (const path of [CONFIG, SEARCH, PREVIEW, EDITOR]) {
            expect(codeOnly(path), path).not.toMatch(/-(rose|emerald|fuchsia|cyan|amber|yellow|violet|indigo)-\d{2,3}/);
        }
    });

    it("plus de font-black, backdrop-blur, rounded-2xl ni de glow coloré", () => {
        for (const path of [SEARCH, PREVIEW, EDITOR]) {
            const code = codeOnly(path);
            expect(code, path).not.toMatch(/\bfont-black\b/);
            expect(code, path).not.toContain("backdrop-blur");
            expect(code, path).not.toMatch(/rounded-2xl|rounded-3xl/);
        }
        expect(codeOnly(CONFIG)).not.toContain("glowColor");
    });
});

describe("missions — éditeur responsive et accessible", () => {
    it("la modale tient dans la hauteur dynamique, sans double défilement imbriqué", () => {
        const editor = codeOnly(EDITOR);
        expect(editor).toContain("max-h-[calc(100dvh-2rem)]");
        expect(editor).not.toContain("max-h-[92vh]");
        expect(editor).not.toContain("max-h-[500px]");
        expect(editor).not.toContain("max-h-[480px]");
        expect(editor).toContain("lg:overflow-y-auto");
    });

    it("la liste du catalogue n'a plus de boîte défilante à hauteur fixe", () => {
        const search = codeOnly(SEARCH);
        expect(search).not.toContain("h-[360px]");
        expect(search).toContain("lg:min-h-0 lg:flex-1 lg:overflow-y-auto");
    });

    it("les onglets passent à la ligne, les bascules sont annoncées et la recherche est libellée", () => {
        const search = codeOnly(SEARCH);
        expect(search).toContain("flex flex-wrap items-center gap-1.5");
        expect(search).toContain("aria-pressed={isActive}");
        expect(search).toContain('aria-label="Effacer la recherche"');
        expect(search).toContain("ANOMALIE");
        expect(search).toContain("OFFICIAL_MISSIONS_TOTAL");
        expect(search).not.toMatch(/count:\s*468/);
    });

    it("catégorie et récompenses passent par les composants maison", () => {
        const editor = codeOnly(EDITOR);
        expect(editor).toContain("<Select");
        expect(editor).toContain("<Input");
        expect(editor).not.toMatch(/<select[\s>]/);
        expect(editor).toContain("aria-pressed");
    });

    it("l'aperçu vide ne fait plus croire à une mission configurée", () => {
        expect(codeOnly(PREVIEW)).toContain("Aucune mission sélectionnée");
    });
});
