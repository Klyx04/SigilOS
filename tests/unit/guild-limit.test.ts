/**
 * Limite de guildes par utilisateur — **règles pures** (`docs/plans/PLAN-LIMITE-GUILDES.md` §9).
 *
 * 📌 Décidés le 31/10/2026 : 2 guildes maximum, God exempté (côté lecture en base, pas ici),
 * seuil `PlatformConfig.maxGuildsPerUser` **borné 1..10**.
 *
 * 🔒 Ce que ce verrou protège : le compteur compte des **guildes**, pas des lignes (un owner qui a
 * aussi un profil dans sa propre guilde = **1**), et une valeur de configuration aberrante ne doit
 * jamais **baisser** la limite sous 1 ni l'ouvrir au-delà de 10.
 */
import { describe, expect, it } from "vitest";

import {
    GUILD_LIMIT_DEFAULT,
    countGuildsForUser,
    isAtGuildLimit,
    resolveGuildLimit,
} from "@/lib/guild-limit";

describe("countGuildsForUser — on compte des guildes, jamais des lignes", () => {
    it("un owner qui a aussi un profil dans sa propre guilde compte 1", () => {
        expect(
            countGuildsForUser({ profileGuildIds: ["guilde-a"], ownedGuildIds: ["guilde-a"] }),
        ).toBe(1);
    });

    it("deux guildes distinctes comptent 2, quel que soit le nombre de sources", () => {
        expect(
            countGuildsForUser({
                profileGuildIds: ["guilde-a", "guilde-b"],
                ownedGuildIds: ["guilde-a"],
            }),
        ).toBe(2);
    });

    it("ignore les entrées vides (guilde inconnue) au lieu de les compter", () => {
        expect(
            countGuildsForUser({
                profileGuildIds: ["", null, undefined, "guilde-a"],
                ownedGuildIds: [null, ""],
            }),
        ).toBe(1);
    });

    it("sans aucune source, le compteur reste à 0", () => {
        expect(countGuildsForUser({ profileGuildIds: [], ownedGuildIds: [] })).toBe(0);
    });
});

describe("resolveGuildLimit — le seuil ne peut jamais verrouiller ni s'ouvrir", () => {
    it("une valeur absente ou aberrante retombe sur le défaut (2)", () => {
        for (const raw of [null, undefined, 0, -1, 11, "abc", Number.NaN, 1.5, true, {}]) {
            expect(resolveGuildLimit(raw), `raw=${String(raw)}`).toBe(GUILD_LIMIT_DEFAULT);
        }
    });

    it("accepte les valeurs de 1 à 10, y compris sous forme de chaîne", () => {
        for (const raw of [1, 2, 3, 10, "4", "10"]) {
            expect(resolveGuildLimit(raw), `raw=${String(raw)}`).toBe(Number(raw));
        }
    });

    it("ne retombe jamais sur 0 : un 0 refuserait même la première guilde", () => {
        for (const raw of [0, "0", -3, "-10"]) {
            expect(resolveGuildLimit(raw)).toBeGreaterThanOrEqual(1);
        }
    });
});

describe("isAtGuildLimit — le seuil est atteint dès qu'une guilde de plus serait refusée", () => {
    it("2 guildes sur 2 : limite atteinte", () => {
        expect(isAtGuildLimit(2, 2)).toBe(true);
    });

    it("1 guilde sur 2 : il reste une place", () => {
        expect(isAtGuildLimit(1, 2)).toBe(false);
    });

    it("un seuil relevé à 3 laisse passer la 3e guilde", () => {
        expect(isAtGuildLimit(2, 3)).toBe(false);
        expect(isAtGuildLimit(3, 3)).toBe(true);
    });
});
