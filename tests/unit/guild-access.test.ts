/**
 * Garde d'appartenance — `src/server/guild-access.ts`.
 *
 * Elle est la brique commune des actions réparées le 06/11/2026 (audit rang 57). Son
 * comportement doit être **fail-closed** : un `guildId` vide, une session absente, un
 * non-membre, un compte non authentifié ⇒ refus. Le cas nominal est le seul qui passe.
 *
 * `getUserContext` est mocké : ce test vérifie la **décision**, pas la RBAC de
 * `getUserContext` (qui a ses propres verrous).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUserContext } from "@/server/actions/user-actions";
import { assertGuildMemberAccess } from "@/server/guild-access";

vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn(),
}));

const context = (overrides: Record<string, unknown> = {}) => ({
    isAuthenticated: true,
    isMember: true,
    isSuperAdmin: false,
    ...overrides,
});

describe("assertGuildMemberAccess — fail-closed", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("refuse un identifiant vide, nul ou non textuel sans interroger la base", async () => {
        for (const bad of ["", "   ", null, undefined, 42 as unknown as string]) {
            const result = await assertGuildMemberAccess(bad);
            expect(result.ok, String(bad)).toBe(false);
        }
        expect(getUserContext).not.toHaveBeenCalled();
    });

    it("refuse un compte non authentifié", async () => {
        vi.mocked(getUserContext).mockResolvedValue(context({ isAuthenticated: false, isMember: false }) as never);
        const result = await assertGuildMemberAccess("guild-1");
        expect(result).toEqual({ ok: false, error: "Accès refusé." });
    });

    it("refuse un utilisateur authentifié mais PAS membre de cette guilde", async () => {
        vi.mocked(getUserContext).mockResolvedValue(context({ isMember: false }) as never);
        const result = await assertGuildMemberAccess("guild-1");
        expect(result).toEqual({ ok: false, error: "Accès refusé." });
    });

    it("autorise un membre", async () => {
        vi.mocked(getUserContext).mockResolvedValue(context() as never);
        const result = await assertGuildMemberAccess("guild-1");
        expect(result).toEqual({ ok: true });
        expect(getUserContext).toHaveBeenCalledWith("guild-1");
    });
});
