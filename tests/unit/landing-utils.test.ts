import { describe, it, expect } from "vitest";
import { isPublicLandingLabel, groupPublicScreens, findPublicScreen } from "@/lib/landing-utils";
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

    it("groupPublicScreens ne sort jamais un groupe de test", () => {
        const groups = groupPublicScreens([
            screen("1", "Guides"),
            screen("2", "test1"),
            screen("3", "Progression"),
        ]);
        expect(groups.map((g) => g.label)).toEqual(["Guides", "Progression"]);
    });

    it("groupPublicScreens regroupe toujours par libellé partagé", () => {
        const groups = groupPublicScreens([screen("1", "Guides"), screen("2", "Guides")]);
        expect(groups).toHaveLength(1);
        expect(groups[0].images).toHaveLength(2);
    });

    it("findPublicScreen retient la première capture dont le libellé correspond", () => {
        const screens = [screen("1", "Guides"), screen("2", "Sorties & groupes")];
        expect(findPublicScreen(screens, /sortie|groupe/i)?.id).toBe("2");
        expect(findPublicScreen(screens, /almanax/i)).toBeNull();
    });

    it("findPublicScreen ignore un écran sans image (God en cours d'upload)", () => {
        const broken = { ...screen("9", "Sorties"), imageUrl: "" };
        expect(findPublicScreen([broken], /sorties/i)).toBeNull();
    });
});

