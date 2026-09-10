import { describe, it, expect } from "vitest";
import {
    buildMarketDiscordPayload,
    buildForumPostName,
    shortListingId,
    MARKET_DISCORD_COLORS,
    type MarketDiscordPayloadInput,
} from "@/lib/market/discord-payload";

/**
 * Module « Marché » — payload Discord par état (S3.1 / S3.10).
 * Contrat : aucun montant d'offre ni pseudo d'acheteur n'est public ; les
 * boutons Rèserver/Offre sont désactivés (jamais retirés) hors `ACTIVE`.
 */
const base: MarketDiscordPayloadInput = {
    listingId: "clx0123456789",
    title: "Anneau de Force",
    status: "ACTIVE",
    sellerName: "VendeurTest",
    itemName: "Anneau de Force",
    itemLevel: 200,
    itemTypeName: "Anneau",
    priceKamas: 45_000_000,
    negotiable: true,
    offersCount: 0,
    dashboardUrl: "https://sigilos.fr/dashboard/1/marche/clx0123456789",
};

function buttonsOf(payload: ReturnType<typeof buildMarketDiscordPayload>) {
    return payload.components[0].components as Array<{ custom_id?: string; disabled?: boolean; style: number }>;
}

describe("buildMarketDiscordPayload", () => {
    it("ACTIVE — titre avec prix, couleur dorée, 4 boutons actifs", () => {
        const payload = buildMarketDiscordPayload(base);
        expect(payload.embedTitle).toContain("Anneau de Force");
        expect(payload.embedTitle).toContain("45");
        expect(payload.embedColor).toBe(MARKET_DISCORD_COLORS.ACTIVE);
        const buttons = buttonsOf(payload);
        expect(buttons).toHaveLength(4);
        expect(buttons.filter((b) => b.disabled)).toHaveLength(0);
    });

    it("RESERVED — boutons Réserver/Offre DÉSACTIVÉS (jamais supprimés)", () => {
        const payload = buildMarketDiscordPayload({ ...base, status: "RESERVED" });
        expect(payload.embedColor).toBe(MARKET_DISCORD_COLORS.RESERVED);
        const buttons = buttonsOf(payload);
        const reserve = buttons.find((b) => b.custom_id === `mkt:reserve:${base.listingId}`);
        const offer = buttons.find((b) => b.custom_id === `mkt:offer:${base.listingId}`);
        expect(reserve?.disabled).toBe(true);
        expect(offer?.disabled).toBe(true);
        // Le bouton « Contacter » reste disponible.
        expect(buttons.find((b) => b.custom_id?.startsWith("mkt:contact"))?.disabled).toBe(false);
    });

    it("SOLD — bouton Contacter désactivé", () => {
        const payload = buildMarketDiscordPayload({ ...base, status: "SOLD" });
        const buttons = buttonsOf(payload);
        expect(buttons.find((b) => b.custom_id?.startsWith("mkt:contact"))?.disabled).toBe(true);
    });

    it("n'expose JAMAIS un montant d'offre ni un pseudo d'acheteur (compteur seulement)", () => {
        const payload = buildMarketDiscordPayload({ ...base, status: "RESERVED", offersCount: 3 });
        const serialized = JSON.stringify(payload);
        expect(serialized).not.toMatch(/offeredKamas|acheteur|buyer/i);
        const offers = payload.fields.find((f) => f.name === "Offres");
        expect(offers?.value).toBe("3 en cours");
    });

    it("ajoute le badge exo quand des lignes exotiques sont déclarées", () => {
        const payload = buildMarketDiscordPayload({ ...base, exoLabels: ["PA", "PM"] });
        expect(payload.embedDescription).toContain("★ Exo PA · PM");
    });

    it("tronque la liste du lot à 5 lignes + « + N autres »", () => {
        const components = Array.from({ length: 8 }, (_, i) => ({ name: `Ressource ${i}`, quantity: 1000 }));
        const payload = buildMarketDiscordPayload({ ...base, components });
        expect(payload.embedDescription).toContain("Ressource 4");
        expect(payload.embedDescription).not.toContain("Ressource 5");
        expect(payload.embedDescription).toContain("+ 3 autre");
    });

    it("mode forum : icône en thumbnail, pas de carte générée en image", () => {
        const payload = buildMarketDiscordPayload({
            ...base,
            forumMode: true,
            itemIconUrl: "https://sigilos.fr/api/assets-dofus/items/1",
            imageUrl: "https://sigilos.fr/api/og/market/clx0123456789",
        });
        expect(payload.embedThumbnail).toBe("https://sigilos.fr/api/assets-dofus/items/1");
        expect(payload.embedImage).toBeUndefined();
    });
});

describe("helpers payload Discord", () => {
    it("shortListingId renvoie les 6 derniers caractères en majuscules", () => {
        expect(shortListingId("clx0123456789")).toBe("456789");
    });

    it("buildForumPostName tient dans 100 caractères et nettoie les espaces", () => {
        const name = buildForumPostName({ ...base, itemName: "A".repeat(200) });
        expect(name.length).toBeLessThanOrEqual(100);
        expect(name).not.toMatch(/\s{2,}/);
    });
});
