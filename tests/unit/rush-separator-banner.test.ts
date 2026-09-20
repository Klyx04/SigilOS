import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RushSeparatorBanner } from "@/components/dofus-quests/rush/RushSeparatorBanner";

/**
 * RushSeparatorBanner — le bandeau d'un bloc SÉPARATEUR, partagé dashboard membre
 * ↔ guide public.
 *
 * Ce test verrouille le COMPORTEMENT du bandeau, pas son habillage :
 *   · l'image du bloc (upload GOD) est rendue quand elle est posée ;
 *   · une URL non sûre ne produit AUCUN `<img>` — on ne pose pas un trou ;
 *   · le titre, la description et le filet d'accent sont portés par le rendu ;
 *   · sans description, aucune ligne n'est ajoutée.
 */
const html = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    React.createElement(RushSeparatorBanner, { title: "Départ Incarnam", ...props } as never)
  );

describe("RushSeparatorBanner — bandeau de séparateur (2 surfaces)", () => {
  it("porte le titre, l'eyebrow et le filet d'accent du bloc", () => {
    const out = html({ accentColor: "#e11d48" });
    expect(out).toContain("Départ Incarnam");
    expect(out).toContain("Étape charnière");
    // Filet d'accent (à gauche) + eyebrow : la MÊME couleur, celle réglée côté GOD.
    expect(out).toContain("background-color:#e11d48");
    expect(out).toContain("color:#e11d48");
    // Aucune image posée ⇒ aucun <img> (donc aucun cadre vide).
    expect(out).not.toContain("<img");
  });

  it("sans accent explicite, retombe sur l'or du registre", () => {
    expect(html({})).toContain("background-color:#e6b96b");
  });

  it("loge l'image du bloc à droite, nue, adaptée et fondue dans le bandeau", () => {
    const out = html({ imageUrl: "/uploads/guides/section-incarnam.webp" });
    expect(out).toContain('src="/uploads/guides/section-incarnam.webp"');
    // L'image s'adapte : hauteur du bandeau, largeur déduite de son ratio — jamais rognée
    // (`object-contain` + `w-auto`, et surtout PAS `object-cover`).
    expect(out).toContain("object-contain");
    expect(out).not.toContain("object-cover");
    expect(out).toContain("mask-image");
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
