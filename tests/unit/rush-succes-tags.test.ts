/**
 * Gardes — **succès = tags de quête**, pas des cases à cocher (18/11/2026).
 *
 * 🎯 Mesure : les 68 succès importés étaient 68 doublons cochables, sans quête liée.
 * Désormais un succès est un tag `{ type: "succes", id, name, iconId }` posé sur les
 * quêtes qu'il couvre, et les deux surfaces affichent une pastille + une fiche.
 *
 * 🛡️ Ce que ce test verrouille :
 *  · le parsing des tags (id, nom, icône) et l'écart des valeurs illisibles ;
 *  · le dédoublonnage par id (une quête ne montre pas deux fois le même succès) ;
 *  · la pastille partagée est bien montée par le dashboard ET par l'overlay.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { getSequenceSuccesses } from "@/lib/rush-guide-utils";

const read = (path: string) => readFileSync(path, "utf8");

const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const OVERLAY_LIST =
  "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx";

describe("succès attachés à une quête", () => {
  it("lit l'id, le nom et l'icône du client", () => {
    const seq = {
      activityTags: [
        { type: "item", name: "Ortie" },
        { type: "succes", id: "8519", name: "Second temps", iconId: 203 },
      ],
    };
    expect(getSequenceSuccesses(seq)).toEqual([{ id: "8519", name: "Second temps", iconId: 203 }]);
  });

  it("écarte un tag vide ou illisible, et dédoublonne par id", () => {
    const seq = {
      activityTags: [
        { type: "succes", id: "", name: "   " },
        { type: "succes", id: "42", name: "Doublon", iconId: 12 },
        { type: "succes", id: "42", name: "Doublon", iconId: 12 },
        { type: "succes", name: "Sans id" },
      ],
    };
    expect(getSequenceSuccesses(seq)).toEqual([
      { id: "42", name: "Doublon", iconId: 12 },
      { id: null, name: "Sans id", iconId: null },
    ]);
  });

  it("une séquence sans tag de succès n'en porte aucun", () => {
    expect(getSequenceSuccesses({ activityTags: [{ type: "donjon", name: "X" }] })).toEqual([]);
    expect(getSequenceSuccesses(null)).toEqual([]);
  });

  it("la pastille partagée est montée par le dashboard ET l'overlay", () => {
    for (const path of [DASHBOARD, OVERLAY_LIST]) {
      expect(read(path), path).toContain("SuccessChip");
    }
  });
});
