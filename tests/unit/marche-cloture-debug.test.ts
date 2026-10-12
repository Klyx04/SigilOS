/**
 * Clôture du module Marché (14/09/2026) — garde-fous des **décisions user** de la
 * dernière vague de debug. Le module passe en **maintenance** : ces tests
 * verrouillent ce qui ne doit plus jamais réapparaître.
 *
 *   1. **Carte d'item** — le texte de lore/histoire du catalogue n'est plus rendu.
 *   2. **Objet légendaire** — la mention vient de la **donnée du jeu** (capacité
 *      légendaire, `effectId` 1175) et non de `GameItem.isLegendary` (jamais
 *      alimenté par DofusDB).
 *   3. **Timeline des offres** — visible par la guilde, donc **anonyme** :
 *      statut + date, jamais un montant ni l'identité d'un offrant (§13.7).
 *   4. **Image OG** — plus de pied technique (« Annonce #… · date · SigilOS
 *      Market ») et hauteur qui **réserve** le titre `EFFETS`.
 *   5. **Réglages → Marché** — un seul système de droits (RBAC) et plus de
 *      doublon de réglage global.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { hasLegendaryCapacity, isNonStatNativeEffect } from "@/lib/market/effects";

function read(path: string): string {
    return readFileSync(path, "utf8");
}

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const CARD = "src/components/market/market-item-card.tsx";
const OG = "src/app/api/og/market/[id]/route.tsx";
const ACTIONS = "src/server/actions/market-actions.ts";
const SETTINGS = "src/app/dashboard/[guildId]/admin/_components/market-settings-client.tsx";

describe("Carte d'item — plus de lore", () => {
    it("ne rend plus `data.description` (texte de catalogue)", () => {
        const source = codeOnly(read(CARD));
        expect(source).not.toMatch(/\{data\.description\s*&&/);
        expect(source, "le bloc « 8 — Description » est retiré").not.toMatch(/8 — Description"\s*}/);
    });

    it("affiche la mention « Objet légendaire »", () => {
        expect(codeOnly(read(CARD))).toMatch(/isLegendary &&[\s\S]{0,220}Objet légendaire/);
        expect(read(CARD)).not.toContain("Statut légendaire");
    });
});

describe("Objet légendaire — dérivé de la capacité légendaire (1175)", () => {
    it("`hasLegendaryCapacity` lit la donnée brute du catalogue", () => {
        expect(hasLegendaryCapacity([{ effectId: 1175 }])).toBe(true);
        expect(hasLegendaryCapacity([{ effectId: 125 }, { effectId: 2803 }])).toBe(false);
        expect(hasLegendaryCapacity(null)).toBe(false);
        // La même ligne est celle qui n'est jamais affichée comme un jet.
        expect(isNonStatNativeEffect({ effectId: 1175 })).toBe(true);
    });

    it("`getItemCatalogEntry` dérive `isLegendary` avant le filtre d'affichage", () => {
        const source = codeOnly(read("src/lib/market/item-catalog.ts"));
        expect(source).toMatch(/hasLegendaryCapacity\(natives\)/);
        const derive = source.indexOf("hasLegendaryCapacity(natives)");
        const filter = source.indexOf("natives.filter((fx) => !isNonStatNativeEffect(fx))");
        expect(derive, "la dérivation doit précéder le filtrage").toBeLessThan(filter);
    });
});


describe("Timeline des offres — publique donc anonyme (§13.7)", () => {
    it("la requête ne sélectionne ni montant ni offrant", () => {
        const source = codeOnly(read(ACTIONS));
        const start = source.indexOf("const offerRows = await db.marketOffer.findMany");
        expect(start, "timeline serveur introuvable").toBeGreaterThan(-1);
        const branch = source.slice(start, source.indexOf("}));", start));
        expect(branch).toMatch(/status: true/);
        expect(branch, "jamais un montant").not.toMatch(/offeredKamas|tradeDescription|note:/);
        expect(branch, "jamais l'identité de l'offrant").not.toMatch(/buyerProfileId/);
        expect(branch, "lecture bornée").toMatch(/take: MARKET_OFFER_TIMELINE_LIMIT/);
        expect(branch, "isolation par la guilde de l'annonce").toMatch(/listing: \{ guildId: guildConfig\.id \}/);
    });

    it("le composant rend la timeline sous la carte, repliée par défaut", () => {
        const source = codeOnly(read("src/app/dashboard/[guildId]/marche/_components/market-listing-client.tsx"));
        expect(source).toMatch(/offerHistory\.length > 0/);
        expect(source, "un `<details>` n'occupe pas l'écran d'un équipement à 17 lignes").toMatch(/<details/);
        expect(source).toMatch(/MARKET_OFFER_STATUS_LABELS/);
    });
});

describe("Image OG — plus de pied technique, hauteur qui réserve le titre", () => {
    it("ne peint plus « Annonce #… / date / SigilOS Market »", () => {
        const source = codeOnly(read(OG));
        expect(source).not.toMatch(/shortListingId/);
        expect(source, "le pied portait la ligne horizontale en bas").not.toMatch(/CARD_FOOTER_HEIGHT/);
    });

    it("réserve le titre `EFFETS` + un `gap` par ligne (plus de recouvrement)", () => {
        const source = codeOnly(read(OG));
        expect(source).toMatch(/STATS_HEADING_HEIGHT/);
        expect(source).toMatch(/statLines\.length \* \(metrics\.row \+ STATS_ROW_GAP\)/);
    });
});

describe("Réglages → Marché — un seul système de droits, plus de doublon de réglage", () => {
    it("le panneau de guilde ne porte plus les rôles ni les durées", () => {
        const source = codeOnly(read(SETTINGS));
        expect(source, "plus de sélecteur de rôle Discord").not.toMatch(/RoleSelector/);
        expect(source, "plus de champs « Durées, plafonds & rappels »").not.toMatch(/numericFields/);
        expect(source, "le panneau conserve les rôles pinguables").toMatch(/PingRolesSelector/);
    });

    it("le test de configuration ne signale plus les rôles supprimés", () => {
        const source = codeOnly(read("src/server/actions/market-admin-actions.ts"));
        expect(source).not.toMatch(/Aucun rôle modérateur défini/);
        expect(source).not.toMatch(/Aucun rôle à mentionner/);
        expect(source, "le salon et les rôles pinguables restent contrôlés").toMatch(/Aucun rôle « pinguable »/);
    });
});
