/**
 * Accueil du guide Rush — **première étape selon le compte** (règle pure).
 *
 * Le guide est utilisable sans profil ; l'accueil ne doit donc jamais demander
 * un personnage à un compte qui en a déjà un, ni promettre un enregistrement en
 * base à un visiteur qui n'a pas encore d'espace.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveRushOnboardingStart, resolveRushStartState } from "@/lib/rush-onboarding";

const read = (path: string) => readFileSync(path, "utf8");

const visitor = (overrides: Partial<{ pseudo: string | null; classe: string | null; alignment: string | null }> = {}) => ({
    pseudo: "Klyx",
    classe: "iop",
    alignment: "bontarien",
    ...overrides,
});

describe("resolveRushOnboardingStart — ne demande jamais ce qui est déjà déclaré", () => {
    it("anonyme ou connecté sans profil : étape 1 (personnage local)", () => {
        expect(resolveRushOnboardingStart(null)).toBe(1);
        expect(resolveRushOnboardingStart(undefined)).toBe(1);
    });

    it("profil partiel (pseudo ou classe manquant) : étape 1", () => {
        expect(resolveRushOnboardingStart(visitor({ pseudo: null }))).toBe(1);
        expect(resolveRushOnboardingStart(visitor({ classe: null }))).toBe(1);
    });

    it("profil complet sans alignement : étape 2 seulement", () => {
        expect(resolveRushOnboardingStart(visitor({ alignment: null }))).toBe(2);
    });

    it("profil complet et aligné : aucun accueil", () => {
        expect(resolveRushOnboardingStart(visitor())).toBeNull();
    });
});

describe("resolveRushStartState — la porte de départ", () => {
    it("anonyme sans personnage : coches bloquées", () => {
        expect(
            resolveRushStartState({ isConnected: false, visitor: null, hasGuestCharacter: false })
        ).toEqual({ needsCharacter: true, hasCharacter: false, needsAlignment: false });
    });

    it("anonyme avec personnage local : départ possible, alignement optionnel", () => {
        expect(
            resolveRushStartState({
                isConnected: false,
                visitor: null,
                hasGuestCharacter: true,
                localAlignment: null,
            })
        ).toEqual({ needsCharacter: false, hasCharacter: true, needsAlignment: true });
        expect(
            resolveRushStartState({
                isConnected: false,
                visitor: null,
                hasGuestCharacter: true,
                localAlignment: "bontarien",
            }).needsAlignment
        ).toBe(false);
    });

    it("profil complet : le personnage du compte suffit", () => {
        expect(
            resolveRushStartState({
                isConnected: true,
                visitor: visitor({ alignment: null }),
                hasGuestCharacter: false,
            })
        ).toEqual({ needsCharacter: false, hasCharacter: true, needsAlignment: true });
        expect(
            resolveRushStartState({
                isConnected: true,
                visitor: visitor(),
                hasGuestCharacter: false,
            })
        ).toEqual({ needsCharacter: false, hasCharacter: true, needsAlignment: false });
    });

    it("profil partiel : un personnage local peut prendre le relais", () => {
        expect(
            resolveRushStartState({
                isConnected: true,
                visitor: visitor({ classe: null }),
                hasGuestCharacter: false,
            }).needsCharacter
        ).toBe(true);
        expect(
            resolveRushStartState({
                isConnected: true,
                visitor: visitor({ classe: null }),
                hasGuestCharacter: true,
            }).needsCharacter
        ).toBe(false);
    });
});

describe("câblage — le guide lit la règle", () => {
    const client = read("src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx");

    it("le déclenchement dépend du compte, pas d'un délai seul", () => {
        expect(client).toContain("resolveRushOnboardingStart(");
        expect(client).toContain("onboardingStart === null");
    });

    it("la modale distingue les publics connectés", () => {
        const modal = read("src/app/guides/rush-sylvestre/_components/PublicOnboardingModal.tsx");
        expect(modal).toContain("connectedWithoutProfile");
        expect(modal).toContain("connectedPartial");
        expect(modal).toContain("canPickCharacter");
    });
});
