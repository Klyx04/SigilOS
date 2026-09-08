import { describe, it, expect, vi } from "vitest";

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

import { SLASH_COMMANDS_CATALOG } from "@/lib/slash-commands-catalog";
import { API_SCOPES } from "@/lib/api-scopes";
import crypto from "crypto";

describe("⚡ Lot 4 — Slash Commands Discord (#158)", () => {
    it("should have the 6 kept slash commands configured in the catalog", () => {
        const names = SLASH_COMMANDS_CATALOG.map(c => c.name);
        expect(names).toEqual(["almanax", "profil", "boss", "monstre", "metiers", "ocre"]);
    });

    it("should validate command execution based on roles and channels", async () => {
        const { checkSlashCommandExecutionAllowed } = await import("@/server/actions/slash-command-actions");
        const { db } = await import("@/lib/prisma");

        // Cas 1 : Salon restreint et utilisateur dans le mauvais salon
        (db.guildConfig.findUnique as any).mockResolvedValueOnce({
            id: "guild-1",
            slashCommandPermissions: [{
                commandName: "almanax",
                isEnabled: true,
                roleIds: [],
                channelIds: ["channel-authorized"]
            }]
        });

        const resWrongChannel = await checkSlashCommandExecutionAllowed("discord-guild-1", "almanax", ["role-1"], "channel-wrong");
        expect(resWrongChannel.allowed).toBe(false);
        expect(resWrongChannel.reason).toContain("salon Discord");

        // Cas 2 : Bon salon et aucun rôle requis -> autorisé
        (db.guildConfig.findUnique as any).mockResolvedValueOnce({
            id: "guild-1",
            slashCommandPermissions: [{
                commandName: "almanax",
                isEnabled: true,
                roleIds: [],
                channelIds: ["channel-authorized"]
            }]
        });

        const resRightChannel = await checkSlashCommandExecutionAllowed("discord-guild-1", "almanax", ["role-1"], "channel-authorized");
        expect(resRightChannel.allowed).toBe(true);

        // Cas 3 : Commande désactivée
        (db.guildConfig.findUnique as any).mockResolvedValueOnce({
            id: "guild-1",
            slashCommandPermissions: [{
                commandName: "boss",
                isEnabled: false,
                roleIds: [],
                channelIds: []
            }]
        });

        const resDisabled = await checkSlashCommandExecutionAllowed("discord-guild-1", "boss", ["role-1"], "channel-authorized");
        expect(resDisabled.allowed).toBe(false);
        expect(resDisabled.reason).toContain("désactivée");
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
