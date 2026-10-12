/**
 * Gardes — **déslop des surfaces legacy les plus visibles** (retour user 21/09/2026 :
 * « cette page n'a pas été désloppée et mise au goût du jour comme le reste — y en a-t-il
 * d'autres comme ça ? les pages d'onboarding, etc. ? »).
 *
 * 🔍 Ce que la mesure a montré : la garde `sigil/no-hardcoded-colors` portait une allowlist
 * dont **9 entrées masquaient du code déjà propre** (`maintenance`, tout `auth`, `public-header`,
 * `galactic-footer`, `nebula-client-wrapper`, `ganymede`, `guide-styles`, `optimized-guide`,
 * `coming-soon-banner`) — donc la règle ne protégeait plus ces fichiers : n'importe quelle
 * régression y passait en silence. Deux fichiers étaient réellement legacy et **publics** :
 * `components/layout/access-denied.tsx` (l'écran de refus, vu par des utilisateurs non
 * autorisés) et `app/global-error.tsx`. Trois fichiers orphelins (`layout/ui-test/`) n'étaient
 * importés par personne.
 *
 * 🛡️ Ce que ce test verrouille : ① les surfaces désloppées restent hors allowlist ET sans
 * couleur en dur (scan du CODE, commentaires retirés) ; ② les entrées d'allowlist encore
 * présentes sont **justifiées** (le fichier existe et porte toujours des couleurs volontaires) ;
 * ③ les orphelins supprimés ne reviennent pas. Lecture seule, aucune base.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const ESLINT = readFileSync("eslint.config.mjs", "utf8");

/** Couleurs en dur interdites par `sigil/no-hardcoded-colors` (mêmes motifs que la règle). */
const BANNED = [
  /(?<![\w-])(?:bg|text|border|from|to|via|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g,
  /(?<![\w-])text-white(?:\/[^\s"'`]*)?/g,
  /(?<![\w-])bg-black(?!\/)/g,
  /(?<![\w-])(?:text|bg|border|divide|ring|from|to|via)-(?:zinc|slate|gray|neutral|stone)-\d+(?:\/[^\s"'`]*)?/g,
  /(?<![\w-])(?:text|bg|border|from|to|via)-(?:emerald|amber|red|rose|blue|cyan|purple|indigo)-\d+(?:\/[^\s"'`]*)?/g,
];

/** Retire les commentaires : la règle ne regarde que les littéraux, pas la prose. */
const codeOnly = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const countBanned = (source: string) => BANNED.reduce((n, re) => n + (source.match(re) || []).length, 0);

describe("allowlist eslint — plus d'entrée qui masque du code déjà propre", () => {
  // ⚠️ `allowFiles:` / `allowHex:` apparaissent DEUX fois (schéma de la règle, puis sa config) :
  // on ancre sur la ligne de CONFIGURATION, sinon le test lit le schéma et ne prouve rien.
  const ruleStart = ESLINT.indexOf('"sigil/no-hardcoded-colors": ["warn"');
  const allowBlock = ESLINT.slice(ruleStart, ESLINT.indexOf("allowHex:", ruleStart));

  it("les surfaces désloppées ne sont plus exemptées", () => {
    for (const removed of [
      "access-denied", "global-error", "\\\\maintenance\\\\", "\\\\auth\\\\",
      "public-header", "galactic-header", "galactic-footer", "ui-test",
      "nebula-client-wrapper", "coming-soon-banner", "ganymede", "guide-styles", "optimized-guide",
    ]) {
      expect(allowBlock, `entrée morte restée dans l'allowlist : ${removed}`).not.toContain(removed);
    }
  });

  it("les exemptions restantes sont des chantiers legacy assumés (chantiers dédiés)", () => {
    for (const kept of ["songes", "worldmap", "ocre-filter-bar", "guide", "rush", "geoguesser", "\\\\god\\\\"]) {
      expect(allowBlock, `exemption perdue : ${kept}`).toContain(kept);
    }
  });
});

describe("surfaces désloppées — aucune couleur en dur, aucune animation gratuite", () => {
  const FILES = [
    "src/components/layout/access-denied.tsx",
    "src/components/access-denied.tsx",
    "src/app/global-error.tsx",
  ];

  it("plus une seule couleur en dur", () => {
    for (const rel of FILES) {
      expect(countBanned(codeOnly(rel)), rel).toBe(0);
    }
  });

  it("plus de halo, de flou d'arrière-plan ni d'emoji dans ces écrans", () => {
    for (const rel of FILES) {
      const code = codeOnly(rel);
      expect(code, rel).not.toMatch(/blur-(?:xl|3xl)/);
      expect(code, rel).not.toMatch(/animate-pulse/);
      expect(code, rel).not.toMatch(/✅|⚠️/);
    }
  });

  it("l'écran de refus garde ses 4 variantes et son dialogue de réintégration", () => {
    const code = codeOnly(FILES[0]);
    for (const variant of ["lock", "archive", "timeout"]) {
      expect(code, variant).toContain(`variant === "${variant}"`);
    }
    expect(code).toMatch(/requestProfileReactivation/);
    expect(code).toMatch(/revalidateUserContext/);
  });
});

describe("orphelins supprimés", () => {
  it("le dossier de maquettes `layout/ui-test/` ne revient pas", () => {
    expect(existsSync("src/components/layout/ui-test")).toBe(false);
  });
});
