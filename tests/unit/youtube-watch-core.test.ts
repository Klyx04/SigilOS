/**
 * Passe `runYouTubeWatch` — **comportement**.
 *
 * Ce que ce verrou protège :
 * 1. **quota** : la résolution `@handle → channel_id` (100 unités) n'est faite **qu'une fois**
 *    par créateur, puis servie par le cache Redis — le reste passe par le flux RSS (gratuit) ;
 * 2. **une annonce par vidéo**, clé posée seulement après un envoi réussi ;
 * 3. l'interrupteur de guilde (`notifyYouTubeUploads`) et la garde d'âge 24 h ;
 * 4. sans clé YouTube et sans cache, on **n'annonce rien** (fail-closed).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findFirst: vi.fn(), findMany: vi.fn() },
        contentCreator: { findMany: vi.fn() },
    },
}));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(), set: vi.fn(), exists: vi.fn() } }));
vi.mock("@/server/discord", () => ({ sendChannelMessage: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { db } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sendChannelMessage } from "@/server/discord";
import { runYouTubeWatch } from "@/server/youtube-watch-core";

const mockDb = db as any;
const mockRedis = redis as any;
const mockSend = sendChannelMessage as unknown as ReturnType<typeof vi.fn>;

const NOW = new Date("2026-11-02T20:00:00.000Z");
const GUILD = {
    id: "guild-internal",
    liveNotifyChannelId: "123456789012345678",
    livePingRoleIds: [] as string[],
    notifyYouTubeUploads: true,
};

const RSS = `<feed>
  <entry>
    <yt:videoId>abc123DEF45</yt:videoId>
    <title>SRAM MODE MULTI &amp; CHIMIQUE</title>
    <published>2026-11-02T13:09:00+00:00</published>
    <media:thumbnail url="https://i1.ytimg.com/vi/abc123DEF45/hqdefault.jpg"/>
  </entry>
</feed>`;

function jsonOk(body: unknown) {
    return {
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => body,
        text: async (): Promise<string> => JSON.stringify(body),
    };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
    process.env.YOUTUBE_API_KEY = "api-key";

    mockDb.guildConfig.findFirst.mockResolvedValue({ id: "ref-guild" });
    mockDb.contentCreator.findMany.mockResolvedValue([
        { name: "Huzounet", role: "Forgemagie", handle: "huzounet", youtube: "https://www.youtube.com/@Huzounet" },
    ]);
    mockDb.guildConfig.findMany.mockResolvedValue([GUILD]);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    mockRedis.exists.mockResolvedValue(0);
    mockSend.mockResolvedValue("message-1");

    fetchMock = vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.includes("youtube.googleapis.com/youtube/v3/search")) {
            return jsonOk({
                items: [
                    {
                        id: { channelId: "UC123" },
                        snippet: { title: "Huzounet", thumbnails: { default: { url: "https://yt/avatar.png" } } },
                    },
                ],
            });
        }
        if (url.includes("youtube.com/feeds/videos.xml")) {
            return { ok: true, status: 200, text: async (): Promise<string> => RSS };
        }
        return jsonOk({});
    });
    vi.stubGlobal("fetch", fetchMock);
});

describe("runYouTubeWatch", () => {
    it("résout la chaîne UNE fois (100 unités) puis la garde en cache 30 jours", async () => {
        const outcome = await runYouTubeWatch({ now: NOW });

        expect(outcome.channelsResolved).toBe(1);
        const searchCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes("youtube/v3/search"));
        expect(searchCalls).toHaveLength(1);

        const cached = mockRedis.set.mock.calls.find((call: any[]) => String(call[0]).startsWith("yt:channel:"));
        expect(cached?.[0]).toBe("yt:channel:huzounet");
        expect(cached?.[2]).toBe("EX");
        expect(cached?.[3]).toBe(30 * 24 * 60 * 60);
    });

    it("cache présent ⇒ aucun appel à l'API payante", async () => {
        mockRedis.get.mockResolvedValue(JSON.stringify({ channelId: "UC123", avatarUrl: null, displayName: "Huzounet" }));

        await runYouTubeWatch({ now: NOW });

        expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("youtube/v3/search"))).toBe(false);
    });

    it("annonce une vidéo fraîche une seule fois, clé posée après l'envoi", async () => {
        const outcome = await runYouTubeWatch({ now: NOW });

        expect(outcome.notified).toBe(1);
        expect(mockSend).toHaveBeenCalledTimes(1);
        const [, content, payload] = mockSend.mock.calls[0];
        expect(content).toBe("");
        expect(payload.embedColor).toBe(0xff0000);
        expect(payload.embedAuthor.name).toContain("Huzounet");

        const dedup = mockRedis.set.mock.calls.find((call: any[]) => String(call[0]).startsWith("yt:notified:"));
        expect(dedup?.[0]).toBe("yt:notified:guild-internal:abc123DEF45");
        expect(mockSend.mock.invocationCallOrder[0]).toBeLessThan(mockRedis.set.mock.invocationCallOrder.at(-1)!);
    });

    it("vidéo déjà annoncée ⇒ rien", async () => {
        mockRedis.exists.mockResolvedValue(1);

        const outcome = await runYouTubeWatch({ now: NOW });

        expect(mockSend).not.toHaveBeenCalled();
        expect(outcome.reasons.already_notified).toBe(1);
    });

    it("guilde qui a coupé YouTube ⇒ rien, même avec un salon configuré", async () => {
        mockDb.guildConfig.findMany.mockResolvedValue([{ ...GUILD, notifyYouTubeUploads: false }]);

        const outcome = await runYouTubeWatch({ now: NOW });

        expect(mockSend).not.toHaveBeenCalled();
        expect(outcome.reasons.disabled).toBe(1);
    });

    it("sans clé YouTube et sans cache, on n'annonce rien (fail-closed)", async () => {
        delete process.env.YOUTUBE_API_KEY;

        const outcome = await runYouTubeWatch({ now: NOW });

        expect(outcome.channelsResolved).toBe(0);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it("un envoi refusé ne consomme pas la clé", async () => {
        mockSend.mockResolvedValue(null);

        const outcome = await runYouTubeWatch({ now: NOW });

        expect(outcome.failed).toBe(1);
        expect(mockRedis.set.mock.calls.some((call: any[]) => String(call[0]).startsWith("yt:notified:"))).toBe(false);
    });
});
