import { describe, it, expect } from "vitest";
import {
    resolveDofusImageUrl,
    resolveDofusAssetImageUrl,
    internalDofusDbImageUrl,
    normalizeDofusAssetStoredUrl,
    isSafeDofusImageSrc,
} from "@/lib/dofus-image-url";

describe("resolveDofusImageUrl (#206 Dofoobz)", () => {
    it("sert l'asset local pour le slug dofoozbz, quel que soit l'imageUrl en base", () => {
        // Base existante : l'imageUrl dofusdb (cassée) doit être remplacée par le local.
        expect(resolveDofusImageUrl("dofoozbz", "https://api.dofusdb.fr/img/items/31794.png")).toBe(
            "/module-dofus/Dofus_Dofoozbz.png"
        );
        // Même si la base a déjà l'URL locale, on la laisse telle quelle (idempotent).
        expect(resolveDofusImageUrl("dofoozbz", "/module-dofus/Dofus_Dofoozbz.png")).toBe(
            "/module-dofus/Dofus_Dofoozbz.png"
        );
        // slug null ne doit pas crasher.
        expect(resolveDofusImageUrl(null, "https://api.dofusdb.fr/img/items/23002.png")).toBe(
            "https://api.dofusdb.fr/img/items/23002.png"
        );
    });

    it("sert l'asset LOCAL pour un Dofus canonique, quelle que soit l'imageUrl en base (plus de dofusdb.fr)", () => {
        // Dofus canonique → icône locale, même si la base pointe vers dofusdb.
        expect(resolveDofusImageUrl("emeraude", "https://api.dofusdb.fr/img/items/23002.png", "Émeraude")).toBe(
            "/module-dofus/Dofus_Emeraude.png"
        );
        expect(resolveDofusImageUrl("emeraude", "https://api.dofusdb.fr/img/items/23002.png")).toBe(
            "/module-dofus/Dofus_Emeraude.png"
        );
        // Cas d'un Dofus dont le nom court nécessite un alias (Glaces / Scintillant / Veilleurs).
        expect(resolveDofusImageUrl("des-glaces", "https://api.dofusdb.fr/img/items/2303.png", "Glaces")).toBe(
            "/module-dofus/Dofus_Des_Glaces.png"
        );
        expect(resolveDofusImageUrl("argente-scintillant", "https://api.dofusdb.fr/img/items/2304.png", "Scintillant")).toBe(
            "/module-dofus/Dofus_Argente_Scintillant.png"
        );
        expect(resolveDofusImageUrl("veilleur", "https://api.dofusdb.fr/img/items/2305.png", "Veilleurs")).toBe(
            "/module-dofus/Dofus_Veilleur.png"
        );
        // Dofus sans préfixe « Dofus_ » (Dokille / Dom de Pin).
        expect(resolveDofusImageUrl("dokille", "https://api.dofusdb.fr/img/items/2306.png", "Dokille")).toBe(
            "/module-dofus/Dokille.png"
        );
        expect(resolveDofusImageUrl("dom-de-pin", "https://api.dofusdb.fr/img/items/2307.png", "Dom de Pin")).toBe(
            "/module-dofus/Dom_De_Pin.png"
        );
    });

    it("retombe sur l'imageUrl d'origine pour un Dofus inconnu / custom (pas d'asset local)", () => {
        const external = "https://dofusdb.fr/img/items/9999.png";
        expect(resolveDofusImageUrl("dofus-custom", external, "Dofus Mystère")).toBe(external);
        expect(resolveDofusImageUrl("dofus-custom", external)).toBe(external);
    });

    it("renvoie null quand imageUrl est null/undefined pour un Dofus inconnu", () => {
        expect(resolveDofusImageUrl("dofus-custom", null, "Dofus Mystère")).toBeNull();
        expect(resolveDofusImageUrl("dofus-custom", undefined, "Dofus Mystère")).toBeNull();
    });
});

describe("resolveDofusAssetImageUrl / internalDofusDbImageUrl — zéro hotlink DofusDB (#icônes de sorts)", () => {
    // Cas réel (18/09/2026) : `spell.imageUrl` stocké en base est une URL ABSOLUE DofusDB
    // (`https://api.dofusdb.fr/img/spells/sort_12160.png`) → 57 requêtes navigateur vers
    // DofusDB depuis l'onglet « Sorts » de la modale de build.
    const SPELL_DB_URL = "https://api.dofusdb.fr/img/spells/sort_12160.png";

    it("réécrit une icône de sort DofusDB vers le proxy interne (siphon disque)", () => {
        expect(resolveDofusAssetImageUrl("spells", 12160, SPELL_DB_URL)).toBe(
            `/api/assets-dofus/spells/12160?url=${encodeURIComponent(SPELL_DB_URL)}`
        );
    });

    it("privilégie l'id fourni (clé du cache disque) sur l'id d'icône de l'URL", () => {
        // L'id du sort (ex. 4) ≠ l'id d'icône (12160) : le siphon enregistre
        // `spells/{idDuSort}.webp` → c'est cet id qui doit servir de clé de chemin.
        const url = resolveDofusAssetImageUrl("spells", 4, SPELL_DB_URL);
        expect(url).toContain("/api/assets-dofus/spells/4?url=");
        expect(url).toContain(encodeURIComponent(SPELL_DB_URL));
    });

    it("retombe sur l'id extrait de l'URL quand l'appelant n'en fournit aucun", () => {
        expect(internalDofusDbImageUrl(SPELL_DB_URL)).toBe(
            `/api/assets-dofus/spells/12160?url=${encodeURIComponent(SPELL_DB_URL)}`
        );
        expect(internalDofusDbImageUrl("https://api.dofusdb.fr/img/monsters/1234.png")).toContain("/api/assets-dofus/monsters/1234?url=");
        expect(internalDofusDbImageUrl("https://api.dofusdb.fr/img/items/9143.png")).toContain("/api/assets-dofus/items/9143?url=");
        // Hôte `static.dofusdb.fr` : réécrit aussi, mais SANS `?url=` (non allowlisté par le proxy).
        expect(internalDofusDbImageUrl("https://static.dofusdb.fr/img/spells/sort_7.png")).toBe("/api/assets-dofus/spells/7");
    });

    it("n'envoie JAMAIS d'URL d'un hôte non allowlisté au proxy (SSRF fail-closed)", () => {
        expect(resolveDofusAssetImageUrl("spells", 12, "https://evil.example.com/img/spells/12.png")).toBe(
            "/api/assets-dofus/spells/12"
        );
        expect(resolveDofusAssetImageUrl("monsters", 12, "https://evildofusdb.fr/img/monsters/12.png")).toBe(
            "/api/assets-dofus/monsters/12"
        );
        expect(internalDofusDbImageUrl("https://evil.example.com/img/spells/12.png")).toBeNull();
        expect(internalDofusDbImageUrl("http://api.dofusdb.fr/img/spells/sort_12.png")).toBeNull(); // HTTPS only
    });

    it("renvoie null (⇒ repli de l'appelant) sans id ni URL DofusDB exploitable", () => {
        expect(resolveDofusAssetImageUrl("spells")).toBeNull();
        expect(resolveDofusAssetImageUrl("spells", null, "/uploads/assets-dofus/spells/4.webp")).toBeNull();
        expect(resolveDofusAssetImageUrl("items", "  ")).toBeNull();
        expect(internalDofusDbImageUrl("/uploads/assets-dofus/spells/4.webp")).toBeNull();
        expect(internalDofusDbImageUrl("https://api.dofusdb.fr/spells/4?lang=fr")).toBeNull(); // API, pas une icône
        expect(internalDofusDbImageUrl(null)).toBeNull();
        expect(internalDofusDbImageUrl(undefined)).toBeNull();
    });

    it("laisse une URL (interne) sans paramètre inutile", () => {
        expect(resolveDofusAssetImageUrl("items", "9143")).toBe("/api/assets-dofus/items/9143");
        expect(resolveDofusAssetImageUrl("monsters", 1234, null)).toBe("/api/assets-dofus/monsters/1234");
    });
});

describe("normalizeDofusAssetStoredUrl — un chemin STOCKÉ n'est jamais rendu brut", () => {
    // 🐛 Mesure beta du 27/09/2026 (page God « Avis de recherche », portraits KO) : la valeur
    // en base `/uploads/assets-dofus/monsters/4834.webp` renvoyait **404** ; le MÊME fichier via
    // le proxy (`/api/uploads/assets-dofus/monsters/4834.webp`) renvoyait **200**, et le chemin
    // brut passait à 200 seulement APRÈS un passage par le proxy (c'est lui qui siphonne).
    const STORED = "/uploads/assets-dofus/monsters/4834.webp";

    it("réécrit le chemin legacy du cache disque vers le proxy (id extrait du chemin)", () => {
        expect(normalizeDofusAssetStoredUrl("monsters", STORED)).toBe("/api/assets-dofus/monsters/4834");
        expect(normalizeDofusAssetStoredUrl("monsters", "/uploads/assets-dofus/monsters/4834.png")).toBe(
            "/api/assets-dofus/monsters/4834"
        );
    });

    it("l'id du chemin fait foi (c'est lui qui nomme le fichier siphonné)", () => {
        // Une ligne dont `dofusdbId` divergerait affiche l'image réellement déclarée.
        expect(normalizeDofusAssetStoredUrl("monsters", STORED, 9999)).toBe("/api/assets-dofus/monsters/4834");
    });

    it("idempotent : une URL déjà canonique n'est pas retouchée", () => {
        expect(normalizeDofusAssetStoredUrl("monsters", "/api/assets-dofus/monsters/4834")).toBe(
            "/api/assets-dofus/monsters/4834"
        );
        // URL de proxy d'un AUTRE type : conservée telle quelle (on ne ment pas sur l'asset servi).
        expect(normalizeDofusAssetStoredUrl("monsters", "/api/assets-dofus/spells/4")).toBe(
            "/api/assets-dofus/spells/4"
        );
    });

    it("ne sert pas l'asset d'un autre type sous cette route", () => {
        expect(normalizeDofusAssetStoredUrl("monsters", "/uploads/assets-dofus/spells/4.webp")).toBe(
            "/uploads/assets-dofus/spells/4.webp"
        );
    });

    it("vide ⇒ proxy depuis l'id ; sans id ni URL exploitables ⇒ null (repli de l'appelant)", () => {
        expect(normalizeDofusAssetStoredUrl("monsters", null, 4834)).toBe("/api/assets-dofus/monsters/4834");
        expect(normalizeDofusAssetStoredUrl("monsters", "   ", "5684")).toBe("/api/assets-dofus/monsters/5684");
        expect(normalizeDofusAssetStoredUrl("monsters", null)).toBeNull();
        expect(normalizeDofusAssetStoredUrl("monsters", "/uploads/assets-dofus/monsters/abc.webp")).toBe(
            "/uploads/assets-dofus/monsters/abc.webp"
        );
    });

    it("URL absolue : DofusDB ⇒ proxy interne ; tout autre hôte ⇒ jamais publié (repli canonique)", () => {
        const DB = "https://api.dofusdb.fr/img/monsters/4834.png";
        expect(normalizeDofusAssetStoredUrl("monsters", DB)).toBe(
            `/api/assets-dofus/monsters/4834?url=${encodeURIComponent(DB)}`
        );
        // CDN officiel Ankama (static.ankama.com) : extrait l'id et réécrit vers le proxy interne
        const ANKAMA_URL = "https://static.ankama.com/dofus/www/game/monsters/4744.png";
        expect(normalizeDofusAssetStoredUrl("monsters", ANKAMA_URL)).toBe("/api/assets-dofus/monsters/4744");
        // ⚠️ Un hôte arbitraire ne sort JAMAIS de cette fonction : la donnée stockée ne doit pas
        // pouvoir désigner une origine tierce (alerte CodeQL `js/xss-through-dom`).
        expect(normalizeDofusAssetStoredUrl("monsters", "https://cdn.exemple.fr/monstre.png", 4834)).toBe(
            "/api/assets-dofus/monsters/4834"
        );
        expect(normalizeDofusAssetStoredUrl("monsters", "https://cdn.exemple.fr/monstre.png")).toBeNull();
    });

    it("nom nu ⇒ proxy ; chemin local accepté seulement dans NOS dossiers (allowlist)", () => {
        expect(normalizeDofusAssetStoredUrl("monsters", "4834.webp")).toBe("/api/assets-dofus/monsters/4834");
        expect(normalizeDofusAssetStoredUrl("monsters", "/game-data/bounties/avis-4834.webp")).toBe(
            "/game-data/bounties/avis-4834.webp"
        );
        expect(normalizeDofusAssetStoredUrl("monsters", "/uploads/assets-dofus/monsters/4834.webp")).toBe(
            "/api/assets-dofus/monsters/4834"
        );
        // Un asset local qui n'est PAS le cache d'assets (guides, icônes du jeu) passe tel quel :
        expect(normalizeDofusAssetStoredUrl("monsters", "/uploads/guides/mon-guide.webp")).toBe(
            "/uploads/guides/mon-guide.webp"
        );
        expect(normalizeDofusAssetStoredUrl("monsters", "/assets/dofus/icons/boss.png")).toBe(
            "/assets/dofus/icons/boss.png"
        );
        // Hors de nos dossiers : repli canonique (ou null sans identifiant), jamais la valeur brute.
        expect(normalizeDofusAssetStoredUrl("monsters", "/autre/chemin.png", 4834)).toBe(
            "/api/assets-dofus/monsters/4834"
        );
        expect(normalizeDofusAssetStoredUrl("monsters", "/autre/chemin.png")).toBeNull();
    });
});

describe("isSafeDofusImageSrc — rien d'arbitraire ne part dans une URL du DOM", () => {
    it("accepte nos chemins internes et DofusDB", () => {
        expect(isSafeDofusImageSrc("/api/assets-dofus/monsters/4834")).toBe(true);
        expect(isSafeDofusImageSrc("/game-data/bounties/avis.webp")).toBe(true);
        expect(isSafeDofusImageSrc("/uploads/assets-dofus/items/9143.webp")).toBe(true);
        expect(isSafeDofusImageSrc("/api/assets-dofus/spells/4?url=https%3A%2F%2Fapi.dofusdb.fr%2Fx.png")).toBe(true);
        expect(isSafeDofusImageSrc("https://api.dofusdb.fr/img/monsters/1583.png")).toBe(true);
    });

    it("refuse le reste (protocole, hôte non allowlisté, données, chaîne vide)", () => {
        expect(isSafeDofusImageSrc("//evil.example.com/x.png")).toBe(false);
        expect(isSafeDofusImageSrc("https://evil.example.com/x.png")).toBe(false);
        expect(isSafeDofusImageSrc("http://api.dofusdb.fr/img/monsters/1.png")).toBe(false); // HTTPS only
        expect(isSafeDofusImageSrc("javascript:alert(1)")).toBe(false);
        expect(isSafeDofusImageSrc("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBe(false);
        expect(isSafeDofusImageSrc("25757.webp")).toBe(false); // nom nu : jamais posé brut
        expect(isSafeDofusImageSrc("")).toBe(false);
        expect(isSafeDofusImageSrc(null)).toBe(false);
    });
});

