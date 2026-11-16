/**
 * Snapshot des serveurs Discord — **cache de connexion** (60 s).
 *
 * Le callback `signIn` lit déjà `GET /users/@me/guilds` ; le portail le relisait
 * dans la même seconde (429 → écran d'attente). Le snapshot est une donnée
 * d'**API externe** : validée et bornée par Zod dans les deux sens.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    DISCORD_GUILD_SNAPSHOT_MAX,
    parseDiscordGuildSnapshot,
    serializeDiscordGuildSnapshot,
} from "@/lib/discord-guilds-snapshot";

const read = (path: string) => readFileSync(path, "utf8");

const entry = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    name: `Guilde ${id}`,
    icon: null,
    owner: false,
    permissions: "0",
    ...extra,
});

describe("snapshot des serveurs Discord — borné et validé", () => {
    it("relit ce qu'il a écrit", () => {
        const payload = serializeDiscordGuildSnapshot([entry("100000000000000001", { owner: true })]);
        expect(payload).not.toBeNull();
        expect(parseDiscordGuildSnapshot(payload)?.[0]).toMatchObject({
            id: "100000000000000001",
            owner: true,
        });
    });

    it("refuse un JSON invalide ou une valeur qui n'est pas une liste", () => {
        expect(parseDiscordGuildSnapshot("{pas du json")).toBeNull();
        expect(parseDiscordGuildSnapshot('{"id":"1"}')).toBeNull();
        expect(parseDiscordGuildSnapshot(null)).toBeNull();
        expect(parseDiscordGuildSnapshot("")).toBeNull();
    });

    it("ignore les champs inconnus (aucune pollution de prototype)", () => {
        const raw = '[{"id":"100000000000000001","__proto__":{"polluted":true},"extra":"x"}]';
        expect(parseDiscordGuildSnapshot(raw)?.[0]).toEqual({ id: "100000000000000001" });
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("refuse une entrée sans identifiant", () => {
        expect(parseDiscordGuildSnapshot(JSON.stringify([{ name: "sans id" }]))).toBeNull();
        expect(serializeDiscordGuildSnapshot([{ name: "sans id" }])).toBeNull();
    });

    it("borne la liste à la limite Discord (200 serveurs)", () => {
        expect(DISCORD_GUILD_SNAPSHOT_MAX).toBe(200);
        const tooMany = Array.from({ length: DISCORD_GUILD_SNAPSHOT_MAX + 1 }, (_, index) =>
            entry(`10000000000000${String(index).padStart(4, "0")}`)
        );
        expect(serializeDiscordGuildSnapshot(tooMany)).toBeNull();
    });
});

describe("câblage — un seul appel Discord par connexion", () => {
    it("le callback signIn écrit le snapshot", () => {
        expect(read("src/auth.ts")).toContain("cacheDiscordUserGuilds(");
    });

    it("le portail lit le snapshot AVANT d'appeler Discord", () => {
        const source = read("src/server/actions/user-actions.ts");
        const fn = source.slice(source.indexOf("export async function getGuildsSeparated"));
        const readAt = fn.indexOf("readDiscordUserGuildsCache(");
        const fetchAt = fn.indexOf("await fetchDiscordUserGuilds(");
        expect(readAt).toBeGreaterThan(-1);
        expect(fetchAt).toBeGreaterThan(-1);
        expect(readAt).toBeLessThan(fetchAt);
    });
});
