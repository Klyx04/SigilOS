---
name: responsive
description: Responsive design moderne et vérifiable (CSS 2026) pour SigilOS — Next 16, React 19, Tailwind v4 CSS-first. À déclencher dès qu'on crée ou modifie une UI, un layout, une page, un composant, une classe Tailwind ou du CSS, et pour tout bug d'affichage mobile/tablette/desktop. Porte la règle « aucune largeur fixe qui déborde », les quatre largeurs de contrôle du dépôt (390 / 768 / 1 024 / 1 440) et la vérification obligatoire avant de conclure. Ne pas l'utiliser pour la logique métier, les server actions ni les migrations.
---

# Responsive — règles et vérification

## Mission
Un écran doit être **lisible et utilisable de 320 px à 1 920 px**, sans scroll horizontal, sans
contrôle hors d'atteinte, sans texte tronqué. Le responsive n'est pas une couche finale : il se
décide **dans la structure** (layout intrinsèque) et se **vérifie** avant de livrer.

## Sources (ne rien réinventer)
- MDN — *Responsive web design* (mobile-first, breakpoints, `<meta viewport>`, images/typo fluides).
- web.dev — *The large, small, and dynamic viewport units* (`svh` / `lvh` / `dvh`, Baseline :
  Chrome 108, Safari 15.4, Firefox 101 ; `100vw` ignore les scrollbars ; le clavier virtuel
  n'affecte pas les unités de viewport).
- `GoogleChrome/modern-web-guidance` — mêmes principes, **prouvés par évaluations** : une règle
  qui n'est pas vérifiable n'est pas une règle, c'est une intention.
- Dépôt : `docs/RULES.md` § UI (4 largeurs de contrôle, `w-[min(…)]`), `references/sigilos.md`.

## Les 8 règles non négociables

1. **Mobile-first** : styles de base = petit écran, puis `min-width` (Tailwind : `sm:` `md:` `lg:`).
   Jamais de `max-width` en cascade descendante.
2. **Aucune largeur fixe de conteneur.** `w-[420px]` est interdit ; on écrit
   `w-full max-w-[420px]` ou `w-[min(420px,calc(100vw-2rem))]`.
3. **Layout intrinsèque d'abord** : `grid-template-columns: repeat(auto-fit,minmax(Xrem,1fr))`,
   `flex-wrap`, `gap`. Un breakpoint ne sert que quand le **contenu** casse, pas pour « faire joli ».
4. **Typographie fluide** : `clamp(min, rem + vw, max)`, jamais `vw` seul sur `font-size`, et
   **ratio max/min ≤ 2,5** (WCAG 1.4.4, zoom 200 %).
5. **Hauteur d'écran** : `100vh` interdit pour un plein écran mobile → `100svh` (contenu jamais
   coupé) ou `100dvh` (reflow accepté). Le dépôt utilise déjà `calc(100dvh - 6rem)`.
6. **Aucun scroll horizontal à 320 px** (WCAG 1.4.10 Reflow) : `overflow-x` n'est jamais la
   solution, c'est le symptôme.
7. **Cibles tactiles ≥ 44 × 44 px**, et jamais `hover` comme seule affordance
   (`@media (hover: hover)` / Tailwind `hover:` doublé d'un `focus-visible:`).
8. **Média stable** : `max-width:100%; height:auto` + `aspect-ratio` (CLS), `loading="lazy"`
   hors zone visible.

## Composants : container queries d'abord
Un composant réutilisable ne connaît pas son contexte. On interroge **son conteneur**, pas la
fenêtre : `container-type: inline-size` sur le parent, puis `@container (width >= 25rem)`. Tailwind
v4 : `@container` + `@md:`. Les unités internes suivent `cqi`. Voir `references/tailwind-v4.md`.

## Unités
`rem` pour texte, espacements et breakpoints · `ch` pour la largeur de lecture (`max-width: 65ch`) ·
`px` **uniquement** pour bordures et ombres · `%`/`fr` pour les largeurs de layout.

## Interdits (mesurés comme causes de bugs)
`min-width` fixe sur un enfant de flex (il refuse de rétrécir) → `min-w-0` sur l'enfant ·
`truncate` sans `min-w-0` (le texte pousse la ligne) · `overflow-hidden` sur un parent d'élément
collant (il annule `sticky`) · `w-screen` (déborde à cause des scrollbars) · `100vh` en modale
mobile · deux boîtes de défilement imbriquées · `filter` sur une liste de cartes (perf au scroll).

## Vérification obligatoire avant de conclure
1. **Quatre largeurs du dépôt** : **390 / 768 / 1 024 / 1 440** — plus 320 px pour le reflow.
2. Zoom navigateur **200 %** : rien ne se chevauche, rien n'est coupé.
3. Aucun scroll horizontal : `document.documentElement.scrollWidth <= clientWidth`.
4. Chaque contrôle reste atteignable au clavier, focus visible.
5. Annoncer dans le rapport **ce qui a été vérifié et à quelles largeurs** — une affirmation sans
   largeur citée ne vaut pas une vérification.

## Ce que ce skill ne fait pas
Il ne change ni la logique métier, ni les libellés, ni les server actions. Une refonte visuelle ne
déplace aucun bouton sans demande explicite (`docs/RULES.md` § UI, « habillage seul »).
