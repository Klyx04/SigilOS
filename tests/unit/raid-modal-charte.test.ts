/**
 * Charte et responsive de la modale raid — **audit B11/B12** (PLAN-RAID §2), **mesuré le 31/10/2026**.
 *
 * Avant ce lot : **41** `font-black`, **4** italiques décoratifs, des glows colorés
 * (`shadow-amber-600/30`, `shadow-indigo-500/20`), un **second accent rose** (`text-pink-400`) et une
 * classe orpheline `group-`. Le **responsive**, lui, était **déjà conforme** : `w-[95vw]` + `sm:max-w-*`
 * partout — ne jamais le remplacer par une largeur fixe.
 *
 * ⚠️ Garde de **source**, volontairement grossière : elle attrape les régressions de charte, pas
 * les cas subtils. Les `rounded-[3px]`/`rounded-[4px]` restent **conformes** (≤ 12 px) et ne sont
 * pas visés.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const MODAL = readFileSync(join(process.cwd(), "src/components/calendar/event-detail-modal.tsx"), "utf8");

describe("charte de la modale raid (B11)", () => {
    it("aucun `font-black` (poids maximal interdit par la charte)", () => {
        expect(MODAL).not.toMatch(/\bfont-black\b/);
    });

    it("aucun italique décoratif", () => {
        expect(MODAL).not.toMatch(/\bitalic\b/);
    });

    it("aucun glow coloré ni ombre interne décorative", () => {
        expect(MODAL).not.toMatch(/shadow-(amber|indigo|rose|emerald|sky|violet|pink)-\d{3}/);
        expect(MODAL).not.toMatch(/\bshadow-inner\b/);
    });

    it("aucun second accent rose (une seule teinte d'accent par écran)", () => {
        expect(MODAL).not.toMatch(/\b(?:text|bg|border|from|via|to|ring)-pink-\d{3}/);
    });

    it("aucun `glass-premium`", () => {
        expect(MODAL).not.toMatch(/glass-premium/);
    });

    it("aucune classe orpheline `group-` (effet mort)", () => {
        expect(MODAL).not.toMatch(/\bgroup-\s/);
    });
});

describe("responsive de la modale raid (B12)", () => {
    it("la modale principale est bornée par l'écran, jamais par une largeur fixe", () => {
        expect(MODAL).toContain("w-[95vw] sm:max-w-2xl");
    });

    it("la clôture raid tient sur 390 px (largeur écran + liste bornée)", () => {
        expect(MODAL).toContain("w-[95vw] sm:max-w-lg");
        expect(MODAL).toContain("max-h-64 overflow-y-auto");
    });

    it("le registre de présence n'est plus dans la modale de clôture (il vit dans la fiche membre)", () => {
        expect(MODAL).not.toContain("Registre de présence");
        expect(MODAL).not.toContain("getRaidPresenceRegister");
    });
});
