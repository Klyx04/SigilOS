import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushSeparatorBanner } from "@/components/dofus-quests/rush/RushSeparatorBanner";

/**
 * RushSeparatorBanner — le bandeau d'un bloc SÉPARATEUR, partagé dashboard membre
 * ↔ guide public ↔ overlay PiP.
 *
 * Ce test verrouille le COMPORTEMENT du bandeau, pas son habillage :
 *   · le bandeau est NU (ni cadre, ni aplat) et l'eyebrow « Étape charnière » a disparu ;
 *   · le texte est centré sur TOUTE la largeur : l'image ne le décale jamais
 *     (elle est posée HORS FLUX, en absolu, à droite) ;
 *   · l'image du bloc (upload GOD) est rendue quand elle est posée, nue et jamais rognée ;
 *   · une URL non sûre ne produit AUCUN `<img>` — on ne pose pas un trou ;
 *   · le titre, la description et le filet d'accent sont portés par le rendu.
 */
const html = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    React.createElement(RushSeparatorBanner, { title: "Départ Incarnam", ...props } as never)
  );

/** La balise `<img>` du rendu (le bandeau n'en pose qu'une, ou aucune). */
const imgTag = (out: string) => (out.includes("<img") ? out.slice(out.indexOf("<img")) : "");

describe("RushSeparatorBanner — bandeau de séparateur (3 surfaces)", () => {
  it("porte le titre et le filet d'accent du bloc — plus aucune eyebrow", () => {
    const out = html({ accentColor: "#e11d48" });
    expect(out).toContain("Départ Incarnam");
    // Retour user : « supprime étape charnière » — la mention ne revient pas.
    expect(out).not.toContain("Étape charnière");
    // Filet d'accent (à gauche) : la couleur réglée côté GOD.
    expect(out).toContain("background-color:#e11d48");
    // Aucune image posée ⇒ aucun <img> (donc aucun cadre vide).
    expect(out).not.toContain("<img");
  });

  it("sans accent explicite, retombe sur l'or du registre", () => {
    expect(html({})).toContain("background-color:#e6b96b");
  });

  it("bandeau NU : ni contour, ni fond, ni rayon", () => {
    const out = html({});
    expect(out).not.toContain("border-border");
    expect(out).not.toContain("bg-surface");
    expect(out).not.toContain("rounded-[6px]");
  });

  it("centre le texte sur toute la largeur du bandeau", () => {
    const out = html({ description: "Le commencement du rush", imageUrl: "/uploads/guides/incarnam.webp" });
    expect(out).toContain("text-center");
    expect(out).toContain("items-center");
    // Le texte reste centré même quand une image est posée : elle est HORS flux.
    expect(imgTag(out)).toContain("absolute");
    expect(imgTag(out)).toContain("pointer-events-none");
  });

  it("loge l'image du bloc à droite, nue, adaptée et fondue dans le bandeau", () => {
    const out = html({ imageUrl: "/uploads/guides/section-incarnam.webp" });
    expect(out).toContain('src="/uploads/guides/section-incarnam.webp"');
    // L'image s'adapte : hauteur du bandeau, largeur déduite de son ratio — jamais rognée
    // (`object-contain` + `w-auto`, et surtout PAS `object-cover`).
    expect(imgTag(out)).toContain("object-contain");
    expect(out).not.toContain("object-cover");
    expect(imgTag(out)).toContain("mask-image");
    // …et jamais de tuile : l'image est servie nue.
    expect(out).not.toContain("rounded-lg border");
  });

  it("n'affiche aucune image pour une URL non sûre (fail-closed)", () => {
    expect(html({ imageUrl: "javascript:alert(1)" })).not.toContain("<img");
    expect(html({ imageUrl: "  " })).not.toContain("<img");
  });

  it("ajoute la description quand elle existe, et rien sinon", () => {
    expect(html({ description: "Le commencement du rush" })).toContain("Le commencement du rush");
    expect(html({ description: "" })).not.toContain("<p");
  });
});
