/**
 * Écran God `?tab=telemetry` — garde de déslop et de lisibilité.
 *
 * Le fichier portait 46 motifs mesurés le 16/11/2026 (palettes zinc/violet/amber,
 * `font-black`, uppercase, `rounded-3xl`, `backdrop-blur`, `animate-pulse`).
 * Il ne doit plus en rester un seul. On verrouille aussi les trois corrections
 * fonctionnelles : plus de `userAgent`, langue affichée, chemin complet copiable.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const DASHBOARD = "src/app/god/components/telemetry-dashboard.tsx";
const SLOP = /\b(font-black|uppercase|rounded-2xl|rounded-3xl|rounded-\[[^\]]+\]|backdrop-blur|animate-pulse|shadow-2xl|italic)\b|(?:text|bg|border|from|to|via|ring|shadow)-(?:zinc|emerald|teal|indigo|rose|violet|amber)-\d{2,3}|(?:text|bg|border)-(?:white|black)(?:\/\d+)?/g;

describe("télémétrie God — déslop et lisibilité", () => {
    it("le dashboard ne porte plus aucun motif de slop", () => {
        const source = readFileSync(DASHBOARD, "utf8");
        const matches = source.match(SLOP) ?? [];
        expect(matches, `motifs restants : ${matches.join(", ")}`).toEqual([]);
    });

    it("le user-agent périmé n'est plus affiché et la langue l'est", () => {
        const source = readFileSync(DASHBOARD, "utf8");
        expect(source).not.toContain("userAgent");
        expect(source).toContain("Langue :");
        expect(source).toContain("language");
    });

    it("le chemin n'est plus tronqué et reste copiable", () => {
        const source = readFileSync(DASHBOARD, "utf8");
        expect(source).not.toContain("truncate max-w-[320px]");
        expect(source).not.toContain("truncate max-w-[250px]");
        expect(source).toContain("break-all");
        expect(source).toContain("Copier le chemin");
        expect(source).toContain("Ouvrir la page");
    });
});
