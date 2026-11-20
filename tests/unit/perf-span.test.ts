/**
 * `perf-web` P1-1 — spans serveur du dashboard.
 *
 * Deux intentions :
 * 1. **Contrat du helper** : `withSpan` rend exactement la promesse de
 *    `Sentry.startSpan` (aucun enrobage, aucun rejet avalé) et lui transmet un nom
 *    et une opération.
 * 2. **Verrou de source** : les appels du layout et les accès Prisma/Redis qui
 *    les composent restent instrumentés, avec des **noms constants** — jamais un
 *    `guildId` dans un nom de span (explosion de cardinalité + donnée inutile côté
 *    Sentry, §5.11 d'`AGENTS.md`).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const { startSpanMock, currentClientMock, registeredClientMock, setClientMock } = vi.hoisted(() => ({
    startSpanMock: vi.fn(),
    currentClientMock: vi.fn(),
    registeredClientMock: vi.fn(),
    setClientMock: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
    startSpan: (...args: unknown[]) => startSpanMock(...args),
    getClient: () => currentClientMock(),
    getCurrentScope: () => ({ setClient: setClientMock }),
}));

vi.mock("@/lib/perf-client", () => ({
    getRegisteredSentryClient: () => registeredClientMock(),
}));

import { withSpan } from "@/lib/perf-span";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const LAYOUT = read("src/app/dashboard/[guildId]/layout.tsx");
const GUILD_ACTIONS = read("src/server/actions/guild-actions.ts");
const MODULE_ACTIONS = read("src/server/actions/module-actions.ts");
const PLATFORM_CONFIG_ACTIONS = read("src/server/actions/platform-config-actions.ts");
const USER_ACTIONS = read("src/server/actions/user-actions.ts");

describe("withSpan — contrat", () => {
    beforeEach(() => {
        startSpanMock.mockReset();
        currentClientMock.mockReset().mockReturnValue({ id: "client-courant" });
        registeredClientMock.mockReset();
        setClientMock.mockReset();
    });

    it("rend exactement la promesse du SDK, sans l'enrober", () => {
        const sentinel = Promise.resolve(42);
        startSpanMock.mockReturnValue(sentinel);

        const result = withSpan("dashboard.layout.getUserContext", "function", () => Promise.resolve(0));

        expect(result).toBe(sentinel);
    });

    it("transmet un nom et une opération au SDK", () => {
        startSpanMock.mockImplementation((_options: unknown, callback: () => unknown) => callback());

        return withSpan("dashboard.layout.getUserGuilds", "function", async () => "ok").then((value) => {
            expect(value).toBe("ok");
            expect(startSpanMock).toHaveBeenCalledTimes(1);
            expect(startSpanMock.mock.calls[0][0]).toEqual({
                name: "dashboard.layout.getUserGuilds",
                op: "function",
            });
        });
    });

    it("propage le rejet de l'appel (jamais avalé)", async () => {
        startSpanMock.mockImplementation((_options: unknown, callback: () => Promise<unknown>) => callback());

        await expect(
            withSpan("userContext.discord.fetch", "http.client", async () => {
                throw new Error("Discord indisponible");
            }),
        ).rejects.toThrow("Discord indisponible");
    });

    it("rattache le client enregistré au démarrage quand le scope RSC n'en porte pas", () => {
        const registeredClient = { id: "client-serveur" };
        currentClientMock.mockReturnValue(undefined);
        registeredClientMock.mockReturnValue(registeredClient);
        startSpanMock.mockReturnValue(Promise.resolve(1));

        withSpan("dashboard.layout.getUserContext", "function", () => Promise.resolve(1));

        expect(setClientMock).toHaveBeenCalledWith(registeredClient);
        expect(startSpanMock).toHaveBeenCalledTimes(1);
    });

    it("ne touche pas au scope quand le client est déjà présent", () => {
        startSpanMock.mockReturnValue(Promise.resolve(1));

        withSpan("dashboard.layout.getUserContext", "function", () => Promise.resolve(1));

        expect(setClientMock).not.toHaveBeenCalled();
        expect(registeredClientMock).not.toHaveBeenCalled();
    });

    it("reste inoffensif si aucun client n'est disponible (Sentry désactivé)", () => {
        currentClientMock.mockReturnValue(undefined);
        registeredClientMock.mockReturnValue(undefined);
        startSpanMock.mockReturnValue(Promise.resolve(1));

        withSpan("dashboard.layout.getUserContext", "function", () => Promise.resolve(1));

        expect(setClientMock).not.toHaveBeenCalled();
        expect(startSpanMock).toHaveBeenCalledTimes(1);
    });
});

describe("dashboard — instrumentation serveur (verrou de source)", () => {
    it("les appels du layout sont enveloppés dans un span nommé", () => {
        for (const name of [
            "dashboard.layout.getUserContext",
            "dashboard.layout.getGuildHeaderData",
            "dashboard.layout.getUserGuilds",
            "dashboard.layout.getGuildModules",
            "dashboard.layout.getPlatformConfig",
            "dashboard.layout.getUpcomingGuildEvents",
        ]) {
            expect(LAYOUT).toContain(`"${name}"`);
        }
    });

    it("aucun nom de span n'est construit à partir de la guilde (cardinalité bornée)", () => {
        expect(LAYOUT).not.toMatch(/withSpan\(\s*`/);
        expect(LAYOUT).not.toMatch(/withSpan\([^,]*guildId/);
        expect(USER_ACTIONS).not.toMatch(/withSpan\(\s*`/);
        expect(GUILD_ACTIONS).not.toMatch(/withSpan\(\s*`/);
        expect(MODULE_ACTIONS).not.toMatch(/withSpan\(\s*`/);
        expect(PLATFORM_CONFIG_ACTIONS).not.toMatch(/withSpan\(\s*`/);
    });

    it("les accès Prisma et Redis sous-jacents sont mesurés", () => {
        expect(GUILD_ACTIONS).toContain('"guildHeader.guildConfig.read"');
        expect(GUILD_ACTIONS).toContain('"guildHeader.counts"');
        expect(MODULE_ACTIONS).toContain('"guildModules.guildConfig.read"');
        expect(PLATFORM_CONFIG_ACTIONS).toContain('"platformConfig.read"');
        expect(USER_ACTIONS).toContain('"userContext.redis.get"');
        expect(USER_ACTIONS).toContain('"userContext.guildConfig.read"');
        expect(USER_ACTIONS).toContain('"userContext.discord.fetch"');
        expect(USER_ACTIONS).toContain('"userGuilds.query"');
    });
});
