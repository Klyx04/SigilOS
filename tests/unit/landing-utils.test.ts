import { describe, it, expect } from "vitest";
import { isPublicLandingLabel } from "@/lib/landing-utils";
import { groupIntoTabs } from "@/components/landing/product-story";
import type { PublicLandingScreen } from "@/server/actions/landing-screen-actions";

function screen(id: string, label: string): PublicLandingScreen {
    return { id, label, title: label, description: null, imageUrl: `/shots/${id}.png`, alt: null } as PublicLandingScreen;
}

describe("landing — garde-fou des libellés God", () => {
    it("accepte les vrais libellés", () => {
        expect(isPublicLandingLabel("Guides")).toBe(true);
        expect(isPublicLandingLabel("Sorties & groupes")).toBe(true);
        expect(isPublicLandingLabel("Progression")).toBe(true);
    });

    it("rejette les libellés de test (le bug « test1 » sur la landing)", () => {
        expect(isPublicLandingLabel("test1")).toBe(false);
        expect(isPublicLandingLabel("Test")).toBe(false);
        expect(isPublicLandingLabel("tmp")).toBe(false);
        expect(isPublicLandingLabel("essai")).toBe(false);
        expect(isPublicLandingLabel("draft")).toBe(false);
        expect(isPublicLandingLabel("")).toBe(false);
        expect(isPublicLandingLabel(null)).toBe(false);
        expect(isPublicLandingLabel("ab")).toBe(false);
    });

    it("groupIntoTabs ne sort jamais un onglet de test", () => {
        const tabs = groupIntoTabs([
            screen("1", "Guides"),
            screen("2", "test1"),
            screen("3", "Progression"),
        ]);
        expect(tabs.map((t) => t.label)).toEqual(["Guides", "Progression"]);
    });

    it("groupIntoTabs regroupe toujours par libellé partagé", () => {
        const tabs = groupIntoTabs([screen("1", "Guides"), screen("2", "Guides")]);
        expect(tabs).toHaveLength(1);
        expect(tabs[0].images).toHaveLength(2);
    });
});
