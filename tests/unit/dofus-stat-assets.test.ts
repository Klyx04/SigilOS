import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * BUG-4 — 6 assets d'icônes de statistiques **manquants** (`src/temp/debug.md` :
 * `404 /assets/dofus/stats/{dmgCritique,sablier,dmgArme,dmgDistance,dmgMelee,dmgSort}.png`).
 *
 * Ce test élimine la **classe** de bug : toute icône `public/assets/dofus/stats/*.png`
 * référencée par le code (thème du Marché, aperçu Dofusbook) doit **exister sur
 * disque**. Il échoue donc avant qu'un 404 ne parte en production.
 */
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const STATS_DIR = path.join(PROJECT_ROOT, "public", "assets", "dofus", "stats");

/** Fichiers référencés par le code source (scan, pas de liste recopiée à la main). */
function referencedStatAssets(): string[] {
    const sources = [
        path.join(PROJECT_ROOT, "src", "lib", "dofus-stats-theme.ts"),
        path.join(PROJECT_ROOT, "src", "components", "dofus", "dofusbook-preview.tsx"),
    ];
    const names = new Set<string>();
    for (const file of sources) {
        const content = fs.readFileSync(file, "utf8");
        for (const match of content.matchAll(/["'`]\/assets\/dofus\/stats\/([a-zA-Z0-9_.-]+\.png)/g)) {
            names.add(match[1]);
        }
        for (const match of content.matchAll(/asset:\s*"([a-zA-Z0-9_.-]+\.png)"/g)) {
            names.add(match[1]);
        }
    }
    return [...names].sort();
}

describe("🖼️ Marché — intégrité des assets de statistiques (BUG-4)", () => {
    it("contient les 6 PNG officiels qui déclenchaient des 404 en beta", () => {
        for (const name of [
            "dmgCritique.png",
            "sablier.png",
            "dmgArme.png",
            "dmgDistance.png",
            "dmgMelee.png",
            "dmgSort.png",
        ]) {
            expect(fs.existsSync(path.join(STATS_DIR, name)), `${name} manquant`).toBe(true);
        }
    });

    it("résout **chaque** icône référencée par le code (thème + aperçu Dofusbook)", () => {
        const referenced = referencedStatAssets();
        expect(referenced.length).toBeGreaterThan(30);
        const missing = referenced.filter((name) => !fs.existsSync(path.join(STATS_DIR, name)));
        expect(missing).toEqual([]);
    });
});
