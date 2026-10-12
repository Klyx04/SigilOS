/**
 * Correctif 10/10/2026 — **lot multiple : images par objet**.
 *
 * Régression mesurée : `syncBundleComponentMessages` calculait `thumbnail` et
 * `image` **une seule fois** (1er composant) puis les réutilisait pour chaque
 * message — un lot « Cape de Glourdorak + Eau Potable » affichait 2× la cape.
 *
 * Attendu : chaque message porte l'icône de **son** objet, et un équipement
 * avec jet déclaré porte sa **carte de stats** (comme l'unitaire).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (avant les imports du module testé) ────────────────────────────────
const mockListingFindUnique = vi.fn();
const mockComponentFindMany = vi.fn();
const mockComponentUpdate = vi.fn();
const mockDiscordMessageUpdateMany = vi.fn();
const mockGuildConfigUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
    db: {
        marketListing: { findUnique: (...a: any[]) => mockListingFindUnique(...a) },
        marketListingComponent: {
            findMany: (...a: any[]) => mockComponentFindMany(...a),
            update: (...a: any[]) => mockComponentUpdate(...a),
        },
        marketDiscordMessage: {
            updateMany: (...a: any[]) => mockDiscordMessageUpdateMany(...a),
        },
        guildConfig: { update: (...a: any[]) => mockGuildConfigUpdate(...a) },
    },
}));

vi.mock("@/server/market/counters", () => ({
    countPendingMarketOffers: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/lib/market/forum-tags", () => ({ resolveMarketForumTags: vi.fn(() => []) }));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn().mockResolvedValue(null) } }));

const mockSendChannelMessage = vi.fn();
vi.mock("@/server/discord", () => ({
    sendChannelMessage: (...a: any[]) => mockSendChannelMessage(...a),
    createForumPost: vi.fn(),
    updateChannelMessage: vi.fn(),
    deleteChannelMessage: vi.fn(),
    deleteChannel: vi.fn(),
    fetchChannel: vi.fn(),
    updateForumThreadTags: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { syncBundleComponentMessages } from "@/server/market/discord";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const CAPE_ICON = "https://cdn.example/cape-glourdorak.png";
const EAU_ICON = "https://cdn.example/eau-potable.png";

function bundleListing() {
    return {
        id: "listing-1",
        type: "BUNDLE",
        status: "ACTIVE",
        title: "Lot : Cape de Glourdorak, Eau Potable",
        itemName: null,
        itemLevel: null,
        itemTypeName: null,
        priceKamas: null,
        unitLabel: null,
        negotiable: true,
        itemIconUrl: null,
        dofusDbItemId: null,
        statsHash: null,
        transcendenceRuneId: null,
        transcendenceLabel: null,
        strikeElement: null,
        elementPotionTier: null,
        huntingWeapon: null,
        acceptsTrade: false,
        deletedAt: null,
        stats: [],
        discordMessage: null,
        profile: { pseudoDofus: "Wylan", user: { name: "Wylan" } },
        components: [
            { name: "Cape de Glourdorak", quantity: 1 },
            { name: "Eau Potable", quantity: 1 },
        ],
        guild: {
            id: "guild-1",
            discordGuildId: "111111111111111111",
            name: "Guilde Test",
            dofusServerName: null,
            marketNotifyChannelId: "1550186337674731712",
            marketNotifyRoleId: null,
            marketChannelKind: "TEXT",
            marketAllowedPingRoleIds: [],
            marketForumTags: {},
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockListingFindUnique.mockResolvedValue(bundleListing());
    mockComponentFindMany.mockResolvedValue([
        {
            id: "c1",
            name: "Cape de Glourdorak",
            quantity: 1,
            unitLabel: null,
            priceKamas: 1_000_000,
            status: "AVAILABLE",
            dofusDbItemId: 12345,
            iconUrl: CAPE_ICON,
            statsHash: "hash-cape",
            discordChannelId: null,
            discordMessageId: null,
            componentStats: [
                { effectId: 423, naturalMin: 301, naturalMax: 350, actualValue: 348 },
            ],
        },
        {
            id: "c2",
            name: "Eau Potable",
            quantity: 1,
            unitLabel: null,
            priceKamas: 1_000,
            status: "AVAILABLE",
            dofusDbItemId: 311,
            iconUrl: EAU_ICON,
            statsHash: null,
            discordChannelId: null,
            discordMessageId: null,
            componentStats: [],
        },
    ]);
    mockComponentUpdate.mockResolvedValue({});
    mockDiscordMessageUpdateMany.mockResolvedValue({ count: 0 });
    mockSendChannelMessage.mockResolvedValue("333333333333333333");
});

describe("syncBundleComponentMessages — images par objet (correctif 10/10/2026)", () => {
    it("chaque message porte la vignette de SON objet (jamais 2× le 1er)", async () => {
        await syncBundleComponentMessages("listing-1");

        expect(mockSendChannelMessage).toHaveBeenCalledTimes(2);
        const thumb1 = mockSendChannelMessage.mock.calls[0][2].embedThumbnail as string;
        const thumb2 = mockSendChannelMessage.mock.calls[1][2].embedThumbnail as string;
        expect(thumb1).toContain("cape-glourdorak");
        expect(thumb2).toContain("eau-potable");
        expect(thumb1).not.toBe(thumb2);
    });

    it("l'équipement avec jet porte sa carte de stats, la ressource son image", async () => {
        await syncBundleComponentMessages("listing-1");

        const image1 = mockSendChannelMessage.mock.calls[0][2].embedImage as string;
        const image2 = mockSendChannelMessage.mock.calls[1][2].embedImage as string;
        // Carte OG de CET objet (composant c1 + hash de son jet).
        expect(image1).toContain("component=c1");
        expect(image1).toContain("v=hash-cape");
        // Ressource sans jet : l'image de l'objet en grand, pas une carte.
        expect(image2).toContain("eau-potable");
        expect(image2).not.toContain("component=");
    });

    it("les titres portent le nom et le prix de chaque objet", async () => {
        await syncBundleComponentMessages("listing-1");

        const title1 = mockSendChannelMessage.mock.calls[0][2].embedTitle as string;
        const title2 = mockSendChannelMessage.mock.calls[1][2].embedTitle as string;
        expect(title1).toContain("Cape de Glourdorak");
        expect(title2).toContain("Eau Potable");
        expect(title1).not.toBe(title2);
    });
});
