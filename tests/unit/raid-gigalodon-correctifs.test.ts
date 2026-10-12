import { describe, it, expect } from "vitest";
import { RAIDS_DATA, RAIDS_DATA_EN } from "@/lib/raid-overlay-data";

/**
 * Lot 1 — correctifs Gigalodon (siphon DPLN croisé, 10/2026).
 *
 * Verrous :
 *  - l'ordre des formes d'Exécrabe est ALÉATOIRE (jamais présenté comme fixe) ;
 *  - le succès Sel = sels AFFICHÉS (jamais « nuit permanente ») ;
 *  - le barème burst couvre l'échelle basse ET le cap 1M/+15k (jamais au-delà) ;
 *  - PV/seuils/effets chiffrés sur les steps.
 */
describe("raid gigalodon — correctifs lot 1 (FR + EN)", () => {
    for (const [locale, data] of [["fr", RAIDS_DATA.gigalodon], ["en", RAIDS_DATA_EN.gigalodon]] as const) {
        const execrabe = data.steps.find((s) => s.id === "step-4")!;
        const mureine = data.steps.find((s) => s.id === "step-2")!;
        const willorque = data.steps.find((s) => s.id === "step-7")!;
        const gigalodon = data.steps.find((s) => s.id === "step-8")!;

        it(`[${locale}] Exécrabe : 100k PV + seuils + ordre aléatoire`, () => {
            expect(execrabe.bossHp).toContain("100");
            const blob = [...execrabe.bullets, execrabe.keyMechanics.map((k) => `${k.label} ${k.desc}`).join(" ")].join(" ");
            expect(blob).toMatch(/80.?000|80\/60\/40\/20/);
            expect(blob).toMatch(/aléatoire|ALEATOIRE|RANDOM/i);
            // Effets par forme présents (au moins bouclier Perle/PO).
            expect(blob).toMatch(/5.?000|63 PO|63 Range|renvoi|reflect/i);
        });

        it(`[${locale}] succès Sel : affichés, jamais nuit permanente`, () => {
            const all = JSON.stringify(data.steps);
            expect(all).not.toMatch(/nuit totale permanente|permanent darkness|nuit permanente/i);
        });

        it(`[${locale}] barème burst : échelle basse + cap 1M/+15k, rien au-delà`, () => {
            const scale = data.burstOpti?.scale ?? [];
            const dmg = scale.map((r) => r.dmg).join(" ");
            const pts = scale.map((r) => r.pts).join(" ");
            expect(dmg).toMatch(/10.?000/);
            expect(dmg).toMatch(/1.?000.?000/);
            expect(pts).toMatch(/\+15[ ,]000/);
            expect(pts).not.toMatch(/\+(1[6-9]|[2-9]\d)[ ,]000/);
            expect(dmg).not.toMatch(/1\.5M|>1\.5M/);
        });

        it(`[${locale}] Mureine : Cuirage + Triplicité chiffrés`, () => {
            const blob = mureine.bullets.join(" ");
            expect(blob).toMatch(/Cuirage/);
            expect(blob).toMatch(/Triplicit/);
            expect(blob).toMatch(/400|Corroside/);
        });

        it(`[${locale}] Willorque : seuil Random Fish + Light Count chiffrés`, () => {
            const blob = willorque.bullets.join(" ");
            expect(blob).toMatch(/43.?400/);
            expect(blob).toMatch(/Light Count|100 ?%/);
        });

        it(`[${locale}] Gigalodon : prépa + double jeu + Maxquale`, () => {
            const blob = gigalodon.bullets.join(" ");
            expect(blob).toMatch(/3 min|prépa|prep/i);
            expect(blob).toMatch(/2×\/tour|2x\/turn|2×\/turn/i);
            expect(blob).toMatch(/Maxquale/);
        });

        it(`[${locale}] luminomachines -3 : positions DPLN`, () => {
            const loc = data.saltLocations?.find((l) => l.floor.includes("-3"));
            const coords = (loc?.luminomachines ?? []).map((m) => m.coords).join(" ");
            expect(coords).toContain("[2, 9]");
            expect(coords).toContain("[3, 12]");
        });
    }
});
