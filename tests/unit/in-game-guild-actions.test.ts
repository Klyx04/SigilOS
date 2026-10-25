/**
 * Actions « en guilde en jeu » — gardes de sécurité (lecture source).
 *
 * Deux mutations seulement : la sélection des rôles comptés et le tag d'une mule.
 * Chacune doit rester **fail-closed** : RBAC (`Gérer les membres` ou admin), cible
 * résolue **dans la guilde** avant écriture, entrées bornées, rate limit Redis, audit.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ACTIONS = codeOnly(readFileSync("src/server/actions/member-in-game-actions.ts", "utf8"));

describe("setInGameGuildRoleIds — rôles comptés", () => {
    it("exige une authentification et la permission de gérer les membres", () => {
        expect(ACTIONS).toMatch(/if \(!ctx\.isAuthenticated\) return/);
        expect(ACTIONS).toMatch(/if \(!ctx\.isAdmin && !ctx\.canManageMembers\)/);
    });

    it("valide les rôles contre ceux qui existent réellement sur Discord (fail-closed)", () => {
        expect(ACTIONS).toMatch(/fetchGuildRoles\(guildId, \{ excludeManaged: false \}\)/);
        expect(ACTIONS).toMatch(/if \(discordRoles\.length === 0\)/);
        expect(ACTIONS).toMatch(/normalizeInGameGuildRoleIds\(/);
    });

    it("est rate-limité en Redis et audité", () => {
        expect(ACTIONS).toMatch(/rateLimit\(`in-game-guild:roles:/);
        expect(ACTIONS).toMatch(/createAuditLog\(\{/);
        expect(ACTIONS).toMatch(/revalidatePath\(`\/dashboard\/\$\{guildId\}\/admin\/members`\)/);
    });
});

describe("setMuleInGameGuild — tag d'une mule", () => {
    it("résout la cible DANS la guilde avant toute écriture (isolation)", () => {
        expect(ACTIONS).toMatch(/where: \{ id: profileId, guildId: guild\.id \}/);
        expect(ACTIONS).toMatch(/where: \{ guildId: guild\.id, discordId \}/);
    });

    it("refuse une cible hors guilde et une mule absente", () => {
        expect(ACTIONS).toMatch(/if \(!owner\) return \{ success: false, error: "Membre introuvable dans cette guilde" \}/);
        expect(ACTIONS).toMatch(/if \(!matched\) return \{ success: false, error: "Mule introuvable sur ce membre" \}/);
    });

    it("compare le pseudo comme la règle pure et écrit `altPseudos`", () => {
        expect(ACTIONS).toMatch(/mulePseudoKey\(/);
        expect(ACTIONS).toMatch(/altPseudos: updated as never/);
    });

    it("est rate-limité, audité, et n'écrit que les deux porteurs de mules", () => {
        expect(ACTIONS).toMatch(/rateLimit\(`in-game-guild:mule:/);
        expect(ACTIONS).toMatch(/db\.userProfile\.update/);
        expect(ACTIONS).toMatch(/db\.memberRegistryEntry\.update/);
        expect(ACTIONS).not.toMatch(/db\.guildEvent/);
    });
});
