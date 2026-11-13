/**
 * Collage Markdown dans l'éditeur — détection + conversion (`@/lib/markdown-paste`).
 *
 * Verrouille le périmètre honnête du convertisseur : constructions courantes
 * vers le HTML gardé par TipTap, tableaux aplatis en puces (l'éditeur n'a pas
 * de nœud table), et échappement systématique du HTML brut (fail-closed).
 */

import { describe, it, expect } from "vitest";
import { looksLikeMarkdown, markdownToHtml, markdownInlineToHtml, escapeHtml } from "@/lib/markdown-paste";

describe("looksLikeMarkdown — détection conservatrice", () => {
    it("détecte un vrai document markdown (titres + listes)", () => {
        expect(looksLikeMarkdown("# Titre\n\n- un\n- deux\n")).toBe(true);
    });

    it("détecte un bloc de code ou un tableau", () => {
        expect(looksLikeMarkdown("```\ncode\n```")).toBe(true);
        expect(looksLikeMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |")).toBe(true);
    });

    it("ignore le texte courant (même avec un seul gras)", () => {
        expect(looksLikeMarkdown("Bonjour tout le monde")).toBe(false);
        expect(looksLikeMarkdown("Un seul **gras** ne suffit pas")).toBe(false);
        expect(looksLikeMarkdown("")).toBe(false);
    });
});

describe("markdownToHtml — blocs", () => {
    it("convertit les titres h1-h3", () => {
        expect(markdownToHtml("# Un\n## Deux\n### Trois")).toBe(
            "<h1>Un</h1><h2>Deux</h2><h3>Trois</h3>"
        );
    });

    it("convertit les listes à puces et numérotées", () => {
        expect(markdownToHtml("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
        expect(markdownToHtml("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
    });

    it("convertit les citations, séparateurs et blocs de code", () => {
        expect(markdownToHtml("> hello")).toBe("<blockquote><p>hello</p></blockquote>");
        expect(markdownToHtml("---")).toBe("<hr />");
        expect(markdownToHtml("```\nconst a = 1;\n```")).toBe(
            "<pre><code>const a = 1;</code></pre>"
        );
    });

    it("aplatit les tableaux en puces (pas de nœud table dans l'éditeur)", () => {
        const out = markdownToHtml("| Palier | Bonus |\n| --- | --- |\n| Rêve | +50 % |");
        expect(out).not.toContain("<table>");
        expect(out).toContain("<ul><li>Palier — Bonus</li><li>Rêve — +50 %</li></ul>");
    });

    it("convertit l'inline dans les titres et les puces", () => {
        expect(markdownToHtml("## Les **10** difficultés")).toBe(
            "<h2>Les <strong>10</strong> difficultés</h2>"
        );
    });
});

describe("markdownInlineToHtml — inline", () => {
    it("convertit gras, italique, barré, code, liens et images", () => {
        expect(markdownInlineToHtml("**gras**")).toBe("<strong>gras</strong>");
        expect(markdownInlineToHtml("*italique*")).toBe("<em>italique</em>");
        expect(markdownInlineToHtml("~~barré~~")).toBe("<s>barré</s>");
        expect(markdownInlineToHtml("`code`")).toBe("<code>code</code>");
        expect(markdownInlineToHtml("[guide](/docs/songes)")).toBe(
            '<a href="/docs/songes">guide</a>'
        );
        expect(markdownInlineToHtml("![run](/assets/docs/a.svg)")).toBe(
            '<img src="/assets/docs/a.svg" alt="run" />'
        );
    });
});

describe("escapeHtml — fail-closed", () => {
    it("échappe le HTML brut au lieu de le laisser passer", () => {
        expect(escapeHtml('<script>alert("x")</script>')).toBe(
            "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
        );
        expect(markdownToHtml('<img src=x onerror=alert(1)>')).not.toContain("<img");
        expect(markdownToHtml('<img src=x onerror=alert(1)>')).toContain("&lt;img");
    });
});
