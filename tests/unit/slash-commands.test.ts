import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { normSearch, parisCivilDate, parseAlmanaxDateInput, frenchLongDate } from "@/lib/slash-command-helpers";
import { SLASH_COMMANDS_CATALOG } from "@/lib/slash-commands-catalog";

describe("slash-command-helpers", () => {
    it("normSearch neutralise casse et accents", () => {
        expect(normSearch("Bûcheron")).toBe("bucheron");
        expect(normSearch("  Façonneur ")).toBe("faconneur");
        expect(normSearch("FORGEMAGE")).toBe("forgemage");
    });

    it("parseAlmanaxDateInput accepte JJ/MM/AAAA", () => {
        expect(parseAlmanaxDateInput("09/09/2026")).toBe("2026-09-09");
        expect(parseAlmanaxDateInput("9/9/2026")).toBe("2026-09-09");
        // Année omise → année courante (Paris).
        const year = parisCivilDate(new Date(2026, 4, 1)).slice(0, 4);
        expect(parseAlmanaxDateInput("01/05", new Date(2026, 4, 1))).toBe(`${year}-05-01`);
    });

    it("parseAlmanaxDateInput rejette les dates impossibles", () => {
        expect(parseAlmanaxDateInput("31/02/2026")).toBeNull();
        expect(parseAlmanaxDateInput("13/13/2026")).toBeNull();
        expect(parseAlmanaxDateInput("demain")).toBeNull();
    });

    it("parseAlmanaxDateInput vide = aujourd'hui (défaut)", () => {
        expect(parseAlmanaxDateInput("", new Date(2026, 8, 7, 12))).toBe("2026-09-07");
        expect(parseAlmanaxDateInput(null, new Date(2026, 8, 7, 12))).toBe("2026-09-07");
    });

    it("parseAlmanaxDateInput sans entrée = aujourd'hui (Paris)", () => {
        expect(parseAlmanaxDateInput(undefined, new Date(2026, 8, 7, 12))).toBe("2026-09-07");
    });

    it("frenchLongDate formate en français", () => {
        expect(frenchLongDate("2026-09-09")).toContain("septembre");
        expect(frenchLongDate("nimporte")).toBe("nimporte");
    });
});

describe("slash commands — périmètre", () => {
    const names = SLASH_COMMANDS_CATALOG.map((c) => c.name);

    it("contient exactement les 6 commandes membres + valider-recrue (staff)", () => {
        expect(names).toEqual(["almanax", "profil", "boss", "monstre", "metiers", "ocre", "valider-recrue"]);
    });

    it("valider-recrue est staffOnly et masquée du guide membres", () => {
        const valider = SLASH_COMMANDS_CATALOG.find((c) => c.name === "valider-recrue");
        expect(valider?.staffOnly).toBe(true);
        expect(valider?.category).toBe("STAFF");
        expect(SLASH_COMMANDS_CATALOG.filter((c) => !c.staffOnly)).toHaveLength(6);
    });

    it("ne contient plus les commandes supprimées", () => {
        for (const dead of ["defi", "dofus", "sorties", "stats", "artisan", "ladder"]) {
            expect(names).not.toContain(dead);
        }
    });

    it("valider-recrue est déployée sur Discord et gardée côté route", () => {
        const sync = readFileSync("src/server/actions/discord-commands-sync.ts", "utf8");
        for (const option of ['"membre"', '"pseudo-dofus"', '"tag-ankama"', '"recruteur"', '"arrivee"']) {
            expect(sync).toContain(option);
        }
        const route = readFileSync("src/app/api/discord/interactions/route.ts", "utf8");
        expect(route).toContain('commandName === "valider-recrue"');
        expect(route).toContain("PERMISSION_IDS.STAFF_MEMBER_MGMT");
    });
});
