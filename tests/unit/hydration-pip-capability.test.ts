/**
 * Hydratation — une capacité du navigateur ne se lit jamais pendant le rendu.
 *
 * 🐛 Mesure du 16/11/2026 (`JAVASCRIPT-NEXTJS-1M`) : React error **#418** reproduit sur
 * `https://beta.sigilos.fr/guides/raid-gigalodon-dofus-guide` (Chrome headless, texte
 * serveur vs texte hydraté). `isDocumentPipSupported()` était évalué au rendu : le
 * serveur rendait « Mini-fenêtre flottante » / pas de badge, Chrome rendait « Fenêtre PiP
 * détachable » + badge « PiP ✓ ». Le correctif lit la capacité dans un `useEffect` :
 * premier rendu identique au serveur, bascule ensuite.
 *
 * 🔒 Verrouille aussi le tiroir de stratégie, qui portait exactement le même motif.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const FILES = [
    "src/components/raid-overlay/RaidOverlayLaunchBanner.tsx",
    "src/components/worldmap/RaidStratDrawer.tsx",
];

const read = (rel: string) => readFileSync(rel, "utf8");

/** Retire les commentaires : la prose cite l'ancien motif à dessein. */
function codeSeul(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("hydration — la capacité PiP est posée après le montage", () => {
    it("① la capacité n'est jamais évaluée pendant le rendu", () => {
        for (const file of FILES) {
            const code = codeSeul(read(file));
            // L'ancien motif fautif : une constante calculée au rendu.
            expect(code, file).not.toMatch(/const\s+pipSupported\s*=\s*isDocumentPipSupported\(\)/);
            // Le correctif : état initial `false` + effet de montage.
            expect(code, file).toMatch(/const \[pipSupported, setPipSupported\] = useState\(false\)/);
            expect(code, file).toContain("setPipSupported(isDocumentPipSupported())");
        }
    });

    it("② le premier rendu est identique au serveur (false) puis l'état bascule", () => {
        for (const file of FILES) {
            const code = codeSeul(read(file));
            const state = code.indexOf("const [pipSupported, setPipSupported] = useState(false)");
            const effect = code.indexOf("setPipSupported(isDocumentPipSupported())");
            expect(state, file).toBeGreaterThanOrEqual(0);
            expect(effect, file).toBeGreaterThan(state);
            expect(code.slice(state, effect), file).toContain("useEffect(");
        }
    });

    it("③ la mesure est écrite sur place, pas seulement dans ce test", () => {
        for (const file of FILES) {
            expect(read(file), file).toContain("JAVASCRIPT-NEXTJS-1M");
        }
    });
});
