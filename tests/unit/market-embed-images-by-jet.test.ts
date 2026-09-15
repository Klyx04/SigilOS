/**
 * Constat beta (14/09/2026) — **liste, fiche et embeds selon la réalité de l'annonce**.
 *
 * Captures user :
 *   1. catalogue — un **lot** (« Eau potable ») affichait un **cube gris** : une
 *      annonce de lot n'a ni `itemIconUrl` ni `dofusDbItemId` propres ;
 *   2. fiche — « espace vide énorme », vignette en haut à droite et textes
 *      minuscules sur un lot (aucun jet → aucune colonne d'effets à équilibrer) ;
 *   3. embed — la carte générée pour un **cosmétique / lot** ne sert à rien
 *      (« affiche juste en gros la miniature de l'item ») et son cadre objet
 *      était **vide** ;
 *   4. carte OG d'un **équipement** — « n'affiche pas "+3 autres lignes",
 *      affiche toutes les lignes, compresse un peu plus intelligemment ».
 *
 * Ce test verrouille les 4 règles.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { pickMarketEmbedImage } from "@/lib/market/discord-payload";

function read(path: string): string {
    return readFileSync(path, "utf8");
}

/** Retire commentaires de bloc et de ligne (sinon les motifs matchent la prose). */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("embed — image selon la réalité de l'annonce (règle pure)", () => {
    const CARD = "https://sigilos.fr/api/og/market/l1?v=hash";
    const ITEM = "https://sigilos.fr/api/assets-dofus/items/23559";

    it("un jet déclaré garde la carte PNG (tooltip Dofus)", () => {
        expect(
            pickMarketEmbedImage({ cardImageUrl: CARD, itemImageUrl: ITEM, hasDeclaredJet: true })
        ).toBe(CARD);
    });

    it("sans jet (lot, cosmétique, vente brute) c'est l'image de l'objet en grand", () => {
        expect(
            pickMarketEmbedImage({ cardImageUrl: CARD, itemImageUrl: ITEM, hasDeclaredJet: false })
        ).toBe(ITEM);
    });

    it("ne produit jamais une image vide (repli sur l'autre source)", () => {
        expect(
            pickMarketEmbedImage({ cardImageUrl: null, itemImageUrl: ITEM, hasDeclaredJet: true })
        ).toBe(ITEM);
        expect(
            pickMarketEmbedImage({ cardImageUrl: CARD, itemImageUrl: null, hasDeclaredJet: false })
        ).toBe(CARD);
        expect(
            pickMarketEmbedImage({ cardImageUrl: null, itemImageUrl: null, hasDeclaredJet: false })
        ).toBeNull();
    });
});

describe("embed — le serveur applique la règle (Discord)", () => {
    const source = codeOnly(read("src/server/market/discord.ts"));

    it("calcule l'image à partir du **jet réellement déclaré**", () => {
        expect(source).toMatch(/function resolveDiscordImageUrl\(/);
        expect(source).toMatch(/const hasDeclaredJet = listing\.stats\.some\(isStatBearingStatRow\);/);
        expect(source).toMatch(/return pickMarketEmbedImage\(\{/);
        // La carte n'est plus construite en dur à la publication : les **points
        // d'entrée** passent tous par la règle — publication, resynchro, et
        // depuis le 15/09/2026 les **messages par objet** d'un lot (option A,
        // `syncBundleComponentMessages`).
        expect(source.match(/const imageUrl = resolveDiscordImageUrl\(listing\);/g)).toHaveLength(3);
        expect(source).not.toMatch(/const imageUrl = buildMarketImageUrl\(listingId/);
    });
});

/**
 * **D49** (14/09/2026, décision user) — l'embed d'une annonce **réservée** nomme
 * le réservataire. Le serveur doit donc relire ce nom **au bon endroit**, avec
 * les mêmes gardes que la fiche (S7.8) : profil **de la guilde de l'annonce**, et
 * **aucune** requête ajoutée sur les autres états.
 */
describe("D49 — le serveur nomme le réservataire (embed Discord)", () => {
    const source = codeOnly(read("src/server/market/discord.ts"));

    it("ne lit le réservataire QUE sur une annonce `RESERVED`", () => {
        expect(source).toMatch(
            /const reservationBuyer =\s+listing\.status === "RESERVED"\s+\? await loadReservationBuyerForDiscord\(listing\.id, listing\.guild\.id\)\s+: null;/
        );
    });

    it("relit le profil dans la guilde de l'annonce (isolation §16.2, jamais un id Discord)", () => {
        expect(source).toMatch(
            /where: \{ id: reservation\.buyerProfileId, guildId: guildConfigId \}/
        );
        expect(source).toMatch(/select: \{ pseudoDofus: true, user: \{ select: \{ name: true \} \} \}/);
        // Repli neutre (BUG-6 : profil absent ≠ donnée fausse).
        expect(source).toMatch(/\|\| "Un membre de la guilde"/);
    });

    it("transmet nom + échéance au payload pur, `null` sinon", () => {
        expect(source).toMatch(/reservedByLabel: reservationBuyer\?\.label \?\? null/);
        expect(source).toMatch(/reservedUntil: reservationBuyer\?\.expiresAt\.toISOString\(\) \?\? null/);
    });

    it("reste best-effort : une réservation illisible ne bloque jamais l'embed (repli null)", () => {
        expect(source).toMatch(/logger\.warn\("\[market\] réservataire illisible pour l'embed"/);
        expect(source).toMatch(/return null;/);
    });
});

describe("carte OG — toutes les lignes, image du lot, hauteur dynamique", () => {
    const og = codeOnly(read("src/app/api/og/market/[id]/route.tsx"));

    it("peint toutes les lignes en compressant par paliers", () => {
        expect(og).toMatch(/function statRowMetrics\(count: number\): StatRowMetrics \{/);
        expect(og).toMatch(/if \(count > 24\) return/);
        expect(og).toMatch(/const metrics = statRowMetrics\(statLines\.length\);/);
        expect(og).not.toMatch(/MAX_STAT_LINES/);
        // La hauteur de la carte grandit avec le nombre de lignes.
        expect(og).toMatch(/const cardHeight = Math\.max\(/);
        expect(og.match(/height: cardHeight/g)).toHaveLength(2);
    });

    it("prend l'image du **1ᵉʳ composant** quand l'annonce n'a pas d'`ankamaId`", () => {
        expect(og).toMatch(
            /loadItemImageDataUrl\(\s*\n\s*listing\.dofusDbItemId \?\? listing\.components\[0\]\?\.dofusDbItemId \?\? null\s*\n\s*\);/
        );
    });
});

describe("interface — lot : icône et compacité", () => {
    it("le catalogue (carte **et** tableau) retombe sur le 1ᵉʳ composant", () => {
        const catalog = codeOnly(
            read("src/app/dashboard/[guildId]/marche/_components/market-catalog-client.tsx")
        );
        // Deux replis : la carte (`firstComponent`) et le tableau (accès direct).
        expect(catalog).toMatch(/src=\{listing\.itemIconUrl \?\? firstComponent\?\.iconUrl \?\? null\}/);
        expect(catalog).toMatch(/ankamaId=\{listing\.dofusDbItemId \?\? firstComponent\?\.dofusDbItemId \?\? null\}/);
        expect(catalog).toMatch(/src=\{listing\.itemIconUrl \?\? listing\.components\[0\]\?\.iconUrl \?\? null\}/);
        // Le type sérialisé porte bien ces champs (sinon le repli est mort).
        expect(catalog).toMatch(/iconUrl: string \| null;\s*\n\s*dofusDbItemId: number \| null;/);
    });

    it("« Mon espace » retombe aussi sur le 1ᵉʳ composant du lot", () => {
        const mine = codeOnly(
            read("src/app/dashboard/[guildId]/marche/_components/market-my-space-client.tsx")
        );
        expect(mine).toMatch(/src=\{listing\.itemIconUrl \?\? listing\.components\?\.\[0\]\?\.iconUrl \?\? null\}/);
        expect(mine).toMatch(
            /ankamaId=\{listing\.dofusDbItemId \?\? listing\.components\?\.\[0\]\?\.dofusDbItemId \?\? null\}/
        );
        // Le type client porte les champs du repli (sinon il est mort).
        expect(mine).toMatch(/components\?: \{/);
    });

    it("la carte d'item passe en présentation compacte sans jet", () => {
        const card = codeOnly(read("src/components/market/market-item-card.tsx"));
        expect(card).toMatch(/const compact = stats\.length === 0;/);
        // Vignette **à gauche** en compact (fini le vide au milieu), et à droite
        // en composition « tooltip Dofus » (objet avec jet) via `flex-row-reverse`.
        expect(card).toMatch(/compact \? "h-16 w-16 rounded-xl" : "h-28 w-28 rounded-2xl"/);
        expect(card).toMatch(/compact \? "flex-row items-start" : "flex-row-reverse items-start"/);
        // Contenu du lot / quantités rendus **dans la colonne** de la vignette.
        expect(card).toMatch(/\{!compact && components\.length > 0 && \(/);
        expect(card).toMatch(/\{!compact && \(data\.quantity != null \|\| data\.minQuantity != null\) && \(/);
        // Textes agrandis en compact (constat « texte en tout petit »).
        expect(card).toMatch(/compact \? "text-title" : "text-body"/);
        expect(card).toMatch(/compact \? "text-body" : "text-label"/);
    });
});
