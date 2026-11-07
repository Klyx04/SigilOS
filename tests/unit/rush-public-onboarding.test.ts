/**
 * Guide public — **accueil de première arrivée** (V2a-4) et **invitation au profil** (V2a-6).
 *
 * Ce que ce verrou protège :
 * 1. l accueil n est **jamais forcé** — un bouton « Passer » existe, et le drapeau local le rend
 *    unique : une seule ouverture automatique par navigateur ;
 * 2. il est **rejouable** depuis « Options » (même modale, aucune donnée perdue) ;
 * 3. il **enchaîne** les deux sélecteurs qui existent déjà au lieu d en créer un second ;
 * 4. le CTA anonyme est un **lien**, jamais une modale.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const CLIENT = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const MODAL = "src/app/guides/rush-sylvestre/_components/PublicOnboardingModal.tsx";

describe("Guide public — accueil de première arrivée", () => {
    it("le drapeau local rend l ouverture automatique unique", () => {
        const client = read(CLIENT);
        expect(client).toContain('const ONBOARDING_FLAG = "sigilos:rush-public-onboarded"');
        expect(client).toContain("window.localStorage.getItem(ONBOARDING_FLAG)");
        expect(client).toContain('window.localStorage.setItem(ONBOARDING_FLAG, "1")');
    });

    it("l accueil n est jamais forcé : « Passer » ferme et pose le drapeau", () => {
        const modal = read(MODAL);
        expect(modal).toContain("onSkip");
        expect(modal).toMatch(/en \? "Skip" : "Passer"/);
    });

    it("il est rejouable depuis Options", () => {
        const client = read(CLIENT);
        expect(client).toContain("setOnboardingStep(1)");
        expect(client).toContain("Revoir l accueil");
    });

    it("il enchaîne les sélecteurs existants, sans second formulaire", () => {
        const client = read(CLIENT);
        expect(client).toContain("onPickCharacter");
        expect(client).toContain("onPickAlignment");
        expect(client).toContain("setCharacterOpen(true)");
        expect(client).toContain("setAlignmentOpen(true)");
    });

    it("la modale n importe aucun code serveur", () => {
        expect(read(MODAL)).not.toMatch(/from "@\/server\//);
    });
});

describe("Guide public — invitation au profil (V2a-6)", () => {
    it("le visiteur non connecté voit un lien, jamais une modale", () => {
        const client = read(CLIENT);
        expect(client).toContain("Créer mon profil visiteur");
        expect(client).toContain('href="/espace-visiteur/general"');
    });
});