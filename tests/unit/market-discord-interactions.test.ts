/**
 * Module « Marché » — tests des interactions Discord (S4.1 → S4.4) :
 *   1. parsing **fail-closed** du `custom_id` (`mkt:<action>:<listingId>`) ;
 *   2. refus AVANT toute action métier : `custom_id` invalide, hors serveur,
 *      module `marche` désactivé pour la guilde (§0.1 / §16.2) ;
 *   3. garde module interrogée avec l'id de guilde Discord reçu (isolation) ;
 *   4. réponse **toujours** explicite (§13.5) — éphémère (type 4), **ou** modale
 *      (type 9) — sans fuite de montant ni de pseudo d'acheteur (§13.7) ;
 *   5. soumission de la modale d'offre (type 5, S4.4) : la règle « kamas OU troc »
 *      est **recalculée serveur** — un envoi vide est refusé, jamais deviné ;
 *   6. réservation (S4.2) **et** désistement (BUG-8, `mkt:cancel`) : le moteur
 *      partagé reste la seule source de vérité, le clic est throttlé serveur ;
 *   7. BUG-6 : profil **absent** et profil **inactif** renvoient deux messages
 *      distincts (l'ancien message unique accusait à tort un profil existant).
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

/**
 * BUG-8 — le **rate limit fail-closed** des boutons est injecté : par défaut il
 * laisse passer (les tests métier ne doivent pas dépendre de Redis), et le test
 * dédié le fait refuser (`mockResolvedValueOnce`).
 */
const mockRateLimit = vi.fn();
vi.mock("@/lib/ratelimit", () => ({
    rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

/**
 * BUG-8 — seul `cancelMarketReservationCore` est espionné (les tests de
 * réservation existants exercent le **vrai** moteur) : le contrat « aucune règle
 * métier dupliquée dans la couche Discord » reste donc vérifiable ici.
 */
const mockCancelCore = vi.fn();
vi.mock("@/server/market/reservations", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/server/market/reservations")>();
    return {
        ...actual,
        cancelMarketReservationCore: (...args: unknown[]) => mockCancelCore(...args),
    };
});

/**
 * S4.8/S4.9 — les alertes §11.9 passent par `@/server/actions/notification-actions`
 * (donc `@/auth`) ; leurs règles sont testées dans `market-notifications.test.ts`.
 * Les moteurs réservation/offre les *appellent*, donc sans ce mock leur simple
 * import chargerait la chaîne d'authentification dans ce fichier d'interactions.
 */
vi.mock("@/server/market/notifications", () => ({
    notifyMarketUser: vi.fn().mockResolvedValue(true),
    resolveMarketDiscordUserId: vi.fn().mockResolvedValue(null),
    mentionMarketListingOwner: vi.fn().mockResolvedValue(undefined),
    notifyMarketSellerActivity: vi.fn().mockResolvedValue(undefined),
    notifyMarketBuyerActivity: vi.fn().mockResolvedValue(true),
    notifyMarketReservationEnded: vi.fn().mockResolvedValue(2),
}));

/** Transaction simulée des moteurs (réservation S4.2, offre S4.4). */
const tx = {
    marketListing: { updateMany: vi.fn(), update: vi.fn() },
    marketReservation: { create: vi.fn() },
    marketOffer: { create: vi.fn() },
};

const mockGuildConfigFindUnique = vi.fn();
const mockUserProfileFindUnique = vi.fn();
const mockListingFindFirst = vi.fn();
const mockReservationFindFirst = vi.fn();
const mockAuditCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
    db: {
        guildConfig: { findUnique: (...args: unknown[]) => mockGuildConfigFindUnique(...args) },
        userProfile: { findUnique: (...args: unknown[]) => mockUserProfileFindUnique(...args) },
        marketListing: { findFirst: (...args: unknown[]) => mockListingFindFirst(...args) },
        marketReservation: { findFirst: (...args: unknown[]) => mockReservationFindFirst(...args) },
        marketAuditLog: { create: (...args: unknown[]) => mockAuditCreate(...args) },
        $transaction: vi.fn(),
    },
}));

import { db } from "@/lib/prisma";
import {
    MARKET_EPHEMERAL,
    MARKET_EPHEMERAL_LINK_LABEL,
    MARKET_OFFER_MODAL,
    buildMarketDashboardUrl,
    buildMarketOfferModal,
    parseMarketCustomId,
} from "@/lib/market/discord-interactions";
import {
    handleMarketComponentInteraction,
    handleMarketModalSubmit,
} from "@/server/market/discord-interactions";

/**
 * BUG-8 — défauts sûrs pour **toute** la suite : le rate limit laisse passer et
 * aucune réservation active n'existe (le pré-contrôle « déjà réservée par toi »
 * ne doit pas court-circuiter les tests de réservation existants).
 */
beforeEach(() => {
    mockRateLimit.mockResolvedValue({ success: true, remaining: 5, reset: 0 });
    mockReservationFindFirst.mockResolvedValue(null);
});

/** `cuid()` d'annonce utilisé dans tous les tests. */
const LISTING_ID = "cm5marketlisting0001";
const GUILD_ID = "123456789012345678";

/**
 * Soumission de modale (type 5) telle que Discord l'envoie : chaque champ est
 * imbriqué dans sa propre ligne (`ActionRow` type 1), les absents valant `""`.
 */
function marketModalValues(values: { kamas?: string; trade?: string; note?: string }) {
    return [
        { components: [{ custom_id: MARKET_OFFER_MODAL.FIELDS.KAMAS, value: values.kamas ?? "" }] },
        { components: [{ custom_id: MARKET_OFFER_MODAL.FIELDS.TRADE, value: values.trade ?? "" }] },
        { components: [{ custom_id: MARKET_OFFER_MODAL.FIELDS.NOTE, value: values.note ?? "" }] },
    ];
}

describe("market discord interactions — parsing des custom_id (S4.1)", () => {
    it("accepte les 3 actions produites par les boutons de l'annonce (§13.3)", () => {
        for (const action of ["reserve", "offer", "cancel"] as const) {
            expect(parseMarketCustomId(`mkt:${action}:${LISTING_ID}`)).toEqual({ action, listingId: LISTING_ID });
        }
    });

    it("BUG-7 — l'ancien `mkt:contact` est refusé (bouton supprimé, fail-closed)", () => {
        expect(parseMarketCustomId(`mkt:contact:${LISTING_ID}`)).toBeNull();
    });

    it("refuse toute forme ambiguë plutôt que de deviner (fail-closed)", () => {
        expect(parseMarketCustomId(`mkt:reserve`)).toBeNull(); // segment manquant
        expect(parseMarketCustomId(`mkt:reserve:${LISTING_ID}:short`)).toBeNull(); // objet trop court
        expect(parseMarketCustomId(`mkt:reserve:${LISTING_ID}:${LISTING_ID}:x`)).toBeNull(); // 5 segments
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

    /**
     * 🧺 **Option A** — un lot publie **un message par objet** : chaque message
     * porte les `custom_id` de **son** objet (4 segments). La forme à 3 segments
     * (annonces simples + messages publiés avant l'option A) doit rester acceptée :
     * sans cette rétro-compatibilité, les boutons déjà en salon deviendraient muets.
     */
    describe("custom_id par objet (option A)", () => {
        const COMPONENT_ID = "cm5marketcomponent0001";

        it("accepte la forme à 4 segments et restitue l'objet visé", () => {
            for (const action of ["reserve", "offer", "cancel"] as const) {
                expect(parseMarketCustomId(`mkt:${action}:${LISTING_ID}:${COMPONENT_ID}`)).toEqual({
                    action,
                    listingId: LISTING_ID,
                    componentId: COMPONENT_ID,
                });
            }
        });

        it("rétro-compatibilité : la forme à 3 segments reste valide, sans objet", () => {
            const parsed = parseMarketCustomId(`mkt:reserve:${LISTING_ID}`);
            expect(parsed).toEqual({ action: "reserve", listingId: LISTING_ID });
            expect(parsed !== null && "componentId" in parsed).toBe(false);
        });

        it("refuse un identifiant d'objet invalide (fail-closed, mêmes bornes que l'annonce)", () => {
            expect(parseMarketCustomId(`mkt:reserve:${LISTING_ID}:short`)).toBeNull();
            expect(parseMarketCustomId(`mkt:reserve:${LISTING_ID}:${"a".repeat(41)}`)).toBeNull();
            expect(parseMarketCustomId(`mkt:reserve:${LISTING_ID}:a$b$c$`)).toBeNull();
            expect(parseMarketCustomId(`mkt:reserve:${LISTING_ID}:${COMPONENT_ID}:x`)).toBeNull();
        });
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

    /**
     * D43 — une annonce « **kamas uniquement** » (`acceptsTrade = false`) doit le
     * dire **avant** la saisie. Les champs restent `required: false` : Discord ne
     * sait pas exprimer « kamas OU troc », la garde vit dans le moteur serveur.
     */
    it("D43 — annonce « kamas uniquement » : libellés adaptés, sortie historique inchangée sinon", () => {
        const modal = buildMarketOfferModal(LISTING_ID, { acceptsTrade: false });
        const [kamas, trade, note] = modal.components.map((row) => row.components[0]);

        expect(kamas.label).toContain("obligatoire");
        expect(trade.label).toContain("refusé");
        expect(trade.placeholder).toContain("kamas");
        expect(note.label).toBe("Message au vendeur (facultatif)");
        expect(modal.components.every((row) => row.components[0].required === false)).toBe(true);
        // Le `custom_id` reste reparsable à l'identique (aucun second format).
        expect(parseMarketCustomId(modal.custom_id)).toEqual({ action: "offer", listingId: LISTING_ID });

        // Non-régression : sans option (appelants historiques) = `acceptsTrade: true`.
        expect(buildMarketOfferModal(LISTING_ID)).toEqual(
            buildMarketOfferModal(LISTING_ID, { acceptsTrade: true })
        );
        expect(buildMarketOfferModal(LISTING_ID).components[1].components[0].label).toBe(
            "Troc proposé (facultatif)"
        );
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

});

describe("market discord interactions — désistement mkt:cancel (BUG-8)", () => {
    /** Clic réel du bouton « Me désister » de l'annonce réservée. */
    const clickCancel = () =>
        handleMarketComponentInteraction({
            customId: `mkt:cancel:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

    beforeEach(() => {
        vi.clearAllMocks();
        mockIsModuleEnabled.mockResolvedValue(true);
        mockGuildConfigFindUnique.mockResolvedValue({
            id: "guild-internal-1",
            marketReservationHours: 12,
            marketOfferHours: 48,
            marketNegotiationsEnabled: true,
        });
        mockUserProfileFindUnique.mockResolvedValue({ id: "profile-buyer", status: "ACTIVE" });
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "RESERVED",
        });
        // La réservation ACTIVE du membre demandeur (lue **dans la guilde**).
        mockReservationFindFirst.mockResolvedValue({ id: "reservation-1" });
        // Le moteur partagé confirme le désistement (rôle = acheteur, déduit serveur).
        mockCancelCore.mockResolvedValue({ ok: true, cancelledBy: "BUYER" });
    });

    it("annule la réservation, prévient le vendeur (core partagé) et resynchronise le message", async () => {
        const res = await clickCancel();

        expect(res.kind).toBe("ephemeral");
        if (res.kind !== "ephemeral") throw new Error("réponse éphémère attendue");

        expect(res.ok).toBe(true);
        expect(res.content).toBe(MARKET_EPHEMERAL.CANCEL_SUCCESS);
        // §13.7 : ni montant d'offre ni pseudo d'acheteur dans la réponse.
        expect(res.content).not.toMatch(/\d{2,}\s*k/i);
        expect(res.content).not.toContain("profile-");

        // Une seule ligne : le bouton lien, jamais de `custom_id` sur un lien.
        expect(res.components).toHaveLength(1);
        expect(res.components?.[0].type).toBe(1);
        expect(res.components?.[0].components).toEqual([
            {
                type: 2,
                style: 5,
                label: MARKET_EPHEMERAL_LINK_LABEL,
                url: `https://sigilos.fr/dashboard/${GUILD_ID}/marche/${LISTING_ID}`,
            },
        ]);
        expect(JSON.stringify(res.components)).not.toContain("custom_id");

        // Isolation §16.2 : l'annonce **et** la réservation sont relues dans la
        // guilde interne résolue — jamais dans une autre guilde.
        expect(mockListingFindFirst.mock.calls[0][0].where.guildId).toBe("guild-internal-1");
        expect(mockReservationFindFirst.mock.calls[0][0].where.listing.guildId).toBe(
            "guild-internal-1"
        );
        // L'identité de l'auteur vient du **serveur** (jamais de Discord).
        expect(mockCancelCore.mock.calls[0][0]).toMatchObject({
            guildConfigId: "guild-internal-1",
            reservationId: "reservation-1",
            actorProfileId: "profile-buyer",
            actorUserId: "user-buyer",
        });
        // Le message Discord est resynchronisé après l'annulation.
        const { syncListingMessage } = await import("@/server/market/discord");
        expect(syncListingMessage).toHaveBeenCalledWith(LISTING_ID);
    });

    it("refuse le vendeur : il retire son annonce, il ne « se désiste » pas", async () => {
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-buyer",
            status: "RESERVED",
        });

        const res = await clickCancel();

        expect(res).toEqual({
            kind: "ephemeral",
            ok: false,
            content: MARKET_EPHEMERAL.CANCEL_OWN_LISTING,
        });
        expect(mockCancelCore).not.toHaveBeenCalled();
    });

    it("refuse une annonce qui n'est plus réservée (vendue / expirée / retirée)", async () => {
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "SOLD",
        });

        const res = await clickCancel();

        expect(res).toEqual({
            kind: "ephemeral",
            ok: false,
            content: MARKET_EPHEMERAL.CANCEL_UNAVAILABLE,
        });
        expect(mockCancelCore).not.toHaveBeenCalled();
    });

    it("refuse un membre sans réservation active sur cette annonce (§16.2)", async () => {
        mockReservationFindFirst.mockResolvedValue(null);

        const res = await clickCancel();

        expect(res).toEqual({
            kind: "ephemeral",
            ok: false,
            content: MARKET_EPHEMERAL.CANCEL_NOT_YOURS,
        });
        expect(mockCancelCore).not.toHaveBeenCalled();
    });

    it("rate limit (fail-closed) : un clic de trop est refusé sans toucher la base", async () => {
        mockRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, reset: 0 });

        const res = await clickCancel();

        expect(res).toEqual({
            kind: "ephemeral",
            ok: false,
            content: MARKET_EPHEMERAL.RATE_LIMITED,
        });
        expect(mockCancelCore).not.toHaveBeenCalled();
        expect(mockReservationFindFirst).not.toHaveBeenCalled();
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

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.PROFILE_MISSING });
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
            marketOfferHours: 48,
            marketNegotiationsEnabled: true,
        });
        mockUserProfileFindUnique.mockResolvedValue({ id: PROFILE_ID, status: "ACTIVE" });
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "ACTIVE",
            negotiable: true,
            acceptsTrade: true,
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

    it("D43 — annonce « kamas uniquement » : la modale ouverte porte les libellés adaptés", async () => {
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "ACTIVE",
            negotiable: true,
            acceptsTrade: false,
        });

        const res = await handleMarketComponentInteraction({
            customId: `mkt:offer:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res.kind).toBe("modal");
        if (res.kind !== "modal") throw new Error("attendu : réponse modale");
        expect(res.modal).toEqual(buildMarketOfferModal(LISTING_ID, { acceptsTrade: false }));
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

    it("RESERVÉE : la modale d'offre reste OUVERTE (BUG-3 / R3) ; terminal : refusée (§13.5)", async () => {
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "RESERVED",
            negotiable: true,
            acceptsTrade: true,
        });

        const reserved = await handleMarketComponentInteraction({
            customId: `mkt:offer:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        // Une réservation en cours ne ferme plus la négociation : on peut
        // toujours proposer un prix (le vendeur lève la réservation pour accepter).
        expect(reserved.kind).toBe("modal");

        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "SOLD",
            negotiable: true,
        });

        const sold = await handleMarketComponentInteraction({
            customId: `mkt:offer:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(sold).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.OFFER_NOT_AVAILABLE });
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

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.PROFILE_MISSING });
        expect(mockListingFindFirst).not.toHaveBeenCalled();
    });
});

describe("market discord interactions — soumission modale mkt:offer (S4.4)", () => {
    const PROFILE_ID = "profile-buyer";

    beforeEach(() => {
        vi.clearAllMocks();
        mockIsModuleEnabled.mockResolvedValue(true);
        mockGuildConfigFindUnique.mockResolvedValue({
            id: "guild-internal-1",
            marketReservationHours: 12,
            marketOfferHours: 48,
            marketNegotiationsEnabled: true,
        });
        mockUserProfileFindUnique.mockResolvedValue({ id: PROFILE_ID, status: "ACTIVE" });
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "ACTIVE",
            negotiable: true,
            acceptsTrade: true,
        });
        mockAuditCreate.mockResolvedValue({});
        (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
            async (callback: (client: unknown) => unknown) => callback(tx)
        );
        tx.marketOffer.create.mockResolvedValue({
            id: "offer-1",
            expiresAt: new Date("2026-09-13T20:00:00.000Z"),
        });
        tx.marketListing.update.mockResolvedValue({});
    });

    it("crée l'offre depuis la soumission et confirme en éphémère (§11.4)", async () => {
        const res = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ kamas: "45 000 000", note: "Dispo ce soir ?" }),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: true, content: MARKET_EPHEMERAL.OFFER_SUCCESS });

        // Contexte serveur : la guilde est résolue depuis `guild_id` (§16.2).
        expect(mockGuildConfigFindUnique.mock.calls[0][0].where.discordGuildId).toBe(GUILD_ID);

        const created = tx.marketOffer.create.mock.calls[0][0].data;
        expect(created).toMatchObject({
            listingId: LISTING_ID,
            buyerProfileId: PROFILE_ID,
            buyerUserId: "user-buyer",
            offeredKamas: 45_000_000,
            tradeDescription: null,
            status: "PENDING",
        });
        expect(created.note).toBe("Dispo ce soir ?");
        expect(created.expiresAt).toBeInstanceOf(Date);

        // §11.6 : l'activité de l'annonce est reportée dans la même transaction.
        expect(tx.marketListing.update).toHaveBeenCalledWith({
            where: { id: LISTING_ID },
            data: { lastActivityAt: expect.any(Date) },
        });
        // §13.7 : ni montant, ni pseudo d'acheteur dans la réponse Discord.
        expect(res.content).not.toMatch(/45|buyer|profile-/i);
    });

    it("accepte un troc pur (aucun kama) et journalise OFFER_CREATED", async () => {
        const res = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ trade: "Épée + 10 potions" }),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res.ok).toBe(true);
        const created = tx.marketOffer.create.mock.calls[0][0].data;
        expect(created.offeredKamas).toBeNull();
        expect(created.tradeDescription).toBe("Épée + 10 potions");

        const audit = mockAuditCreate.mock.calls[0][0].data;
        expect(audit.action).toBe("OFFER_CREATED");
        expect(audit.actorUserId).toBe("user-buyer");
    });

    it("nettoie les liens du troc et du message (§16.4) au lieu de les refuser", async () => {
        const res = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ trade: "voir https://exemple.fr", note: "discord.gg/abc" }),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res.ok).toBe(true);
        const created = tx.marketOffer.create.mock.calls[0][0].data;
        expect(created.tradeDescription).toBe("voir [lien retiré]");
        expect(created.note).toBe("[invitation retirée]");
    });

    it("refuse une soumission totalement vide : « kamas OU troc » recalculé serveur (§11.4)", async () => {
        const res = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({}),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.OFFER_EMPTY });
        expect(tx.marketOffer.create).not.toHaveBeenCalled();
        expect(mockAuditCreate).not.toHaveBeenCalled();
    });

    it("refuse 0 kama sans troc : aucune offre à 0 ne peut naître (§11.4)", async () => {
        const res = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ kamas: "0" }),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.OFFER_EMPTY });
        expect(tx.marketOffer.create).not.toHaveBeenCalled();
    });

    it("refuse un montant illisible sans le convertir en troc muet (OFFER_INVALID)", async () => {
        const res = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ kamas: "12abc", trade: "Épée" }),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.OFFER_INVALID });
        expect(tx.marketOffer.create).not.toHaveBeenCalled();
    });
});

describe("market discord interactions — gardes d'accès modale mkt:offer (S4.4)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsModuleEnabled.mockResolvedValue(true);
        mockGuildConfigFindUnique.mockResolvedValue({
            id: "guild-internal-1",
            marketReservationHours: 12,
            marketOfferHours: 48,
            marketNegotiationsEnabled: true,
        });
        mockUserProfileFindUnique.mockResolvedValue({ id: "profile-buyer", status: "ACTIVE" });
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "ACTIVE",
            negotiable: true,
        });
    });

    it("refuse un custom_id qui n'est pas la modale d'offre (fail-closed, §0.1)", async () => {
        const res = await handleMarketModalSubmit({
            customId: `mkt:reserve:${LISTING_ID}`,
            components: marketModalValues({ kamas: "1000" }),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.UNKNOWN_ACTION });
        expect(mockIsModuleEnabled).not.toHaveBeenCalled();
        expect(mockGuildConfigFindUnique).not.toHaveBeenCalled();
    });

    it("refuse une soumission hors serveur : la guilde n'est pas isolable (§16.2)", async () => {
        const res = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ kamas: "1000" }),
            discordGuildId: null,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.GUILD_REQUIRED });
        expect(mockIsModuleEnabled).not.toHaveBeenCalled();
    });

    it("refuse quand le module `marche` est OFF pour cette guilde (fail-closed)", async () => {
        mockIsModuleEnabled.mockResolvedValue(false);

        const res = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ kamas: "1000" }),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.MODULE_DISABLED });
        expect(mockIsModuleEnabled).toHaveBeenCalledWith(GUILD_ID, "marche");
    });

    it("refuse un membre sans profil SigilOS actif SANS lire l'annonce", async () => {
        mockUserProfileFindUnique.mockResolvedValue(null);

        const res = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ kamas: "1000" }),
            discordGuildId: GUILD_ID,
            userId: "user-stranger",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.PROFILE_MISSING });
        expect(mockListingFindFirst).not.toHaveBeenCalled();
    });
});

describe("market discord interactions — gardes métier modale mkt:offer (S4.4)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsModuleEnabled.mockResolvedValue(true);
        mockGuildConfigFindUnique.mockResolvedValue({
            id: "guild-internal-1",
            marketReservationHours: 12,
            marketOfferHours: 48,
            marketNegotiationsEnabled: true,
        });
        mockUserProfileFindUnique.mockResolvedValue({ id: "profile-buyer", status: "ACTIVE" });
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "ACTIVE",
            negotiable: true,
        });
    });

    it("refuse l'offre sur sa propre annonce (§11.2/D34)", async () => {
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-buyer",
            status: "ACTIVE",
            negotiable: true,
        });

        const res = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ trade: "Épée" }),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.OFFER_OWN_LISTING });
    });

    it("RESERVÉE acceptée (BUG-3 / R3) ; annonce non négociable refusée (§13.5)", async () => {
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "RESERVED",
            negotiable: true,
            acceptsTrade: true,
        });
        const reserved = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ trade: "Épée" }),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });
        // Réservation en cours : l'offre est **déposée** (moteur partagé), plus refusée.
        expect(reserved.kind).not.toBe("ephemeral-blocked");

        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            profileId: "profile-seller",
            status: "ACTIVE",
            negotiable: false,
        });
        const notNegotiable = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ trade: "Épée" }),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });
        expect(notNegotiable).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.OFFER_DISABLED });
    });

    /**
     * D43 — troc seul sur une annonce « **kamas uniquement** » : le refus vient du
     * **moteur partagé** `createMarketOfferCore()` (§11.4), pas de la route. Un
     * message dédié est renvoyé (jamais muet, §13.5), et **rien** n'est écrit.
     */
    it("D43 — troc seul refusé sur une annonce « kamas uniquement » (message dédié, aucune écriture)", async () => {
        mockListingFindFirst.mockResolvedValue({
            id: LISTING_ID,
            userId: "user-seller",
            profileId: "profile-seller",
            title: "Dofus Turquoise",
            status: "ACTIVE",
            negotiable: true,
            acceptsTrade: false,
            guild: { discordGuildId: GUILD_ID },
        });

        const res = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ trade: "3 runes PA" }),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({
            kind: "ephemeral",
            ok: false,
            content: MARKET_EPHEMERAL.OFFER_TRADE_NOT_ACCEPTED,
        });
        expect(db.$transaction).not.toHaveBeenCalled();
        expect(mockAuditCreate).not.toHaveBeenCalled();
    });

    it("refuse quand les négociations sont coupées par la guilde (§13.5)", async () => {
        mockGuildConfigFindUnique.mockResolvedValue({
            id: "guild-internal-1",
            marketReservationHours: 12,
            marketOfferHours: 48,
            marketNegotiationsEnabled: false,
        });

        const res = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ trade: "Épée" }),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.OFFER_DISABLED });
    });

    it("refuse une annonce absente / d'une autre guilde (aucune fuite d'existence)", async () => {
        mockListingFindFirst.mockResolvedValue(null);

        const res = await handleMarketModalSubmit({
            customId: `mkt:offer:${LISTING_ID}`,
            components: marketModalValues({ kamas: "1000" }),
            discordGuildId: GUILD_ID,
            userId: "user-buyer",
        });

        expect(res).toEqual({ kind: "ephemeral", ok: false, content: MARKET_EPHEMERAL.LISTING_NOT_FOUND });

        // Isolation §16.2 : annonce cherchée par `id` ET par guilde interne.
        const where = mockListingFindFirst.mock.calls[0][0].where;
        expect(where.guildId).toBe("guild-internal-1");
        expect(where.deletedAt).toBeNull();
    });
});




