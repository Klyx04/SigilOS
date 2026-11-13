/**
 * Gardes — **liens externes d'un bloc Rush** (12/11/2026).
 *
 * 🎯 Un bloc Combat / Conseil peut porter jusqu'à 10 liens nommés (vidéo YouTube,
 * guide écrit). Le nom est affiché, l'URL ouvre un nouvel onglet et sa favicon est
 * résolue à l'affichage.
 *
 * 🛡️ Une URL n'est acceptée que si `safeExternalUrl` la normalise en http(s) :
 * `javascript:`, `data:`, les URL relatives et les chaînes vides sont refusées.
 */

import { describe, it, expect } from "vitest";
import {
  RUSH_BLOCK_LINK_LABEL_MAX,
  RUSH_BLOCK_LINKS_MAX,
  hostOfRushLink,
  isSafeRushLinkUrl,
  normalizeRushBlockLinks,
  parseRushBlockLinks,
} from "@/lib/rush-block-links";

describe("URL sûre", () => {
  it("accepte http et https", () => {
    expect(isSafeRushLinkUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isSafeRushLinkUrl("http://example.com/guide")).toBe(true);
  });

  it("refuse javascript, data, relatif et vide", () => {
    expect(isSafeRushLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeRushLinkUrl("data:text/html,<script>")).toBe(false);
    expect(isSafeRushLinkUrl("/guides/local")).toBe(false);
    expect(isSafeRushLinkUrl("")).toBe(false);
    expect(isSafeRushLinkUrl(null)).toBe(false);
  });

  it("donne l'hôte d'un lien pour la favicon", () => {
    expect(hostOfRushLink("https://www.youtube.com/watch?v=abc")).toBe("www.youtube.com");
    expect(hostOfRushLink("javascript:alert(1)")).toBeNull();
  });
});

describe("lecture tolérante des liens", () => {
  it("garde les entrées valides et ignore les autres", () => {
    const links = parseRushBlockLinks([
      { label: "Vidéo", url: "https://youtube.com/watch?v=1" },
      { label: "", url: "https://example.com" },
      { label: "Danger", url: "javascript:alert(1)" },
      "pas un objet",
    ]);
    expect(links).toEqual([
      { label: "Vidéo", url: "https://youtube.com/watch?v=1" },
    ]);
  });

  it("borne le nombre de liens à 10", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      label: `Lien ${i}`,
      url: `https://example.com/${i}`,
    }));
    expect(parseRushBlockLinks(rows)).toHaveLength(RUSH_BLOCK_LINKS_MAX);
  });

  it("borne le libellé à 120 caractères", () => {
    const [link] = parseRushBlockLinks([
      { label: "a".repeat(RUSH_BLOCK_LINK_LABEL_MAX + 40), url: "https://example.com" },
    ]);
    expect(link.label).toHaveLength(RUSH_BLOCK_LINK_LABEL_MAX);
  });

  it("une valeur non-tableau donne une liste vide", () => {
    expect(parseRushBlockLinks(null)).toEqual([]);
    expect(parseRushBlockLinks("https://example.com")).toEqual([]);
    expect(parseRushBlockLinks({})).toEqual([]);
  });
});

describe("écriture : normalisation", () => {
  it("dédoublonne par URL, premier libellé gagnant", () => {
    const links = normalizeRushBlockLinks([
      { label: "Vidéo", url: "https://youtube.com/watch?v=1" },
      { label: "Doublon", url: "https://youtube.com/watch?v=1" },
      { label: "Guide", url: "https://example.com/guide" },
    ]);
    expect(links.map((link) => link.label)).toEqual(["Vidéo", "Guide"]);
  });

  it("conserve les query strings (encodeURI ne casse pas & et ?)", () => {
    const [link] = normalizeRushBlockLinks([
      { label: "Vidéo", url: "https://youtube.com/watch?v=1&t=42" },
    ]);
    expect(link.url).toBe("https://youtube.com/watch?v=1&t=42");
  });
});
