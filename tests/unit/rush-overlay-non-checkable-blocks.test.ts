/**
 * Garde — dans l'overlay, les bannières (séparateur, encart CONSEIL/TIPS, « Dofus obtenu »)
 * ne sont PAS des étapes : elles s'affichent dans le FLUX de leur chapitre, à leur place
 * chronologique.
 *
 * 🎯 Demande user (21/09/2026, verbatim) : « pk tu continue à mettre les tips/conseil dans
 * l'overlay avec le cercle à cocher (qui ne l'est pas) ces bandeaux là ont juste à afficher
 * dans l'ordre chronologique · si je vais dans le dropdown d'étape et que je choisis une
 * étape, je peux plus retrouver la partie des bandeaux ».
 *
 * 🔍 Ce qui était faux : les bannières étaient devenues des BLOCS COURANTS navigables — donc
 * affichées avec une case à cocher, un « 1. » et le titre du bandeau en guise de chapitre, et
 * une fois passé à un chapitre par le sélecteur on ne les revoyait plus.
 *
 * 🛡️ Règle retenue (la MÊME que le dashboard, `chapterPages`) : une bannière est collée au
 * chapitre qui la SUIT ; celles de fin de guide terminent le dernier chapitre. On les retrouve
 * donc dès qu'on ouvre ce chapitre, quel que soit le chemin (sélecteur, précédent/suivant).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { nextBlockIndex, bannersForChapter } from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";
import type { RushMilestone } from "@/types/rush-guide-types";

const ms = (id: string, type: string): RushMilestone => ({
  id,
  chapter: 1,
  chapterLabel: "Chapitre 1",
  title: id,
  type,
  order: 0,
  isOptional: false,
  sequences: [],
});

// Guide de test : b1 · c1 · b2 · b3 · c2 · b4 (b = bannière, c = chapitre)
const GUIDE = [
  ms("b1", "SEPARATEUR"),
  ms("c1", "QUETE_SERIE"),
  ms("b2", "INFO"),
  ms("b3", "DOFUS_OBTAINED"),
  ms("c2", "DOFUS"),
  ms("b4", "INFO"),
];

describe("bannersForChapter — chaque bannière à sa place chronologique", () => {
  it("rattache au chapitre les bannières qui le précèdent, dans l'ordre", () => {
    expect(bannersForChapter(GUIDE, "c1").before.map((b) => b.id)).toEqual(["b1"]);
    expect(bannersForChapter(GUIDE, "c2").before.map((b) => b.id)).toEqual(["b2", "b3"]);
  });

  it("ne rattache rien au chapitre PRÉCÉDENT (b2/b3 appartiennent à c2)", () => {
    // Elles s'affichent juste avant c2 — et on les retrouve en ouvrant c2 par le sélecteur.
    expect(bannersForChapter(GUIDE, "c1").after).toEqual([]);
  });

  it("rend les bannières de fin de guide avec le DERNIER chapitre", () => {
    expect(bannersForChapter(GUIDE, "c2").after.map((b) => b.id)).toEqual(["b4"]);
  });

  it("un chapitre sans bannière autour n'en reçoit aucune", () => {
    expect(bannersForChapter([ms("c1", "QUETE_SERIE"), ms("c2", "DOFUS")], "c2")).toEqual({ before: [], after: [] });
  });

  it("sans chapitre courant (ou id de bannière), rien n'est rendu", () => {
    expect(bannersForChapter(GUIDE, null)).toEqual({ before: [], after: [] });
    expect(bannersForChapter(GUIDE, "b2")).toEqual({ before: [], after: [] });
  });
});

describe("nextBlockIndex — la navigation ne porte que sur les chapitres", () => {
  const chapters = [
    { id: "c1", type: "QUETE_SERIE" },
    { id: "c2", type: "QUETE_SERIE" },
    { id: "c3", type: "DOFUS" },
  ];

  it("saute les chapitres déjà validés", () => {
    expect(nextBlockIndex(chapters, 0, new Set(["c2"]))).toBe(2);
    expect(nextBlockIndex(chapters, 0, new Set())).toBe(1);
  });

  it("retourne null au bout du guide", () => {
    expect(nextBlockIndex(chapters, 2, new Set())).toBeNull();
    expect(nextBlockIndex(chapters, 0, new Set(["c1", "c2", "c3"]))).toBeNull();
  });
});

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const COMPACT = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayCompact.tsx";
const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const RICH = "src/components/dofus-quests/rush/RushRichText.tsx";

describe("Overlay — les bannières sont dans le flux, pas dans la navigation", () => {
  it("la liste des étapes ne garde que les chapitres (règle partagée)", () => {
    const code = codeOf(OVERLAY);
    expect(code).toMatch(
      /const milestones = useMemo\(\s*\(\) => rawMilestones\.filter\(\(ms\) => !isNonCheckableBlock\(ms\)\),/
    );
  });

  it("la navigation passe par la règle partagée `nextBlockIndex`", () => {
    const code = codeOf(OVERLAY);
    expect(code).toMatch(/nextBlockIndex\(milestones, currentMsIndex, completedIds\)/);
  });

  it("les bannières du chapitre sont rendues AVANT et APRÈS son contenu", () => {
    const code = codeOf(OVERLAY);
    expect(code).toMatch(/bannersForChapter\(rawMilestones, currentMs\?\.id\)/);
    expect(code).toMatch(/\{!search\.trim\(\) && banners\.before\.map\(renderBanner\)\}/);
    expect(code).toMatch(/\{!search\.trim\(\) && banners\.after\.map\(renderBanner\)\}/);
  });

  it("chaque bannière garde son composant PARTAGÉ (aucune mise en page locale)", () => {
    const code = codeOf(OVERLAY);
    expect(code).toMatch(/const renderBanner = \(ms: RushMilestone\) => \{/);
    expect(code).toMatch(/<RushSeparatorBanner/);
    expect(code).toMatch(/<RushInfoBanner/);
  });

  it("plus aucune case à cocher désactivée ni « bloc informatif »", () => {
    const code = codeOf(OVERLAY);
    expect(code).not.toMatch(/msIsInfoBlock/);
  });

  it("le mode compact ne cache plus l'objectif derrière un bandeau", () => {
    expect(codeOf(OVERLAY)).toMatch(/body=\{!compactObjective && banners\.before\.length > 0/);
    // La prop `checkable` n'existe plus : le bloc courant est toujours un chapitre.
    expect(codeOf(COMPACT)).not.toMatch(/checkable\?: boolean/);
    expect(codeOf(COMPACT)).not.toMatch(/\{checkable &&/);
  });
});

describe("Texte enrichi — les 3 surfaces importent le MÊME composant", () => {
  it("RushRichText existe", () => {
    expect(existsSync(RICH)).toBe(true);
  });

  it("chaque surface l'importe et l'utilise", () => {
    for (const [name, path] of [
      ["dashboard", DASHBOARD],
      ["guide public", PUBLIC],
      ["overlay", OVERLAY],
    ] as const) {
      const code = codeOf(path);
      expect(code, `${name} : RushRichText non importé`).toMatch(
        /import \{ RushRichText \} from "@\/components\/dofus-quests\/rush\/RushRichText"/
      );
      expect(code, `${name} : le texte enrichi n'est pas rendu`).toMatch(/<RushRichText text=/);
    }
  });

  it("plus aucune surface ne recopie son propre parseur de liens/coordonnées", () => {
    expect(codeOf(DASHBOARD)).not.toMatch(/function renderContentWithCoords/);
    expect(codeOf(OVERLAY)).not.toMatch(/function renderContentWithCoords/);
    expect(codeOf(PUBLIC)).not.toMatch(/function renderContentWithCoords/);
  });
});
