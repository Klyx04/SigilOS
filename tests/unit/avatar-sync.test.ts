/**
 * Avatar Hash Resync — chantier #134 (reste backend).
 * Couvre : update seulement si changement, null → embed par défaut côté UI,
 * priorité avatar de guilde, fail-closed, itération multi-guildes du cron.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────
const mockListGuildMembers = vi.fn();
const mockGuildConfigFindUnique = vi.fn();
const mockGuildConfigFindMany = vi.fn();
const mockUserProfileFindMany = vi.fn();
const mockUserUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: {
            findUnique: (...args: any[]) => mockGuildConfigFindUnique(...args),
            findMany: (...args: any[]) => mockGuildConfigFindMany(...args),
        },
        userProfile: {
            findMany: (...args: any[]) => mockUserProfileFindMany(...args),
        },
        user: {
            update: (...args: any[]) => mockUserUpdate(...args),
        },
    },
}));

vi.mock("@/server/discord", () => ({
    listGuildMembers: (...args: any[]) => mockListGuildMembers(...args),
}));

import { resyncGuildAvatarHashes, syncAllGuildAvatars } from "@/server/actions/avatar-sync";

const GUILD = { id: "guild-internal-1", name: "Test Guild" };

function makeProfile(
    { userId = "user-1", image = null, discordId = "discord-1", noAccount = false }: {
        userId?: string;
        image?: string | null;
        discordId?: string | null;
        noAccount?: boolean;
    } = {}
) {
    return {
        userId,
        user: {
            id: userId,
            image,
            accounts: noAccount ? [] : [{ providerAccountId: discordId }],
        },
    };
}

function makeDiscordMember(
    { id = "discord-1", globalAvatar = "abc", guildAvatar = null }: {
        id?: string;
        globalAvatar?: string | null;
        guildAvatar?: string | null;
    } = {}
) {
    return {
        user: { id, username: "test", global_name: "Test", avatar: globalAvatar },
        nick: null,
        avatar: guildAvatar,
        roles: [],
        joined_at: "2026-01-01T00:00:00Z",
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGuildConfigFindUnique.mockResolvedValue(GUILD);
    mockUserProfileFindMany.mockResolvedValue([]);
    mockUserUpdate.mockResolvedValue({});
    delete process.env.ALLOWED_GUILD_IDS;
});

describe("resyncGuildAvatarHashes (#134 backend)", () => {
    it("retourne success=false si la guilde est introuvable (fail-closed)", async () => {
        mockGuildConfigFindUnique.mockResolvedValue(null);

        const result = await resyncGuildAvatarHashes("discord-guild-unknown");

        expect(result.success).toBe(false);
        expect(result.errors).toContain("Guild not found");
        expect(mockListGuildMembers).not.toHaveBeenCalled();
    });

    it("met à jour User.image quand le hash Discord a changé", async () => {
        mockListGuildMembers.mockResolvedValue([makeDiscordMember({ id: "discord-1", globalAvatar: "newhash" })]);
        mockUserProfileFindMany.mockResolvedValue([
            makeProfile({ image: "https://cdn.discordapp.com/avatars/discord-1/oldhash.webp?size=256" }),
        ]);

        const result = await resyncGuildAvatarHashes(GUILD.id);

        expect(result.success).toBe(true);
        expect(result.updated).toBe(1);
        expect(mockUserUpdate).toHaveBeenCalledWith({
            where: { id: "user-1" },
            data: { image: "https://cdn.discordapp.com/avatars/discord-1/newhash.webp?size=256" },
        });
    });

    it("écrit null quand l'avatar Discord est absent (null → embed par défaut côté UI)", async () => {
        mockListGuildMembers.mockResolvedValue([
            makeDiscordMember({ id: "discord-1", globalAvatar: null, guildAvatar: null }),
        ]);
        mockUserProfileFindMany.mockResolvedValue([
            makeProfile({ image: "https://cdn.discordapp.com/avatars/discord-1/stale.webp?size=256" }),
        ]);

        const result = await resyncGuildAvatarHashes(GUILD.id);

        expect(result.updated).toBe(1);
        expect(mockUserUpdate).toHaveBeenCalledWith({
            where: { id: "user-1" },
            data: { image: null },
        });
    });

    it("ne réécrit pas si l'image est déjà à jour (unchanged)", async () => {
        const current = "https://cdn.discordapp.com/avatars/discord-1/hash.webp?size=256";
        mockListGuildMembers.mockResolvedValue([makeDiscordMember({ id: "discord-1", globalAvatar: "hash" })]);
        mockUserProfileFindMany.mockResolvedValue([makeProfile({ image: current })]);

        const result = await resyncGuildAvatarHashes(GUILD.id);

        expect(result.unchanged).toBe(1);
        expect(result.updated).toBe(0);
        expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it("donne la priorité à l'avatar de guilde (member.avatar)", async () => {
        mockListGuildMembers.mockResolvedValue([
            makeDiscordMember({ id: "discord-1", globalAvatar: "global", guildAvatar: "guild-avatar" }),
        ]);
        mockUserProfileFindMany.mockResolvedValue([makeProfile({ image: null })]);

        await resyncGuildAvatarHashes(GUILD.id);

        expect(mockUserUpdate).toHaveBeenCalledWith({
            where: { id: "user-1" },
            data: { image: "https://cdn.discordapp.com/avatars/discord-1/guild-avatar.webp?size=256" },
        });
    });

    it("ne met à jour que les profils avec compte Discord présent sur le serveur", async () => {
        mockListGuildMembers.mockResolvedValue([
            makeDiscordMember({ id: "discord-1", globalAvatar: "h1" }),
            makeDiscordMember({ id: "discord-3", globalAvatar: "h3" }), // pas dans la BDD
        ]);
        mockUserProfileFindMany.mockResolvedValue([
            makeProfile({ userId: "user-1", discordId: "discord-1", image: null }),
            makeProfile({ userId: "user-2", discordId: "discord-2", image: null }), // absente de la réponse Discord
            makeProfile({ userId: "user-3", image: null, noAccount: true }), // pas de compte Discord
        ]);

        const result = await resyncGuildAvatarHashes(GUILD.id);

        expect(result.updated).toBe(1); // seul user-1
        expect(mockUserUpdate).toHaveBeenCalledTimes(1);
        expect(mockUserUpdate).toHaveBeenCalledWith({
            where: { id: "user-1" },
            data: { image: "https://cdn.discordapp.com/avatars/discord-1/h1.webp?size=256" },
        });
    });

    it("fail-closed si l'API Discord échoue (erreur capturée, success=false)", async () => {
        mockListGuildMembers.mockRejectedValue(new Error("Discord API down"));
        mockUserProfileFindMany.mockResolvedValue([makeProfile()]);

        const result = await resyncGuildAvatarHashes(GUILD.id);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(mockUserUpdate).not.toHaveBeenCalled();
    });
});

describe("syncAllGuildAvatars (#134 backend)", () => {
    it("itération sur ALLOWED_GUILD_IDS si définie (sans lire la BDD)", async () => {
        process.env.ALLOWED_GUILD_IDS = "discord-a, discord-b";
        mockListGuildMembers.mockResolvedValue([]);

        const { results } = await syncAllGuildAvatars();

        expect(Object.keys(results)).toEqual(["discord-a", "discord-b"]);
        expect(mockGuildConfigFindMany).not.toHaveBeenCalled();
    });

    it("itération sur toutes les guildes BDD sinon", async () => {
        mockGuildConfigFindMany.mockResolvedValue([
            { discordGuildId: "discord-a" },
            { discordGuildId: "discord-b" },
        ]);
        mockListGuildMembers.mockResolvedValue([]);

        const { results } = await syncAllGuildAvatars();

        expect(Object.keys(results)).toEqual(["discord-a", "discord-b"]);
        expect(mockGuildConfigFindMany).toHaveBeenCalled();
        expect(mockListGuildMembers).toHaveBeenCalledTimes(2);
    });
});

