/**
 * Bandeau de la modale d'événement — **le titre ne doit plus être écrasé**.
 *
 * Constat du 25/10/2026 (capture beta) : sur un raid terminé, la rangée d'actions
 * (`sm:shrink-0`) refusait de rétrécir alors que le bloc titre (`min-w-0`) était le
 * seul élément compressible du flex. Le titre tombait à ~1 caractère de large et
 * s'affichait **une lettre par ligne** (« R / A / I / D / : / G / I / G / A / L / O / D
 * / O / N »). Ce n'était pas la police : c'était la largeur.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const MODAL = codeOnly(readFileSync("src/components/calendar/event-detail-modal.tsx", "utf8"));

describe("Bandeau de la modale — largeur garantie au titre", () => {
    it("le bloc d'actions ne refuse plus de rétrécir (`sm:shrink-0` interdit)", () => {
        expect(MODAL).not.toMatch(/sm:shrink-0/);
    });

    it("le bloc titre reste le seul élément extensible du flex", () => {
        expect(MODAL).toMatch(/flex min-w-0 flex-1 gap-4/);
        expect(MODAL).toMatch(/min-w-0 flex-1 space-y-2/);
    });

    it("beaucoup d'actions ⇒ ligne pleine SOUS le titre (jamais un titre comprimé)", () => {
        expect(MODAL).toMatch(/denseActions \? "sm:basis-full" : "sm:max-w-\[45%\]"/);
        expect(MODAL).toMatch(/const denseActions = isRaid && \(effectiveStatus === "COMPLETED" \|\| awaitsClosure\);/);
    });

    it("le titre est borné à deux lignes, avec le texte complet au survol", () => {
        expect(MODAL).toMatch(/line-clamp-2/);
        expect(MODAL).toMatch(/title=\{event\.title\}/);
    });

    it("les badges peuvent passer à la ligne au lieu de pousser le titre", () => {
        expect(MODAL).toMatch(/<div className="flex flex-wrap items-center gap-2">/);
    });
});
