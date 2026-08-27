import { describe, expect, it } from "vitest";
import { deriveDofensiveMonsterName, resolveMonsterKey } from "@/lib/dofensive-boss";

describe("deriveDofensiveMonsterName", () => {
    it("extrait le monstre d'un double boss « Comte et Klime »", () => {
        expect(deriveDofensiveMonsterName("Comte et Klime")).toBe("klime");
        expect(deriveDofensiveMonsterName("Comte et Sylargh")).toBe("sylargh");
        expect(deriveDofensiveMonsterName("Comte et Missiz Frizz")).toBe("missiz frizz");
        expect(deriveDofensiveMonsterName("Comte et Nileza")).toBe("nileza");
    });

    it("retourne null pour un nom simple (pas de « et » séparateur)", () => {
        expect(deriveDofensiveMonsterName("Comte Harebourg")).toBeNull();
        expect(deriveDofensiveMonsterName("Donjon du Comte Harebourg")).toBeNull();
        expect(deriveDofensiveMonsterName("")).toBeNull();
        expect(deriveDofensiveMonsterName(null)).toBeNull();
    });

    it("gère les variantes « & » et « + »", () => {
        expect(deriveDofensiveMonsterName("Comte & Klime")).toBe("klime");
        expect(deriveDofensiveMonsterName("Comte + Klime")).toBe("klime");
    });
});

describe("resolveMonsterKey", () => {
    it("privilégie le dofensiveMonsterName explicite", () => {
        expect(resolveMonsterKey("Missiz Frizz", "Comte et Klime")).toBe("missiz frizz");
    });

    it("dérive depuis le nom affiché si le champ est absent", () => {
        expect(resolveMonsterKey(null, "Comte et Klime")).toBe("klime");
        expect(resolveMonsterKey(undefined, "Comte et Sylargh")).toBe("sylargh");
    });
});
