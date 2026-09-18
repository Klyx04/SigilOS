/**
 * ============================================================================
 * SIGILOS I18N SYSTEM — TYPES & CONTRACT
 * ============================================================================
 * Support bilingue FR / EN avec typage strict TypeScript.
 * Tout texte ajouté dans `fr.ts` est automatiquement requis dans `en.ts`.
 */

export type Locale = "fr" | "en";

export const DEFAULT_LOCALE: Locale = "fr";
export const SUPPORTED_LOCALES: readonly Locale[] = ["fr", "en"] as const;
export const LOCALE_COOKIE_NAME = "sigilos_locale";

export function isSupportedLocale(value: unknown): value is Locale {
    return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
