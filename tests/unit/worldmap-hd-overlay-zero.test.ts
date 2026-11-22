import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Overlay HD de la worldmap — `(0,0)` d'un sous-monde.
 *
 * La carte `201588736` de Blessures de Guerre (monde 24) est à `(0,0)` et
 * couverte par un HD ; l'overlay l'excluait en dur (`m.x === 0 && m.y === 0`),
 * alors que DofusDB la sélectionne. Il doit passer par la règle partagée.
 */
const OVERLAY = "src/components/worldmap/map-hd-overlay.tsx";

describe("overlay HD — (0,0) des sous-mondes", () => {
    it("utilise la règle partagée au lieu d'exclure (0,0) en dur", () => {
        const source = readFileSync(OVERLAY, "utf8");
        expect(source).toContain("hasKnownGameCoords");
        expect(source).not.toMatch(/m\.x === 0 && m\.y === 0/);
    });
});
