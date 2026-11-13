import { describe, it, expect } from "vitest";
import { getClass, resolveDofusClassId } from "@/lib/dofus-assets";

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

/**
 * `getClass` est le **seul** point d'affichage de la classe (fiche membre, fiche boss, profil).
 *
 * Défaut mesuré le 30/10/2026 : deux membres dont la base portait `Feca` / `FECA` (libellés écrits
 * par la synchro ladder) voyaient « Identité de combat — Profil non configuré », alors que pseudo
 * ET classe étaient bien enregistrés. La carte n'affiche l'identité que si `getClass(classe)`
 * trouve la classe ; l'ancienne comparaison était sensible à la casse sur l'id et à l'accent sur
 * le nom, donc `Feca` ne correspondait à rien.
 */
describe("getClass — libellé ladder accepté (sinon l'identité paraît vide)", () => {
    const feca = getClass("feca");

    it("accepte l'id, le libellé accentué et toutes les casses", () => {
        for (const value of ["feca", "Feca", "FECA", "Féca", "FÉCA", " feca "]) {
            expect(getClass(value)?.id, value).toBe("feca");
        }
        expect(getClass("Feca")?.name).toBe(feca?.name);
    });

    it("accepte aussi les autres classes accentuées", () => {
        expect(getClass("Xélor")?.id).toBe("xelor");
        expect(getClass("écaflip")?.id).toBe("ecaflip");
        expect(getClass("Sram")?.id).toBe("sram");
    });

    it("refuse une valeur vide ou inconnue (aucune classe inventée)", () => {
        expect(getClass("")).toBeUndefined();
        expect(getClass("pirate")).toBeUndefined();
    });
});
