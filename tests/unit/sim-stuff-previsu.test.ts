/**
 * Gardes — **onglet Simulation d'une fiche stuff : prévisu de dégâts par cible** + repère de case.
 *
 * 🎯 Retour user (22/09/2026, verbatim) : « mais où sont les estimations de dégâts par cible posées
 * que ce soit sur le simulateur pour les stuff ou les dégâts des boss/monstres/avis/titans ? ça
 * marche pas du tout » et « c'est quoi ce cercle blanc ».
 *
 * 🔍 Mesures (lecture seule de la base locale) :
 *   ① le grimoire de classe stocké (`ClassSpellbook`, classe 17) porte bien les jets — « Éther »
 *      grade 3 → `[{min:25,max:28,element:"air"}]` — mais l'onglet Simulation construisait ses
 *      `SpellData` **sans `effectDetails`** ⇒ `damageLinesFromEffects` → 0 ligne ⇒ option « Dégâts
 *      estimés » désactivée, aucun badge par cible ;
 *   ② le serveur ne connaît pas le build : les jets du stuff se calculent ICI, avec la formule du
 *      jeu (`computeSpellDamage`), exactement comme l'onglet Sorts ;
 *   ③ les repères flottants (case visée, badges) appelaient `cellToScreen` — repère « brique » des
 *      vraies maps — **aussi sur la grille libre**, dessinée en losange (`freeOrigin*`) : l'anneau
 *      blanc tombait à ~5 cases du survol (d'où « c'est quoi ce cercle blanc ? »).
 *
 * 🛡️ Ce que ce test verrouille : ① les jets du build (formule, % mêlée/distance, sort utilitaire) ;
 * ② l'intégration avec l'agrégation par élément et la dégressivité de zone de la grille ; ③ le
 * câblage (build mémoïsé, aucune valeur en dur) ; ④ le repère de case dans le BON espace.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    damageLinesFromEffects,
    spellEffectDetailsFromBuild,
    type BuildStatsForSpells,
    type SpellBaseDamage,
} from "@/lib/dofus-spells";
import { cellToScreen } from "@/lib/dofus-grid";
import { zoneFalloffPercent, zoneTotalAtOffset } from "@/lib/dofus-zone-damage";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
    readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const GRID = codeOf("src/components/succes/SpellRangeGrid.tsx");
const SIM_TAB = codeOf("src/components/dofus/dofusbook-simulation-tab.tsx");
const PREVIEW = codeOf("src/components/dofus/dofusbook-preview.tsx");
const FR = codeOf("src/lib/i18n/locales/fr.ts");
const EN = codeOf("src/lib/i18n/locales/en.ts");

/** Build de test : Agilité 100, +10 dommages Air fixes, +20 % dommages Distance. */
const BUILD: BuildStatsForSpells = {
    elements: { fo: 0, in: 0, ch: 0, ag: 100, sa: 0, pu: 0 },
    damages: {
        neutre: 0, terre: 0, feu: 0, eau: 0, air: 10, general: 0,
        critique: 0, poussee: 0, armes: 0, sorts: 0, melee: 0, distance: 20,
    },
};

/** « Éther » (Huppermage) grade 3 — jet réel relevé dans `ClassSpellbook` : 25 à 28 Air. */
const ETHER_G3: SpellBaseDamage[] = [{ min: 25, max: 28, element: "air", grade: 3 }];

describe("jets du build — formule du jeu, aucune estimation", () => {
    it("applique stat élémentaire + dommages fixes + % dommages (distance)", () => {
        // base 25 : floor(25 × 2) = 50 ; +10 fixes = 60 ; ×1,20 = 72
        // base 28 : floor(28 × 2) = 56 ; +10 fixes = 66 ; ×1,20 = floor(79,2) = 79
        const [line] = spellEffectDetailsFromBuild(ETHER_G3, BUILD, { kind: "distance" });
        expect(line.damage).toEqual({ element: "air", min: 72, max: 79, decrease: null });
        expect(line.label).toBe("72 à 79 dommages Air");
        expect(line.duration).toBeNull();
        expect(line.triggers).toEqual([]);
        expect(line.masks).toEqual([]);
    });

    it("le % appliqué suit la portée du sort (mêlée ≠ distance)", () => {
        const [melee] = spellEffectDetailsFromBuild(ETHER_G3, BUILD, { kind: "melee" });
        // Le build de test ne porte que des % Distance ⇒ aucun bonus en mêlée.
        expect(melee.damage).toEqual({ element: "air", min: 60, max: 66, decrease: null });
    });

    it("un sort utilitaire (aucune ligne de dégâts) ne produit AUCUN effet chiffré", () => {
        expect(spellEffectDetailsFromBuild([], BUILD)).toEqual([]);
        expect(spellEffectDetailsFromBuild(undefined, BUILD)).toEqual([]);
    });

    it("les lignes restent agrégées par élément par la source unique de la grille", () => {
        const details = spellEffectDetailsFromBuild(
            [...ETHER_G3, { min: 10, max: 10, element: "air", grade: 3 }],
            BUILD,
            { kind: "distance" }
        );
        const { lines } = damageLinesFromEffects(details);
        // 2ᵉ ligne Air (10-10) : floor(10 × 2) = 20 ; +10 = 30 ; ×1,20 = 36 ⇒ 72+36 / 79+36.
        expect(lines).toEqual([{ element: "air", min: 108, max: 115, lines: 2, crit: null, decrease: null }]);
    });

    it("la dégressivité de zone s'applique à ces jets (règle 3.6 : 60 % à 4 cases et au-delà)", () => {
        const details = spellEffectDetailsFromBuild(ETHER_G3, BUILD, { kind: "distance" });
        const { lines } = damageLinesFromEffects(details);
        expect(zoneFalloffPercent(5)).toBe(60);
        expect(zoneTotalAtOffset(lines, 5)).toEqual({ min: 43, max: 47, critMin: null, critMax: null });
    });
});

describe("câblage — l'onglet Simulation alimente la grille (aucun cas particulier)", () => {
    it("les sorts simulés portent leurs `effectDetails` (donc l'option « Dégâts estimés »)", () => {
        expect(SIM_TAB).toMatch(
            /import \{ spellEffectDetailsFromBuild, spellZoneFromDamages, type BuildStatsForSpells \} from "@\/lib\/dofus-spells";/
        );
        expect(SIM_TAB).toMatch(
            /const effectDetails = spellEffectDetailsFromBuild\(sp\.damages, boostedBuild, \{\s*kind,\s*critDamages: sp\.critDamages,\s*\}\);/
        );
        expect(SIM_TAB).toMatch(/^\s*effectDetails,$/m);
        // Le taux (%) dépend de la portée du sort, comme l'onglet Sorts.
        expect(SIM_TAB).toMatch(/const kind: "sorts" \| "melee" \| "distance" = sp\.maxRange <= 1 \? "melee" : "distance";/);
        // Aucun calcul de dégâts recopié dans le composant.
        expect(SIM_TAB).not.toMatch(/Math\.floor\(/);
    });

    it("le build est mémoïsé puis partagé par les deux onglets (identité STABLE)", () => {
        expect(PREVIEW).toMatch(
            /const buildForSpells = useMemo\(\(\) => spellsBuild\(\(data \?\? \{\}\) as DofusbookPreviewData\), \[data\]\);/
        );
        // Les DEUX onglets consomment la même instance : recréer l'objet à chaque rendu relançait
        // le chargement des sorts en boucle (`build` est une dépendance d'effet).
        expect(PREVIEW.match(/build=\{buildForSpells\}/g)?.length).toBe(2);
        expect(PREVIEW).not.toMatch(/build=\{spellsBuild\(/);
    });
});

describe("repère de case — un seul espace de coordonnées par rendu", () => {
    it("⚠️ le repère « brique » ≠ repère de la grille libre (le bug du cercle blanc)", () => {
        // Grille libre 17×17, tuiles 40×20 (les valeurs réelles de `SpellRangeGrid`).
        const tileW = 40;
        const tileH = 20;
        const gridSize = 17;
        const freeOriginX = ((gridSize + gridSize) / 2) * (tileW / 2); // 340
        const freeOriginY = 20;
        const freeCellPos = (x: number, y: number) => ({
            sx: freeOriginX + (x - y) * (tileW / 2),
            sy: freeOriginY + (x + y) * (tileH / 2),
        });

        // Case (8,8) : losange → (340, 180) ; `cellToScreen` (brique) → (320, 80).
        expect(freeCellPos(8, 8)).toEqual({ sx: 340, sy: 180 });
        expect(cellToScreen(8, 8, tileW, tileH)).toEqual({ sx: 320, sy: 80 });
        // Mélanger les deux plaçait le repère à ~5 cases du survol : c'est ce que voyait l'utilisateur.
        expect(cellToScreen(8, 8, tileW, tileH)).not.toEqual(freeCellPos(8, 8));
    });

    it("la grille calcule la position des repères dans le repère du rendu courant", () => {
        expect(GRID).toMatch(/const cellScreenPos = useCallback\(/);
        expect(GRID).toMatch(/isRealMap\s*\?\s*cellToScreen\(x, y, tileW, tileH\)/);
        expect(GRID).toMatch(/\{ sx: freeOriginX \+ \(x - y\) \* tileHalfW, sy: freeOriginY \+ \(x \+ y\) \* tileHalfH \}/);
    });

    it("case visée ET badges passent par cette source unique", () => {
        expect(GRID).toMatch(/const \{ sx, sy \} = cellScreenPos\(zoneAnchor\.x, zoneAnchor\.y\);/);
        expect(GRID).toMatch(/const \{ sx, sy \} = cellScreenPos\(target\.x, target\.y\);/);
        // Plus aucun `cellToScreen` sur les repères flottants (le rendu des cases de map, lui, le garde).
        expect(GRID).not.toMatch(/cellToScreen\(zoneAnchor/);
        expect(GRID).not.toMatch(/cellToScreen\(target/);
        expect(GRID).toMatch(/cellToScreen\(c, r, tileW, tileH\)/);
    });

    it("le repère de case visée se nomme à l'écran (FR **et** EN) — fin du « c'est quoi ce cercle ? »", () => {
        expect(GRID).toMatch(/\{simT\.targetCellShort\}/);
        expect(GRID).toMatch(/<title>\{simT\.legend\.targetCell\}<\/title>/);
        expect(FR).toMatch(/targetCellShort: "Case visée",/);
        expect(EN).toMatch(/targetCellShort: "Target cell",/);
    });
});
