/**
 * Veille Discord (#223 D) — `runDiscordVeille`.
 *
 * Nouvelle source : le changelog **markdown** (`change-log.md`), structuré, au lieu de la
 * page HTML de ~3 Mo (dont on ne lisait que 150 000 caractères). Verrouille la séparation
 * **critique** (ping) / **information** (bleu, sans ping), la détection des breaking changes
 * par tag, la dédup et la fenêtre jour J.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

const OK_CHANGELOG = `<Update
  label="September 28, 2026"
  tags={["Docs"]}
  rss={{ title: "Videos in the Documentation", description: "Nothing sensitive." }}
>
body
</Update>`;

const BREAKING_CHANGELOG = `<Update
  label="November 16, 2026"
  tags={["HTTP API", "Breaking Change"]}
  rss={{ title: "Obfuscation enforced", description: "Webhook Events change." }}
>
body
</Update>`;

function makeFetcher(o: {
    gateway?: { ok?: boolean; body?: string };
    llms?: { ok?: boolean; body?: string };
    changelog?: { ok?: boolean; body?: string };
}) {
    return vi.fn((url: string) => {
        const u = String(url);
        const mk = (ok: boolean | undefined, def: string, body?: string) =>
            Promise.resolve({ ok: ok ?? true, status: ok === false ? 500 : 200, text: async () => body ?? def } as any);
        if (u.includes("/gateway")) return mk(o.gateway?.ok, JSON.stringify({ url: "wss://gateway.discord.gg" }), o.gateway?.body);
        if (u.includes("llms.txt")) return mk(o.llms?.ok, "index docs", o.llms?.body);
        return mk(o.changelog?.ok, OK_CHANGELOG, o.changelog?.body);
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue("OK");
    mockCreateSystemAuditLog.mockResolvedValue(undefined);
    mockNotifyGod.mockResolvedValue({ success: true });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

const at = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
};

describe("runDiscordVeille — nominal", () => {
    it("rien à signaler ⇒ audit écrit, empreintes stockées, AUCUN notifyGod", async () => {
        at("2026-09-05T09:00:00.000Z");
        vi.stubGlobal("fetch", makeFetcher({}));

        const report = await runDiscordVeille();

        expect(report.severity).toBe("ok");
        expect(report.anomalies).toEqual([]);
        expect(report.changelogOk).toBe(true);
        expect(mockNotifyGod).not.toHaveBeenCalled();
        expect(mockCreateSystemAuditLog).toHaveBeenCalled();
        const keys = mockRedisSet.mock.calls.map((c) => c[0]);
        expect(keys).toContain("discord:veille:llms-hash");
        expect(keys).toContain("discord:veille:breaking");
    });
});

describe("runDiscordVeille — critique (=> ping)", () => {
    it("gateway v10 KO ⇒ critique + notifyGod(ping, rouge)", async () => {
        at("2026-09-05T09:00:00.000Z");
        vi.stubGlobal("fetch", makeFetcher({ gateway: { ok: false } }));

        const report = await runDiscordVeille();

        expect(report.gatewayOk).toBe(false);
        expect(report.severity).toBe("critical");
        expect(report.critical.some((a) => a.includes("gateway"))).toBe(true);
        expect(mockNotifyGod).toHaveBeenCalledTimes(1);
        expect(mockNotifyGod.mock.calls[0][0].ping).toBe(true);
        expect(mockNotifyGod.mock.calls[0][0].success).toBe(false);
    });

    it("breaking change (tag `Breaking Change`) ⇒ critique datée + ping", async () => {
        at("2026-09-05T09:00:00.000Z");
        vi.stubGlobal("fetch", makeFetcher({ changelog: { body: BREAKING_CHANGELOG } }));

        const report = await runDiscordVeille();

        expect(report.breakingCount).toBe(1);
        expect(report.newBreakingCount).toBe(1);
        expect(report.critical.some((a) => a.includes("2026-11-16") && a.includes("Obfuscation enforced"))).toBe(true);
        expect(mockNotifyGod.mock.calls[0][0].ping).toBe(true);
    });

    it("breaking déjà vu (baseline Redis) ⇒ pas de nouveau breaking ⇒ information SANS ping", async () => {
        at("2026-09-05T09:00:00.000Z");
        mockRedisGet.mockImplementation(async (key: string) =>
            key === "discord:veille:breaking" ? JSON.stringify(["2026-11-16|Obfuscation enforced"]) : null);
        vi.stubGlobal("fetch", makeFetcher({ changelog: { body: BREAKING_CHANGELOG } }));

        const report = await runDiscordVeille();

        expect(report.newBreakingCount).toBe(0);
        expect(report.critical).toEqual([]);
        expect(mockNotifyGod).toHaveBeenCalledTimes(1);
        expect(mockNotifyGod.mock.calls[0][0].ping).toBe(false);
        expect(mockNotifyGod.mock.calls[0][0].success).toBe(true);
    });
});

describe("runDiscordVeille — information (sans ping)", () => {
    it("doc llms.txt changée ⇒ information bleue SANS ping", async () => {
        at("2026-09-05T09:00:00.000Z");
        mockRedisGet.mockImplementation(async (key: string) =>
            key === "discord:veille:llms-hash" ? "hash-precedent" : null);
        vi.stubGlobal("fetch", makeFetcher({}));

        const report = await runDiscordVeille();

        expect(report.docsChanged).toBe(true);
        expect(report.severity).toBe("notice");
        expect(mockNotifyGod).toHaveBeenCalledTimes(1);
        expect(mockNotifyGod.mock.calls[0][0].ping).toBe(false);
        expect(mockNotifyGod.mock.calls[0][0].success).toBe(true);
        expect(mockNotifyGod.mock.calls[0][0].message).toContain("llms.txt");
    });

    it("changelog illisible ⇒ information partielle (jamais critique)", async () => {
        at("2026-09-05T09:00:00.000Z");
        vi.stubGlobal("fetch", makeFetcher({ changelog: { ok: false } }));

        const report = await runDiscordVeille();

        expect(report.changelogOk).toBe(false);
        expect(report.critical).toEqual([]);
        expect(report.notices.some((n) => n.toLowerCase().includes("illisible"))).toBe(true);
    });

    it("champs d'embed en français (fin du jargon gatewayOk / dayJStatus)", async () => {
        at("2026-09-05T09:00:00.000Z");
        mockRedisGet.mockImplementation(async (key: string) =>
            key === "discord:veille:llms-hash" ? "hash-precedent" : null);
        vi.stubGlobal("fetch", makeFetcher({}));

        await runDiscordVeille();

        const fields = mockNotifyGod.mock.calls[0][0].fields as { name: string }[];
        const names = fields.map((f) => f.name);
        expect(names).toContain("Passerelle API v10");
        expect(names).toContain("Jour J 16/11");
        expect(names).not.toContain("gatewayOk");
    });
});

describe("runDiscordVeille — fenêtre jour J (16/11/2026)", () => {
    it("avant la fenêtre : pas de rappel jour J", async () => {
        at("2026-09-05T09:00:00.000Z");
        vi.stubGlobal("fetch", makeFetcher({}));

        const report = await runDiscordVeille();

        expect(report.dayJStatus).toBe("before-window");
        expect(report.anomalies.some((a) => a.includes("Jour J"))).toBe(false);
    });

    it("dans la fenêtre (avant le jour J) : rappel UNIQUE + critique", async () => {
        at("2026-11-05T09:00:00.000Z");
        vi.stubGlobal("fetch", makeFetcher({}));

        const report = await runDiscordVeille();

        expect(report.dayJStatus).toBe("remind");
        expect(report.critical.some((a) => a.includes("16/11/2026"))).toBe(true);
        expect(mockRedisSet.mock.calls.map((c) => c[0])).toContain("discord:veille:day-j-reminded");
    });

    it("après le jour J : checklist §10.5 (critique)", async () => {
        at("2026-11-17T09:00:00.000Z");
        vi.stubGlobal("fetch", makeFetcher({}));

        const report = await runDiscordVeille();

        expect(report.dayJStatus).toBe("passed");
        expect(report.critical.some((a) => a.includes("Jour J 16/11/2026 atteint"))).toBe(true);
        expect(mockNotifyGod).toHaveBeenCalledTimes(1);
    });

    it("constantes du point dur officiel", () => {
        expect(DISCORD_DAY_J).toBe("2026-11-16");
        expect(DISCORD_DAY_J_WINDOW_START).toBe("2026-11-01");
    });
});
