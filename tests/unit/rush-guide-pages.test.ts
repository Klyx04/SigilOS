/**
 * Gardes — **pagination du guide interne** : une page = un chapitre (ou un libellé).
 *
 * 🎯 Correction user (21/10/2026) : « le bouton suivant ne fait rien » + « le sommaire ne
 * sert à rien ». Mesure : `timelineItems` coupe un chapitre en plusieurs morceaux dès
 * qu'une bannière le traverse → 23 pages pour 6 chapitres, libellés et numéros dupliqués ;
 * le paginateur s'indexant par numéro, « Suiv. » retombait sur la première page.
 *
 * 🛡️ Ce que ce test verrouille : les morceaux d'un même chapitre fusionnent, deux libellés
 * différents d'un même numéro NE fusionnent PAS (chapitre 0 : un par Dofus), l'ordre des
 * items est conservé (les bannières gardent leur place) et l'entrée n'est pas modifiée.
 */

import { describe, it, expect } from "vitest";
import { mergeChapterPages } from "@/lib/rush-guide-pages";

const page = (chapterNum: number | null, label: string, items: string[]) => ({
  chapterNum,
  label,
  items,
});

describe("mergeChapterPages — une page par chapitre (ou par libellé)", () => {
  it("fusionne les morceaux d'un même chapitre coupé par une bannière", () => {
    const out = mergeChapterPages([
      page(4, "L'Eliocalypse & Les Cavaliers", ["a", "b"]),
      page(4, "L'Eliocalypse & Les Cavaliers", ["banner", "c"]),
    ]);
    expect(out).toHaveLength(1);
    // L'ordre est conservé : la bannière reste ENTRE les deux morceaux.
    expect(out[0].items).toEqual(["a", "b", "banner", "c"]);
  });

  it("ne fusionne PAS deux libellés différents d'un même numéro (chapitre 0)", () => {
    const out = mergeChapterPages([
      page(0, "Obtention : Dofus Domakuro", ["a"]),
      page(0, "Obtention : Dofus Pourpre", ["b"]),
    ]);
    expect(out.map((p) => p.label)).toEqual([
      "Obtention : Dofus Domakuro",
      "Obtention : Dofus Pourpre",
    ]);
  });

  it("ne fusionne pas deux chapitres différents, même libellé vide", () => {
    const out = mergeChapterPages([page(1, "", ["a"]), page(2, "", ["b"])]);
    expect(out).toHaveLength(2);
  });

  it("laisse les pages sans chapitre (bandeaux isolés) telles quelles", () => {
    const out = mergeChapterPages([page(null, "", ["x"]), page(null, "", ["y"])]);
    expect(out).toHaveLength(2);
  });

  it("ne modifie pas l'entrée (pureté)", () => {
    const input = [page(4, "Chapitre", ["a"]), page(4, "Chapitre", ["b"])];
    const copy = JSON.parse(JSON.stringify(input));
    mergeChapterPages(input);
    expect(input).toEqual(copy);
  });

  it("un guide sans doublon reste identique", () => {
    const out = mergeChapterPages([
      page(1, "Départ & Fondations", ["a"]),
      page(2, "Les Premiers Primordiaux", ["b"]),
    ]);
    expect(out.map((p) => p.label)).toEqual([
      "Départ & Fondations",
      "Les Premiers Primordiaux",
    ]);
  });
});
