/**
 * Unit tests for guards.ts - Security Module
 * Tests the requireGuildAdmin and requireGuildMember functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies BEFORE importing the module
vi.mock("@/auth", () => ({
    auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    db: {
        account: {
            findFirst: vi.fn(),
        },
    },
}));

vi.mock("@/server/discord", () => ({
    fetchGuild: vi.fn(),
    fetchGuildMember: vi.fn(),
    fetchGuildRoles: vi.fn(),
}));

vi.mock("@/server/actions/super-admin-actions", () => ({
    isGuildAllowed: vi.fn(),
}));

// Import after mocks
import { requireGuildAdmin, requireGuildMember } from "@/server/actions/guards";
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { isGuildAllowed } from "@/server/actions/super-admin-actions";

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockDbAccountFindFirst = db.account.findFirst as ReturnType<typeof vi.fn>;
const mockIsGuildAllowed = isGuildAllowed as ReturnType<typeof vi.fn>;

describe("guards.ts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsGuildAllowed.mockResolvedValue(true); // Default to allowed for most tests
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("requireGuildAdmin", () => {
        it("blocks unauthenticated users", async () => {
            mockAuth.mockResolvedValue(null);

            const result = await requireGuildAdmin("123456789");

            expect(result.isAuthorized).toBe(false);
            expect(result.error).toBe("Unauthorized");
        });

        it("blocks users without Discord account linked", async () => {
            mockAuth.mockResolvedValue({ user: { id: "user-1" } });
            mockDbAccountFindFirst.mockResolvedValue(null);

            const result = await requireGuildAdmin("123456789");

            expect(result.isAuthorized).toBe(false);
            expect(result.error).toBe("No Discord account linked");
        });

        it("allows guild owner", async () => {
            mockAuth.mockResolvedValue({ user: { id: "user-1" } });
            mockDbAccountFindFirst.mockResolvedValue({ providerAccountId: "discord-owner-id" });

            // Mock Discord API
            const { fetchGuild } = await import("@/server/discord");
            (fetchGuild as ReturnType<typeof vi.fn>).mockResolvedValue({
                owner_id: "discord-owner-id",
            });

            const result = await requireGuildAdmin("123456789");

            expect(result.isAuthorized).toBe(true);
            expect(result.discordUserId).toBe("discord-owner-id");
        });

        it("allows user with Administrator permission (0x8)", async () => {
            mockAuth.mockResolvedValue({ user: { id: "user-1" } });
            mockDbAccountFindFirst.mockResolvedValue({ providerAccountId: "discord-admin-id" });

            const { fetchGuild, fetchGuildMember, fetchGuildRoles } = await import("@/server/discord");
            (fetchGuild as ReturnType<typeof vi.fn>).mockResolvedValue({
                owner_id: "someone-else",
            });
            (fetchGuildMember as ReturnType<typeof vi.fn>).mockResolvedValue({
                roles: ["admin-role-id"],
            });
            (fetchGuildRoles as ReturnType<typeof vi.fn>).mockResolvedValue([
                { id: "admin-role-id", permissions: "8" }, // 0x8 = Administrator
            ]);

            const result = await requireGuildAdmin("123456789");

            expect(result.isAuthorized).toBe(true);
        });

        it("blocks non-admin guild members", async () => {
            mockAuth.mockResolvedValue({ user: { id: "user-1" } });
            mockDbAccountFindFirst.mockResolvedValue({ providerAccountId: "discord-member-id" });

            const { fetchGuild, fetchGuildMember, fetchGuildRoles } = await import("@/server/discord");
            (fetchGuild as ReturnType<typeof vi.fn>).mockResolvedValue({
                owner_id: "someone-else",
            });
            (fetchGuildMember as ReturnType<typeof vi.fn>).mockResolvedValue({
                roles: ["member-role-id"],
            });
            (fetchGuildRoles as ReturnType<typeof vi.fn>).mockResolvedValue([
                { id: "member-role-id", permissions: "0" }, // No special permissions
            ]);

            const result = await requireGuildAdmin("123456789");

            expect(result.isAuthorized).toBe(false);
            expect(result.error).toBe("Admin permission required");
        });

        it("blocks users not in the guild", async () => {
            mockAuth.mockResolvedValue({ user: { id: "user-1" } });
            mockDbAccountFindFirst.mockResolvedValue({ providerAccountId: "discord-stranger-id" });

            const { fetchGuild, fetchGuildMember } = await import("@/server/discord");
            (fetchGuild as ReturnType<typeof vi.fn>).mockResolvedValue({
                owner_id: "someone-else",
            });
            (fetchGuildMember as ReturnType<typeof vi.fn>).mockResolvedValue(null);

            const result = await requireGuildAdmin("123456789");

            expect(result.isAuthorized).toBe(false);
            expect(result.error).toBe("Not a member of this guild");
        });

        it("handles Discord API errors gracefully", async () => {
            mockAuth.mockResolvedValue({ user: { id: "user-1" } });
            mockDbAccountFindFirst.mockResolvedValue({ providerAccountId: "discord-id" });

            const { fetchGuild } = await import("@/server/discord");
            (fetchGuild as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Discord API down"));

            const result = await requireGuildAdmin("123456789");

            expect(result.isAuthorized).toBe(false);
            expect(result.error).toBe("Permission check failed");
        });
    });

    describe("requireGuildMember", () => {
        it("blocks unauthenticated users", async () => {
            mockAuth.mockResolvedValue(null);

            const result = await requireGuildMember("123456789");

            expect(result.isAuthorized).toBe(false);
            expect(result.error).toBe("Unauthorized");
        });

        it("blocks users without Discord account linked", async () => {
            mockAuth.mockResolvedValue({ user: { id: "user-1" } });
            mockDbAccountFindFirst.mockResolvedValue(null);

            const result = await requireGuildMember("123456789");

            expect(result.isAuthorized).toBe(false);
            expect(result.error).toBe("No Discord account linked");
        });

        it("allows guild members", async () => {
            mockAuth.mockResolvedValue({ user: { id: "user-1" } });
            mockDbAccountFindFirst.mockResolvedValue({ providerAccountId: "discord-member-id" });

            const { fetchGuildMember } = await import("@/server/discord");
            (fetchGuildMember as ReturnType<typeof vi.fn>).mockResolvedValue({
                roles: ["some-role"],
            });

            const result = await requireGuildMember("123456789");

            expect(result.isAuthorized).toBe(true);
            expect(result.discordUserId).toBe("discord-member-id");
        });

        it("blocks non-members", async () => {
            mockAuth.mockResolvedValue({ user: { id: "user-1" } });
            mockDbAccountFindFirst.mockResolvedValue({ providerAccountId: "discord-stranger-id" });

            const { fetchGuildMember } = await import("@/server/discord");
            (fetchGuildMember as ReturnType<typeof vi.fn>).mockResolvedValue(null);

            const result = await requireGuildMember("123456789");

            expect(result.isAuthorized).toBe(false);
            expect(result.error).toBe("Not a member of this guild");
        });

        it("handles Discord API errors gracefully", async () => {
            mockAuth.mockResolvedValue({ user: { id: "user-1" } });
            mockDbAccountFindFirst.mockResolvedValue({ providerAccountId: "discord-id" });

            const { fetchGuildMember } = await import("@/server/discord");
            (fetchGuildMember as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Discord 500"));

            const result = await requireGuildMember("123456789");

            expect(result.isAuthorized).toBe(false);
            expect(result.error).toBe("Permission check failed");
        });
    });
});
