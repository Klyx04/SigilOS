/**
 * Garde — **actions de masse du studio Rush** (E3c, 12/11/2026).
 *
 * 🎯 Ce que le lot devait rendre possible, mesuré avant : le studio ne modifiait
 * qu'une quête ou un bloc à la fois (`useRushEditorSelection` = sélection unique,
 * `updateRushBlockRoute` = un seul bloc). Pour changer la route de 30 quêtes, il
 * fallait 30 gestes.
 *
 * 🛡️ Ce fichier tient le **câblage** et les gardes serveur :
 *  ① trois actions existent (route / déplacement / suppression) ;
 *  ② chacune est bornée (200 ids max), rate-limitée et journalisée ;
 *  ③ chacune vérifie l'appartenance au guide `rush-sylvestre` **avant** d'écrire ;
 *  ④ le studio monte les cases, la barre d'actions et les trois handlers.
 *
 * Le comportement des règles de sélection vit dans `rush-bulk-selection.test.ts`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const ACTIONS = codeOf("src/server/actions/optimized-guide-actions.ts");
const STUDIO = codeOf("src/components/god/rush-editor/RushEditorStudio.tsx");

function blockOf(code: string, start: string, end: string): string {
  const from = code.indexOf(start);
  expect(from, `marqueur introuvable : ${start}`).toBeGreaterThan(-1);
  const to = code.indexOf(end, from + start.length);
  expect(to, `marqueur de fin introuvable : ${end}`).toBeGreaterThan(from);
  return code.slice(from, to);
}

const INSPECTOR = blockOf(STUDIO, "function BlockInspectorForm(", "function MilestoneRow(");

describe("E3c — trois actions de masse, une par geste", () => {
  it("route, déplacement et suppression existent côté serveur", () => {
    expect(ACTIONS).toMatch(/export async function bulkUpdateRushSequencesRoute/);
    expect(ACTIONS).toMatch(/export async function bulkMoveRushSequences/);
    expect(ACTIONS).toMatch(/export async function bulkDeleteRushSequences/);
  });

  it("la sélection est bornée à 200 ids, sans doublon", () => {
    expect(ACTIONS).toContain("const RushSequenceSelectionSchema");
    expect(ACTIONS).toContain(".max(200)");
    expect(ACTIONS).toContain('"Sélection avec doublons"');
  });

  it("chaque action passe par le rate limit Redis et le journal God", () => {
    for (const scope of ["rush-bulk-route", "rush-bulk-move", "rush-bulk-delete"]) {
      expect(ACTIONS).toContain(`requireRushWriteAccess("${scope}"`);
    }
    expect(ACTIONS).toContain('op: "bulk-route-rush-sequences"');
    expect(ACTIONS).toContain('op: "bulk-move-rush-sequences"');
    expect(ACTIONS).toContain('op: "bulk-delete-rush-sequences"');
  });

  it("chaque action vérifie l'appartenance au guide AVANT d'écrire", () => {
    const route = blockOf(ACTIONS, "export async function bulkUpdateRushSequencesRoute", "export async function bulkMoveRushSequences");
    const move = blockOf(ACTIONS, "export async function bulkMoveRushSequences", "export async function bulkDeleteRushSequences");
    const del = blockOf(ACTIONS, "export async function bulkDeleteRushSequences", "export async function deleteRushSequence");

    for (const body of [route, move, del]) {
      expect(body).toContain('guide: { slug: "rush-sylvestre" }');
      expect(body).toContain("$transaction");
    }
    expect(route.indexOf('guide: { slug: "rush-sylvestre" }')).toBeLessThan(route.indexOf("updateMany("));
    expect(move.indexOf('guide: { slug: "rush-sylvestre" }')).toBeLessThan(move.indexOf("updateMany("));
    expect(del.indexOf('guide: { slug: "rush-sylvestre" }')).toBeLessThan(del.indexOf("deleteMany("));
  });

  it("un id hors guide annule toute l'écriture (fail-closed)", () => {
    expect(ACTIONS).toContain("n'appartiennent pas au guide Rush");
    expect(ACTIONS).toContain("rien n'a été appliqué");
    expect(ACTIONS).toContain("rien n'a été déplacé");
    expect(ACTIONS).toContain("rien n'a été supprimé");
  });
});

describe("E3c — le studio coche et agit en masse", () => {
  it("les trois actions sont importées par le studio", () => {
    expect(STUDIO).toContain("bulkUpdateRushSequencesRoute");
    expect(STUDIO).toContain("bulkMoveRushSequences");
    expect(STUDIO).toContain("bulkDeleteRushSequences");
  });

  it("l'inspecteur de bloc monte les cases et la barre d'actions", () => {
    expect(INSPECTOR).toContain("<Checkbox");
    expect(INSPECTOR).toContain('aria-label="Tout sélectionner"');
    expect(INSPECTOR).toContain("Sélectionner ");
    expect(INSPECTOR).toContain("sélectionnée");
    expect(INSPECTOR).toContain("Déplacer vers");
    expect(INSPECTOR).toContain("Supprimer la sélection");
  });

  it("les trois gestes sont branchés sur les handlers du studio", () => {
    expect(INSPECTOR).toContain("onBulkRoute");
    expect(INSPECTOR).toContain("onBulkMove");
    expect(INSPECTOR).toContain("onBulkDelete");
    expect(STUDIO).toContain("handleBulkRoute");
    expect(STUDIO).toContain("handleBulkMove");
    expect(STUDIO).toContain("handleBulkDelete");
  });

  it("la barre de route dit qu'elle vise la sélection", () => {
    expect(INSPECTOR).toContain("Route de la sélection");
    expect(INSPECTOR).toContain("Appliquer à la sélection");
    expect(INSPECTOR).toContain('scopeLabel={bulk.count > 0 ? "de la sélection" : undefined}');
  });
});
