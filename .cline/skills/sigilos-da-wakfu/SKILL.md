---
name: sigilos-da-wakfu
description: Direction artistique « Gouache Wakfu » de SigilOS (peinture gouache, traits fins tremblés, planches de bois usé, thème par bloc de quêtes, clair et sombre). À déclencher pour tout habillage visuel du module Rush Sylvestre puis, par passation, du reste du produit : en-tête, barre de blocs, cartes de quête, boutons, écriteau, fil de sève, guide plein écran. Porte la règle « habillage seul » (aucun déplacement de bouton, aucune logique métier touchée) et le verrou de contraste. Ne pas l'utiliser pour la logique métier, les données, les server actions ni les migrations.
---
# SigilOS — DA « Gouache Wakfu »

## Mission
Une seule grammaire visuelle : une fenêtre de jeu peinte à la gouache. Trait fin,
bord légèrement irrégulier, planches de bois blanc usé, fil de sève, thème qui suit
le bloc de quêtes. **Habillage seul** : on ne déplace pas un bouton, on ne change ni
l'ordre des blocs, ni les libellés, ni la logique.

## Source de vérité (ne rien réinventer)
- `src/app/da-wakfu.css` — tokens, socle et signatures. **Le CSS est la référence.**
- `references/tokens.md` — valeurs, six combinaisons, écarts mesurés.
- `references/composants.md` — spécifications + correspondance avec les fichiers réels.
- `src/components/da/DaWakfuFilters.tsx` — filtres `#da-rough` / `#da-brush`, montés
  une fois par layout.

Si une valeur manque : la demander. **Ne jamais l'inventer.**

## Règles absolues
1. **Préfixe `--da-`** pour tout token. Les noms globaux (`--muted`, `--accent`,
   `--border`) appartiennent déjà au produit, et `--muted` y est une surface alors
   qu'il est un texte dans la maquette.
2. **Aucune couleur en dur** dans un composant : `var(--da-*)` uniquement.
3. **Portée `[data-da="wakfu"]`** posée sur `<html>` **côté serveur**. Les modales
   Radix sortent de l'arbre : un attribut sur un `<div>` les laisserait non thémées.
4. **Thème = `data-block` × `data-theme`** (six combinaisons minimum). Une seule
   structure.
5. **Sémantique fixe** : `--da-ok` = validé (vert, indépendant du bloc) ·
   `--da-acc` = « faire maintenant » · `--da-amber-ink` = exigence · `--da-warn` =
   prérequis non rempli.
6. **Contours 1,5 à 1,8 px.** Irrégularité par `#da-rough` sur un pseudo-élément,
   **jamais** sur du texte (seule exception : les chiffres de l'écriteau).
7. **Grain unique** par surface racine (`.da-grain::after`), jamais par composant.

## Interdits
`backdrop-filter` / glassmorphism · halo ou dégradé lumineux · ombre molle sur une
carte · capsule arrondie répétée · gros encart centré · texture parchemin ou cuir ·
fond marron par défaut · violet · couleurs d'hiver · personnage ou minimap ajouté à
l'interface · illustration derrière le texte d'une quête sans voile de lisibilité ·
`filter` sur une liste de cartes · texte déformé par un filtre.

## Performance (règle mesurée)
La PiP flotte **au-dessus du jeu** : `data-quality="low"` coupe le grain et tous les
filtres sauf l'écriteau. `data-quality="high"` (guide plein écran) autorise `#da-rough`
sur les bords de carte. Un `filter: url()` par carte = une rastérisation par carte au
défilement : interdit sans mesure.

## Migration (ordre imposé)
1. **Rush Sylvestre d'abord** : overlay, guide public, guide membre — à l'identique,
   sans déplacement.
2. **Passation au dashboard** ensuite, écran par écran, via le socle seulement
   (typographie, boutons, chips). Les trois teintes de bloc restent au guide.
3. Chaque lot met à jour `docs/ROADMAP.md` ; le verrou `tests/unit/da-wakfu.test.ts`
   reste vert.

## Vérification avant livraison
`tests/unit/da-wakfu.test.ts` (six combinaisons, contraste AA, rayons, filtres) ·
`npx tsc --noEmit` · `npm run lint` · captures 420 / 500 / 1280 px, clair et sombre.

## Droits
Les images d'ambiance Ankama restent des maquettes privées. En production :
`GuideMilestone.imageUrl` (déjà éditable) ou le dégradé de repli du bloc — aucun
nouvel asset propriétaire, aucune migration.
