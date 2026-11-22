import { describe, expect, it } from "vitest";
import { resolveOverlayLayout } from "@/lib/rush-overlay-layout";

/**
 * Garde du palier de densité de l'overlay Rush.
 *
 * Bug mesuré le 22/11/2026 : `h >= 900` passait avant `w < 580`, donc une PiP
 * de 400 × 1000 était classée `wide` alors qu'elle était `small`. Les commentaires
 * annonçaient 820 px, le code utilisait 900.
 */
describe("overlay Rush — paliers de densité", () => {
    it("une PiP étroite reste tight même si elle est haute", () => {
        expect(resolveOverlayLayout(400, 1000)).toEqual({ small: true, density: "tight" });
        expect(resolveOverlayLayout(579, 1000)).toEqual({ small: true, density: "tight" });
    });

    it("une fenêtre basse reste tight même si elle est large", () => {
        expect(resolveOverlayLayout(1200, 639)).toEqual({ small: true, density: "tight" });
    });

    it("wide à partir de 820 px de haut quand la fenêtre n'est pas étroite", () => {
        expect(resolveOverlayLayout(1000, 819)).toEqual({ small: false, density: "normal" });
        expect(resolveOverlayLayout(1000, 820)).toEqual({ small: false, density: "wide" });
    });

    it("les seuils exacts restent normal", () => {
        expect(resolveOverlayLayout(580, 640)).toEqual({ small: false, density: "normal" });
    });
});
