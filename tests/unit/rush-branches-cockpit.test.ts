/**
 * Garde — **cockpit Branches** (E2c, 12/11/2026).
 *
 * 🎯 Mesure du 12/11/2026 : le panneau Branches ne recevait que `view`, `classView` et
 * `milestones` — **aucun callback**. Un emplacement vide ou rempli ne menait donc nulle
 * part : l'écran disait ce qui manque sans pouvoir y aller. Ce lot ajoute **deux gestes**
 * et rien d'autre : ouvrir la quête dans l'inspecteur, créer une quête **pré-remplie**
 * (cité + Ordre + palier, ou classe) dans le bloc d'accueil.
 *
 * 🛡️ Deux niveaux de preuve :
 *   ① **rendu réel** (`renderToStaticMarkup`) : le cockpit affiche la quête d'un
 *      emplacement rempli, un bouton « Créer » nommé pour un emplacement vide, et
 *      l'étiquette « — manque — » d'une classe sans quête ;
 *   ② **câblage** : aucune seconde règle de route (le filtre reste `resolveRushRoute`
 *      dans l'aperçu), aucune modale native, et le studio branche bien les deux gestes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushBranchesCockpit } from "@/components/god/rush-editor/panels/RushBranchesCockpit";
import { buildRushBranches, buildRushClassBranches, type RushBranchSequence } from "@/lib/rush-branches";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

const COCKPIT_PATH = "src/components/god/rush-editor/panels/RushBranchesCockpit.tsx";
const STUDIO_PATH = "src/components/god/rush-editor/RushEditorStudio.tsx";

const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const COCKPIT = codeOf(COCKPIT_PATH);
const STUDIO = codeOf(STUDIO_PATH);

const quest = (id: string, name: string, extra: Partial<RushSequence> = {}): RushSequence => ({
  id, subGuideRef: name, subGuideName: name, isOptional: false, order: 0, ...extra,
});

const block = (id: string, title: string, sequences: RushSequence[], order = 0): RushMilestone => ({
  id, chapter: 1, chapterLabel: "Acte I", title, isOptional: false, order, type: "QUETE_SERIE", sequences,
});

/** Le guide minimal : une quête d'Ordre remplie (palier 20) et la quête Féca. */
const MILESTONES: RushMilestone[] = [
  block("b1", "Chapitre de test", [
    quest("q-vaillant-20", "Quête du rang 20", {
      alignReq: "bontarien", alignOrderCode: "coeur_vaillant", alignLevelReq: 20,
    }),
    quest("q-feca", "La quête du Féca", { classReq: "feca" }),
  ]),
];

const branchSequences = (milestones: RushMilestone[]): RushBranchSequence[] =>
  milestones.flatMap((m) =>
    m.sequences.map((s, i) => ({
      id: s.id,
      order: i,
      blockOrder: m.order,
      subGuideName: s.subGuideName,
      alignReq: s.alignReq ?? null,
      alignOrderCode: s.alignOrderCode ?? null,
      alignLevelReq: s.alignLevelReq ?? null,
      classReq: s.classReq ?? null,
    })),
  );

const VIEW = buildRushBranches(branchSequences(MILESTONES));
const CLASS_VIEW = buildRushClassBranches(branchSequences(MILESTONES));

const render = (onCreateQuest = () => {}) =>
  renderToStaticMarkup(
    React.createElement(RushBranchesCockpit, {
      view: VIEW,
      classView: CLASS_VIEW,
      milestones: MILESTONES,
      onOpenQuest: () => {},
      onCreateQuest,
    }),
  );

describe("cockpit Branches — un emplacement est un geste", () => {
  const html = render();

  it("un emplacement rempli affiche la quête (elle s'ouvre dans l'inspecteur)", () => {
    expect(html).toContain("Quête du rang 20");
    // Le bouton porte un libellé accessible : un nom de quête seul n'est pas un geste.
    expect(html).toContain('aria-label="Ouvrir la quête Quête du rang 20"');
  });

  it("un emplacement vide propose « Créer », nommé par son palier et son Ordre", () => {
    const firstOrder = VIEW.camps[0].orders[0];
    // React échappe l'apostrophe de « l'Ordre » dans l'attribut : on garde le libellé du palier.
    expect(html).toContain(`Créer la quête « ${firstOrder.slots[1].label} »`);
    expect(html).toContain(firstOrder.name);
  });

  it("une classe sans quête est nommée « — manque — » et propose sa création", () => {
    // 19 classes, une seule remplie (Féca) : 18 emplacements vides.
    expect(html.match(/— manque —/g)?.length).toBe(18);
    expect(html).toContain("Créer la quête de classe Iop");
  });

  it("l'écran nomme les manques de route sans rien inventer", () => {
    expect(html).toContain("Classes — 19 variantes");
    expect(html).toContain("Ordres — 3 par cité, 5 paliers");
    expect(html).toContain("emplacement");
  });
});

describe("cockpit Branches — câblage", () => {
  it("aucune seconde règle de route : le filtre reste dans l'aperçu", () => {
    expect(COCKPIT).not.toContain("resolveRushRoute");
    expect(COCKPIT).toContain("RushRoutePreview");
  });

  it("aucune modale native ni écriture directe depuis le panneau", () => {
    expect(COCKPIT).not.toMatch(/\bconfirm\(/);
    expect(COCKPIT).not.toContain("upsertRushSequence");
  });

  it("le studio branche les deux gestes sur l'inspecteur existant", () => {
    expect(STUDIO).toContain("onOpenQuest={selectQuest}");
    expect(STUDIO).toContain("onCreateQuest={createQuestFromBranch}");
  });

  it("la création d'un emplacement arrive pré-remplie dans le formulaire existant", () => {
    expect(STUDIO).toContain("defaultRoute={sequenceRouteDefaults}");
    expect(STUDIO).toContain('useState(defaultRoute?.alignReq ?? "")');
    expect(STUDIO).toContain('useState(defaultRoute?.alignLevelReq ?? "")');
    expect(STUDIO).toContain('useState(defaultRoute?.classReq ?? "")');
  });
});
