/**
 * Garde — les blocs SÉPARATEUR n'entrent jamais dans la navigation « étapes » de l'overlay.
 *
 * 🎯 Le besoin (user, 20/09/2026) : dans l'overlay, un séparateur ne doit pas apparaître
 * dans le sélecteur de chapitres (ce n'est pas une étape : rien à cocher, aucune quête,
 * donc « 0/0 » n'a aucun sens) — mais il doit rester visible dans le contenu (son bandeau).
 *
 * 🛡️ Ce que ce test verrouille : le filtre, l'ordre des chapitres conservé, et le cas
 * dégénéré d'un guide fait uniquement de séparateurs (liste vide ⇒ rien à sélectionner).
 *
 * ⚠️ Lecture seule : aucune base, aucun réseau (`renderToStaticMarkup` inutile ici).
 */

import { describe, it, expect } from "vitest";
import { selectableChapters } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayChapterTree";
import type { RushMilestone } from "@/types/rush-guide-types";

const ms = (id: string, type: string): RushMilestone => ({
  id,
  chapter: 1,
  chapterLabel: "Chapitre 1",
  title: id,
  type,
  order: 0,
  isOptional: false,
  sequences: [],
});

describe("selectableChapters — séparateurs hors du sélecteur d'étapes", () => {
  it("retire les séparateurs en gardant l'ordre des vrais chapitres", () => {
    const out = selectableChapters([
      ms("c1", "QUETE_SERIE"),
      ms("sep", "SEPARATEUR"),
      ms("c2", "DONJON"),
      ms("info", "INFO"),
    ]);
    expect(out.map((m) => m.id)).toEqual(["c1", "c2", "info"]);
  });

  it("ne touche pas à un guide sans séparateur", () => {
    const guide = [ms("c1", "QUETE_SERIE"), ms("c2", "DOFUS")];
    expect(selectableChapters(guide)).toEqual(guide);
  });

  it("guide fait uniquement de séparateurs ⇒ plus rien à sélectionner", () => {
    expect(selectableChapters([ms("s1", "SEPARATEUR"), ms("s2", "SEPARATEUR")])).toEqual([]);
  });
});
