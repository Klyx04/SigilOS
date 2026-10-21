/**
 * Gardes — **liste des donjons du guide** (`RushDungeonList`), état **par occurrence**.
 *
 * 🎯 Correction user (21/10/2026, verbatim) : « même donjon dans 3 quêtes = une seule
 * coche qui vaut partout : totalement faux ! un même dj peut être présent dans des
 * quêtes différentes mais la coche de celui-ci ne vaut que pour sa quête cochée ! ».
 *
 * 🛡️ Ce que ce test verrouille : un état PAR QUÊTE (jamais mutualisé par donjon),
 * le compteur d'endroits, la mention « optionnel » par endroit, et les noms des membres
 * qui ont marqué « à faire » pour l'endroit précis.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushDungeonList } from "@/components/dofus-quests/rush/RushDungeonList";
import type { RushDungeonEntryView, RushDungeonState } from "@/lib/rush-dungeons";

const occurrence = (
  sequenceId: string,
  over: { sequenceName?: string; milestoneTitle?: string; isOptional?: boolean; state?: RushDungeonState | null } = {}
) => ({
  milestoneId: "m1",
  milestoneTitle: over.milestoneTitle ?? "Bloc A",
  chapter: 1,
  sequenceId,
  sequenceName: over.sequenceName ?? `Quête ${sequenceId}`,
  isOptional: over.isOptional ?? false,
  state: over.state ?? null,
});

const entry = (
  key: string,
  occurrences: ReturnType<typeof occurrence>[],
  over: { name?: string; isOcre?: boolean } = {}
): RushDungeonEntryView => ({
  key,
  name: over.name ?? `Donjon ${key}`,
  isOcre: over.isOcre ?? false,
  occurrences,
  places: occurrences.length,
  requiredPlaces: occurrences.filter((o) => !o.isOptional).length,
  donePlaces: occurrences.filter((o) => o.state === "done").length,
  todoPlaces: occurrences.filter((o) => o.state === "todo").length,
});

const render = (props: {
  entries: RushDungeonEntryView[];
  others?: Parameters<typeof RushDungeonList>[0]["others"];
  busyKey?: string | null;
}) =>
  renderToStaticMarkup(
    React.createElement(RushDungeonList, {
      entries: props.entries,
      others: props.others ?? [],
      busyKey: props.busyKey ?? null,
      onSet: () => {},
    })
  );

describe("RushDungeonList — un état par quête", () => {
  it("affiche le donjon, ses deux endroits et le compteur", () => {
    const out = render({
      entries: [
        entry("dj-1", [
          occurrence("s1", { sequenceName: "Quête A" }),
          occurrence("s2", { sequenceName: "Quête B" }),
        ], { name: "Cour du Bouftou Royal" }),
      ],
    });
    expect(out).toContain("Cour du Bouftou Royal");
    expect(out).toContain("Quête A");
    expect(out).toContain("Quête B");
    expect(out).toContain("2 endroits");
    expect(out).toContain("0/2 fait");
  });

  it("cocher une quête ne marque QUE cette occurrence", () => {
    const out = render({
      entries: [
        entry("dj-1", [
          occurrence("s1", { state: "done" }),
          occurrence("s2", { state: null }),
        ]),
      ],
    });
    // Un seul bouton « Fait » actif, et le compteur le dit.
    expect(out.split('aria-pressed="true"').length - 1).toBe(1);
    expect(out).toContain("1/2 fait");
  });

  it("« à faire » est propre à l'endroit", () => {
    const out = render({
      entries: [
        entry("dj-1", [occurrence("s1", { state: "todo" }), occurrence("s2")]),
      ],
    });
    expect(out.split('aria-pressed="true"').length - 1).toBe(1);
  });

  it("signale un endroit où le donjon est optionnel", () => {
    const out = render({
      entries: [entry("dj-1", [occurrence("s1"), occurrence("s2", { isOptional: true })])],
    });
    expect(out).toContain("optionnel");
    expect(out).toContain("2 endroits");
  });

  it("affiche les membres « à faire » de l'endroit concerné, pas des autres", () => {
    const out = render({
      entries: [
        entry("dj-1", [occurrence("s1", { sequenceName: "Quête A" }), occurrence("s2", { sequenceName: "Quête B" })]),
      ],
      others: [
        { sequenceId: "s1", dungeonKey: "dj-1", state: "todo", profileId: "p1", userName: "Alice", pseudoDofus: null },
        { sequenceId: "s2", dungeonKey: "dj-1", state: "todo", profileId: "p2", userName: "Bob", pseudoDofus: "Bobby" },
      ],
    });
    expect(out).toContain("à faire : Alice");
    expect(out).toContain("à faire : Bobby");
  });

  it("un guide sans donjon affiche un message, pas une liste vide", () => {
    expect(render({ entries: [] })).toContain("Aucun donjon dans ce guide.");
  });
});
