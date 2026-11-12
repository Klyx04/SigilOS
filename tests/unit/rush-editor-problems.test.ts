/**
 * Garde — **panneau « Problèmes »** du studio Rush (E3b, 12/11/2026).
 *
 * 🎯 Mesure du 12/11/2026 : rien dans le studio ne disait ce qui **manque** au contenu.
 * Il fallait déplier les blocs un par un pour voir un conseil vide, une quête sans lien
 * DofusDB, sans ressource, ou une quête d'Ordre sans palier. Branches couvre la **route**,
 * ce module couvre le **contenu** : les deux ne se recouvrent pas.
 *
 * 🛡️ Le comportement de la règle est testé ici ; le câblage de l'onglet est vérifié en fin
 * de fichier (studio + barre), pour qu'un panneau débranché casse le test.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  analyzeRushEditorProblems,
  countRushEditorProblems,
  type RushEditorProblem,
  type RushProblemMilestone,
} from "@/lib/rush-editor-problems";

const seq = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  subGuideName: id,
  tips: "un conseil",
  questDbIds: [1],
  activityTags: [{ type: "item" }],
  ...extra,
});

const fullBlock: RushProblemMilestone = {
  id: "b-ok",
  title: "Bloc complet",
  type: "QUETE_SERIE",
  sequences: [seq("ok-1")],
};

const byKind = (blocks: RushProblemMilestone[]) => {
  const problems = analyzeRushEditorProblems(blocks);
  return Object.fromEntries(problems.map((p) => [p.kind, p])) as Record<string, RushEditorProblem>;
};

describe("problèmes de contenu — les cinq manques", () => {
  it("un bloc sans quête est signalé, sauf un bandeau ou un bloc d'info", () => {
    const kinds = byKind([
      { id: "empty", title: "Vide", type: "QUETE_SERIE", sequences: [] },
      { id: "sep", title: "Bandeau", type: "SEPARATEUR", sequences: [] },
      { id: "info", title: "Conseil", type: "INFO", sequences: [] },
    ]);
    expect(kinds["empty-block"].count).toBe(1);
    expect(kinds["empty-block"].targets).toHaveLength(1);
  });

  it("une quête sans conseil (ou avec des blancs) est signalée", () => {
    const kinds = byKind([
      { id: "b", title: "B", type: "QUETE_SERIE", sequences: [seq("a", { tips: "   " }), seq("b")] },
    ]);
    expect(kinds["quest-without-tips"].count).toBe(1);
  });

  it("une quête sans id DofusDB est signalée", () => {
    const kinds = byKind([
      { id: "b", title: "B", type: "QUETE_SERIE", sequences: [seq("a", { questDbIds: [] }), seq("b")] },
    ]);
    expect(kinds["quest-without-qid"].count).toBe(1);
  });

  it("une quête sans ressource (aucun tag `item`) est signalée", () => {
    const kinds = byKind([
      { id: "b", title: "B", type: "QUETE_SERIE", sequences: [seq("a", { activityTags: [] }), seq("b")] },
    ]);
    expect(kinds["quest-without-resource"].count).toBe(1);
  });

  it("une quête d'Ordre sans palier casse la chaîne des rangs", () => {
    const kinds = byKind([
      {
        id: "b",
        title: "B",
        type: "QUETE_SERIE",
        sequences: [
          seq("rang", { alignOrderCode: "coeur_vaillant", alignLevelReq: null }),
          seq("rang-ok", { alignOrderCode: "coeur_vaillant", alignLevelReq: 20 }),
        ],
      },
    ]);
    expect(kinds["order-quest-without-level"].count).toBe(1);
  });
});

describe("problèmes de contenu — comptage et navigation", () => {
  it("un guide complet ne signale rien", () => {
    expect(countRushEditorProblems(analyzeRushEditorProblems([fullBlock]))).toBe(0);
  });

  it("le total additionne les cinq familles", () => {
    const blocks = [
      { id: "b", title: "B", type: "QUETE_SERIE", sequences: [seq("a", { tips: "" })] },
      { id: "vide", title: "Vide", type: "QUETE_SERIE", sequences: [] },
    ];
    const problems = analyzeRushEditorProblems(blocks);
    const total = problems.reduce((n, p) => n + p.count, 0);
    expect(countRushEditorProblems(problems)).toBe(total);
    expect(total).toBeGreaterThanOrEqual(2);
  });

  it("le panneau ne déverse pas : 12 cibles au plus, le compte reste exact", () => {
    const many = Array.from({ length: 30 }, (_, i) => seq(`q-${i}`, { tips: "" }));
    const kinds = byKind([{ id: "b", title: "B", type: "QUETE_SERIE", sequences: many }]);
    expect(kinds["quest-without-tips"].count).toBe(30);
    expect(kinds["quest-without-tips"].targets).toHaveLength(12);
  });

  it("chaque cible porte de quoi ouvrir la quête ou le bloc", () => {
    const problems = analyzeRushEditorProblems([{ id: "b", title: "Bloc B", type: "QUETE_SERIE", sequences: [seq("a", { tips: "" })] }]);
    const target = problems.find((p) => p.kind === "quest-without-tips")?.targets[0];
    expect(target).toMatchObject({ blockId: "b", blockTitle: "Bloc B", questId: "a" });
  });
});

describe("problèmes de contenu — câblage", () => {
  const codeOf = (path: string) =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  it("le studio monte le panneau sur son onglet", () => {
    const studio = codeOf("src/components/god/rush-editor/RushEditorStudio.tsx");
    expect(studio).toContain('activeTab === "problems"');
    expect(studio).toContain("<RushProblemsPanel");
    expect(studio).toContain("problemsCount={problemsCount}");
  });

  it("la barre déclare l'onglet et affiche la pastille", () => {
    const topbar = codeOf("src/components/god/rush-editor/RushEditorTopbar.tsx");
    expect(topbar).toContain('"problems"');
    expect(topbar).toContain("Problèmes");
    expect(topbar).toContain('tab.value === "problems"');
  });
});
