import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushRichText, splitRichText, bareLinkLabel } from "@/components/dofus-quests/rush/RushRichText";

/**
 * RushRichText — le texte des encarts CONSEIL / TIPS, rendu UNE fois pour le dashboard,
 * le guide public et l'overlay (composant partagé).
 *
 * Demande user (21/09/2026) : « dans les bandeaux de type tips/conseil je peux ajouter
 * n'importe où dans le texte un lien, une ou plusieurs positions cliquables presse-papier
 * en /w x,y … l'url doit pas être dispo mais le nom de la quête pointera vers l'url ».
 *
 * On verrouille le COMPORTEMENT, pas l'habillage : le découpage pur (sans DOM) et le rendu
 * réel de la chip (la commande copiée est `/w x,y`).
 */

const html = (text: string) => renderToStaticMarkup(React.createElement(RushRichText, { text }));

describe("splitRichText — découpage du texte enrichi", () => {
  it("un lien nommé porte le libellé et cache l'URL", () => {
    const out = splitRichText(
      "Lancer [Eternelle Moisson](https://www.dofuspourlesnoobs.com/leacuteternelle-moisson.html) dès que possible"
    );
    expect(out).toEqual([
      { kind: "text", value: "Lancer " },
      {
        kind: "link",
        label: "Eternelle Moisson",
        href: "https://www.dofuspourlesnoobs.com/leacuteternelle-moisson.html",
      },
      { kind: "text", value: " dès que possible" },
    ]);
  });

  it("une URL brute prend un libellé lisible, jamais l'URL complète", () => {
    const [link] = splitRichText("https://www.dofusdb.fr/fr/search?q=dofus").filter((p) => p.kind === "link");
    expect(link).toMatchObject({ kind: "link", label: "Lien DofusDB" });
    expect(bareLinkLabel("https://metamob.fr/settings#api")).toBe("metamob.fr");
    expect(bareLinkLabel("https://www.dofuspourlesnoobs.com/x.html")).toBe("Lien DofusNoobs");
  });

  it("la ponctuation qui suit une URL n'entre pas dans le lien", () => {
    const out = splitRichText("Voir https://metamob.fr/settings#api, puis revenir");
    expect(out[1]).toMatchObject({ kind: "link", href: "https://metamob.fr/settings#api" });
    expect(out[2]).toEqual({ kind: "text", value: ", puis revenir" });
  });

  it("reconnaît une position dans ses quatre écritures", () => {
    expect(splitRichText("Position de lancement : Village de la Canopée [-55,15].")[1]).toEqual({
      kind: "coord",
      x: -55,
      y: 15,
    });
    expect(splitRichText("Allez en [-55, 15, 2]")[1]).toMatchObject({ kind: "coord", x: -55, y: 15 });
    expect(splitRichText("puis /w -55,15 pour se déplacer")[1]).toMatchObject({ kind: "coord", x: -55, y: 15 });
    expect(splitRichText("puis /travel -55 15 pour se déplacer")[1]).toMatchObject({ kind: "coord", x: -55, y: 15 });
  });

  it("un lien non sûr n'est pas rendu comme lien (fail-closed)", () => {
    expect(splitRichText("[clic](javascript:alert(1))")[0]).toEqual({ kind: "text", value: "clic" });
    expect(splitRichText('https://x.fr/a"onmouseover=1')[0]).toEqual({ kind: "text", value: 'https://x.fr/a"onmouseover=1' });
  });

  it("un texte sans balise reste un seul morceau", () => {
    expect(splitRichText("Lancer Eternelle Moisson")).toEqual([
      { kind: "text", value: "Lancer Eternelle Moisson" },
    ]);
  });
});

describe("RushRichText — rendu réel", () => {
  it("le lien nommé est une ancre vers l'URL, le nom est visible", () => {
    const out = html("Lancer [Eternelle Moisson](https://www.dofuspourlesnoobs.com/leacuteternelle-moisson.html) !");
    expect(out).toContain('href="https://www.dofuspourlesnoobs.com/leacuteternelle-moisson.html"');
    expect(out).toContain("Eternelle Moisson");
    // L'URL n'apparaît qu'en attribut, jamais dans le texte affiché.
    expect(out.split("leacuteternelle-moisson.html").length - 1).toBe(1);
  });

  it("la position est copiable en /w x,y (format demandé)", () => {
    const out = html("Position de lancement : Village de la Canopée [-55,15].");
    expect(out).toContain("Cliquer pour copier /w -55,15");
    expect(out).toContain("Copier la commande /w -55,15");
    expect(out).not.toContain("/travel");
  });

  it("un texte vide ne rend rien", () => {
    expect(html("")).toBe("");
  });
});
