/**
 * Garde — l'image de bloc importée côté GOD doit être RENDUE côté membre.
 *
 * 🎯 Défauts mesurés (user, 20/09/2026) :
 *   1. l'upload d'un bloc Conseil/Tips n'apparaissait nulle part côté membre (le bandeau
 *      ne lisait jamais `milestone.imageUrl`) ;
 *   2. le guide public rendait ce même bloc comme un **chapitre** (« 0/0 étapes » + bouton
 *      « Tout valider ») alors que le dashboard montrait un bandeau — deux rendus pour un
 *      même bloc ;
 *   3. le bandeau lui-même a été refait (immersif : image à droite qui s'adapte, eyebrow
 *      « Attention / À savoir / Astuce / Conseil », picto intégré) et partagé aux 3 surfaces.
 *
 * 🛡️ On verrouille le **câblage** (comme les autres tests de câblage du repo : on lit les
 * sources, commentaires retirés — la prose ne doit pas faire passer le test).
 *
 * ⚠️ Lecture seule : aucun rendu, aucune base.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushInfoBanner } from "@/components/dofus-quests/rush/RushInfoBanner";

const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const SHARED = "src/components/dofus-quests/rush/RushInfoBanner.tsx";

/** Retire les commentaires : on verrouille le code, pas la prose. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function read(path: string): string {
  return codeOnly(readFileSync(path, "utf8"));
}

/** Bloc source d'une fonction locale (de son en-tête à la fonction suivante). */
function component(code: string, name: string): string {
  const start = code.indexOf(`function ${name}(`);
  expect(start, `${name} introuvable`).toBeGreaterThan(-1);
  const end = code.indexOf("\nfunction ", start + 1);
  return code.slice(start, end === -1 ? code.length : end);
}

describe("Rush — bandeau CONSEIL / TIPS (bloc INFO)", () => {
  it("le bandeau partagé rend l'image du bloc (nue, jamais rognée)", () => {
    const shared = read(SHARED);
    expect(shared).toMatch(/safeImageUrl\(imageUrl\)/);
    expect(shared).toMatch(/object-contain/);
    expect(shared, "l'image ne doit jamais être rognée").not.toMatch(/object-cover/);
  });

  it("les trois surfaces rendent le MÊME composant partagé", () => {
    for (const [name, path] of [["dashboard", DASHBOARD], ["guide public", PUBLIC], ["overlay", OVERLAY]] as const) {
      const code = read(path);
      expect(code, `${name} : RushInfoBanner non importé`).toMatch(
        /import \{ RushInfoBanner \} from "@\/components\/dofus-quests\/rush\/RushInfoBanner"/
      );
      expect(code, `${name} : le bandeau partagé n'est pas rendu`).toMatch(/<RushInfoBanner/);
    }
  });

  it("le dashboard transmet le titre, l'image et la couleur du bloc", () => {
    const banner = component(read(DASHBOARD), "InfoBanner");
    expect(banner).toMatch(/imageUrl=\{milestone\.imageUrl\}/);
    expect(banner).toMatch(/accentColor=\{milestone\.accentColor\}/);
  });

  it("le guide public ne rend plus un bloc INFO comme un chapitre", () => {
    const code = read(PUBLIC);
    // Branche DÉDIÉE au type INFO (distincte du filtre `SEPARATEUR || INFO` de la pagination).
    const infoBranch = code.indexOf('if (ms.type === "INFO") {');
    expect(infoBranch, "branche INFO absente du guide public").toBeGreaterThan(-1);
    expect(code.slice(infoBranch, infoBranch + 400)).toMatch(/<RushInfoBanner/);
  });
});

/** Rendu RÉEL du bandeau (Node + `renderToStaticMarkup` : aucune dépendance ajoutée, pas de DOM). */
const infoHtml = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    React.createElement(RushInfoBanner, { children: "Lancer Eternelle Moisson dès que possible", ...props } as never)
  );

describe("RushInfoBanner — le bandeau lui-même", () => {
  it("loge l'image du bloc à droite, nue et jamais rognée", () => {
    const out = infoHtml({ imageUrl: "/uploads/guides/tips-moisson.webp", accentColor: "#7c3aed" });
    expect(out).toContain('src="/uploads/guides/tips-moisson.webp"');
    expect(out).toContain("object-contain");
    expect(out).not.toContain("object-cover");
    expect(out).toContain("Lancer Eternelle Moisson dès que possible");
  });

  it("URL non sûre ou absent ⇒ aucun <img> (jamais de trou)", () => {
    expect(infoHtml({ imageUrl: "javascript:alert(1)" })).not.toContain("<img");
    expect(infoHtml({})).not.toContain("<img");
  });

  it("l'eyebrow nomme le registre ET porte le picto (plus d'icône isolée)", () => {
    const warm = infoHtml({ accentColor: "#f59e0b" });
    expect(warm).toContain("Attention");
    expect(warm).toContain("⚠️");
    expect(infoHtml({ accentColor: "#3b82f6" })).toContain("À savoir");
    expect(infoHtml({ accentColor: "#7c3aed" })).toContain("Astuce");
    expect(infoHtml({ accentColor: "#10b981" })).toContain("Conseil");
  });

  it("titre fort quand il est fourni, absent sinon", () => {
    expect(infoHtml({ title: "Avant le rush" })).toContain("Avant le rush");
    expect(infoHtml({ accentColor: "#e11d48" })).toContain("background-color:#e11d48");
  });
});
