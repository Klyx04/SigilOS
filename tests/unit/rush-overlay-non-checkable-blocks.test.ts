/**
 * Garde — dans l'overlay, les bandeaux (séparateur, encart CONSEIL/TIPS, « Dofus obtenu »)
 * sont VISIBLES et JAMAIS sautés par la navigation.
 *
 * 🎯 Demande user (21/09/2026) : « dans l'overlay on doit voir aussi les bandeaux de tips
 * ajouté, et ya un pb si on passe à une autre étape dans l'overlay les bandeaux type
 * separateur / tips on ne les a plus dispo ».
 *
 * 🔍 Causes mesurées avant correctif :
 *   1. `GuideOverlayClient` filtrait la liste — `rawMilestones.filter(ms => !["INFO",
 *      "DOFUS_OBTAINED"].includes(ms.type))` — donc AUCUN bandeau de tips n'était rendu
 *      (la branche `<RushInfoBanner>` plus bas était du code mort) ;
 *   2. `goToNextMs` sautait tout bloc dont l'id était dans `completedIds` — un bandeau
 *      marqué « fait » par une donnée héritée disparaissait alors de la navigation.
 *
 * 🛡️ Ce que ce test verrouille : la règle pure (`nextBlockIndex`), les deux câblages
 * (liste complète, bandeau utilisé) et le fait que les 3 surfaces rendent le texte enrichi.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { nextBlockIndex } from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";

const blocks = [
  { id: "c1", type: "QUETE_SERIE" },
  { id: "sep", type: "SEPARATEUR" },
  { id: "c2", type: "QUETE_SERIE" },
  { id: "tips", type: "INFO" },
  { id: "c3", type: "DOFUS" },
];

describe("nextBlockIndex — un bandeau n'est jamais sauté", () => {
  it("s'arrête sur le bandeau suivant, même s'il traîne une validation héritée", () => {
    // Le séparateur est marqué « fait » en base (donnée héritée) : on s'y arrête quand même.
    expect(nextBlockIndex(blocks, 0, new Set(["sep", "c2"]))).toBe(1);
  });

  it("saute les chapitres déjà validés mais pas les bandeaux", () => {
    // Depuis le séparateur : c2 est fait ⇒ on va au bandeau de tips.
    expect(nextBlockIndex(blocks, 1, new Set(["c2"]))).toBe(3);
  });

  it("propose le chapitre suivant quand il reste à valider", () => {
    expect(nextBlockIndex(blocks, 0, new Set())).toBe(1);
    expect(nextBlockIndex(blocks, 3, new Set())).toBe(4);
  });

  it("retourne null au bout du guide", () => {
    expect(nextBlockIndex(blocks, 4, new Set())).toBeNull();
    // Tous les chapitres validés d'un guide sans bandeau : plus rien à proposer.
    expect(
      nextBlockIndex([{ id: "c1", type: "QUETE_SERIE" }, { id: "c2", type: "DOFUS" }], 0, new Set(["c2"]))
    ).toBeNull();
  });

  it("propose un bandeau même marqué validé : il ne disparaît jamais", () => {
    expect(nextBlockIndex(blocks, 2, new Set(["tips"]))).toBe(3);
  });
});

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const RICH = "src/components/dofus-quests/rush/RushRichText.tsx";

describe("Overlay — les bandeaux font partie de la liste", () => {
  it("la liste ne filtre plus les blocs CONSEIL/TIPS ni « Dofus obtenu »", () => {
    const code = codeOf(OVERLAY);
    expect(code, "filtre INFO/DOFUS_OBTAINED toujours présent").not.toMatch(
      /rawMilestones\.filter\(\s*\(ms\)\s*=>\s*!\["INFO"/
    );
    expect(code).toMatch(/const milestones = rawMilestones;/);
  });

  it("la navigation passe par la règle partagée `nextBlockIndex`", () => {
    const code = codeOf(OVERLAY);
    expect(code).toMatch(/nextBlockIndex\(milestones, currentMsIndex, completedIds\)/);
  });

  it("le bandeau CONSEIL/TIPS est rendu, en compact comme en normal", () => {
    const code = codeOf(OVERLAY);
    // Deux rendus : contenu principal + mode jeu compact.
    expect(code.split("<RushInfoBanner").length - 1).toBeGreaterThanOrEqual(2);
    expect(code).toMatch(/currentMs\.type === "INFO" \? \(/);
  });

  it("la règle des blocs non cochables vient du module partagé", () => {
    expect(codeOf(OVERLAY)).toMatch(/const msIsInfoBlock = isNonCheckableBlock\(currentMs\);/);
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
