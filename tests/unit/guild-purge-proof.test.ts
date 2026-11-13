/**
 * Purge d'une guilde — **preuve de suppression** (D-B, décision du 02/11/2026 : 90 jours).
 *
 * Ce que ce verrou protège :
 * 1. la preuve est écrite **avant** l'effacement (après, il n'y a plus rien à décrire) ;
 * 2. elle vit au journal **plateforme** (`guildId` absent, `isGodLog: true`) : elle survit donc à
 *    la cascade qui emporte le journal de la guilde ;
 * 3. **fail-closed** : preuve impossible ⇒ la guilde n'est pas effacée ;
 * 4. après la suppression, la preuve est confirmée — mais une confirmation ratée la laisse en
 *    « tentative », elle ne ment jamais.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findUnique: vi.fn(), delete: vi.fn() },
        allowedGuild: { deleteMany: vi.fn() },
        auditLog: { create: vi.fn(), update: vi.fn() },
    },
}));
vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/server/actions/god-lifecycle-actions", () => ({ purgeGuildCaches: vi.fn() }));
vi.mock("@/server/discord", () => ({ leaveGuild: vi.fn() }));

import { db } from "@/lib/prisma";
import { purgeGuildById } from "@/server/guild-purge-core";

const mockDb = db as any;
const NOW = new Date("2026-11-02T05:00:00.000Z");

const CONFIG = {
    id: "cfg-1",
    name: "Kamas & Co",
    discordGuildId: "123456789012345678",
    ownerId: "owner-1",
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    deletedAt: new Date("2026-10-01T00:00:00.000Z"),
    deletionReason: "OWNER_REQUEST",
    scheduledDeletion: new Date("2026-10-31T00:00:00.000Z"),
};

beforeEach(() => {
    vi.clearAllMocks();
    mockDb.guildConfig.findUnique.mockResolvedValue({ ...CONFIG });
    mockDb.guildConfig.delete.mockResolvedValue({});
    mockDb.allowedGuild.deleteMany.mockResolvedValue({ count: 1 });
    mockDb.auditLog.create.mockResolvedValue({ id: "proof-1" });
    mockDb.auditLog.update.mockResolvedValue({});
});

describe("purge d'une guilde — preuve plateforme", () => {
    it("écrit la preuve AVANT de supprimer la config", async () => {
        await purgeGuildById("cfg-1", { now: NOW });

        expect(mockDb.auditLog.create).toHaveBeenCalledTimes(1);
        expect(mockDb.auditLog.create.mock.invocationCallOrder[0]).toBeLessThan(
            mockDb.guildConfig.delete.mock.invocationCallOrder[0],
        );
    });

    it("la preuve est **plateforme** et porte l'identité de la guilde disparue", async () => {
        await purgeGuildById("cfg-1", { now: NOW });

        const data = mockDb.auditLog.create.mock.calls[0][0].data;
        expect(data.guildId).toBeUndefined();
        expect(data.isGodLog).toBe(true);
        expect(data.action).toBe("GUILD_PURGED");
        expect(data.targetType).toBe("GUILD");
        expect(data.targetId).toBe("cfg-1");
        expect(data.oldValue).toMatchObject({
            name: "Kamas & Co",
            discordGuildId: "123456789012345678",
            ownerId: "owner-1",
            deletionReason: "OWNER_REQUEST",
        });
        expect(data.newValue).toMatchObject({ purged: false, trigger: "CRON" });
    });

    it("une guilde non échue n'écrit aucune preuve et n'est pas effacée", async () => {
        mockDb.guildConfig.findUnique.mockResolvedValue({
            ...CONFIG,
            scheduledDeletion: new Date("2027-01-01T00:00:00.000Z"),
        });

        const result = await purgeGuildById("cfg-1", { now: NOW });

        expect(result).toMatchObject({ purged: false, reason: "not_due" });
        expect(mockDb.auditLog.create).not.toHaveBeenCalled();
        expect(mockDb.guildConfig.delete).not.toHaveBeenCalled();
    });

    it("preuve impossible ⇒ la guilde n'est pas effacée (fail-closed)", async () => {
        mockDb.auditLog.create.mockRejectedValue(new Error("db down"));

        const result = await purgeGuildById("cfg-1", { now: NOW });

        expect(result).toMatchObject({ purged: false, reason: "proof_write_failed" });
        expect(mockDb.guildConfig.delete).not.toHaveBeenCalled();
        expect(mockDb.allowedGuild.deleteMany).not.toHaveBeenCalled();
    });

    it("God : l'acteur et le déclencheur sont dans la preuve, pas devinés", async () => {
        await purgeGuildById("cfg-1", {
            force: true,
            now: NOW,
            actor: { userId: "user-god", name: "Klyx", source: "GOD" },
        });

        const data = mockDb.auditLog.create.mock.calls[0][0].data;
        expect(data.actorUserId).toBe("user-god");
        expect(data.actorName).toBe("Klyx");
        expect(data.newValue.trigger).toBe("GOD_FORCE");
    });

    it("après la suppression, la preuve est confirmée", async () => {
        const result = await purgeGuildById("cfg-1", { now: NOW });

        expect(result.purged).toBe(true);
        expect(mockDb.auditLog.update).toHaveBeenCalledTimes(1);
        const update = mockDb.auditLog.update.mock.calls[0][0];
        expect(update.where).toEqual({ id: "proof-1" });
        expect(update.data.newValue).toMatchObject({ purged: true });
        expect(typeof update.data.newValue.confirmedAt).toBe("string");
    });

    it("une confirmation impossible laisse la preuve en « tentative » — la purge reste faite", async () => {
        mockDb.auditLog.update.mockRejectedValue(new Error("boom"));

        const result = await purgeGuildById("cfg-1", { now: NOW });

        expect(result.purged).toBe(true);
        expect(mockDb.guildConfig.delete).toHaveBeenCalledTimes(1);
    });
});
