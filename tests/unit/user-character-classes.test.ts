import { describe, it, expect } from "vitest";
import {
    getUserPlayableCharacters,
    getUserAllowedClasses,
    isClassAllowedForUser,
    resolveOwnedClass,
    classNotOwnedMessage,
} from "@/lib/user-character-classes";

describe("user-character-classes — extraction & validation des classes autorisées", () => {
    it("retourne une liste vide pour un profil nul ou sans classe", () => {
        expect(getUserPlayableCharacters(null)).toEqual([]);
        expect(getUserPlayableCharacters(undefined)).toEqual([]);
        expect(getUserPlayableCharacters({ pseudoDofus: "Heropseudo", classe: null })).toEqual([]);
        expect(getUserAllowedClasses(null)).toEqual([]);
        expect(isClassAllowedForUser("Cra", null)).toBe(false);
    });

    it("extrait le personnage principal avec sa classe canonique", () => {
        const profile = {
            pseudoDofus: "Heropseudo",
            classe: "cra",
        };
        const characters = getUserPlayableCharacters(profile);
        expect(characters).toHaveLength(1);
        expect(characters[0]).toEqual({
            pseudo: "Heropseudo",
            classe: "Cra",
            isMain: true,
        });

        expect(getUserAllowedClasses(profile)).toEqual(["Cra"]);
        expect(isClassAllowedForUser("cra", profile)).toBe(true);
        expect(isClassAllowedForUser("Cra", profile)).toBe(true);
        expect(isClassAllowedForUser("Iop", profile)).toBe(false);
    });

    it("extrait le main et les mules avec classes et niveaux", () => {
        const profile = {
            pseudoDofus: "MainHero",
            classe: "Iop",
            altPseudos: [
                { pseudo: "MuleCra", classe: "cra", level: 200 },
                { pseudo: "MuleEni", classe: "Eniripsa", level: 199 },
                { pseudo: "MuleSansClasse", classe: null },
                "MuleChaineHistoriqueSansClasse",
            ],
        };

        const characters = getUserPlayableCharacters(profile);
        expect(characters).toEqual([
            { pseudo: "MainHero", classe: "Iop", isMain: true },
            { pseudo: "MuleCra", classe: "Cra", isMain: false, level: 200 },
            { pseudo: "MuleEni", classe: "Eniripsa", isMain: false, level: 199 },
        ]);

        const allowed = getUserAllowedClasses(profile);
        expect(allowed).toEqual(["Iop", "Cra", "Eniripsa"]);

        expect(isClassAllowedForUser("iop", profile)).toBe(true);
        expect(isClassAllowedForUser("CRA", profile)).toBe(true);
        expect(isClassAllowedForUser("eniripsa", profile)).toBe(true);
        expect(isClassAllowedForUser("feca", profile)).toBe(false);
        expect(isClassAllowedForUser("Féca", profile)).toBe(false);
    });

    it("gère les accents pour la comparaison de classes (ex: Féca)", () => {
        const profile = {
            pseudoDofus: "ShieldMaster",
            classe: "Féca",
        };
        expect(isClassAllowedForUser("feca", profile)).toBe(true);
        expect(isClassAllowedForUser("Feca", profile)).toBe(true);
        expect(isClassAllowedForUser("Féca", profile)).toBe(true);
        expect(isClassAllowedForUser("Sacrieur", profile)).toBe(false);
    });

    it("dédoublonne les classes si plusieurs mules ont la même classe", () => {
        const profile = {
            pseudoDofus: "LeadCra",
            classe: "Cra",
            altPseudos: [
                { pseudo: "CraTwo", classe: "Cra", level: 200 },
                { pseudo: "CraThree", classe: "cra", level: 150 },
            ],
        };
        expect(getUserAllowedClasses(profile)).toEqual(["Cra"]);
        expect(getUserPlayableCharacters(profile)).toHaveLength(3);
    });
});

describe("resolveOwnedClass — un choix n'est accepté que s'il est possédé", () => {
    const profile = {
        pseudoDofus: "MainHero",
        classe: "Iop",
        altPseudos: [{ pseudo: "MuleCra", classe: "Cra", level: 200 }],
    };

    it("accepte la classe principale et les mules, sous forme canonique", () => {
        expect(resolveOwnedClass("iop", profile)).toEqual({ success: true, classe: "Iop" });
        expect(resolveOwnedClass("CRA", profile)).toEqual({ success: true, classe: "Cra" });
        expect(resolveOwnedClass("  Cra  ", profile)).toEqual({ success: true, classe: "Cra" });
    });

    it("refuse une classe non possédée avec un message actionnable", () => {
        const result = resolveOwnedClass("Eniripsa", profile);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe(classNotOwnedMessage("Eniripsa"));
            expect(result.error).toContain("ni en personnage principal, ni dans tes mules");
        }
    });

    it("refuse une classe inconnue au lieu de retomber sur la classe principale", () => {
        const result = resolveOwnedClass("Boulanger", profile);
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toContain("Classe inconnue");
    });

    it("traite l'absence de choix comme « aucune préférence » (null)", () => {
        expect(resolveOwnedClass(null, profile)).toEqual({ success: true, classe: null });
        expect(resolveOwnedClass("", profile)).toEqual({ success: true, classe: null });
        expect(resolveOwnedClass("   ", profile)).toEqual({ success: true, classe: null });
    });

    it("fail-closed quand le profil est introuvable (aucune classe acceptée)", () => {
        expect(resolveOwnedClass("Iop", null)).toMatchObject({ success: false });
        expect(resolveOwnedClass("Iop", undefined)).toMatchObject({ success: false });
    });
});
