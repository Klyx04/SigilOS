/**
 * Chantier 5 (10/10/2026) — module Missions, surfaces membres : déslop + 2 bugs.
 *
 * Verrous :
 *  1. hall de guilde : `initialZoom={6}` dépassait le `maxZoom: 3` du CRS (zooms
 *     négatifs ici) — Leaflet clampait au max = aperçu « trop zoomé ». Le zoom
 *     d'aperçu reste dans la plage du CRS ;
 *  2. bouton PREUVE : masqué si et seulement si vitrine OU God (#204) OU déjà validé.
 *     Un God qui ne voit pas PREUVE, c'est #204 qui s'applique — pas un bug ;
 *  3. zéro slop (dégradés, flous géants, motion, ombres géantes, rayons arbitraires)
 *     sur les surfaces membres (les surfaces admin `manage`/`validation` et le code
 *     mort `personal-guildaton-widget` sont hors périmètre, signalés en PR).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");
const codeOnly = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const MEMBER_SURFACES = [
    "src/components/missions/mission-card.tsx",
    "src/components/missions/mission-board.tsx",
    "src/components/missions/guild-hall-widget.tsx",
    "src/components/missions/guild-progress-bar.tsx",
    "src/components/missions/validation-card.tsx",
    "src/components/missions/proof-upload-dialog.tsx",
    "src/components/missions/mission-publish-flow-dialog.tsx",
    "src/components/missions/residency-countdown.tsx",
    "src/components/missions/submission-countdown.tsx",
];

const SLOP_PATTERNS = [
    "linear-gradient",
    "radial-gradient",
    "blur-3xl",
    "blur-2xl",
    "backdrop-blur-xl",
    "shadow-2xl",
    "rounded-[",
    "bg-clip-text",
    "animate-in",
    "layoutId",
    "framer-motion",
    "tracking-[0.2em]",
    "scale-[1",
    "135deg",
];

describe("missions — hall de guilde : zoom d'aperçu dans la plage du CRS", () => {
    it("initialZoom reste entre minZoom (-6) et maxZoom (3), jamais 6", () => {
        const code = codeOnly(read("src/components/missions/guild-hall-widget.tsx"));
        expect(code).not.toMatch(/initialZoom=\{6\}/);
        const match = code.match(/initialZoom=\{(-?\d+)\}/);
        expect(match, "le hall passe un initialZoom explicite").not.toBeNull();
        const zoom = Number(match?.[1]);
        expect(zoom).toBeGreaterThanOrEqual(-6);
        expect(zoom).toBeLessThanOrEqual(3);
    });
});

describe("missions — bouton PREUVE : règle d'affichage pour les membres et super-admins", () => {
    it("PREUVE exige !vitrine && !hideUpload && !déjà-validé (accessible aux super-admins membres de la guilde)", () => {
        const code = codeOnly(read("src/components/missions/mission-card.tsx"));
        expect(code).toContain("!vitrineMode && !hideUpload && !isValidated");
        // La page masque l'upload aux non-membres (les super-admins membres peuvent participer)
        const page = codeOnly(
            read("src/app/dashboard/[guildId]/missions/page.tsx")
        );
        expect(page).toContain("hideUpload={!user.isMember}");
    });
});

describe("missions — zéro slop sur les surfaces membres", () => {
    for (const file of MEMBER_SURFACES) {
        it(`${file} : aucun motif slop`, () => {
            const code = codeOnly(read(file));
            const hits = SLOP_PATTERNS.filter((pattern) => code.includes(pattern));
            expect(hits).toEqual([]);
        });
    }
});
