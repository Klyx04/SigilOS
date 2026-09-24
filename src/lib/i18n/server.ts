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
 * 1. Header `x-sigilos-locale` (posé par le proxy depuis `?lang=`) ;
 * 2. Cookie explicite `sigilos_locale` (posé par le sélecteur de langue `LanguageToggle`) ;
 * 3. Repli historique `?lang=` présent dans l'URL/le referer (appel direct au serveur) ;
 * 4. `fr` par défaut.
 *
 * ⚠️ DÉCISION MESURÉE (25/09/2026) — la détection par `accept-language` a été RETIRÉE.
 * Googlebot se présente très souvent en `en-US` : il recevait donc la version **anglaise** d'une page
 * dont le `canonical` désigne l'**URL FR** (il n'existe qu'une seule adresse par page — pas de chemin
 * `/en/...`). Autrement dit, le contenu servi ne correspondait pas à l'URL déclarée, avec un titre et
 * un extrait possiblement en anglais pour une audience française.
 * Relevé Search Console du 25/09/2026 : **aucune requête anglophone** ⇒ on assume le FR par défaut,
 * proprement :
 *   • la langue vient d'un choix **explicite** (sélecteur de langue → cookie), jamais de l'en-tête du visiteur ;
 *   • `?lang=en` continue de fonctionner (le proxy pose `x-sigilos-locale`) ;
 *   • le sélecteur `LanguageToggle` reste affiché sur toutes les pages publiques (`public-header.tsx`),
 *     donc l'anglais reste accessible en un clic ;
 *   • un vrai site bilingue exigerait de vrais chemins `/en/...` + `hreflang` : chantier à part,
 *     **non rentable aujourd'hui** (cf. `docs/ROADMAP.md`).
 * ❌ Ne JAMAIS servir une langue différente à un robot (cloaking) — c'est précisément pour l'éviter
 * qu'on supprime la détection automatique au lieu de la filtrer.
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

        // Choix explicite porté par l'URL (`?lang=en`) quand le header du proxy n'est pas posé
        // (ex. fetch direct, contexte contourné).
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
