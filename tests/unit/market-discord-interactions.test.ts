/**
 * Module « Marché » — tests des interactions Discord (S4.1 → S4.3) :
 *   1. parsing **fail-closed** du `custom_id` (`mkt:<action>:<listingId>`) ;
 *   2. refus AVANT toute action métier : `custom_id` invalide, hors serveur,
 *      module `marche` désactivé pour la guilde (§0.1 / §16.2) ;
 *   3. garde module interrogée avec l'id de guilde Discord reçu (isolation) ;
 *   4. réponse **toujours** explicite (§13.5) — éphémère (type 4) **ou** modale
 *      (type 9) — sans fuite de montant ni de pseudo d'acheteur (§13.7).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockIsModuleEnabled = vi.fn();
vi.mock("@/server/actions/module-actions", () => ({
    isModuleEnabled: (...args: unknown[]) => mockIsModuleEnabled(...args),
}));

vi.mock("@/lib/utils", () => ({ getAppBaseUrl: () => "https://sigilos.fr" }));

vi.mock("@/server/market/discord", () => ({
    syncListingMessage: vi.fn().mockResolvedValue({ ok: true }),
}));

/** Transaction simulée du moteur de réservation (S4.2). */
const tx = {
    marketListing: { updateMany: vi.fn() },
    marketReservation: { create: vi.fn() },
};

const mockGuildConfigFindUnique = vi.fn();
const mockUserProfileFindUnique = vi.fn();
const mockListingFindFirst = vi.fn();
const mockAuditCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findUnique: (...args: unknown[]) => mockGuildConfigFindUnique(...args) },
        userProfile: { findUnique: (...args: unknown[]) => mockUserProfileFindUnique(...args) },
        marketListing: { findFirst: (...args: unknown[]) => mockListingFindFirst(...args) },
        marketAuditLog: { create: (...args: unknown[]) => mockAuditCreate(...args) },
        $transaction: vi.fn(),
    },
}));

import { db } from "@/lib/prisma";
import {
    MARKET_EPHEMERAL,
    MARKET_OFFER_MODAL,
    buildMarketDashboardUrl,
    buildMarketOfferModal,
    parseMarketCustomId,
} from "@/lib/market/discord-interactions";
import { handleMarketComponentInteraction } from "@/server/market/discord-interactions";

/** `cuid()` d'annonce utilisé dans tous les tests. */
const LISTING_ID = "cm5marketlisting0001";
const GUILD_ID = "123456789012345678";

describe("market discord interactions — parsing des custom_id (S4.1)", () => {
    it("accepte les 3 actions produites par les boutons de l'annonce (§13.3)", () => {
        for (const action of ["reserve", "offer", "contact"] as const) {
            expect(parseMarketCustomId(`mkt:${action}:${LISTING_ID}`)).toEqual({ action, listingId: LISTING_ID });
        }
    });

    it("refuse toute forme ambiguë plutôt que de deviner (fail-closed)", () => {
        expect(parseMarketCustomId(`mkt:reserve`)).toBeNull(); // segment manquant
        expect(parseMarketCustomId(`mkt:reserve:${LISTING_ID}:extra`)).toBeNull(); // segment en trop
        expect(parseMarketCustomId(`mkt:reserve:${LISTING_ID}`)).not.toBeNull(); // témoin
        expect(parseMarketCustomId(`mkt:delete:${LISTING_ID}`)).toBeNull(); // action inconnue
        expect(parseMarketCustomId(`svc:reserve:${LISTING_ID}`)).toBeNull(); // autre module
        expect(parseMarketCustomId(`mkt:reserve:`)).toBeNull(); // id vide
        expect(parseMarketCustomId("mkt:reserve:short")).toBeNull(); // id trop court
        expect(parseMarketCustomId(`mkt:reserve:${"a".repeat(41)}`)).toBeNull(); // id trop long
        expect(parseMarketCustomId("mkt:reserve:a$b$c")).toBeNull(); // caractères non-cuid
        expect(parseMarketCustomId("")).toBeNull();
        expect(parseMarketCustomId("mkt")).toBeNull();
    });

    it("construit l'URL de la fiche SigilOS sans double slash", () => {
        expect(buildMarketDashboardUrl("https://sigilos.fr", GUILD_ID, LISTING_ID)).toBe(
            `https://sigilos.fr/dashboard/${GUILD_ID}/marche/${LISTING_ID}`
        );
        expect(buildMarketDashboardUrl("https://sigilos.fr/", GUILD_ID, LISTING_ID)).toBe(
            `https://sigilos.fr/dashboard/${GUILD_ID}/marche/${LISTING_ID}`
        );
    });
});

describe("market discord interactions — modale d'offre (S4.3)", () => {
    it("construit une modale type 9 valide : 3 champs facultatifs, custom_id reparsable", () => {
        const modal = buildMarketOfferModal(LISTING_ID);
        const inputs = modal.components.map((row) => row.components[0]);

        // Contrainte Discord : titre ≤ 45, ≤ 5 lignes, exactement 1 champ par ligne.
        expect(modal.title).toBe(MARKET_OFFER_MODAL.TITLE);
        expect(modal.title.length).toBeLessThanOrEqual(45);
        expect(modal.components.length).toBe(3);
        expect(modal.components.every((row) => row.type === 1 && row.components.length === 1)).toBe(true);

        // Les 3 champs de §13.5, dans l'ordre, tous facultatifs côté Discord.
        expect(inputs.map((i) => i.custom_id)).toEqual([
            MARKET_OFFER_MODAL.FIELDS.KAMAS,
            MARKET_OFFER_MODAL.FIELDS.TRADE,
            MARKET_OFFER_MODAL.FIELDS.NOTE,
        ]);
        expect(inputs.every((i) => i.type === 4 && i.required === false)).toBe(true);
        expect(inputs.map((i) => i.style)).toEqual([1, 2, 2]); // kamas court, troc/note longs
        expect(inputs.map((i) => i.max_length)).toEqual([
            MARKET_OFFER_MODAL.KAMAS_MAX_LENGTH,
            MARKET_OFFER_MODAL.TRADE_MAX_LENGTH,
            MARKET_OFFER_MODAL.NOTE_MAX_LENGTH,
        ]);

        // La soumission (type 5) est reparsée par le même parser que les boutons.
        expect(parseMarketCustomId(modal.custom_id)).toEqual({ action: "offer", listingId: LISTING_ID });
        // §13.7 : aucun montant d'offre ni pseudo d'acheteur dans la modale.
        expect(JSON.stringify(modal)).not.toMatch(/buyer|profile-|offeredKamas/i);
    });
});

describe("market discord interactions — gardes serveur (S4.1)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsModuleEnabled.mockResolvedValue(true);
    });

    it("refuse un custom_id invalide SANS interroger le module", async () => {
        const res = await handleMarketComponentInteraction({
            customId: "svc:reserve:abc",
            discordGuildId: GUILD_ID,
            userId: "user-1",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.UNKNOWN_ACTION });
        expect(mockIsModuleEnabled).not.toHaveBeenCalled();
    });

    it("refuse un clic hors serveur : la guilde n'est pas isolable (§16.2)", async () => {
        const res = await handleMarketComponentInteraction({
            customId: `mkt:reserve:${LISTING_ID}`,
            discordGuildId: null,
            userId: "user-1",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.GUILD_REQUIRED });
        expect(mockIsModuleEnabled).not.toHaveBeenCalled();
    });

    it("refuse quand le module `marche` est OFF pour cette guilde (fail-closed)", async () => {
        mockIsModuleEnabled.mockResolvedValue(false);

        const res = await handleMarketComponentInteraction({
            customId: `mkt:reserve:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-1",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.MODULE_DISABLED });
        expect(mockIsModuleEnabled).toHaveBeenCalledWith(GUILD_ID, "marche");
        expect(mockIsModuleEnabled).toHaveBeenCalledTimes(1);
    });

    it("action non encore livrée (contact) → éphémère pointant la fiche SigilOS (§13.5)", async () => {
        const res = await handleMarketComponentInteraction({
            customId: `mkt:contact:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-1",
        });

        expect(res.kind).toBe("ephemeral");
        const content = res.kind === "ephemeral" ? res.content : "";
        expect(content).toContain(MARKET_EPHEMERAL.ACTION_PENDING);
        expect(content).toContain(`https://sigilos.fr/dashboard/${GUILD_ID}/marche/${LISTING_ID}`);
        // §13.7 : ni montant, ni pseudo d'acheteur dans la réponse Discord.
        expect(content).not.toMatch(/\d+\s*(kamas|k\b)/i);
        expect(mockIsModuleEnabled).toHaveBeenCalledWith(GUILD_ID, "marche");
    });
});

describe("market discord interactions — réservation mkt:reserve (S4.2)", () => {
    const PROFILE_ID = "profile-buyer";

    beforeEach(() => {
        vi.clearAllMocks();
        mockIsModuleEnabled.mockResolvedValue(true);
        mockGuildConfigFindUnique.mockResolvedValue({
            id: "guild-internal-1",
            marketReservationHours: 12,
            marketNegotiationsEnabled: true,
        });
        mockUserProfileFindUnique.mockResolvedValue({ id: PROFILE_ID, status: "ACTIVE" });
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "ACTIVE",
            negotiable: true,
        });
        mockAuditCreate.mockResolvedValue({});
        (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
            async (callback: (client: unknown) => unknown) => callback(tx)
        );
        tx.marketListing.updateMany.mockResolvedValue({ count: 1 });
        tx.marketReservation.create.mockResolvedValue({
            id: "reservation-1",
            expiresAt: new Date("2026-09-11T20:00:00.000Z"),
        });
    });

    it("réserve l'annonce et confirme en éphémère (§11.2)", async () => {
        const res = await handleMarketComponentInteraction({
            customId: `mkt:reserve:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: true, content: MARKET_EPHEMERAL.RESERVE_SUCCESS });
        // Le contexte vient du serveur : la guilde est résolue depuis guild_id.
        const guildWhere = mockGuildConfigFindUnique.mock.calls[0][0].where;
        expect(guildWhere.discordGuildId).toBe(GUILD_ID);
        expect(mockListingFindFirst).toHaveBeenCalledTimes(1);
        // §13.7 : ni montant, ni pseudo dans la réponse.
        const content = res.kind === "ephemeral" ? res.content : "";
        expect(content).not.toMatch(/\d+\s*(kamas|k\b)/i);
    });

    it("refuse de réserver sa propre annonce (acheteur = vendeur)", async () => {
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: PROFILE_ID,
            status: "ACTIVE",
        });

        const res = await handleMarketComponentInteraction({
            customId: `mkt:reserve:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.RESERVE_OWN_LISTING });
        expect(tx.marketReservation.create).not.toHaveBeenCalled();
    });

    it("refuse quand le membre n'a pas de profil SigilOS actif dans la guilde", async () => {
        mockUserProfileFindUnique.mockResolvedValue(null);

        const res = await handleMarketComponentInteraction({
            customId: `mkt:reserve:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-stranger",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.PROFILE_REQUIRED });
        expect(mockListingFindFirst).not.toHaveBeenCalled();
    });

    it("signale la collision quand le verrou transactionnel a été pris avant (§11.3)", async () => {
        tx.marketListing.updateMany.mockResolvedValue({ count: 0 });

        const res = await handleMarketComponentInteraction({
            customId: `mkt:reserve:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.RESERVE_CONFLICT });
        expect(tx.marketReservation.create).not.toHaveBeenCalled();
    });

    it("refuse une annonce absente / d'une autre guilde (aucune fuite d'existence)", async () => {
        mockListingFindFirst.mockResolvedValue(null);

        const res = await handleMarketComponentInteraction({
            customId: `mkt:reserve:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.LISTING_NOT_FOUND });
    });
});

describe("market discord interactions — offre mkt:offer (S4.3)", () => {
    const PROFILE_ID = "profile-buyer";

    beforeEach(() => {
        vi.clearAllMocks();
        mockIsModuleEnabled.mockResolvedValue(true);
        mockGuildConfigFindUnique.mockResolvedValue({
            id: "guild-internal-1",
            marketReservationHours: 12,
            marketNegotiationsEnabled: true,
        });
        mockUserProfileFindUnique.mockResolvedValue({ id: PROFILE_ID, status: "ACTIVE" });
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "ACTIVE",
            negotiable: true,
        });
    });

    it("ouvre la modale (type 9) quand l'annonce est ACTIVE et négociable", async () => {
        const res = await handleMarketComponentInteraction({
            customId: `mkt:offer:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res.kind).toBe("modal");
        if (res.kind !== "modal") throw new Error("attendu : réponse modale");
        expect(res.modal).toEqual(buildMarketOfferModal(LISTING_ID));
        expect(parseMarketCustomId(res.modal.custom_id)).toEqual({ action: "offer", listingId: LISTING_ID });

        // Annonce cherchée par `id` **et** guilde interne (§16.2), jamais supprimée.
        const where = mockListingFindFirst.mock.calls[0][0].where;
        expect(where.id).toBe(LISTING_ID);
        expect(where.guildId).toBe("guild-internal-1");
        expect(where.deletedAt).toBeNull();
    });

    it("refuse l'offre sur sa propre annonce (§11.2)", async () => {
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: PROFILE_ID,
            status: "ACTIVE",
            negotiable: true,
        });

        const res = await handleMarketComponentInteraction({
            customId: `mkt:offer:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.OFFER_OWN_LISTING });
    });

    it("refuse une annonce déjà réservée / vendue (§13.5)", async () => {
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "RESERVED",
            negotiable: true,
        });

        const res = await handleMarketComponentInteraction({
            customId: `mkt:offer:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.OFFER_NOT_AVAILABLE });
    });

    it("refuse quand l'annonce n'est pas négociable (§13.5)", async () => {
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "ACTIVE",
            negotiable: false,
        });

        const res = await handleMarketComponentInteraction({
            customId: `mkt:offer:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.OFFER_DISABLED });
    });

    it("refuse quand les négociations sont coupées par la guilde (§13.5)", async () => {
        mockGuildConfigFindUnique.mockResolvedValue({
            id: "guild-internal-1",
            marketReservationHours: 12,
            marketNegotiationsEnabled: false,
        });

        const res = await handleMarketComponentInteraction({
            customId: `mkt:offer:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.OFFER_DISABLED });
    });

    it("refuse une annonce absente / d'une autre guilde (aucune fuite d'existence)", async () => {
        mockListingFindFirst.mockResolvedValue(null);

        const res = await handleMarketComponentInteraction({
            customId: `mkt:offer:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.LISTING_NOT_FOUND });
    });

    it("refuse sans profil SigilOS actif SANS lire l'annonce", async () => {
        mockUserProfileFindUnique.mockResolvedValue(null);

        const res = await handleMarketComponentInteraction({
            customId: `mkt:offer:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-stranger",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.PROFILE_REQUIRED });
        expect(mockListingFindFirst).not.toHaveBeenCalled();
    });
});




