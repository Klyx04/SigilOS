/**
 * Garde — **inspecteur de bloc** du studio Rush (E3a, 12/11/2026).
 *
 * 🎯 Mesures du 12/11/2026 :
 *   · la **route du bloc** (cité / Ordre / palier / classe) ne vivait que dans la ligne
 *     dépliée de la liste — un formulaire au milieu d'une liste, exactement ce qu'E1 avait
 *     supprimé pour les quêtes ;
 *   · le **séparateur** gardait son édition **inline** dans la liste : dernier formulaire
 *     de la liste, et l'inspecteur refusait de le prendre (`!isSeparatorMilestone`) ;
 *   · les **quêtes du bloc** n'étaient visibles qu'en dépliant la ligne.
 *
 * 🛡️ Le verrou tient le déplacement : la route est rendue **dans** `BlockInspectorForm` et
 * **plus** dans `MilestoneRow`, et un séparateur s'ouvre comme n'importe quel bloc.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const STUDIO = readFileSync("src/components/god/rush-editor/RushEditorStudio.tsx", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Bloc source : du marqueur `start` au marqueur `end`. */
function blockOf(code: string, start: string, end: string): string {
  const from = code.indexOf(start);
  expect(from, `marqueur introuvable : ${start}`).toBeGreaterThan(-1);
  const to = code.indexOf(end, from + start.length);
  expect(to, `marqueur de fin introuvable : ${end}`).toBeGreaterThan(from);
  return code.slice(from, to);
}

const INSPECTOR = blockOf(STUDIO, "function BlockInspectorForm(", "function MilestoneRow(");
const BLOCK_ROW = blockOf(STUDIO, "function MilestoneRow(", "function RushRouteBlockBar");

describe("inspecteur de bloc — la route est dans le panneau", () => {
  it("le panneau monte la barre de route du bloc", () => {
    expect(INSPECTOR).toContain("<RushRouteBlockBar");
    expect(INSPECTOR).toContain("onApply={onApplyBlockRoute}");
  });

  it("la ligne de bloc ne porte plus la route (plus de formulaire dans la liste)", () => {
    expect(BLOCK_ROW).not.toContain("<RushRouteBlockBar");
  });

  it("aucune autre barre de route n'est montée dans le studio", () => {
    expect((STUDIO.match(/<RushRouteBlockBar/g) ?? []).length).toBe(1);
  });
});

describe("inspecteur de bloc — le séparateur s'édite ici", () => {
  it("l'inspecteur ne refuse plus les séparateurs", () => {
    expect(STUDIO).toContain("const blockBeingEdited = editingMilestone;");
    expect(STUDIO).not.toMatch(/blockBeingEdited = editingMilestone && !isSeparatorMilestone/);
  });

  it("la ligne de séparateur n'a plus d'édition inline", () => {
    const separator = blockOf(STUDIO, "function SeparatorRowAdmin(", "function SortableMilestoneRow(");
    expect(separator).not.toContain("onEditChange");
    expect(separator).not.toContain("isEditing");
    // Le crayon ouvre l'inspecteur, il n'édite plus sur place.
    expect(separator).toContain("onClick={onSelect}");
  });

  it("le panneau monte l'éditeur de métadonnées en mode séparateur", () => {
    expect(INSPECTOR).toContain("isSeparator={true}");
    expect(INSPECTOR).toContain("onEditChange({ description: updated })");
  });
});

describe("inspecteur de bloc — les quêtes du bloc", () => {
  it("elles sont listées et cliquables", () => {
    expect(INSPECTOR).toContain("Quêtes du bloc (");
    expect(INSPECTOR).toContain("onClick={() => onSelectQuest(seq.id)}");
  });

  it("un bloc vide le dit, et on peut ajouter une quête sans quitter le panneau", () => {
    expect(INSPECTOR).toContain("Aucune quête : ce bloc est vide.");
    expect(INSPECTOR).toContain("onClick={onAddSequence}");
  });
});
