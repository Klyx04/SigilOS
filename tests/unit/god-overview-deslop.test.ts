/**
 * God — vue d'ensemble (lot C) : les trois cartes refondues ne portent plus de slop.
 *
 * Le panneau d'annonces portait 102 motifs, le worker 40 et la santé 3. Le bandeau
 * et le fallback de page sont traités par `god-overview.test.ts` (libellés) ; ici on
 * verrouille les fichiers refondus, plus la pause du polling quand l'onglet est masqué.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const FILES = [
    "src/app/god/components/announcement-panel.tsx",
    "src/app/god/components/worker-tester.tsx",
    "src/app/god/components/system-health-dashboard.tsx",
];

const SLOP =
    /\b(font-black|uppercase|rounded-2xl|rounded-3xl|rounded-\[[^\]]+\]|backdrop-blur|animate-pulse|shadow-2xl|italic)\b|(?:text|bg|border|from|to|via|ring|shadow)-(?:zinc|emerald|teal|indigo|rose|violet|amber|orange|blue|green)-\d{2,3}|(?:text|bg|border)-(?:white|black)(?:\/\d+)?/g;

describe("God — vue d'ensemble déslopée", () => {
    for (const file of FILES) {
        it(`${file} ne porte aucun motif de slop`, () => {
            const source = readFileSync(file, "utf8");
            const matches = source.match(SLOP) ?? [];
            expect(matches, `motifs restants : ${matches.join(", ")}`).toEqual([]);
        });
    }

    it("le polling de santé s'arrête quand l'onglet est masqué", () => {
        const source = readFileSync("src/app/god/components/system-health-dashboard.tsx", "utf8");
        expect(source).toContain("document.visibilityState");
        expect(source).toContain("visibilitychange");
        expect(source).toContain("stop()");
    });
});
