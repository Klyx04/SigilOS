/**
 * Plafonds de points (PA / PM) — règle pure, **source officielle**.
 *
 * Dofus Wiki, `Characteristic` § Action Point : « You can only have a maximum of **12 AP** …
 * Although you are able to equip extra equipment with more AP, the AP bonus will not be
 * included. » § Movement Point : idem à **6 PM**.
 *
 * 🎯 Cas réel du 26/10/2026 (constat user) : un familier **+1 PA** sur un build à 12 PA
 * affichait **13 PA** — impossible en jeu. Le point excédentaire est désormais **ignoré** et
 * **dit** à l'écran.
 */

import { describe, it, expect } from "vitest";
import { capActionPoints, capMovementPoints, capPoints, capRange, capSummons, MAX_AP, MAX_MP, MAX_RANGE, MAX_SUMMONS } from "@/lib/dofus-caps";

describe("plafonds PA / PM", () => {
    it("plafonne un build à 12 PA (cas réel : familier +1 PA sur 12)", () => {
        expect(capActionPoints(13)).toEqual({ value: MAX_AP, ignored: 1 });
        expect(capActionPoints(12)).toEqual({ value: 12, ignored: 0 });
        expect(capActionPoints(12 + 3)).toEqual({ value: 12, ignored: 3 });
    });

    it("plafonne un build à 6 PM", () => {
        expect(capMovementPoints(7)).toEqual({ value: MAX_MP, ignored: 1 });
        expect(capMovementPoints(6)).toEqual({ value: 6, ignored: 0 });
    });

    it("laisse passer une valeur sous le plafond", () => {
        expect(capActionPoints(7)).toEqual({ value: 7, ignored: 0 });
        expect(capMovementPoints(3)).toEqual({ value: 3, ignored: 0 });
    });

    it("plafonne la portée à 6 PO et les invocations à 6", () => {
        // Dofus Wiki § Range : « You can only have a maximum of 6 Range » ; § Summons : idem à 6.
        expect(capRange(8)).toEqual({ value: MAX_RANGE, ignored: 2 });
        expect(capRange(6)).toEqual({ value: 6, ignored: 0 });
        expect(capSummons(7)).toEqual({ value: MAX_SUMMONS, ignored: 1 });
        expect(capSummons(4)).toEqual({ value: 4, ignored: 0 });
    });

    it("ne rend jamais de valeur négative ni de plafond absurde", () => {
        expect(capActionPoints(-2)).toEqual({ value: 0, ignored: 0 });
        expect(capActionPoints(null)).toEqual({ value: 0, ignored: 0 });
        expect(capActionPoints(undefined)).toEqual({ value: 0, ignored: 0 });
        expect(capPoints(5, 0)).toEqual({ value: 0, ignored: 5 });
    });
});
