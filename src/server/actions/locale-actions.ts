"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, type Locale, isSupportedLocale, DEFAULT_LOCALE } from "@/lib/i18n/types";

/**
 * Change la langue active et persiste le choix dans un cookie HTTP
 * Durée : 1 an, accessible cross-pages sans modifier l'URL.
 */
export async function setLocaleAction(locale: string) {
    const targetLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
    const cookieStore = await cookies();

    cookieStore.set(LOCALE_COOKIE_NAME, targetLocale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 an
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
    });

    return { success: true, locale: targetLocale };
}
