import { describe, it, expect } from "vitest";
import { raidOverlayDeeplink } from "@/lib/raid-reminder";

/** Lot 4a — lien overlay du rappel H-1 : jamais inventé, jamais hors raids. */
describe("lot 4a — deeplink overlay du rappel", () => {
    it("gigalodon → /raids?raid=gigalodon, jardin → sanctuaire", () => {
        expect(raidOverlayDeeplink("gigalodon")).toEqual({ param: "gigalodon", label: "Gigalodon" });
        expect(raidOverlayDeeplink("jardin")).toEqual({ param: "sanctuaire", label: "Sanctuaire" });
    });

    it("hors raids / valeurs sales → null (pas de champ overlay)", () => {
        expect(raidOverlayDeeplink("donjon")).toBeNull();
        expect(raidOverlayDeeplink(null)).toBeNull();
        expect(raidOverlayDeeplink(undefined)).toBeNull();
        expect(raidOverlayDeeplink(42)).toBeNull();
        expect(raidOverlayDeeplink("")).toBeNull();
    });
});
