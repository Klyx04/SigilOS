import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { QuestRow } from "@/components/dofus-quests/DofusTimelineQuest";

const baseQuest = {
  id: "q1",
  name: "Voyage, voyage",
  questType: "XXX",
  zone: "Routes Rocailleuses",
  level: 120,
  positions: [{ x: 1, y: 2 }],
  dungeonsRequired: [{ id: "d1", name: "Donjon X", imageUrl: "/game-data/dungeons/x.webp" }],
  npcName: "Merina",
  requirements: { npcImageUrl: "/uploads/guides/merina.webp" },
};

const props = (quest: Record<string, unknown> = {}) =>
  ({
    quest: { ...baseQuest, ...quest },
    color: "#a855f7",
    isCompleted: false,
    isLast: true,
    isNext: true,
    isBlocked: false,
    isSelected: false,
    synergyForQuest: [],
    currentUser: undefined,
    prereqs: [],
    liveViewers: [],
    guildId: "guild-1",
    onFocusPrereq: vi.fn(),
    onClick: vi.fn(),
    onToggle: vi.fn(),
  }) as unknown as Parameters<typeof QuestRow>[0];

const html = (quest?: Record<string, unknown>) =>
  renderToStaticMarkup(React.createElement(QuestRow, props(quest)));

describe("QuestRow — ligne dense facon Sylvestre (lot 2a)", () => {
  it("ordre : icone type, nom, PNJ, position, donjon", () => {
    const out = html();
    const icon = out.indexOf("/assets/icons/icone-quete.png");
    const name = out.indexOf("Voyage, voyage");
    const npc = out.indexOf("Merina");
    const pos = out.indexOf("1,2");
    const dj = out.indexOf("succes?dungeon=d1");
    expect(icon).toBeGreaterThanOrEqual(0);
    for (const i of [name, npc, pos, dj]) expect(i).toBeGreaterThan(icon);
    expect(name).toBeLessThan(npc);
    expect(npc).toBeLessThan(pos);
    expect(pos).toBeLessThan(dj);
  });

  it("donjon : icone cliquable vers la fiche interne", () => {
    const out = html();
    expect(out).toContain('href="/dashboard/guild-1/succes?dungeon=d1&amp;view=boss"');
  });

  it("PNJ sans image : nom en repli (jamais de trou)", () => {
    const out = html({ requirements: {}, dungeonsRequired: [] });
    expect(out).toContain("Merina");
    expect(out).toContain('title="PNJ : Merina"');
    expect(out).not.toContain("/game-data/npcs");
    expect(out).not.toContain("/uploads/guides/merina.webp");
  });

  it("position : chip copiable /travel + bouton zaap manuel", () => {
    const out = html({ positions: [{ x: -22, y: -24, zaap: { x: -20, y: -20 } }] });
    expect(out).toContain("Copier /travel -22,-24");
    expect(out).toContain("/assets/dofus/icons/zaap.png");
  });
});
