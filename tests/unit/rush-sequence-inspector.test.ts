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
