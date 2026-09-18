import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, type Locale, isSupportedLocale } from "./types";
import { fr, type Translations } from "./locales/fr";
import { en } from "./locales/en";

const dictionaries: Record<Locale, Translations> = {
    fr,
    en,
};

/**
 * Résout la locale active côté serveur :
 * 1. Cookie explicite `sigilos_locale`
 * 2. Header `accept-language` (détection automatique pour les nouveaux visiteurs)
 * 3. Fallback sur `fr`
 */
export async function getServerLocale(): Promise<Locale> {
    try {
        const headersList = await headers();
        const headerLocale = headersList.get("x-sigilos-locale");
        if (isSupportedLocale(headerLocale)) {
            return headerLocale;
        }

        const cookieStore = await cookies();
        const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
        if (isSupportedLocale(cookieLocale)) {
            return cookieLocale;
        }

        const acceptLanguage = headersList.get("accept-language");
        if (acceptLanguage && acceptLanguage.toLowerCase().startsWith("en")) {
            return "en";
        }
        // Détection additionnelle si x-sigilos-locale n'a pas été posé (ex: fetch direct ou middleware contourné)
        const urlStr = headersList.get("x-url") || headersList.get("referer") || "";
        if (urlStr) {
            try {
                const parsed = new URL(urlStr, "http://localhost");
                const qLang = parsed.searchParams.get("lang");
                if (isSupportedLocale(qLang)) {
                    return qLang;
                }
            } catch {}
        }
    } catch {
        // En cas d'appel hors contexte de requête (ex: build/prerender)
    }

    return DEFAULT_LOCALE;
}

/**
 * Récupère le dictionnaire de traduction pour le composant serveur actif
 */
export async function getServerI18n(explicitLocale?: Locale): Promise<{
    locale: Locale;
    t: Translations;
}> {
    const locale = explicitLocale && isSupportedLocale(explicitLocale) ? explicitLocale : await getServerLocale();
    return {
        locale,
        t: dictionaries[locale] || dictionaries[DEFAULT_LOCALE],
    };
}
