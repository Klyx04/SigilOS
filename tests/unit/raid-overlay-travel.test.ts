import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RAIDS_DATA, RAIDS_DATA_EN } from "@/lib/raid-overlay-data";
import { parseCoordinates } from "@/lib/rush-guide-utils";

/**
 * Positions cliquables de l'overlay raid : toute position écrite dans un texte
 * (crochets `[x, y]` OU commande nue `/travel x,y`) doit être reconnue par le
 * parseur source unique — constat `/travel 2,7` resté en texte brut (Coffre 10k).
 */
describe("overlay raid — positions cliquables", () => {
    it("parse les commandes nues des données (Coffre 10k)", () => {
        for (const raw of ["/travel 2,7", "/travel 3,2", "[6, 10]", "[4, 7]"]) {
            const parsed = parseCoordinates(raw);
            expect(parsed).not.toBeNull();
            expect(parsed?.travelCommand).toMatch(/^\/travel \d+,\d+$/);
        }
        expect(parseCoordinates("/travel 2,7")).toMatchObject({ x: 2, y: 7, travelCommand: "/travel 2,7" });
        expect(parseCoordinates("[6, 10]")).toMatchObject({ x: 6, y: 10, travelCommand: "/travel 6,10" });
    });

    it("remontée post-Willorque : chaîne complète de waypoints, FR + EN", () => {        for (const data of [RAIDS_DATA.gigalodon, RAIDS_DATA_EN.gigalodon]) {
            const route = data.safeRoutes?.find((r) => r.id === "remontee-willorque");
            expect(route).toBeDefined();
            const steps = route?.steps ?? [];
            // Numérotation continue à partir de 1.
            expect(steps.map((s) => s.stepNum)).toEqual(steps.map((_, i) => i + 1));
            // Chaque étape porte des coords dont la commande dérive (copie presse-papier).
            for (const st of steps) {
                const parsed = parseCoordinates(st.coords ?? "");
                expect(parsed).not.toBeNull();
                if (parsed) expect(st.command).toBe(parsed.travelCommand);
            }
            // Chaîne anti-aggro complète : cage → os marin → raccourci → coffre
            // (waypoints intermédiaires dans les actions, position d'étape dans coords).
            const chain = steps.map((s) => `${s.coords ?? ""} ${s.action}`).join(" ");
            for (const wp of ["[10, 14]", "[12, 13]", "[9, 11]", "[6, 10]", "[4, 7]", "[2, 7]", "[3, 2]"]) {
                expect(chain).toContain(wp);
            }
        }
    });

    it("tout linkedRouteId d'étape résout une route existante (FR + EN)", () => {
        for (const data of [RAIDS_DATA.gigalodon, RAIDS_DATA_EN.gigalodon]) {
            const routeIds = new Set((data.safeRoutes ?? []).map((r) => r.id));
            for (const step of data.steps) {
                if (!step.linkedRouteId) continue;
                expect(routeIds.has(step.linkedRouteId)).toBe(true);
            }
        }
        const willorque = RAIDS_DATA.gigalodon.steps.find((s) => s.id === "step-7");
        expect(willorque?.linkedRouteId).toBe("remontee-willorque");
    });

    it("tracker jardin : zéro vert premium en dur (jetons success, hex Vert jeu conservé)", () => {
        const code = readFileSync("src/app/raids/_components/JardinsEnigmaTracker.tsx", "utf8");
        expect(code, "emerald-* restant").not.toMatch(/emerald-\d/);
        // La couleur Vert du jeu (ouvrage monochrome) est une donnée, pas du slop.
        expect(code).toContain("#10b981");
    });
});
