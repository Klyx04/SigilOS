/**
 * Passe `runLiveWatch` — **comportement**, pas rendu.
 *
 * Ce que ce verrou protège :
 * 1. **une annonce par session** : la clé Redis n'est posée qu'**après** un envoi réussi ;
 * 2. un envoi refusé (`null`) ne consomme pas la clé → la passe suivante réessaie ;
 * 3. Redis indisponible ⇒ **aucun envoi** (pas de doublon au retour) ;
 * 4. les deux garde-fous : live trop vieux, guilde sans salon ;
 * 5. le ping vient **du réglage de la guilde**, jamais d'un défaut.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findFirst: vi.fn(), findMany: vi.fn() },
        contentCreator: { findMany: vi.fn() },
    },
}));
vi.mock("@/lib/redis", () => ({
    redis: { get: vi.fn(), set: vi.fn(), exists: vi.fn(), del: vi.fn() },
}));
vi.mock("@/server/discord", () => ({ sendChannelMessage: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { db } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sendChannelMessage } from "@/server/discord";
import { runLiveWatch } from "@/server/live-watch-core";

const mockDb = db as any;
const mockRedis = redis as any;
const mockSend = sendChannelMessage as unknown as ReturnType<typeof vi.fn>;

const NOW = new Date("2026-11-02T20:00:00.000Z");
const GUILD = {
    id: "guild-internal",
    liveNotifyChannelId: "123456789012345678",
    livePingRoleIds: [] as string[],
    notifyTwitchLives: true,
};

let streamsPayload: any[] = [];

function jsonOk(body: unknown) {
    return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWITCH_CLIENT_ID = "client-id";
    process.env.TWITCH_CLIENT_SECRET = "client-secret";

    streamsPayload = [
        {
            id: "stream-1",
            user_login: "huzounet",
            user_name: "Huzounet",
            game_name: "Dofus",
            title: "Run du soir",
            viewer_count: 1234,
            started_at: new Date(NOW.getTime() - 10 * 60_000).toISOString(),
            thumbnail_url: "https://cdn/{width}x{height}.jpg",
        },
    ];

    mockDb.guildConfig.findFirst.mockResolvedValue({ id: "ref-guild" });
    mockDb.contentCreator.findMany.mockResolvedValue([{ handle: "huzounet", twitch: null }]);
    mockDb.guildConfig.findMany.mockResolvedValue([GUILD]);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.del.mockResolvedValue(1);
    mockSend.mockResolvedValue("message-1");

    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: unknown) => {
            const url = String(input);
            if (url.includes("id.twitch.tv/oauth2/token")) return jsonOk({ access_token: "token", expires_in: 3600 });
            if (url.includes("/helix/streams")) return jsonOk({ data: streamsPayload });
            if (url.includes("/helix/users")) {
                return jsonOk({
                    data: [{ login: "huzounet", profile_image_url: "https://cdn/avatar.png" }],
                });
            }
            return jsonOk({});
        }),
    );
});

describe("runLiveWatch", () => {
    it("sans fiche créateur, aucune requête réseau n'est faite", async () => {
        mockDb.contentCreator.findMany.mockResolvedValue([]);

        const outcome = await runLiveWatch({ now: NOW });

        expect(outcome.creators).toBe(0);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it("un live neuf ⇒ une annonce, et la clé anti-doublon est posée APRÈS l'envoi", async () => {
        const outcome = await runLiveWatch({ now: NOW });

        expect(outcome.notified).toBe(1);
        expect(mockSend).toHaveBeenCalledTimes(1);
        const [channelId, content, payload] = mockSend.mock.calls[0];
        expect(channelId).toBe(GUILD.liveNotifyChannelId);
        expect(content).toBe("");
        expect(payload.embedTitle).toContain("Huzounet");
        expect(payload.embedImage).toContain("640");

        const dedup = mockRedis.set.mock.calls.find((call: any[]) => String(call[0]).startsWith("live:notified:"));
        expect(dedup?.[0]).toBe("live:notified:guild-internal:stream-1");
        expect(dedup?.[2]).toBe("EX");

        expect(mockSend.mock.invocationCallOrder[0]).toBeLessThan(mockRedis.set.mock.invocationCallOrder.at(-1)!);
    });

    it("interrupteur Twitch coupé ⇒ aucune annonce, même avec un salon", async () => {
        mockDb.guildConfig.findMany.mockResolvedValue([{ ...GUILD, notifyTwitchLives: false }]);

        const outcome = await runLiveWatch({ now: NOW });

        expect(mockSend).not.toHaveBeenCalled();
        expect(outcome.reasons.disabled).toBe(1);
    });

    it("ne sélectionne que les guildes avec un salon Twitch et l'interrupteur actif", async () => {
        await runLiveWatch({ now: NOW });

        const query = mockDb.guildConfig.findMany.mock.calls[0][0];
        expect(query.where).toMatchObject({
            isActive: true,
            liveNotifyChannelId: { not: null },
            notifyTwitchLives: true,
        });
    });

    it("un live déjà annoncé ne repart pas — même session, même clé", async () => {
        mockRedis.exists.mockResolvedValue(1);

        const outcome = await runLiveWatch({ now: NOW });

        expect(mockSend).not.toHaveBeenCalled();
        expect(outcome.skipped).toBe(1);
        expect(outcome.reasons.already_notified).toBe(1);
        expect(
            mockRedis.set.mock.calls.some((call: any[]) => String(call[0]).startsWith("live:notified:")),
        ).toBe(false);
    });

    it("un envoi refusé ne consomme pas la clé : la passe suivante réessaiera", async () => {
        mockSend.mockResolvedValue(null);

        const outcome = await runLiveWatch({ now: NOW });

        expect(outcome.notified).toBe(0);
        expect(outcome.failed).toBe(1);
        expect(
            mockRedis.set.mock.calls.some((call: any[]) => String(call[0]).startsWith("live:notified:")),
        ).toBe(false);
    });

    it("un live commencé il y a plus de 2 h n'est pas annoncé", async () => {
        streamsPayload[0].started_at = new Date(NOW.getTime() - 3 * 60 * 60_000).toISOString();

        const outcome = await runLiveWatch({ now: NOW });

        expect(mockSend).not.toHaveBeenCalled();
        expect(outcome.reasons.too_old).toBe(1);
    });

    it("le ping vient du réglage de la guilde (liste vide ⇒ aucun ping)", async () => {
        await runLiveWatch({ now: NOW });
        expect(mockSend.mock.calls[0][2].mentionContent).toBeUndefined();

        vi.clearAllMocks();
        mockDb.guildConfig.findFirst.mockResolvedValue({ id: "ref-guild" });
        mockDb.contentCreator.findMany.mockResolvedValue([{ handle: "huzounet", twitch: null }]);
        mockDb.guildConfig.findMany.mockResolvedValue([
            { ...GUILD, livePingRoleIds: ["123456789012345678"] },
        ]);
        mockRedis.exists.mockResolvedValue(0);
        mockRedis.set.mockResolvedValue("OK");
        mockSend.mockResolvedValue("message-2");

        await runLiveWatch({ now: NOW });
        expect(mockSend.mock.calls[0][2].mentionContent).toBe("<@&123456789012345678>");
    });

    it("Redis indisponible ⇒ aucune annonce (jamais de doublon au retour)", async () => {
        mockRedis.exists.mockRejectedValue(new Error("redis down"));

        const outcome = await runLiveWatch({ now: NOW });

        expect(mockSend).not.toHaveBeenCalled();
        expect(outcome.failed).toBe(1);
    });
});
