"use client";

import React, { createContext, useContext } from "react";

/**
 * Thème de la DA « Gouache Wakfu » — **une seule source**.
 *
 * Certains composants vivent HORS de l'arbre CSS de la fenêtre : `createPortal`
 * (popover de donjon, prérequis) monte son nœud dans `ownerDocument.body`, donc
 * ni `data-da` ni `data-theme` ne l'atteignent. Ils ne peuvent pas non plus lire
 * le CSS : il leur faut la valeur, pas le style.
 *
 * Ce contexte remplace le prop-drilling du thème (43 occurrences dans 15
 * composants) : le thème est posé une fois sur la racine (`data-theme`), exposé
 * ici, et un portail le réapplique sur son propre nœud. Aucun composant ne reçoit
 * plus le thème en prop — `data-theme` reste la vérité pour tout le reste.
 */
export type DaTheme = "light" | "dark";
export type DaBlock = "emeraude" | "cauchemar" | "ocre" | "custom";

type DaThemeValue = { theme: DaTheme; block: DaBlock };

/** Hors overlay : sombre + Émeraude (le défaut de la DA). */
const DaThemeContext = createContext<DaThemeValue>({ theme: "dark", block: "emeraude" });

export function DaThemeProvider({
  value,
  children,
}: {
  value: DaThemeValue;
  children: React.ReactNode;
}) {
  return <DaThemeContext.Provider value={value}>{children}</DaThemeContext.Provider>;
}

/** Thème et bloc courants, pour les surfaces sorties de l'arbre (portails). */
export function useDaTheme(): DaThemeValue {
  return useContext(DaThemeContext);
}
