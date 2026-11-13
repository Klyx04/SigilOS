/**
 * Titan — le 1er clic ne doit plus dire « erreur ».
 *
 * Défaut mesuré le 30/10/2026 (constat user) : le 1er clic sur « Marquer je l'ai vaincu » affichait
 * un toast **ERREUR** alors que la ligne était créée ; le 2ᵉ clic décocheait. Causes :
 * ① l'action serveur faisait un **toggle implicite** (elle inversait l'état de la base) ;
 * ② la comparaison client `res.data.completed === !prev.has(id)` prenait un **succès** pour un échec.
 *
 * La règle est désormais : le client dit l'**état voulu**, le serveur l'applique et le renvoie, et
 * `isTitanToggleApplied` vérifie simplement l'égalité.
 *
 * Les gardes de source verrouillent le câblage (aucune base, aucun rendu) : même style que
 * `succes-ui-deslop`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { isTitanToggleApplied } from "@/lib/titan-toggle";

const read = (path: string) => readFileSync(path, "utf8");
const codeOf = (path: string) =>
    read(path)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const TAB = "src/components/succes/SuccesTitanTab.tsx";
const BOSS_GUIDE = "src/components/succes/SuccesBossGuide.tsx";
const PUBLIC_DETAIL = "src/app/boss/[dungeonId]/_components/PublicBossDetailClient.tsx";

describe("isTitanToggleApplied — l'état obtenu est celui demandé", () => {
    it("marquage réussi", () => {
        expect(isTitanToggleApplied({ success: true, data: { completed: true } }, true)).toBe(true);
    });

    it("marquage « raté » (le serveur répond false alors qu'on voulait true)", () => {
        expect(isTitanToggleApplied({ success: true, data: { completed: false } }, true)).toBe(false);
    });

    it("décochage réussi", () => {
        expect(isTitanToggleApplied({ success: true, data: { completed: false } }, false)).toBe(true);
    });

    it("action en échec, réponse vide ou absente", () => {
        expect(isTitanToggleApplied({ success: false, data: { completed: true } }, true)).toBe(false);
        expect(isTitanToggleApplied({ success: true }, true)).toBe(false);
        expect(isTitanToggleApplied(null, false)).toBe(false);
        expect(isTitanToggleApplied(undefined, true)).toBe(false);
    });
});

describe("Fiche Titan — câblage idempotent et favicon local", () => {
    it("n'utilise plus le toggle implicite", () => {
        const src = codeOf(TAB);
        expect(src).not.toContain("toggleTitanCompleted");
        expect(src).toContain("setTitanCompleted(guildId, id, desired)");
        expect(src).toContain("isTitanToggleApplied(res, desired)");
    });

    it("désactive le bouton pendant l'appel", () => {
        const src = read(TAB);
        expect(src).toContain("pendingTitanId");
        expect(src).toMatch(/disabled=\{pendingTitanId === selected\.id\}/);
    });

    it("affiche le favicon DPNL local sur les fiches Titan et boss", () => {
        for (const file of [TAB, BOSS_GUIDE, PUBLIC_DETAIL]) {
            const src = read(file);
            expect(src, file).toContain("BRAND_ICONS.dofuspourlesnoobs.src");
            expect(src, file).not.toContain("google.com/s2/favicons");
        }
    });
});
