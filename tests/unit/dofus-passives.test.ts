import { describe, it, expect } from "vitest";
import { getPassiveDescription } from "@/lib/dofus-passives";

describe("dofus-passives", () => {
    it("returns correct description for Dofus Abyssal", () => {
        const desc = getPassiveDescription("Dofus Abyssal");
        expect(desc).toContain("Au début du tour : confère 1 PM");
    });

    it("returns correct description for Dofus Ivoire", () => {
        const desc = getPassiveDescription("Dofus Ivoire");
        expect(desc).toContain("Réduction des dommages");
    });

    it("returns correct description for Dofus Nébuleux", () => {
        const desc = getPassiveDescription("Dofus Nébuleux");
        expect(desc).toContain("Aux tours impairs : confère 20%");
    });

    it("handles accent differences and case insensitivity", () => {
        const desc = getPassiveDescription("dofus ebene");
        expect(desc).toContain("Ébène");
    });
});
