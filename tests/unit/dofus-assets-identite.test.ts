import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { normalizeDofusAssetStoredUrl, resolveDofusAssetImageUrl } from "@/lib/dofus-image-url";
import { normalizeItemIconUrl } from "@/lib/market/item-image";

/**
 * 🔒 Verrou d'identité des assets Dofus — mesures du 09/10/2026.
 *
 * Deux espaces d'identifiants cohabitent chez DofusDB et NE SONT PAS interchangeables :
 *   · l'id de l'entité (monstre 8278 = Reine Écarlate ; objet 11107 = Bois de Tremble) ;
 *   · l'APPARENCE (gfxId / iconId) : img/monsters/{gfx}.png, img/items/{iconId}.png.
 *
 * Mesures chiffrées (beta, 09/10/2026) : img/monsters/8278.png → 404, img/monsters/2601.png → 200
 * mais l'id 2601 est « Tromplamor le Survivant » ; img/items/15990.png → 404, img/items/38677.png
 * → 200 pour l'objet 11107 (iconId 38677) ; l'id 3086 est « Purée pique-fêle ».
 *
 * Confondre les deux sert l'image d'une AUTRE entité, puis la fige un an en cache
 * (Cache-Control: immutable) — d'où la couronne 👑 de Tal Kasha et les icônes étrangères
 * du guide Sylvestre et des cartes Discord.
 */
const routeSource = readFileSync("src/app/api/assets-dofus/[type]/[id]/route.ts", "utf8");

describe("🖼️ Assets Dofus — l'id d'entité n'est jamais confondu avec l'apparence", () => {
    it("Reine Écarlate : une URL img/monsters donne le monstre par son ID (8278), pas par sa gfx (2601)", () => {
        const url = normalizeDofusAssetStoredUrl("monsters", "https://api.dofusdb.fr/img/monsters/2601.png", 8278);
        expect(url).toBe(
            "/api/assets-dofus/monsters/8278?url=https%3A%2F%2Fapi.dofusdb.fr%2Fimg%2Fmonsters%2F2601.png"
        );
        expect(url).not.toContain("/monsters/2601");
    });

    it("sans id d'entité, le nombre d'une URL img/monsters n'est PAS promu en clé de cache", () => {
        expect(
            resolveDofusAssetImageUrl("monsters", null, "https://api.dofusdb.fr/img/monsters/2601.png")
        ).toBeNull();
    });

    it("les sorts gardent la résolution par l'icône du CDN (comportement inchangé)", () => {
        expect(
            resolveDofusAssetImageUrl("spells", null, "https://api.dofusdb.fr/img/spells/sort_12160.png")
        ).toBe("/api/assets-dofus/spells/12160?url=https%3A%2F%2Fapi.dofusdb.fr%2Fimg%2Fspells%2Fsort_12160.png");
    });

    it("Tal Kasha : un chemin local dérivé (écrit par monster-stats-core) passe par le proxy", () => {
        expect(normalizeDofusAssetStoredUrl("monsters", "/assets/dofus/monsters/4744.png", 4744)).toBe(
            "/api/assets-dofus/monsters/4744"
        );
    });

    it("l'illustration d'un donjon n'est jamais prise pour le sprite du boss", () => {
        expect(
            normalizeDofusAssetStoredUrl("monsters", "/game-data/dungeons/chambre-de-tal-kasha.webp", 4744)
        ).toBe("/api/assets-dofus/monsters/4744");
    });

    it("ne casse pas les sprites titans (chemin local réellement entretenu)", () => {
        expect(normalizeDofusAssetStoredUrl("monsters", "/game-data/titans/qilby.webp", 999)).toBe(
            "/game-data/titans/qilby.webp"
        );
    });

    it("un chemin legacy /uploads/assets-dofus nomme le fichier : c'est lui qui fait foi", () => {
        expect(normalizeDofusAssetStoredUrl("monsters", "/uploads/assets-dofus/monsters/4834.webp", 9999)).toBe(
            "/api/assets-dofus/monsters/4834"
        );
    });

    it("Marché : l'iconId d'une URL img/items ne devient pas la clé du proxy", () => {
        expect(normalizeItemIconUrl("https://api.dofusdb.fr/img/items/38677.png", 11107)).toBe(
            "/api/assets-dofus/items/11107"
        );
    });
});

describe("🛡️ Proxy /api/assets-dofus — gardes d'identité (verrou de source)", () => {
    it("ne devine JAMAIS l'icône d'un objet par son id (img/items/{id}.png)", () => {
        expect(routeSource).not.toContain("${REMOTE_BASE_URLS.items}/${safeId}.png");
    });

    it("ne lit plus le dump Game data par l'id demandé (il est indexé par l'apparence)", () => {
        expect(routeSource).not.toContain("const godFile = findGodFile(safeId);");
    });

    it("garde l'identité vérifiée pour les monstres ET pour les objets", () => {
        expect(routeSource).toContain("Number(monsterData?.id) === Number(safeId)");
        expect(routeSource).toContain("Number(itemData?.id) === Number(safeId)");
    });

    it("résout l'iconId des objets AVANT l'URL officielle", () => {
        // …et le repli « espace d'icône » (Dofusbook envoie un iconId, pas un id d'objet) n'existe
        // QU'APRÈS l'autorité : sans lui, toute la galerie stuff affichait un placeholder.
        expect(routeSource).toContain("Repli ESPACE D ICONE");
        expect(routeSource).toContain("const iconId = Math.floor(Number(itemData?.iconId) || 0);");
        expect(routeSource).toContain("https://api.dofusdb.fr/img/items/");
    });
});
