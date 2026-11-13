/**
 * Garde — **DA du studio God Rush** (E4, 12/11/2026).
 *
 * 🎯 Mesure avant le lot : **572 motifs interdits** dans `RushEditorStudio.tsx`
 * (`zinc-` 316, `emerald-` 94, `font-black` 78, `tracking-widest` 52, `purple-` 27,
 * `backdrop-blur` 4, `rounded-3xl` 1) — et **29** dans le kit God qu'il réutilise.
 *
 * 🛡️ Ce verrou prend le relais de `god-deslop` : le studio a quitté `src/app/god/**`,
 * donc `REFONTE_FILES` ne le couvre plus. Il vise **le studio et le kit God** :
 *  · zéro couleur en dur (une seule teinte d'accent : `primary`) ;
 *  · zéro `font-black` / `tracking-widest` / `backdrop-blur` ;
 *  · rayons ≤ 12 px (`rounded-xl` au maximum).
 *
 * Les commentaires sont retirés : on verrouille le code, pas la prose.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const codeOf = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

function sourcesOf(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourcesOf(path));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

const STUDIO_DIR = "src/components/god/rush-editor";
const KIT_DIR = "src/app/god/ui";
const FILES = [...sourcesOf(STUDIO_DIR), ...sourcesOf(KIT_DIR)];

/** Motifs bannis : typo décorative, blur, rayons > 12 px, blanc/noir en dur. */
const FORBIDDEN = [
  "font-black",
  "tracking-widest",
  "backdrop-blur",
  "rounded-2xl",
  "rounded-3xl",
  "text-white",
  "border-white",
  "bg-black",
];

/**
 * Couleurs en dur : on exige un **préfixe de couleur** (`text-`, `bg-`, `border-`…)
 * pour ne pas confondre `slate-` avec `-translate-y-1/2` (faux positif mesuré).
 */
const HARD_COLOR =
  /(?:text|bg|border|from|to|via|ring|divide|fill|stroke)-(?:zinc|emerald|purple|indigo|cyan|blue|violet|rose|pink|slate|gray|green|yellow|orange|teal|fuchsia)-/;

describe("E4 — le studio et le kit God ne portent plus la dette DA", () => {
  it("le périmètre couvre le studio et le kit (22 fichiers au 12/11/2026)", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(20);
    expect(FILES.some((path) => path.endsWith("RushEditorStudio.tsx"))).toBe(true);
    expect(FILES.some((path) => path.endsWith("god-card.tsx"))).toBe(true);
  });

  it("aucun motif interdit dans le code source", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const code = codeOf(file);
      for (const motif of FORBIDDEN) {
        if (code.includes(motif)) {
          offenders.push(`${file} → ${motif}`);
        }
      }
      if (HARD_COLOR.test(code)) {
        offenders.push(`${file} → couleur en dur (${code.match(HARD_COLOR)?.[0]})`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("les surfaces utilisent les tokens de la DA", () => {
    const studio = codeOf(`${STUDIO_DIR}/RushEditorStudio.tsx`);
    expect(studio).toContain("bg-surface");
    expect(studio).toContain("text-foreground");
    expect(studio).toContain("border-border");
    expect(studio).toContain("bg-primary");
  });
});
