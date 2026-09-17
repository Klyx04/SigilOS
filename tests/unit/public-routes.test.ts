import { describe, it, expect } from "vitest";
import { isPublicRoute } from "@/lib/public-routes";

describe("public-routes — périmètre des pages publiques", () => {
    it("reconnaît la landing et ses pages ouvertes", () => {
        expect(isPublicRoute("/")).toBe(true);
        expect(isPublicRoute("/almanax")).toBe(true);
        expect(isPublicRoute("/boss")).toBe(true);
        expect(isPublicRoute("/boss/quelque-donjon")).toBe(true);
        expect(isPublicRoute("/guilds/ma-guilde")).toBe(true);
        expect(isPublicRoute("/legal/faq")).toBe(true);
        expect(isPublicRoute("/guides/rush-sylvestre")).toBe(true);
    });

    it("ne déborde pas sur les espaces connectés", () => {
        expect(isPublicRoute("/dashboard")).toBe(false);
        expect(isPublicRoute("/dashboard/123/calendar")).toBe(false);
        expect(isPublicRoute("/god")).toBe(false);
        expect(isPublicRoute("/overlay/worldmap")).toBe(false);
        expect(isPublicRoute("/guide")).toBe(false); // piège du préfixe « /guides »
        expect(isPublicRoute(null)).toBe(false);
        expect(isPublicRoute(undefined)).toBe(false);
    });
});
