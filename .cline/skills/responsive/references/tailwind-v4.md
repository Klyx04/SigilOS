# Tailwind v4 — ce qui change pour le responsive

Le dépôt n'a **pas** de `tailwind.config.js` : la configuration est **CSS-first**, dans
`src/app/globals.css` (`@import "tailwindcss"` + `@theme inline`). Ne pas créer de config JS.

## Variantes = `min-width` (mobile-first)
`sm:` `md:` `lg:` `xl:` `2xl:` sont des `min-width`. Écrire le style de base pour le plus petit
écran, puis **enrichir**. Un `max-md:` ne se justifie que pour **désactiver** quelque chose de
coûteux, jamais pour construire une mise en page descendante.

## Breakpoints par défaut de Tailwind v4
`sm` 40rem (640 px) · `md` 48rem (768 px) · `lg` 64rem (1024 px) · `xl` 80rem (1280 px) ·
`2xl` 96rem (1536 px). Le dépôt n'en a pas défini d'autres : si un besoin réel apparaît, l'ajouter
dans `@theme` (`--breakpoint-*`), pas en dur dans une classe arbitraire.

## Échelle de texte du dépôt — utiliser les TOKENS
`@theme inline` définit `text-display-xl` / `text-display-lg` / `text-title` / `text-body` /
`text-body-sm` / `text-label` / `text-caption` (base 8 pt, ratio 1,25, valeurs en px assumées).
On écrit `text-title`, **pas** `text-[18px]`. Une taille ad hoc est une dette de design system.

## Container queries (préférées pour un composant réutilisable)
```html
<div class="@container">
  <div class="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3">…</div>
</div>
```
`@container` pose `container-type: inline-size` ; `@md:` interroge **le conteneur**, pas la fenêtre.
C'est la bonne réponse pour une carte, une tuile, un panneau qu'on réutilise à plusieurs largeurs.

## Pièges Tailwind récurrents
| Symptôme | Cause | Correctif |
|---|---|---|
| Le texte ne se tronque pas | `truncate` sans `min-w-0` sur l'enfant flex | ajouter `min-w-0` |
| Un enfant flex refuse de rétrécir | `min-width:auto` par défaut | `min-w-0` / `min-h-0` |
| Débordement horizontal | `w-screen`, largeur fixe, `100vw` | `w-full`, `max-w-*`, `w-[min(…)]` |
| Le parent ne scrolle pas | enfant sans `min-h-0` dans une colonne flex | ajouter `min-h-0` |
| `sticky` inactif | un ancêtre `overflow-hidden` | retirer l'`overflow` de l'ancêtre |
| Modale trop haute sur mobile | `h-screen` / `100vh` | `max-h-[90dvh]` |
