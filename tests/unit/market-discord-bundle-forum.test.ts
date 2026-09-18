/**
 * Régression (18/09/2026, constats beta) — **Marché : lot multiple & nettoyage**.
 *
 * Trois défauts verrouillés ici :
 *  1. 🧺 **Publication du lot** : publier une annonce `BUNDLE` depuis le dashboard
 *     créait **un seul** embed (listant les objets dans « Contenu du lot ») au
 *     lieu d'**un message par objet** — le routage `type === "BUNDLE"` n'existait
 *     que dans `syncListingMessage` (donc seulement sur les transitions
 *     ultérieures). Attendu : `publishListingToDiscord` route lui aussi.
 *  2. 🗣️ **Salon forum** : le chemin « un message par objet » envoyait toujours un
 *     message **simple** (`sendChannelMessage`) ; dans un forum Discord refuse
 *     (message sans `thread_name`) ⇒ refus définitif rejoué 8× par l'outbox
 *     (« écriture abandonnée », incident 01:19). Attendu : un **post** par objet.
 *  3. 🗑️ **Suppression** : l'action vendeur passait par `syncListingMessage`, qui
 *     court-circuite (`deletedAt`) ⇒ le post de forum restait à vie. Attendu :
 *     `deleteListingDiscordMessage` (désormais câblé) supprime messages d'objets
 *     + message d'annonce, ferme le fil de forum et vide les traces.
 *
 * Également couvert : les IDs `outbox:<jobId>` (mode dégradé) sont **résolus**
 * depuis Redis avant tout `PATCH`/`DELETE` — sinon on écrivait dans le vide.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

// ─── Mocks (avant les imports du module testé) ────────────────────────────────
const mockListingFindUnique = vi.fn();
const mockComponentFindMany = vi.fn();
const mockComponentUpdate = vi.fn();
const mockDiscordMessageFindUnique = vi.fn();
const mockDiscordMessageUpdate = vi.fn();
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
            findUnique: (...a: any[]) => mockDiscordMessageFindUnique(...a),
            update: (...a: any[]) => mockDiscordMessageUpdate(...a),
            updateMany: (...a: any[]) => mockDiscordMessageUpdateMany(...a),
        },
        guildConfig: { update: (...a: any[]) => mockGuildConfigUpdate(...a) },
    },
}));

vi.mock("@/server/market/counters", () => ({
    countPendingMarketOffers: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/lib/market/forum-tags", () => ({ resolveMarketForumTags: vi.fn(() => ["tag-1"]) }));

const mockRedisGet = vi.fn();
vi.mock("@/lib/redis", () => ({ redis: { get: (...a: any[]) => mockRedisGet(...a) } }));

const mockSendChannelMessage = vi.fn();
const mockCreateForumPost = vi.fn();
const mockUpdateChannelMessage = vi.fn();
const mockDeleteChannelMessage = vi.fn();
const mockDeleteChannel = vi.fn();
vi.mock("@/server/discord", () => ({
    sendChannelMessage: (...a: any[]) => mockSendChannelMessage(...a),
    createForumPost: (...a: any[]) => mockCreateForumPost(...a),
    updateChannelMessage: (...a: any[]) => mockUpdateChannelMessage(...a),
    deleteChannelMessage: (...a: any[]) => mockDeleteChannelMessage(...a),
    deleteChannel: (...a: any[]) => mockDeleteChannel(...a),
    fetchChannel: vi.fn().mockResolvedValue({ id: "chan", type: 0 }),
    updateForumThreadTags: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
    publishListingToDiscord,
    deleteListingDiscordMessage,
    syncListingMessage,
} from "@/server/market/discord";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const REAL_MESSAGE_ID = "333333333333333333";
const THREAD_ID_1 = "444444444444444441";
const THREAD_ID_2 = "444444444444444442";

function component(id: string, name: string, overrides: Record<string, any> = {}) {
    return {
        id,
        name,
        quantity: 1,
        priceKamas: 10_000,
        unitLabel: null,
        iconUrl: null,
        dofusDbItemId: 32239,
        status: "AVAILABLE",
        position: 0,
        discordChannelId: null,
        discordMessageId: null,
        ...overrides,
    };
}

function bundleListing(overrides: Record<string, any> = {}) {
    const base = {
        id: "listing-1",
        type: "BUNDLE",
        status: "ACTIVE",
        title: "Lot de 2 objets",
        itemName: null,
        itemLevel: null,
        itemTypeName: null,
        priceKamas: 15_000,
        unitLabel: null,
        negotiable: true,
        itemIconUrl: null,
        dofusDbItemId: null,
        statsHash: "hash-1",
        transcendenceRuneId: null,
        transcendenceLabel: null,
        strikeElement: null,
        elementPotionTier: null,
        huntingWeapon: null,
        acceptsTrade: true,
        deletedAt: null,
        stats: [],
        profile: { pseudoDofus: "Wylan", user: { name: "Wylan" } },
        components: [component("c1", "Cape de Glourdorak"), component("c2", "Coiffe de Glourdorak")],
        guild: {
            id: "guild-1",
            discordGuildId: "111111111111111111",
            name: "Guilde Test",
            dofusServerName: null,
            marketNotifyChannelId: "1550186337674731712",
            marketNotifyRoleId: "999999999999999999",
            marketChannelKind: "TEXT",
            marketAllowedPingRoleIds: ["999999999999999999"],
            marketForumTags: { "BUNDLE|ACTIVE": "tag-1" },
        },
    };
    return { ...base, ...overrides };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockComponentUpdate.mockResolvedValue({});
    mockDiscordMessageUpdate.mockResolvedValue({});
    mockGuildConfigUpdate.mockResolvedValue({});
    mockSendChannelMessage.mockResolvedValue(REAL_MESSAGE_ID);
    mockCreateForumPost.mockResolvedValue({ id: THREAD_ID_1, messageId: REAL_MESSAGE_ID });
    mockUpdateChannelMessage.mockResolvedValue(true);
    mockDeleteChannelMessage.mockResolvedValue(true);
    mockDeleteChannel.mockResolvedValue(true);
    mockDiscordMessageUpdateMany.mockResolvedValue({ count: 1 });
    mockRedisGet.mockResolvedValue(null);
    // Les objets du lot vivent dans leur propre table (le listing ne porte que le résumé).
    mockComponentFindMany.mockResolvedValue(bundleListing().components);
});

// ─── 1. Publication d'un lot : un message par objet ──────────────────────────

describe("publishListingToDiscord — lot multiple (option A)", () => {
    it("publie UN message par objet (plus jamais l'unique embed du lot)", async () => {
        mockListingFindUnique.mockResolvedValue(bundleListing());

        const result = await publishListingToDiscord("listing-1");

        expect(result.ok).toBe(true);
        expect(mockSendChannelMessage).toHaveBeenCalledTimes(2);
        // Chaque message est traçable (ré-ancre du vrai ID par le worker d'outbox).
        expect(mockSendChannelMessage.mock.calls[0][1]).toBe("");
        expect(mockSendChannelMessage.mock.calls[0][2].storeMessageIdKey).toBe("market:cmsg:c1");
        expect(mockSendChannelMessage.mock.calls[1][2].storeMessageIdKey).toBe("market:cmsg:c2");
        // La trace de chaque objet est persistée.
        expect(mockComponentUpdate).toHaveBeenCalledTimes(2);
        expect(mockComponentUpdate.mock.calls[0][0].data.discordMessageId).toBe(REAL_MESSAGE_ID);
    });

    it("ne ping le rôle qu'UNE fois (premier objet publié)", async () => {
        mockListingFindUnique.mockResolvedValue(bundleListing());

        await publishListingToDiscord("listing-1", ["999999999999999999"]);

        expect(mockSendChannelMessage.mock.calls[0][2].mentionContent).toBe("<@&999999999999999999>");
        expect(mockSendChannelMessage.mock.calls[1][2].mentionContent).toBeUndefined();
    });

    it("en salon FORUM publie un POST par objet (jamais un message simple)", async () => {
        mockListingFindUnique.mockResolvedValue(
            bundleListing({ guild: { ...bundleListing().guild, marketChannelKind: "FORUM" } })
        );

        const result = await publishListingToDiscord("listing-1");

        expect(result.ok).toBe(true);
        expect(mockCreateForumPost).toHaveBeenCalledTimes(2);
        expect(mockSendChannelMessage).not.toHaveBeenCalled();
        // Les tags du forum (D20/S3.13) sont appliqués à chaque post.
        expect(mockCreateForumPost.mock.calls[0][3].appliedTags).toEqual(["tag-1"]);
        // La trace pointe le **fil** (et non le salon forum).
        expect(mockComponentUpdate.mock.calls[0][0].data.discordChannelId).toBe(THREAD_ID_1);
    });

    it("une annonce supprimée n'est jamais republiée", async () => {
        mockListingFindUnique.mockResolvedValue(bundleListing({ deletedAt: new Date() }));

        const result = await publishListingToDiscord("listing-1");

        expect(result).toMatchObject({ ok: true, skipped: true });
        expect(mockSendChannelMessage).not.toHaveBeenCalled();
        expect(mockCreateForumPost).not.toHaveBeenCalled();
    });

    it("efface le message d'annonce « hérité » (lot publié avant le correctif)", async () => {
        mockListingFindUnique.mockResolvedValue(
            bundleListing({
                // Cas réel mesuré en beta : lot publié dans le forum 『🛒』𝐓𝐑𝐎𝐂-𝐙𝐎𝐍𝐄.
                guild: { ...bundleListing().guild, marketChannelKind: "FORUM" },
                discordMessage: {
                    discordChannelId: THREAD_ID_2,
                    discordMessageId: "666666666666666666",
                },
            })
        );

        await publishListingToDiscord("listing-1");

        // Le message unique du lot (ancien comportement) est retiré du salon…
        expect(mockDeleteChannelMessage).toHaveBeenCalledWith(THREAD_ID_2, "666666666666666666");
        expect(mockDeleteChannel).toHaveBeenCalledWith(THREAD_ID_2);
        // …et sa trace est vidée pour ne jamais le « ressusciter ».
        expect(mockDiscordMessageUpdateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ discordMessageId: "", discordChannelId: "" }),
            })
        );
        // Les objets sont bien publiés séparément (un post par objet en forum).
        expect(mockCreateForumPost).toHaveBeenCalledTimes(2);
        expect(mockSendChannelMessage).not.toHaveBeenCalled();
    });
});

// ─── 2. Suppression : le salon (et le fil de forum) sont nettoyés ─────────────

describe("deleteListingDiscordMessage — nettoyage réel du salon", () => {
    it("supprime les messages d'objets + le message d'annonce et vide les traces", async () => {
        mockListingFindUnique.mockResolvedValue(bundleListing());
        mockComponentFindMany.mockResolvedValue([
            component("c1", "A", { discordChannelId: "1550186337674731712", discordMessageId: "555555555555555551" }),
            component("c2", "B", { discordChannelId: "1550186337674731712", discordMessageId: "555555555555555552" }),
        ]);
        mockDiscordMessageFindUnique.mockResolvedValue({
            discordChannelId: "1550186337674731712",
            discordMessageId: REAL_MESSAGE_ID,
        });

        const result = await deleteListingDiscordMessage("listing-1");

        expect(result.ok).toBe(true);
        // 2 messages d'objets + 1 message d'annonce.
        expect(mockDeleteChannelMessage).toHaveBeenCalledTimes(3);
        expect(mockDeleteChannelMessage).toHaveBeenCalledWith("1550186337674731712", REAL_MESSAGE_ID);
        // Trace vidée : une restauration republiera un message NEUF.
        const data = mockDiscordMessageUpdate.mock.calls.at(-1)![0].data;
        expect(data).toMatchObject({ discordMessageId: "", discordChannelId: "", syncStatus: "DELETED" });
    });

    it("en salon forum ferme aussi le fil (un post vide resterait visible)", async () => {
        mockListingFindUnique.mockResolvedValue(
            bundleListing({ guild: { ...bundleListing().guild, marketChannelKind: "FORUM" } })
        );
        mockComponentFindMany.mockResolvedValue([
            component("c1", "A", { discordChannelId: THREAD_ID_1, discordMessageId: REAL_MESSAGE_ID }),
        ]);
        mockDiscordMessageFindUnique.mockResolvedValue({
            discordChannelId: THREAD_ID_2,
            discordMessageId: REAL_MESSAGE_ID,
        });

        await deleteListingDiscordMessage("listing-1");

        expect(mockDeleteChannel).toHaveBeenCalledWith(THREAD_ID_1);
        expect(mockDeleteChannel).toHaveBeenCalledWith(THREAD_ID_2);
    });

    it("résout un ID `outbox:<jobId>` avant de supprimer (sinon on ne supprime RIEN)", async () => {
        mockListingFindUnique.mockResolvedValue(bundleListing());
        mockComponentFindMany.mockResolvedValue([]);
        mockDiscordMessageFindUnique.mockResolvedValue({
            discordChannelId: "1550186337674731712",
            discordMessageId: "outbox:job-1",
        });
        mockRedisGet.mockResolvedValue(REAL_MESSAGE_ID);

        const result = await deleteListingDiscordMessage("listing-1");

        expect(result.ok).toBe(true);
        expect(mockRedisGet).toHaveBeenCalledWith("market:msg:listing-1");
        expect(mockDeleteChannelMessage).toHaveBeenCalledWith("1550186337674731712", REAL_MESSAGE_ID);
    });

    it("écriture jamais aboutie (ID irrésolu) : trace nettoyée, aucune erreur", async () => {
        mockListingFindUnique.mockResolvedValue(bundleListing());
        mockComponentFindMany.mockResolvedValue([]);
        mockDiscordMessageFindUnique.mockResolvedValue({
            discordChannelId: "1550186337674731712",
            discordMessageId: "outbox:job-1",
        });
        mockRedisGet.mockResolvedValue(null);

        const result = await deleteListingDiscordMessage("listing-1");

        expect(result).toMatchObject({ ok: true, skipped: true });
        expect(mockDeleteChannelMessage).not.toHaveBeenCalled();
        expect(mockDiscordMessageUpdate.mock.calls.at(-1)![0].data.discordMessageId).toBe("");
    });
});

// ─── 3. Édition d'une annonce : ID `outbox:` résolu avant le PATCH ───────────

describe("syncListingMessage — résolution des IDs d'outbox", () => {
    it("PATCH le vrai snowflake ré-ancré par le worker (jamais `outbox:…`)", async () => {
        mockListingFindUnique.mockResolvedValue(
            bundleListing({
                type: "SELL",
                components: [],
                discordMessage: {
                    discordChannelId: "1550186337674731712",
                    discordMessageId: "outbox:job-1",
                },
            })
        );
        mockRedisGet.mockResolvedValue(REAL_MESSAGE_ID);

        const result = await syncListingMessage("listing-1");

        expect(result.ok).toBe(true);
        expect(mockUpdateChannelMessage).toHaveBeenCalledWith(
            "1550186337674731712",
            REAL_MESSAGE_ID,
            "",
            expect.any(Object)
        );
        // Trace réparée en base.
        expect(mockDiscordMessageUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ data: { discordMessageId: REAL_MESSAGE_ID } })
        );
    });

    it("ID irrésolu (écriture abandonnée) : republie au lieu d'écrire dans le vide", async () => {
        mockListingFindUnique.mockResolvedValue(
            bundleListing({
                type: "SELL",
                components: [],
                discordMessage: {
                    discordChannelId: "1550186337674731712",
                    discordMessageId: "outbox:job-1",
                },
            })
        );
        mockRedisGet.mockResolvedValue(null);

        await syncListingMessage("listing-1");

        expect(mockUpdateChannelMessage).not.toHaveBeenCalled();
        expect(mockSendChannelMessage).toHaveBeenCalled();
    });
});

// ─── 4. Câblage de l'action vendeur (garde anti-régression, lecture source) ──

describe("Action `deleteMarketListing` — nettoyage Discord câblé", () => {
    const SOURCE = readFileSync("src/server/actions/market-actions.ts", "utf8");
    /** Corps de l'action (jusqu'à la déclaration suivante), commentaires retirés. */
    function deleteActionCode(): string {
        const start = SOURCE.indexOf("export async function deleteMarketListing");
        expect(start, "action `deleteMarketListing` introuvable").toBeGreaterThan(-1);
        const next = SOURCE.indexOf("export async function", start + 10);
        const body = SOURCE.slice(start, next === -1 ? undefined : next);
        return body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    }

    it("supprime le message/le post Discord (jamais une simple resynchro)", () => {
        const body = deleteActionCode();
        expect(body, "l'action doit appeler `deleteListingDiscordMessage`").toMatch(
            /deleteListingDiscordMessage\(/
        );
        expect(body, "`syncListingMessage` court-circuite sur `deletedAt` ⇒ rien n'est supprimé").not.toMatch(
            /syncListingMessage\(/
        );
    });
});
