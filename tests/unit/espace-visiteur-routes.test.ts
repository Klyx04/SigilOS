/**
 * Espace visiteur (rang 57) — verrou des **routes** (lot V1c, D-V6).
 *
 * Un onglet = un **segment d'URL**, avec `loading.tsx` et `error.tsx` propres, et une garde
 * dans **chaque** page. Ce test échoue si quelqu'un ajoute un segment sans garde, ou si
 * `general` cesse d'être la seule page qui accepte l'absence de profil (écran de création).
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const ROOT = "src/app/espace-visiteur";
const SEGMENTS = ["general", "mules", "presentation", "succes", "metiers", "reglages"] as const;

const read = (path: string) => readFileSync(path, "utf8");

describe("Espace visiteur — les six segments existent et sont complets", () => {
    for (const segment of SEGMENTS) {
        it(`\`${segment}\` porte page + loading + error`, () => {
            for (const file of ["page.tsx", "loading.tsx", "error.tsx"]) {
                expect(existsSync(`${ROOT}/${segment}/${file}`), `${segment}/${file}`).toBe(true);
            }
        });
    }

    it("chaque `error.tsx` est un composant client", () => {
        for (const segment of SEGMENTS) {
            expect(read(`${ROOT}/${segment}/error.tsx`).trimStart().startsWith('"use client";')).toBe(true);
        }
    });
});

describe("Espace visiteur — la garde est dans la page, pas seulement dans le layout", () => {
    it("les cinq segments à profil exigent un compte complet", () => {
        for (const segment of ["mules", "presentation", "succes", "metiers", "reglages"] as const) {
            expect(read(`${ROOT}/${segment}/page.tsx`), segment).toMatch(/requirePublicAccount\(\)/);
        }
    });

    it("`general` est la seule page qui accepte l'absence de profil", () => {
        const general = read(`${ROOT}/general/page.tsx`);
        expect(general).toMatch(/requirePublicSession\(\)/);
        expect(general).toMatch(/loadPublicProfileView\(/);
        expect(general).not.toMatch(/requirePublicAccount\(\)/);
    });

    it("le layout pose la garde de session (défense en profondeur)", () => {
        expect(read(`${ROOT}/layout.tsx`)).toMatch(/requirePublicSession\(\)/);
    });
});

describe("Espace visiteur — entrée, exclusion des robots", () => {
    it("la racine route vers le premier onglet", () => {
        const page = read(`${ROOT}/page.tsx`);
        expect(page).toMatch(/redirect\("\/espace-visiteur\/general"\)/);
    });

    it("les robots n'explorent pas l'espace connecté", () => {
        expect(read("src/app/robots.ts")).toMatch(/'\/espace-visiteur\/'/);
    });
});
