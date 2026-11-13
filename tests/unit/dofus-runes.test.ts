import { describe, it, expect } from "vitest";
import { getRuneForStat } from "@/lib/dofus-runes";

describe("getRuneForStat", () => {
    it("associe correctement les exos majeurs", () => {
        const pa = getRuneForStat("PA", 1);
        expect(pa.runeName).toBe("Rune Ga Pa");
        expect(pa.isExo).toBe(true);
        expect(pa.assetUrl).toBe("/images/guides/fm/rune_ga_pa.png");

        const pm = getRuneForStat("PM", 1);
        expect(pm.runeName).toBe("Rune Ga Pme");
        expect(pm.isExo).toBe(true);
        expect(pm.assetUrl).toBe("/images/guides/fm/rune_ga_pme.png");

        const po = getRuneForStat("Portée", 1);
        expect(po.runeName).toBe("Rune Po");
        expect(po.isExo).toBe(true);
    });

    it("associe les pourcentages de dommages comme exos avec rune_do_per.png", () => {
        const doSorts = getRuneForStat("% Do Sorts", 1);
        expect(doSorts.runeName).toBe("Rune Do Sort");
        expect(doSorts.assetUrl).toBe("/images/guides/fm/rune_do_per.png");
        expect(doSorts.isExo).toBe(true);

        const doDist = getRuneForStat("% Do Dist.", 1);
        expect(doDist.runeName).toBe("Rune Do Dist");
        expect(doDist.assetUrl).toBe("/images/guides/fm/rune_do_per.png");
    });

    it("associe les dommages critiques et caractéristiques", () => {
        const doCrit = getRuneForStat("Do Crit.", 8);
        expect(doCrit.runeName).toBe("Rune Pa Do Crit");
        expect(doCrit.assetUrl).toBe("/images/guides/fm/rune_do_cri_pou.png");

        const vita = getRuneForStat("Vitalité", 150);
        expect(vita.runeName).toBe("Rune Ra Vi");
        expect(vita.assetUrl).toBe("/images/guides/fm/rune_ra_vi.png");
    });
});
