/**
 * Gardes — les séquences « info_sequence » (encarts de conseil posés au GOD) sont vues et
 * rendues de la MÊME façon par les trois surfaces.
 *
 * 🎯 Écart tranché le 21/09/2026 : le **guide public** jetait ces séquences (`continue` dans
 * `groupSequencesIntoQuests`) alors que le dashboard et l'overlay les affichaient — et comme
 * il les **comptait** dans sa progression, son pourcentage ne pouvait jamais atteindre 100 %.
 *
 * 🛡️ Ce que ce test verrouille :
 *   · le rendu du bandeau partagé (couleur du tag, registre + picto, texte enrichi, aucune
 *     case à cocher : un encart n'est pas une quête) ;
 *   · le câblage des trois surfaces sur ce composant unique ;
 *   · côté guide public : les encarts sont conservés dans le flux, et EXCLUS de tous les
 *     compteurs (progression du guide, du chapitre, du bloc, « valider tout le bloc »,
 *     repère « Je suis ici »).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushInfoSequenceBanner } from "@/components/dofus-quests/rush/RushInfoSequenceBanner";
import { RushChapterSidebar } from "@/components/dofus-quests/rush/RushChapterSidebar";
import type { RushSequence } from "@/types/rush-guide-types";

const seq = (over: Partial<RushSequence> = {}): RushSequence => ({
  id: "seq-info",
  subGuideRef: "Prérequis du rush",
  subGuideName: "Prérequis du rush",
  isOptional: false,
  order: 0,
  tips: "Prévois [Eternelle Moisson](https://www.dofuspourlesnoobs.com/leacuteternelle-moisson.html) avant de lancer. Position : [-55,15].",
  activityTags: [{ type: "info_sequence", color: "#f59e0b" }],
  ...over,
});

const html = (s: RushSequence, accentColor?: string) =>
  renderToStaticMarkup(React.createElement(RushInfoSequenceBanner, { seq: s, accentColor }));

describe("RushInfoSequenceBanner — rendu réel", () => {
  it("porte le registre de la couleur du tag, avec son picto", () => {
    const out = html(seq());
    expect(out).toContain("Attention"); // #f59e0b ⇒ registre chaud
    expect(out).toContain("⚠️");
    expect(out).toContain("background-color:#f59e0b"); // filet d'accent
  });

  it("retombe sur la couleur du bloc quand la séquence n'en a pas", () => {
    const out = html(seq({ activityTags: [{ type: "info_sequence" }] }), "#3b82f6");
    expect(out).toContain("À savoir"); // #3b82f6 ⇒ registre froid
    expect(out).toContain("background-color:#3b82f6");
  });

  it("rend le texte enrichi : lien nommé (URL invisible) et position copiable en /travel", () => {
    const out = html(seq());
    expect(out).toContain('href="https://www.dofuspourlesnoobs.com/leacuteternelle-moisson.html"');
    expect(out).toContain("Eternelle Moisson");
    expect(out).toContain("Cliquer pour copier /travel -55,15");
    // L'URL n'apparaît qu'en attribut : jamais recopiée dans le texte visible.
    expect(out.split("leacuteternelle-moisson.html").length - 1).toBe(1);
  });

  it("n'est JAMAIS cochable : aucune case à cocher, aucun bouton de validation", () => {
    const out = html(seq());
    expect(out).not.toContain("<input");
    expect(out).not.toContain("Marquer");
    // Le seul bouton du bandeau est la puce de position copiable, jamais une validation.
    expect(out.split("<button").length - 1).toBe(1);
    expect(out).toContain("Cliquer pour copier");
  });

  it("sans texte, le bandeau garde son registre et ne casse pas", () => {
    const out = html(seq({ tips: null, subGuideName: "", subGuideRef: "" }));
    expect(out).toContain("Attention");
  });
});

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";

describe("Encarts info — les 3 surfaces rendent le MÊME bandeau", () => {
  it("chaque surface importe et rend le composant partagé", () => {
    for (const [name, path] of [
      ["dashboard", DASHBOARD],
      ["guide public", PUBLIC],
      ["overlay", OVERLAY],
    ] as const) {
      const code = codeOf(path);
      expect(code, `${name} : bandeau non importé`).toMatch(
        /import \{ RushInfoSequenceBanner \} from "@\/components\/dofus-quests\/rush\/RushInfoSequenceBanner"/
      );
      expect(code, `${name} : bandeau non rendu`).toMatch(/<RushInfoSequenceBanner/);
    }
  });

  it("plus aucun rendu local recopié (un seul bandeau pour tout le module)", () => {
    // L'overlay avait son bloc « 📘 » en dur, le dashboard son composant local.
    expect(codeOf(OVERLAY)).not.toContain("📘");
    expect(codeOf(DASHBOARD)).not.toMatch(/function InfoSequenceBanner/);
  });
});

describe("Guide public — les encarts sont dans le flux et hors des compteurs", () => {
  const code = codeOf(PUBLIC);

  it("les séquences info ne sont plus jetées", () => {
    expect(code).not.toMatch(/t\.type === "info_sequence"\)\) continue;/);
    expect(code).toMatch(/if \(isInfoSequence\(seq\)\) \{/);
    // Une info en tête de bloc est collée au bloc qui la suit (même règle que les bannières).
    expect(code).toMatch(/let pendingInfo: RushSequence\[\] = \[\];/);
    expect(code).toMatch(/sequences: \[\.\.\.pendingInfo, seq\]/);
  });

  it("la progression les exclut partout (guide, chapitre, bloc)", () => {
    // Compteur global du guide.
    expect(code).toMatch(/acc \+ \(ms\.sequences\?\.filter\(\(s\) => !isInfoSequence\(s\)\)\.length \|\| 0\)/);
    // Chapitre (en-tête + pourcentage).
    expect(code).toMatch(/const chapterSteps = sequences\.filter\(\(s\) => !isInfoSequence\(s\)\);/);
    // Bloc de quête : « n/N », en-tête, « Valider tout le bloc », repère.
    expect(code).toMatch(/const blockSteps = block\.sequences\.filter\(\(s\) => !isInfoSequence\(s\)\);/);
    expect(code).toMatch(/handleToggleBlockSteps\(ms\.id, blockSteps\.map\(\(s\) => s\.id\), true\)/);
    // Le sommaire public (qui portait ce compteur) a été supprimé le 22/09 : le
    // décompte par chapitre est désormais porté par le rail de droite.
    // Milestone terminé / validation globale.
    expect(code).toMatch(/const steps = ms\.sequences\.filter\(\(s\) => !isInfoSequence\(s\)\);/);
    expect(code).toMatch(/ms\.sequences\.filter\(\(s\) => !isInfoSequence\(s\)\)\.forEach/);
    expect(code).toMatch(/ms\.sequences\.filter\(\(s\) => !isInfoSequence\(s\)\)\.map\(\(s\) => s\.id\)/);
  });

  it("un bloc fait uniquement d'encarts ne montre pas d'en-tête de quête vide", () => {
    expect(code).toMatch(/\{hasSteps && !isSingleStep && \(/);
    expect(code).toMatch(/const hasSteps = blockSteps\.length > 0;/);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Rail de droite (`RushChapterSidebar`) — même règle, autre surface.
// 🎯 Mesure du 22/09/2026 : le sommaire repliable du guide public (qui portait, lui, le
// compteur filtré) a été supprimé — le rail est désormais le SEUL décompte par chapitre
// visible côté public. Il comptait les encarts `info_sequence` : un chapitre contenant un
// conseil affichait « n/N+1 » et ne pouvait jamais atteindre 100 %.
// ─────────────────────────────────────────────────────────────────────────────
describe("RushChapterSidebar — les encarts ne comptent pas dans la progression", () => {
  const milestones = [
    {
      id: "ms-1",
      title: "Premier pas",
      chapter: 1,
      chapterLabel: "Chapitre 1",
      sequences: [
        seq({ id: "s1", activityTags: [] }),
        seq({ id: "s2", activityTags: [] }),
        seq({ id: "s3" }), // encart info_sequence : aucune case à cocher
      ],
    },
  ];

  const rail = (completed: string[]) =>
    renderToStaticMarkup(
      React.createElement(RushChapterSidebar, {
        milestones: milestones as never,
        completedSeqIds: new Set(completed),
      })
      // Les marqueurs de séparation de texte du SSR (`<!-- -->`) ne s'affichent pas :
      // on teste ce que le joueur lit.
    ).replace(/<!-- -->/g, "");

  it("affiche « n/N » sur les seules étapes cochables", () => {
    const html = rail([]);
    expect(html).toContain(">0/2<");
    expect(html).toContain("0 / 2");
    expect(html).not.toContain("0/3");
  });

  it("toutes les étapes cochables faites ⇒ le chapitre est terminé (jamais bloqué par un encart)", () => {
    const html = rail(["s1", "s2"]);
    expect(html).toContain(">2/2<");
    expect(html).toContain("100%");
    expect(html).not.toContain("2/3");
  });
});

});