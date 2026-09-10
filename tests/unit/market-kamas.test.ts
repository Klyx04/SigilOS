import { describe, it, expect } from "vitest";
import { KAMAS_MAX, formatKamas, parseKamas, isValidKamas } from "@/lib/market/kamas";

/**
 * Module « Marché » — kamas : formatage, parsing tolérant, borne serveur.
 * Pur (aucune dépendance) : la même fonction sert au rendu et à la validation.
 */
describe("kamas", () => {
    it("KAMAS_MAX = plafond Int32 PostgreSQL", () => {
        expect(KAMAS_MAX).toBe(2_147_483_647);
    });

    it("formatKamas groupe les milliers avec une espace fine insécable", () => {
        const sep = "\u202F";
        expect(formatKamas(12500)).toBe(`12${sep}500${sep}k`);
        expect(formatKamas(1_250_000)).toBe(`1${sep}250${sep}000${sep}k`);
        expect(formatKamas(0)).toBe(`0${sep}k`);
    });

    it("formatKamas retourne le marqueur vide pour une valeur absente", () => {
        expect(formatKamas(null)).toBe("—");
        expect(formatKamas(undefined)).toBe("—");
        expect(formatKamas(Number.NaN)).toBe("—");
        expect(formatKamas(Number.POSITIVE_INFINITY)).toBe("—");
    });

    it("parseKamas tolère séparateurs et suffixe k", () => {
        expect(parseKamas("12500")).toBe(12500);
        expect(parseKamas("12 500")).toBe(12500);
        expect(parseKamas("12.500")).toBe(12500);
        expect(parseKamas("12\u202F500 k")).toBe(12500);
        expect(parseKamas(" 1 250 000 K ")).toBe(1_250_000);
        expect(parseKamas("0")).toBe(0);
    });

    it("parseKamas refuse une saisie invalide ou hors borne", () => {
        expect(parseKamas("")).toBeNull();
        expect(parseKamas("   ")).toBeNull();
        expect(parseKamas("abc")).toBeNull();
        expect(parseKamas("-5")).toBeNull();
        expect(parseKamas("12k5")).toBeNull();
        expect(parseKamas("99999999999")).toBeNull();
        expect(parseKamas(String(KAMAS_MAX + 1))).toBeNull();
        expect(parseKamas(null)).toBeNull();
    });

    it("isValidKamas est strict (entier, borné)", () => {
        expect(isValidKamas(0)).toBe(true);
        expect(isValidKamas(KAMAS_MAX)).toBe(true);
        expect(isValidKamas(KAMAS_MAX + 1)).toBe(false);
        expect(isValidKamas(-1)).toBe(false);
        expect(isValidKamas(1.5)).toBe(false);
        expect(isValidKamas("12500" as unknown)).toBe(false);
    });
});
