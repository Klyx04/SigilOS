/**
 * Garde — **le squelette du studio God Rush** (lot E1, 05/11/2026).
 *
 * 🎯 Ce que le lot livre : un studio **3 panneaux** (arbre / liste / inspecteur), une
 * barre unique, une recherche, `Ctrl+K`, une garde de sauvegarde et le responsive
 * (arbre en `Sheet` < 1024, inspecteur en `Sheet` < 768). Les formulaires existants
 * sont **montés dans l'inspecteur** — plus aucun dans la liste.
 *
 * 🛡️ Deux niveaux de preuve :
 *   ① le **comportement** des règles (arbre, recherche, filtres, sélection) est testé
 *      dans `rush-editor-selection.test.ts` ;
 *   ② ce fichier tient le **câblage** : panneaux, seuils, palette, garde, plafond God,
 *      DA des fichiers neufs et dette restante du studio.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const EDITOR_DIR = "src/components/god/rush-editor";
const SHELL = codeOf(`${EDITOR_DIR}/RushEditorShell.tsx`);
const TOPBAR = codeOf(`${EDITOR_DIR}/RushEditorTopbar.tsx`);
const TREE = codeOf(`${EDITOR_DIR}/RushEditorTree.tsx`);
const INSPECTOR = codeOf(`${EDITOR_DIR}/RushEditorInspector.tsx`);
const PALETTE = codeOf(`${EDITOR_DIR}/RushEditorCommandPalette.tsx`);
const STUDIO = codeOf(`${EDITOR_DIR}/RushEditorStudio.tsx`);
const APP_SHELL = codeOf("src/app/god/rush-sylvestre/RushSylvestreAdminClient.tsx");

/** Bloc source : du marqueur `start` au marqueur `end`. */
function blockOf(code: string, start: string, end: string): string {
  const from = code.indexOf(start);
  expect(from, `marqueur introuvable : ${start}`).toBeGreaterThan(-1);
  const to = code.indexOf(end, from + start.length);
  expect(to, `marqueur de fin introuvable : ${end}`).toBeGreaterThan(from);
  return code.slice(from, to);
}

describe("E1 — trois panneaux nommés", () => {
  it("la coquille monte l'arbre, la liste et l'inspecteur", () => {
    expect(SHELL).toContain('aria-label="Arbre du guide"');
    expect(SHELL).toContain('aria-label="Contenu du chapitre"');
    expect(SHELL).toContain('aria-label="Panneau d\'édition"');
  });

  it("les trois colonnes n'existent qu'à partir de 1280 px (puis 2 colonnes dès 768)", () => {
    // Retour user du 10/11 : à 1024–1279, les 3 colonnes laissaient ~380 px au contenu
    // et ~360 px à l'inspecteur. Le seuil passe à 1280 et l'inspecteur gagne 100–140 px.
    expect(SHELL).toContain("xl:grid-cols-[260px_minmax(0,1fr)_minmax(460px,560px)]");
    expect(SHELL).toContain("md:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]");
  });

  it("le studio ne monte la coquille que sur l'onglet Contenu", () => {
    expect(STUDIO).toMatch(/activeTab === "content" && \(\s*<RushEditorShell/);
  });
});

describe("E1 — responsive : arbre < 1280, inspecteur < 768", () => {
  it("les deux seuils sont mesurés, pas devinés", () => {
    expect(SHELL).toContain("useBelowWidth(1280)");
    expect(SHELL).toContain("useBelowWidth(768)");
    expect(SHELL).toContain("window.matchMedia(");
  });

  it("chaque tiroir est un `Sheet` avec un titre accessible", () => {
    expect((SHELL.match(/<Sheet /g) ?? []).length).toBe(2);
    expect(SHELL).toContain("<SheetTitle>Arbre du guide</SheetTitle>");
    expect(SHELL).toContain("<SheetTitle>Inspecteur</SheetTitle>");
  });
});

describe("E1 — recherche, filtres, Ctrl+K, garde", () => {
  it("la barre unique porte la recherche et l'ouverture de la palette", () => {
    expect(TOPBAR).toContain("Rechercher une quête ou un bloc");
    expect(TOPBAR).toContain("Ctrl K");
    expect(TOPBAR).toContain("onOpenPalette");
  });

  it("l'arbre filtre par cité, Ordre, classe et « sans conseil »", () => {
    expect(TREE).toContain('aria-label="Filtrer par cité"');
    expect(TREE).toContain('aria-label="Filtrer par Ordre"');
    expect(TREE).toContain('aria-label="Filtrer par classe"');
    expect(TREE).toContain("Quêtes sans conseil");
    expect(TREE).toContain("RUSH_ORDER_CODES");
    expect(TREE).toContain("DOFUS_CLASSES");
  });

  it("Ctrl+K ouvre la palette, montée par le studio", () => {
    expect(SHELL).toContain('event.key.toLowerCase() === "k"');
    expect(SHELL).toContain("onOpenPalette()");
    expect(STUDIO).toContain("<RushEditorCommandPalette");
    expect(STUDIO).toContain("commands={editor.commands}");
  });

  it("la garde de sortie est montée et couvre bloc ET quête", () => {
    expect(STUDIO).toContain("<UnsavedChangesGuard hasUnsavedChanges={hasUnsavedChanges} />");
    expect(STUDIO).toContain("blockDirty || sequenceDirty");
    expect(STUDIO).toContain("onDirtyChange={setSequenceDirty}");
  });

  it("changer de cible avec une saisie passe par une modale, jamais `confirm()`", () => {
    expect(STUDIO).toContain("pendingSwitch");
    expect(STUDIO).toContain("Modifications non enregistrées");
    expect(STUDIO).not.toMatch(/\bconfirm\(/);
  });
});

describe("E1 — aucun formulaire dans la liste", () => {
  it("les formulaires ne sont montés qu'une fois, dans l'inspecteur", () => {
    expect((STUDIO.match(/<SequenceEditForm/g) ?? []).length).toBe(1);
    expect((STUDIO.match(/<AddSequenceForm/g) ?? []).length).toBe(1);
    expect((STUDIO.match(/<BlockInspectorForm/g) ?? []).length).toBe(1);
    expect(STUDIO).toContain("<RushEditorInspector title={inspectorTitle}");
  });

  it("la ligne de bloc ne contient plus aucun formulaire", () => {
    const row = blockOf(STUDIO, "function MilestoneRow(", "function RushClassSelect");
    expect(row).not.toContain("<SequenceEditForm");
    expect(row).not.toContain("<AddSequenceForm");
    expect(row).not.toContain("<BlockInspectorForm");
    // Elle ouvre la sélection : c'est l'inspecteur qui édite.
    expect(row).toContain("onSelectQuest");
    expect(row).toContain("onAddSequence");
  });
});

describe("E1 — plafond God et coquille mince", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full.replace(/\\/g, "/")];
    });
  }

  it("aucun fichier neuf dans src/app/god (plafond 77)", () => {
    const godFiles = walk("src/app/god").filter((file) => /\.tsx?$/.test(file));
    expect(godFiles.length).toBeLessThanOrEqual(77);
  });

  it("l'app file n'est plus qu'un ré-export", () => {
    expect(APP_SHELL.split("\n").length).toBeLessThan(20);
    expect(APP_SHELL).toContain(
      'export { RushSylvestreAdminClient } from "@/components/god/rush-editor/RushEditorStudio"',
    );
  });
});

describe("E1 — DA des fichiers neufs et dette restante", () => {
  /** Motifs interdits par `docs/RULES.md` § UI (la reprise complète est le lot E4). */
  const FORBIDDEN = /font-black|tracking-widest|backdrop-blur|rounded-3xl|(?:bg|text|border|from|to|ring)-(?:zinc|emerald|purple|pink|indigo|amber|slate|gray)-/;

  it("les cinq fichiers neufs sont aux tokens (aucun motif interdit)", () => {
    for (const [name, code] of [
      ["RushEditorShell.tsx", SHELL],
      ["RushEditorTopbar.tsx", TOPBAR],
      ["RushEditorTree.tsx", TREE],
      ["RushEditorInspector.tsx", INSPECTOR],
      ["RushEditorCommandPalette.tsx", PALETTE],
    ] as const) {
      expect(code, `${name} contient un motif UI interdit`).not.toMatch(FORBIDDEN);
    }
  });

  it("la dette du studio ne remonte pas (compteur mesuré, il ne peut que décroître)", () => {
    // Mesure du 05/11/2026 après E1 : 644 occurrences des 8 motifs dans le studio.
    // Le lot E4 doit amener ce nombre à 0 ; toute hausse est une régression.
    const LEGACY_PATTERNS = /font-black|tracking-widest|zinc-|emerald-|purple-|pink-|rounded-3xl|backdrop-blur/g;
    expect((STUDIO.match(LEGACY_PATTERNS) ?? []).length).toBeLessThanOrEqual(644);
  });
});
