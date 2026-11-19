/**
 * Garde — **repli du pavé DofusDex** dans les tips de bloc (19/11/2026).
 *
 * 🎯 Retour user (verbatim) : « je ne comprends pas non plus tout ces pavés dans le guide… »
 * (capture : bloc « Zone Guerre », 0/2 quêtes, tips « DofusDex officiel » de ~2 000
 * caractères).
 *
 * Mesure : **13 blocs** portent un tips « DofusDex officiel » de **463 à 1 956 caractères**
 * (13 à 51 lignes), rendu entier dans le dashboard et l'overlay. La règle isole l'en-tête et
 * ses puces (repliées), le reste (Prérequis, Donjons) reste visible.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { splitDofusDexTip } from "@/lib/rush-dofusdex-tip";
import { RushDofusDexTip } from "@/components/dofus-quests/rush/RushDofusDexTip";

const TIP = `**DofusDex officiel** — Dofus du Cauchemar (180–200)
- Eliocalypse : Résonance (Niv. 200)
- Chaque chose en son temps (Niv. 50)
**Prérequis** : Benjamin, La colère des dieux, Le fléau de Burin
**Donjons (étape 49 de la trame)** : Tour de Bethel, Donjon du Comte Harebourg
**Donjons (étape 55 de la trame)** : Académie des gobs`;

describe("splitDofusDexTip — la section officielle est isolée, le reste reste lisible", () => {
  it("compte les puces, garde le nom du Dofus, et sort le corps sans l'en-tête", () => {
    const { official, rest } = splitDofusDexTip(TIP);
    expect(official).not.toBeNull();
    expect(official!.count).toBe(2);
    expect(official!.summary).toBe("DofusDex officiel — Dofus du Cauchemar (180–200)");
    expect(official!.body).toContain("Eliocalypse : Résonance");
    expect(official!.body).not.toContain("DofusDex officiel");
    expect(rest).toContain("**Prérequis** : Benjamin");
    expect(rest).toContain("**Donjons (étape 55 de la trame)**");
    expect(rest).not.toContain("Eliocalypse");
  });

  it("un tips sans section officielle est rendu tel quel", () => {
    const plain = "Prérequis : Benjamin\nDonjons : Tour de Bethel";
    expect(splitDofusDexTip(plain)).toEqual({ official: null, rest: plain });
    expect(splitDofusDexTip("")).toEqual({ official: null, rest: "" });
    expect(splitDofusDexTip(null)).toEqual({ official: null, rest: "" });
  });

  it("un en-tête sans puce n'est PAS replié (rien à cacher)", () => {
    const solo = "**DofusDex officiel** — Dofus X\n**Prérequis** : Y";
    expect(splitDofusDexTip(solo).official).toBeNull();
  });

  it("un texte placé avant l'en-tête reste visible dans le reste", () => {
    const mixed = `Intro du bloc\n${TIP}`;
    const { rest } = splitDofusDexTip(mixed);
    expect(rest).toContain("Intro du bloc");
    expect(rest).toContain("**Prérequis**");
    expect(rest).not.toContain("Chaque chose en son temps");
  });
});

describe("RushDofusDexTip — le dépliable dit ce qu'il cache", () => {
  it("rend un `<details>` fermé par défaut, avec le compte d'objectifs et les sections visibles", () => {
    const html = renderToStaticMarkup(React.createElement(RushDofusDexTip, { text: TIP }));
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("DofusDex officiel — Dofus du Cauchemar (180–200)");
    expect(html).toContain("2 objectifs");
    // Le contenu replié est présent (accessible à l'ouverture)…
    expect(html).toContain("Eliocalypse : Résonance");
    // …et les sections utiles restent hors du dépliable.
    expect(html).toContain("Prérequis");
  });

  it("sans pavé, il délègue au rendu de tips existant (aucune régression)", () => {
    const html = renderToStaticMarkup(
      React.createElement(RushDofusDexTip, { text: "Prérequis : Benjamin" })
    );
    expect(html).not.toContain("<details");
    expect(html).toContain("Prérequis : Benjamin");
  });
});

describe("Câblage — les deux surfaces qui affichaient le pavé passent par le repli", () => {
  const DASH = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
  const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";

  it("le dashboard et l'overlay rendent RushDofusDexTip", () => {
    for (const [name, path] of [
      ["dashboard", DASH],
      ["overlay", OVERLAY],
    ] as const) {
      const src = readFileSync(path, "utf8");
      expect(src, `${name} n'importe pas le repli`).toContain(
        'import { RushDofusDexTip } from "@/components/dofus-quests/rush/RushDofusDexTip"'
      );
      expect(src, `${name} ne rend pas le repli`).toContain("<RushDofusDexTip");
    }
  });
});
