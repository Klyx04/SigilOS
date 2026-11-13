/**
 * Hub « La Guilde » — **règlement intérieur** et navigation.
 *
 * Ce que ce verrou protège :
 * - le règlement a **une seule destination** dans le hub (`?tab=reglement`) : il n'est plus noyé
 *   sous le manifeste de la présentation, et il n'est **pas rendu deux fois** ;
 * - il reste **interne** : le rendu public (`getGuildPresentation(checkEnabled = true)`) reçoit
 *   `internalRules: null` — la règle vit dans la couche serveur, pas dans un écran ;
 * - la navigation n'introduit **aucun marqueur de slop** (les deux grosses cartes empilées ont été
 *   remplacées par une barre segmentée aux tokens du design system).
 *
 * Lecture seule : code source.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const HUB = "src/app/dashboard/[guildId]/guild-hub";
const TABS = `${HUB}/_components/guild-hub-tabs.tsx`;
const REGLEMENT = `${HUB}/_components/reglement-content.tsx`;
const PRESENTATION = `${HUB}/_components/presentation-content.tsx`;
const PAGE = `${HUB}/page.tsx`;
const ACTIONS = "src/server/actions/presentation-actions.ts";

/** Commentaires de LIGNE d'abord (un `// … /* …` avalerait tout le code suivant). */
const codeOnly = (path: string) =>
    readFileSync(path, "utf8")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
        .replace(/\/\*[\s\S]*?\*\//g, "");

describe("Hub « La Guilde » — règlement intérieur visible côté membre", () => {
    it("le règlement a son propre rendu et sa propre entrée de navigation", () => {
        expect(existsSync(REGLEMENT)).toBe(true);
        const reglement = codeOnly(REGLEMENT);
        expect(reglement).toContain("<DocContent");
        expect(reglement).toContain("isInternalRulesEmpty");
        expect(reglement).toContain("Invisible de l");

        const tabs = codeOnly(TABS);
        expect(tabs).toContain('"reglement"');
        expect(tabs).toContain("canViewRules");

        const page = codeOnly(PAGE);
        expect(page).toContain('value="reglement"');
        expect(page).toContain("<ReglementContent");
        expect(page).toContain("canViewRules={!!user.canViewPresentation}");
    });

    it("le règlement n'est plus rendu une seconde fois dans l'onglet Présentation", () => {
        const presentation = codeOnly(PRESENTATION);
        expect(presentation).not.toContain("reglement-titre");
        expect(presentation).not.toContain("isInternalRulesEmpty");
    });

    it("le règlement reste interne : le rendu public reçoit `internalRules: null`", () => {
        const actions = codeOnly(ACTIONS);
        expect(actions).toContain("internalRules: checkEnabled ? null : (g.presentationInternalRules as string | null)");
    });

    it("la navigation du hub n'introduit aucun marqueur de slop", () => {
        const tabs = readFileSync(TABS, "utf8");
        for (const marker of ["animate-in", "rounded-2xl", "shadow-2xl", "bg-gradient", "backdrop-blur", "font-black", "tracking-widest"]) {
            expect(tabs, marker).not.toContain(marker);
        }
        // Tokens du design system attendus à la place.
        expect(tabs).toContain("bg-accent-soft");
        expect(tabs).toContain("border-border-strong");
    });
});
