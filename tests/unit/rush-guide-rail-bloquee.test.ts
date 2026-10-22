/**
 * Gardes — **rail de droite, ciblage du prérequis et carte bloquée** (guide interne/public).
 *
 * 🎯 Retours user (21/10/2026, verbatim) : « le panneau de droite avec les ressources les dj
 * ne suis pas le scroll vertical des étapes déroulé, le guide public le fait bien » · « quand
 * on clic sur une quête "a terminer avant" ca renvoie bien dans la bonne étape mais ca cible
 * pas la quete » · « le bloc d'une quete bloqué rouge … c'est très IA slop, ca manque de
 * l'icone de quete à côté d'elles et le bouton info devrais pas non plus etre dispo ».
 *
 * 🛡️ Faits verrouillés (lecture de source : ce sont des composants monolithiques) :
 *  · l'item de grille du rail est ÉTIRÉ et le sticky est sur un bloc interne (sinon aucune
 *    course de scroll : c'était le cas avec `align-items: start`) ;
 *  · la quête ciblée (prérequis, repère, reprise) porte un anneau VISIBLE (2 px + offset) ;
 *  · une carte bloquée garde l'icône de quête et n'affiche pas le bouton info côté public.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const DASH = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";

const codeOf = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const DASH_CODE = codeOf(DASH);
const PUB_CODE = codeOf(PUBLIC);

describe("Rail de droite — le panneau suit le scroll des étapes", () => {
  it("l'item de grille est étiré (pas de align-items: start)", () => {
    expect(DASH_CODE).toMatch(/\.rush-content-grid\s*\{[\s\S]{0,400}align-items:\s*stretch/);
    expect(DASH_CODE).not.toMatch(/\.rush-content-grid\s*\{[\s\S]{0,400}align-items:\s*start/);
  });

  it("le sticky est porté par un bloc INTERNE au rail", () => {
    expect(DASH_CODE).toMatch(/className="rush-sidebar pr-1"/);
    expect(DASH_CODE).toMatch(
      /sticky top-4 max-h-\[calc\(100dvh-5\.5rem\)\] overflow-y-auto custom-scrollbar/
    );
  });
});

describe("Ciblage d'une quête (prérequis, repère, reprise)", () => {
  it("l'anneau de cible est visible (2 px + offset), sur les deux cartes", () => {
    // Carte normale ET carte bloquée : un simple `ring-1` se perdait dans le rouge.
    expect(DASH_CODE).toMatch(
      /focusedSeqId === seq\.id \? "ring-2 ring-success ring-offset-2 ring-offset-background"/
    );
    expect(DASH_CODE).toMatch(
      /focusedSeqId===seq\.id\?"ring-2 ring-success ring-offset-2 ring-offset-background bg-success\/\[0\.06\]"/
    );
  });
});

describe("Carte bloquée — une quête reste une quête", () => {
  it("elle porte l'icône de quête (même asset que la carte normale)", () => {
    expect(DASH_CODE).toMatch(/bg-danger\/\[0\.05\][\s\S]{0,700}icone-quete\.png/);
  });

  it("côté public, le bouton info n'est pas rendu quand la quête est verrouillée", () => {
    expect(PUB_CODE).toMatch(/\{!stepLocked && \(\s*<button[\s\S]{0,400}setDetailModalSeq/);
  });
});
