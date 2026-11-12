/**
 * Garde — **une seule quête, deux textes** (lot 4, 12/11/2026).
 *
 * 🎯 Décision user : « Une quête avec deux textes (je fais la modification de la base) ».
 * Avant, la seule façon d'avoir un texte bontarien et un texte brakmarien était de créer
 * **deux quêtes** (bouton « Jumelle ») : deux lignes à cocher, progression comptée deux fois.
 *
 * 🛡️ La colonne `routeVariants` porte `{ bontarien?: { name?, tips? }, brakmarien?: {…} }`.
 * La résolution se fait dans `resolveRushRoute` — le point par lequel passent le guide
 * membre, le guide public **et** l'overlay : une seule règle, trois surfaces.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  applyRouteVariant,
  parseRouteVariants,
  pickRouteVariant,
  resolveRushRoute,
} from "@/lib/rush-route";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

const seq = (id: string, over: Partial<RushSequence> = {}): RushSequence =>
  ({
    id,
    subGuideRef: id,
    subGuideName: `Nom ${id}`,
    isOptional: false,
    order: 0,
    ...over,
  }) as RushSequence;

const ms = (sequences: RushSequence[]): RushMilestone =>
  ({
    id: "b",
    type: "QUETE_SERIE",
    chapter: 1,
    chapterLabel: "C1",
    title: "Bloc",
    order: 0,
    isOptional: false,
    sequences,
  }) as RushMilestone;

const VARIANTS = {
  bontarien: { name: "Ralliement", tips: "Conseil bontarien" },
  brakmarien: { name: "Enrôlement", tips: "Conseil brakmarien" },
};

describe("parseRouteVariants — forme bornée", () => {
  it("accepte deux camps × deux champs", () => {
    expect(parseRouteVariants(VARIANTS)).toEqual(VARIANTS);
  });

  it("refuse une forme invalide (fail-closed)", () => {
    expect(parseRouteVariants("nope")).toBeNull();
    expect(parseRouteVariants({ bontarien: { name: 42 } })).toBeNull();
    expect(parseRouteVariants({ bontarien: { name: "x".repeat(201) } })).toBeNull();
  });

  it("ignore une clé inconnue", () => {
    expect(parseRouteVariants({ pirate: { name: "x" } })).toEqual({});
  });
});

describe("pickRouteVariant — la variante du camp, jamais une autre", () => {
  it("rend la variante du camp", () => {
    expect(pickRouteVariant(VARIANTS, "bontarien")).toEqual(VARIANTS.bontarien);
    expect(pickRouteVariant(VARIANTS, "Brakmarien")).toEqual(VARIANTS.brakmarien);
  });

  it("camp inconnu ou absent ⇒ null", () => {
    expect(pickRouteVariant(VARIANTS, null)).toBeNull();
    expect(pickRouteVariant(VARIANTS, "pirate")).toBeNull();
  });

  it("variante vide ⇒ null (le texte de base reste)", () => {
    expect(pickRouteVariant({ bontarien: { name: "  ", tips: " " } }, "bontarien")).toBeNull();
    expect(pickRouteVariant({ bontarien: {} }, "bontarien")).toBeNull();
  });

  it("taille les champs", () => {
    expect(pickRouteVariant({ bontarien: { name: "  Ralliement  " } }, "bontarien")).toEqual({
      name: "Ralliement",
    });
  });
});

describe("applyRouteVariant / resolveRushRoute — le bon texte dans les trois surfaces", () => {
  it("remplace le nom et les conseils selon le camp", () => {
    const s = seq("q", { routeVariants: VARIANTS });
    expect(applyRouteVariant(s, "bontarien").subGuideName).toBe("Ralliement");
    expect(applyRouteVariant(s, "bontarien").tips).toBe("Conseil bontarien");
    expect(applyRouteVariant(s, "brakmarien").subGuideName).toBe("Enrôlement");
  });

  it("sans variante, la séquence est rendue TELLE QUELLE", () => {
    const s = seq("q");
    expect(applyRouteVariant(s, "bontarien")).toBe(s);
  });

  it("un champ vide ne remplace pas le texte de base", () => {
    const s = seq("q", { tips: "Conseil commun", routeVariants: { bontarien: { name: "Ralliement" } } });
    const out = applyRouteVariant(s, "bontarien");
    expect(out.subGuideName).toBe("Ralliement");
    expect(out.tips).toBe("Conseil commun");
  });

  it("la route applique la variante du camp joueur", () => {
    const guide = [ms([seq("q", { routeVariants: VARIANTS })])];
    expect(resolveRushRoute(guide, { camp: "bontarien" })[0].sequences[0].subGuideName).toBe("Ralliement");
    expect(resolveRushRoute(guide, { camp: "brakmarien" })[0].sequences[0].subGuideName).toBe("Enrôlement");
  });

  it("sans camp (visiteur anonyme), le texte de base s'affiche", () => {
    const guide = [ms([seq("q", { routeVariants: VARIANTS })])];
    expect(resolveRushRoute(guide, null)[0].sequences[0].subGuideName).toBe("Nom q");
  });
});

describe("câblage — une seule quête, deux textes", () => {
  const codeOf = (path: string) =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  it("la colonne existe en base (migration additive)", () => {
    expect(codeOf("prisma/schema.prisma")).toMatch(/routeVariants\s+Json\?/);
  });

  it("le studio édite les deux camps et envoie `routeVariants`", () => {
    const studio = codeOf("src/components/god/rush-editor/RushEditorStudio.tsx");
    expect(studio).toContain("Texte par camp");
    expect(studio).toContain("routeVariants: hasVariants ? nextVariants : null");
  });

  it("le serveur borne et écrit la colonne, sans la toucher si absente", () => {
    const actions = codeOf("src/server/actions/optimized-guide-actions.ts");
    expect(actions).toContain("parseRouteVariants(data.routeVariants)");
    expect(actions).toContain(
      "...(routeVariants !== undefined ? { routeVariants: routeVariants as never } : {})"
    );
  });
});
