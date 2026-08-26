import { describe, it, expect } from "vitest";
import { resolveDofusImageUrl } from "@/lib/dofus-image-url";

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
