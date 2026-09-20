import { describe, it, expect } from "vitest";
import {
    DOFUS_ITEM_IMAGE_PROXY_BASE,
    itemImageProxyUrl,
    normalizeItemIconUrl,
} from "@/lib/market/item-image";

/**
 * BUG-3 — images d'objets 404/relatives (`debug.md`).
 *
 * Le contrat testé est celui qui manquait : **toute** icône d'objet du module
 * repart sur le proxy auto-siphon `/api/assets-dofus/items/{id}`, jamais sur un
 * nom nu (`25757.webp`) ni sur le chemin statique `/uploads/assets-dofus/...`
 * (qui n'existe que si le siphon a déjà tourné).
 */
describe("🖼️ Marché — normalisation des icônes d'objets (BUG-3)", () => {
    it("construit l'URL du proxy auto-siphon à partir de l'id Ankama", () => {
        expect(itemImageProxyUrl(25757)).toBe(`${DOFUS_ITEM_IMAGE_PROXY_BASE}/25757`);
        expect(itemImageProxyUrl(311)).toBe(`${DOFUS_ITEM_IMAGE_PROXY_BASE}/311`);
    });

    it("refuse les identifiants non exploitables (jamais d'URL inventée)", () => {
        expect(itemImageProxyUrl(null)).toBeNull();
        expect(itemImageProxyUrl(undefined)).toBeNull();
        expect(itemImageProxyUrl(0)).toBeNull();
        expect(itemImageProxyUrl(-3)).toBeNull();
        expect(itemImageProxyUrl(Number.NaN)).toBeNull();
        expect(itemImageProxyUrl(1.5)).toBeNull();
    });

    it("convertit un **nom nu** en URL de proxy (cause racine du 404 /marche/25757.webp)", () => {
        expect(normalizeItemIconUrl("25757.webp", 25757)).toBe(
            `${DOFUS_ITEM_IMAGE_PROXY_BASE}/25757`
        );
        expect(normalizeItemIconUrl("25757.png", null)).toBe(
            `${DOFUS_ITEM_IMAGE_PROXY_BASE}/25757`
        );
    });

    it("remplace le chemin statique local par le proxy (jamais de 404 si non siphonné)", () => {
        expect(normalizeItemIconUrl("/uploads/assets-dofus/items/7225.webp", 7225)).toBe(
            `${DOFUS_ITEM_IMAGE_PROXY_BASE}/7225`
        );
        expect(normalizeItemIconUrl("/uploads/assets-dofus/items/7225.webp", null)).toBe(
            `${DOFUS_ITEM_IMAGE_PROXY_BASE}/7225`
        );
    });

    it("ramène les images DofusDB sur notre proxy (siphon local, 0 réseau au rendu)", () => {
        expect(
            normalizeItemIconUrl("https://api.dofusdb.fr/img/items/14091.png", 14091)
        ).toBe(`${DOFUS_ITEM_IMAGE_PROXY_BASE}/14091`);
    });

    it("conserve une URL absolue déjà servie (jamais de réécriture hasardeuse)", () => {
        expect(normalizeItemIconUrl("https://cdn.example.com/img/a.png", 12)).toBe(
            "https://cdn.example.com/img/a.png"
        );
    });

    it("retombe sur l'id Ankama pour une valeur vide / `undefined.png`", () => {
        expect(normalizeItemIconUrl("", 42)).toBe(`${DOFUS_ITEM_IMAGE_PROXY_BASE}/42`);
        expect(normalizeItemIconUrl("   ", 42)).toBe(`${DOFUS_ITEM_IMAGE_PROXY_BASE}/42`);
        expect(normalizeItemIconUrl("undefined.png", 42)).toBe(
            `${DOFUS_ITEM_IMAGE_PROXY_BASE}/42`
        );
        expect(normalizeItemIconUrl(null, 42)).toBe(`${DOFUS_ITEM_IMAGE_PROXY_BASE}/42`);
        expect(normalizeItemIconUrl("undefined.png", null)).toBeNull();
    });
});
