/**
 * Gardes — **gabarits de zone manquants (Lot 2)** : « Vague à Lame doit faire 3 cases, pourquoi
 * ça n'en affiche qu'une ? » + **vraie modale** de la simulation tactique.
 *
 * 🎯 Retour user (22/09/2026, verbatim) : « vague à lame un exemple parmi d'autre doit faire 3 cases
 * pk quand je cible ca affiche que une case? · fais le en vrai modale · regarde les bugs d'affichage
 * superposé · le composant en général est pas pratique quand faut s'échapper pour scroll zoomer ·
 * le damage preview aussi à revoir à mettre ailleurs ».
 *
 * 🔍 Mesures (22/09/2026, `api.dofusdb.fr` — la source du siphon ; aucun chiffre inventé) :
 *   · **Vague à Lame** 12794 → niveau 40682 : effets `shape: 84` (`'T'`) + `param1: 1` ;
 *   · **Lame Destructrice** 8194 → `shape: 84 | param1: 1` ;
 *   · **Aquatruc** 11437 → `shape: 71` (`'G'`) + `param1: 1` ;
 *   · la table gabarit → nom (mesurée) donne `T` = « Ligne perpendiculaire », `G` = « Carré ».
 *   **Cause racine du défaut « 1 case »** : `'T'` n'existait dans AUCUNE table
 *   (`spellZoneShapeFromLetter`, `ZONE_SHAPE_BY_CODE`) ⇒ forme « Inconnue » ⇒ la grille ne
 *   dessinait que la case visée.
 *
 * 🛡️ Ce que ce test verrouille : ① `T`/`G` sont reconnus (plus de « Inconnue » silencieuse) ;
 * ② la **géométrie** de `Perpend` = ligne perpendiculaire au lancer (`2·size+1` cases, 3 pour
 * `param1: 1`) et **pas** une croix ; ③ les gabarits non calibrés restent honnêtement « Inconnue » ;
 * ④ la **vraie modale** (plateau plein écran, prévisu de dégâts + légende dans un rail, une seule
 * définition des deux panneaux).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { distance, losToXY, spellZoneCells, toLos, type DofusPos } from "@/lib/dofus-grid";
import { spellZoneFromDamages, spellZoneShapeFromLetter } from "@/lib/dofus-spells";
import { toAnomalyZone } from "@/lib/anomaly-boss";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
    readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const GRID = codeOf("src/components/succes/SpellRangeGrid.tsx");
const HUD = codeOf("src/components/succes/SimulationDamageHud.tsx");
const FR = codeOf("src/lib/i18n/locales/fr.ts");
const EN = codeOf("src/lib/i18n/locales/en.ts");

const key = (p: DofusPos) => `${p.x},${p.y}`;

describe("gabarits de zone — `T` (ligne perpendiculaire) et `G` (carré), mesurés", () => {
    it("les lettres mesurées sont reconnues (plus de « Inconnue » silencieuse)", () => {
        expect(spellZoneShapeFromLetter("T")).toBe("Perpend");
        expect(spellZoneShapeFromLetter("G")).toBe("Rectangle");
        // Gabarits NON calibrés : on ne devine pas une géométrie (défaut assumé, pas de faux rendu).
        for (const letter of ["U", "I", ";", "l", "O", "Q", "B"]) {
            expect(spellZoneShapeFromLetter(letter)).toBe("Inconnue");
        }
    });

    it("le chemin DofusDB (`toAnomalyZone`, code ASCII) mappe `T`/`G` aussi", () => {
        expect(toAnomalyZone({ shape: 84, param1: 1 })).toEqual({ shape: "Perpend", size: 1, range: 0 });
        expect(toAnomalyZone({ shape: 71, param1: 1 })).toEqual({ shape: "Rectangle", size: 1, range: 0 });
    });

    it("`spellZoneFromDamages` remonte la forme perpendiculaire (fini la case unique)", () => {
        expect(spellZoneFromDamages([{ zone: { shape: "T", size: 1 } }])).toEqual({
            shape: "Perpend",
            size: 1,
        });
    });
});

describe("géométrie — « Ligne perpendiculaire » : 3 cases pour `param1: 1`", () => {
    it("grille libre : la ligne est PERPENDICULAIRE au lancer (et non une croix)", () => {
        // Lanceur à gauche de la cible ⇒ la ligne court verticalement.
        const fromLeft = spellZoneCells({
            zone: { shape: "Perpend", size: 1, range: 0 },
            target: { x: 8, y: 8 },
            caster: { x: 5, y: 8 },
            cols: 17,
            rows: 17,
            isRealMap: false,
        });
        expect(fromLeft.map(key).sort()).toEqual(["8,7", "8,8", "8,9"]);

        // Lanceur au-dessus ⇒ la ligne court horizontalement (même règle).
        const fromAbove = spellZoneCells({
            zone: { shape: "Perpend", size: 1, range: 0 },
            target: { x: 8, y: 8 },
            caster: { x: 8, y: 5 },
            cols: 17,
            rows: 17,
            isRealMap: false,
        });
        expect(fromAbove.map(key).sort()).toEqual(["7,8", "8,8", "9,8"]);
    });

    it("map réelle : même règle dans le repère losange (axe ⟂ au lancer)", () => {
        const caster = { x: 7, y: 14 };
        const target = { x: 7, y: 20 };
        const cells = spellZoneCells({
            zone: { shape: "Perpend", size: 1, range: 0 },
            target,
            caster,
            cols: 14,
            rows: 40,
        });
        // Mesure Vague à Lame 12794 (`param1: 1`) : **3 cases** — le défaut n'en montrait qu'une.
        expect(cells).toHaveLength(3);
        const keys = new Set(cells.map(key));
        expect(keys.has(key(target))).toBe(true);
        // Toutes les cases sont à distance Dofus ≤ 1 de la case visée (les 2 voisines sont à 1).
        for (const c of cells) expect(distance(c, target)).toBeLessThanOrEqual(1);

        // Axe perpendiculaire : même `u` (losange), `v` à −1 / 0 / +1 autour de la cible.
        const t = toLos(target.x, target.y);
        const axis = [-1, 0, 1].map((i) => key(losToXY(t.x, t.y + i)));
        expect([...keys].sort()).toEqual(axis.sort());

        // Contre-exemple chiffré : une croix de même taille rend 5 cases (2 de plus, sur l'axe du lancer).
        const cross = spellZoneCells({
            zone: { shape: "Croix", size: 1, range: 0 },
            target,
            caster,
            cols: 14,
            rows: 40,
        }).map(key);
        expect(cross).toHaveLength(5);
        for (const k of keys) expect(cross).toContain(k);
    });

    it("auto-ciblage (aucune orientation mesurable) : une seule case, jamais une direction inventée", () => {
        const cells = spellZoneCells({
            zone: { shape: "Perpend", size: 1, range: 0 },
            target: { x: 7, y: 20 },
            caster: { x: 7, y: 20 },
            cols: 14,
            rows: 40,
            isRealMap: false,
        });
        expect(cells.map(key)).toEqual(["7,20"]);
    });
});

describe("simulation tactique — vraie modale plein écran (rail prévisu + légende)", () => {
    it("le plateau s'ouvre dans une boîte `Dialog` dimensionnée et titrée", () => {
        expect(GRID).toMatch(/const \[fullscreen, setFullscreen\] = useState<boolean>\(false\);/);
        expect(GRID).toMatch(/<Dialog\r?\n\s*open\r?\n\s*onOpenChange=\{\(next\) => \{/);
        expect(GRID).toMatch(
            /className="flex h-\[min\(94vh,64rem\)\] w-\[min\(97vw,96rem\)\] max-w-none flex-col gap-0 overflow-hidden p-0"/
        );
        expect(GRID).toMatch(/showCloseButton=\{false\}/);
        expect(GRID).toMatch(/<DialogTitle/);
        // Un seul plateau : la même arborescence est montée en ligne OU dans la modale.
        expect(GRID).toMatch(/if \(!fullscreen\) return simSurface;/);
    });

    it("Échap annule la pose en cours avant de refermer la modale", () => {
        expect(GRID).toMatch(/onEscapeKeyDown=\{\(event\) => \{/);
        expect(GRID).toMatch(/event\.preventDefault\(\);/);
        expect(GRID).toMatch(/setPlacingEnemy\(false\);/);
    });

    it("prévisu de dégâts ET légende passent dans un rail — plus rien de superposé au plateau", () => {
        expect(GRID).toMatch(/\{damagePanel\(true\)\}/);
        expect(GRID).toMatch(/\{legendPanel\(true\)\}/);
        expect(GRID).toMatch(/lg:w-80/);
        // La rangée flottante n'existe QUE dans la fenêtre de jeu PiP : partout ailleurs les deux
        // panneaux sont dans un rail (modale plein écran **et** mise en page en ligne).
        expect(GRID).toMatch(/\{compact && !fullscreen && \(\r?\n\s*<div\r?\n\s*data-no-drag\r?\n\s*className="pointer-events-none absolute inset-2/);
        expect(GRID).toMatch(/\{!compact && !fullscreen && \(/);
        // Une seule définition de chaque panneau : le rail et le plateau partagent l'instance
        // (aucun markup recopié ⇒ aucun risque de divergence entre les deux emplacements).
        expect((GRID.match(/<SimulationDamageHud/g) || []).length).toBe(1);
        expect((GRID.match(/<SimulationTacticalLegend/g) || []).length).toBe(1);
    });

    it("le plateau remplit la modale (pan + molette de zoom dedans, rien à faire en dehors)", () => {
        expect(GRID).toMatch(/const fitsViewport = compact \|\| fullscreen;/);
        expect((GRID.match(/fitsViewport/g) || []).length).toBeGreaterThanOrEqual(5);
        expect(GRID).toMatch(/fullscreen && "max-h-full"/);
    });

    it("un seul bouton « Plein écran », monté dans les deux barres d'outils", () => {
        expect(GRID).toMatch(/const fullscreenToggle = \(board: boolean\) => \(/);
        expect((GRID.match(/\{fullscreenToggle\(/g) || []).length).toBe(3);
        expect(GRID).toMatch(/aria-pressed=\{fullscreen\}/);
    });

    it("le panneau de prévisu accepte d'être monté dans le rail (pleine largeur, hauteur libre)", () => {
        expect(HUD).toMatch(/className\?: string;/);
        expect(HUD).toMatch(/scroll,\s*className/);
        expect(GRID).toMatch(/className=\{rail \? "w-full max-h-none" : undefined\}/);
        expect(GRID).toMatch(/className=\{rail \? "w-full" : undefined\}/);
    });

    it("les libellés du plein écran existent en FR ET en EN", () => {
        for (const locale of [FR, EN]) {
            expect(locale).toMatch(/fullscreenTitle: "/);
            expect(locale).toMatch(/fullscreenExit: "/);
        }
    });
});
