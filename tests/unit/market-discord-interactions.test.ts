/**
 * Module « Marché » — tests des interactions Discord (S4.1) :
 *   1. parsing **fail-closed** du `custom_id` (`mkt:<action>:<listingId>`) ;
 *   2. refus AVANT toute action métier : `custom_id` invalide, hors serveur,
 *      module `marche` désactivé pour la guilde (§0.1 / §16.2) ;
 *   3. garde module interrogée avec l'id de guilde Discord reçu (isolation) ;
 *   4. réponse **toujours** explicite et éphémère (§13.5), sans fuite de montant
 *      ni de pseudo d'acheteur (§13.7).
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

import {
    MARKET_EPHEMERAL,
    buildMarketDashboardUrl,
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

        expect(res.ok).toBe(false);
        expect(res.content).toBe(MARKET_EPHEMERAL.UNKNOWN_ACTION);
        expect(mockIsModuleEnabled).not.toHaveBeenCalled();
    });

    it("refuse un clic hors serveur : la guilde n'est pas isolable (§16.2)", async () => {
        const res = await handleMarketComponentInteraction({
            customId: `mkt:reserve:${LISTING_ID}`,
            discordGuildId: null,
            userId: "user-1",
        });

        expect(res.content).toBe(MARKET_EPHEMERAL.GUILD_REQUIRED);
        expect(mockIsModuleEnabled).not.toHaveBeenCalled();
    });

    it("refuse quand le module `marche` est OFF pour cette guilde (fail-closed)", async () => {
        mockIsModuleEnabled.mockResolvedValue(false);

        const res = await handleMarketComponentInteraction({
            customId: `mkt:reserve:${LISTING_ID}`,
            discordGuildId: GUILD_ID,
            userId: "user-1",
        });

        expect(res.content).toBe(MARKET_EPHEMERAL.MODULE_DISABLED);
        expect(mockIsModuleEnabled).toHaveBeenCalledWith(GUILD_ID, "marche");
        expect(mockIsModuleEnabled).toHaveBeenCalledTimes(1);
    });

    it("module ON → réponse éphémère explicite pointant la fiche SigilOS (§13.5)", async () => {
        for (const action of ["reserve", "offer", "contact"]) {
            const res = await handleMarketComponentInteraction({
                customId: `mkt:${action}:${LISTING_ID}`,
                discordGuildId: GUILD_ID,
                userId: "user-1",
            });

            expect(res.content.length).toBeGreaterThan(0);
            expect(res.content).toContain(MARKET_EPHEMERAL.ACTION_PENDING);
            expect(res.content).toContain(`https://sigilos.fr/dashboard/${GUILD_ID}/marche/${LISTING_ID}`);
            // §13.7 : ni montant, ni pseudo d'acheteur dans la réponse Discord.
            expect(res.content).not.toMatch(/\d+\s*(kamas|k\b)/i);
        }

        expect(mockIsModuleEnabled).toHaveBeenCalledWith(GUILD_ID, "marche");
    });
});
