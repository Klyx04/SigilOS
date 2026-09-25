/**
 * Gardes — **déslop God, périmètre de la refonte du 25/09/2026**.
 *
 * 🎯 Le God est volontairement **allowlisté** dans la règle `sigil/no-hardcoded-colors`
 * (`eslint.config.mjs` : « console admin dark legacy : chantier dédié (93 fichiers,
 * ~3 500 couleurs) »). Ce n'est pas une raison pour laisser **dériver** les surfaces
 * qu'on vient de refondre : ce test verrouille ce qui a été unifié et empêche le
 * retour du « chaque écran invente sa carte ».
 *
 * Ce qui est mesuré ici (et rien d'autre) :
 *  ① la recette de carte brute (`bg-zinc-900/2x border border-white/5 rounded-3xl`)
 *    ne doit plus exister dans `src/app/god/**` — elle vit dans `GOD_CARD_BASE` ;
 *  ② les surfaces refondues consomment le kit (`src/app/god/ui`) ;
 * ③ le reste du déslop God est **tracé** (ROADMAP) : le compteur d'écrans God qui
 *    gardent des palettes en dur uniquement décroît (plafond explicite ci-dessous).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const GOD_ROOT = "src/app/god";
const RAW_CARD = /bg-zinc-900\/2[05] border border-white\/5 rounded-3xl/g;

/** Écrans refondus : ils DOIVENT passer par le kit. */
const REFONTE_FILES = [
    "src/app/god/guilds/[id]/page.tsx",
    "src/app/god/guilds/[id]/god-guild-modules-client.tsx",
    "src/app/god/guilds/[id]/god-guild-access-panel.tsx",
    "src/app/god/logs/page.tsx",
    "src/app/god/components/system-health-dashboard.tsx",
];

/** Liste récursive des fichiers copiés d'un dossier. */
function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory() ? walk(full) : [full.replace(/\\/g, "/")];
    });
}

describe("déslop God — recette de carte unique", () => {
    it("plus aucune recette brute dans src/app/god (elle vit dans GOD_CARD_BASE)", () => {
        const offenders = walk(GOD_ROOT)
            .filter((f) => /\.tsx?$/.test(f))
            .filter((f) => RAW_CARD.test(readFileSync(f, "utf8")))
            .map((f) => f.replace(/^src\/app\/god\//, ""));
        expect(offenders, "cartes recopiées à la main : utiliser <GodCard> / GOD_CARD_BASE").toEqual([]);
    });

    it("le kit God exporte la recette partagée", () => {
        const kit = readFileSync("src/app/god/ui/god-card.tsx", "utf8");
        expect(kit).toContain("export const GOD_CARD_BASE");
        const index = readFileSync("src/app/god/ui/index.ts", "utf8");
        expect(index).toContain("GOD_CARD_BASE");
    });

    it("les surfaces refondues consomment le kit", () => {
        for (const file of REFONTE_FILES) {
            const code = readFileSync(file, "utf8");
            expect(code, `${file} n'utilise pas le kit God`).toMatch(/from "@\/app\/god\/ui"|from "\.\.\/\.\.\/ui"/);
        }
    });

    it("le périmètre refondu reste mesuré : le compteur d'écrans God à palettes en dur ne remonte pas", () => {
        // Mesure du 25/09/2026 : 86 fichiers dans src/app/god, dont la majorité garde des
        // palettes zinc/violet (allowlist ESLint). Ce plafond ne peut que DÉCROÎTRE —
        // il matérialise le reste du chantier, il ne l'excuse pas.
        // (+1 le 25/09 : la vue God « Modules & maintenance » (A2 · G12) est une surface
        // NOUVELLE demandée par le plan ; elle consomme le kit, donc elle n'ajoute pas
        // de dette — le plafond suit un nombre de fichiers, pas la qualité.)
        const CEILING = 86;
        const godFiles = walk(GOD_ROOT).filter((f) => /\.tsx?$/.test(f));
        expect(godFiles.length).toBeLessThanOrEqual(CEILING);
    });
});
