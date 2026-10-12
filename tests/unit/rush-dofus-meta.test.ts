import { describe, it, expect } from "vitest";
import { RUSH_DOFUS_META, dofusMetaIndex, getDofusMeta } from "@/lib/rush-dofus-meta";

/**
 * Garde du référentiel Dofus du Rush — il remplace CINQ listes divergentes
 * (studio God `DOFUS_LIST` + quatre `DOFUS_DEFS`, mesuré le 08/10/2026 : la même
 * clé `ebene` y valait #27272a, #52525b ou #6366f1, `argente` #a1a1aa ou
 * #a8c0d6…). Ces cas vérifient la table elle-même, pas un écran.
 */
describe("rush-dofus-meta (source unique des Dofus du rush)", () => {
  it("n'a aucun identifiant en double", () => {
    const ids = RUSH_DOFUS_META.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sert TOUS les visuels en local (aucune URL externe, chantier U)", () => {
    for (const d of RUSH_DOFUS_META) {
      expect(d.imageUrl.startsWith("/")).toBe(true);
      expect(d.imageUrl).not.toMatch(/^https?:\/\//);
      // Les visuels sont des PNG du jeu déjà versionnés dans `public/`.
      expect(d.imageUrl).toMatch(/\.png$/);
    }
  });

  it("porte une couleur hex canonique et un libellé lisible", () => {
    for (const d of RUSH_DOFUS_META) {
      expect(d.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(d.label.trim().length).toBeGreaterThan(1);
    }
  });

  it("expose les identifiants réellement utilisés par les rendus", () => {
    // Ceux que les 5 copies portaient : studio God, guide, rail, panneau, overlay.
    for (const id of [
      "ocre", "turquoise", "argente", "argente_scintillant", "ebene", "pourpre",
      "ivoire", "emeraude", "dolmanax", "des_glaces", "du_cauchemar", "des_veilleurs",
      "domakuro", "dorigami", "tachete", "dom_de_pin", "sylvestre",
      // clés propres à l'overlay (œufs) — dont l'alias historique `cauchemar`
      "cawotte", "dokoko", "vulbis", "abyssal", "cauchemar",
    ]) {
      expect(getDofusMeta(id), `id manquant : ${id}`).not.toBeNull();
    }
  });

  it("résout l'identifiant sans tenir compte de la casse, et rien d'autre", () => {
    expect(getDofusMeta("EBENE")?.label).toBe("Ébène");
    expect(getDofusMeta("  pourpre ")?.color).toBe("#a855f7");
    expect(getDofusMeta("")).toBeNull();
    expect(getDofusMeta(null)).toBeNull();
    expect(getDofusMeta("dofus-qui-n-existe-pas")).toBeNull();
  });

  it("rend le MÊME objet sur toutes les surfaces (fin des copies divergentes)", () => {
    const index = dofusMetaIndex();
    // `ebene` : la divergence mesurée (#27272a / #52525b / #6366f1) est réglée sur
    // une valeur lisible dans les deux thèmes.
    expect(index.ebene.color).toBe("#52525b");
    // `argente` : l'overlay disait #a8c0d6, les autres #a1a1aa.
    expect(index.argente.color).toBe("#a1a1aa");
    // `pourpre` : l'overlay disait #ef4444 — le Pourpre reste violet (couleur
    // canonique ; la moyenne du visuel lit « or », elle ne fait pas foi).
    expect(index.pourpre.color).toBe("#a855f7");
    // `cauchemar` est bien l'alias de `du_cauchemar` (mêmes visuel et couleur — seuls
    // les identifiants diffèrent, l'overlay lisant les deux clés).
    expect(index.cauchemar.imageUrl).toBe(index.du_cauchemar.imageUrl);
    expect(index.cauchemar.color).toBe(index.du_cauchemar.color);
    expect(index.cauchemar.label).toBe(index.du_cauchemar.label);
  });
});
