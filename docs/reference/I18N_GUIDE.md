# 🌐 Guide d'implémentation de l'i18n dans SigilOS

Ce document synthétise l'architecture d'internationalisation de SigilOS et fournit un patron de conception prêt à l'emploi pour traduire les modules internes et les futures fonctionnalités.

---

## 1. Architecture & Fichiers Clés

```
src/
├── lib/
│   └── i18n/
│       ├── types.ts          # Définition des types (Locale = "fr" | "en")
│       ├── client.tsx        # Provider React & hook `useI18n()`
│       ├── server.ts         # Récupération de la locale côté SSR / Server Actions (`getLocale()`, `getTranslations()`)
│       └── locales/
│           ├── fr.ts         # Dictionnaire français (langue source et de référence)
│           └── en.ts         # Dictionnaire anglais
├── server/
│   └── actions/
│       └── locale-actions.ts # Mutation du cookie de langue
└── components/
    └── layout/
        └── LanguageToggle.tsx # Sélecteur UI de langue
```

---

## 2. Comment ajouter une nouvelle clé de traduction

### Étape 1 : Ajouter dans `fr.ts`
Ouvrir `src/lib/i18n/locales/fr.ts` et ajouter votre section ou sous-clé dans l'objet `fr` :
```typescript
export const fr = {
    // ...
    monModule: {
        title: "Titre de mon module",
        searchPlaceholder: "Rechercher...",
        actionButton: "Confirmer",
        countItems: "{count} éléments trouvés",
    },
};
```

### Étape 2 : Ajouter la correspondance dans `en.ts`
Ouvrir `src/lib/i18n/locales/en.ts` et ajouter la traduction stricte équivalente :
```typescript
export const en: Translations = {
    // ...
    monModule: {
        title: "My Module Title",
        searchPlaceholder: "Search...",
        actionButton: "Confirm",
        countItems: "{count} items found",
    },
};
```
*(TypeScript validera automatiquement que toutes les clés présentes dans `fr.ts` existent dans `en.ts` via le type `Translations`).*

---

## 3. Utilisation côté Client Component (`"use client"`)

Dans n'importe quel composant React client :

```tsx
"use client";

import { useI18n } from "@/lib/i18n/client";

export function MonComposant() {
    const { t, locale } = useI18n();

    return (
        <div>
            <h2>{t.monModule.title}</h2>
            <p>{t.monModule.countItems.replace("{count}", "5")}</p>
            {locale === "en" ? <span>EN Active</span> : <span>FR Actif</span>}
        </div>
    );
}
```

---

## 4. Utilisation côté Server Component (SSR / Server Actions)

Dans un Server Component (ex: `page.tsx`) :

```tsx
import { getTranslations, getLocale } from "@/lib/i18n/server";

export default async function MonModulePage() {
    const locale = await getLocale();
    const t = await getTranslations();

    return (
        <div>
            <h1>{t.monModule.title}</h1>
        </div>
    );
}
```

---

## 5. Données de jeu bilingues (DofusDB & Dofensive)

Pour les entités de jeu (sorts, monstres, donjons, drops) :
- Toujours privilégier `nameEn` quand il existe :
  ```tsx
  const displayName = locale === "en" ? (entity.nameEn || entity.name) : entity.name;
  ```
- Les Server Actions qui siphonnent DofusDB acceptent le paramètre `locale: "fr" | "en"` pour requêter avec `&lang=en` ou enrichir les loots à la volée.
- Ne jamais coder en dur de traductions de noms officiels Ankama si l'API ou le modèle fournit `nameEn`.
