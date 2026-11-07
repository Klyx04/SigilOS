# SigilOS — les largeurs et les pièges mesurés

## Les quatre largeurs de contrôle (règle du dépôt)
**390 / 768 / 1 024 / 1 440**. Ajouter **320 px** pour le reflow (WCAG 1.4.10). Toute livraison UI
cite les largeurs réellement contrôlées — sinon ce n'est pas une vérification.

## Ce qui existe déjà et qu'il ne faut pas réinventer
- `w-[min(…,calc(100vw-2rem))]` pour une surface flottante (`docs/RULES.md` § UI).
- `calc(100dvh - 6rem)` pour le rail du guide (`.da-guide-aside`) : `dvh`, jamais `vh`.
- `scrollbar-gutter: stable` **localisé** (`html:has(.boss-detail-shell)`) : la version globale
  avait provoqué un double rail — ne pas la remonter sur `html`.
- `data-quality="low"` coupe grain et filtres (overlay) ; `high` les autorise (guide plein écran).
- La coque du guide est une grille `260 | 720–760 | 300` au-delà de 1 440 px, qui se replie ensuite.

## Pièges déjà payés (ne pas les rejouer)
1. **`overflow-hidden` + `overflow-y-auto` imbriqués** annulent `position: sticky` — un seul
   scrolleur, `<main data-scroll-container>`.
2. **Une barre collante de 337 px** sur un viewport de 712 px recouvrait le rail : mesurer la
   hauteur avant de rendre une barre collante.
3. **`100vh`** sur mobile : la barre d'URL change la hauteur visible → `dvh` (visible) / `svh`
   (jamais coupé).
4. **Texte tronqué** : `truncate` sans `min-w-0` sur un enfant flex.
5. **Colonnes écrasées** dans une grille d'objets : `minmax(15rem,1fr)`, jamais `1fr` seul.
6. **`filter` sur une liste de cartes** : une rastérisation par carte au défilement — interdit
   sans mesure.
7. **Deux contrôles pour la même donnée** (deux barres de progression, deux champs de recherche) :
   un seul état, un seul endroit (déjà corrigé deux fois dans le module Rush).

## DA et tokens
Le module Rush suit `.cline/skills/sigilos-da-wakfu/` : tokens `--da-*` uniquement, rayons ≤ 12 px
(sauf les deux signatures mesurées), aucune couleur en dur. Le responsive ne justifie **jamais**
une couleur ou un rayon improvisé.

## Composants maison à réutiliser
`GameIcon`, `MarketItemIcon`, `RushSeparateBanner`… : ils portent déjà leur repli d'erreur et leur
dimensionnement. Une image Dofus ne se réinvente pas avec une balise nue.
