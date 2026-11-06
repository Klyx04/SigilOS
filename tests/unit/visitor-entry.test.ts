/**
 * Espace visiteur (rang 57) — verrou de la **porte d'entrée** (D-V13).
 *
 * Deux choses cassent en silence et sont donc tenues ici :
 *  · la **règle** ne s'ouvre jamais par défaut — interrupteur fermé, Discord en échec ou
 *    moindre guilde ⇒ aucune redirection (fail-closed) ;
 *  · le **câblage** n'est recopié nulle part : `/dashboard` et la landing appellent la même
 *    garde et ne relisent pas l'interrupteur. Dupliquée, la condition divergerait au premier
 *    ajustement et un membre pourrait être pris pour un visiteur.
 *
 * Le câblage est vérifié à la source, comme `espace-visiteur-routes.test.ts` : une
 * redirection est une ligne de page serveur, pas un composant montable en unité.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { shouldOpenVisitorSpace } from "@/lib/visitor-entry";

const read = (path: string) => readFileSync(path, "utf8");

const SERVER = "src/server/visitor-entry.ts";
const DASHBOARD = "src/app/dashboard/page.tsx";
const LANDING = "src/app/page.tsx";
const HEADER = "src/components/layout/public-header.tsx";

describe("Porte visiteur — la règle ne s'ouvre jamais par défaut", () => {
    const ouvert = { visitorEntryEnabled: true, hasGuild: false, guildLookupFailed: false };

    it("ouvre pour un compte sans aucune guilde, quand l'interrupteur est posé", () => {
        expect(shouldOpenVisitorSpace(ouvert)).toBe(true);
    });

    it("interrupteur fermé : comportement d'avant le rang 57, aucune exception", () => {
        expect(shouldOpenVisitorSpace({ ...ouvert, visitorEntryEnabled: false })).toBe(false);
    });

    it("une guilde active, en attente de validation ou à déployer ferme la porte", () => {
        expect(shouldOpenVisitorSpace({ ...ouvert, hasGuild: true })).toBe(false);
    });

    it("Discord en échec : on ne conclut pas « pas de guilde » (fail-closed)", () => {
        // Rate-limit ou scope `guilds` refusé ⇒ listes vides côté portail : ce n'est pas
        // une preuve d'absence de guilde, donc jamais une redirection.
        expect(shouldOpenVisitorSpace({ ...ouvert, guildLookupFailed: true })).toBe(false);
        expect(
            shouldOpenVisitorSpace({ ...ouvert, hasGuild: true, guildLookupFailed: true })
        ).toBe(false);
    });
});

describe("Porte visiteur — les deux écrans lisent la même garde", () => {
    it("`/dashboard` et la landing appellent `redirectGuildlessUserToVisitorSpace`", () => {
        for (const page of [DASHBOARD, LANDING]) {
            expect(read(page), page).toMatch(/redirectGuildlessUserToVisitorSpace\(/);
        }
    });

    it("aucun écran ne relit l'interrupteur pour son compte (source unique)", () => {
        for (const page of [DASHBOARD, LANDING]) {
            expect(read(page), page).not.toMatch(/PUBLIC_VISITOR_ENTRY/);
        }
    });

    it("la garde re-vérifie le compte public avant de rediriger (anti-boucle / ⇄ espace)", () => {
        // `requirePublicSession` renvoie un compte banni sur `/` : sans cette re-vérification,
        // la landing le renverrait ici et la boucle ne s'arrêterait jamais.
        const code = read(SERVER);
        const garde = code.indexOf("getPublicSession()");
        const cible = code.indexOf('redirect("/espace-visiteur/general")');
        expect(garde).toBeGreaterThan(-1);
        expect(cible).toBeGreaterThan(garde);
        expect(code).toMatch(/if \(!account\) return;/);
    });
});

describe("Porte visiteur — l'entrée du menu avatar", () => {
    it("mène au premier onglet, avec un libellé traduit", () => {
        const code = read(HEADER);
        expect(code).toContain('href="/espace-visiteur/general"');
        expect(code).toContain("t.nav.visitorSpace");
    });

    it("le libellé existe dans les deux langues", () => {
        for (const locale of ["fr", "en"] as const) {
            expect(read(`src/lib/i18n/locales/${locale}.ts`), locale).toMatch(/visitorSpace:/);
        }
    });
});
