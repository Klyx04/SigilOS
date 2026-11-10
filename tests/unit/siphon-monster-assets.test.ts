/**
 * Gardes — **siphon hors ligne des visuels de monstres** (chantier `souverainete-images`, S1).
 *
 * Mesure du 09/11/2026 : le proxy télécharge encore chez l'amont **au moment de la requête**.
 * Ce lot remplit le cache disque (`<gfx>.sprite.webp`) pour que les vignettes ne dépendent plus
 * d'un service tiers. Les deux espaces d'identifiants ne doivent **jamais** être confondus.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
    MIN_SPRITE_BYTES,
    gfxIdFromDofusDbImageUrl,
    isRemoteSpriteFetchEnabled,
    spriteAssetFileName,
    spriteAssetUrl,
} from "@/lib/dofus-monster-assets";

describe("gfxIdFromDofusDbImageUrl — l'espace apparence", () => {
    it("extrait le gfxId d'une URL de sprite de monstre", () => {
        expect(gfxIdFromDofusDbImageUrl("https://api.dofusdb.fr/img/monsters/646.png")).toBe("646");
        expect(gfxIdFromDofusDbImageUrl("https://api.dofusdb.fr/img/monsters/90.png?x=1")).toBe("90");
        expect(gfxIdFromDofusDbImageUrl("  https://api.dofusdb.fr/img/monsters/12.webp  ")).toBe("12");
    });

    it("refuse tout ce qui n'est pas un sprite de monstre (fail-closed)", () => {
        expect(gfxIdFromDofusDbImageUrl("https://api.dofusdb.fr/img/items/18087.png")).toBeNull();
        expect(gfxIdFromDofusDbImageUrl("https://api.dofusdb.fr/img/monsters/646")).toBeNull();
        expect(gfxIdFromDofusDbImageUrl("/api/assets-dofus/monsters/646")).toBeNull();
        expect(gfxIdFromDofusDbImageUrl(null)).toBeNull();
        expect(gfxIdFromDofusDbImageUrl(undefined)).toBeNull();
    });
});

describe("nom et URL de l'asset apparence", () => {
    it("écrit et sert la MÊME clé que le proxy (`sprite.webp`, espace apparence)", () => {
        expect(spriteAssetFileName(646)).toBe("646.sprite.webp");
        const url = spriteAssetUrl(646);
        expect(url).toContain("/api/assets-dofus/monsters/646");
        expect(url).toContain("sprite=1");
        expect(url).toContain(encodeURIComponent("https://api.dofusdb.fr/img/monsters/646.png"));
    });

    it("le seuil rejette le placeholder du proxy (118 octets), pas une vraie vignette", () => {
        expect(MIN_SPRITE_BYTES).toBeGreaterThan(118);
        expect(MIN_SPRITE_BYTES).toBeLessThan(4096);
    });
});

describe("route cron de siphon — contrat", () => {
    const src = readFileSync(
        path.join(process.cwd(), "src/app/api/cron/siphon-monster-assets/route.ts"),
        "utf8"
    );

    it("fail-closed sur le secret et dry-run par défaut", () => {
        expect(src).toContain("verifyCronSecret(req)");
        expect(src).toContain('searchParams.get("apply") === "1"');
    });

    it("écrit dans l'espace apparence et saute ce qui est déjà là", () => {
        expect(src).toContain("spriteAssetFileName(gfx)");
        expect(src).toContain("MIN_SPRITE_BYTES");
        expect(src).toContain("alreadyThere");
        // Jamais l'ancienne clé d'entité `${id}.webp` : elle servirait une autre créature.
        expect(src).not.toContain("${cleanId}.webp");
    });

    it("couvre TOUS les types de monstres (pas seulement la quête Ocre)", () => {
        // Pour pouvoir couper le téléchargement dans le proxy sans multiplier les pictos, le
        // cache doit contenir tout ce que l'app affiche : archis, boss **et** monstres.
        expect(src).toContain("where: { imageUrl: { not: null } }");
        expect(src).not.toContain('type: { in: ["archimonstre", "boss"] }');
    });
});

/**
 * Mode hybride (rang 61, lot S2) : par défaut le proxy **ne sort plus** pour un sprite.
 * `ASSETS_REMOTE_FETCH=true` rallume le réseau à la main, le temps d'une mise à jour de contenu.
 */
describe("mode hybride — l'interrupteur réseau du proxy", () => {
    it("par défaut, le réseau est coupé (aucune valeur, ou valeur non exacte)", () => {
        expect(isRemoteSpriteFetchEnabled({})).toBe(false);
        expect(isRemoteSpriteFetchEnabled({ ASSETS_REMOTE_FETCH: "" })).toBe(false);
        expect(isRemoteSpriteFetchEnabled({ ASSETS_REMOTE_FETCH: "1" })).toBe(false);
        expect(isRemoteSpriteFetchEnabled({ ASSETS_REMOTE_FETCH: "TRUE" })).toBe(false);
        expect(isRemoteSpriteFetchEnabled({ ASSETS_REMOTE_FETCH: "yes" })).toBe(false);
    });

    it("seule la valeur exacte `true` rallume le réseau", () => {
        expect(isRemoteSpriteFetchEnabled({ ASSETS_REMOTE_FETCH: "true" })).toBe(true);
    });

    it("la route sert le fichier siphonné AVANT de consulter l'interrupteur", () => {
        const route = readFileSync(
            path.join(process.cwd(), "src/app/api/assets-dofus/[type]/[id]/route.ts"),
            "utf8"
        );
        const serveLocal = route.indexOf("if (fs.existsSync(localFilePath))");
        const gate = route.indexOf("if (!isRemoteSpriteFetchEnabled())");
        expect(serveLocal).toBeGreaterThan(-1);
        expect(gate).toBeGreaterThan(serveLocal);
    });
});
