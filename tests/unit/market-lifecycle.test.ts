/**
 * Module « Marché » — tests de la cascade `WITHDRAWN` (S5.11 / S8.20, §15.2).
 *
 * Ce que ces tests verrouillent :
 *   1. la **garde de statut DANS le `WHERE`** (§11.3) : le retrait est un
 *      `updateMany` conditionnel (`status in (DRAFT, ACTIVE, RESERVED)`,
 *      `deletedAt: null`, `profileId`, `guildId` **interne**) — `count === 0`
 *      ⇒ **aucun** audit, **aucune** réécriture Discord ;
 *   2. l'**isolation multi-tenant** : le `guildId` manipulé est l'id interne de
 *      `GuildConfig` (le snowflake n'est reçu que par le hook, résolu serveur) ;
 *   3. l'**audit** `LISTING_WITHDRAWN` par annonce, avec un motif **borné** ;
 *   4. le caractère **non bloquant** : Discord en panne, DB en panne ou
 *      paramètres incomplets ⇒ le core renvoie son bilan, **jamais d'exception**.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Réécriture d'embed : **jamais attendue** par le core (non bloquante). */
vi.mock("@/server/market/discord", () => ({
    syncListingMessage: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findUnique: vi.fn() },
        marketListing: { findMany: vi.fn(), updateMany: vi.fn() },
        marketAuditLog: { create: vi.fn() },
    },
}));

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { syncListingMessage } from "@/server/market/discord";
import {
    MARKET_LIFECYCLE_BATCH_SIZE,
    toMarketWithdrawReason,
    withdrawMarketListingsForGuildMember,
    withdrawMarketListingsForProfileCore,
} from "@/server/market/lifecycle";

const GUILD_CONFIG_ID = "guild-internal-1";
const GUILD_DISCORD_ID = "123456789012345678";
const PROFILE_ID = "profile-seller";
const LISTING_A = "cm5marketlisting0001";
const LISTING_B = "cm5marketlisting0002";

/** Annonce candidate par défaut : `ACTIVE`, vivante. */
function listing(id: string, status = "ACTIVE") {
    return { id, status };
}

function baseParams(overrides: Record<string, unknown> = {}) {
    return {
        guildConfigId: GUILD_CONFIG_ID,
        profileId: PROFILE_ID,
        reason: "PROFILE_ARCHIVED" as const,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.marketListing.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.guildConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: GUILD_CONFIG_ID });
    (syncListingMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
});

describe("market lifecycle — traduction du motif (bornée, jamais de texte libre)", () => {
    it("mappe les motifs du cycle de vie vers l'union fermée", () => {
        expect(toMarketWithdrawReason("ADMIN_ARCHIVED")).toBe("PROFILE_ARCHIVED");
        expect(toMarketWithdrawReason("USER_LEAVE")).toBe("PROFILE_ARCHIVED");
        expect(toMarketWithdrawReason("LEFT")).toBe("MEMBER_LEFT");
        expect(toMarketWithdrawReason("BANNED (Discord)")).toBe("MEMBER_BANNED");
        expect(toMarketWithdrawReason("KICKED (RGPD wipe)")).toBe("MEMBER_WIPED");
        expect(toMarketWithdrawReason("MEMBER_DELETED")).toBe("MEMBER_DELETED");
        expect(toMarketWithdrawReason("GDPR_DELETION")).toBe("GDPR_DELETION");
    });

    it("retombe sur l'archivage pour un motif vide ou inconnu (fail-soft borné)", () => {
        expect(toMarketWithdrawReason(null)).toBe("PROFILE_ARCHIVED");
        expect(toMarketWithdrawReason("")).toBe("PROFILE_ARCHIVED");
        expect(toMarketWithdrawReason("motif inventé")).toBe("PROFILE_ARCHIVED");
    });
});

describe("market lifecycle — core (garde de statut DANS le WHERE)", () => {
    it("retire les annonces vivantes, journalise chaque transition et réécrit l'embed", async () => {
        (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            listing(LISTING_A, "ACTIVE"),
            listing(LISTING_B, "DRAFT"),
        ]);

        const outcome = await withdrawMarketListingsForProfileCore(baseParams());

        expect(outcome).toEqual({ scanned: 2, withdrawn: 2, syncDispatched: 2 });

        // Isolation : `guildId` **interne** + `profileId` + statuts + `deletedAt`.
        const where = (db.marketListing.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
        expect(where).toEqual({
            id: LISTING_A,
            guildId: GUILD_CONFIG_ID,
            profileId: PROFILE_ID,
            status: { in: ["DRAFT", "ACTIVE", "RESERVED"] },
            deletedAt: null,
        });
        expect((db.marketListing.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0].data).toMatchObject({
            status: "WITHDRAWN",
        });

        // Audit par annonce, action et motif bornés.
        expect(db.marketAuditLog.create).toHaveBeenCalledTimes(2);
        const audit = (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
        expect(audit.action).toBe("LISTING_WITHDRAWN");
        expect(audit.reason).toBe("PROFILE_ARCHIVED");
        expect(audit.guildId).toBe(GUILD_CONFIG_ID);
        expect(audit.previousData).toEqual({ status: "ACTIVE" });
        expect(audit.nextData).toEqual({ status: "WITHDRAWN" });

        // Discord : lancé, jamais attendu (assertion après un tick de microtâches).
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(syncListingMessage).toHaveBeenCalledTimes(2);
    });

    it("est idempotent : une passe rejouée ne trouve plus rien à retirer", async () => {
        (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            listing(LISTING_A, "ACTIVE"),
        ]);
        const first = await withdrawMarketListingsForProfileCore(baseParams());
        expect(first.withdrawn).toBe(1);

        // 2ᵉ passe : plus aucune annonce vivante (le statut est passé WITHDRAWN).
        (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        const second = await withdrawMarketListingsForProfileCore(baseParams());

        expect(second).toEqual({ scanned: 0, withdrawn: 0, syncDispatched: 0 });
        expect(db.marketAuditLog.create).toHaveBeenCalledTimes(1);
        expect(syncListingMessage).toHaveBeenCalledTimes(1);
    });

    it("n'écrit rien si le statut a changé entre la lecture et l'écriture (count === 0)", async () => {
        (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            listing(LISTING_A, "ACTIVE"),
        ]);
        (db.marketListing.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

        const outcome = await withdrawMarketListingsForProfileCore(baseParams());

        expect(outcome).toEqual({ scanned: 1, withdrawn: 0, syncDispatched: 0 });
        expect(db.marketAuditLog.create).not.toHaveBeenCalled();
        expect(syncListingMessage).not.toHaveBeenCalled();
    });

    it("ignore une annonce dont la transition vers WITHDRAWN est interdite (SOLD)", async () => {
        (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            listing(LISTING_A, "SOLD"),
        ]);

        const outcome = await withdrawMarketListingsForProfileCore(baseParams());

        expect(outcome.withdrawn).toBe(0);
        expect(db.marketListing.updateMany).not.toHaveBeenCalled();
    });

    it("borne le lot à MARKET_LIFECYCLE_BATCH_SIZE (jamais piloté par l'appelant)", async () => {
        await withdrawMarketListingsForProfileCore(baseParams({ limit: 9_999 }));
        expect((db.marketListing.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].take).toBe(
            MARKET_LIFECYCLE_BATCH_SIZE
        );

        await withdrawMarketListingsForProfileCore(baseParams({ limit: 0 }));
        expect((db.marketListing.findMany as ReturnType<typeof vi.fn>).mock.calls[1][0].take).toBe(
            MARKET_LIFECYCLE_BATCH_SIZE
        );
    });

    it("reste non bloquant si Discord échoue (le retrait est déjà écrit)", async () => {
        (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            listing(LISTING_A, "ACTIVE"),
        ]);
        (syncListingMessage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Discord KO"));

        const outcome = await withdrawMarketListingsForProfileCore(baseParams());
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(outcome).toEqual({ scanned: 1, withdrawn: 1, syncDispatched: 1 });
        expect(logger.warn).toHaveBeenCalled();
    });

    it("ne lève jamais et renvoie un bilan nul sur erreur DB globale", async () => {
        (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB KO"));

        const outcome = await withdrawMarketListingsForProfileCore(baseParams());

        expect(outcome).toEqual({ scanned: 0, withdrawn: 0, syncDispatched: 0 });
        expect(logger.error).toHaveBeenCalled();
    });

    it("ignore une passe aux paramètres incomplets (pas de requête)", async () => {
        const outcome = await withdrawMarketListingsForProfileCore(baseParams({ profileId: "" }));

        expect(outcome).toEqual({ scanned: 0, withdrawn: 0, syncDispatched: 0 });
        expect(db.marketListing.findMany).not.toHaveBeenCalled();
    });
});


describe("market lifecycle — variante « cycle de vie membre » (snowflake résolu serveur)", () => {
    it("résout l'id interne de guilde depuis le snowflake puis délègue au core", async () => {
        (db.marketListing.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            listing(LISTING_A, "ACTIVE"),
        ]);

        const outcome = await withdrawMarketListingsForGuildMember({
            discordGuildId: GUILD_DISCORD_ID,
            profileId: PROFILE_ID,
            reason: "BANNED (Discord)",
        });

        expect(db.guildConfig.findUnique).toHaveBeenCalledWith({
            where: { discordGuildId: GUILD_DISCORD_ID },
            select: { id: true },
        });
        expect(outcome.withdrawn).toBe(1);
        // Le motif libre du hook n'est jamais écrit tel quel : il est borné.
        const audit = (db.marketAuditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
        expect(audit.reason).toBe("MEMBER_BANNED");
    });

    it("ne fait rien pour une guilde inconnue (aucune requête sur les annonces)", async () => {
        (db.guildConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const outcome = await withdrawMarketListingsForGuildMember({
            discordGuildId: GUILD_DISCORD_ID,
            profileId: PROFILE_ID,
            reason: "LEFT",
        });

        expect(outcome).toEqual({ scanned: 0, withdrawn: 0, syncDispatched: 0 });
        expect(db.marketListing.findMany).not.toHaveBeenCalled();
    });

    it("ne lève jamais : une erreur de résolution renvoie un bilan nul", async () => {
        (db.guildConfig.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB KO"));

        const outcome = await withdrawMarketListingsForGuildMember({
            discordGuildId: GUILD_DISCORD_ID,
            profileId: PROFILE_ID,
            reason: "ADMIN_ARCHIVED",
        });

        expect(outcome).toEqual({ scanned: 0, withdrawn: 0, syncDispatched: 0 });
        expect(logger.error).toHaveBeenCalled();
    });
});

