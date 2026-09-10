import { describe, it, expect } from "vitest";
import { computeStatQuality, computeStatsHash } from "@/lib/market/stat-quality";

/**
 * Module « Marché » — étiquetage FM du jet déclaré (§6.3).
 * Règle fondatrice : un over / exo n'est JAMAIS refusé, seulement étiqueté.
 */
describe("computeStatQuality", () => {
    it("marque OVER au-dessus du maximum natif (jamais bloqué)", () => {
        expect(computeStatQuality({ naturalMin: 250, naturalMax: 300, actualValue: 312 })).toBe("OVER");
    });

    it("marque PERFECT à la valeur maximale natif", () => {
        expect(computeStatQuality({ naturalMin: 250, naturalMax: 300, actualValue: 300 })).toBe("PERFECT");
    });

    it("marque GOOD dans la plage au-dessus de la moyenne", () => {
        expect(computeStatQuality({ naturalMin: 250, naturalMax: 300, actualValue: 290 })).toBe("GOOD");
    });

    it("marque NORMAL dans la plage à la moyenne ou en dessous", () => {
        expect(computeStatQuality({ naturalMin: 250, naturalMax: 300, actualValue: 275 })).toBe("NORMAL");
        expect(computeStatQuality({ naturalMin: 250, naturalMax: 300, actualValue: 260 })).toBe("NORMAL");
    });

    it("marque LOW sous le minimum natif", () => {
        expect(computeStatQuality({ naturalMin: 250, naturalMax: 300, actualValue: 240 })).toBe("LOW");
    });

    it("NORMAL quand la plage natif est inconnue (aucun jugement)", () => {
        expect(computeStatQuality({ naturalMin: null, naturalMax: null, actualValue: 400 })).toBe("NORMAL");
    });

    it("fonctionne avec une borne unique connue", () => {
        expect(computeStatQuality({ naturalMin: null, naturalMax: 100, actualValue: 150 })).toBe("OVER");
        expect(computeStatQuality({ naturalMin: 10, naturalMax: null, actualValue: 5 })).toBe("LOW");
    });

    it("l'origine EXO n'empêche pas le calcul sur la plage", () => {
        expect(
            computeStatQuality({ naturalMin: 30, naturalMax: 60, actualValue: 61, origin: "EXO" })
        ).toBe("OVER");
    });
});

describe("computeStatsHash", () => {
    const stats = [
        { effectId: 11, origin: "NATIVE" as const, actualValue: 250, naturalMin: 200, naturalMax: 300 },
        { effectId: 3, origin: "NATIVE" as const, actualValue: 10, naturalMin: 5, naturalMax: 15 },
    ];

    it("produit une empreinte MD5 hexadécimale stable", () => {
        const a = computeStatsHash(stats);
        const b = computeStatsHash([...stats].reverse());
        expect(a).toMatch(/^[a-f0-9]{32}$/);
        expect(a).toBe(b);
    });

    it("change quand une valeur déclarée change", () => {
        const a = computeStatsHash(stats);
        const b = computeStatsHash([
            { ...stats[0], actualValue: 251 },
            stats[1],
        ]);
        expect(a).not.toBe(b);
    });

    it("gère une liste vide", () => {
        expect(computeStatsHash([])).toMatch(/^[a-f0-9]{32}$/);
    });
});

/**
 * S2.13 — cas limites (bornes anti-débilité D35 : on n'invente pas de plafond,
 * on ne juge jamais la légitimité — seulement l'étiquette).
 */
describe("computeStatQuality — cas limites", () => {
    it("PERFECT quand min === max === valeur", () => {
        expect(computeStatQuality({ naturalMin: 100, naturalMax: 100, actualValue: 100 })).toBe("PERFECT");
    });

    it("LOW quand min === max et valeur en dessous", () => {
        expect(computeStatQuality({ naturalMin: 100, naturalMax: 100, actualValue: 99 })).toBe("LOW");
    });

    it("OVER quand min === max et valeur au-dessus", () => {
        expect(computeStatQuality({ naturalMin: 100, naturalMax: 100, actualValue: 101 })).toBe("OVER");
    });

    it("gère une plage entièrement négative", () => {
        expect(computeStatQuality({ naturalMin: -50, naturalMax: -10, actualValue: -60 })).toBe("LOW");
        expect(computeStatQuality({ naturalMin: -50, naturalMax: -10, actualValue: -20 })).toBe("GOOD");
        expect(computeStatQuality({ naturalMin: -50, naturalMax: -10, actualValue: -10 })).toBe("PERFECT");
    });

    it("accepte les valeurs hors bornes anti-débilité (le calcul ne bloque jamais)", () => {
        // Les bornes -9 999 / 99 999 sont posées par Zod, PAS par computeStatQuality.
        expect(computeStatQuality({ naturalMin: 0, naturalMax: 100, actualValue: 99_999 })).toBe("OVER");
        expect(computeStatQuality({ naturalMin: 0, naturalMax: 100, actualValue: -9_999 })).toBe("LOW");
    });
});
