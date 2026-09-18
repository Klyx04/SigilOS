"use client";

import React, { createContext, useContext, useTransition } from "react";
import { type Locale } from "./types";
import { type Translations, fr } from "./locales/fr";
import { en } from "./locales/en";
import { setLocaleAction } from "@/server/actions/locale-actions";
import { useRouter } from "next/navigation";

const dictionaries: Record<Locale, Translations> = { fr, en };

interface I18nContextValue {
    locale: Locale;
    t: Translations;
    setLocale: (newLocale: Locale) => Promise<void>;
    isPending: boolean;
}

const I18nContext = createContext<I18nContextValue>({
    locale: "fr",
    t: fr,
    setLocale: async () => {},
    isPending: false,
});

export function I18nProvider({
    initialLocale,
    children,
}: {
    initialLocale: Locale;
    children: React.ReactNode;
}) {
    const [locale, setLocalLocale] = React.useState<Locale>(initialLocale);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const setLocale = async (newLocale: Locale) => {
        if (newLocale === locale) return;
        setLocalLocale(newLocale);
        startTransition(async () => {
            await setLocaleAction(newLocale);
            router.refresh();
        });
    };

    const value: I18nContextValue = {
        locale,
        t: dictionaries[locale] || dictionaries.fr,
        setLocale,
        isPending,
    };

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
    return useContext(I18nContext);
}
