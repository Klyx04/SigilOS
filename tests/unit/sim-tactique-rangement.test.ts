/**
 * Gardes — **Lot 1 « rangement pro » de la Simulation tactique** (`SpellRangeGrid`, 4 surfaces).
 *
 * 🎯 Retour user (21/09/2026, verbatim) : « le composant complet peut être déplacé en maintenant
 * enfoncé la souris c pas normal » · « c trop le bordel et trop slopesque dans tous les boutons
 * au-dessus le composant, faut un rangement pro » · « le bandeau sort simulé pas intuitif à
 * l'œil on le perd » · « légende bc trop grosse ».
 *
 * 🔍 Ce qui était mesuré : ① le fond noir du plateau était un `<rect>` **à l'intérieur du calque
 * transformé** (pan/zoom) — déplacer la carte déplaçait aussi le fond, d'où l'impression que
 * « le composant complet » bougeait, et le clic-molette armait l'auto-défilement natif du
 * navigateur ; ② le chrome empilait **5 niveaux** au-dessus de la carte, dont les mêmes toggles
 * recopiés en deux versions (compact icônes / complet libellés) ; ③ le sort actif était un
 * `<select>` nu : aucune icône, aucune hiérarchie ; ④ la légende était **dépliée en permanence**
 * en mode complet et **recopiée en français codé en dur** dans le mode compact.
 *
 * 🛡️ Lecture seule : on verrouille le câblage des sources (commentaires retirés). Aucune base.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const GRID = codeOf("src/components/succes/SpellRangeGrid.tsx");
const LEGEND = codeOf("src/components/succes/SimulationTacticalLegend.tsx");
const FR = codeOf("src/lib/i18n/locales/fr.ts");
const EN = codeOf("src/lib/i18n/locales/en.ts");

describe("pan — le fond du plateau ne voyage plus avec la carte", () => {
  it("le fond sombre est porté par le CONTENEUR (fixe), plus par le SVG transformé", () => {
    expect(GRID).toMatch(/relative w-full min-h-0 bg-\[#050505\]/);
    expect(GRID).not.toMatch(/<rect[^>]*fill="#050505"/);
  });

  it("le clic-molette n'arme plus l'auto-défilement natif du navigateur", () => {
    const block = GRID.slice(
      GRID.indexOf("const handlePointerDown ="),
      GRID.indexOf("const handlePointerMove =")
    );
    expect(block).toMatch(/if \(e\.button !== 0 && e\.button !== 1\) return;/);
    expect(block).toMatch(/e\.preventDefault\(\);/);
  });
});

describe("rangement — un panneau « Options », une seule source pour les deux modes", () => {
  it("les DEUX modes portent le bouton Options et son panneau", () => {
    expect((GRID.match(/onClick=\{\(\) => setShowOptions\(\(v\) => !v\)\}/g) || []).length).toBe(2);
    expect((GRID.match(/aria-expanded=\{showOptions\}/g) || []).length).toBe(2);
    // Les panneaux sont hors du pan handler (le glisser ne doit pas les emporter).
    expect((GRID.match(/data-no-drag/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((GRID.match(/\{showOptions && \(/g) || []).length).toBe(2);
  });

  it("le panneau est replié par défaut et signale les réglages actifs", () => {
    expect(GRID).toMatch(/const \[showOptions, setShowOptions\] = useState<boolean>\(false\);/);
    expect(GRID).toMatch(/const activeOptionCount = \[/);
    expect((GRID.match(/\{activeOptionCount > 0 && \(/g) || []).length).toBe(2);
  });

  it("la rangée compacte garde zoom + Options + Recentrer (le reste est derrière)", () => {
    const start = GRID.indexOf("relative flex items-center justify-between gap-1 flex-wrap text-[10px]");
    const end = GRID.indexOf('className="absolute right-0 top-full z-50 mt-1.5 w-[18rem]', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const row = GRID.slice(start, end);
    expect(row).toMatch(/title="Zoom arrière"/);
    expect(row).toMatch(/\{simT\.options\}/);
    expect(row).toMatch(/onClick=\{recenter\}/);
  });

  it("le Recentrer du mode compact n'est plus recopié dans le panneau", () => {
    expect((GRID.match(/title="Recentrer le boss"/g) || []).length).toBe(1);
  });
});

describe("sort actif — identifiable d'un coup d'œil", () => {
  /** Bloc du sort actif (markup seul : les commentaires sont retirés en amont). */
  const spellBlock = () => {
    const start = GRID.indexOf("flex min-w-0 shrink items-center gap-2.5 rounded-xl border border-warning/25");
    // Fin du bloc : la barre d'outils se referme AVANT le plateau. La légende n'est plus un frère
    // du bandeau (elle vit dans `legendPanel`, source unique partagée avec le rail de la modale
    // plein écran) ⇒ c'est le plateau qui borne désormais la fin du bloc.
    const end = GRID.indexOf(
      "relative rounded-xl bg-[#161614] border border-white/10 flex flex-col items-center select-none shadow-inner",
      start
    );
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return GRID.slice(start, end);
  };

  it("le bandeau porte l'icône du sort, son nom et ses propriétés", () => {
    const block = spellBlock();
    expect(block).toMatch(/currentSpell\?\.imageUrl \?/);
    expect(block).toMatch(/\{simT\.simulatedSpell\}/);
    expect(block).toMatch(/aria-label=\{simT\.selectSpell\}/);
    expect(block).toMatch(/border-warning\/25/);
  });

  it("la ligne de vue n'est affichée QUE par exception (le défaut ne fait pas de bruit)", () => {
    const block = spellBlock();
    expect(block).toMatch(/\{!castTestLos && \(/);
    expect(block).not.toMatch(/castTestLos \? simT\.los : simT\.noLos/);
  });
});

describe("légende — une seule surface, repliée par défaut, i18n", () => {
  it("SpellRangeGrid ne rend plus DEUX légendes : il monte le composant partagé", () => {
    expect(GRID).toMatch(
      /import \{ SimulationTacticalLegend \} from "@\/components\/succes\/SimulationTacticalLegend";/
    );
    expect(GRID).toMatch(/<SimulationTacticalLegend/);
    // La légende est montée en **overlay du plateau** (`board`) : elle ne pousse plus la carte et
    // reste atteignable sans dézoomer ni défiler (retour user 21/09/2026).
    expect(GRID).toMatch(/variant="board"/);
    expect(GRID).not.toMatch(/setShowCompactLegend/);
  });

  it("repliée par défaut dans les deux modes", () => {
    expect(GRID).toMatch(/const \[showLegend, setShowLegend\] = useState<boolean>\(false\);/);
    expect(GRID).toMatch(/onToggle=\{\(\) => setShowLegend\(\(v\) => !v\)\}/);
    expect(LEGEND).toMatch(/aria-expanded=\{open\}/);
    expect(LEGEND).toMatch(/\{open && \(/);
  });

  it("plus aucun libellé français codé en dur dans la légende", () => {
    for (const hardCoded of [
      "Boss (lanceur)",
      "Joueur (allié)",
      "Départ Joueurs",
      "Départ Monstres",
      "Touché par zone",
      "Portée du sort",
    ]) {
      expect(LEGEND, hardCoded).not.toContain(hardCoded);
    }
    expect(LEGEND).toMatch(/simT\.legend\.startPlayers/);
    expect(LEGEND).toMatch(/simT\.legendGroups\.cells/);
  });

  it("les 3 familles et les nouveaux libellés existent en FR ET en EN", () => {
    for (const locale of [FR, EN]) {
      expect(locale).toMatch(/options: "Options",/);
      expect(locale).toMatch(/optionsTitle: "/);
      expect(locale).toMatch(/legendTitle: "/);
      expect(locale).toMatch(/legendGroups: \{/);
      expect(locale).toMatch(/cells: "/);
      expect(locale).toMatch(/targeting: "/);
      expect(locale).toMatch(/states: "/);
    }
  });
});

