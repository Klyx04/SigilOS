import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { normSearch, parisCivilDate, parseAlmanaxDateInput, frenchLongDate } from "@/lib/slash-command-helpers";
import { SLASH_COMMANDS_CATALOG, parseValiderRecrueConfig } from "@/lib/slash-commands-catalog";

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
        for (const option of ['"membre"', '"pseudo-dofus"', '"tag-ankama"', '"recruteur"', '"arrivee"', '"ajouter-role"', '"retirer-role"']) {
            expect(sync).toContain(option);
        }
        const route = readFileSync("src/app/api/discord/interactions/route.ts", "utf8");
        expect(route).toContain('commandName === "valider-recrue"');
        expect(route).toContain("PERMISSION_IDS.STAFF_MEMBER_MGMT");
        expect(route).toContain("addGuildMemberRole");
        expect(route).toContain("removeGuildMemberRole");
        expect(route).toContain("trialValidated");
        expect(route).not.toContain("CANDIDATE");
    });

    it("parseValiderRecrueConfig est fail-closed (IDs uniquement)", () => {
        expect(parseValiderRecrueConfig(null)).toEqual({ addRoleId: null, removeRoleId: null });
        expect(parseValiderRecrueConfig("Membres")).toEqual({ addRoleId: null, removeRoleId: null });
        expect(parseValiderRecrueConfig({ addRoleId: "123456789012345678", removeRoleId: "@everyone" })).toEqual({
            addRoleId: "123456789012345678",
            removeRoleId: null,
        });
    });

    it("les étiquettes de cycle de vie ont disparu du nouveau code", () => {
        for (const file of [
            "src/lib/member-registry.ts",
            "src/components/admin/members/member-registry-table.tsx",
            "src/server/actions/member-lifecycle-actions.ts",
        ]) {
            const content = readFileSync(file, "utf8");
            expect(content).not.toContain("CANDIDATE");
            expect(content).not.toContain("ARRIVING");
            expect(content).not.toContain("CONFIRMED");
        }
    });

    it("/profil enrichi : succès, métiers 200, activités, mules, légendaire, planning, sans niveau", () => {
        const route = readFileSync("src/app/api/discord/interactions/route.ts", "utf8");
        expect(route).toContain('name: "Points de Succès"');
        expect(route).toContain("successPointsDisplay");
        expect(route).toContain("metiers200");
        expect(route).toContain('name: "Activités appréciées"');
        expect(route).toContain('name: "Craft Légendaire"');
        expect(route).toContain('name: "Planning de la semaine"');
        expect(route).toContain('"pas renseigné"');
        // Niveau retiré des fields
        expect(route).not.toContain('{ name: "Niveau"');
    });

    it("/metiers pointe vers l'annuaire des membres (/members) et non annuaire-hub", () => {
        const route = readFileSync("src/app/api/discord/interactions/route.ts", "utf8");
        expect(route).toContain('url: `${appBaseUrl}/dashboard/${guild_id}/members`');
        expect(route).not.toContain("annuaire-hub");
    });
});

