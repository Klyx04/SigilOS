import { describe, it, expect } from "vitest";
import { resolveDofusClassId } from "@/lib/dofus-assets";

/**
 * `UserProfile.classe` stocke un **libellé** (« Féca », « sram » — mesuré en base le
 * 27/10/2026) alors que `GuideSequence.classReq` et la route du guide comparent des **ids**
 * (`feca`). Ce résolveur est le seul passage autorisé entre les deux : sans lui, brancher
 * `playerClass` sur la route masquerait toutes les quêtes de classe (fail-closed).
 */
describe("resolveDofusClassId — libellé OU id → id stable", () => {
    it("accepte un id, un libellé accentué et n'importe quelle casse", () => {
        expect(resolveDofusClassId("feca")).toBe("feca");
        expect(resolveDofusClassId("Féca")).toBe("feca");
        expect(resolveDofusClassId("FECA")).toBe("feca");
        expect(resolveDofusClassId("sram")).toBe("sram");
        expect(resolveDofusClassId("Xélor")).toBe("xelor");
        expect(resolveDofusClassId("Écaflip")).toBe("ecaflip");
        expect(resolveDofusClassId(" forgelance ")).toBe("forgelance");
    });

    it("refuse une valeur vide ou inconnue", () => {
        expect(resolveDofusClassId(null)).toBeNull();
        expect(resolveDofusClassId(undefined)).toBeNull();
        expect(resolveDofusClassId("   ")).toBeNull();
        expect(resolveDofusClassId("pirate")).toBeNull();
    });
});
