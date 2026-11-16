/**
 * D2 — les deux rangs du profil, nommés sans ambiguïté.
 *
 * `rank` = rang **Ankama** (worker Ladder) ; `guildRank` = rang **interne SigilOS**
 * (`getLadderPreview`, membres actifs avec plus de points + 1). Le brief du 16/11/2026
 * interdit de les appeler « Monde » / « Guilde ».
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    INTERNAL_RANK_HINT,
    INTERNAL_RANK_LABEL,
    SUCCESS_RANK_HINT,
    SUCCESS_RANK_LABEL,
    formatRankOrdinal,
} from "@/lib/ladder-rank";

const read = (path: string) => readFileSync(path, "utf8");
const SYNC = "src/components/profile/success-sync.tsx";

describe("rangs du profil — libellés et format", () => {
    it("affiche un ordinal français borné, jamais un # orphelin", () => {
        expect(formatRankOrdinal(364)).toBe("364ᵉ");
        expect(formatRankOrdinal(1234)).toBe(`1\u202F234ᵉ`);
        expect(formatRankOrdinal(1)).toBe("1ᵉʳ");
        // Absent, nul, non fini ou négatif : tiret, pas « #undefined ».
        expect(formatRankOrdinal(null)).toBe("—");
        expect(formatRankOrdinal(undefined)).toBe("—");
        expect(formatRankOrdinal(0)).toBe("—");
        expect(formatRankOrdinal(Number.NaN)).toBe("—");
        expect(formatRankOrdinal(Number.POSITIVE_INFINITY)).toBe("—");
        expect(formatRankOrdinal(-3)).toBe("—");
    });

    it("nomme les deux rangs sans ambiguïté", () => {
        expect(SUCCESS_RANK_LABEL).toBe("Rang succès");
        expect(INTERNAL_RANK_LABEL).toBe("Rang interne");
        expect(SUCCESS_RANK_HINT).toBe("Rang au classement des succès Ankama");
        expect(INTERNAL_RANK_HINT).toContain("Classement interne SigilOS");
        expect(INTERNAL_RANK_HINT).toContain("fraîcheur des points");
    });

    it("le composant de synchronisation utilise la règle, pas des libellés trompeurs", () => {
        const code = read(SYNC);
        expect(code).toContain('from "@/lib/ladder-rank"');
        for (const symbol of [
            "formatRankOrdinal",
            "SUCCESS_RANK_LABEL",
            "SUCCESS_RANK_HINT",
            "INTERNAL_RANK_LABEL",
            "INTERNAL_RANK_HINT",
        ]) {
            expect(code, symbol).toContain(symbol);
        }
        expect(code).toContain("{formatRankOrdinal(previewData.rank)}");
        expect(code).toContain("{formatRankOrdinal(previewData.guildRank)}");
        // Plus de libellés trompeurs ni de dièse seul devant le rang.
        expect(code).not.toMatch(/>Monde</);
        expect(code).not.toMatch(/>Guilde</);
        expect(code).not.toContain("`#${previewData.rank");
        expect(code).not.toContain("#{previewData.guildRank");
    });
});
