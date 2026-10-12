import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAuditExecutor, executorMetadata, DISCORD_AUDIT_ACTIONS } from "@/server/discord";

/**
 * Exécutant réel Discord (journal d'audit) : best-effort, jamais de throw,
 * jamais de tech exposée (l'UI traduit/masque).
 */

const GUILD_ID = "111111111111111111";
const TARGET_ID = "222222222222222222";
const STAFF_ID = "333333333333333333";

function recentSnowflake(ageMs: number): string {
    return ((BigInt(Date.now() - ageMs - 1420070400000) << 22n) | 1n).toString();
}

function mockAuditFetch(entries: unknown[], users: unknown[]) {
    vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ audit_log_entries: entries, users }),
        })
    );
}

describe("fetchAuditExecutor", () => {
    const originalToken = process.env.DISCORD_BOT_TOKEN;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.DISCORD_BOT_TOKEN = "fake-token";
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        if (originalToken === undefined) delete process.env.DISCORD_BOT_TOKEN;
        else process.env.DISCORD_BOT_TOKEN = originalToken;
    });

    it("retourne l'exécutant de l'entrée la plus récente visant la cible", async () => {
        mockAuditFetch(
            [
                { id: recentSnowflake(60_000), target_id: TARGET_ID, user_id: STAFF_ID },
                { id: recentSnowflake(5_000), target_id: "999999999999999999", user_id: STAFF_ID },
            ],
            [{ id: STAFF_ID, username: "ModoDofus", bot: false }]
        );
        const exec = await fetchAuditExecutor(GUILD_ID, DISCORD_AUDIT_ACTIONS.BAN_ADD, TARGET_ID);
        expect(exec).toEqual({ userId: STAFF_ID, username: "ModoDofus", isBot: false });
    });

    it("ignore les entrées trop anciennes (best-effort → null)", async () => {
        mockAuditFetch(
            [{ id: recentSnowflake(30 * 24 * 60 * 60 * 1000), target_id: TARGET_ID, user_id: STAFF_ID }],
            [{ id: STAFF_ID, username: "ModoDofus", bot: false }]
        );
        const exec = await fetchAuditExecutor(GUILD_ID, DISCORD_AUDIT_ACTIONS.KICK, TARGET_ID);
        expect(exec).toBeNull();
    });

    it("null sans token ou sans entrée (vérifié, personne)", async () => {
        delete process.env.DISCORD_BOT_TOKEN;
        await expect(fetchAuditExecutor(GUILD_ID, 22, TARGET_ID)).resolves.toBeNull();

        process.env.DISCORD_BOT_TOKEN = "fake-token";
        mockAuditFetch([], []);
        await expect(fetchAuditExecutor(GUILD_ID, 22, TARGET_ID)).resolves.toBeNull();
    });

    it("throw sur erreur technique (pour distinguer de « vérifié, personne »)", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })
        );
        await expect(fetchAuditExecutor(GUILD_ID, 22, TARGET_ID)).rejects.toThrow();

        vi.stubGlobal(
            "fetch",
            vi.fn().mockRejectedValue(new Error("down"))
        );
        await expect(fetchAuditExecutor(GUILD_ID, 22, TARGET_ID)).rejects.toThrow();
    }, 15000);
});

describe("executorMetadata", () => {
    it("marque lui-même quand l'exécutant est la cible", () => {
        expect(
            executorMetadata({ userId: TARGET_ID, username: "Joueur", isBot: false }, TARGET_ID)
        ).toEqual({ executorId: TARGET_ID, executorTag: "Joueur", executorIsSelf: true });
    });

    it("marque les bots tiers", () => {
        expect(executorMetadata({ userId: "444444444444444444", username: "MEE6", isBot: true }, TARGET_ID)).toEqual({
            executorId: "444444444444444444",
            executorTag: "MEE6",
            executorIsBot: true,
        });
    });

    it("objet vide si inconnu", () => {
        expect(executorMetadata(null)).toEqual({});
    });
});
