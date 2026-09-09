/**
 * #223 P3.1 — Mode dégradé : `sendChannelMessage` / `sendDiscordRawEmbed` basculent
 * vers la file d'écritures (outbox) quand `DISCORD_OUTBOX_ENABLED=true`.
 * Défaut = OFF → comportement HTTP synchrone identique à avant (zéro régression).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────
const enqueueCalls: any[] = [];
const mockEnqueue = vi.fn(async (job: any) => {
    enqueueCalls.push(job);
    return "job-id";
});
vi.mock("@/server/discord-outbox", () => ({
    enqueueDiscordWrite: (job: any) => mockEnqueue(job),
}));

import { sendChannelMessage, sendDiscordRawEmbed, isDiscordOutboxEnabled } from "@/server/discord";

function makeOkResponse(body: unknown) {
    return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    enqueueCalls.length = 0;
    process.env.DISCORD_BOT_TOKEN = "test-token";
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DISCORD_BOT_TOKEN;
    delete process.env.DISCORD_OUTBOX_ENABLED;
});

describe("isDiscordOutboxEnabled — opt-in strict", () => {
    it("désactivé par défaut (off)", () => {
        delete process.env.DISCORD_OUTBOX_ENABLED;
        expect(isDiscordOutboxEnabled()).toBe(false);
    });
    it("activé uniquement si exactement 'true'", () => {
        process.env.DISCORD_OUTBOX_ENABLED = "true";
        expect(isDiscordOutboxEnabled()).toBe(true);
        process.env.DISCORD_OUTBOX_ENABLED = "1";
        expect(isDiscordOutboxEnabled()).toBe(false);
        process.env.DISCORD_OUTBOX_ENABLED = "TRUE";
        expect(isDiscordOutboxEnabled()).toBe(false);
    });
});

describe("sendChannelMessage — routing (P3.1)", () => {
    it("mode normal : HTTP synchrone, PAS de file (retourne l'ID message)", async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeOkResponse({ id: "msg-1" }));
        vi.stubGlobal("fetch", fetchMock);

        const id = await sendChannelMessage("123456", "Salut la guilde");

        expect(id).toBe("msg-1");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("mode outbox : enqueue au lieu de fetch, retourne outbox:jobId", async () => {
        process.env.DISCORD_OUTBOX_ENABLED = "true";
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const id = await sendChannelMessage("123456", "Salut", { embedTitle: "Titre" });

        expect(id).toBe("outbox:job-id");
        expect(fetchMock).not.toHaveBeenCalled();
        expect(enqueueCalls).toHaveLength(1);
        expect(enqueueCalls[0].kind).toBe("postMessage");
        expect(enqueueCalls[0].channelId).toBe("123456");
        expect(enqueueCalls[0].body).toHaveProperty("embeds");
    });

    it("mode outbox : storeMessageIdKey transite jusqu'au job (living status)", async () => {
        process.env.DISCORD_OUTBOX_ENABLED = "true";
        vi.stubGlobal("fetch", vi.fn());

        await sendChannelMessage("123456", "", {
            embedTitle: "Titre",
            storeMessageIdKey: "sigilos:discord_status_message_id_beta",
            storeMessageIdTTL: 123,
        });

        expect(enqueueCalls).toHaveLength(1);
        expect(enqueueCalls[0].storeMessageIdKey).toBe("sigilos:discord_status_message_id_beta");
        expect(enqueueCalls[0].storeMessageIdTTL).toBe(123);
        // Jamais sérialisé dans le body Discord.
        expect(enqueueCalls[0].body).not.toHaveProperty("storeMessageIdKey");
    });
});

describe("sendDiscordRawEmbed — routing (P3.1)", () => {
    it("mode outbox : enqueue aussi (même file, kind postMessage)", async () => {
        process.env.DISCORD_OUTBOX_ENABLED = "true";
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const id = await sendDiscordRawEmbed("guild-1", "123456", "<@999>", { title: "X" });

        expect(id).toBe("outbox:job-id");
        expect(fetchMock).not.toHaveBeenCalled();
        expect(enqueueCalls[0].kind).toBe("postMessage");
        expect(enqueueCalls[0].body).toHaveProperty("embeds");
        expect(enqueueCalls[0].body).toHaveProperty("allowed_mentions");
    });

    it("mode normal : HTTP synchrone (retourne l'ID message)", async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeOkResponse({ id: "raw-1" }));
        vi.stubGlobal("fetch", fetchMock);

        const id = await sendDiscordRawEmbed("guild-1", "123456", "ping", { title: "Y" });

        expect(id).toBe("raw-1");
        expect(mockEnqueue).not.toHaveBeenCalled();
    });
});
