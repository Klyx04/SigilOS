import type { CSSProperties } from "react";

/**
 * Portée de la DA « Gouache Wakfu » — **une seule règle** pour les surfaces
 * sorties de l'arbre React.
 *
 * Mesure du 05/11/2026 : Radix porte ses `DialogContent` dans `document.body`,
 * **hors** de la coque `data-da` ; le panneau d'alignement, la fiche de quête et
 * les trois modales de la timeline retombaient donc sur les jetons produit
 * (153 occurrences). Recopier `data-da`/`data-theme`/`data-block`/`style` dans
 * douze composants serait douze occasions de diverger — et l'accent libre du God
 * (`data-block="custom"`) s'oublie vite, ce qui repeint un bloc Ébène en
 * Émeraude sans que rien ne le signale.
 *
 * Deux garanties que la règle porte, et que les composants n'ont plus à tenir :
 *   1. **hors fournisseur ⇒ aucune portée** (`{}`) : une modale partagée par un
 *      écran non migré (Mon Ocre est monté aussi par `DofusQuestBanner`) n'est
 *      pas repeinte par accident. C'est la règle « un écran non migré ne change
 *      pas de couleur » de `da-wakfu.css` §Règles ;
 *   2. **accent validé HEX strict**, et **seulement** pour un bloc `custom` : un
 *      bloc nommé garde son accent calculé (même doctrine que
 *      `resolveRushDaTheme`, qui fait passer le bloc nommé avant `accentColor`).
 */
export type DaScopeTheme = "light" | "dark";
export type DaScopeBlock = "emeraude" | "cauchemar" | "ocre" | "custom";

export interface DaScopeValue {
  theme: DaScopeTheme;
  block: DaScopeBlock;
  /** Accent libre du God — lu uniquement pour `block === "custom"`. */
  accent?: string | null;
}

/** Attributs exacts attendus par `[data-da="wakfu"]` et par la passerelle. */
export interface DaScopeProps {
  "data-da"?: "wakfu";
  "data-theme"?: DaScopeTheme;
  "data-block"?: DaScopeBlock;
  style?: CSSProperties;
}

/** HEX à six chiffres : jamais une valeur injectable en CSS. */
const HEX = /^#[0-9a-f]{6}$/i;

export function daScopeProps(value: DaScopeValue | null | undefined): DaScopeProps {
  if (!value) return {};

  const props: DaScopeProps = {
    "data-da": "wakfu",
    "data-theme": value.theme === "light" ? "light" : "dark",
    "data-block": value.block,
  };

  if (
    value.block === "custom" &&
    typeof value.accent === "string" &&
    HEX.test(value.accent)
  ) {
    props.style = { "--da-acc": value.accent } as CSSProperties;
  }

  return props;
}
