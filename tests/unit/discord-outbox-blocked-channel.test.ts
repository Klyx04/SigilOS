/**
 * Le DISJONCTEUR est câblé dans l'outbox — non-régression du 25/09/2026.
 *
 * Chaîne mesurée : salon inaccessible (403 · code 50001) → job en file → refus
 * permanent → alerte → l'alerte repartait sur Discord par la MÊME file. Le
 * `webOnly` coupe la boucle ; le disjoncteur coupe ce qui restait : les
 * tentatives répétées vers un salon mort (mesuré : une par heure, indéfiniment,
 * sur `1468401237186707588`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQueueAdd = vi.fn();
vi.mock("@/lib/queue/discord-outbox-queue", () => ({
    DISCORD_OUTBOX_QUEUE_NAME: "discord-outbox",
    discordOutboxQueue: { add: (...args: any[]) => mockQueueAdd(...args) },
}));

const mockPostChannelMessage = vi.fn();
vi.mock("@/server/discord", () => ({
    postChannelMessage: (...args: any[]) => mockPostChannelMessage(...args),
    deleteChannelMessage: vi.fn(),
    patchChannelMessage: vi.fn(),
    createForumThread: vi.fn(),
}));

/** État Redis simulé (cf. `vi.hoisted` : le factory de `vi.mock` s'exécute avant les `const`). */
const { store, zsets, redisMock } = vi.hoisted(() => {
    const store = new Map<string, string>();
    const zsets = new Map<string, Map<string, number>>();
    const redisMock = {
        status: "ready" as string,
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        set: vi.fn(async (key: string, value: string, _mode?: string, _ttlSeconds?: number) => {
            store.set(key, value);
            return "OK";
        }),
        incr: vi.fn(async (key: string) => {
            const next = (Number.parseInt(store.get(key) ?? "0", 10) || 0) + 1;
            store.set(key, String(next));
            return next;
        }),
        expire: vi.fn(async () => 1),
        del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
        zadd: vi.fn(async (key: string, score: number, member: string) => {
            const zset = zsets.get(key) ?? new Map<string, number>();
            zset.set(member, score);
            zsets.set(key, zset);
            return 1;
        }),
        zrem: vi.fn(async (key: string, member: string) => {
            zsets.get(key)?.delete(member);
            return 1;
        }),
        zremrangebyscore: vi.fn(async () => 0),
        zrange: vi.fn(async (key: string) => Array.from(zsets.get(key)?.keys() ?? [])),
    };
    return { store, zsets, redisMock };
});

vi.mock("@/lib/redis", () => ({ redis: redisMock, default: redisMock }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { enqueueDiscordWrite, executeDiscordWrite } from "@/server/discord-outbox";
import {
    DiscordChannelBlockedError,
    isDiscordChannelBlockedError,
    markDiscordChannelBlocked,
    clearDiscordChannelBlock,
} from "@/lib/discord-channel-health";
import {
    buildAggregateOutboxFailureAlert,
    DiscordApiError,
} from "@/lib/discord-api-errors";

const CHANNEL = "1547020288380637305";

beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    zsets.clear();
    redisMock.status = "ready";
    mockQueueAdd.mockResolvedValue({ id: "job-1" });
});

describe("enqueueDiscordWrite — refus AVANT la file sur un salon en pause", () => {
    it("salon bloqué ⇒ erreur dédiée, AUCUN job déposé", async () => {
        await markDiscordChannelBlocked(CHANNEL);
        mockQueueAdd.mockClear();

        const promise = enqueueDiscordWrite({
            kind: "postMessage",
            channelId: CHANNEL,
            body: { content: "x" },
        });

        await expect(promise).rejects.toBeInstanceOf(DiscordChannelBlockedError);
        await expect(promise.catch((e) => isDiscordChannelBlockedError(e))).resolves.toBe(true);
        expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it("pause levée (écriture réussie) ⇒ la mise en file redevient possible", async () => {
        await markDiscordChannelBlocked(CHANNEL);
        await clearDiscordChannelBlock(CHANNEL);

        await expect(
            enqueueDiscordWrite({ kind: "postMessage", channelId: CHANNEL, body: { content: "x" } }),
        ).resolves.toEqual(expect.any(String));
        expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    });
});

describe("executeDiscordWrite — un job déjà en file n'est pas rejoué sur un salon en pause", () => {
    it("salon bloqué ⇒ refus, aucun appel HTTP", async () => {
        await markDiscordChannelBlocked(CHANNEL);

        await expect(
            executeDiscordWrite({ kind: "postMessage", channelId: CHANNEL, body: { content: "x" } }),
        ).rejects.toBeInstanceOf(DiscordChannelBlockedError);
        expect(mockPostChannelMessage).not.toHaveBeenCalled();
    });

    it("non-régression : un salon sain écrit normalement", async () => {
        mockPostChannelMessage.mockResolvedValue("123456789012345678");
        await expect(
            executeDiscordWrite({ kind: "postMessage", channelId: CHANNEL, body: { content: "x" } }),
        ).resolves.toEqual({ success: true, messageId: "123456789012345678" });
    });
});

describe("buildAggregateOutboxFailureAlert — le signal d'échelle", () => {
    it("résume M salons dans UNE ligne lisible, liste plafonnée", () => {
        const channels = Array.from({ length: 14 }, (_, i) => String(1000000000000000000n + BigInt(i)));

        const alert = buildAggregateOutboxFailureAlert({ channels, total: 14, kind: "postMessage" });

        expect(alert.success).toBe(false);
        expect(alert.type).toBe("SYSTEM");
        expect(alert.title).toContain("salons inaccessibles");
        expect(alert.message).toContain("**14**");
        // 10 salons montrés, le reste résumé par un compteur (jamais 14 lignes de salon).
        expect(alert.message).toContain("(+4 autre(s))");
        expect(alert.message.match(/`\d+`/g)).toHaveLength(10);
        // L'embed Discord ne rend que 5 champs : le contrat reste ≤ 5 entrées.
        expect(Object.keys(alert.metadata).length).toBeLessThanOrEqual(5);
    });
});

describe("classification d'un refus Discord — conservée", () => {
    it("403 ⇒ erreur définitive portant statut + salon (diagnostic de l'alerte)", async () => {
        mockPostChannelMessage.mockRejectedValue(
            new DiscordApiError("Le bot n'a pas accès à ce salon (Permission bloquée)", 403, 50001),
        );

        const err = await executeDiscordWrite({
            kind: "postMessage",
            channelId: CHANNEL,
            body: { content: "x" },
        }).catch((e) => e);

        expect(err.name).toBe("UnrecoverableError");
        expect(err.status).toBe(403);
        expect(err.discordCode).toBe(50001);
        expect(err.channelId).toBe(CHANNEL);
    });
});
