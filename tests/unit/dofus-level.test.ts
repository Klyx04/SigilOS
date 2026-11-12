import { describe, expect, it } from "vitest";

import {
    DOFUS_LEVEL_200_XP,
    formatDofusLevel,
    formatDofusLevelWithBase,
    toTotalDofusLevel,
} from "@/lib/dofus-level";

/**
 * Le ladder renvoie le **niveau Oméga** (128), pas le niveau total (328) : sans cette
 * règle, un Oméga 128 s'affiche « 128 » comme un personnage normal. L'XP totale est le
 * seul signal (cumul du niveau 200 : 4 716 600 000).
 */
describe("niveaux Dofus — Oméga", () => {
    it("garde un niveau normal intact", () => {
        expect(toTotalDofusLevel(128, 0n)).toBe(128);
        expect(toTotalDofusLevel(128, DOFUS_LEVEL_200_XP)).toBe(128);
        expect(toTotalDofusLevel(128, "12 345")).toBe(128);
    });

    it("convertit un niveau Oméga en niveau total à partir de l'XP", () => {
        expect(toTotalDofusLevel(128, 18_441_163_609n)).toBe(328);
        expect(toTotalDofusLevel(199, 18_441_163_609n)).toBe(399);
    });

    it("ne double pas un niveau déjà total", () => {
        expect(toTotalDofusLevel(328, 18_441_163_609n)).toBe(328);
        expect(toTotalDofusLevel(400, 18_441_163_609n)).toBe(400);
    });

    it("laisse le niveau 200 (normal ou Oméga 0) à 200", () => {
        expect(toTotalDofusLevel(200, 18_441_163_609n)).toBe(200);
    });

    it("borne et refuse les valeurs inexploitables", () => {
        expect(toTotalDofusLevel(null, 18_441_163_609n)).toBeNull();
        expect(toTotalDofusLevel(0, 18_441_163_609n)).toBeNull();
        expect(toTotalDofusLevel(401, null)).toBe(400);
    });

    it("accepte l'XP sérialisée des alertes", () => {
        expect(toTotalDofusLevel(128, "18 441 163 609")).toBe(328);
    });

    it("affiche Ω pour un niveau total au-delà de 200", () => {
        expect(formatDofusLevel(128)).toBe("128");
        expect(formatDofusLevel(328)).toBe("Ω 128");
        expect(formatDofusLevel(400)).toBe("Ω 200");
        expect(formatDofusLevel(null)).toBe("—");
        expect(formatDofusLevel(0)).toBe("—");
    });

    it("affiche le total pour les mules", () => {
        expect(formatDofusLevelWithBase(128)).toBe("Niv. 128");
        expect(formatDofusLevelWithBase(328)).toBe("Ω 128 (niv. 328)");
        expect(formatDofusLevelWithBase(null)).toBeNull();
    });
});
