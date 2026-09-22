/**
 * Gardes — **déslop « public hors God »** (suite du chantier `access-denied`/`global-error`).
 *
 * 🎯 Retour user (21/09/2026) : « cette page n'a pas été déslopée et mise au goût du jour comme le
 * reste — y en a-t-il d'autres comme ça ? » puis « finir le déslop public d'abord : ce qui reste
 * hors God ».
 *
 * 🔍 Mesure (règle `sigil/no-hardcoded-colors`, qui fait autorité — elle applique déjà allowHex et
 * allowFiles) : dans le périmètre public, deux natures de cas se mélangeaient :
 *   1. **vrai slop** — `RaidPlannerClient` peignait ses rôles (Tank/Soin/DPS/Placement/Contrôle/Mule)
 *      avec les palettes Tailwind `blue-500`/`emerald-400`/`rose-400`/`amber-400`/`cyan-400`/`slate-400`
 *      au lieu des jetons `info`/`success`/`danger`/`warning`/`accent`/`muted-foreground` — donc
 *      **aucun suivi du thème** ;
 *   2. **couleurs volontaires** — le HUD `boss-overlay` (fenêtre au-dessus du jeu, comme l'overlay
 *      Rush), les maquettes `landing/registre/*` (« reproduction fidèle au pixel près » des modules)
 *      et `DiscordEmbedPreview` (le rendu DOIT ressembler à Discord) : les repeindre casserait leur
 *      raison d'être ⇒ **documentées** dans l'allowlist, jamais devinées.
 *
 * 🛡️ Ce que ce test verrouille : ① le planificateur de raids consomme les jetons sémantiques et
 * n'a plus AUCUNE palette en dur ; ② les exemptions « volontaires » sont **écrites et justifiées**
 * dans `eslint.config.mjs` (une exemption sans raison redevient une dette invisible). Lecture seule.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const RAID = "src/app/raids/_components/RaidPlannerClient.tsx";
const ESLINT = readFileSync("eslint.config.mjs", "utf8");

const BANNED = [
  /(?<![\w-])(?:bg|text|border|from|to|via|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g,
  /(?<![\w-])text-white(?:\/[^\s"'`]*)?/g,
  /(?<![\w-])bg-black(?!\/)/g,
  /(?<![\w-])(?:text|bg|border|divide|ring|from|to|via)-(?:zinc|slate|gray|neutral|stone)-\d+(?:\/[^\s"'`]*)?/g,
  /(?<![\w-])(?:text|bg|border|from|to|via)-(?:emerald|amber|red|rose|blue|cyan|purple|indigo)-\d+(?:\/[^\s"'`]*)?/g,
];

const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("planificateur de raids — jetons sémantiques, zéro palette en dur", () => {
  const code = codeOf(RAID);

  it("n'a plus aucune couleur en dur", () => {
    const hits = BANNED.reduce((n, re) => n + (code.match(re) || []).length, 0);
    expect(hits, "couleurs en dur restantes").toBe(0);
  });

  it("les rôles sont peints avec les jetons de statut du thème", () => {
    // Un rôle = une couleur SÉMANTIQUE (Tank=info, Soin=success, DPS=danger, Placement=warning, Contrôle=accent).
    expect(code).toMatch(/tank:[^}]*bg-info\/15[^}]*text-info/);
    expect(code).toMatch(/healer:[^}]*bg-success\/15[^}]*text-success/);
    expect(code).toMatch(/"dps-range":[^}]*bg-danger\/15[^}]*text-danger/);
    expect(code).toMatch(/placement:[^}]*bg-warning\/15[^}]*text-warning/);
    expect(code).toMatch(/control:[^}]*bg-accent\/15[^}]*text-accent/);
    // La mule reste NEUTRE (c'est un rôle sans couleur métier).
    expect(code).toMatch(/utility:[^}]*bg-elevated[^}]*text-muted-foreground/);
  });
});

describe("exemptions VOULUES — écrites, jamais implicites", () => {
  it("le HUD au-dessus du jeu et les maquettes « pixel près » sont documentés dans l'allowlist", () => {
    for (const pattern of ["boss-overlay", "landing/registre", "discordembedpreview"]) {
      expect(ESLINT, `exemption non documentée : ${pattern}`).toContain(pattern);
    }
  });

  it("chaque exemption de ce chantier porte un commentaire de justification", () => {
    // La justification doit précéder les motifs : on l'exige dans les 8 lignes au-dessus.
    const idx = ESLINT.indexOf('"boss-overlay"');
    expect(idx).toBeGreaterThan(-1);
    const above = ESLINT.slice(Math.max(0, idx - 400), idx);
    expect(above).toMatch(/HUD|PiP|fenêtre/i);
    const idxMock = ESLINT.indexOf('"landing/registre"');
    expect(ESLINT.slice(Math.max(0, idxMock - 300), idxMock)).toMatch(/maquettes|pixel/i);
  });
});
