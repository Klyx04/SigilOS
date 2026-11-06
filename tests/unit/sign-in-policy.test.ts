/**
 * Espace visiteur — verrou de la **décision de connexion**.
 *
 * 🎯 Ouvrir `signIn` aux comptes sans guilde est le geste le plus risqué du chantier
 * rang 57 : c'est la porte d'entrée de la plateforme. Quatre cas doivent rester vrais :
 *
 * 1. un **membre** entre comme avant ;
 * 2. un **inconnu** entre comme **visiteur** (nouveau) ;
 * 3. une **API Discord en échec** refuse un inconnu (fail-closed) ;
 * 4. l'**interrupteur** referme la porte sans redéployer.
 *
 * Et un cinquième, hors de cette règle : un visiteur n'ouvre **aucune** page du dashboard —
 * c'est le layout qui le refuse (`getUserContext`), verrouillé plus bas.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { decideSignInAccess, isVisitorEntryEnabled, type SignInFacts } from "@/lib/sign-in-policy";

const facts = (overrides: Partial<SignInFacts> = {}): SignInFacts => ({
    hasManagedGuild: false,
    isKnownManagedMember: false,
    discordApiOk: true,
    visitorEntryEnabled: true,
    ...overrides,
});

describe("Décision de connexion — membre", () => {
    it("un compte d'une guilde gérée entre comme membre", () => {
        expect(decideSignInAccess(facts({ hasManagedGuild: true }))).toEqual({
            allow: true,
            as: "member",
        });
    });

    it("un membre ACTIVE connu entre même si l'API Discord est KO (tolérance ciblée)", () => {
        expect(
            decideSignInAccess(facts({ discordApiOk: false, isKnownManagedMember: true }))
        ).toEqual({ allow: true, as: "member" });
    });
});

describe("Décision de connexion — visiteur (rang 57)", () => {
    it("un compte sans guilde entre comme visiteur quand l'API répond", () => {
        expect(decideSignInAccess(facts())).toEqual({ allow: true, as: "visitor" });
    });

    it("l'interrupteur referme la porte : refus NO_MANAGED_GUILD", () => {
        expect(decideSignInAccess(facts({ visitorEntryEnabled: false }))).toEqual({
            allow: false,
            reason: "NO_MANAGED_GUILD",
        });
    });
});

describe("Décision de connexion — fail-closed", () => {
    it("API Discord en échec + inconnu = refus, jamais un visiteur par défaut", () => {
        expect(decideSignInAccess(facts({ discordApiOk: false }))).toEqual({
            allow: false,
            reason: "DISCORD_API_ERROR",
        });
    });

    it("la tolérance « membre connu » ne s'applique pas à un inconnu", () => {
        const decision = decideSignInAccess(facts({ discordApiOk: false, isKnownManagedMember: false }));
        expect(decision.allow).toBe(false);
    });

    it("un membre reste autorisé même si l'interrupteur visiteur est fermé", () => {
        expect(
            decideSignInAccess(facts({ hasManagedGuild: true, visitorEntryEnabled: false }))
        ).toEqual({ allow: true, as: "member" });
    });
});

describe("Interrupteur d'exploitation", () => {
    it("fermé par défaut : la porte ne s'ouvre que sur `1`", () => {
        expect(isVisitorEntryEnabled({})).toBe(false);
        expect(isVisitorEntryEnabled({ PUBLIC_VISITOR_ENTRY: "0" })).toBe(false);
        expect(isVisitorEntryEnabled({ PUBLIC_VISITOR_ENTRY: "1" })).toBe(true);
    });
});

describe("La porte visiteur n'ouvre PAS le dashboard", () => {
    const layout = readFileSync("src/app/dashboard/[guildId]/layout.tsx", "utf8");

    it("le layout du dashboard garde tout l'arbre par getUserContext", () => {
        expect(layout).toMatch(/getUserContext\(guildId\)/);
        expect(layout).toMatch(/AccessDenied/);
    });

    it("chaque page est gardée : `getUserContext` ou une redirection", () => {
        // Mesure du 06/11/2026 : 70 pages, 11 sans `getUserContext` — toutes redirigent
        // (redirections d'anciennes routes, hub, tracker qui lit une action gardée).
        // L'invariant : aucune page ne sert de donnée sans garde ni redirection.
        const root = "src/app/dashboard/[guildId]";
        const pages: string[] = [];
        const walk = (dir: string) => {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                const full = `${dir}/${entry.name}`;
                if (entry.isDirectory()) walk(full);
                else if (entry.name === "page.tsx") pages.push(full);
            }
        };
        walk(root);

        expect(pages.length).toBeGreaterThanOrEqual(70);
        const unguarded = pages.filter((file) => {
            const src = readFileSync(file, "utf8");
            return !/getUserContext|getDashboardContext|requireGuildAccess/.test(src) && !/redirect\(/.test(src);
        });
        expect(unguarded).toEqual([]);
    });

    it("la garde du compte public re-vérifie le bannissement (session JWT de 8 h)", () => {
        const guard = readFileSync("src/server/public-account.ts", "utf8");
        expect(guard).toMatch(/export async function getPublicAccount/);
        expect(guard).toMatch(/export async function requirePublicAccount/);
        expect(guard).toMatch(/platformBan\.findFirst/);
        expect(guard).toMatch(/redirect\("\/"\)/);
    });
});
