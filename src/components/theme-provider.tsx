"use client";

import * as React from "react";
import {
    ThemeProvider as NextThemesProvider,
    useTheme as useNextThemesTheme,
} from "next-themes";

/**
 * #16/#5 V2 — Provider de thème réel (next-themes) — Phase 0 GROK.
 *
 * - `attribute="class"` → la classe `dark`/`light` est posée sur `<html>`.
 * - `defaultTheme="dark"` → nouveau visiteur = sombre par défaut (pas de flash clair).
 * - `enableSystem` + `enableColorScheme` → option « Système » + color-scheme auto.
 * - `disableTransitionOnChange` → switch sec (pas de fondu).
 * - `forcedTheme="dark"` (kill-switch God) → thème VERROUILLÉ en sombre pour tout le
 *   monde (fail-closed) ; `setTheme` devient no-op et les toggles sont désactivés.
 * - `nonce` → respecte la CSP nonce-based (Security Headers).
 * - `storageKey="sigilos-theme"` → clé localStorage de la préférence utilisateur.
 */
interface ThemeProviderProps {
    children: React.ReactNode;
    /** Kill-switch God : quand renseigné ("dark"), le thème est forcé (aucun toggle). */
    forcedTheme?: string;
    /** Nonce CSP pour le script anti-FOUC injecté par next-themes. */
    nonce?: string;
}

export function ThemeProvider({ children, forcedTheme, nonce }: ThemeProviderProps) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            enableColorScheme
            disableTransitionOnChange
            themes={["light", "dark", "system"]}
            forcedTheme={forcedTheme}
            nonce={nonce}
            storageKey="sigilos-theme"
        >
            {children}
        </NextThemesProvider>
    );
}

/**
 * Hook identique à l'API next-themes (compatibilité avec l'ancien stub).
 * Retourne : { themes, forcedTheme, setTheme, theme, resolvedTheme, systemTheme }.
 */
export function useTheme() {
    return useNextThemesTheme();
}

// Type ré-exporté pour les consommateurs du contexte.
export type ThemeContextValue = ReturnType<typeof useTheme>;

