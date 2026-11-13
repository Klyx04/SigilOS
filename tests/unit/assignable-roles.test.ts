/**
 * Gardes — rôles Discord réellement attribuables par un geste de staff.
 *
 * Mesure du 09/11/2026 : l'API refuse un rôle **au-dessus ou au même niveau** que le rôle le
 * plus haut du bot (403), et un staff non administrateur ne doit agir que sous son propre rôle
 * le plus haut. La règle est pure : elle se teste ici, pas à l'écran.
 */

import { describe, it, expect } from "vitest";
import {
    filterAssignableRoles,
    highestRolePosition,
    type DiscordRoleLike,
} from "@/lib/discord/assignable-roles";

const GUILD = "111111111111111111";
const role = (id: string, position: number, over: Partial<DiscordRoleLike> = {}): DiscordRoleLike => ({
    id,
    name: `rôle ${id}`,
    position,
    managed: false,
    ...over,
});

describe("rôles attribuables — ce que le bot peut réellement poser", () => {
    it("exclut @everyone, les rôles gérés et tout ce qui atteint le niveau du bot", () => {
        const roles = [
            role(GUILD, 99),               // @everyone
            role("trop-haut", 4),           // même niveau que le bot
            role("gere", 3, { managed: true }),
            role("ok", 1),
        ];
        const out = filterAssignableRoles(roles, {
            guildId: GUILD,
            botPosition: 4,
            staffPosition: Number.POSITIVE_INFINITY,
        });
        expect(out.map((r) => r.id)).toEqual(["ok"]);
    });

    it("le plafond effectif est le plus bas des deux (bot, staff)", () => {
        const roles = [role("a", 3), role("b", 2), role("c", 1)];
        const out = filterAssignableRoles(roles, {
            guildId: GUILD,
            botPosition: 10,
            staffPosition: 2,
        });
        expect(out.map((r) => r.id)).toEqual(["c"]);
    });

    it("un administrateur (sans plafond staff) reste borné par le rôle du bot", () => {
        const roles = [role("a", 3), role("b", 1)];
        const out = filterAssignableRoles(roles, {
            guildId: GUILD,
            botPosition: 3,
            staffPosition: Number.POSITIVE_INFINITY,
        });
        expect(out.map((r) => r.id)).toEqual(["b"]);
    });

    it("fail-closed : position du bot inconnue ⇒ aucune proposition", () => {
        expect(
            filterAssignableRoles([role("a", 1)], {
                guildId: GUILD,
                botPosition: 0,
                staffPosition: Number.POSITIVE_INFINITY,
            })
        ).toEqual([]);
    });

    it("trie de haut en bas, comme Discord", () => {
        const out = filterAssignableRoles(
            [role("bas", 1), role("haut", 3), role("milieu", 2)],
            { guildId: GUILD, botPosition: 10, staffPosition: Number.POSITIVE_INFINITY }
        );
        expect(out.map((r) => r.id)).toEqual(["haut", "milieu", "bas"]);
    });
});

describe("position la plus haute d'un membre", () => {
    it("ne retient que les rôles réellement portés", () => {
        const roles = [role("a", 9), role("b", 4), role("c", 1)];
        expect(highestRolePosition(["b", "c"], roles)).toBe(4);
    });

    it("0 quand aucun rôle du catalogue n'est porté", () => {
        expect(highestRolePosition([], [role("a", 9)])).toBe(0);
        expect(highestRolePosition(["inconnu"], [role("a", 9)])).toBe(0);
    });
});
