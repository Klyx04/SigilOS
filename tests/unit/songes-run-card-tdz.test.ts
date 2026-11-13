/**
 * Songes — un helper local déclaré **après** son appel = `ReferenceError` en production.
 *
 * Défaut mesuré le 30/10/2026 (Sentry `JAVASCRIPT-NEXTJS-2C`, bêta) : `/songes` affichait
 * « Section Indisponible » avec `Cannot access 'aG' before initialization`.
 * Cause : `RunCard.tsx` calculait `transferCandidates` (ligne ~120) en appelant `getDisplayName`,
 * alors que ce `const` était déclaré **ligne ~160** — zone morte temporelle. Le bug ne se
 * déclenchait que sur une run **avec au moins un membre** (sinon le `map` n'appelait personne),
 * d'où un écran cassé « par intermittence ».
 *
 * La garde est volontairement **locale au module Songes** (là où la régression a eu lieu) et
 * s'appuie sur une heuristique simple : pour chaque `const nom = (…) =>`, la première occurrence
 * de `nom(` doit venir APRÈS la déclaration. Aucun rendu, aucune base.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const SONGES_DIR = "src/components/songes";

const withoutComments = (src: string) =>
    src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

function offendingHelpers(source: string): string[] {
    const src = withoutComments(source);
    const offenders: string[] = [];
    const declaration = /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g;
    for (const match of src.matchAll(declaration)) {
        const name = match[1];
        const declIndex = match.index ?? -1;
        const firstCall = src.indexOf(`${name}(`);
        if (declIndex >= 0 && firstCall >= 0 && firstCall < declIndex) offenders.push(name);
    }
    return offenders;
}

describe("Songes — aucun helper local appelé avant sa déclaration (zone morte)", () => {
    it("RunCard : `getDisplayName` est déclaré avant le `map` qui l'appelle", () => {
        const src = withoutComments(readFileSync("src/components/songes/RunCard.tsx", "utf8"));
        const decl = src.indexOf("const getDisplayName =");
        const firstUse = src.indexOf("getDisplayName(m.userId)");
        expect(decl).toBeGreaterThan(-1);
        expect(firstUse).toBeGreaterThan(-1);
        expect(decl).toBeLessThan(firstUse);
    });

    it("tout le module Songes est sain (const local jamais utilisé avant sa déclaration)", () => {
        const files = readdirSync(SONGES_DIR).filter((file) => file.endsWith(".tsx"));
        const offenders = files.flatMap((file) => {
            const source = readFileSync(path.join(SONGES_DIR, file), "utf8");
            return offendingHelpers(source).map((name) => `${file}: ${name}`);
        });
        expect(offenders).toEqual([]);
    });
});
