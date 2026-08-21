import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    isObfuscatedChannel,
    safeChannelName,
    assertUsableChannel,
    fetchGuildChannels,
} from "@/server/discord";

/**
 * #223 — Résilience Discord long terme (obfuscation des salons, HTTP le 16/11/2026).
 * Vérifie que les helpers détectent les salons obfusqués et que
 * fetchGuildChannels ne renvoie JAMAIS `___hidden___` à l'UI/base.
 */
describe("discord-obfuscation — salons obfusqués (chantier #223)", () => {
    describe("isObfuscatedChannel", () => {
        it("détecte le nom ___hidden___ (forme logique du changelog 12/08/2026)", () => {
            expect(isObfuscatedChannel({ name: "___hidden___", flags: 0 })).toBe(true);
        });

        it("détecte le flag CHANNEL_OBFUSCATED = 1 << 17 = 131072", () => {
            expect(isObfuscatedChannel({ name: "vocal", flags: 131072 })).toBe(true);
            expect(isObfuscatedChannel({ name: "vocal", flags: 131073 })).toBe(true); // flag combiné
        });

        it("accepte un salon normal / sans nom / sans flag", () => {
            expect(isObfuscatedChannel({ name: "annonces", flags: 0 })).toBe(false);
            expect(isObfuscatedChannel({ name: null, flags: 0 })).toBe(false);
            expect(isObfuscatedChannel({ name: undefined })).toBe(false);
        });
    });

    describe("safeChannelName", () => {
        it("renvoie le nom d'un salon normal", () => {
            expect(safeChannelName({ name: "annonces" })).toBe("annonces");
        });

        it("renvoie null pour un salon obfusqué ou sans nom (l'UI affiche « Salon masqué »)", () => {
            expect(safeChannelName({ name: "___hidden___" })).toBeNull();
            expect(safeChannelName({ name: "vocal", flags: 131072 })).toBeNull();
            expect(safeChannelName({ name: null })).toBeNull();
            expect(safeChannelName({})).toBeNull();
        });

        it("ne renvoie JAMAIS ___hidden___", () => {
            expect(safeChannelName({ name: "___hidden___" })).not.toBe("___hidden___");
        });
    });

    describe("assertUsableChannel", () => {
        it("refuse un salon obfusqué (fail-closed, pas d'écriture)", () => {
            expect(assertUsableChannel({ name: "___hidden___" })).toBe(false);
            expect(assertUsableChannel({ name: "vocal", flags: 131072 })).toBe(false);
        });

        it("accepte un salon normal", () => {
            expect(assertUsableChannel({ name: "annonces" })).toBe(true);
        });
    });

    describe("fetchGuildChannels — ne renvoie JAMAIS ___hidden___", () => {
        beforeEach(() => {
            process.env.DISCORD_BOT_TOKEN = "test-token";
        });
        afterEach(() => {
            vi.unstubAllGlobals();
            delete process.env.DISCORD_BOT_TOKEN;
        });

        it("nullifie les salons obfusqués et garde les salons normaux", async () => {
            const channels = [
                { id: "1", name: "annonces", type: 0, position: 1 },
                { id: "2", name: "___hidden___", type: 0, position: 2, flags: 131072 },
                { id: "3", name: "vocal", type: 2, position: 3 },
            ];
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: "OK",
                json: async () => channels,
            } as any));

            const result = await fetchGuildChannels("123456789");
            const names = result.map(c => c.name);
            expect(names).toContain("annonces");
            expect(names).toContain("vocal");
            expect(names).not.toContain("___hidden___");
            expect(result.find(c => c.id === "2")?.name).toBeNull();
        });

        it("tolère les salons omis par l'API HTTP (présents dans la config mais absents de la réponse)", async () => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: "OK",
                json: async () => [
                    { id: "1", name: "annonces", type: 0, position: 1 },
                ],
            } as any));

            // L'API HTTP omettra les salons sans VIEW_CHANNEL (16/11/2026) : la liste
            // ne doit pas lever d'erreur pour un salon manquant — l'appelant gère via l'ID.
            const result = await fetchGuildChannels("444444444");
            expect(result.length).toBeGreaterThanOrEqual(1);
        });

        it("utilise le cache (1 min) — le contenu stocké est déjà assaini", async () => {
            const channels = [
                { id: "1", name: "annonces", type: 0, position: 1 },
                { id: "2", name: "___hidden___", type: 0, position: 2, flags: 131072 },
            ];
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: "OK",
                json: async () => channels,
            } as any);
            vi.stubGlobal("fetch", fetchMock);

            await fetchGuildChannels("999999999");
            const second = await fetchGuildChannels("999999999"); // depuis le cache TTL 60s
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(second.map(c => c.name)).not.toContain("___hidden___");
            expect(second.find(c => c.id === "2")?.name).toBeNull();
        });
    });
});
