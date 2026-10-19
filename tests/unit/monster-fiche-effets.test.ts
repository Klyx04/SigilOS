/**
 * Fiche monstre — effets de sort publiables (non-régression du 20/10/2026).
 *
 * Relevé sur `/bestiaire/barbrule` : la fiche affichait « 24515 » comme une ligne d'effet.
 * Cause mesurée dans `public/game-data/unity-bestiary.json` : **4 380** lignes d'effet
 * réduites à un id d'effet client non résolu et **5 351** lignes portant des balises
 * `{{~ps}}` / `{{~zs}}`. La règle `cleanDofusText` existait déjà (fiche boss, overlay,
 * Succès) mais n'était **pas** branchée sur `MonsterFicheView` : le monstre était la seule
 * surface publique à afficher le brut du client.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cleanDofusText, isRenderableDofusEffectLine } from "@/lib/dofus-spells";

describe("isRenderableDofusEffectLine", () => {
    it("écarte un id d'effet client non résolu", () => {
        expect(isRenderableDofusEffectLine("24515")).toBe(false);
        expect(isRenderableDofusEffectLine(" 24523 ")).toBe(false);
    });

    it("garde un effet réel", () => {
        expect(isRenderableDofusEffectLine("32 à 38 dommages Eau")).toBe(true);
        expect(isRenderableDofusEffectLine("Attire de 10 cases")).toBe(true);
    });

    it("écarte une ligne vide", () => {
        expect(isRenderableDofusEffectLine("")).toBe(false);
        expect(isRenderableDofusEffectLine(null)).toBe(false);
        expect(isRenderableDofusEffectLine("   ")).toBe(false);
    });
});

describe("effets du bestiaire local — balises Unity", () => {
    it("nettoie les marqueurs de pluriel du client", () => {
        expect(cleanDofusText("Attire de 10 case{{~ps}}")).toBe("Attire de 10 cases");
        expect(cleanDofusText("40 Dommage{{~ps}}{{~zs}} - 3 tours")).toBe("40 Dommages - 3 tours");
    });

    it("conserve le singulier après 1", () => {
        expect(cleanDofusText("Repousse de 1 case{{~ps}}")).toBe("Repousse de 1 case");
    });
});

describe("MonsterFicheView — le brut du client n'est plus publié", () => {
    const src = () => readFileSync("src/components/succes/MonsterFicheView.tsx", "utf8");

    it("nettoie les libellés avant de les rendre", () => {
        expect(src()).toMatch(/cleanDofusText\(String\(effect\)\)/);
    });

    it("filtre les lignes non publiables", () => {
        expect(src()).toMatch(/isRenderableDofusEffectLine/);
    });
});
