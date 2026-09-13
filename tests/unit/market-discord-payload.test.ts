import { describe, it, expect } from "vitest";
import {
    absoluteDiscordAssetUrl,
    buildMarketDiscordPayload,
    buildForumPostName,
    formatMarketStatLine,
    shortListingId,
    MARKET_DISCORD_COLORS,
    type MarketDiscordPayloadInput,
} from "@/lib/market/discord-payload";
import {
    MARKET_DASHBOARD_LINK_LABEL,
    MARKET_EPHEMERAL_LINK_LABEL,
    buildMarketDashboardLinkButton,
    buildMarketDashboardLinkRow,
} from "@/lib/market/discord-interactions";

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

    it("annonce NON négociable — bouton Offre désactivé, Réservation intacte (§13.5)", () => {
        const payload = buildMarketDiscordPayload({ ...base, negotiable: false });
        const buttons = buttonsOf(payload);
        expect(buttons.find((b) => b.custom_id === `mkt:offer:${base.listingId}`)?.disabled).toBe(true);
        expect(buttons.find((b) => b.custom_id === `mkt:reserve:${base.listingId}`)?.disabled).toBe(false);
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

    it("mode forum : icône en thumbnail ET carte en image (correction 13/09)", () => {
        const payload = buildMarketDiscordPayload({
            ...base,
            forumMode: true,
            itemIconUrl: "https://sigilos.fr/api/assets-dofus/items/1",
            imageUrl: "https://sigilos.fr/api/og/market/clx0123456789",
        });
        expect(payload.embedThumbnail).toBe("https://sigilos.fr/api/assets-dofus/items/1");
        // Constat user : sans la carte, le post forum ne montrait ni les icônes
        // officielles ni les couleurs du jet (exo, malus) ⇒ elle est jointe
        // désormais dans les deux modes.
        expect(payload.embedImage).toBe("https://sigilos.fr/api/og/market/clx0123456789");
    });

    it("S4.6 — 4ᵉ bouton = lien « Voir sur SigilOS », dans TOUS les états (jamais retiré)", () => {
        const expectedLink = buildMarketDashboardLinkButton(base.dashboardUrl);
        expect(expectedLink.style).toBe(5);

        for (const status of ["DRAFT", "ACTIVE", "RESERVED", "SOLD", "EXPIRED", "WITHDRAWN"] as const) {
            const payload = buildMarketDiscordPayload({ ...base, status });
            const buttons = buttonsOf(payload);

            expect(buttons).toHaveLength(4);
            // Même forme que les réponses éphémères de S4.5 (une seule définition).
            expect(buttons[3]).toEqual(expectedLink);
            expect(buttons[3]).not.toHaveProperty("custom_id"); // un lien n'en accepte pas
            // Une seule ActionRow, jamais désactivée (un lien reste toujours cliquable).
            expect(payload.components[0]).toMatchObject({ type: 1 });
            expect(payload.components).toHaveLength(1);
        }
    });
});

describe("bouton lien fiche SigilOS (S4.5 / S4.6)", () => {
    it("construit un bouton lien (style 5) sans custom_id, libellé surchargeable", () => {
        const standard = buildMarketDashboardLinkButton(base.dashboardUrl);
        expect(standard).toEqual({
            type: 2,
            style: 5,
            label: MARKET_DASHBOARD_LINK_LABEL,
            url: base.dashboardUrl,
        });
        expect(standard).not.toHaveProperty("custom_id");

        // Même bouton, libellé des réponses éphémères (§13.5).
        const ephemeral = buildMarketDashboardLinkButton(base.dashboardUrl, MARKET_EPHEMERAL_LINK_LABEL);
        expect(ephemeral.label).toBe(MARKET_EPHEMERAL_LINK_LABEL);
        expect(ephemeral.url).toBe(base.dashboardUrl);
    });

    it("buildMarketDashboardLinkRow encapsule le bouton dans une ActionRow type 1", () => {
        const row = buildMarketDashboardLinkRow(base.dashboardUrl, MARKET_EPHEMERAL_LINK_LABEL);
        expect(row).toEqual({
            type: 1,
            components: [buildMarketDashboardLinkButton(base.dashboardUrl, MARKET_EPHEMERAL_LINK_LABEL)],
        });
        expect(row.components).toHaveLength(1);
    });
});

describe("formatMarketStatLine (correction 13/09)", () => {
    it("rend la valeur, le libellé et la plage native (comme la carte)", () => {
        expect(
            formatMarketStatLine({ label: "Vitalité", actualValue: 348, naturalMin: 301, naturalMax: 350 })
        ).toBe("**+348** Vitalité [301 à 350]");
        // Valeur fixe (PA natif) : une seule borne.
        expect(formatMarketStatLine({ label: "PM", actualValue: 1, naturalMin: 1, naturalMax: 1 })).toBe(
            "**+1** PM [1]"
        );
        // Malus : signe négatif + plage décroissante, comme DofusDB.
        expect(
            formatMarketStatLine({ label: "Esquive PA", actualValue: -8, naturalMin: -6, naturalMax: -8 })
        ).toBe("**-8** Esquive PA [-6 à -8]");
        // Ligne libre (pas de plage native) : aucune borne inventée.
        expect(formatMarketStatLine({ label: "% Dommages aux sorts", actualValue: 3 })).toBe(
            "**+3** % Dommages aux sorts"
        );
    });

    it("marque les exo (Discord n'a pas de couleur de texte)", () => {
        expect(
            formatMarketStatLine({ label: "PM", actualValue: 1, origin: "EXO" })
        ).toBe("✦ Exo **+1** PM");
    });

    it("publie le jet dans la description de l'embed et résume au-delà de 20 lignes", () => {
        const stats = Array.from({ length: 22 }, (_, index) => ({
            label: `Ligne ${index + 1}`,
            actualValue: index + 1,
        }));
        const payload = buildMarketDiscordPayload({ ...base, stats });
        expect(payload.embedDescription).toContain("**EFFETS**");
        expect(payload.embedDescription).toContain("Ligne 1");
        expect(payload.embedDescription).toContain("+ 2 autre(s) ligne(s) de jet");
        // Jamais les 22 lignes : l'embed Discord est borné.
        expect(payload.embedDescription).not.toContain("Ligne 21");
    });

    it("joint la carte PNG dans TOUS les modes (icônes et couleurs du jet)", () => {
        const image = "https://sigilos.fr/api/og/market/clx0123456789?v=hash";
        const forum = buildMarketDiscordPayload({
            ...base,
            forumMode: true,
            imageUrl: image,
            itemIconUrl: "https://sigilos.fr/api/assets-dofus/items/14091",
        });
        expect(forum.embedImage).toBe(image);
        // Mode forum : l'icône objet reste en vignette.
        expect(forum.embedThumbnail).toBe("https://sigilos.fr/api/assets-dofus/items/14091");

        const texte = buildMarketDiscordPayload({ ...base, imageUrl: image });
        expect(texte.embedImage).toBe(image);
        expect(texte.embedThumbnail).toBeUndefined();
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

    /**
     * Correction 13/09 — deux constats user sur l'aperçu/publication :
     *   - sans prix, le titre finissait par « — — » (`formatKamas(null)`) ;
     *   - Discord REFUSE une vignette relative (`400 Invalid Form Body /
     *     thumbnail.url : Not a well formed URL`, code 50035) : le mode forum
     *     publiait l'icône locale du catalogue telle quelle.
     */
    it("buildMarketDiscordPayload n'ajoute pas de prix fantôme au titre", () => {
        const withPrice = buildMarketDiscordPayload(base);
        expect(withPrice.embedTitle).toContain("Anneau de Force");
        expect(withPrice.embedTitle).toContain("45");

        const withoutPrice = buildMarketDiscordPayload({ ...base, priceKamas: null });
        expect(withoutPrice.embedTitle).toBe("Anneau de Force");
        expect(withoutPrice.embedTitle).not.toContain("—");
    });

    it("absoluteDiscordAssetUrl absolutise les chemins locaux et écarte l'invalide", () => {
        expect(absoluteDiscordAssetUrl("/api/assets-dofus/items/14091", "https://sigilos.fr")).toBe(
            "https://sigilos.fr/api/assets-dofus/items/14091"
        );
        expect(absoluteDiscordAssetUrl("/uploads/x.webp", "https://sigilos.fr/")).toBe(
            "https://sigilos.fr/uploads/x.webp"
        );
        expect(absoluteDiscordAssetUrl("uploads/x.webp", "https://sigilos.fr")).toBe(
            "https://sigilos.fr/uploads/x.webp"
        );
        // Déjà absolue : conservée telle quelle.
        expect(absoluteDiscordAssetUrl("https://cdn.test/a.png", "https://sigilos.fr")).toBe(
            "https://cdn.test/a.png"
        );
        // Rien à publier : `null` (jamais une URL invalide pour Discord).
        expect(absoluteDiscordAssetUrl(null, "https://sigilos.fr")).toBeNull();
        expect(absoluteDiscordAssetUrl("", "https://sigilos.fr")).toBeNull();
        // Base inexploitable : on préfère omettre la vignette.
        expect(absoluteDiscordAssetUrl("/a.png", "sigilos.fr")).toBeNull();
    });
});
