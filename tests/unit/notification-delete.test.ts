/**
 * ✕ du centre de notifications : suppression définitive scopée
 * (propriétaire + guilde, fail-closed). Avant : aucun delete n'existait, le ✕
 * ne faisait que « marquer lu » → sans effet visible dans l'historique.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/server/actions/user-actions", () => ({
    getUserContext: vi.fn(),
}));
vi.mock("@/lib/redis", () => ({
    redis: { del: vi.fn().mockResolvedValue(1), get: vi.fn().mockResolvedValue(null), set: vi.fn() },
}));

const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        guildConfig: { findUnique: vi.fn() },
        notification: { deleteMany: vi.fn() },
    },
}));

vi.mock("@/lib/prisma", () => ({ db: mockDb }));

import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { deleteNotification } from "@/server/actions/notification-actions";

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedCtx = getUserContext as unknown as ReturnType<typeof vi.fn>;

describe("deleteNotification (✕ du centre)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedAuth.mockResolvedValue({ user: { id: "user-1" } });
        mockedCtx.mockResolvedValue({ isMember: true });
        mockDb.guildConfig.findUnique.mockResolvedValue(null);
        mockDb.notification.deleteMany.mockResolvedValue({ count: 1 });
    });

    it("refuse sans session", async () => {
        mockedAuth.mockResolvedValue(null);
        const res = await deleteNotification("n1", "guild-1");
        expect(res.success).toBe(false);
        expect(mockDb.notification.deleteMany).not.toHaveBeenCalled();
    });

    it("refuse un non-membre (fail-closed)", async () => {
        mockedCtx.mockResolvedValue({ isMember: false });
        const res = await deleteNotification("n1", "guild-1");
        expect(res.success).toBe(false);
        expect(mockDb.notification.deleteMany).not.toHaveBeenCalled();
    });

    it("supprime avec le scope propriétaire + guilde", async () => {
        const res = await deleteNotification("n1", "guild-1");
        expect(res.success).toBe(true);
        expect(mockDb.notification.deleteMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ id: "n1", userId: "user-1" }),
            })
        );
    });

    it("signale quand rien n'est supprimé (id inconnu / autre propriétaire)", async () => {
        mockDb.notification.deleteMany.mockResolvedValue({ count: 0 });
        const res = await deleteNotification("nope", "guild-1");
        expect(res.success).toBe(false);
    });
});
