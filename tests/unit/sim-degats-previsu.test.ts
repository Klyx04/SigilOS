/**
 * Gardes — **Lot 3a : prévisu de DÉGÂTS** de la simulation tactique.
 *
 * 🎯 Demande user (21/09/2026, verbatim) : « pk afficher les dégâts en preview (option à activer ?)
 * quand une cible est visée avec un sort boss ? · il faudrait revoir les couleurs, les sorts simulés,
 * les zones · les dégâts dégressifs en zone · calculer les dégâts poussés si y a sorts de poussée ·
 * un meilleur visuel premium … il faudrait peut-être proposer la même chose dans le composant des
 * stuff en prenant en compte les dégâts dégressifs, zone, la FM global/par item ».
 *
 * 🔍 Mesure : les jets numériques existaient déjà (le serveur applique les caractéristiques du
 * monstre avec `floor(jet × (1 + carac/100))`), mais ils n'étaient **que dans le texte** des effets
 * (`collectEffectDetails` ne gardait que `label/duration/triggers/masks`) ⇒ impossible d'afficher
 * une fourchette de dégâts sur la grille sans re-parser du texte côté client.
 *
 * 🛡️ Ce que ce test verrouille : ① l'extraction du **jet numérique** par effet (min/max + élément)
 * et son **agrégation par élément** (mêmes règles que la fiche Dofus) ; ② la **poussée** lue sur les
 * paramètres, jamais calculée (aucune formule inventée) ; ③ l'option « Dégâts estimés » **allumée par
 * défaut** (retour user 22/09/2026 : « on voit rien au degat sur les autres » + « toggle degat estimé
 * de 0 »), montée dans la **barre d'outils** des DEUX modes, et les badges limités à la cible visée +
 * aux personnages dans la zone ; ④ les couleurs/icônes d'éléments viennent du **thème de stats
 * partagé** (aucune couleur d'élément codée en dur) ; ⑤ les libellés existent en FR ET en EN.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    damageRangeOfEffect,
    pushDistanceOfEffect,
} from "@/lib/dofus-monster-damage";
import {
    damageLinesFromEffects,
    formatDamageRange,
    totalDamageRange,
} from "@/lib/dofus-spells";

/** Effet Dofensive minimal (params = jets, label technique = autorité pour l'élément). */
const dmgEffect = (label: string, values: number[]) => ({
    TechnicalLabel: label,
    Name: label,
    Parameters: values.map((v) => ({ Name: String(v), Value: v })),
});

describe("jet numérique d'un effet (dégâts réels du grade)", () => {
    it("rend min/max et l'élément d'une ligne de dommages", () => {
        expect(damageRangeOfEffect(dmgEffect("ACTION_CHARACTER_LIFE_POINTS_LOST_FROM_FIRE", [666, 774]))).toEqual({
            element: "fire",
            min: 666,
            max: 774,
        });
    });

    it("un seul jet ⇒ min === max (jamais une fourchette inventée)", () => {
        expect(damageRangeOfEffect(dmgEffect("ACTION_CHARACTER_LIFE_POINTS_LOST_FROM_EARTH", [120]))).toEqual({
            element: "earth",
            min: 120,
            max: 120,
        });
    });

    it("ignore ce qui n'est pas un dommage élémentaire (soin, poussée, pourcentage, état)", () => {
        expect(damageRangeOfEffect(dmgEffect("ACTION_CHARACTER_LIFE_POINTS_WIN", [100]))).toBeNull();
        expect(damageRangeOfEffect(dmgEffect("ACTION_CHARACTER_LIFE_POINTS_LOST_PERCENT", [10]))).toBeNull();
        expect(damageRangeOfEffect(dmgEffect("ACTION_CHARACTER_LIFE_POINTS_LOST_FROM_AIR", []))).toBeNull();
        expect(damageRangeOfEffect(null)).toBeNull();
    });

    it("reconnaît la poussée et sa distance sans jamais la convertir en dégâts", () => {
        expect(pushDistanceOfEffect(dmgEffect("ACTION_CHARACTER_PUSH", [3]))).toBe(3);
        expect(pushDistanceOfEffect(dmgEffect("ACTION_CHARACTER_LIFE_POINTS_LOST_FROM_FIRE", [10]))).toBeNull();
    });
});

describe("agrégation par élément (mêmes règles que la fiche Dofus)", () => {
    const effects = [
        { damage: { element: "fire", min: 666, max: 774 }, pushDistance: null },
        { damage: { element: "fire", min: 100, max: 120 }, pushDistance: null },
        { damage: { element: "earth", min: 50, max: 60 }, pushDistance: null },
        { damage: null, pushDistance: 2 },
    ];

    it("cumule les jets d'un MÊME élément et les compte", () => {
        const { lines } = damageLinesFromEffects(effects);
        const fire = lines.find((l) => l.element === "feu");
        expect(fire).toEqual({ element: "feu", min: 766, max: 894, lines: 2, crit: null, decrease: null });
    });

    it("ne mélange jamais deux éléments", () => {
        const { lines } = damageLinesFromEffects(effects);
        expect(lines.map((l) => l.element)).toEqual(["feu", "terre"]);
    });

    it("remonte la distance de poussée, séparément des dégâts", () => {
        expect(damageLinesFromEffects(effects).push).toBe(2);
    });

    it("sans effet exploitable : aucune ligne, aucune poussée", () => {
        expect(damageLinesFromEffects(undefined)).toEqual({ lines: [], push: null });
        expect(damageLinesFromEffects([{ damage: { element: "inconnu", min: 10, max: 20 } }])).toEqual({ lines: [], push: null });
        expect(damageLinesFromEffects([{ damage: { element: "fire", min: 0, max: 0 } }])).toEqual({ lines: [], push: null });
    });

    it("total et format d'affichage", () => {
        const { lines } = damageLinesFromEffects(effects);
        expect(totalDamageRange(lines)).toEqual({ min: 816, max: 954 });
        expect(formatDamageRange(666, 774)).toBe("666–774");
        expect(formatDamageRange(120, 120)).toBe("120");
    });
});

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
    readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const GRID = codeOf("src/components/succes/SpellRangeGrid.tsx");
const THEME = codeOf("src/lib/dofus-stats-theme.ts");
const FR = codeOf("src/lib/i18n/locales/fr.ts");
const EN = codeOf("src/lib/i18n/locales/en.ts");

describe("option « Dégâts estimés » — allumée par défaut, interrupteur visible dans les deux modes", () => {
    it("l'état est ALLUMÉ par défaut et compté dans les réglages actifs", () => {
        // 🔁 22/09/2026 (retour user) : la prévisu n'est plus repliée — elle est visible d'entrée,
        // l'utilisateur ne voyait « rien au degat sur les autres ».
        expect(GRID).toMatch(/const \[showDamage, setShowDamage\] = useState<boolean>\(true\);/);
        expect(GRID).toMatch(/const activeOptionCount = \[[\s\S]{0,220}showDamage,/);
    });

    it("un seul interrupteur, monté dans la barre d'outils des DEUX modes", () => {
        expect(GRID).toMatch(/const damageToggle = \(/);
        // Un seul interrupteur (fonction `damageToggle(board)` : palette du plateau vs thème de page),
        // monté une fois dans le panneau compact et une fois dans le panneau de fiche.
        expect((GRID.match(/\{damageToggle\(/g) || []).length).toBe(2);
        expect(GRID).toMatch(/aria-pressed=\{showDamage\}/);
    });

    it("aucun badge de dégâts tant que l'option est éteinte", () => {
        // La couche de badges est gardée par l'option ET par l'existence de jets réels.
        expect(GRID).toMatch(/\{showDamage && damageInfo\.lines\.length > 0 && zonePreview && \(/);
        // …et elle ne rend QUE les cibles calculées par `damageTargets`.
        const layer = GRID.slice(GRID.indexOf("{showDamage && damageInfo.lines.length > 0 && zonePreview"), GRID.indexOf("</svg>"));
        expect(layer).toMatch(/damageTargets\.map/);
    });

    it("les cibles ne sont que la case visée + les personnages présents dans la zone", () => {
        // La liste des cibles vit dans `damageTargets` (source unique des badges ET du panneau de
        // prévisu) : mêmes garanties qu'avant, un seul endroit à relire.
        const memo = GRID.slice(GRID.indexOf("const damageTargets = useMemo"), GRID.indexOf("const damageToggle"));
        expect(memo).toMatch(/hoveredCell && zonePreview\.has/);
        expect(memo).toMatch(/for \(const ally of allies\)/);
        expect(memo).toMatch(/for \(const enemy of enemies\)/);
    });

    it("les jets affichés viennent du serveur (aucun calcul de dégâts côté client)", () => {
        expect(GRID).toMatch(/damageLinesFromEffects\(currentSpell\?\.effectDetails\)/);
        expect(GRID).not.toMatch(/Math\.floor\([^)]*stat[^)]*\)/);
    });
});

describe("couleurs & icônes d'éléments — une seule source (thème de stats partagé)", () => {
    it("le thème est exporté par `dofus-stats-theme` et importé par la grille", () => {
        expect(THEME).toMatch(/export const STAT_THEMES = \{/);
        expect(GRID).toMatch(/import \{ DOFUS_STAT_ASSET_BASE, STAT_THEMES, dofusStatHex \} from "@\/lib\/dofus-stats-theme";/);
    });

    it("les 5 éléments pointent les entrées du thème (Terre/Feu/Eau/Air/Neutre)", () => {
        expect(GRID).toMatch(/terre: "earthDamage"/);
        expect(GRID).toMatch(/feu: "fireDamage"/);
        expect(GRID).toMatch(/eau: "waterDamage"/);
        expect(GRID).toMatch(/air: "airDamage"/);
        expect(GRID).toMatch(/neutre: "neutralDamage"/);
        // Icônes servies par NOTRE base d'assets (aucune dépendance externe).
        expect(GRID).toMatch(/`\$\{DOFUS_STAT_ASSET_BASE\}\/\$\{STAT_THEMES\[ELEMENT_STAT_KEY\[element\]\]\.asset\}`/);
    });

    it("aucune couleur d'élément codée en dur dans la grille", () => {
        expect(GRID).not.toMatch(/#(?:c53030|79b638|e0a320|f97316|3b82f6)"?[^\n]*élément/i);
        // La couleur vient du jeton du thème, jamais d'un hex d'élément.
        expect(GRID).not.toMatch(/element[^\n]*#[0-9a-fA-F]{6}/);
    });

    it("les libellés existent en FR ET en EN", () => {
        for (const locale of [FR, EN]) {
            expect(locale).toMatch(/damageToggle: "/);
            expect(locale).toMatch(/damageToggleTitle: "/);
            expect(locale).toMatch(/damageUnavailable: "/);
            expect(locale).toMatch(/damagePush: "/);
        }
    });
});

