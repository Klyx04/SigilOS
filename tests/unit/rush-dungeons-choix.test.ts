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
import { dungeonKeyOf, missingRequiredDungeons, sequenceDungeonProgress } from "@/lib/rush-dungeons";

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

describe("Totems de Maïmane — les 6 totems, un donjon au choix par totem", () => {
  const TAGS = [
    "Salons privés de Klime / Aquadôme de Merkator / Palais du roi Nidas / Fers de la Tyrannie / Mémoire d'Orukam",
    "Vaisseau du Capitaine Meno / Souvenir d'Imagiro / Transporteur de Sylargh / Sanctuaire de Torkélonia / Œil de Vortex",
    "Manoir des Katrepat / Belvédère d'Ilyzaelle / Temple de Koutoulou / Sentence de la Balance",
    "Brasserie du roi Dazak / Trône de Sang / Forgefroide de Missiz Frizz / Tour de Solar / Chambre de Tal Kasha",
    "Tour de Bethel / Arbre de Mort / Palais de Dantinéa / Laboratoire de Nileza / Ventre de la Baleine",
    "Défi du Chalœil / Donjon du Comte Harebourg / Rituel de Kabahal / Temple du dieu Kao / Trône de la Cour Sombre",
  ];
  // Mesure en base du 19/11/2026 : 11 donjons résolus sur les 29 noms des 6 tags.
  const RESOLVED = [
    dj("k1", "Salons privés de Klime"),
    dj("k2", "Aquadôme de Merkator"),
    dj("k3", "Palais du roi Nidas"),
    dj("k4", "Fers de la Tyrannie"),
    dj("k5", "Mémoire d'Orukam"),
    dj("m1", "Vaisseau du Capitaine Meno"),
    dj("m2", "Souvenir d'Imagiro"),
    dj("m3", "Transporteur de Sylargh"),
    dj("v1", "Œil de Vortex"),
    dj("i1", "Manoir des Katrepat"),
    dj("i2", "Belvédère d'Ilyzaelle"),
  ];
  const totems = seq({
    dungeons: RESOLVED as never,
    activityTags: TAGS.map((name) => ({ type: "donjon", name })),
  });

  it("les 6 tags deviennent 6 groupes, même quand des donjons ne sont pas résolus", () => {
    const dungeons = getDungeons(totems);
    // 11 donjons réels + 18 noms du tag (clé stable `nom:<…>`) = les 29 du guide.
    expect(dungeons).toHaveLength(29);
    expect(new Set(dungeons.map((d) => d.choiceGroup)).size).toBe(6);
    const p = sequenceDungeonProgress(totems);
    expect(p.choiceGroups).toHaveLength(6);
    expect(p.requiredBlocks).toBe(6);
    expect(p.missingBlocks).toBe(6);
  });

  it("un donjon dans chaque groupe débloque la quête (6 donjons, pas 29)", () => {
    const keys = sequenceDungeonProgress(totems).choiceGroups.map((g) => g.keys[0]);
    const p = sequenceDungeonProgress(totems, keys);
    expect(p.blocked).toBe(false);
    expect(p.missingBlocks).toBe(0);
    expect(p.choiceGroups.every((g) => g.satisfied)).toBe(true);
  });

  it("cinq donjons ne suffisent pas : le sixième totem reste requis et est nommé", () => {
    const groups = sequenceDungeonProgress(totems).choiceGroups;
    const five = groups.slice(0, 5).map((g) => g.keys[0]);
    const p = sequenceDungeonProgress(totems, five);
    expect(p.blocked).toBe(true);
    expect(p.missingBlocks).toBe(1);
    const missing = missingRequiredDungeons(totems, five);
    expect(missing).toHaveLength(1);
    expect(missing[0].name).toContain("au choix");
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

  it("un tag multi crée un groupe même si un seul donjon est résolu (les autres sont des noms du tag)", () => {
    const s = seq({
      dungeons: [dj("77", "Fabrique de Malléfisk")] as never,
      activityTags: [{ type: "donjon", name: SUFOKIA_TAG }],
    });
    const dungeons = getDungeons(s);
    expect(dungeons).toHaveLength(5);
    expect(dungeons.every((d) => d.choiceGroup === "choix:0")).toBe(true);
    const ghost = dungeons.find((d) => !d.id);
    expect(ghost).toBeTruthy();
    const ghostKey = dungeonKeyOf(ghost!);
    expect(ghostKey).toBeTruthy();
    expect(sequenceDungeonProgress(s).blocked).toBe(true);
    expect(sequenceDungeonProgress(s, [ghostKey!]).blocked).toBe(false);
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

  it("le SERVEUR coche les groupes : il charge les tags et les donjons optionnels", () => {
    // Sans ces tags, le plan de coche ne voyait que les donjons résolus et exigeait
    // les 11 donjons de Maïmane au lieu des 6 totems (« 8 donjon(s)… » mesuré).
    const ACTIONS = "src/server/actions/optimized-guide-actions.ts";
    const actions = readFileSync(ACTIONS, "utf8");
    expect(actions).toContain("activityTags: true");
    expect(actions).toContain("dungeonOptionalIds: true");
    expect(actions).toContain("missingRequiredDungeons(entry.sequence, doneKeys)");
    expect(actions).toContain("applyDungeonChecks(");
  });

  it("les compteurs des trois surfaces annoncent les EXIGENCES", () => {
    const DASH = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
    const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
    const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx";
    expect(readFileSync(DASH, "utf8")).toContain("Donjon ×{dungeonBlocks}");
    expect(readFileSync(PUBLIC, "utf8")).toContain("const seqDungeonCount = dungeonProgress.requiredBlocks");
    expect(readFileSync(OVERLAY, "utf8")).toContain("Donjon ×{requiredDungeonBlocks}");
  });
});
