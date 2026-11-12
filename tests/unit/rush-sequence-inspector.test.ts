/**
 * Garde — **inspecteur quête** du studio Rush (E2b, 12/11/2026).
 *
 * 🎯 Mesures du 12/11/2026 :
 *   · neuf accordéons numérotés 1→9 **dans le désordre logique** (deux portaient le numéro
 *     « 8 »), la **route** — le champ le plus structurant — en 7ᵉ position, après les
 *     ressources et les liens ;
 *   · « Déplacer vers » et « Scinder » vivaient **après** les neuf sections : il fallait
 *     descendre ~1 600 lignes pour déplacer une quête ;
 *   · le pied « Enregistrer » sortait de l'écran dès les premiers champs.
 *
 * 🛡️ Le verrou compare l'**ordre réellement monté** à la règle pure
 * `RUSH_EDITOR_SECTION_GROUPS` : déplacer une section sans mettre à jour la règle casse le
 * test, et inversement. Aucune section ne peut disparaître (compte strict).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  RUSH_EDITOR_SECTION_GROUPS,
  sectionGroupOf,
} from "@/lib/rush-editor-sections";

const STUDIO = readFileSync("src/components/god/rush-editor/RushEditorStudio.tsx", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Position du marqueur `toggleSection("…")` — chaque section en porte un. */
const sectionAt = (id: string) => STUDIO.indexOf(`toggleSection("${id}")`);

describe("inspecteur quête — trois groupes, un seul ordre", () => {
  it("les trois en-têtes de groupe sont montés, dans l'ordre", () => {
    const positions = RUSH_EDITOR_SECTION_GROUPS.map((g) =>
      STUDIO.indexOf(`<SectionGroupHeader group="${g.id}" />`),
    );
    for (const [i, position] of positions.entries()) {
      expect(position, `${RUSH_EDITOR_SECTION_GROUPS[i].id} n'est pas monté`).toBeGreaterThan(-1);
    }
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("les sections suivent l'ordre déclaré par la règle", () => {
    const declared = RUSH_EDITOR_SECTION_GROUPS.flatMap((g) => [...g.sections]);
    const positions = declared.map(sectionAt);
    for (const [i, position] of positions.entries()) {
      expect(position, `section « ${declared[i]} » absente du formulaire`).toBeGreaterThan(-1);
    }
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("aucune section n'a disparu : les neuf accordéons sont là", () => {
    expect((STUDIO.match(/toggleSection\("/g) ?? []).length).toBe(9);
  });

  it("aucun titre de section ne porte de numéro (les 3 groupes les remplacent)", () => {
    // Régression mesurée le 12/11/2026 : après le passage aux groupes, **quatre** titres
    // gardaient leur numéro d'origine (5, 6, 8, 9) sur les neuf — l'inspecteur affichait
    // « 1, 2, 3, 4, 6, 6, 5, 9 ». Ce verrou interdit tout préfixe numérique résiduel.
    expect(STUDIO).not.toMatch(/^\s+\d+\.\s/m);
  });

  it("la route est dans le premier groupe, avant les ressources et les liens", () => {
    expect(sectionGroupOf("route")).toBe("essentiel");
    expect(sectionAt("route")).toBeLessThan(sectionAt("resources"));
    expect(sectionAt("route")).toBeLessThan(sectionAt("links"));
  });
});

describe("inspecteur quête — les gestes ne sont plus au fond", () => {
  it("« Déplacer vers » précède la première section", () => {
    expect(STUDIO).toContain("Déplacer vers");
    expect(STUDIO.indexOf("Déplacer vers")).toBeLessThan(sectionAt("identity"));
  });

  it("la scission est derrière un menu « … », pas un bouton de plus", () => {
    expect(STUDIO).toContain('aria-label="Autres actions de la quête"');
    expect(STUDIO).toContain("setSplitConfirm(true)");
    // Le libellé n'apparaît plus qu'à deux endroits : le menu et la confirmation.
    expect((STUDIO.match(/Scinder en \{seq\.questDbIds\.length\} quêtes individuelles/g) ?? []).length).toBe(1);
  });

  it("le pied est sticky et porte les deux gestes + l'état non enregistré", () => {
    expect(STUDIO).toContain("sticky bottom-0");
    expect(STUDIO).toContain("Enregistrer la quête");
    expect(STUDIO).toContain("● Non enregistré");
  });

  it("plus de pied d'actions en bas de flux", () => {
    expect(STUDIO).not.toContain("Footer Actions");
  });
});

describe("inspecteur quête — le contenant large (E2d)", () => {
  it("le formulaire est monté une seule fois, quel que soit son conteneur", () => {
    // Le studio construit `questForm` puis choisit : panneau, ou modale large.
    expect((STUDIO.match(/<SequenceEditForm/g) ?? []).length).toBe(1);
    expect(STUDIO).toContain("const questForm = selectedQuest && selectedQuestBlock ?");
  });

  it("la modale fait 1 100 px au plus et garde le défilement interne", () => {
    expect(STUDIO).toContain("max-w-[min(1100px,calc(100vw-2rem))]");
    expect(STUDIO).toContain("max-h-[90vh]");
  });

  it("le geste est nommé et réversible", () => {
    expect(STUDIO).toContain("Éditer en plein écran");
    expect(STUDIO).toContain("Réduire l'édition dans le panneau");
  });

  it("changer de quête referme la modale (aucune fiche fantôme)", () => {
    expect(STUDIO).toContain("useEffect(() => { setQuestFullscreen(false); }, [editingSeqId]);");
  });
});

describe("inspecteur quête — la coche ne contredit jamais la route", () => {
  it("le camp d'`alignment_set` est comparé à la cité de la route", () => {
    expect(STUDIO).toContain("alignmentSet && alignmentSetContradictsCamp(alignReq, alignmentSet.camp)");
    expect(STUDIO).toContain("contredit la");
  });
});
