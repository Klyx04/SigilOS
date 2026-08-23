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

    it("laisse intactes les URLs des autres Dofus", () => {
        expect(resolveDofusImageUrl("emeraude", "https://api.dofusdb.fr/img/items/23002.png")).toBe(
            "https://api.dofusdb.fr/img/items/23002.png"
        );
        expect(resolveDofusImageUrl("emeraude", "/module-dofus/Dofus_Emeraude.png")).toBe(
            "/module-dofus/Dofus_Emeraude.png"
        );
    });

    it("renvoie null quand imageUrl est null/undefined (hors dofoozbz)", () => {
        expect(resolveDofusImageUrl("emeraude", null)).toBeNull();
        expect(resolveDofusImageUrl("emeraude", undefined)).toBeNull();
    });
});
