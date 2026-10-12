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
 * 🛡️ Ce que ce test verrouille : les exemptions « volontaires » sont **écrites et justifiées**
 * dans `eslint.config.mjs` (une exemption sans raison redevient une dette invisible). Lecture seule.
 *
 * ℹ️ Le cas ① (planificateur de raids aux jetons sémantiques) a été **retiré le 13/10/2026** : la
 * page publique de raids et ses composants n'existent plus, et les jetons de rôles ne vivaient que
 * là — la garde n'avait plus de sujet. Les exemptions, elles, restent en vigueur.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ESLINT = readFileSync("eslint.config.mjs", "utf8");

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
