import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RushQuestConstraints } from "@/components/dofus-quests/rush/RushQuestConstraints";
import type { RushConstraintInfo } from "@/lib/rush-constraints";

const combatInfo: RushConstraintInfo = {
  kind: "combat",
  label: "Combat de groupe",
  text: "3 × Smilomouth",
  icon: "/assets/dofus/game-icons/party.png",
  jobs: [],
  combat: {
    mode: "group",
    monsters: [
      {
        name: "Smilomouth",
        count: 3,
        level: 132,
        health: 2800,
        imageUrl: "/api/assets-dofus/monsters/2860",
      },
    ],
  },
};

describe("RushQuestConstraints — fiches monstres", () => {
  it("rend chaque monstre cliquable vers sa fiche (id lu dans l'asset)", () => {
    const html = renderToStaticMarkup(
      React.createElement(RushQuestConstraints, { constraints: [combatInfo] }),
    );
    expect(html).toContain("Smilomouth");
    expect(html).toContain("Ouvrir la fiche de Smilomouth");
    expect(html).toContain("2800 PV");
  });

  it("ne fabrique pas de fiche quand l'image n'a pas d'id de monstre", () => {
    const html = renderToStaticMarkup(
      React.createElement(RushQuestConstraints, {
        constraints: [
          {
            ...combatInfo,
            combat: {
              ...combatInfo.combat!,
              monsters: [{ name: "Inconnu", count: 1 }],
            },
          },
        ],
      }),
    );
    expect(html).toContain("Inconnu");
    expect(html).not.toContain("Ouvrir la fiche de Inconnu");
  });
});
