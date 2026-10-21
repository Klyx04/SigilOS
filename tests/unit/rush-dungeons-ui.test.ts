/**
 * Gardes — **panneau « Donjons de la quête »**, état **par occurrence**.
 *
 * 🎯 Correction user (21/10/2026, verbatim) : « au clic sur l'icône donjon la mini modale
 * reste dispo ouverte (avec une croix de fermeture) avec une 2 coche à coté de chaque
 * donjon : fait / à faire, pas besoin d'une nouvelle icône en haut de l'overlay ».
 *
 * 🛡️ Ce que ce test verrouille :
 *  · une ligne par donjon de la quête, avec les DEUX états (jamais une case binaire) ;
 *  · l'état d'une AUTRE quête n'allume rien ici (clé `sequenceId::dungeonKey`) ;
 *  · « optionnel » est signalé, et « à faire : X » ne cite que les membres de CETTE quête ;
 *  · la croix de fermeture existe (le panneau ne se referme pas au survol) ;
 *  · sans `onSet`, le panneau est en lecture seule (aucun bouton inerte).
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushQuestDungeonsPanel } from "@/components/dofus-quests/rush/RushQuestDungeonsPanel";
import type { RushDungeonMemberState, RushDungeonStateMap } from "@/lib/rush-dungeons";

const SEQ = {
  id: "s1",
  subGuideName: "Quête A",
  dungeon: null,
  dungeons: [
    { id: "dj-1", name: "Donjon du Bouftou", bossName: "Bouftou Royal" },
    { id: "dj-2", name: "Donjon des Larves", bossName: "Larve Saignante", isOptional: true },
  ],
  activityTags: [],
} as never;

const member = (
  sequenceId: string,
  dungeonKey: string,
  name: string
): RushDungeonMemberState => ({
  sequenceId,
  dungeonKey,
  state: "todo",
  profileId: `p-${name}`,
  userName: name,
  pseudoDofus: null,
});

const render = ({
  states = {},
  others = [],
  withOnSet = true,
}: {
  states?: RushDungeonStateMap;
  others?: RushDungeonMemberState[];
  withOnSet?: boolean;
} = {}) =>
  renderToStaticMarkup(
    React.createElement(RushQuestDungeonsPanel, {
      seq: SEQ,
      guildId: "1290442961380835451",
      states,
      busyKey: null,
      others,
      onSet: withOnSet ? () => {} : undefined,
      onClose: () => {},
    })
  );

const activeCount = (out: string) => out.split('aria-pressed="true"').length - 1;

describe("RushQuestDungeonsPanel — les deux coches, par quête", () => {
  it("affiche chaque donjon de la quête avec Fait / À faire", () => {
    const out = render();
    expect(out).toContain("Bouftou Royal");
    expect(out).toContain("Larve Saignante");
    // Deux donjons × deux états = quatre boutons, aucun actif au départ.
    expect(out.match(/aria-pressed="false"/g)?.length).toBe(4);
    expect(activeCount(out)).toBe(0);
  });

  it("dit où en est la quête (compteur) et signale l'optionnel", () => {
    const out = render({ states: { "s1::dj-1": "done" } });
    expect(out).toContain("Donjons de la quête · 1/2 fait");
    // « dj-2 » est optionnel : il ne bloque rien, donc aucun requis restant.
    expect(out).not.toContain("requis restant");
    expect(out).toContain("optionnel");
    // Sans coche, c'est le donjon REQUIS qui manque (l'optionnel ne compte pas).
    expect(render()).toContain("1 requis restant");
  });

  it("l'état d'une AUTRE quête n'allume rien ici (par occurrence)", () => {
    // Le même donjon coché dans la quête s2 ne vaut pas pour s1.
    expect(activeCount(render({ states: { "s2::dj-1": "done" } }))).toBe(0);
    expect(activeCount(render({ states: { "s1::dj-1": "done" } }))).toBe(1);
  });

  it("« à faire » ne cite que les membres de CETTE quête", () => {
    const out = render({
      others: [member("s1", "dj-1", "Alice"), member("s2", "dj-1", "Bob")],
    });
    expect(out).toContain("à faire : Alice");
    expect(out).not.toContain("Bob");
  });

  it("a une croix de fermeture (le panneau ne se referme pas tout seul)", () => {
    expect(render()).toMatch(/aria-label="Fermer les donjons de cette quête"/);
  });

  it("reste en lecture seule sans callback d'écriture (aucun bouton inerte)", () => {
    const out = render({ withOnSet: false });
    expect(out).toContain("Bouftou Royal");
    expect(out.includes("aria-pressed")).toBe(false);
  });
});

