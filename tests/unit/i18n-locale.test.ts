import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, SUPPORTED_LOCALES } from "@/lib/i18n/types";

/**
 * i18n — langue par défaut du site PUBLIC (décision mesurée du 25/09/2026).
 *
 * Contexte : Googlebot se présente très souvent en `en-US`. La résolution lisait `accept-language`
 * et lui servait donc la version **anglaise** d'une page dont le `canonical` désigne l'**URL FR**
 * (une seule adresse par page, pas de chemin `/en/...`) → contenu servi ≠ URL déclarée, et un
 * titre/extrait possiblement en anglais pour une audience française. Search Console (25/09) ne
 * montre **aucune requête anglophone** : on assume donc le FR par défaut, et la langue ne vient
 * plus que d'un choix **explicite** (sélecteur → cookie) ou de `?lang=`.
 *
 * Ce test verrouille les deux extrémités : plus de détection automatique côté serveur, ET un
 * sélecteur de langue toujours présent sur les pages publiques (sinon l'anglais deviendrait
 * inaccessible).
 */
const SERVER = "src/lib/i18n/server.ts";
const PUBLIC_HEADER = "src/components/layout/public-header.tsx";
const source = (p: string) => readFileSync(p, "utf8");

/**
 * Retire les lignes de commentaire : le commentaire de décision cite volontairement la forme
 * interdite (`accept-language`), et c'est le CODE qu'on veut contrôler, pas la prose.
 */
const sansCommentaires = (src: string) =>
    src
        .split("\n")
        .filter((line) => {
            const t = line.trim();
            return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
        })
        .join("\n");

describe("locale publique — FR par défaut, jamais l'en-tête du visiteur", () => {
    it("ne lit plus `accept-language` (Googlebot arrive en en-US)", () => {
        expect(sansCommentaires(source(SERVER))).not.toMatch(/accept-language/i);
    });

    it("lit une source EXPLICITE : header du proxy, cookie, puis `?lang=`", () => {
        const src = source(SERVER);
        expect(src).toMatch(/x-sigilos-locale/);
        expect(src).toMatch(/LOCALE_COOKIE_NAME/);
        expect(src).toMatch(/searchParams\.get\("lang"\)/);
    });

    it("le défaut reste le français", () => {
        expect(DEFAULT_LOCALE).toBe("fr");
        expect(SUPPORTED_LOCALES).toContain("en");
        expect(LOCALE_COOKIE_NAME).toBeTruthy();
    });

    it("le sélecteur de langue est toujours affiché sur les pages publiques", () => {
        // Sans lui, retirer la détection automatique rendrait l'anglais inaccessible aux visiteurs.
        expect(source(PUBLIC_HEADER)).toMatch(/<LanguageToggle\s*\/>/);
    });
});
