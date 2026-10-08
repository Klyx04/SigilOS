import { describe, expect, it } from "vitest";

import { dungeonFicheHref } from "@/lib/dungeon-fiche";

describe("dungeon-fiche — destination fiche donjon (lot 2a)", () => {
    it("interne : fiche boss du module via deep-link succes", () => {
        expect(dungeonFicheHref("guild-1", { id: "kankreblath" })).toBe(
            "/dashboard/guild-1/succes?dungeon=kankreblath&view=boss",
        );
    });

    it("prefere le slug public a l'id quand les deux existent", () => {
        expect(dungeonFicheHref("guild-1", { id: "123", slug: "kankreblath" })).toBe(
            "/dashboard/guild-1/succes?dungeon=kankreblath&view=boss",
        );
    });

    it("public (sans guilde ou sentinelle) : fiche publique", () => {
        expect(dungeonFicheHref(undefined, { id: "kankreblath" })).toBe("/boss/kankreblath");
        expect(dungeonFicheHref(null, { id: "kankreblath" })).toBe("/boss/kankreblath");
        expect(dungeonFicheHref("", { id: "kankreblath" })).toBe("/boss/kankreblath");
        expect(dungeonFicheHref("public", { slug: "kankreblath" })).toBe("/boss/kankreblath");
    });

    it("null sans segment (jamais d'URL inventee)", () => {
        expect(dungeonFicheHref("guild-1", null)).toBeNull();
        expect(dungeonFicheHref("guild-1", {})).toBeNull();
        expect(dungeonFicheHref("guild-1", { id: "  " })).toBeNull();
    });
});
