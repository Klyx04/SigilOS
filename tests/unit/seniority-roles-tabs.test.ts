/**
 * Onglet « Rôles d'ancienneté » — découpage en **sous-onglets** (25/10/2026).
 *
 * L'écran était un seul scroll de plus de 1 000 px : activation, filtres, paliers,
 * message + aperçu, prochains paliers, état, passes. Chaque sujet a désormais sa vue.
 * Le bouton d'enregistrement reste **hors** des onglets : il sauvegarde le brouillon
 * commun quel que soit l'onglet ouvert.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const PANEL = codeOnly(readFileSync("src/components/admin/members/seniority-roles-panel.tsx", "utf8"));
const ACTIONS = codeOnly(readFileSync("src/server/actions/seniority-roles-actions.ts", "utf8"));

describe("Sous-onglets", () => {
    it("couvre les six sujets demandés (plus l'état et les passes)", () => {
        for (const tab of ["activation", "eligibilite", "paliers", "paliers-detail", "message", "prochains", "etat"]) {
            expect(PANEL, `onglet ${tab}`).toContain(`<TabsContent value="${tab}"`);
        }
        expect(PANEL).toContain('<TabsTrigger value="activation"');
        expect(PANEL).toContain('<TabsTrigger value="prochains"');
    });

    it("l'enregistrement reste accessible depuis n'importe quel onglet", () => {
        const tabsClose = PANEL.lastIndexOf("</Tabs>");
        const save = PANEL.lastIndexOf("Enregistrer");
        expect(tabsClose).toBeGreaterThan(-1);
        expect(save).toBeGreaterThan(tabsClose);
    });
});

describe("Activation — salon d'annonce", () => {
    it("affiche un aperçu de destination quand un salon est configuré", () => {
        expect(PANEL).toMatch(/getDiscordChannelInfo\(guildId, settings\.data\.channelId\)/);
        expect(PANEL).toContain("Aperçu de destination");
        expect(PANEL).toMatch(/discord\.com\/channels\/\$\{guildId\}\/\$\{data\.channelId\}/);
    });

    it("dit franchement qu'aucune annonce n'est envoyée sans salon", () => {
        expect(PANEL).toContain("Aucune annonce : les rôles sont posés en silence.");
        expect(PANEL).toContain("Configurer le salon");
    });
});

describe("Paliers", () => {
    it("l'onglet « Paliers » ajoute puis renvoie vers l'édition complète", () => {
        expect(PANEL).toContain("Ajouter un palier");
        expect(PANEL).toMatch(/addTier\(\);\s*setTab\("paliers-detail"\)/);
    });

    it("le résumé et le détail sont triés par seuil", () => {
        expect(PANEL).toContain("const sortedTiers = useMemo");
        expect(PANEL).toMatch(/sortedTiers\.map\(\(\{ tier, index \}\) =>/);
    });
});

describe("Prochains paliers — tri, rôle visé, pagination", () => {
    it("le payload transporte les rôles du palier visé", () => {
        expect(ACTIONS).toMatch(/tierRoleIds: string\[\]/);
        expect(ACTIONS).toMatch(/tierRoleIds: config\.tiers\[upcomingTier\.tierIndex\]\?\.roleIds \?\? \[\]/);
    });

    it("affiche le rôle récupéré par personne (desktop et mobile)", () => {
        expect(PANEL).toContain("Rôle visé");
        expect((PANEL.match(/roleNameById\.get\(roleId\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    });

    it("est paginé par 10, sans coupe silencieuse", () => {
        expect(PANEL).toContain("const UPCOMING_PAGE_SIZE = 10");
        expect(PANEL).toContain("const upcomingPageRows = upcoming.slice(");
        expect(PANEL).toMatch(/\{upcomingPageRows\.map\(\(member\) => \(/);
        expect(PANEL).not.toMatch(/\{data\.upcoming\.map\(/);
        expect(PANEL).toContain("Page {safeUpcomingPage + 1} / {upcomingPageCount}");
    });

    it("les boutons de pagination sont nommés", () => {
        expect(PANEL).toContain('aria-label="Page précédente des prochains paliers"');
        expect(PANEL).toContain('aria-label="Page suivante des prochains paliers"');
    });
});
