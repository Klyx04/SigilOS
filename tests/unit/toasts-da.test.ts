/**
 * Garde — toasts navigateur à la DA « Gouache Wakfu » (19/11/2026).
 *
 * 🎯 Demande user (verbatim) : « TOUTES les notif toast coté navigateur (hors overlay)
 * sont tjres pas à la DA ».
 *
 * Les toasts globaux portaient `bg-card/90`, `rounded-2xl`, `backdrop-blur-xl` et une
 * ombre : trois interdits de la DA, et une matière qui ignorait `--da-panel`/`--da-ink`.
 * Ils vivent désormais sous `[data-da="wakfu"]` et portent `.da-toaster`, stylé par
 * `da-wakfu.css` (déjà chargé par le layout racine).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const TOASTER = "src/components/shared/AppToaster.tsx";
const OVERLAY_LAYOUT = "src/app/overlay/layout.tsx";
const CSS = "src/app/da-wakfu.css";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("toasts hors overlay — la matière de la DA", () => {
  it("le Toaster global est sous la portée `data-da` et porte `.da-toaster`", () => {
    const src = codeOf(TOASTER);
    expect(src).toContain('data-da="wakfu"');
    expect(src).toContain('className="da-toaster"');
    expect(src).toContain('className: "da-toast"');
    // Plus aucune matière générique interdite par la DA.
    expect(src).not.toContain("backdrop-blur");
    expect(src).not.toContain("rounded-2xl");
    expect(src).not.toContain("bg-card/90");
  });

  it("le Toaster de la route overlay suit la même portée", () => {
    const src = readFileSync(OVERLAY_LAYOUT, "utf8");
    expect(src).toContain('data-da="wakfu"');
    expect(src).toContain('className="da-toaster"');
  });

  it("le CSS peint les toasts avec les jetons DA et un filet sémantique", () => {
    const css = readFileSync(CSS, "utf8");
    expect(css).toContain("[data-sonner-toaster].da-toaster [data-sonner-toast]");
    expect(css).toContain("var(--da-panel");
    expect(css).toContain("var(--da-ink");
    expect(css).toContain('[data-type="error"]');
    expect(css).toContain("var(--da-warn)");
  });
});
