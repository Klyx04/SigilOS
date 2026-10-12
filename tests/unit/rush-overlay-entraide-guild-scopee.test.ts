/**
 * Garde — « Qui peut aider » n'apparaît QUE dans une fiche de guilde.
 *
 * 🔍 Mesure (08/10/2026) : la fiche détail montait la section d'entraide dès que
 * `guildId` était *truthy*. Or `GuideOverlayClient` déclare `guildId = "public"`
 * **par défaut** (sentinelle qui coupe déjà l'ocre) : le guide public et son overlay
 * PiP affichaient donc « Qui peut aider · Aucun membre ne correspond pour l'instant »
 * et appelaient l'action guild-scopée `getSequenceHelpers("public", …)`.
 *
 * 🛡️ Ce que ce test verrouille : la section est montée pour une **guilde réelle**,
 * jamais pour la sentinelle `"public"` ni sans `guildId` — règle partagée
 * `isPublicOverlay`, même traitement que `RushOverlayDungeonCard`.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// La section importe une Server Action (chaîne serveur + Prisma) : ici c'est SON
// MONTAGE qui est testé, pas son contenu.
vi.mock("@/components/dofus-quests/rush/QuestHelpersSection", () => ({
  QuestHelpersSection: () => React.createElement("div", null, "MARQUEUR-ENTRAIDE"),
}));

import { RushOverlayQuestDetailModal } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal";

const milestone = {
  id: "ms-1",
  title: "Alignement Bonta",
  type: "ALIGNEMENT",
  chapter: 1,
  order: 0,
} as never;

const seq = {
  id: "seq-1",
  subGuideName: "Corvée de patate",
  activityTags: [
    { type: "pos_tags", x: -32, y: -57, label: "Bonta", worldId: 1 },
    { type: "item", id: 537, name: "Pomme de Terre", count: 25 },
  ],
  tips: "Rendez-vous en [-32, -57]",
} as never;

const html = (guildId?: string) =>
  renderToStaticMarkup(
    React.createElement(RushOverlayQuestDetailModal, {
      milestone,
      seq,
      isDone: false,
      guildId,
      onClose: () => {},
    } as never)
  );

describe("fiche de quête — « Qui peut aider » réservé à la guilde", () => {
  it("ne monte PAS la section dans le guide public (aucun guildId)", () => {
    expect(html(undefined)).not.toContain("MARQUEUR-ENTRAIDE");
  });

  it("ne monte PAS la section pour la sentinelle `public` (overlay du guide public)", () => {
    expect(html("public")).not.toContain("MARQUEUR-ENTRAIDE");
  });

  it("monte la section pour une guilde réelle (dashboard + overlay interne)", () => {
    expect(html("123456789012345678")).toContain("MARQUEUR-ENTRAIDE");
  });

  it("la règle est la source partagée `isPublicOverlay` (pas un test sur `guildId`)", () => {
    expect(html("")).not.toContain("MARQUEUR-ENTRAIDE");
  });
});
