/**
 * 🟡 **Variante partagée** (image OG + embed Discord) et 🧩 **veille des conditions** côté God.
 *
 * 🎯 Deux arbitrages du 23/10/2026 restaient ouverts :
 *   ① « image OG / embed : afficher la variante avec un **tag explicite** » ;
 *   ② la veille des conditions n'était visible **nulle part** dans l'opération (l'instantané
 *      Redis existait, l'alerte portait les chiffres, mais l'écran God ne la montrait pas).
 *
 * Les cas ci-dessous verrouillent le **branchement** (lecture de source), pas le rendu : la règle
 * qui décide de l'aperçu affiché est unique (`resolveVariantPreview`), et le tag n'est posé que
 * si le calcul a réussi (fail-closed).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const OG = "src/app/api/og/build/[id]/route.ts";
const ACTIONS = "src/server/actions/gallery-actions.ts";
const HELPER = "src/server/build-item-sets.ts";
const PANEL = "src/components/admin/GameDataSyncStatePanel.tsx";
const SYNC_ACTIONS = "src/server/actions/game-data-sync-actions.ts";

describe("image OG / embed Discord — la variante est annoncée", () => {
    it("une seule règle décide de l'aperçu affiché (aucune duplication)", () => {
        expect(read(HELPER)).toContain("export async function resolveVariantPreview");
        expect(read(OG)).toContain("resolveVariantPreview(pd, build.variants)");
        expect(read(ACTIONS)).toContain("resolveVariantPreview(build.previewData, build.variants)");
    });

    it("l'image OG porte le tag « VARIANTE » seulement si le calcul a réussi", () => {
        const og = read(OG);
        expect(og).toContain("variantView.variantApplied ?");
        expect(og).toContain(">VARIANTE</text>");
        // Les icônes viennent de l'aperçu **effectif** (variante appliquée), pas du stuff d'origine.
        expect(og).toContain("variantView.preview?.items");
    });

    it("l'embed Discord met le tag dans le titre et liste les objets remplacés", () => {
        const actions = read(ACTIONS);
        expect(actions).toContain('variantView.variantApplied ? " · 🟡 Variante" : ""');
        expect(actions).toContain('name: "🟡 Variante proposée"');
        expect(actions).toContain("describeSavedVariants(variantView.variants, build.previewData?.items)");
        // Les stats de l'embed sont celles de la variante (sinon le tag mentirait).
        expect(actions).toContain("const pd = variantView.preview;");
    });
});

describe("veille des conditions — visible dans le Tableau God", () => {
    it("l'action est réservée à l'accès game-data et lit l'instantané", () => {
        const source = read(SYNC_ACTIONS);
        const start = source.indexOf("export async function getItemConditionsWatch");
        expect(start).toBeGreaterThan(-1);
        const body = source.slice(start, source.indexOf("export async function", start + 10));
        expect(body).toContain("canAccessGameData()");
        expect(body).toContain("getItemConditionsWatchState()");
    });

    it("le tableau charge la veille avec l'état des datasets et l'affiche", () => {
        const panel = read(PANEL);
        expect(panel).toContain("getItemConditionsWatch()");
        expect(panel).toContain("Veille des conditions");
        expect(panel).toContain("conditionsWatch.unknownTypes.length");
        // Aucune écriture : la source reste le cron `data-watch`.
        expect(panel).not.toContain("refreshItemConditionsWatch");
    });
});
