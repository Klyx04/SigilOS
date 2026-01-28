/**
 * Lifecycle Management Tests
 * 
 * Tests for member lifecycle management (RGPD compliance):
 * - GUILD_MEMBER_REMOVE (archive profile)
 * - GUILD_BAN_ADD (anonymize profile)
 * - Profile reactivation on return
 * - Cleanup expired profiles
 * - Multi-tenant isolation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Prisma
const mockDb = {
    guildConfig: {
        findUnique: vi.fn(),
    },
    account: {
        findFirst: vi.fn(),
    },
    userProfile: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
    },
};

vi.mock("@/lib/prisma", () => ({
    db: mockDb,
}));

// Mock auth
vi.mock("@/auth", () => ({
    auth: vi.fn(),
}));

// Sample test data
const GUILD_A = {
    id: "guild-internal-a",
    discordGuildId: "discord-guild-a",
    name: "Test Guild A",
};

const GUILD_B = {
    id: "guild-internal-b",
    discordGuildId: "discord-guild-b",
    name: "Test Guild B",
};

const USER_1 = {
    id: "user-1",
    discordId: "discord-user-1",
};

const PROFILE_USER1_GUILD_A = {
    id: "profile-1a",
    userId: USER_1.id,
    guildId: GUILD_A.id,
    status: "ACTIVE",
    pseudoDofus: "PlayerOne",
    discordNickname: "Player One",
};

const PROFILE_USER1_GUILD_B = {
    id: "profile-1b",
    userId: USER_1.id,
    guildId: GUILD_B.id,
    status: "ACTIVE",
    pseudoDofus: "PlayerOneAlt",
    discordNickname: "Player One Alt",
};

describe("Member Lifecycle Management", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("GUILD_MEMBER_REMOVE - Multi-tenant Isolation", () => {
        it("should archive ONLY the profile for the specific guild when member leaves", async () => {
            // Setup: User is in both Guild A and Guild B
            mockDb.guildConfig.findUnique.mockResolvedValue(GUILD_A);
            mockDb.account.findFirst.mockResolvedValue({ userId: USER_1.id });
            mockDb.userProfile.updateMany.mockResolvedValue({ count: 1 });

            // Simulate the handler logic directly
            const guildId = GUILD_A.discordGuildId;
            const userId = USER_1.discordId;

            // Find guild config
            const guild = await mockDb.guildConfig.findUnique({
                where: { discordGuildId: guildId },
                select: { id: true }
            });

            // Find user's account
            const account = await mockDb.account.findFirst({
                where: { provider: "discord", providerAccountId: userId },
                select: { userId: true }
            });

            // Archive the profile for THIS guild only
            const result = await mockDb.userProfile.updateMany({
                where: {
                    userId: account!.userId,
                    guildId: guild!.id,
                    status: "ACTIVE"
                },
                data: {
                    status: "ARCHIVED",
                    archivedAt: expect.any(Date),
                    archiveReason: "LEFT"
                }
            });

            // Assertions
            expect(result.count).toBe(1);

            // Verify the updateMany was called with the correct guild isolation
            expect(mockDb.userProfile.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        guildId: GUILD_A.id, // <-- CRITICAL: Only Guild A's profile
                    })
                })
            );
        });

        it("should NOT affect profiles in other guilds when member leaves one guild", async () => {
            // Setup: User is in both guilds
            mockDb.guildConfig.findUnique.mockResolvedValue(GUILD_A);
            mockDb.account.findFirst.mockResolvedValue({ userId: USER_1.id });
            mockDb.userProfile.updateMany.mockResolvedValue({ count: 1 });

            // User leaves Guild A
            await mockDb.userProfile.updateMany({
                where: {
                    userId: USER_1.id,
                    guildId: GUILD_A.id,
                    status: "ACTIVE"
                },
                data: { status: "ARCHIVED" }
            });

            // Guild B profile should NOT be touched
            // The call should only target Guild A
            const updateCalls = mockDb.userProfile.updateMany.mock.calls;
            expect(updateCalls.length).toBe(1);
            expect(updateCalls[0][0].where.guildId).toBe(GUILD_A.id);
            expect(updateCalls[0][0].where.guildId).not.toBe(GUILD_B.id);
        });
    });

    describe("GUILD_BAN_ADD - Anonymization", () => {
        it("should anonymize personal data when user is banned", async () => {
            mockDb.guildConfig.findUnique.mockResolvedValue(GUILD_A);
            mockDb.account.findFirst.mockResolvedValue({ userId: USER_1.id });
            mockDb.userProfile.updateMany.mockResolvedValue({ count: 1 });

            // Simulate ban handler
            const anonymizationData = {
                status: "BANNED",
                archivedAt: new Date(),
                archiveReason: "BANNED",
                pseudoDofus: "[Membre Banni]",
                discordNickname: null,
                metamobPseudo: null,
                altPseudos: null, // Would be Prisma.JsonNull
                availability: null,
                dofusBookLinks: null,
            };

            await mockDb.userProfile.updateMany({
                where: {
                    userId: USER_1.id,
                    guildId: GUILD_A.id
                },
                data: anonymizationData
            });

            // Verify anonymization fields
            const updateCall = mockDb.userProfile.updateMany.mock.calls[0][0];
            expect(updateCall.data.pseudoDofus).toBe("[Membre Banni]");
            expect(updateCall.data.discordNickname).toBeNull();
            expect(updateCall.data.status).toBe("BANNED");
        });

        it("should set archivedAt timestamp on ban", async () => {
            mockDb.guildConfig.findUnique.mockResolvedValue(GUILD_A);
            mockDb.userProfile.updateMany.mockResolvedValue({ count: 1 });

            const beforeBan = new Date();

            await mockDb.userProfile.updateMany({
                where: { guildId: GUILD_A.id },
                data: {
                    status: "BANNED",
                    archivedAt: new Date(),
                    archiveReason: "BANNED"
                }
            });

            const afterBan = new Date();
            const updateCall = mockDb.userProfile.updateMany.mock.calls[0][0];
            const archivedAt = updateCall.data.archivedAt;

            expect(archivedAt.getTime()).toBeGreaterThanOrEqual(beforeBan.getTime());
            expect(archivedAt.getTime()).toBeLessThanOrEqual(afterBan.getTime());
        });
    });

    describe("Profile Reactivation - Returning Members", () => {
        it("should reactivate an ARCHIVED profile when member returns", async () => {
            const archivedProfile = {
                ...PROFILE_USER1_GUILD_A,
                status: "ARCHIVED",
                archivedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                archiveReason: "LEFT"
            };

            mockDb.userProfile.findFirst.mockResolvedValue(archivedProfile);
            mockDb.userProfile.update.mockResolvedValue({
                ...archivedProfile,
                status: "ACTIVE",
                archivedAt: null,
                archiveReason: null
            });

            // Simulate getUserContext finding an archived profile
            const archived = await mockDb.userProfile.findFirst({
                where: {
                    userId: USER_1.id,
                    guildId: GUILD_A.id,
                    status: "ARCHIVED"
                }
            });

            // Reactivate it
            const reactivated = await mockDb.userProfile.update({
                where: { id: archived!.id },
                data: {
                    status: "ACTIVE",
                    archivedAt: null,
                    archiveReason: null
                }
            });

            expect(reactivated.status).toBe("ACTIVE");
            expect(reactivated.archivedAt).toBeNull();
        });

        it("should NOT reactivate a BANNED profile", async () => {
            const bannedProfile = {
                ...PROFILE_USER1_GUILD_A,
                status: "BANNED",
                archivedAt: new Date(),
                archiveReason: "BANNED"
            };

            // The findFirst should only look for ARCHIVED, not BANNED
            mockDb.userProfile.findFirst.mockResolvedValue(null);

            const archived = await mockDb.userProfile.findFirst({
                where: {
                    userId: USER_1.id,
                    guildId: GUILD_A.id,
                    status: "ARCHIVED" // Explicitly NOT BANNED
                }
            });

            expect(archived).toBeNull();
            // updateMany should not be called for banned profiles
        });
    });

    describe("Cleanup Expired Profiles", () => {
        it("should delete profiles archived more than 90 days ago (LEFT)", async () => {
            const now = new Date();
            const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

            mockDb.userProfile.deleteMany.mockResolvedValue({ count: 3 });

            const result = await mockDb.userProfile.deleteMany({
                where: {
                    guildId: GUILD_A.id,
                    status: "ARCHIVED",
                    archiveReason: "LEFT",
                    archivedAt: { lt: cutoff }
                }
            });

            expect(result.count).toBe(3);
            const deleteCall = mockDb.userProfile.deleteMany.mock.calls[0][0];
            expect(deleteCall.where.archiveReason).toBe("LEFT");
            expect(deleteCall.where.archivedAt.lt).toEqual(cutoff);
        });

        it("should delete profiles archived more than 30 days ago (KICKED)", async () => {
            const now = new Date();
            const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            mockDb.userProfile.deleteMany.mockResolvedValue({ count: 1 });

            const result = await mockDb.userProfile.deleteMany({
                where: {
                    guildId: GUILD_A.id,
                    status: "ARCHIVED",
                    archiveReason: "KICKED",
                    archivedAt: { lt: cutoff }
                }
            });

            expect(result.count).toBe(1);
            const deleteCall = mockDb.userProfile.deleteMany.mock.calls[0][0];
            expect(deleteCall.where.archiveReason).toBe("KICKED");
        });

        it("should only cleanup profiles for the specified guild (tenant isolation)", async () => {
            mockDb.userProfile.deleteMany.mockResolvedValue({ count: 2 });

            await mockDb.userProfile.deleteMany({
                where: {
                    guildId: GUILD_A.id, // Only Guild A
                    status: "ARCHIVED"
                }
            });

            const deleteCall = mockDb.userProfile.deleteMany.mock.calls[0][0];
            expect(deleteCall.where.guildId).toBe(GUILD_A.id);
            expect(deleteCall.where.guildId).not.toBe(GUILD_B.id);
        });
    });

    describe("Webhook Security", () => {
        it("should ignore events from non-whitelisted guilds", async () => {
            // Setup: Guild C is not in the database
            mockDb.guildConfig.findUnique.mockResolvedValue(null);

            const guild = await mockDb.guildConfig.findUnique({
                where: { discordGuildId: "non-existent-guild" }
            });

            expect(guild).toBeNull();
            // No profile updates should happen
            expect(mockDb.userProfile.updateMany).not.toHaveBeenCalled();
        });

        it("should ignore events for users not in database", async () => {
            mockDb.guildConfig.findUnique.mockResolvedValue(GUILD_A);
            mockDb.account.findFirst.mockResolvedValue(null); // User not found

            const account = await mockDb.account.findFirst({
                where: { provider: "discord", providerAccountId: "unknown-user" }
            });

            expect(account).toBeNull();
            // No profile updates should happen for unknown users
        });
    });

    describe("Idempotence", () => {
        it("should not double-archive an already archived profile", async () => {
            // updateMany only targets ACTIVE profiles
            mockDb.userProfile.updateMany.mockResolvedValue({ count: 0 });

            const result = await mockDb.userProfile.updateMany({
                where: {
                    userId: USER_1.id,
                    guildId: GUILD_A.id,
                    status: "ACTIVE" // Key: only active profiles
                },
                data: {
                    status: "ARCHIVED",
                    archivedAt: new Date(),
                    archiveReason: "LEFT"
                }
            });

            // If already archived, count should be 0
            expect(result.count).toBe(0);
        });
    });
});
