/**
 * 🧭 Supervision Marché (God) — décisions user du 18/09/2026, gardes de source.
 *
 *   1. **Rôles notifiables** : réglage **local par nature** ⇒ il est édité
 *      **uniquement** dans *Réglages → Marché* de la guilde
 *      (`PingRolesSelector` + `updateMarketSettings`). La console God ne doit
 *      plus le proposer — ni exposer ses actions — sinon deux vérités reviennent.
 *   2. **Journal du Marché** : il a migré vers **God → Audit Logs** (onglet
 *      « Marché »), là où vivent les autres journaux ; la page de supervision ne
 *      l'affiche plus et `getGodMarketOverview` ne le lit plus.
 *   3. **Cadre de page** : le shell God ne pose aucune marge — la page fournit la
 *      sienne (`max-w-[2500px] px-4 lg:px-12`, comme `god-dashboard-client`).
 *      Sans elle, le contenu collait à la sidebar et à droite de la fenêtre.
 *
 * Tests **en lecture seule** (analyse de source, aucun import d'action, aucune
 * requête) : ils échouent bruyamment si l'extraction ne trouve rien.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function read(path: string): string {
    return readFileSync(path, "utf8");
}

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const PANEL = "src/app/god/market/_components/god-market-panel.tsx";
const MARKET_PAGE = "src/app/god/market/page.tsx";
const GOD_ACTIONS = "src/server/actions/god-market-actions.ts";
const LOGS_TABS = "src/app/god/logs/logs-tabs.tsx";
const LOGS_PAGE = "src/app/god/logs/page.tsx";
const MARKET_LOG_VIEW = "src/app/god/logs/market-log-view.tsx";
const GUILD_SETTINGS = "src/app/dashboard/[guildId]/admin/_components/market-settings-client.tsx";

describe("God → Marché — les « rôles notifiables » ne sont plus un réglage plateforme", () => {
    it("le panneau de supervision ne porte plus le bloc rôles (carte + liste)", () => {
        const source = codeOnly(read(PANEL));
        expect(source, "l'écran de supervision ne configure plus les pings").not.toMatch(
            /MarketPingRolesCard|MarketPingRoleList/
        );
        expect(source, "plus d'appel aux actions de rôles Discord").not.toMatch(
            /getGodMarketPingRoles|saveGodMarketPingRoles/
        );
    });

    it("les actions God de rôles Discord (et la lecture des rôles) ont disparu", () => {
        const source = codeOnly(read(GOD_ACTIONS));
        expect(source).not.toMatch(/GodMarketPingRoles/);
        expect(source, "plus d'appel Discord pour lister des rôles").not.toMatch(/fetchGuildRoles/);
    });

    it("le réglage reste éditable dans la guilde (une seule maison)", () => {
        const source = codeOnly(read(GUILD_SETTINGS));
        expect(source).toMatch(/PingRolesSelector/);
        expect(source).toMatch(/marketAllowedPingRoleIds/);
    });

    it("l'étape de notification renvoie aux réglages de la guilde, plus à la console God", () => {
        const source = read("src/app/dashboard/[guildId]/marche/_components/market-notify-step.tsx");
        expect(source, "la console God n'héberge plus ce réglage").not.toMatch(/console God/);
        expect(source).toMatch(/Réglages → Marché/);
    });
});

describe("God → Marché — le journal du marché a migré vers Audit Logs", () => {
    it("la supervision n'affiche plus le journal et ne le lit plus", () => {
        const panel = codeOnly(read(PANEL));
        expect(panel).not.toMatch(/Journal du Marché/);
        expect(panel).not.toMatch(/listGodMarketAuditLogs/);

        const actions = codeOnly(read(GOD_ACTIONS));
        expect(actions, "la vue d'ensemble ne renvoie plus de journal").not.toMatch(/logs:\s*GodMarketLogRow/);
    });

    it("l'onglet « Marché » existe dans God → Audit Logs", () => {
        const tabs = codeOnly(read(LOGS_TABS));
        expect(tabs).toMatch(/value="market"/);
        expect(tabs).toMatch(/MarketLogView/);

        const page = codeOnly(read(LOGS_PAGE));
        expect(page).toMatch(/listGodMarketAuditLogs\(\{ limit: 50 \}\)/);
        expect(page, "filtres par id **interne** de guilde").toMatch(/listGodMarketGuilds\(\)/);
    });

    it("l'onglet lit le journal via l'action gardée, avec des dates déterministes", () => {
        const source = codeOnly(read(MARKET_LOG_VIEW));
        expect(source).toMatch(/listGodMarketAuditLogs/);
        expect(source, "filtre = id interne de guilde, jamais un snowflake").toMatch(/guildConfigId/);
        expect(source, "aucun `toLocaleString` (écart d'hydratation serveur/navigateur)").not.toMatch(
            /toLocaleString/
        );
        expect(source).toMatch(/formatMarketDateTime/);
    });
});

describe("God → Marché — cadre de page (marges du shell God)", () => {
    it("la page de supervision fournit son propre conteneur (comme l'onglet principal)", () => {
        const source = codeOnly(read(MARKET_PAGE));
        expect(source, "conteneur identique à `god-dashboard-client`").toMatch(/max-w-\[2500px\]/);
        expect(source).toMatch(/px-4 lg:px-12/);
    });

    it("le panneau n'utilise plus `toLocaleString` (dates déterministes du module)", () => {
        const source = codeOnly(read(PANEL));
        expect(source).not.toMatch(/toLocaleString/);
        expect(source).toMatch(/formatMarketDateTime/);
    });
});
