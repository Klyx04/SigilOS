import { describe, it, expect } from "vitest";
import { getVisibleSettingsNav, SETTINGS_TAB_MODULES } from "@/lib/settings-nav";

/**
 * Refonte settings — la nav suit les modules effectifs (toggle + verrou God).
 * Pur et testé : items sans module = structurels (toujours visibles),
 * groupes vidés = retirés, modules null = tout visible (fail-open affichage ;
 * les pages gardent leurs propres gates).
 */
const GROUPS = [
    { title: "Guilde", items: [{ id: "dofus" }, { id: "annuaire", module: "roster" }] },
    { title: "Par Module", items: [{ id: "missions", module: "missions" }, { id: "metamob", module: "ocre" }] },
];

describe("getVisibleSettingsNav", () => {
    it("laisse tout visible sans état des modules", () => {
        expect(getVisibleSettingsNav(GROUPS, null)).toEqual(GROUPS);
        expect(getVisibleSettingsNav(GROUPS, undefined)).toEqual(GROUPS);
    });

    it("retire les items dont le module est OFF et les groupes vidés", () => {
        const visible = getVisibleSettingsNav(GROUPS, {
            roster: false, missions: false, ocre: true,
        });
        expect(visible.map((g) => g.title)).toEqual(["Guilde", "Par Module"]);
        expect(visible[0].items.map((i) => i.id)).toEqual(["dofus"]);
        expect(visible[1].items.map((i) => i.id)).toEqual(["metamob"]);
    });

    it("retire un groupe entièrement masqué", () => {
        const visible = getVisibleSettingsNav(GROUPS, {
            roster: true, missions: false, ocre: false,
        });
        expect(visible.map((g) => g.title)).toEqual(["Guilde"]);
    });

    it("SETTINGS_TAB_MODULES couvre les onglets liés à un module", () => {
        expect(SETTINGS_TAB_MODULES["missions"]).toBe("missions");
        expect(SETTINGS_TAB_MODULES["metamob"]).toBe("ocre");
        expect(SETTINGS_TAB_MODULES["gallery"]).toBe("gallery");
        expect(SETTINGS_TAB_MODULES["dofus"]).toBeUndefined();
    });
});
