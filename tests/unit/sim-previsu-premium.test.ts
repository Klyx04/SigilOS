/**
 * Gardes — **Lot 3b : prévisu de dégâts « premium » de la simulation tactique**.
 *
 * 🎯 Retour user (21/09/2026, verbatim) : « inutile d'afficher dans le dropdown de sort les sorts
 * qui ne font pas de dégâts · dropdown moche à revoir avec ses icônes, compatible white/dark mode ·
 * composant laid, le bloc placement loot toggle laid, obligé de dézoomer et scroller en dehors du
 * composant pour aller chercher la légende · on voit pas quand on touche les cibles, estimat damage
 * mais que c'est nul ! ».
 *
 * 📐 Règle du jeu appliquée (source citée, recopiée sans interprétation —
 * `dofuspourlesnoobs.com/les-dommages.html` § DÉGÂTS DE ZONE) :
 *   « Dégâts réels = Dégâts finaux * (10-Eloignement)/10 », l'éloignement étant « le nombre minimal
 *     de cases entre la case ciblée par le sort et le personnage qui subit les dégâts ».
 *   Aucune formule de dégâts de **poussée** n'existe dans cette source ⇒ la poussée reste affichée
 *   telle quelle, jamais convertie (aucune valeur inventée).
 *
 * 🛡️ Ce que ce test verrouille : ① la formule de dégressivité (bornes, arrondis, cumul par
 * élément) ; ② les couleurs **réelles du jeu** servies par une source unique (`dofusStatHex`) ;
 * ③ l'application par cible dans la grille (origine = case VISÉE) + la « cible blanche » ;
 * ④ le panneau de prévisu monté DANS le plateau ; ⑤ le sélecteur de sort unique aux deux modes,
 * filtré sur les sorts qui tapent ; ⑥ les libellés FR **et** EN.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    ZONE_FALLOFF_RANGE,
    applyZoneFalloff,
    zoneFalloffFactor,
    zoneFalloffPercent,
    zoneLinesAtOffset,
    zoneOffsetBetween,
    zoneTotalAtOffset,
} from "@/lib/dofus-zone-damage";
import { DOFUSBOOK_COLORS, dofusStatHex, getDofusStatNumberColor } from "@/lib/dofus-stats-theme";
import type { SpellDamageLine } from "@/lib/dofus-spells";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
    readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Version BRUTE (commentaires conservés) : la source de la règle doit rester citée. */
const LIB_RAW = readFileSync("src/lib/dofus-zone-damage.ts", "utf8");
const GRID = codeOf("src/components/succes/SpellRangeGrid.tsx");
const PICKER = codeOf("src/components/succes/SimulationSpellPicker.tsx");
const HUD = codeOf("src/components/succes/SimulationDamageHud.tsx");
const THEME = codeOf("src/lib/dofus-stats-theme.ts");
const FR = codeOf("src/lib/i18n/locales/fr.ts");
const EN = codeOf("src/lib/i18n/locales/en.ts");

const dmgLine = (element: SpellDamageLine["element"], min: number, max: number): SpellDamageLine => ({
    element,
    min,
    max,
    lines: 1,
});

describe("règle du jeu — dégressivité des dégâts de zone", () => {
    it("la formule du jeu est citée à la source (aucune règle inventée)", () => {
        expect(LIB_RAW).toMatch(/dofuspourlesnoobs\.com\/les-dommages\.html/);
        expect(LIB_RAW).toMatch(/\(10-Eloignement\)\/10/);
        expect(ZONE_FALLOFF_RANGE).toBe(10);
    });

    it("le facteur vaut (10 − éloignement)/10, borné à [0, 1]", () => {
        expect(zoneFalloffFactor(0)).toBe(1);
        expect(zoneFalloffFactor(-3)).toBe(1);
        expect(zoneFalloffFactor(1)).toBeCloseTo(0.9, 6);
        expect(zoneFalloffFactor(5)).toBeCloseTo(0.5, 6);
        expect(zoneFalloffFactor(9)).toBeCloseTo(0.1, 6);
        // Au palier 10 la cible ne subit plus rien — et jamais une valeur négative.
        expect(zoneFalloffFactor(10)).toBe(0);
        expect(zoneFalloffFactor(25)).toBe(0);
        expect(zoneFalloffPercent(3)).toBe(70);
    });

    it("applique la dégressivité en tronquant (convention Dofus)", () => {
        expect(applyZoneFalloff(100, 200, 0)).toEqual({ min: 100, max: 200 });
        expect(applyZoneFalloff(100, 200, 5)).toEqual({ min: 50, max: 100 });
        expect(applyZoneFalloff(13, 17, 3)).toEqual({ min: 9, max: 11 });
        expect(applyZoneFalloff(100, 200, 10)).toEqual({ min: 0, max: 0 });
    });

    it("corrige chaque ligne d'élément et leur total", () => {
        const lines = [dmgLine("feu", 100, 200), dmgLine("eau", 50, 50)];
        const scaled = zoneLinesAtOffset(lines, 2); // 80 %
        expect(scaled.map((l) => [l.min, l.max])).toEqual([[80, 160], [40, 40]]);
        expect(zoneTotalAtOffset(lines, 2)).toEqual({ min: 120, max: 200 });
        expect(zoneTotalAtOffset(lines, 0)).toEqual({ min: 150, max: 250 });
    });

    it("mesure l'éloignement depuis la case visée, dans le bon repère", () => {
        // Grille libre : nombre minimal de cases = Manhattan des coordonnées.
        expect(zoneOffsetBetween({ x: 3, y: 3 }, { x: 3, y: 3 }, false)).toBe(0);
        expect(zoneOffsetBetween({ x: 3, y: 3 }, { x: 5, y: 3 }, false)).toBe(2);
        // Map réelle : repère losange du jeu (deux cases voisines à l'écran = 1 pas dans un axe,
        // 2 pas dans l'autre — c'est la géométrie des cases Dofus).
        expect(zoneOffsetBetween({ x: 0, y: 0 }, { x: 0, y: 1 }, true)).toBe(1);
        expect(zoneOffsetBetween({ x: 0, y: 0 }, { x: 1, y: 0 }, true)).toBe(2);
    });

describe("couleurs & icônes « réelles du jeu » — une seule source", () => {
    it("`dofusStatHex` sert la palette DofusBook des 5 éléments", () => {
        expect(dofusStatHex("terre.png")).toBe(DOFUSBOOK_COLORS.force);
        expect(dofusStatHex("feu.png")).toBe(DOFUSBOOK_COLORS.intelligence);
        expect(dofusStatHex("eau.png")).toBe(DOFUSBOOK_COLORS.chance);
        expect(dofusStatHex("air.png")).toBe(DOFUSBOOK_COLORS.agilite);
        expect(dofusStatHex("neutre.png")).toBe(DOFUSBOOK_COLORS.neutre);
        expect(dofusStatHex("inconnu.png")).toBe("#a855f7");
    });

    it("la couleur numérique des stats passe par la MÊME fonction (aucun doublon)", () => {
        expect(THEME).toMatch(/return dofusStatHex\(theme\.asset\);/);
        expect(getDofusStatNumberColor(10, 10)).toBe(DOFUSBOOK_COLORS.force);
    });

    it("la grille colore ses badges SVG par élément via le thème partagé", () => {
        expect(GRID).toMatch(/function elementHex\(element: SpellElementKey\): string \{/);
        expect(GRID).toMatch(/dofusStatHex\(STAT_THEMES\[ELEMENT_STAT_KEY\[element\]\]\.asset\)/);
    });
});

describe("dégressivité appliquée PAR CIBLE sur la grille", () => {
    it("l'origine est la case VISÉE (`zoneAnchor`), matrice unique de la zone", () => {
        expect(GRID).toMatch(/const zoneAnchor = useMemo<DofusPos \| null>\(\(\) => \{/);
        expect(GRID).toMatch(/target: zoneAnchor,/);
        expect(GRID).toMatch(/\}, \[zoneAnchor, currentSpell, casterPos, gridCols, gridRows, isRealMap\]\);/);
    });

    it("chaque cible reçoit son éloignement, ses lignes et son total corrigés", () => {
        expect(GRID).toMatch(/const offset = zoneOffsetBetween\(zoneAnchor, \{ x, y \}, isRealMap\);/);
        expect(GRID).toMatch(/falloff: zoneFalloffPercent\(offset\),/);
        expect(GRID).toMatch(/lines: zoneLinesAtOffset\(damageInfo\.lines, offset\),/);
        expect(GRID).toMatch(/total: zoneTotalAtOffset\(damageInfo\.lines, offset\),/);
    });

    it("la case visée porte la « cible blanche » du jeu, en permanence", () => {
        // Rendu SVG de la cible (anneau + point), hors de l'option de dégâts : on voit TOUJOURS
        // ce qu'on vise (c'est aussi l'origine des dégâts dégressifs).
        expect(GRID).toMatch(/data-zone-anchor="1"/);
        expect(GRID).toMatch(/const isZoneAnchor = zoneAnchor\?\.x === c && zoneAnchor\?\.y === r;/);
        expect(GRID).toMatch(/const isZoneAnchor = zoneAnchor\?\.x === x && zoneAnchor\?\.y === y;/);
        expect(GRID).toMatch(/if \(isZoneAnchor\) \{/);
    });

    it("une cible prise dans la zone est mise en évidence (plus de cible muette)", () => {
        expect(GRID).toMatch(/fillColor = isTokenCell \? "#f2b53a" : "#e0a320";/);
        expect(GRID).toMatch(/if \(isInZone\(c, r\) && !obs && !isCaster\) \{/);
        expect(GRID).toMatch(/if \(isInZone\(x, y\) && !isCaster\) \{/);
    });

    it("le badge d'une cible porte son total, son malus de distance et ses lignes d'élément", () => {
        const layer = GRID.slice(
            GRID.indexOf("{showDamage && damageInfo.lines.length > 0 && zonePreview"),
            GRID.indexOf("</svg>")
        );
        expect(layer).toMatch(/formatDamageRange\(target\.total\.min, target\.total\.max\)/);
        expect(layer).toMatch(/damageFalloffShort\.replace\("\{percent\}", String\(100 - target\.falloff\)\)/);
        expect(layer).toMatch(/elementHex\(line\.element\)/);
        expect(layer).toMatch(/elementIcon\(line\.element\)/);
    });
});

describe("panneau de prévisu (« Dégâts estimés ») — valeur immédiatement lisible", () => {
    it("le panneau est monté DANS le plateau, alimenté par les mêmes données que les badges", () => {
        expect(GRID).toMatch(/<SimulationDamageHud/);
        expect(GRID).toMatch(/variant="board"/);
        expect(GRID).toMatch(/lines=\{damageInfo\.lines\}/);
        expect(GRID).toMatch(/total=\{damageTotal\}/);
        expect(GRID).toMatch(/push=\{damageInfo\.push\}/);
        expect(GRID).toMatch(/targets=\{\{ count: damageTargets\.length, total: damageZoneTotal \}\}/);
    });

    it("le total sur la zone est la somme des cibles corrigées", () => {
        expect(GRID).toMatch(/const damageZoneTotal = useMemo\(/);
        expect(GRID).toMatch(/acc\.min \+ target\.total\.min/);
    });

    it("le panneau montre : jets par élément · total par cible · cibles · poussée · règle", () => {
        expect(HUD).toMatch(/simT\.damageHudTitle/);
        expect(HUD).toMatch(/formatDamageRange\(line\.min, line\.max\)/);
        expect(HUD).toMatch(/simT\.damageHudPerTarget/);
        expect(HUD).toMatch(/simT\.damageHudTargets\.replace\("\{count\}"/);
        expect(HUD).toMatch(/simT\.damageHudRule/);
        expect(HUD).toMatch(/simT\.damagePush\.replace\("\{count\}"/);
        // Aucune valeur inventée : les jets viennent des props, jamais d'une formule locale.
        expect(HUD).not.toMatch(/zoneFalloff|Math\.floor/);
    });
});

describe("légende & prévisu atteignables sans quitter le composant", () => {
    it("les deux panneaux flottent sur le plateau (plus de zoom/défilement à faire)", () => {
        expect(GRID).toMatch(/absolute inset-x-2 bottom-2 z-40 flex items-end justify-between gap-2/);
        // Le panneau ne doit pas intercepter le pan de la carte…
        expect(GRID).toMatch(/pointer-events-none absolute inset-x-2 bottom-2/);
        // …et la légende reprend la main sur ses propres clics.
        expect(codeOf("src/components/succes/SimulationTacticalLegend.tsx")).toMatch(/relative z-30 shrink-0/);
    });
});

describe("sélecteur de sort — une source, filtré sur les sorts qui tapent, thémé", () => {
    it("le même composant sert les deux modes (plus de `<select>` ni de menu recopié)", () => {
        expect((GRID.match(/<SimulationSpellPicker/g) || []).length).toBe(2);
        expect(GRID).toMatch(/variant="page"/);
        expect(GRID).toMatch(/variant="board"/);
        expect(GRID).not.toMatch(/<option key=\{s\.id\}/);
        expect(GRID).not.toMatch(/setIsSpellMenuOpen/);
    });

    it("les sorts sans dégâts sont masqués par défaut, sans perdre la capacité de simuler", () => {
        expect(PICKER).toMatch(/const \[showAll, setShowAll\] = useState\(false\);/);
        expect(PICKER).toMatch(/if \(showAll \|\| withDamage\.length === 0\) return spells;/);
        expect(PICKER).toMatch(/simT\.spellPickerShowAll/);
        expect(PICKER).toMatch(/simT\.spellPickerDamageOnly/);
    });

    it("le menu porte icône, PA/PO, jets par élément et recherche", () => {
        expect(PICKER).toMatch(/formatDamageRange\(line\.min, line\.max\)/);
        expect(PICKER).toMatch(/style=\{\{ color: dofusStatHex\(theme\.asset\) \}\}/);
        expect(PICKER).toMatch(/simT\.spellPickerSearch/);
        expect(PICKER).toMatch(/rangeLabel\(spell\)/);
    });

    it("thème clair ET sombre : surface thémée en fiche, palette du plateau en vue de jeu", () => {
        expect(PICKER).toMatch(/border-border bg-popover/);
        expect(PICKER).toMatch(/border-white\/15 bg-\[#121218\]\/97/);
    });
});

describe("libellés — FR et EN", () => {
    it("les clés du Lot 3b existent dans les deux langues", () => {
        for (const locale of [FR, EN]) {
            expect(locale).toMatch(/spellPickerSearch: "/);
            expect(locale).toMatch(/spellPickerEmpty: "/);
            expect(locale).toMatch(/spellPickerShowAll: "/);
            expect(locale).toMatch(/spellPickerDamageOnly: "/);
            expect(locale).toMatch(/spellPickerCount: "/);
            expect(locale).toMatch(/damageHudTitle: "/);
            expect(locale).toMatch(/damageHudPerTarget: "/);
            expect(locale).toMatch(/damageHudTargets: "/);
            expect(locale).toMatch(/damageHudRule: "/);
            expect(locale).toMatch(/damageFalloffShort: "/);
            expect(locale).toMatch(/targetCell: "/);
        }
    });
});

});
