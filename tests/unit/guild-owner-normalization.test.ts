/**
 * D7 — **normalisation de `GuildConfig.ownerId`** vers l'identifiant interne.
 *
 * 🎯 Mesure locale du 17/11/2026 : 7 guildes → 3 `NULL`, 3 snowflakes (tous
 * résolubles par un compte Discord lié), 1 identifiant interne. La colonne était
 * donc ambiguë et **trois écrivains** pouvaient y remettre un snowflake :
 * l'onboarding, le self-heal de `getUserContext` et celui de la suppression RGPD.
 *
 * Ce verrou protège :
 *  ① la règle pure (classement + plan de backfill, sans accès base) ;
 *  ② `resolveGuildOwnerWriteId` (cible `User.id`, snowflake transitoire sinon) ;
 *  ③ les quatre chemins d'écriture (onboarding, self-heal, RGPD, transfert).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const mockFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: { account: { findFirst: (...args: unknown[]) => mockFindFirst(...args) } },
}));

import { classifyGuildOwnerId, planGuildOwnerBackfill } from "@/lib/god-guild-owner";
import { resolveGuildOwnerWriteId } from "@/server/guild-owner";

const SNOWFLAKE = "123456789012345678";
const OTHER_SNOWFLAKE = "987654321098765432";
const CUID = "clx0a1b2c3d4e5f6g7h8i9j0";
const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("classifyGuildOwnerId — nature de la valeur", () => {
    it("distingue nul, snowflake et identifiant interne", () => {
        expect(classifyGuildOwnerId(null)).toBe("NULL");
        expect(classifyGuildOwnerId("   ")).toBe("NULL");
        expect(classifyGuildOwnerId(SNOWFLAKE)).toBe("DISCORD_SNOWFLAKE");
        expect(classifyGuildOwnerId(` ${SNOWFLAKE} `)).toBe("DISCORD_SNOWFLAKE");
        expect(classifyGuildOwnerId(CUID)).toBe("INTERNAL");
        expect(classifyGuildOwnerId(UUID)).toBe("INTERNAL");
    });
});

describe("planGuildOwnerBackfill — aucune écriture, seulement un plan", () => {
    const rows = [
        { id: "g1", ownerId: SNOWFLAKE },
        { id: "g2", ownerId: OTHER_SNOWFLAKE },
        { id: "g3", ownerId: CUID },
        { id: "g4", ownerId: null },
    ];
    const plan = planGuildOwnerBackfill(rows, new Map([[SNOWFLAKE, "u1"]]));

    it("normalise un snowflake résolu vers User.id", () => {
        expect(plan.entries[0]).toEqual({ id: "g1", action: "UPDATE", from: SNOWFLAKE, to: "u1" });
    });

    it("laisse un snowflake sans compte lié en transition", () => {
        expect(plan.entries[1]).toEqual({ id: "g2", action: "UNRESOLVED", from: OTHER_SNOWFLAKE, to: null });
    });

    it("ne touche jamais un identifiant interne ni une valeur nulle", () => {
        expect(plan.entries[2]).toMatchObject({ action: "KEEP", to: CUID });
        expect(plan.entries[3]).toMatchObject({ action: "KEEP", to: null });
    });

    it("donne les compteurs exacts", () => {
        expect(plan.counts).toEqual({ total: 4, keep: 2, update: 1, unresolved: 1 });
    });
});

describe("resolveGuildOwnerWriteId — la cible est User.id", () => {
    beforeEach(() => {
        mockFindFirst.mockReset();
    });

    it("renvoie un identifiant interne sans lire la base", async () => {
        await expect(resolveGuildOwnerWriteId(CUID)).resolves.toBe(CUID);
        expect(mockFindFirst).not.toHaveBeenCalled();
    });

    it("résout un snowflake via Account.providerAccountId", async () => {
        mockFindFirst.mockResolvedValue({ userId: "u1" });
        await expect(resolveGuildOwnerWriteId(SNOWFLAKE)).resolves.toBe("u1");
        expect(mockFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { provider: "discord", providerAccountId: SNOWFLAKE },
            }),
        );
    });

    it("conserve le snowflake si aucun compte n'est lié (transition)", async () => {
        mockFindFirst.mockResolvedValue(null);
        await expect(resolveGuildOwnerWriteId(SNOWFLAKE)).resolves.toBe(SNOWFLAKE);
    });

    it("renvoie null pour une entrée vide", async () => {
        await expect(resolveGuildOwnerWriteId("  ")).resolves.toBeNull();
    });
});

describe("écriture unique — les chemins sont branchés", () => {
    const ADMIN = readFileSync("src/server/actions/admin-actions.ts", "utf8");
    const USER = readFileSync("src/server/actions/user-actions.ts", "utf8");
    const LIFECYCLE = readFileSync("src/server/actions/lifecycle-actions.ts", "utf8");
    const OWNER = readFileSync("src/server/actions/guild-owner-actions.ts", "utf8");

    it("l'onboarding résout l'identifiant interne", () => {
        expect(ADMIN).toContain("resolveGuildOwnerWriteId(");
        expect(ADMIN).not.toContain("ownerId: guildInfo.owner_id");
    });

    it("le self-heal de getUserContext écrit User.id, jamais le snowflake", () => {
        expect(USER).toContain("data: { ownerId: session.user.id }");
        expect(USER).not.toContain("data: { ownerId: discordUserId }");
    });

    it("le self-heal de la suppression RGPD résout avant d'écrire", () => {
        expect(LIFECYCLE).toContain("resolveGuildOwnerWriteId(currentOwnerId)");
    });

    it("le transfert de propriété écrit déjà un identifiant interne", () => {
        expect(OWNER).toContain("data: { ownerId: newOwnerUserId }");
    });
});
