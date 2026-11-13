/**
 * Espace visiteur — verrou du **nom de guilde déclaré**.
 *
 * 🎯 Décision du 06/11/2026 (verbatim) : « aucun caractère spécial sauf "-" par exemple,
 * pas de chiffre, 40 lettres max plusieurs mots autorisés », puis « pas d'accent,
 * apostrophe et tiret ok, Majuscule OK ».
 *
 * Enjeu réel : ce nom s'affiche dans un **annuaire public**. Une règle qui laisse passer
 * un chiffre, un accent ou un underscore ne casse pas un écran — elle pollue la donnée
 * et rend le tri impossible. Chaque refus doit dire **pourquoi**.
 */

import { describe, it, expect } from "vitest";
import {
    DECLARED_GUILD_NAME_MAX,
    checkDeclaredGuildName,
    declaredGuildNameSchema,
    normalizeDeclaredGuildName,
} from "@/lib/public-profile-rules";

describe("Nom de guilde déclaré — ce qui passe", () => {
    it("accepte plusieurs mots, l'apostrophe et le tiret", () => {
        for (const name of ["Les Larmes d'Ocre", "Guilde-Test", "A B C", "L'Ordre"]) {
            const result = checkDeclaredGuildName(name);
            expect(result, name).toEqual({ ok: true, value: name });
        }
    });

    it("accepte les majuscules et un nom d'un seul mot", () => {
        expect(checkDeclaredGuildName("SIGIL")).toEqual({ ok: true, value: "SIGIL" });
        expect(checkDeclaredGuildName("Sylvestre")).toEqual({ ok: true, value: "Sylvestre" });
    });

    it("accepte exactement 40 caractères", () => {
        const name = "A".repeat(DECLARED_GUILD_NAME_MAX);
        expect(checkDeclaredGuildName(name)).toEqual({ ok: true, value: name });
    });

    it("normalise les espaces et l'apostrophe typographique", () => {
        expect(normalizeDeclaredGuildName("  Les   Larmes  ")).toBe("Les Larmes");
        // Apostrophe courbe (clavier mobile) : ramenée à l'ASCII, jamais rejetée.
        expect(checkDeclaredGuildName("Les Larmes d\u2019Ocre")).toEqual({
            ok: true,
            value: "Les Larmes d'Ocre",
        });
    });

    it("réduit les espaces multiples au lieu de refuser", () => {
        expect(checkDeclaredGuildName("Les    Larmes")).toEqual({
            ok: true,
            value: "Les Larmes",
        });
    });
});

describe("Nom de guilde déclaré — ce qui est refusé, et pourquoi", () => {
    it("refuse les chiffres", () => {
        const result = checkDeclaredGuildName("Guilde 2");
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/chiffres/i);
    });

    it("refuse les accents", () => {
        for (const name of ["Élite", "Frères", "Ça"] ) {
            const result = checkDeclaredGuildName(name);
            expect(result.ok, name).toBe(false);
            if (!result.ok) expect(result.error).toMatch(/accents/i);
        }
    });

    it("refuse l'underscore et les autres caractères", () => {
        for (const name of ["Guilde_Test", "Guilde.Test", "Guilde@Test", "Guilde#1"]) {
            const result = checkDeclaredGuildName(name);
            expect(result.ok, name).toBe(false);
        }
    });

    it("refuse un nom vide ou fait d'espaces", () => {
        for (const name of ["", "   ", "\t\n"]) {
            const result = checkDeclaredGuildName(name);
            expect(result.ok, name).toBe(false);
            if (!result.ok) expect(result.error).toMatch(/vide/i);
        }
    });

    it("refuse un nom qui commence ou finit par un séparateur", () => {
        for (const name of ["-Guilde", "Guilde-", "'Guilde", "Guilde'"]) {
            const result = checkDeclaredGuildName(name);
            expect(result.ok, name).toBe(false);
            if (!result.ok) expect(result.error).toMatch(/commencer et finir par une lettre/i);
        }
    });

    it("refuse deux séparateurs d'affilée", () => {
        for (const name of ["Guilde--Test", "Guilde''Test", "Guilde -Test"]) {
            expect(checkDeclaredGuildName(name).ok, name).toBe(false);
        }
    });

    it("refuse 41 caractères", () => {
        const result = checkDeclaredGuildName("A".repeat(DECLARED_GUILD_NAME_MAX + 1));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/40/);
    });
});

describe("Schéma Zod — la même règle, une seule source", () => {
    it("rend la valeur normalisée quand tout va bien", () => {
        expect(declaredGuildNameSchema.parse("  Les   Larmes d\u2019Ocre ")).toBe("Les Larmes d'Ocre");
    });

    it("porte le message exact de la règle pure en cas de refus", () => {
        const parsed = declaredGuildNameSchema.safeParse("Guilde 2");
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
            expect(parsed.error.issues[0]?.message).toMatch(/chiffres/i);
        }
    });

    it("refuse une chaîne absurdement longue avant même la règle", () => {
        expect(declaredGuildNameSchema.safeParse("A".repeat(201)).success).toBe(false);
    });
});
