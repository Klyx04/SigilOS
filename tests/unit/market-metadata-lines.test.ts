/**
 * Constat beta (14/09/2026) — **une ligne d'effet `0 → 0` n'est pas un jet**.
 *
 * 📸 Capture user : une **monture d'apparat** (« Gladius Moldus », objet
 * `23559`, `typeId 324`, `category cosmetics`) affichait « Effets · +0
 * Échangeable : [0] · +0 Compatible avec : [0] » **et**, à la publication, le
 * toast « « Monture d'apparat » (Cosmétique) se vend tel quel : aucune
 * statistique ne peut être déclarée » — alors que le vendeur n'avait **rien**
 * déclaré (les deux lignes venaient du catalogue).
 *
 * 📏 Mesure en base (sonde `src/temp/_probe-cosmetic-noise.mjs`) : `983`
 * « Échangeable : » sur **3 330** fiches, `1179` « Compatible avec : » sur
 * **2 603**, toutes en `0 → 0` ; **4 203** fiches `equipment` + **2 196**
 * `cosmetics` en portent ; **0** ligne `0 → 0` n'était persistée dans
 * `MarketListingStat` (le bruit était produit à la volée, à chaque écran).
 *
 * Ce test verrouille la règle **partout** où elle doit tenir :
 *   · écriture → `resolveServerStats` ne persiste jamais ces lignes (et la garde
 *     de famille ne compte donc plus de statistiques fantômes) ;
 *   · lecture → `withDisplayReadyStats`, route OG et « Mon espace » les
 *     écartent (annonces écrites avant la garde, **0 migration**) ;
 *   · assistant → aucun jet n'est pré-rempli ni publié pour une famille
 *     « vente brute » (`statEditorAllowed`).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function read(path: string): string {
    return readFileSync(path, "utf8");
}

/** Retire commentaires de bloc et de ligne (sinon les motifs matchent la prose). */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Index du motif, avec une erreur explicite si absent (échec bruyant). */
function indexOf(source: string, pattern: string): number {
    const index = source.indexOf(pattern);
    expect(index, `motif introuvable : ${pattern}`).toBeGreaterThanOrEqual(0);
    return index;
}

describe("constat beta — les lignes de métadonnées `0 → 0` ne sont jamais des jets", () => {
    it("la règle est portée par `effects.ts` et appliquée aux lignes pré-remplies", () => {
        const source = codeOnly(read("src/lib/market/effects.ts"));
        expect(source).toMatch(/export function isStatBearingNativeEffect\(/);
        expect(source).toMatch(/export function isStatBearingStatRow\(/);
        // Valeur `0 → 0` (plage **normalisée**) ⇒ aucune valeur ⇒ pas un jet.
        expect(source).toMatch(
            /const range = normalizeNativeRange\(fx\.from, fx\.to\);\s*\n\s*return range\.from !== 0 \|\| range\.to !== 0;/
        );
        // L'assistant ne pré-remplit plus jamais une ligne fantôme.
        expect(source).toMatch(/nativeEffects\.filter\(isStatBearingNativeEffect\)\.map\(/);
    });

    it("le serveur ne persiste plus ces lignes et la garde de famille reste intacte", () => {
        const source = codeOnly(read("src/server/actions/market-actions.ts"));
        // Écriture : filtre **après** le recalcul serveur, avant la persistance.
        expect(source).toMatch(/const rows = mapped\.filter\(isStatBearingStatRow\);/);
        expect(source).toMatch(/if \(rows\.length === 0\) return \{ rows: \[\], hash: null \};/);
        // La garde de famille existe toujours (on ne la contourne pas)…
        expect(source).toMatch(/statsCount > 0 && !policy\.statEditorAllowed/);
        // …et elle est appelée avec le compte **filtré** (création **et** édition).
        const filterIndex = indexOf(source, "const rows = mapped.filter(isStatBearingStatRow);");
        const guardIndex = indexOf(source, "guardItemFamilyPolicy(data, resolvedStats.rows.length)");
        expect(filterIndex).toBeLessThan(guardIndex);
        expect(source.match(/guardItemFamilyPolicy\(data, resolvedStats\.rows\.length\)/g)).toHaveLength(2);
    });

    it("les surfaces de lecture écartent les lignes déjà en base (0 migration)", () => {
        const actions = codeOnly(read("src/server/actions/market-actions.ts"));
        // Fiche + catalogue + écran d'édition : helper d'affichage partagé.
        expect(actions).toMatch(/const bearingStats = listing\.stats\.filter\(isStatBearingStatRow\);/);
        // « Mon espace » : le résumé de jet et son compteur restent justes.
        expect(actions).toMatch(/stats: row\.stats\.filter\(isStatBearingStatRow\),/);

        const og = codeOnly(read("src/app/api/og/market/[id]/route.tsx"));
        expect(og).toMatch(/const statLines = listing\.stats\.filter\(isStatBearingStatRow\);/);
        // Constat beta — **toutes** les lignes sont peintes : plus de troncature
        // (`MAX_STAT_LINES`) ni de mention « + N autres lignes ».
        expect(og).not.toMatch(/MAX_STAT_LINES/);
        expect(og).not.toMatch(/autre\(s\) ligne\(s\)/);
        expect(og).toMatch(/const metrics = statRowMetrics\(statLines\.length\);/);
        // Une annonce sans jet (donc sans métadonnées) reste « objet en grand ».
        expect(og).toMatch(/const boxSize = hasStatLines \? ITEM_BOX : ITEM_BOX_LARGE;/);

        const lines = codeOnly(read("src/components/market/market-stat-lines.tsx"));
        expect(lines).toMatch(/const lines = stats\.filter\(isStatBearingStatRow\);/);
        expect(lines).toMatch(/\{lines\.map\(\(stat\) => \(/);

        // La fiche garde sa règle : un lot / cosmétique / vente brute n'a pas de jet.
        const client = codeOnly(
            read("src/app/dashboard/[guildId]/marche/_components/market-listing-client.tsx")
        );
        expect(client).toMatch(/stats: declaredJet \? listing\.stats : \[\]/);
    });

    it("l'assistant n'affiche ni ne publie un jet hors famille modifiable", () => {
        const source = codeOnly(
            read("src/app/dashboard/[guildId]/marche/_components/market-create-client.tsx")
        );
        // Une seule source de vérité pour ce qui est affiché **et** envoyé.
        expect(source).toMatch(
            /const declarableStats = itemPolicy\.statEditorAllowed \? stats : NO_DECLARABLE_STATS;/
        );
        // Plus **aucune** consommation du state brut (`stats.map(`)…
        expect(source).not.toMatch(/stats: stats\.map\(/);
        expect(source).not.toMatch(/exoLabels=\{stats\./);
        // …et le pré-remplissage est conditionné à la politique de l'objet choisi.
        expect(source).toMatch(/const pickedPolicy = resolveMarketItemPolicy\(\{/);
        expect(source).toMatch(/pickedPolicy\.statEditorAllowed\s*\n\s*\? buildNativeStatDrafts\(/);
        // Carte du catalogue : bloc EFFETS seulement pour un objet modifiable.
        expect(source).toMatch(/const drafts = itemPolicy\.statEditorAllowed\s*\n\s*\? buildNativeStatDrafts\(/);
    });
});
