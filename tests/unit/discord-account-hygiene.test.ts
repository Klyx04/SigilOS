/**
 * #223 P3.2 — Révocation de session Auth.js sur APPLICATION_DEAUTHORIZED.
 * Vérifie : validation du snowflake (fail-closed), dé-liaison Account + purge Session,
 * no-op si aucun compte, et best-effort (jamais de throw → l'ACK 204 du webhook part).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────
const mockAccountFindFirst = vi.fn();
const mockAccountDeleteMany = vi.fn();
const mockSessionDeleteMany = vi.fn();
const mockProfileUpdateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        account: {
            findFirst: (...args: any[]) => mockAccountFindFirst(...args),
            deleteMany: (...args: any[]) => mockAccountDeleteMany(...args),
        },
        session: {
            deleteMany: (...args: any[]) => mockSessionDeleteMany(...args),
        },
        userProfile: {
            updateMany: (...args: any[]) => mockProfileUpdateMany(...args),
        },
    },
}));

import { revokeDiscordAccountSession } from "@/lib/discord-account-hygiene";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("revokeDiscordAccountSession (APPLICATION_DEAUTHORIZED)", () => {
    it("refuse un discordUserId invalide (fail-closed, aucun appel DB)", async () => {
        const result = await revokeDiscordAccountSession("not-a-snowflake");
        expect(result).toEqual({ revoked: false, reason: "invalid-discord-id" });
        expect(mockAccountFindFirst).not.toHaveBeenCalled();
        expect(mockAccountDeleteMany).not.toHaveBeenCalled();
    });

    it("no-op si aucun compte SigilOS n'est lié à ce discordId", async () => {
        mockAccountFindFirst.mockResolvedValue(null);
        const result = await revokeDiscordAccountSession("123456789012345678");
        expect(result).toEqual({ revoked: false, reason: "no-account" });
        expect(mockAccountDeleteMany).not.toHaveBeenCalled();
        expect(mockSessionDeleteMany).not.toHaveBeenCalled();
    });

    it("dé-lie le compte OAuth ET purge les sessions (hygiène complète)", async () => {
        mockAccountFindFirst.mockResolvedValue({ userId: "user-42" });
        mockProfileUpdateMany.mockResolvedValue({ count: 1 });
        mockAccountDeleteMany.mockResolvedValue({ count: 1 });
        mockSessionDeleteMany.mockResolvedValue({ count: 3 });

        const result = await revokeDiscordAccountSession("123456789012345678");

        expect(result).toEqual({ revoked: true, userId: "user-42" });
        // #8 : les profils ACTIVE sont archivés AVANT la dé-liaison (anti-fantôme)
        expect(mockProfileUpdateMany).toHaveBeenCalledWith({
            where: { userId: "user-42", status: "ACTIVE" },
            data: expect.objectContaining({ status: "ARCHIVED", archiveReason: "DEAUTHORIZED" }),
        });
        expect(mockAccountDeleteMany).toHaveBeenCalledWith({
            where: { userId: "user-42", provider: "discord" },
        });
        expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-42" } });
    });

    it("best-effort : une erreur DB ne throw JAMAIS (revoked=false, reason=error)", async () => {
        mockAccountFindFirst.mockRejectedValue(new Error("DB down"));
        const result = await revokeDiscordAccountSession("123456789012345678");
        expect(result).toEqual({ revoked: false, reason: "error" });
    });
});
