import { describe, it, expect } from "vitest";
import { normalizeLadderQuery, matchLadderSearch, applyLadderSearch } from "@/lib/ladder-utils";

describe("ladder search — normalisation", () => {
    it("neutralise casse, accents, tirets et espaces", () => {
        expect(normalizeLadderQuery("Twoda-Jr")).toBe("twodajr");
        expect(normalizeLadderQuery("  Twoda Jr  ")).toBe("twodajr");
        expect(normalizeLadderQuery("Élève")).toBe("eleve");
        expect(normalizeLadderQuery("Raizow")).toBe("raizow");
        expect(normalizeLadderQuery("")).toBe("");
    });

    it("matche pseudo Discord ou pseudo Dofus, champs nulls tolérés", () => {
        const entry = { discordNickname: "Raizow", pseudoDofus: "Twoda-Jr" };
        expect(matchLadderSearch(entry, "raizow")).toBe(true);
        expect(matchLadderSearch(entry, "twoda jr")).toBe(true);
        expect(matchLadderSearch(entry, "TWODA-JR")).toBe(true);
        expect(matchLadderSearch(entry, "twodaj")).toBe(true);
        expect(matchLadderSearch(entry, "inconnu")).toBe(false);
        expect(matchLadderSearch(entry, "")).toBe(true);
        expect(matchLadderSearch({ discordNickname: null, pseudoDofus: null }, "x")).toBe(false);
    });

    it("filtre une liste complète (pas seulement la page courante)", () => {
        const entries = [
            { discordNickname: "Raizow", pseudoDofus: "Twoda-Jr" },
            { discordNickname: "Élève dissipé", pseudoDofus: null },
            { discordNickname: "Maxiie", pseudoDofus: "Maxiie" },
        ];
        expect(applyLadderSearch(entries, "eleve")).toHaveLength(1);
        expect(applyLadderSearch(entries, "maxiie")).toHaveLength(1);
        expect(applyLadderSearch(entries, "")).toHaveLength(3);
        expect(applyLadderSearch(entries, "   ")).toHaveLength(3);
        // ne mute pas l'entrée
        expect(entries).toHaveLength(3);
    });
});
