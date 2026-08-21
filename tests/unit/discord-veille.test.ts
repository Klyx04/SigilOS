/**
 * #223 D — VEILLE Discord automatique (`runDiscordVeille`).
 * Vérifie : veille OK (audit + empreinte stockée), anomalies (gateway down,
 * docs modifiées, mots-clés changelog) → notifyGod, et rappel unique jour J.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
vi.mock("@/lib/redis", () => ({
    redis: {
        get: (...args: any[]) => mockRedisGet(...args),
        set: (...args: any[]) => mockRedisSet(...args),
    },
}));

const mockCreateSystemAuditLog = vi.fn();
vi.mock("@/lib/dofensive-sync", () => ({
    createSystemAuditLog: (...args: any[]) => mockCreateSystemAuditLog(...args),
}));

const mockNotifyGod = vi.fn();
vi.mock("@/server/actions/god-notif-actions", () => ({
    notifyGod: (...args: any[]) => mockNotifyGod(...args),
}));

import { runDiscordVeille, DISCORD_DAY_J, DISCORD_DAY_J_WINDOW_START } from "@/lib/discord-veille";

function makeFetcher(overrides: {
    gateway?: { ok: boolean; body?: string };
    llms?: { ok: boolean; body?: string };
    changelog?: { ok: boolean; body?: string };
}) {
    return vi.fn((url: string) => {
        const u = String(url);
        if (u.includes("/gateway")) {
            return Promise.resolve({
                ok: overrides.gateway?.ok ?? true,
                status: overrides.gateway?.ok === false ? 500 : 200,
                text: async () => overrides.gateway?.body ?? JSON.stringify({ url: "wss://gateway.discord.gg" }),
            } as any);
        }
        if (u.includes("llms.txt")) {
            return Promise.resolve({
                ok: overrides.llms?.ok ?? true,
                status: overrides.llms?.ok === false ? 500 : 200,
                text: async () => overrides.llms?.body ?? "index des docs Discord",
            } as any);
        }
        return Promise.resolve({
            ok: overrides.changelog?.ok ?? true,
            status: overrides.changelog?.ok === false ? 500 : 200,
            text: async () => overrides.changelog?.body ?? "<html>changelog sans mot-clé</html>",
        } as any);
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null); // aucune empreinte précédente / aucun rappel envoyé
    mockRedisSet.mockResolvedValue("OK");
    mockCreateSystemAuditLog.mockResolvedValue(undefined);
    mockNotifyGod.mockResolvedValue({ success: true });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("runDiscordVeille — cas nominal", () => {
    it("rien à signaler : audit God écrit, empreinte llms stockée, PAS de notifyGod", async () => {
        vi.stubGlobal("fetch", makeFetcher({}));

        const report = await runDiscordVeille();

        expect(report.anomalies).toEqual([]);
        expect(report.gatewayOk).toBe(true);
        expect(mockNotifyGod).not.toHaveBeenCalled();
        expect(mockCreateSystemAuditLog).toHaveBeenCalled();
        // l'empreinte est persistée (1 set) + éventuellement le rappel (0 ici) → set appelé
        expect(mockRedisSet).toHaveBeenCalled();
        const setArgs = mockRedisSet.mock.calls.map((c) => c[0]);
        expect(setArgs).toContain("discord:veille:llms-hash");
    });
});

describe("runDiscordVeille — anomalies → alerte God", () => {
    it("gateway v10 KO → anomalie + notifyGod(ping)", async () => {
        vi.stubGlobal("fetch", makeFetcher({ gateway: { ok: false } }));

        const report = await runDiscordVeille();

        expect(report.gatewayOk).toBe(false);
        expect(report.anomalies.some((a) => a.includes("gateway"))).toBe(true);
        expect(mockNotifyGod).toHaveBeenCalledTimes(1);
        expect(mockNotifyGod.mock.calls[0][0]).toMatchObject({ success: false, ping: true });
    });

    it("docs modifiées (empreinte différente) → anomalie + rappel", async () => {
        mockRedisGet.mockImplementation(async (key: string) => {
            if (key === "discord:veille:llms-hash") return "ancienne-empreinte";
            return null;
        });
        vi.stubGlobal("fetch", makeFetcher({}));

        const report = await runDiscordVeille();

        expect(report.docsChanged).toBe(true);
        expect(report.anomalies.some((a) => a.includes("llms.txt"))).toBe(true);
        expect(mockNotifyGod).toHaveBeenCalledTimes(1);
    });

    it("mot-clé inquiétant dans le changelog → anomalie citant le mot-clé", async () => {
        vi.stubGlobal("fetch", makeFetcher({ changelog: { ok: true, body: "Breaking Change API v11 announced" } }));

        const report = await runDiscordVeille();

        expect(report.keywordsFound).toContain("Breaking Change");
        expect(report.anomalies.some((a) => a.includes("Breaking Change"))).toBe(true);
        expect(mockNotifyGod).toHaveBeenCalledTimes(1);
    });
});

describe("runDiscordVeille — fenêtre jour J (16/11/2026)", () => {
    it("avant la fenêtre : pas de rappel jour J", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-05T09:00:00.000Z"));
        vi.stubGlobal("fetch", makeFetcher({}));

        const report = await runDiscordVeille();

        expect(report.dayJStatus).toBe("before-window");
        expect(report.anomalies.some((a) => a.includes("Jour J"))).toBe(false);
    });

    it("dans la fenêtre (avant le jour J) : rappel UNIQUE", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-05T09:00:00.000Z"));
        vi.stubGlobal("fetch", makeFetcher({}));

        const report = await runDiscordVeille();

        expect(report.dayJStatus).toBe("remind");
        expect(report.anomalies.some((a) => a.includes("16/11/2026"))).toBe(true);
        // le flag de rappel est posé une fois
        const remindedSet = mockRedisSet.mock.calls.find((c) => c[0] === "discord:veille:day-j-reminded");
        expect(remindedSet).toBeTruthy();
    });

    it("après le jour J : rappel checklist §10.5", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
        vi.stubGlobal("fetch", makeFetcher({}));

        const report = await runDiscordVeille();

        expect(report.dayJStatus).toBe("passed");
        expect(report.anomalies.some((a) => a.includes("Jour J 16/11/2026 atteint"))).toBe(true);
        expect(mockNotifyGod).toHaveBeenCalledTimes(1);
    });

    it("constantes du point dur officiel (dates correctes)", () => {
        expect(DISCORD_DAY_J).toBe("2026-11-16");
        expect(DISCORD_DAY_J_WINDOW_START).toBe("2026-11-01");
    });
});

