/**
 * Onglet « Mules » du module Membres — déplacement de l'inventaire et tag « en guilde ».
 *
 * Demande user du 25/10/2026 : le visuel des mules déclarées quitte l'onglet Membres
 * (trop chargé) pour un onglet **Mules** dédié, qui porte aussi le compteur « en guilde
 * en jeu » (rôles Discord cochés + mules taguées).
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const MANAGEMENT = codeOnly(readFileSync("src/components/admin/members/member-management.tsx", "utf8"));
const SUMMARY = codeOnly(readFileSync("src/components/admin/members/member-mules-summary.tsx", "utf8"));
const PANEL = codeOnly(readFileSync("src/components/admin/members/in-game-guild-panel.tsx", "utf8"));
const PAGE = codeOnly(readFileSync("src/app/dashboard/[guildId]/admin/members/page.tsx", "utf8"));
const SCHEMA = codeOnly(readFileSync("prisma/schema.prisma", "utf8"));
const MIGRATION = readFileSync("prisma/migrations/20270118000000_add_in_game_guild_roles/migration.sql", "utf8");

describe("Onglet Mules", () => {
    it("est déclaré à côté de Membres / Rôles d'ancienneté / Blacklist", () => {
        // Renommé « Guilde et mules » le 29/10/2026 : l'onglet ne porte pas que des mules
        // (il porte aussi le compteur « en guilde en jeu »).
        expect(MANAGEMENT).toMatch(/\{ id: "mules", label: "Guilde et mules", icon: "guilde-et-mules\.png" \}/);
        expect(MANAGEMENT).toMatch(/<TabsContent value="mules"/);
        // `GameIcon` préfixe TOUJOURS `game-icons/` : un asset posé ailleurs = 404 silencieux
        // (mesuré le 29/10/2026 : l'icône ne s'affichait pas).
        expect(existsSync("public/assets/dofus/game-icons/guilde-et-mules.png")).toBe(true);
    });

    it("porte le compteur « en guilde en jeu » et l'inventaire des mules", () => {
        const mulesTab = MANAGEMENT.slice(
            MANAGEMENT.indexOf('<TabsContent value="mules"'),
            MANAGEMENT.indexOf('</TabsContent>', MANAGEMENT.indexOf('<TabsContent value="mules"'))
        );
        expect(mulesTab).toContain("<InGameGuildPanel");
        expect(mulesTab).toContain("<MemberMulesSummary");
    });

    it("l'inventaire ne reste plus dans l'onglet Membres", () => {
        const start = MANAGEMENT.indexOf('<TabsContent value="membres"');
        const membersTab = MANAGEMENT.slice(start, MANAGEMENT.indexOf("</TabsContent>", start));
        expect(membersTab).not.toContain("MemberMulesSummary");
    });
});

describe("Tag d'une mule", () => {
    it("la puce est un vrai bouton accessible, avec un état lisible", () => {
        expect(SUMMARY).toMatch(/aria-pressed=\{enGuilde\}/);
        expect(SUMMARY).toContain("En guilde");
        expect(SUMMARY).toMatch(/setMuleInGameGuild\(/);
    });

    it("le tag n'est proposé qu'à qui gère les membres (le reste est en lecture)", () => {
        expect(SUMMARY).toMatch(/const canTag = Boolean\(guildId && canManageMembers\)/);
        expect(SUMMARY).toMatch(/canToggle=\{canTag\}/);
    });

    it("la page charge la sélection persistée et la transmet", () => {
        expect(PAGE).toMatch(/inGameGuildRoleIds: true/);
        expect(PAGE).toMatch(/inGameGuildRoleIds=\{guildConfig\?\.inGameGuildRoleIds \?\? \[\]\}/);
    });
});

describe("Sélection des rôles — stockage additif", () => {
    it("la colonne est bornée et vide par défaut (aucun repli permissif)", () => {
        expect(SCHEMA).toMatch(/inGameGuildRoleIds\s+String\[\]\s+@default\(\[\]\)/);
    });

    it("la migration est ADDITIVE : aucun UPDATE, aucune réécriture", () => {
        expect(MIGRATION).toMatch(/ALTER TABLE "GuildConfig" ADD COLUMN "inGameGuildRoleIds" TEXT\[\] NOT NULL DEFAULT ARRAY\[\]::TEXT\[\]/);
        expect(MIGRATION).not.toMatch(/UPDATE|DELETE|DROP/i);
    });

    it("@everyone et les rôles de bot ne sont jamais proposés à la sélection", () => {
        expect(PANEL).toMatch(/\.filter\(\(role\) => role\.id !== guildId && role\.managed !== true\)/);
    });

    it("le compteur est calculé par la règle pure (aucun doublon)", () => {
        expect(PANEL).toMatch(/tallyInGameGuild\(\{ roleIds: selected, rows \}\)/);
    });

    it("les comptes de bots Discord sont exclus deux fois : à la source et dans la règle", () => {
        const SOURCE = codeOnly(readFileSync("src/server/actions/member-lifecycle-actions.ts", "utf8"));
        const RULE = codeOnly(readFileSync("src/lib/in-game-guild.ts", "utf8"));
        expect(SOURCE).toMatch(/member\?\.user\?\.bot/);
        expect(RULE).toMatch(/if \(row\.isBot === true\) continue;/);
        expect(PANEL).toContain("bots exclus");
    });

    it("un bouton « Tout décocher » remet la sélection à zéro sans l'enregistrer", () => {
        expect(PANEL).toContain("Tout décocher");
        expect(PANEL).toMatch(/onClick=\{\(\) => setSelected\(\[\]\)\}/);
        expect(PANEL).toMatch(/disabled=\{isPending \|\| selected\.length === 0\}/);
    });

    it("les rôles gérés par un bot sont signalés par la source (`managed`)", () => {
        const SOURCE = codeOnly(readFileSync("src/server/actions/member-lifecycle-actions.ts", "utf8"));
        expect(SOURCE).toMatch(/managed: role\.managed === true/);
    });
});

describe("Coche « en guilde » dans la modale membre", () => {
    const EDITOR = codeOnly(readFileSync("src/components/admin/members/member-mules-editor.tsx", "utf8"));
    const ACTIONS = codeOnly(readFileSync("src/server/actions/member-lifecycle-actions.ts", "utf8"));
    const DIALOG = codeOnly(readFileSync("src/components/admin/members/member-detail-dialog.tsx", "utf8"));

    it("chaque mule (existante ou en cours d'ajout) porte un oui/non explicite", () => {
        expect(EDITOR).toContain("function GuildeToggle(");
        expect(EDITOR).toMatch(/aria-pressed=\{active\}/);
        expect(EDITOR).toMatch(/label=\{`En guilde en jeu pour \$\{mule\.pseudo\}`\}/);
        expect(EDITOR).toMatch(/label="Nouvelle mule en guilde en jeu"/);
    });

    it("la bascule écrit `inGameGuild` dans la mule et le retire quand c'est « Non »", () => {
        expect(EDITOR).toMatch(/function patchGuilde\(index: number, value: boolean\)/);
        expect(EDITOR).toMatch(/if \(value\) return \{ \.\.\.mule, inGameGuild: true \};/);
        expect(EDITOR).toMatch(/delete next\.inGameGuild;/);
        expect(EDITOR).toMatch(/\.\.\.\(newInGameGuild \? \{ inGameGuild: true \} : \{\}\)/);
    });

    it("l'enregistrement ne perd pas la coche (schéma Zod + envoi tel quel)", () => {
        expect(ACTIONS).toMatch(/inGameGuild: z\.boolean\(\)\.optional\(\)/);
        expect(ACTIONS).toMatch(/data: \{ altPseudos: alts as never \}/);
        // Le dialogue envoie l'état local complet : aucun mapping intermédiaire.
        expect(DIALOG).toMatch(/updateMemberAlts\(guildId, subject, mules\)/);
    });
});
