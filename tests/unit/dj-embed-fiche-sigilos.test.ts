/**
 * Boutons des embeds de posts (DJ / quêtes) — le bouton « Dofensive » devient
 * **« Fiche SigilOS »** (demande user du 11/10/2026).
 *
 * 🐛 Ce que ce test verrouille : ① plus **aucun** bouton `label: "Dofensive"` n'est
 * poussé dans un embed, et le bouton de remplacement est construit **à un seul
 * endroit** (deux copies finiraient par diverger) ; ② sa destination vient de la
 * **source unique** `dungeonFicheHref` en sentinelle `"public"` ⇒ `/boss/<slug>`, et
 * un donjon sans `slug` ni `id` ne produit **aucun** bouton (jamais d'URL inventée) ;
 * ③ les deux cartes in-app (liste + modale) passent par la même source et ne
 * portent plus le lien Dofensive.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { dungeonFicheHref } from "@/lib/dungeon-fiche";

const ACTIONS = "src/server/actions/dungeon-finder-actions.ts";
const CARTES = [
    "src/components/dungeon-finder/DjPostCard.tsx",
    "src/components/dungeon-finder/DjPostDetailModal.tsx",
];

describe("embeds de posts — « Fiche SigilOS » remplace « Dofensive »", () => {
    it("① aucun bouton Dofensive, un seul constructeur, deux appelants", () => {
        const code = readFileSync(ACTIONS, "utf8");
        expect(code).not.toMatch(/label:\s*"Dofensive"/);
        expect(code).toContain('label: "Fiche SigilOS"');
        // Un seul constructeur (pas de copie), deux surfaces (création + mise à jour).
        expect(code.match(/function dungeonFicheButton\(/g)).toHaveLength(1);
        expect(code.match(/dungeonFicheButton\(appUrl, post\.dungeon\)/g)).toHaveLength(2);
    });

    it("② destination = source unique `dungeonFicheHref`, absolue, jamais inventée", () => {
        const code = readFileSync(ACTIONS, "utf8");
        expect(code).toMatch(/dungeonFicheHref\("public", dungeon\)/);
        expect(code).toMatch(/url:\s*`\$\{appUrl\}\$\{href\}`/);
        // hors guilde ⇒ fiche publique ; sans slug ni id ⇒ aucun lien.
        expect(dungeonFicheHref("public", { id: "42" })).toBe("/boss/42");
        expect(dungeonFicheHref("public", { slug: "comte-harebourg" })).toBe("/boss/comte-harebourg");
        expect(dungeonFicheHref("public", null)).toBeNull();
        expect(dungeonFicheHref("public", {})).toBeNull();
    });

    it("③ les cartes in-app passent par la même source unique", () => {
        for (const fichier of CARTES) {
            const code = readFileSync(fichier, "utf8");
            expect(code, fichier).toContain("dungeonFicheHref");
            expect(code, fichier).not.toContain("dofensiveUrl");
        }
    });
});
