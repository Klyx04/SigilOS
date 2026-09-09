/**
 * #223 P3.1 — Outbox des écritures Discord : enqueue + exécution (worker).
 * Vérifie : validation Zod fail-closed, idempotency (jobId stable), dispatch
 * vers les fonctions de la couche centrale, et throw sur échec (→ retry BullMQ).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────
const mockQueueAdd = vi.fn();
vi.mock("@/lib/queue/discord-outbox-queue", () => ({
    DISCORD_OUTBOX_QUEUE_NAME: "discord-outbox",
    discordOutboxQueue: { add: (...args: any[]) => mockQueueAdd(...args) },
}));

const mockPostChannelMessage = vi.fn();
const mockDeleteChannelMessage = vi.fn();
const mockPatchChannelMessage = vi.fn();
const mockCreateForumThread = vi.fn();
vi.mock("@/server/discord", () => ({
    postChannelMessage: (...args: any[]) => mockPostChannelMessage(...args),
    deleteChannelMessage: (...args: any[]) => mockDeleteChannelMessage(...args),
    patchChannelMessage: (...args: any[]) => mockPatchChannelMessage(...args),
    createForumThread: (...args: any[]) => mockCreateForumThread(...args),
}));

// Redis mocké : le vrai client pendrait (connexion) sur `set` en test.
const mockRedisSet = vi.fn();
vi.mock("@/lib/redis", () => ({
    redis: { set: (...args: any[]) => mockRedisSet(...args) },
}));

import {
    enqueueDiscordWrite,
    executeDiscordWrite,
    isDiscordOutboxJobData,
    DiscordOutboxJobSchema,
} from "@/server/discord-outbox";

beforeEach(() => {
    vi.clearAllMocks();
    mockQueueAdd.mockResolvedValue({ id: "job-1" });
});

describe("isDiscordOutboxJobData / schéma Zod (fail-closed)", () => {
    it("accepte un job postMessage valide", () => {
        const job = { kind: "postMessage", channelId: "123456789", body: { content: "salut" } };
        expect(isDiscordOutboxJobData(job)).toBe(true);
        expect(DiscordOutboxJobSchema.parse(job)).toEqual(job);
    });

    it("refuse un payload mal formé (kind inconnu / channelId absent)", () => {
        expect(isDiscordOutboxJobData({ kind: "exploit", channelId: "1" })).toBe(false);
        expect(isDiscordOutboxJobData({ kind: "postMessage", body: {} })).toBe(false);
        expect(isDiscordOutboxJobData(null)).toBe(false);
        expect(isDiscordOutboxJobData("string")).toBe(false);
    });
});

describe("enqueueDiscordWrite", () => {
    it("dépose le job validé dans la file BullMQ", async () => {
        const job = { kind: "postMessage", channelId: "123", body: { content: "x" } } as const;
        const jobId = await enqueueDiscordWrite(job);
        expect(mockQueueAdd).toHaveBeenCalledTimes(1);
        const [name, data, opts] = mockQueueAdd.mock.calls[0];
        expect(name).toBe("discord-write");
        expect(data).toEqual(job);
        expect(opts.jobId).toBe(jobId);
    });

    it("génère un jobId STABLE : relancer le même job ne duplique pas (idempotency)", async () => {
        const job = { kind: "deleteMessage", channelId: "123", messageId: "456" } as const;
        const a = await enqueueDiscordWrite(job);
        const b = await enqueueDiscordWrite(job);
        expect(a).toBe(b);
        expect(mockQueueAdd).toHaveBeenCalledTimes(2);
        expect(mockQueueAdd.mock.calls[0][2].jobId).toBe(mockQueueAdd.mock.calls[1][2].jobId);
    });

    it("refuse un payload invalide AVANT enqueue (fail-closed)", async () => {
        await expect(enqueueDiscordWrite({ kind: "postMessage", body: {} } as any)).rejects.toThrow();
        expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it("respecte un jobId fourni par l'appelant", async () => {
        await enqueueDiscordWrite(
            { kind: "forumThread", channelId: "123", body: { name: "t" } },
            { jobId: "custom-id" }
        );
        expect(mockQueueAdd.mock.calls[0][2].jobId).toBe("custom-id");
    });
});

describe("executeDiscordWrite (worker)", () => {
    it("postMessage → appelle la couche centrale et retourne le messageId", async () => {
        mockPostChannelMessage.mockResolvedValue("msg-1");
        const result = await executeDiscordWrite({ kind: "postMessage", channelId: "123", body: { content: "x" } });
        expect(result).toEqual({ success: true, messageId: "msg-1" });
        expect(mockPostChannelMessage).toHaveBeenCalledWith("123", { content: "x" });
    });

    it("postMessage échec (null) → throw (BullMQ retente)", async () => {
        mockPostChannelMessage.mockResolvedValue(null);
        await expect(
            executeDiscordWrite({ kind: "postMessage", channelId: "123", body: { content: "x" } })
        ).rejects.toThrow();
    });

    it("deleteMessage → deleteChannelMessage; false → throw", async () => {
        mockDeleteChannelMessage.mockResolvedValue(true);
        await expect(
            executeDiscordWrite({ kind: "deleteMessage", channelId: "123", messageId: "456" })
        ).resolves.toEqual({ success: true });

        mockDeleteChannelMessage.mockResolvedValue(false);
        await expect(
            executeDiscordWrite({ kind: "deleteMessage", channelId: "123", messageId: "456" })
        ).rejects.toThrow();
    });

    it("patchMessage → patchChannelMessage", async () => {
        mockPatchChannelMessage.mockResolvedValue(true);
        await expect(
            executeDiscordWrite({ kind: "patchMessage", channelId: "123", messageId: "456", body: { embeds: [] } })
        ).resolves.toEqual({ success: true });
    });

    it("forumThread → createForumThread; null → throw", async () => {
        mockCreateForumThread.mockResolvedValue({ id: "thread-1" });
        await expect(
            executeDiscordWrite({ kind: "forumThread", channelId: "123", body: { name: "t" } })
        ).resolves.toEqual({ success: true });

        mockCreateForumThread.mockResolvedValue(null);
        await expect(
            executeDiscordWrite({ kind: "forumThread", channelId: "123", body: { name: "t" } })
        ).rejects.toThrow();
    });

    it("payload invalide → throw (fail-closed)", async () => {
        await expect(executeDiscordWrite({ kind: "hack", channelId: "1" } as any)).rejects.toThrow();
        expect(mockPostChannelMessage).not.toHaveBeenCalled();
    });

    it("postMessage + storeMessageIdKey → ré-ancre le vrai ID snowflake en Redis", async () => {
        mockPostChannelMessage.mockResolvedValue("123456789012345678");
        mockRedisSet.mockResolvedValue("OK");
        const result = await executeDiscordWrite({
            kind: "postMessage",
            channelId: "123",
            body: { content: "x" },
            storeMessageIdKey: "sigilos:discord_status_message_id_beta",
            storeMessageIdTTL: 999,
        });
        expect(result).toEqual({ success: true, messageId: "123456789012345678" });
        expect(mockRedisSet).toHaveBeenCalledWith(
            "sigilos:discord_status_message_id_beta",
            "123456789012345678",
            "EX",
            999
        );
    });

    it("postMessage + storeMessageIdKey → ignore les IDs non-snowflake (jamais outbox:*)", async () => {
        mockPostChannelMessage.mockResolvedValue("outbox:abc123");
        const result = await executeDiscordWrite({
            kind: "postMessage",
            channelId: "123",
            body: { content: "x" },
            storeMessageIdKey: "sigilos:discord_status_message_id_beta",
        });
        expect(result).toEqual({ success: true, messageId: "outbox:abc123" });
        expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it("postMessage sans storeMessageIdKey → aucun accès Redis", async () => {
        mockPostChannelMessage.mockResolvedValue("123456789012345678");
        await executeDiscordWrite({ kind: "postMessage", channelId: "123", body: { content: "x" } });
        expect(mockRedisSet).not.toHaveBeenCalled();
    });
});
