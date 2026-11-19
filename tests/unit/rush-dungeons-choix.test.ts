/**
 * Garde — **donjons « au choix »** (mesure du 19/11/2026).
 *
 * 🎯 Retour user (verbatim) : « https://www.dofuspourlesnoobs.com/le-disparu-de-sufokia.html
 * condition et celle-ci …/les-totems-de-maimane.html choix — les 2 quêtes sont mal gérées
 * actuellement, overlay et navigateur ».
 *
 * Mesures sur le payload réel :
 *  · « Le disparu de Sufokia » : **un** donjon requis, **selon le niveau** (5 listés) ;
 *  · « Les totems de Maïmane » : **6 totems**, chacun avec 3 à 5 donjons au choix.
 *  Le seed écrit **un tag `donjon` par groupe** (« A / B / C ») et `dungeonIds` **à plat** :
 *  sans la règle, la quête exige les 5 / 12 donjons au lieu d'un par groupe.
 *
 * 🛡️ On verrouille la règle pure (un seul donjon par groupe suffit), le fail-open sur un
 * groupe non résolu, et le câblage des deux rendus (panneau + carte).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { RushSequence } from "@/types/rush-guide-types";
import {
  attachDungeonChoices,
  getDungeons,
  splitDungeonChoiceTag,
} from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";
import { missingRequiredDungeons, sequenceDungeonProgress } from "@/lib/rush-dungeons";

const seq = (over: Partial<RushSequence> = {}): RushSequence => ({
  id: "seq-1",
  subGuideRef: "Q1",
  subGuideName: "Quête de test",
  isOptional: false,
  order: 0,
  ...over,
});

const dj = (id: string, name: string) => ({ id, name, bossName: "Boss", imageUrl: undefined });

/** Tag réel du guide : 5 donjons séparés par « / » + la précision après le cadratin. */
const SUFOKIA_TAG =
  "Fabrique de Malléfisk / Mégalithe de Fraktale / Galerie du Phossile / Cave du Toxoliath / Horologium de XLII — Donjon en fonction de votre niveau";
const SUFOKIA = [
  dj("77", "Fabrique de Malléfisk"),
  dj("85", "Mégalithe de Fraktale"),
  dj("79", "Galerie du Phossile"),
  dj("82", "Cave du Toxoliath"),
  dj("86", "Horologium de XLII"),
];

describe("splitDungeonChoiceTag — un tag multi dit ses alternatives et sa précision", () => {
  it("découpe les 5 donjons et isole la précision après le tiret cadratin", () => {
    const { segments, label } = splitDungeonChoiceTag(SUFOKIA_TAG);
    expect(segments).toHaveLength(5);
    expect(segments[0]).toBe("Fabrique de Malléfisk");
    expect(segments[4]).toBe("Horologium de XLII");
    expect(label).toBe("Donjon en fonction de votre niveau");
  });

  it("un tag simple n'est jamais un groupe", () => {
    expect(splitDungeonChoiceTag("Donjon des Bworks")).toEqual({ segments: [], label: null });
    expect(splitDungeonChoiceTag(null)).toEqual({ segments: [], label: null });
  });
});

describe("Sufokia — un seul donjon, selon le niveau", () => {
  const sufokia = seq({
    dungeons: SUFOKIA as never,
    activityTags: [{ type: "donjon", name: SUFOKIA_TAG }],
  });

  it("les 5 donjons forment UN groupe, avec le libellé de la précision", () => {
    const dungeons = getDungeons(sufokia);
    expect(dungeons).toHaveLength(5);
    expect(new Set(dungeons.map((d) => d.choiceGroup))).toEqual(new Set(["choix:0"]));
    expect(dungeons[0].choiceLabel).toBe("Donjon en fonction de votre niveau");
  });

  it("le groupe compte pour UNE exigence : aucune alternative cochée ⇒ bloquée", () => {
    const p = sequenceDungeonProgress(sufokia);
    expect(p.total).toBe(5);
    expect(p.requiredBlocks).toBe(1);
    expect(p.missingBlocks).toBe(1);
    expect(p.blocked).toBe(true);
    expect(p.choiceGroups).toHaveLength(1);
    expect(p.choiceGroups[0].satisfied).toBe(false);
  });

  it("un seul donjon du groupe coché suffit à débloquer", () => {
    const p = sequenceDungeonProgress(sufokia, ["85"]);
    expect(p.blocked).toBe(false);
    expect(p.complete).toBe(true);
    expect(p.missingRequired).toEqual([]);
    expect(p.choiceGroups[0].satisfied).toBe(true);
    expect(missingRequiredDungeons(sufokia, ["85"])).toEqual([]);
  });
});

describe("Totems de Maïmane — un donjon par groupe, pas les 30", () => {
  const G1 = "Salons privés de Klime / Aquadôme de Merkator / Palais du roi Nidas";
  const G2 = "Vaisseau du Capitaine Meno / Souvenir d'Imagiro / Transporteur de Sylargh";
  const totems = seq({
    dungeons: [
      dj("a1", "Salons privés de Klime"),
      dj("a2", "Aquadôme de Merkator"),
      dj("a3", "Palais du roi Nidas"),
      dj("b1", "Vaisseau du Capitaine Meno"),
      dj("b2", "Souvenir d'Imagiro"),
      dj("b3", "Transporteur de Sylargh"),
    ] as never,
    activityTags: [
      { type: "donjon", name: G1 },
      { type: "donjon", name: G2 },
    ],
  });

  it("deux tags = deux exigences (choix:0 et choix:1)", () => {
    const p = sequenceDungeonProgress(totems);
    expect(p.choiceGroups).toHaveLength(2);
    expect(p.requiredBlocks).toBe(2);
    expect(p.missingBlocks).toBe(2);
    expect(p.total).toBe(6);
  });

  it("un donjon dans le premier groupe ne suffit pas : le second reste requis", () => {
    const p = sequenceDungeonProgress(totems, ["a1"]);
    expect(p.blocked).toBe(true);
    expect(p.missingBlocks).toBe(1);
    expect(p.choiceGroups.map((g) => g.satisfied)).toEqual([true, false]);
    expect(missingRequiredDungeons(totems, ["a1"]).map((d) => d.key).sort()).toEqual([
      "b1",
      "b2",
      "b3",
    ]);
  });

  it("un donjon coché dans chaque groupe débloque la quête", () => {
    const p = sequenceDungeonProgress(totems, ["a1", "b2"]);
    expect(p.blocked).toBe(false);
    expect(p.missingRequired).toEqual([]);
    expect(p.choiceGroups.map((g) => g.satisfied)).toEqual([true, true]);
  });
});

describe("Groupes et exigences simples cohabitent", () => {
  it("un donjon hors tag reste une exigence à part entière", () => {
    const s = seq({
      dungeons: [...SUFOKIA, dj("simple", "Donjon des Bworks")] as never,
      activityTags: [{ type: "donjon", name: SUFOKIA_TAG }],
    });
    expect(sequenceDungeonProgress(s).requiredBlocks).toBe(2);
    expect(sequenceDungeonProgress(s, ["85"]).missingBlocks).toBe(1);
    expect(sequenceDungeonProgress(s, ["85", "simple"]).blocked).toBe(false);
  });

  it("fail-open : un tag multi qui ne résout qu'un donjon ne crée pas de groupe", () => {
    const s = seq({
      dungeons: [dj("77", "Fabrique de Malléfisk")] as never,
      activityTags: [{ type: "donjon", name: SUFOKIA_TAG }],
    });
    expect(getDungeons(s)[0].choiceGroup).toBeUndefined();
    expect(sequenceDungeonProgress(s).requiredBlocks).toBe(1);
  });

  it("`attachDungeonChoices` ne mute pas l'entrée", () => {
    const input = SUFOKIA.map((d) => ({ ...d, isOcre: false }));
    const out = attachDungeonChoices(input, [{ type: "donjon", name: SUFOKIA_TAG }]);
    expect(out[0]).not.toBe(input[0]);
    expect(input[0]).not.toHaveProperty("choiceGroup");
    expect(out[0].choiceGroup).toBe("choix:0");
  });
});

describe("Câblage — le panneau et la carte disent le choix", () => {
  const PANEL = "src/components/dofus-quests/rush/RushQuestDungeonsPanel.tsx";
  const CARD = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonCard.tsx";

  it("le panneau compte les EXIGENCES, pas les alternatives", () => {
    const panel = readFileSync(PANEL, "utf8");
    expect(panel).toContain("progress.missingBlocks");
    expect(panel).toContain("progress.choiceGroups.length");
    expect(panel).not.toContain("progress.missingRequired.length");
  });

  it("la carte pose un en-tête « un seul suffit » avant le premier donjon du groupe", () => {
    const card = readFileSync(CARD, "utf8");
    expect(card).toContain("un seul suffit");
    expect(card).toContain("choiceGroup");
    expect(card).toContain("startsChoiceGroup");
  });
});
