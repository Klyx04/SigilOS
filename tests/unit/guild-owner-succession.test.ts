import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: {
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        userProfile: {
            findFirst: vi.fn(),
        },
        account: {
            findFirst: vi.fn(),
        },
        guildRecoveryClaim: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            findFirst: vi.fn().mockResolvedValue(null),
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn(),
        },
    },
}));

vi.mock("@/auth", () => ({
    auth: vi.fn(),
}));

vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: vi.fn(),
}));

vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn(),
    invalidateUserContextCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/discord", () => ({
    fetchGuild: vi.fn(),
    sendChannelMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/actions/audit-actions", () => ({
    createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/actions/god-notif-actions", () => ({
    notifyGod: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { fetchGuild } from "@/server/discord";
import { transferGuildOwnershipAction, handleGuildOwnerSuccession } from "@/server/actions/guild-owner-actions";

describe("👑 Guild Ownership & Fail-Safe Succession (#230)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("transferGuildOwnershipAction", () => {
        it("refuses if user is not authenticated", async () => {
            vi.mocked(auth).mockResolvedValue(null as any);
            const res = await transferGuildOwnershipAction("guild-1", "user-2", "Guilde Test");
            expect(res.success).toBe(false);
            expect(res.error).toContain("Non authentifié");
        });

        it("refuses if caller is not the owner or superadmin", async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: "user-attacker" } } as any);
            vi.mocked(isSuperAdmin).mockResolvedValue(false);
            vi.mocked(getUserContext).mockResolvedValue({ isAdmin: false } as any);
            vi.mocked(db.guildConfig.findFirst).mockResolvedValue({
                id: "guild-1",
                name: "Guilde Test",
                ownerId: "real-owner",
            } as any);

            const res = await transferGuildOwnershipAction("guild-1", "user-2", "Guilde Test");
            expect(res.success).toBe(false);
            expect(res.error).toContain("Seul le propriétaire actuel ou un SuperAdmin");
        });

        it("refuses if confirmation guild name does not match", async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: "real-owner" } } as any);
            vi.mocked(isSuperAdmin).mockResolvedValue(false);
            vi.mocked(getUserContext).mockResolvedValue({ isAdmin: true } as any);
            vi.mocked(db.guildConfig.findFirst).mockResolvedValue({
                id: "guild-1",
                name: "Guilde Test",
                ownerId: "real-owner",
            } as any);

            const res = await transferGuildOwnershipAction("guild-1", "user-2", "Mauvais Nom");
            expect(res.success).toBe(false);
            expect(res.error).toContain("Confirmation incorrecte");
        });

        it("transfers ownership successfully when valid", async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: "real-owner", name: "Ancien Owner" } } as any);
            vi.mocked(isSuperAdmin).mockResolvedValue(false);
            vi.mocked(getUserContext).mockResolvedValue({ isAdmin: true } as any);
            vi.mocked(db.guildConfig.findFirst).mockResolvedValue({
                id: "guild-1",
                name: "Guilde Test",
                ownerId: "real-owner",
                discordGuildId: "discord-123",
            } as any);
            vi.mocked(db.userProfile.findFirst).mockResolvedValue({
                id: "profile-2",
                userId: "user-2",
                pseudoDofus: "NouveauMeneur",
                user: { name: "Nouveau Meneur" }
            } as any);
            vi.mocked(db.guildConfig.update).mockResolvedValue({} as any);

            const res = await transferGuildOwnershipAction("guild-1", "user-2", "Guilde Test");
            expect(res.success).toBe(true);
            expect(db.guildConfig.update).toHaveBeenCalledWith({
                where: { id: "guild-1" },
                data: { ownerId: "user-2" }
            });
        });
    });

    describe("handleGuildOwnerSuccession", () => {
        it("inherits to the Discord Guild Owner if they have a SigilOS profile", async () => {
            vi.mocked(db.guildConfig.findFirst).mockResolvedValue({
                id: "guild-1",
                name: "Guilde Test",
                ownerId: "deleted-owner",
                discordGuildId: "discord-guild-1",
            } as any);
            vi.mocked(fetchGuild).mockResolvedValue({
                id: "discord-guild-1",
                owner_id: "discord-owner-snowflake",
            } as any);
            vi.mocked(db.account.findFirst).mockResolvedValue({
                userId: "discord-owner-userid",
            } as any);
            vi.mocked(db.userProfile.findFirst).mockResolvedValue({
                id: "profile-owner",
                userId: "discord-owner-userid",
                pseudoDofus: "MeneurDiscord",
            } as any);
            vi.mocked(db.guildConfig.update).mockResolvedValue({} as any);

            const res = await handleGuildOwnerSuccession("guild-1", "deleted-owner");
            expect(res.success).toBe(true);
            expect(res.newOwnerUserId).toBe("discord-owner-userid");
            expect(res.successionReason).toBe("DISCORD_SERVER_OWNER_INHERITANCE");
            expect(db.guildConfig.update).toHaveBeenCalledWith({
                where: { id: "guild-1" },
                data: { ownerId: "discord-owner-userid" }
            });
        });

        it("falls back to the oldest active member if Discord owner is not on SigilOS", async () => {
            vi.mocked(db.guildConfig.findFirst).mockResolvedValue({
                id: "guild-1",
                name: "Guilde Test",
                ownerId: "deleted-owner",
                discordGuildId: "discord-guild-1",
            } as any);
            vi.mocked(fetchGuild).mockResolvedValue({
                id: "discord-guild-1",
                owner_id: "discord-owner-snowflake",
            } as any);
            // Discord owner not found on SigilOS
            vi.mocked(db.account.findFirst).mockResolvedValue(null);
            // Oldest active member
            vi.mocked(db.userProfile.findFirst).mockResolvedValue({
                id: "profile-senior",
                userId: "user-senior",
                pseudoDofus: "BrasDroitAncien",
            } as any);
            vi.mocked(db.guildConfig.update).mockResolvedValue({} as any);

            const res = await handleGuildOwnerSuccession("guild-1", "deleted-owner");
            expect(res.success).toBe(true);
            expect(res.newOwnerUserId).toBe("user-senior");
            expect(res.successionReason).toBe("SENIOR_MEMBER_SUCCESSION");
        });
    });
});
