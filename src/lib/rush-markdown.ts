/**
 * Markdown **borné** des blocs Rush (12/11/2026).
 *
 * 🎯 Le champ libre d'un bloc Combat / Conseil doit permettre d'expliquer la strat
 * sans ouvrir la porte au HTML : on ne rend **jamais** de HTML brut, on n'utilise
 * pas `dangerouslySetInnerHTML`. Le sous-ensemble supporté est volontairement
 * petit :
 *
 *   **gras** · *italique* · ## titre · - puce · [lien](https://…)
 *   {or}texte{/or} · {vert} · {danger} · {ambre} · {info}
 *
 * Les couleurs sont **sémantiques** (tokens de la DA), jamais des hex libres : un
 * `{or}` reste lisible en clair comme en sombre, et une couleur choisie à la main
 * ne peut pas casser le contraste.
 *
 * Le parseur est une règle pure : il produit des blocs/inlines, le composant
 * `RushMarkdown` les rend. Les tests vivent dans `rush-markdown.test.ts`.
 */

import { safeExternalUrl } from "@/lib/security";

export const RUSH_MARKDOWN_COLORS = ["or", "vert", "danger", "ambre", "info"] as const;
export type RushMarkdownColor = (typeof RUSH_MARKDOWN_COLORS)[number];

export type RushMarkdownInline =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "color"; text: string; color: RushMarkdownColor }
  | { kind: "link"; text: string; url: string };

export type RushMarkdownBlock =
  | { kind: "heading"; level: 2 | 3; inlines: RushMarkdownInline[] }
  | { kind: "paragraph"; inlines: RushMarkdownInline[] }
  | { kind: "list"; items: RushMarkdownInline[][] };

const COLOR_NAMES = new Set<string>(RUSH_MARKDOWN_COLORS);

/** Analyse une ligne : gras, italique, couleur sémantique, lien http(s). */
function parseInline(text: string): RushMarkdownInline[] {
  const out: RushMarkdownInline[] = [];
  let index = 0;

  const pushText = (value: string) => {
    if (value) out.push({ kind: "text", text: value });
  };

  while (index < text.length) {
    const rest = text.slice(index);

    const strong = /^\*\*([^*]+)\*\*/.exec(rest);
    if (strong) {
      out.push({ kind: "strong", text: strong[1] });
      index += strong[0].length;
      continue;
    }

    const em = /^\*([^*]+)\*/.exec(rest);
    if (em) {
      out.push({ kind: "em", text: em[1] });
      index += em[0].length;
      continue;
    }

    const color = /^\{([a-z]+)\}([\s\S]*?)\{\/\1\}/.exec(rest);
    if (color && COLOR_NAMES.has(color[1])) {
      out.push({ kind: "color", text: color[2], color: color[1] as RushMarkdownColor });
      index += color[0].length;
      continue;
    }

    const link = /^\[([^\]]+)\]\(([^)]+)\)/.exec(rest);
    if (link) {
      const url = safeExternalUrl(link[2]);
      if (url) out.push({ kind: "link", text: link[1], url });
      else pushText(link[1]);
      index += link[0].length;
      continue;
    }

    // Texte normal : on avance jusqu'au prochain marqueur, ou d'un caractère si
    // le marqueur courant n'a pas formé une balise (jamais de boucle infinie).
    const next = rest.slice(1).search(/[*{\[]/);
    const length = next === -1 ? rest.length : next + 1;
    pushText(rest.slice(0, length));
    index += length;
  }

  return mergeAdjacentText(out);
}

/** Deux fragments de texte qui se suivent ne font qu'un : le rendu reste identique. */
function mergeAdjacentText(inlines: RushMarkdownInline[]): RushMarkdownInline[] {
  const out: RushMarkdownInline[] = [];
  for (const inline of inlines) {
    const previous = out[out.length - 1];
    if (inline.kind === "text" && previous?.kind === "text") {
      out[out.length - 1] = { ...previous, text: previous.text + inline.text };
    } else {
      out.push(inline);
    }
  }
  return out;
}

/** Découpe le texte en blocs : titre, liste, paragraphe (une ligne vide sépare). */
export function parseRushMarkdown(value: string | null | undefined): RushMarkdownBlock[] {
  const source = (value ?? "").replace(/\r\n/g, "\n");
  if (!source.trim()) return [];

  const blocks: RushMarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", inlines: parseInline(paragraph.join(" ").trim()) });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push({ kind: "list", items: list.map((item) => parseInline(item.trim())) });
    list = [];
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: heading[1].length === 2 ? 2 : 3,
        inlines: parseInline(heading[2].trim()),
      });
      continue;
    }

    const item = /^[-*]\s+(.+)$/.exec(line.trim());
    if (item) {
      flushParagraph();
      list.push(item[1]);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return blocks;
}
