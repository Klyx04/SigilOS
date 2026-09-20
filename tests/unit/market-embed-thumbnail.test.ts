/**
 * BUG-4 — **embed Discord : miniature toujours présente + carte sans « ? »**.
 *
 * Constat beta (`debug.md`) :
 *   · la carte image ne s'affichait qu'après un clic sur un bouton, et l'embed
 *     n'avait **aucune miniature** hors salon forum ⇒ on veut l'objet en haut à
 *     droite **dès la publication** ;
 *   · certaines images ne se généraient pas (« ? » dans la carte Sharp) ;
 *   · pour un objet **sans ligne de stats** (cosmétique, ressources), autant
 *     l'afficher **en grand**.
 *
 * Ce test verrouille les trois : le payload (miniature inconditionnelle), le
 * serveur (repli sur le 1ᵉʳ composant du lot, normalisation anti-404) et la carte
 * OG (siphon à la volée, plus de glyphe « ? », objet agrandi sans stats).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildMarketDiscordPayload } from "@/lib/market/discord-payload";

function read(path: string): string {
    return readFileSync(path, "utf8");
}

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const base = {
    listingId: "listing-1",
    title: "Cape des Bouftous",
    status: "ACTIVE" as const,
    sellerName: "Wylan",
    negotiable: true,
    dashboardUrl: "https://sigilos.fr/dashboard/1/marche/listing-1",
    imageUrl: "https://sigilos.fr/api/og/market/listing-1?v=hash",
    itemIconUrl: "https://sigilos.fr/api/assets-dofus/items/14091",
};

describe("BUG-4 — miniature de l'embed", () => {
    it("est renseignée même en salon TEXTUEL (pas seulement en forum)", () => {
        const text = buildMarketDiscordPayload({ ...base, forumMode: false });
        expect(text.embedThumbnail).toBe(base.itemIconUrl);

        const forum = buildMarketDiscordPayload({ ...base, forumMode: true });
        expect(forum.embedThumbnail).toBe(base.itemIconUrl);
        // La carte PNG reste l'image (elle porte le jet, les couleurs, le prix).
        expect(forum.embedImage).toBe(base.imageUrl);
        expect(text.embedImage).toBe(base.imageUrl);
    });

    it("reste absente (jamais une URL vide) quand aucune icône n'est disponible", () => {
        const payload = buildMarketDiscordPayload({ ...base, itemIconUrl: null });
        expect(payload.embedThumbnail).toBeUndefined();
    });
});

describe("BUG-4 — le serveur ne publie jamais un chemin local", () => {
    it("résout l'icône (objet → 1ᵉʳ composant du lot) et la normalise", () => {
        const source = codeOnly(read("src/server/market/discord.ts"));

        // Une seule fonction de résolution, utilisée par le payload.
        expect(source).toMatch(/function resolveDiscordThumbnail/);
        expect(source).toMatch(/itemIconUrl:\s*resolveDiscordThumbnail\(listing\)/);
        // Repli sur le premier composant du lot (un lot n'a pas d'icône d'objet).
        expect(source).toMatch(/listing\.components\[0\]/);
        // Normalisation : le proxy auto-siphon, jamais `/uploads/...`.
        expect(source).toMatch(/normalizeItemIconUrl\(first\.iconUrl, first\.dofusDbItemId\)/);
    });
});

describe("BUG-4 — carte OG : plus de « ? », objet agrandi sans stats", () => {
    it("n'affiche plus le glyphe de repli « ? »", () => {
        const source = codeOnly(read("src/app/api/og/market/[id]/route.tsx"));
        expect(source).not.toMatch(/>\?<\/div>/);
    });

    it("agrandit le cadre de l'objet quand il n'y a aucune ligne de stats", () => {
        const source = codeOnly(read("src/app/api/og/market/[id]/route.tsx"));
        expect(source).toMatch(/ITEM_BOX_LARGE/);
        expect(source).toMatch(/const boxSize = hasStatLines \? ITEM_BOX : ITEM_BOX_LARGE/);
        // Les dimensions rendues suivent `boxSize` (jamais la constante figée).
        expect(source).toMatch(/width: boxSize/);
        expect(source).toMatch(/width=\{boxSize - 40\}/);
    });

    it("siphone l'image à la volée au lieu d'abandonner (source du « ? »)", () => {
        const source = codeOnly(read("src/lib/market/og-assets.ts"));
        expect(source).toMatch(/siphonAndCompressImage\(null, "items", ankamaId\)/);
    });
});
