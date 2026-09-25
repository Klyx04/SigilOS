/**
 * Disjoncteur par salon Discord — `src/lib/discord-channel-health.ts`.
 *
 * 🔁 Mesure du 25/09/2026 (bêta) : le salon `1468401237186707588` refusait une
 * écriture **exactement à `:10:00` de chaque heure** (18:10:00.87 puis
 * 19:10:00.447) parce que le status-ping (cron toutes les 5 min, garde-fou de
 * fréquence 60 min) le réessayait indéfiniment. Ce test verrouille…
 *  ① un salon en refus permanent est mis en pause (plus aucune écriture) ;
 *  ② le compteur d'échecs n'est incrémenté qu'**une fois par épisode** ⇒ l'alerte
 *    ne part qu'au premier échec, pas 24 fois par jour ;
 *  ③ la pause s'allonge (15 min → 1 h) sans jamais dépasser 1 h (le silence reste
 *    borné si un humain répare le salon) ;
 *  ④ une écriture réussie efface la pause ET le compteur ;
 *  ⑤ Redis indisponible ⇒ disjoncteur **inactif** (fail-open assumé, jamais
 *    d'écriture bloquée par la panne de son propre garde-fou).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * État Redis simulé — `vi.hoisted` car le factory de `vi.mock` est évalué AVANT
 * les `const` du fichier (sinon : « Cannot access before initialization »).
 */
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

import {
    DISCORD_CHANNEL_BLOCK_FIRST_TTL_SECONDS,
    DISCORD_CHANNEL_BLOCK_MAX_TTL_SECONDS,
    discordBlockTtlSeconds,
    discordChannelBlockKey,
    isDiscordChannelBlocked,
    markDiscordChannelBlocked,
    clearDiscordChannelBlock,
    listBlockedDiscordChannels,
} from "@/lib/discord-channel-health";

const CHANNEL = "1468401237186707588";

beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    zsets.clear();
    redisMock.status = "ready";
});

describe("discordBlockTtlSeconds — escalade bornée", () => {
    it("1 échec → 15 min ; ≥ 2 → 1 h (jamais plus : le silence reste borné)", () => {
        expect(discordBlockTtlSeconds(1)).toBe(DISCORD_CHANNEL_BLOCK_FIRST_TTL_SECONDS);
        expect(discordBlockTtlSeconds(2)).toBe(DISCORD_CHANNEL_BLOCK_MAX_TTL_SECONDS);
        expect(discordBlockTtlSeconds(500)).toBe(DISCORD_CHANNEL_BLOCK_MAX_TTL_SECONDS);
        expect(DISCORD_CHANNEL_BLOCK_MAX_TTL_SECONDS).toBe(60 * 60);
    });

    it("valeur incohérente (0, NaN) → repli sur la durée la plus courte", () => {
        expect(discordBlockTtlSeconds(0)).toBe(DISCORD_CHANNEL_BLOCK_FIRST_TTL_SECONDS);
        expect(discordBlockTtlSeconds(Number.NaN)).toBe(DISCORD_CHANNEL_BLOCK_FIRST_TTL_SECONDS);
    });
});

describe("clés Redis — une instance partagée prod/bêta (audit I-07)", () => {
    it("porte le préfixe d'environnement ET l'ID du salon", () => {
        const key = discordChannelBlockKey(CHANNEL);
        expect(key).toMatch(/^sigilos:(beta|prod):discord:channel_blocked:/);
        expect(key.endsWith(CHANNEL)).toBe(true);
    });
});

describe("markDiscordChannelBlocked / isDiscordChannelBlocked", () => {
    it("met le salon en pause et le signale comme bloqué", async () => {
        expect(await isDiscordChannelBlocked(CHANNEL)).toBe(false);

        const res = await markDiscordChannelBlocked(CHANNEL, { source: "test" });

        expect(res.alreadyBlocked).toBe(false);
        expect(res.failureCount).toBe(1);
        expect(res.blockedChannels).toContain(CHANNEL);
        expect(res.blockedCount).toBe(1);
        expect(await isDiscordChannelBlocked(CHANNEL)).toBe(true);
    });

    it("est IDEMPOTENT dans un épisode : pas de double incrément ni d'escalade", async () => {
        await markDiscordChannelBlocked(CHANNEL);
        const second = await markDiscordChannelBlocked(CHANNEL);

        expect(second.alreadyBlocked).toBe(true);
        // Le compteur reste à 1 ⇒ l'appelant (worker) n'alerte qu'une fois.
        expect(second.failureCount).toBe(1);
        expect(redisMock.incr).toHaveBeenCalledTimes(1);
        // …et la durée de pause n'a pas été re-poussée à 1 h par le 2e appel.
        const ttlArg = redisMock.set.mock.calls.at(-1)?.[3];
        expect(ttlArg).toBe(DISCORD_CHANNEL_BLOCK_FIRST_TTL_SECONDS);
    });

    it("après expiration de la pause, un nouvel échec escalade à 1 h", async () => {
        await markDiscordChannelBlocked(CHANNEL); // échec 1
        // La pause expire (Redis l'a supprimée), le COMPTEUR survit 24 h :
        store.delete(discordChannelBlockKey(CHANNEL));

        const res = await markDiscordChannelBlocked(CHANNEL);

        expect(res.alreadyBlocked).toBe(false);
        expect(res.failureCount).toBe(2);
        const ttlArg = redisMock.set.mock.calls.at(-1)?.[3];
        expect(ttlArg).toBe(DISCORD_CHANNEL_BLOCK_MAX_TTL_SECONDS);
    });

    it("agrège plusieurs salons en pause (liste bornée)", async () => {
        await markDiscordChannelBlocked("111111111111111111");
        const res = await markDiscordChannelBlocked("222222222222222222");

        expect(res.blockedCount).toBe(2);
        expect(res.blockedChannels).toEqual(["111111111111111111", "222222222222222222"]);
    });

    it("Redis en erreur ⇒ aucune exception, résultat neutre (l'appelant alerte quand même)", async () => {
        redisMock.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));
        const res = await markDiscordChannelBlocked(CHANNEL);
        expect(res.failureCount).toBe(0);
        expect(res.blockedCount).toBe(0);
    });
});

describe("clearDiscordChannelBlock — auto-guérison", () => {
    it("lève la pause ET remet le compteur à zéro (une panne future réalertera)", async () => {
        await markDiscordChannelBlocked(CHANNEL);
        await clearDiscordChannelBlock(CHANNEL);

        expect(await isDiscordChannelBlocked(CHANNEL)).toBe(false);
        expect(await listBlockedDiscordChannels()).toEqual([]);

        const res = await markDiscordChannelBlocked(CHANNEL);
        expect(res.failureCount).toBe(1);
    });
});

describe("Redis indisponible — fail-open assumé", () => {
    it("client non prêt ⇒ salon jamais considéré comme bloqué (aucune écriture bloquée)", async () => {
        redisMock.status = "connecting";

        expect(await isDiscordChannelBlocked(CHANNEL)).toBe(false);
        expect(await listBlockedDiscordChannels()).toEqual([]);
        // La pause ne peut pas être posée : résultat neutre, pas de commande émise.
        const res = await markDiscordChannelBlocked(CHANNEL);
        expect(res.failureCount).toBe(0);
        expect(redisMock.set).not.toHaveBeenCalled();
    });
});
