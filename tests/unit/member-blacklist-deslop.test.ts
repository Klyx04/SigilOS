/**
 * Onglet **Blacklist** — verrou anti-slop.
 *
 * Refonte du 25/10/2026 : l'onglet empilait `font-black`, italiques décoratifs,
 * rayons 16-24 px, un gros bouton rouge plein et des actions **invisibles** au survol
 * (`opacity-0`, donc inaccessibles au clavier et au tactile). Ce test verrouille la
 * politique : une seule teinte d'accent, rayons sobres, actions nommées et visibles.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const CODE = codeOnly(readFileSync("src/components/admin/members/member-blacklist.tsx", "utf8"));

describe("Blacklist — habillage", () => {
    it("aucune graisse décorative, aucun italique, aucun interlettrage forcé", () => {
        expect(CODE).not.toMatch(/font-black/);
        expect(CODE).not.toMatch(/\bitalic\b/);
        expect(CODE).not.toMatch(/tracking-widest/);
    });

    it("rayons ≤ 8 px et aucun effet de flou", () => {
        for (const radius of ["rounded-xl", "rounded-2xl", "rounded-3xl"]) {
            expect(CODE, radius).not.toMatch(new RegExp(`\\b${radius}\\b`));
        }
        expect(CODE).not.toMatch(/backdrop-blur|glass-premium/);
    });

    it("une seule teinte d'accent : le primaire est `accent`, plus de gros bouton rouge plein", () => {
        expect(CODE).toMatch(/text-accent/);
        expect(CODE).not.toMatch(/bg-danger/);
    });
});

describe("Blacklist — accessibilité", () => {
    it("les actions de ligne sont toujours visibles (jamais `opacity-0` au survol)", () => {
        expect(CODE).not.toMatch(/opacity-0/);
    });

    it("les boutons d'action sont nommés", () => {
        expect(CODE).toMatch(/aria-label=\{`Modifier le signalement de \$\{entry\.addedByName\}`\}/);
        expect(CODE).toMatch(/aria-label=\{`Supprimer le signalement de \$\{entry\.addedByName\}`\}/);
    });

    it("le champ est relié à son libellé et à son aide", () => {
        expect(CODE).toMatch(/htmlFor="blacklist-content"/);
        expect(CODE).toMatch(/id="blacklist-content"/);
        expect(CODE).toMatch(/aria-describedby="blacklist-help"/);
        expect(CODE).toMatch(/id="blacklist-help"/);
    });

    it("la recherche est nommée", () => {
        expect(CODE).toMatch(/aria-label="Rechercher dans la blacklist"/);
    });
});

describe("Blacklist — comportement conservé", () => {
    it("ajout, édition inline, suppression et synchronisation Discord sont toujours branchés", () => {
        expect(CODE).toMatch(/addBlacklistEntry\(/);
        expect(CODE).toMatch(/editBlacklistEntry\(/);
        expect(CODE).toMatch(/deleteBlacklistEntry\(/);
        expect(CODE).toMatch(/tab=blacklist/);
    });

    it("les teintes sémantiques distinguent le pseudo signalé et la guilde", () => {
        expect(CODE).toMatch(/font-semibold text-danger/); // pseudo
        expect(CODE).toMatch(/text-danger\/70/); // discriminant #1234
        expect(CODE).toMatch(/font-medium text-warning/); // Guilde [TAG]
        // Toujours aucune graisse décorative : la couleur suffit à distinguer.
        expect(CODE).not.toMatch(/font-black/);
    });

    it("l'écran dit ce qui est réellement arrivé à l'embed Discord", () => {
        expect(CODE).toContain("discordSyncToast");
        expect(CODE).toContain("embed reposté sur Discord");
        expect(CODE).toContain("Discord n’a pas pu être mis à jour");
    });
});
