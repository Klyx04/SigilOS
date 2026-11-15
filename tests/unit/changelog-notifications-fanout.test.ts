/**
 * Changelog → notifications de **compte** (rang 65, lot N2).
 *
 * Vérifie le comportement du fan-out : une notification par compte, dans la
 * boîte `userId` + `guildId: null`, par lots bornés, sans jamais faire échouer
 * la publication God. Le garde de source vérifie que l'action ne déclenche le
 * fan-out que pour une entrée **publique** et **après** la réponse (`after`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NotificationCategory, NotificationType } from "@prisma/client";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        user: { findMany: vi.fn() },
        notification: { createMany: vi.fn() },
    },
}));

vi.mock("@/lib/prisma", () => ({ db: mockDb }));

import {
    CHANGELOG_FANOUT_BATCH_SIZE,
    CHANGELOG_NOTIFICATION_LINK,
    notifyChangelogPublished,
} from "@/server/changelog-notifications";

const entry = {
    id: "changelog-1",
    version: "2.4.0",
    title: "Les fiches boss passent en Dofus Unity",
    summary: "<p>Portées, <strong>résistances</strong> et placements.</p>",
};

beforeEach(() => {
    vi.clearAllMocks();
    mockDb.user.findMany.mockResolvedValue([]);
    mockDb.notification.createMany.mockResolvedValue({ count: 0 });
});

describe("fan-out changelog : une notification par compte, dans la boîte compte", () => {
    it("écrit `guildId: null` pour chaque destinataire", async () => {
        mockDb.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);

        const result = await notifyChangelogPublished(entry);

        expect(result).toEqual({ success: true, sent: 2 });
        const data = mockDb.notification.createMany.mock.calls[0][0].data;
        expect(data).toHaveLength(2);
        expect(data[0]).toMatchObject({
            userId: "u1",
            guildId: null,
            type: NotificationType.CHANGELOG_PUBLISHED,
            category: NotificationCategory.SYSTEM,
            link: CHANGELOG_NOTIFICATION_LINK,
        });
    });

    it("retire le HTML et borne le message", async () => {
        mockDb.user.findMany.mockResolvedValue([{ id: "u1" }]);

        await notifyChangelogPublished(entry);

        const data = mockDb.notification.createMany.mock.calls[0][0].data[0];
        expect(data.message).toContain("Portées");
        expect(data.message).not.toContain("<");
        expect(data.message.length).toBeLessThanOrEqual(1_000);
        expect(data.title).toContain("2.4.0");
    });

    it("pagine par lots de 500 comptes", async () => {
        const firstBatch = Array.from({ length: CHANGELOG_FANOUT_BATCH_SIZE }, (_, index) => ({
            id: `u${index}`,
        }));
        mockDb.user.findMany
            .mockResolvedValueOnce(firstBatch)
            .mockResolvedValueOnce([{ id: "last" }]);

        const result = await notifyChangelogPublished(entry);

        expect(mockDb.notification.createMany).toHaveBeenCalledTimes(2);
        expect(result.sent).toBe(CHANGELOG_FANOUT_BATCH_SIZE + 1);
    });

    it("ne lève jamais : une panne d'écriture retourne un échec best-effort", async () => {
        mockDb.user.findMany.mockResolvedValue([{ id: "u1" }]);
        mockDb.notification.createMany.mockRejectedValue(new Error("db down"));

        const result = await notifyChangelogPublished(entry);

        expect(result).toEqual({ success: false, sent: 0 });
    });
});

describe("publication God : fan-out après la réponse, jamais pour une entrée interne", () => {
    it("l'action déclenche le fan-out dans `after` uniquement si l'entrée est publique", () => {
        const code = readFileSync(
            resolve(process.cwd(), "src/server/actions/changelog-actions.ts"),
            "utf8"
        );

        expect(code).toContain("after(async");
        expect(code).toContain("notifyChangelogPublished");
        expect(code).toContain("if (!entry.isInternal)");
    });
});
