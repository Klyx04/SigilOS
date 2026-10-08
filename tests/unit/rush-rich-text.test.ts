import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushRichText, RushTipLines, splitRichText, bareLinkLabel, splitTipLines, RUSH_RICH_TEXT_SYNTAX, RUSH_RICH_TEXT_NOT_ACCEPTED } from "@/components/dofus-quests/rush/RushRichText";

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

  it("le domaine connu est reconnu sur le HOST, jamais par sous-chaîne (CodeQL)", () => {
    // Un vrai sous-domaine garde son libellé…
    expect(bareLinkLabel("https://api.dofusdb.fr/fr/x")).toBe("Lien DofusDB");
    // …mais une sous-chaîne ailleurs dans l'URL ne suffit plus (usurpation de libellé).
    expect(bareLinkLabel("https://evil.com/?x=dofusdb.fr")).toBe("evil.com");
    expect(bareLinkLabel("https://dofusdb.fr.evil.com/x")).toBe("dofusdb.fr.evil.com");
    expect(bareLinkLabel("https://evil.com/dofuspourlesnoobs.com")).toBe("evil.com");
    // URL illisible : repli neutre, jamais de libellé trompeur.
    expect(bareLinkLabel("pas une url")).toBe("Lien");
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

  it("la position est copiable en /travel x,y (format demandé)", () => {
    const out = html("Position de lancement : Village de la Canopée [-55,15].");
    expect(out).toContain("Cliquer pour copier /travel -55,15");
    expect(out).toContain("Copier la commande /travel -55,15");
  });

  it("un texte vide ne rend rien", () => {
    expect(html("")).toBe("");
  });

  it("avec normalizeMeta, la position est TOUJOURS placée avant le lien, peu importe l'ordre de saisie", () => {
    const rawInverted = "[Chaque chose en son temps](https://www.dofuspourlesnoobs.com/chaque-chose-en-son-temps.html)\n[2,1]";
    const out = renderToStaticMarkup(React.createElement(RushRichText, { text: rawInverted, normalizeMeta: true }));

    const posIdx = out.indexOf("2, 1");
    const linkIdx = out.indexOf("Chaque chose en son temps");

    expect(posIdx).toBeGreaterThan(-1);
    expect(linkIdx).toBeGreaterThan(-1);
    // La position doit impérativement apparaître AVANT le lien !
    expect(posIdx).toBeLessThan(linkIdx);
  });
});

describe("splitTipLines — les conseils se lisent en puces", () => {
  it("coupe sur le saut de ligne, puis sur les séparateurs « + » et « · »", () => {
    expect(splitTipLines("Prendre la quête\nParler au PNJ")).toEqual([
      "Prendre la quête",
      "Parler au PNJ",
    ]);
    expect(splitTipLines("Prendre la quête + Parler au PNJ · Vaincre le boss")).toEqual([
      "Prendre la quête",
      "Parler au PNJ",
      "Vaincre le boss",
    ]);
  });

  it("préserve les liens nommés et les commandes de déplacement", () => {
    expect(
      splitTipLines("[Eternelle Moisson](https://www.dofuspourlesnoobs.com/x.html) puis /travel -55 15")
    ).toEqual(["[Eternelle Moisson](https://www.dofuspourlesnoobs.com/x.html) puis /travel -55 15"]);
  });

  it("ignore les lignes vides (un texte vide ne produit aucune puce)", () => {
    expect(splitTipLines("\n\n  \nPrendre la quête\n\n")).toEqual(["Prendre la quête"]);
    expect(splitTipLines(null)).toEqual([]);
    expect(splitTipLines("")).toEqual([]);
  });

  it("rendu réel : une puce par ligne, avec le texte enrichi et sa position copiable", () => {
    const out = renderToStaticMarkup(
      React.createElement(RushTipLines, { text: "Prendre la quête\nAller en [-55,15]" })
    );
    expect(out.match(/<li[\s>]/g)?.length).toBe(2);
    expect(out).toContain("Prendre la quête");
    // La position reste copiable à l'intérieur d'une puce (même rendu que hors puce).
    expect(out).toContain("Copier la commande /travel -55,15");
  });

  it("ne rend rien du tout quand il n'y a aucun conseil", () => {
    expect(renderToStaticMarkup(React.createElement(RushTipLines, { text: "  \n " }))).toBe("");
  });
});

/**
 * Aide de syntaxe affichée sous chaque champ de conseil du studio God (`RichTextSyntaxHint`).
 *
 * 🎯 Défaut mesuré (08/10/2026) : l'aide citait `[-55,15]` et `/travel -55,15`, **jamais `/w`**
 * — que le parseur reconnaît pourtant depuis toujours — et ne disait rien de la position nue
 * (`-55,15`), que le rendu laisse en texte. Les exemples sont désormais **exportés par ce même
 * module** : l'aide ne peut plus promettre une forme que `splitRichText` ignore, ni en oublier
 * une qu'il accepte.
 */
describe("RUSH_RICH_TEXT_SYNTAX — l'aide ne promet que des formes reconnues", () => {
  it("le lien nommé annoncé est bien décomposé en lien (le nom porte, l'URL se cache)", () => {
    const link = splitRichText(RUSH_RICH_TEXT_SYNTAX.link).find((p) => p.kind === "link");
    expect(link).toBeDefined();
    expect(link && link.kind === "link" ? link.label : "").toBe("Nom de la quête");
    expect(link && link.kind === "link" ? link.href : "").toContain("https://dofusdb.fr/");
  });

  it("les trois écritures de position annoncées sont toutes reconnues (et copiables)", () => {
    for (const example of [RUSH_RICH_TEXT_SYNTAX.bracket, RUSH_RICH_TEXT_SYNTAX.w, RUSH_RICH_TEXT_SYNTAX.travel]) {
      expect(splitRichText(example).some((p) => p.kind === "coord"), `${example} non reconnu`).toBe(true);
      expect(html(example), `${example} sans chip copiable`).toContain("Copier la commande /travel -55,15");
    }
  });

  it("la forme explicitement refusée par l'aide reste du texte (aucune coordonnée)", () => {
    expect(splitRichText(RUSH_RICH_TEXT_NOT_ACCEPTED)).toEqual([
      { kind: "text", value: RUSH_RICH_TEXT_NOT_ACCEPTED },
    ]);
  });
});

