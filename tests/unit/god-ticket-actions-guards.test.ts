import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * G4-2 — gardes du panneau God du support.
 *
 * Le comportement verrouillé est celui qui protège l'exploitation :
 * God uniquement, identifiants Discord revalidés (salon ∈ serveur, rôles
 * existants), clé de catégorie immuable et dernière catégorie active protégée.
 */
vi.mock("@/lib/prisma", () => ({
    db: {
        godTicketConfig: { upsert: vi.fn(), findUnique: vi.fn() },
        godTicketCategory: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        platformConfig: { findUnique: vi.fn() },
        supportTicket: { groupBy: vi.fn(), aggregate: vi.fn() },
        $transaction: vi.fn(),
    },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/actions/super-admin-actions", () => ({ isSuperAdmin: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/server/discord", () => ({
    fetchBotGuilds: vi.fn(),
    fetchChannel: vi.fn(),
    fetchGuildChannels: vi.fn(),
    fetchGuildRoles: vi.fn(),
    validateChannelBelongsToGuild: vi.fn(),
}));

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { rateLimit } from "@/lib/ratelimit";
import {
    fetchBotGuilds,
    fetchChannel,
    fetchGuildRoles,
    validateChannelBelongsToGuild,
} from "@/server/discord";
import {
    saveGodTicketCategoryAction,
    saveGodTicketConfigAction,
    setGodTicketCategoryEnabledAction,
} from "@/server/actions/god-ticket-actions";

const mockDb = db as any;
const mockIsSuperAdmin = isSuperAdmin as ReturnType<typeof vi.fn>;
const mockRateLimit = rateLimit as ReturnType<typeof vi.fn>;
const mockFetchBotGuilds = fetchBotGuilds as ReturnType<typeof vi.fn>;
const mockFetchChannel = fetchChannel as ReturnType<typeof vi.fn>;
const mockFetchGuildRoles = fetchGuildRoles as ReturnType<typeof vi.fn>;
const mockChannelBelongs = validateChannelBelongsToGuild as ReturnType<typeof vi.fn>;

const GUILD = "123456789012345678";
const CHANNEL = "987654321098765432";
const STAFF = "111111111111111111";

const validConfig = {
    supportGuildId: GUILD,
    supportChannelId: CHANNEL,
    staffRoleIds: [STAFF],
    notifyRoleIds: [],
    namingPattern: "🎫-{num}-{author}",
    closePolicy: "STAFF_OR_CREATOR" as const,
    archiveOnClose: true,
    csatEnabled: false,
};

const validCategory = {
    key: "partenariat",
    label: "Partenariat",
    emoji: "🤝",
    color: "#10b981",
    order: 40,
    isEnabled: true,
};

describe("panneau God du support — RBAC et validation Discord", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsSuperAdmin.mockResolvedValue(true);
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "god-1" } });
        mockRateLimit.mockResolvedValue({ success: true });
        mockFetchBotGuilds.mockResolvedValue([{ id: GUILD, name: "Support SigilOS" }]);
        mockFetchGuildRoles.mockResolvedValue([{ id: STAFF, name: "Staff" }]);
        mockChannelBelongs.mockResolvedValue(true);
        mockFetchChannel.mockResolvedValue({ id: CHANNEL, type: 0, name: "support" });
        mockDb.godTicketConfig.upsert.mockResolvedValue({ id: "singleton" });
    });

    it("refuse un non-God sans écrire", async () => {
        mockIsSuperAdmin.mockResolvedValue(false);
        const result = await saveGodTicketConfigAction(validConfig);
        expect(result.success).toBe(false);
        expect(mockDb.godTicketConfig.upsert).not.toHaveBeenCalled();
    });

    it("refuse un identifiant de serveur invalide", async () => {
        const result = await saveGodTicketConfigAction({ ...validConfig, supportGuildId: "abc" });
        expect(result.success).toBe(false);
        expect(mockDb.godTicketConfig.upsert).not.toHaveBeenCalled();
    });

    it("refuse un salon qui n'appartient pas au serveur support", async () => {
        mockChannelBelongs.mockResolvedValue(false);
        const result = await saveGodTicketConfigAction(validConfig);
        expect(result.success).toBe(false);
        expect(result).toMatchObject({ error: expect.stringContaining("appartient") });
        expect(mockDb.godTicketConfig.upsert).not.toHaveBeenCalled();
    });

    it("refuse un rôle qui n'existe plus sur le serveur", async () => {
        mockFetchGuildRoles.mockResolvedValue([]);
        const result = await saveGodTicketConfigAction(validConfig);
        expect(result.success).toBe(false);
        expect(mockDb.godTicketConfig.upsert).not.toHaveBeenCalled();
    });

    it("refuse quand le rate limit est atteint (fail-closed)", async () => {
        mockRateLimit.mockResolvedValue({ success: false });
        const result = await saveGodTicketConfigAction(validConfig);
        expect(result.success).toBe(false);
        expect(result).toMatchObject({ error: expect.stringContaining("Trop de modifications") });
        expect(mockDb.godTicketConfig.upsert).not.toHaveBeenCalled();
    });

    it("enregistre quand tout est revalidé", async () => {
        const result = await saveGodTicketConfigAction(validConfig);
        expect(result.success).toBe(true);
        expect(mockDb.godTicketConfig.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: expect.objectContaining({
                    supportGuildId: GUILD,
                    supportChannelId: CHANNEL,
                    namingPattern: "🎫-{num}-{author}",
                }),
            })
        );
    });
});

describe("catégories God — clé immuable et dernière active", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsSuperAdmin.mockResolvedValue(true);
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "god-1" } });
        mockRateLimit.mockResolvedValue({ success: true });
        mockDb.$transaction.mockImplementation(async (callback: any) => callback(mockDb));
    });

    it("refuse de changer la clé d'une catégorie existante", async () => {
        mockDb.godTicketCategory.findUnique.mockResolvedValue({
            id: "c1",
            key: "bug",
            isEnabled: true,
        });

        const result = await saveGodTicketCategoryAction({ ...validCategory, id: "c1" });

        expect(result.success).toBe(false);
        expect(result).toMatchObject({ error: expect.stringContaining("ne change jamais") });
        expect(mockDb.godTicketCategory.update).not.toHaveBeenCalled();
    });

    it("refuse de désactiver la dernière catégorie active", async () => {
        mockDb.godTicketCategory.findUnique.mockResolvedValue({
            id: "c1",
            key: "partenariat",
            isEnabled: true,
        });
        mockDb.godTicketCategory.count.mockResolvedValue(1);

        const result = await saveGodTicketCategoryAction({
            ...validCategory,
            id: "c1",
            isEnabled: false,
        });

        expect(result.success).toBe(false);
        expect(result).toMatchObject({ error: expect.stringContaining("au moins une") });
        expect(mockDb.godTicketCategory.update).not.toHaveBeenCalled();
    });

    it("refuse une couleur hors format #RRGGBB", async () => {
        const result = await saveGodTicketCategoryAction({ ...validCategory, color: "rouge" });
        expect(result.success).toBe(false);
        expect(mockDb.godTicketCategory.create).not.toHaveBeenCalled();
    });

    it("crée une catégorie valide", async () => {
        mockDb.godTicketCategory.create.mockResolvedValue({
            id: "c2",
            ...validCategory,
            legacyCategory: null,
        });

        const result = await saveGodTicketCategoryAction(validCategory);

        expect(result.success).toBe(true);
        expect(mockDb.godTicketCategory.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ key: "partenariat", label: "Partenariat" }),
            })
        );
    });

    it("protège aussi la dernière catégorie active lors du basculement", async () => {
        mockDb.godTicketCategory.findUnique.mockResolvedValue({ id: "c1", isEnabled: true });
        mockDb.godTicketCategory.count.mockResolvedValue(1);

        const result = await setGodTicketCategoryEnabledAction({ id: "c1", enabled: false });

        expect(result.success).toBe(false);
        expect(result).toMatchObject({ error: expect.stringContaining("au moins une") });
        expect(mockDb.godTicketCategory.update).not.toHaveBeenCalled();
    });

    it("désactive une catégorie quand une autre reste active", async () => {
        mockDb.godTicketCategory.findUnique.mockResolvedValue({ id: "c1", isEnabled: true });
        mockDb.godTicketCategory.count.mockResolvedValue(2);
        mockDb.godTicketCategory.update.mockResolvedValue({ id: "c1", isEnabled: false });

        const result = await setGodTicketCategoryEnabledAction({ id: "c1", enabled: false });

        expect(result.success).toBe(true);
        expect(mockDb.godTicketCategory.update).toHaveBeenCalledWith({
            where: { id: "c1" },
            data: { isEnabled: false },
        });
    });
});
