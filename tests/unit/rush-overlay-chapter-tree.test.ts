/**
 * Garde — les blocs qui ne sont PAS des étapes (séparateur, encart CONSEIL/TIPS, « Dofus
 * obtenu ») n'entrent jamais dans la navigation « étapes » de l'overlay.
 *
 * 🎯 Le besoin (user, 20/09/2026 puis 21/09/2026) : dans l'overlay, un bandeau ne doit pas
 * apparaître dans le sélecteur de chapitres (rien à cocher, aucune quête, donc « 0/0 » n'a
 * aucun sens) — mais il doit rester VISIBLE dans le contenu et atteignable par la
 * navigation précédent / suivant. La règle est partagée (`isNonCheckableBlock`), pas
 * recopiée ici : séparateur, encart CONSEIL/TIPS et « Dofus obtenu » tombent ensemble.
 *
 * 🛡️ Ce que ce test verrouille : le filtre des trois types, l'ordre des chapitres conservé,
 * et le cas dégénéré d'un guide fait uniquement de bandeaux (liste vide ⇒ rien à sélectionner).
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

describe("selectableChapters — bandeaux hors du sélecteur d'étapes", () => {
  it("retire les trois bandeaux en gardant l'ordre des vrais chapitres", () => {
    const out = selectableChapters([
      ms("c1", "QUETE_SERIE"),
      ms("sep", "SEPARATEUR"),
      ms("c2", "DONJON"),
      ms("info", "INFO"),
      ms("dofus-out", "DOFUS_OBTAINED"),
      ms("c3", "DOFUS"),
    ]);
    expect(out.map((m) => m.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("ne touche pas à un guide sans bandeau", () => {
    const guide = [ms("c1", "QUETE_SERIE"), ms("c2", "DOFUS")];
    expect(selectableChapters(guide)).toEqual(guide);
  });

  it("guide fait uniquement de bandeaux ⇒ plus rien à sélectionner", () => {
    expect(selectableChapters([ms("s1", "SEPARATEUR"), ms("s2", "SEPARATEUR")])).toEqual([]);
    expect(selectableChapters([ms("i1", "INFO"), ms("i2", "INFO")])).toEqual([]);
  });
});
