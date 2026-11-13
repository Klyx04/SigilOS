/**
 * Écran Succès — charte anti-slop et vrai asset.
 *
 * Demande user du 25/10/2026 : « supprime le placeholder icône IA à côté du texte dans
 * le bouton “Chercher un groupe” partout et mets un vrai asset » + « trop de boutons
 * sombres sur sombre ». L'icône générique (`Swords`/`Users`) est remplacée par l'asset
 * Dofus, et les CTA passent sur `bg-elevated` + `border-border-strong`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const DIRECTORY = codeOnly(readFileSync("src/components/succes/SuccesDirectory.tsx", "utf8"));
const TRACKER = codeOnly(readFileSync("src/components/succes/SuccesTracker.tsx", "utf8"));
const RUSH = codeOnly(
    readFileSync("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx", "utf8")
);

describe("Bouton « Chercher un groupe »", () => {
    it("utilise l'asset Dofus dans les trois écrans", () => {
        for (const [name, code] of [
            ["annuaire", DIRECTORY],
            ["suivi", TRACKER],
            ["guide de quête", RUSH],
        ] as const) {
            expect(code, `${name} : asset Dofus attendu`).toMatch(/GameIcon src="crossed-swords\.png"/);
        }
    });

    it("n'utilise plus d'icône générique dans ce bouton", () => {
        expect(DIRECTORY).not.toMatch(/<Swords[^>]*\/> Chercher un groupe/);
        expect(TRACKER).not.toMatch(/<Swords[^>]*\/> Chercher un groupe/);
        expect(RUSH).not.toMatch(/<Users[^>]*\/>\s*\n\s*Chercher un groupe/);
    });
});

describe("Contraste des actions", () => {
    it("les CTA ne sont plus sombres sur sombre", () => {
        expect(DIRECTORY).toContain("border-border-strong bg-elevated");
        expect(TRACKER).toContain("border-border-strong bg-elevated");
    });

    it("plus de graisse ni de casse décoratives sur ces CTA", () => {
        expect(DIRECTORY).not.toMatch(/Chercher un groupe[\s\S]{0,200}uppercase/);
        expect(TRACKER).not.toMatch(/Tout cocher[\s\S]{0,200}font-black/);
        expect(TRACKER).not.toMatch(/Valider la tranche[\s\S]{0,200}font-black/);
    });
});
