import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma and dependencies
vi.mock("@/lib/prisma", () => ({
    db: {
        badge: {
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            findUnique: vi.fn(),
        },
        userBadge: {
            findMany: vi.fn(),
            upsert: vi.fn(),
            deleteMany: vi.fn(),
        },
        timedRoleGrant: {
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        reactionRoleGroup: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        guildConfig: {
            findUnique: vi.fn(),
        },
        $transaction: vi.fn((cb) => cb(db)),
    }
}));

vi.mock("@/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "user_god" } })
}));

vi.mock("@/server/actions/super-admin-actions", () => ({
    isSuperAdmin: vi.fn().mockResolvedValue(true),
    getActiveScopes: vi.fn().mockResolvedValue(["all"]),
    getAccessibleBricks: vi.fn().mockResolvedValue(["overview"])
}));

vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn().mockResolvedValue({
        isAuthenticated: true,
        isMember: true,
        isAdmin: true,
        canManageReactionRoles: true
    })
}));

vi.mock("@/server/discord", () => ({
    addGuildMemberRole: vi.fn().mockResolvedValue({ success: true }),
    removeGuildMemberRole: vi.fn().mockResolvedValue({ success: true }),
    sendChannelMessage: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn()
}));

import { db } from "@/lib/prisma";
import { getProfileBadgesAction } from "@/server/actions/badge-actions";
import { processExpiredTimedRolesAction } from "@/server/actions/reaction-role-actions";

describe("🏅 Lot 2 — systèmes de Badges (lecture) & Reaction Roles (#198.2 / #222)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("récupère la liste des badges d'un profil", async () => {
        (db.userBadge.findMany as any).mockResolvedValue([
            {
                badge: {
                    id: "b1",
                    slug: "dragon-slayer",
                    name: "Tueur de Dragons",
                    description: "A vaincu un dragon",
                    imageUrl: "https://example.com/icon.png",
                    rarity: "LEGENDARY",
                    category: "COMMUNITY",
                    sortOrder: 1
                },
                unlockedAt: new Date(),
                source: "MANUAL",
                reason: "Victoire donjon"
            }
        ]);

        const res = await getProfileBadgesAction("prof_123");
        expect(res.success).toBe(true);
        expect(res.data).toHaveLength(1);
        expect(res.data?.[0].name).toBe("Tueur de Dragons");
    });
});

describe("⏱️ Lot 2 — Reaction Roles V2 Pro Expiration Handler (#222)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("révoque les rôles temporaires arrivés à expiration", async () => {
        const expiredGrant = {
            id: "tg1",
            discordGuildId: "dg1",
            discordUserId: "du1",
            roleId: "role_temp",
            expiresAt: new Date(Date.now() - 1000),
            revokedAt: null
        };

        (db.timedRoleGrant.findMany as any).mockResolvedValue([expiredGrant]);
        (db.timedRoleGrant.update as any).mockResolvedValue({ ...expiredGrant, revokedAt: new Date() });

        const res = await processExpiredTimedRolesAction();
        expect(res.success).toBe(true);
        expect(res.data?.revokedCount).toBe(1);
        expect(db.timedRoleGrant.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "tg1" }
        }));
    });
});
