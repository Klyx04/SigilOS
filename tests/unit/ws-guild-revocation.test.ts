/**
 * Révocation d'accès aux rooms de guilde (audit 13/11/2026, lot 4f).
 *
 * Le défaut mesuré : l'appartenance n'était vérifiée qu'aux `*:join`, donc un
 * membre expulsé gardait son socket abonné à `guild:<id>`. Ce test verrouille
 * les règles pures qui décident **quelles rooms quitter**, **quels couples
 * (utilisateur, guilde) révoquer**, et le parse borné du canal Redis.
 *
 * ⚠️ Le verrou final lit les sources des éditeurs : c'est volontaire. L'audit a
 * montré que le risque réel est l'oubli d'un chemin d'archivage, pas la règle
 * elle-même. Il échoue bruyamment si un éditeur cesse de publier.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/redis", () => ({
    redis: { publish: vi.fn() },
}));
vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { redis } from "@/lib/redis";
import { publishGuildMemberRevoked } from "@/lib/guild-access-realtime";
import {
    DEFAULT_SWEEP_INTERVAL_MS,
    GUILD_MEMBER_REVOKED_CHANNEL,
    MAX_REVOCATION_PAYLOAD_CHARS,
    MAX_SWEEP_INTERVAL_MS,
    MIN_SWEEP_INTERVAL_MS,
    collectSocketGuildPairs,
    guildIdOfRoom,
    guildIdsOfRooms,
    pairKey,
    parseGuildMemberRevoked,
    planRevocations,
    roomsToLeaveForGuild,
    sweepIntervalMs,
} from "@/lib/ws-guild-revocation";

const GUILD = "1290442961380835451";
const GUILD_2 = "1290442961380835452";
const USER = "clx0user00000000000000000";

describe("rooms de guilde", () => {
    it("extrait l'identifiant d'une room principale", () => {
        expect(guildIdOfRoom(`guild:${GUILD}`)).toBe(GUILD);
    });

    it("extrait l'identifiant d'une sous-room guide, dofus ou raid-live", () => {
        expect(guildIdOfRoom(`guild:${GUILD}:guide:progression`)).toBe(GUILD);
        expect(guildIdOfRoom(`guild:${GUILD}:dofus:ouroboros`)).toBe(GUILD);
        expect(guildIdOfRoom(`guild:${GUILD}:raid-live:42`)).toBe(GUILD);
    });

    it("ignore la room globale et tout ce qui n'est pas une room de guilde", () => {
        expect(guildIdOfRoom("guild:global")).toBeNull();
        expect(guildIdOfRoom("guild:")).toBeNull();
        expect(guildIdOfRoom("user:abc")).toBeNull();
        expect(guildIdOfRoom("guild")).toBeNull();
    });

    it("dédoublonne les guildes d'un même socket", () => {
        expect(
            guildIdsOfRooms([`guild:${GUILD}`, `guild:${GUILD}:guide:x`, `guild:${GUILD_2}`, "guild:global"])
        ).toEqual([GUILD, GUILD_2]);
    });

    it("ne quitte que les rooms de la guilde visée, sous-rooms comprises", () => {
        expect(
            roomsToLeaveForGuild(
                [`guild:${GUILD}`, `guild:${GUILD}:dofus:x`, `guild:${GUILD_2}`, "user:abc"],
                GUILD
            )
        ).toEqual([`guild:${GUILD}`, `guild:${GUILD}:dofus:x`]);
    });
});

describe("couples (utilisateur, guilde)", () => {
    const socket = (userId: string | null | undefined, rooms: string[]) => ({ userId, rooms });

    it("ignore les sockets sans identité (auth coupée)", () => {
        expect(collectSocketGuildPairs([socket(undefined, [`guild:${GUILD}`])]).pairs).toEqual([]);
    });

    it("fusionne les doublons d'un même utilisateur", () => {
        const { pairs } = collectSocketGuildPairs([
            socket(USER, [`guild:${GUILD}`]),
            socket(USER, [`guild:${GUILD}`, `guild:${GUILD}:guide:x`]),
        ]);
        expect(pairs).toEqual([{ userId: USER, guildId: GUILD }]);
    });

    it("borne la passe et signale la troncature", () => {
        const { pairs, truncated } = collectSocketGuildPairs(
            [socket(USER, [`guild:${GUILD}`, `guild:${GUILD_2}`])],
            1
        );
        expect(pairs).toHaveLength(1);
        expect(truncated).toBe(true);
    });

    it("ne révoque pas un couple encore ACTIVE", () => {
        const pairs = [{ userId: USER, guildId: GUILD }];
        const active = new Set([pairKey(USER, GUILD)]);
        expect(planRevocations(pairs, active)).toEqual([]);
    });

    it("révoque un couple absent des profils ACTIVE, sans doublon", () => {
        const pairs = [
            { userId: USER, guildId: GUILD },
            { userId: USER, guildId: GUILD },
            { userId: USER, guildId: GUILD_2 },
        ];
        const active = new Set([pairKey(USER, GUILD_2)]);
        expect(planRevocations(pairs, active)).toEqual([{ userId: USER, guildId: GUILD }]);
    });
});

describe("intervalle du sweep", () => {
    it("retombe sur le défaut quand la valeur est absente ou invalide", () => {
        expect(sweepIntervalMs(undefined)).toBe(DEFAULT_SWEEP_INTERVAL_MS);
        expect(sweepIntervalMs("")).toBe(DEFAULT_SWEEP_INTERVAL_MS);
        expect(sweepIntervalMs("abc")).toBe(DEFAULT_SWEEP_INTERVAL_MS);
        expect(sweepIntervalMs("0")).toBe(DEFAULT_SWEEP_INTERVAL_MS);
        expect(sweepIntervalMs("-100")).toBe(DEFAULT_SWEEP_INTERVAL_MS);
    });

    it("borne les valeurs trop petites et trop grandes", () => {
        expect(sweepIntervalMs("1000")).toBe(MIN_SWEEP_INTERVAL_MS);
        expect(sweepIntervalMs("30000")).toBe(30_000);
        expect(sweepIntervalMs("9999999")).toBe(MAX_SWEEP_INTERVAL_MS);
    });
});

describe("parse du canal de révocation", () => {
    it("accepte un payload avec userId interne", () => {
        expect(
            parseGuildMemberRevoked(JSON.stringify({ discordGuildId: GUILD, userId: USER, reason: "BANNED" }))
        ).toEqual({ discordGuildId: GUILD, userId: USER, reason: "BANNED" });
    });

    it("accepte un payload avec discordId (cas du bot) et un Buffer", () => {
        const raw = Buffer.from(
            JSON.stringify({ discordGuildId: GUILD, discordId: "123456789012345678", reason: "LEFT" })
        );
        expect(parseGuildMemberRevoked(raw)).toEqual({
            discordGuildId: GUILD,
            discordId: "123456789012345678",
            reason: "LEFT",
        });
    });

    it("refuse un JSON invalide, un identifiant non snowflake ou une raison inconnue", () => {
        expect(parseGuildMemberRevoked("{")).toBeNull();
        expect(parseGuildMemberRevoked(JSON.stringify({ discordGuildId: "42", userId: USER, reason: "LEFT" }))).toBeNull();
        expect(parseGuildMemberRevoked(JSON.stringify({ discordGuildId: GUILD, userId: USER, reason: "OTHER" }))).toBeNull();
    });

    it("refuse un payload sans cible et un payload trop long", () => {
        expect(parseGuildMemberRevoked(JSON.stringify({ discordGuildId: GUILD, reason: "BANNED" }))).toBeNull();
        expect(parseGuildMemberRevoked("x".repeat(MAX_REVOCATION_PAYLOAD_CHARS + 1))).toBeNull();
    });
});

describe("publisher de révocation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(redis.publish).mockResolvedValue(1);
    });

    it("publie sur le canal dédié et retourne true", async () => {
        const payload = { discordGuildId: GUILD, userId: USER, reason: "ARCHIVED" as const };
        await expect(publishGuildMemberRevoked(payload)).resolves.toBe(true);
        expect(redis.publish).toHaveBeenCalledWith(GUILD_MEMBER_REVOKED_CHANNEL, JSON.stringify(payload));
    });

    it("ne lève jamais quand Redis est indisponible et retourne false", async () => {
        vi.mocked(redis.publish).mockRejectedValue(new Error("redis down"));
        await expect(
            publishGuildMemberRevoked({ discordGuildId: GUILD, userId: USER, reason: "BANNED" })
        ).resolves.toBe(false);
    });
});

describe("verrou — les chemins d'archivage publient la révocation", () => {
    const EDITORS = [
        "src/server/actions/member-lifecycle-actions.ts",
        "src/server/actions/lifecycle-actions.ts",
        "src/server/actions/sync-actions.ts",
        "src/server/actions/god-lifecycle-actions.ts",
    ];

    for (const file of EDITORS) {
        it(`${file} appelle publishGuildMemberRevoked`, () => {
            const source = readFileSync(file, "utf8");
            expect(source).toContain("publishGuildMemberRevoked");
        });
    }

    it("le serveur WS instancie le module et l'arrête au shutdown", () => {
        const source = readFileSync("src/server/websocket/server.ts", "utf8");
        expect(source).toContain("createGuildRevocation");
        expect(source).toContain("guildRevocation.stop()");
    });
});
