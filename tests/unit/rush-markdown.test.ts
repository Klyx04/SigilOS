/**
 * Gardes — **markdown borné des blocs Rush** (12/11/2026).
 *
 * 🎯 Le champ libre d'un bloc Combat / Conseil explique la strat : gras, italique,
 * titres, listes, liens http(s) et couleurs **sémantiques** (`{or}`, `{vert}`,
 * `{danger}`, `{ambre}`, `{info}`).
 *
 * 🛡️ Aucun HTML brut n'est rendu (`dangerouslySetInnerHTML` interdit) : tout ce qui
 * n'est pas dans le sous-ensemble reste du **texte**. Une URL `javascript:` ne
 * devient jamais un lien.
 */

import { describe, it, expect } from "vitest";
import { parseRushMarkdown } from "@/lib/rush-markdown";

describe("blocs", () => {
  it("un texte vide ne produit aucun bloc", () => {
    expect(parseRushMarkdown("")).toEqual([]);
    expect(parseRushMarkdown(null)).toEqual([]);
    expect(parseRushMarkdown("   \n  ")).toEqual([]);
  });

  it("une ligne simple est un paragraphe", () => {
    expect(parseRushMarkdown("Placez-vous derrière le pilier.")).toEqual([
      { kind: "paragraph", inlines: [{ kind: "text", text: "Placez-vous derrière le pilier." }] },
    ]);
  });

  it("deux lignes vides séparent deux paragraphes", () => {
    const blocks = parseRushMarkdown("Premier.\n\nSecond.");
    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "paragraph"]);
  });

  it("## et ### sont des titres", () => {
    expect(parseRushMarkdown("## Stratégie")[0]).toMatchObject({ kind: "heading", level: 2 });
    expect(parseRushMarkdown("### Astuce")[0]).toMatchObject({ kind: "heading", level: 3 });
  });

  it("les lignes - sont une liste", () => {
    const blocks = parseRushMarkdown("- Premier\n- Second");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "list" });
    if (blocks[0].kind === "list") {
      expect(blocks[0].items).toHaveLength(2);
    }
  });
});

describe("inline", () => {
  it("gras et italique", () => {
    expect(parseRushMarkdown("**gras** et *italique*")[0]).toMatchObject({
      kind: "paragraph",
      inlines: [
        { kind: "strong", text: "gras" },
        { kind: "text", text: " et " },
        { kind: "em", text: "italique" },
      ],
    });
  });

  it("les couleurs sémantiques sont reconnues", () => {
    expect(parseRushMarkdown("{or}à faire{/or}")[0]).toMatchObject({
      kind: "paragraph",
      inlines: [{ kind: "color", text: "à faire", color: "or" }],
    });
    expect(parseRushMarkdown("{danger}attention{/danger}")[0]).toMatchObject({
      kind: "paragraph",
      inlines: [{ kind: "color", text: "attention", color: "danger" }],
    });
  });

  it("une couleur inconnue reste du texte", () => {
    expect(parseRushMarkdown("{violet}texte{/violet}")[0]).toMatchObject({
      kind: "paragraph",
      inlines: [{ kind: "text", text: "{violet}texte{/violet}" }],
    });
  });

  it("un lien http(s) devient un lien", () => {
    expect(parseRushMarkdown("[Vidéo](https://youtube.com/watch?v=1)")[0]).toMatchObject({
      kind: "paragraph",
      inlines: [{ kind: "link", text: "Vidéo", url: "https://youtube.com/watch?v=1" }],
    });
  });

  it("un lien javascript: reste du texte", () => {
    const block = parseRushMarkdown("[X](javascript:alert(1))")[0];
    expect(block).toMatchObject({ kind: "paragraph" });
    if (block.kind === "paragraph") {
      expect(block.inlines.some((inline) => inline.kind === "link")).toBe(false);
      expect(block.inlines.map((inline) => inline.text).join("")).toContain("X");
    }
  });

  it("le HTML brut reste du texte, jamais interprété", () => {
    const block = parseRushMarkdown("<script>alert(1)</script>")[0];
    expect(block).toMatchObject({ kind: "paragraph" });
    if (block.kind === "paragraph") {
      expect(block.inlines).toEqual([{ kind: "text", text: "<script>alert(1)</script>" }]);
    }
  });
});
