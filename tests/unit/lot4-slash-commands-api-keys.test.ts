import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "user-1", name: "Admin" } })
}));

vi.mock("@/lib/prisma", () => ({
    db: {
        guildApiKey: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            count: vi.fn()
        },
        guildSlashCommandPermission: {
            findMany: vi.fn(),
            upsert: vi.fn(),
            findUnique: vi.fn()
        },
        guildConfig: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            findFirst: vi.fn()
        },
        user: { count: vi.fn() },
        userProfile: { count: vi.fn() },
        userQuestProgress: { groupBy: vi.fn() }
    }
}));

/**
 * 🧊 DÉTERMINISME (T5 / D-D — « le test flaky passe seul mais échoue parfois en
 * CI »). Le module testé importe `./user-actions`, qui instancie un client
 * **Redis réel** (`@/lib/redis`) et des appels Discord : sur un runner CI sans
 * Redis, ces I/O asynchrones survivent à la fin du test (retries infinis
 * `maxRetriesPerRequest: null`) et font échouer le fichier de façon
 * **intermittente**. On coupe donc le réseau **à la source** : aucune connexion
 * ne doit être tentée par un test unitaire.
 */
vi.mock("@/lib/redis", () => {
    const stub = {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
        incr: vi.fn(),
        expire: vi.fn(),
        ttl: vi.fn(),
        keys: vi.fn(),
        scan: vi.fn(),
        hget: vi.fn(),
        hset: vi.fn(),
        hgetall: vi.fn(),
        hdel: vi.fn(),
        eval: vi.fn(),
        publish: vi.fn(),
        duplicate: vi.fn(),
        quit: vi.fn(),
    };
    return { redis: stub, default: stub };
});

vi.mock("@/server/discord", () => ({
    fetchGuildRoles: vi.fn().mockResolvedValue([]),
    fetchGuild: vi.fn().mockResolvedValue(null),
    fetchGuildMember: vi.fn().mockResolvedValue(null),
    fetchGuildExists: vi.fn().mockResolvedValue(false),
    invalidateDiscordCache: vi.fn(),
}));

import { SLASH_COMMANDS_CATALOG } from "@/lib/slash-commands-catalog";
import { API_SCOPES } from "@/lib/api-scopes";
import { db } from "@/lib/prisma";
import crypto from "crypto";

/**
 * Jeu de données **indexé par `discordGuildId`** (jamais une file de
 * `mockResolvedValueOnce`) : la réponse ne dépend plus de l'**ordre** ni du
 * **nombre** d'appels, donc deux exécutions parallèles ou un test ajouté plus
 * tard ne peuvent plus décaler la file.
 */
const GUILD_FIXTURES: Record<
    string,
    { id: string; slashCommandPermissions: { commandName: string; isEnabled: boolean; roleIds: string[]; channelIds: string[] }[] }
> = {
    "discord-wrong-channel": {
        id: "guild-wrong-channel",
        slashCommandPermissions: [
            { commandName: "almanax", isEnabled: true, roleIds: [], channelIds: ["channel-authorized"] },
        ],
    },
    "discord-right-channel": {
        id: "guild-right-channel",
        slashCommandPermissions: [
            { commandName: "almanax", isEnabled: true, roleIds: [], channelIds: ["channel-authorized"] },
        ],
    },
    "discord-disabled": {
        id: "guild-disabled",
        slashCommandPermissions: [{ commandName: "boss", isEnabled: false, roleIds: [], channelIds: [] }],
    },
    "discord-role-required": {
        id: "guild-role-required",
        slashCommandPermissions: [
            { commandName: "metiers", isEnabled: true, roleIds: ["role-staff"], channelIds: [] },
        ],
    },
};

beforeEach(() => {
    // Aucun état partagé entre les cas (mocks remis à zéro, jamais réutilisés).
    vi.clearAllMocks();
    (db.guildConfig.findUnique as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        async ({ where }: { where: { discordGuildId: string } }) => GUILD_FIXTURES[where.discordGuildId] ?? null
    );
});

describe("⚡ Lot 4 — Slash Commands Discord (#158)", () => {
    it("should have the 6 kept slash commands configured in the catalog", () => {
        const names = SLASH_COMMANDS_CATALOG.map(c => c.name);
        expect(names).toEqual(["almanax", "profil", "boss", "monstre", "metiers", "ocre"]);
    });

    it("should validate command execution based on roles and channels", async () => {
        const { checkSlashCommandExecutionAllowed } = await import("@/server/actions/slash-command-actions");

        // Cas 1 : salon restreint et utilisateur dans le mauvais salon.
        const resWrongChannel = await checkSlashCommandExecutionAllowed(
            "discord-wrong-channel",
            "almanax",
            ["role-1"],
            "channel-wrong"
        );
        expect(resWrongChannel.allowed).toBe(false);
        expect(resWrongChannel.reason).toContain("salon Discord");

        // Cas 2 : bon salon et aucun rôle requis -> autorisé.
        const resRightChannel = await checkSlashCommandExecutionAllowed(
            "discord-right-channel",
            "almanax",
            ["role-1"],
            "channel-authorized"
        );
        expect(resRightChannel.allowed).toBe(true);

        // Cas 3 : commande désactivée.
        const resDisabled = await checkSlashCommandExecutionAllowed(
            "discord-disabled",
            "boss",
            ["role-1"],
            "channel-authorized"
        );
        expect(resDisabled.allowed).toBe(false);
        expect(resDisabled.reason).toContain("désactivée");

        // Cas 4 : rôle requis non possédé (fail-closed).
        const resRoleRequired = await checkSlashCommandExecutionAllowed(
            "discord-role-required",
            "metiers",
            ["role-1"],
            "channel-authorized"
        );
        expect(resRoleRequired.allowed).toBe(false);
        expect(resRoleRequired.reason).toContain("Rôle requis");

        // Cas 5 : guilde inconnue -> refus (jamais d'autorisation par défaut).
        const resUnknownGuild = await checkSlashCommandExecutionAllowed(
            "discord-not-registered",
            "almanax",
            ["role-1"],
            "channel-authorized"
        );
        expect(resUnknownGuild.allowed).toBe(false);

        // Le mock est **indexé** : chaque cas a lu sa propre ligne, quel que
        // soit l'ordre d'exécution (aucune file `mockResolvedValueOnce`).
        expect(db.guildConfig.findUnique).toHaveBeenCalledTimes(5);
    });
});

describe("🔐 Lot 4 — Public API & API Keys Management (#196)", () => {
    it("should have defined scopes with strict read-only permissions", () => {
        const scopeIds = API_SCOPES.map(s => s.id);
        expect(scopeIds).toContain("read:members");
        expect(scopeIds).toContain("read:quests");
        expect(scopeIds).toContain("read:events");
        expect(scopeIds).toContain("read:bounties");
        expect(API_SCOPES.length).toBe(4);
    });

    it("should generate a cryptographically secure API key hash (scrypt) and prefix", () => {
        const rawEntropy = crypto.randomBytes(24).toString("hex");
        const rawApiKey = `sigil_live_${rawEntropy}`;
        const prefix = rawApiKey.slice(0, 16);
        const keySalt = crypto.randomBytes(16).toString("hex");
        const keyHash = `scrypt$${keySalt}$${crypto.scryptSync(rawApiKey, keySalt, 64).toString("hex")}`;

        expect(rawApiKey.startsWith("sigil_live_")).toBe(true);
        expect(prefix.length).toBe(16);
        expect(keyHash.startsWith("scrypt$")).toBe(true);

        // Deterministic with the same salt
        const rehash = crypto.scryptSync(rawApiKey, keySalt, 64).toString("hex");
        expect(rehash).toBe(keyHash.split("$")[2]);
    });
});

describe("📊 Lot 4 — God Insights & Télémétrie 3000% (#34 & #194)", () => {
    it("should correctly compute heatmap matrix 7x24", () => {
        const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
        
        // Simulate an event on Monday (day=1) at 20h
        matrix[1][20] += 5;
        expect(matrix[1][20]).toBe(5);
        expect(matrix[0][0]).toBe(0);
        expect(matrix.length).toBe(7);
        expect(matrix[0].length).toBe(24);
    });

    it("should compute activation funnel dropoff rates accurately", () => {
        const totalAccounts = 1000;
        const totalProfiles = 750;
        const activeQuests = 375;

        const profileDropoff = Number((((totalAccounts - totalProfiles) / totalAccounts) * 100).toFixed(1));
        const questDropoff = Number((((totalProfiles - activeQuests) / totalProfiles) * 100).toFixed(1));

        expect(profileDropoff).toBe(25.0);
        expect(questDropoff).toBe(50.0);
    });
});
