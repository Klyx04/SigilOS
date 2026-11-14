/**
 * Tracker des signalements — garde de la DA (PR 3).
 *
 * Les écrans God et membre doivent rester sur les tokens de la landing :
 * aucune couleur Tailwind en dur, pas de `font-black`, pas de rayon > 12 px.
 * Ce test couvre les deux composants neufs, pas la console Support historique.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const COMPONENTS = [
    "src/components/feedback/feedback-tracker.tsx",
    "src/components/feedback/visitor-feedback-button.tsx",
    "src/components/tracker/member-tracker-view.tsx",
    "src/app/god/components/ticket-dashboard.tsx",
    "src/app/espace-visiteur/_components/visitor-feedback-history.tsx",
];

describe("DA des écrans de signalements", () => {
    it("n'utilise aucune couleur en dur ni graisse décorative", () => {
        for (const file of COMPONENTS) {
            const source = readFileSync(file, "utf8");
            expect(source, file).not.toMatch(/\b(zinc|amber|indigo|emerald|slate|violet|purple|rose|blue|red|green|orange|sky|teal|cyan|pink|fuchsia)-\d{2,3}\b/);
            expect(source, file).not.toMatch(/\b(text|bg|border|ring|shadow)-(white|black)\b/);
            expect(source, file).not.toMatch(/\bfont-(black|bold)\b/);
            expect(source, file).not.toMatch(/\bitalic\b/);
            expect(source, file).not.toMatch(/\bbackdrop-blur/);
            expect(source, file).not.toMatch(/\bshadow-(2xl|xl|lg)\b/);
        }
    });

    it("borne les rayons à 12 px", () => {
        for (const file of COMPONENTS) {
            const source = readFileSync(file, "utf8");
            expect(source, file).not.toMatch(/\brounded-(2xl|3xl|\[?2rem\]?|\[?1\.5rem\]?)\b/);
        }
    });

    it("utilise les tokens de surface et de texte de la DA", () => {
        const source = readFileSync("src/components/tracker/member-tracker-view.tsx", "utf8");
        expect(source).toMatch(/bg-surface/);
        expect(source).toMatch(/text-muted-foreground/);
        expect(source).toMatch(/border-border/);
    });
});
