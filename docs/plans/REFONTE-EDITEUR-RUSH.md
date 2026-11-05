# 🛠️ Refonte de l'éditeur God Rush — le studio

> **Rôle unique.** Ce fichier porte l'**audit UX mesuré** et les lots **E1 → E5** de la refonte
> de `src/app/god/rush-sylvestre/RushSylvestreAdminClient.tsx`. L'ordre global reste
> `docs/ROADMAP.md` ; le contenu du module reste `docs/plans/MODULE-RUSH-SYLVESTRE.md`.
> **Dernière MAJ : 05/11/2026.**

## 0. Mesures de départ (05/11/2026)

| Mesure | Valeur |
|---|---|
| Fichier du studio | **5 242 lignes** (le plan de septembre en annonçait 3 421) — **sorti de `src/app/god/**` en E1** |
| Formulaire de quête | **1 552 lignes** |
| Formulaire d'ajout | **451 lignes** |
| Motifs UI interdits (`docs/RULES.md`) | **674 occurrences** sur **385 lignes** (mesure du 05/11 : `font-black`, `tracking-widest`, `zinc-`, `emerald-`, `purple-`, `pink-`, `rounded-3xl`, `backdrop-blur`) — **644 / 376** après E1 |
| Fichiers `src/app/god/**` | **77 / 77** — plafond du verrou `god-deslop` atteint |
| Tests sources qui pointent sur le fichier | **9** : les **7** verrous (`rush-alignment-source`, `rush-god-studio-robustesse`, `rush-prereq-id`, `rush-route-tooling`, `rush-sylvestre-construction`, `rush-tips-block-studio`, `rush-twin-branch`) **+** `rush-move-sequence` et `rush-split-blocks` (livrés le 05/11) |
| Contrôle « Déplacer vers » | **invisible** (un seul bloc passé au formulaire) et **no-op** côté serveur — corrigé le 05/11 par `moveRushSequence` |

## 1. Diagnostic — six causes racines

1. **Le formulaire s'ouvre dans la liste** : il pousse les blocs et fait perdre la position.
2. **Deux formulaires sans langage commun** : 10 onglets de type pour un bloc, 9 accordéons numérotés pour une quête.
3. **La route est éditable à deux endroits** (panneau « Route du bloc » + section 7 de la quête) sans dire qui gagne.
4. **Aucun accès rapide** : 492 quêtes, pas de recherche, pas de filtre, pas de palette de commandes.
5. **Les actions sont déguisées en badges** : `+ Jumelle`, `+ 3 Ordres`, `DB`, `Noobs`, point vert — état, lien et bouton se confondent.
6. **La DA est un patchwork** : couleurs en dur, `font-black`, `italic`, `backdrop-blur`, `rounded-3xl` — contraire à la règle « une seule DA ».

## 2. La cible — un studio en trois panneaux

```
┌──────────────────────────────────────────────────────────────┐
│ Barre unique : guide · état · recherche · aperçu · données  │
├──────────────┬────────────────────────────┬──────────────────┤
│ ARBRE        │ LISTE / CONTENU            │ INSPECTEUR       │
│ chapitres    │ blocs du chapitre          │ quête ou bloc    │
│  blocs       │ quêtes du bloc (virtuelles)│ route, tips,     │
│   quêtes     │ actions de masse           │ prérequis, …     │
│ recherche    │                            │ Enregistrer      │
│ filtres      │                            │ Déplacer / …     │
└──────────────┴────────────────────────────┴──────────────────┘
```

- **L'arbre ne bouge jamais** : on sait toujours où on est.
- **L'inspecteur remplace le formulaire inline** : la liste reste visible.
- **Ctrl+K** : aller à une quête/un bloc, créer, déplacer, dupliquer, supprimer, prévisualiser.
- **Filtres** : cité, Ordre, classe, et « Problèmes » (sans tips, sans `questDbIds`, sans ressources, blocs vides, 15 Bonta).
- **Actions de masse** : sélection multiple → appliquer une route, déplacer, supprimer.
- **État de sauvegarde** : point « non sauvegardé », garde de sortie, brouillon local par quête.
- **Aperçu membre** : la quête rendue comme dans l'overlay, à côté de l'édition.
- **DA** : kit God, tokens, un seul accent, rayons ≤ 12, zéro couleur en dur.

## 3. Lots E1 → E5

| Lot | Contenu | Taille |
|---|---|---|
| **E1 — Squelette** — **livré le 05/11/2026** | Shell 3 panneaux, arbre persistant, recherche/filtres, sélection, barre unique, Ctrl+K, garde de sauvegarde, responsive (arbre en `Sheet` < 1024, inspecteur en `Sheet` < 768). Les formulaires existants sont **montés tels quels** dans l'inspecteur : on ne réécrit rien encore. **Livré dans** `src/components/god/rush-editor/**` (`RushEditorShell`, `RushEditorTopbar`, `RushEditorTree`, `RushEditorInspector`, `RushEditorCommandPalette`, `useRushEditorSelection`) + `src/lib/rush-editor-selection.ts` ; l'app file est un ré-export. | L (1-2 PR) |
| **E2 — Inspecteur quête** | Formulaire en 3 groupes (**Essentiel** : titre, route, tips · **Contenu** : prérequis, donjons, ressources, liens · **Avancé**), sections vides masquées, footer sticky, brouillon local, « Déplacer vers » en tête, jumelles/suppression dans un menu « … », aperçu membre. | L (1-2 PR) |
| **E3 — Bloc, masse, problèmes** | Inspecteur de bloc (titre, type, route, liste), création de bloc inline, sélection multiple, appliquer/déplacer/supprimer en masse, « Scinder en quêtes individuelles », panneau « Problèmes » (15 Bonta, 194 tips, 336 qids, 73 tags, blocs vides). | M |
| **E4 — DA God** | Tokens/kit (`@/app/god/ui` ou kit local `rush-editor/kit`), suppression des **644 occurrences** interdites restantes (**376 lignes**, mesure après E1), verrou `rush-editor-ui` (zéro `zinc-`/`emerald-`/`purple-`, rayons, pas de blur, un accent). ⚠️ Le studio n'est **plus** dans `src/app/god/**` : `REFONTE_FILES` (verrou `god-deslop`) ne le couvre pas — c'est `rush-editor-ui` qui prend le relais, compteur à **0**. | M |
| **E5 — Finitions** | Palette d'actions complète, raccourcis (`Ctrl+S`, `Esc`, `Alt+↑/↓`, `J/K`), virtualisation, responsive 390/768/1024/1440, états vides/chargement/erreur, doc. | M |

**Reste de E1, rattaché aux lots suivants** (à ne pas perdre de vue) :
- **Édition inline du séparateur** encore dans la liste → **E3** (l'inspecteur de bloc doit couvrir les 10 types).
- **Monolithe non découpé** (`SequenceEditForm` 1 552 l., `AddSequenceForm` 451 l., `BlockInspectorForm`, champs) → **E2/E3/E4**, par déplacement pur, jamais par réécriture.
- **Tenu par E1 et à ne pas régresser** : aucun formulaire dans la liste, sélection unique, garde de saisie, `Ctrl+K`, seuils 1024/768, `77/77` fichiers God.

## 4. Contraintes non négociables

1. **Plafond God 77/77** : les nouveaux composants vivent dans `src/components/god/rush-editor/**`, jamais dans `src/app/god/**`. Le fichier actuel reste une **coquille mince** (1 fichier). Aucun fichier God neuf sans retirer un orphelin.
2. **9 tests sources** : mise à jour des chemins, assertions conservées — on n'affaiblit aucun verrou. Une seule garde est adaptée en E1 : le `!isEditing` de `rush-tips-block-studio`, devenu sans objet avec la fin de l'édition inline (le `!isTips`, qui porte l'interdiction, reste intact).
3. **Server actions inchangées** (hors `moveRushSequence`, livré le 05/11) : la refonte réorganise l'UI, pas le métier.
4. **Aucune migration**.
5. **857 tests Rush verts** à chaque PR (base après E1, 05/11).

## 5. Ordre d'exécution

`A` (déplacement réparé, **livré le 05/11**) → `B` (split des blocs bêta, **livré le 05/11**) → `E1` (**livré le 05/11**) → `E2` → `E3` → `E4` → `D` (overlay live) → `E5`.

- `A` avant `B` : le bouton « Déplacer vers » doit marcher avant de scinder.
- `B` avant `E1` : les quêtes deviennent individuelles tout de suite ; E1/E2 rendent ensuite l'édition confortable.

## 6. Décisions à prendre (E2/E3)

1. **Position dans le bloc cible** : ajout en fin + réordonnancement (recommandé), ou choix de la position dans la boîte de déplacement.
2. **Split** : un bloc déjà coché ⇒ toutes ses quêtes cochées après éclatement (recommandé).
3. **Blocs de palier vides** : suppression (recommandé si placement libre) ou conservation en repères INFO.
4. **Overlay live** : lot séparé `D` (recommandé) ou inclus dans `E2` — E1 est livré.

## 7. Définition de fini (par lot)

- `npm run test:run` · `npx tsc --noEmit` · `npm run lint` verts (0 erreur).
- `git status --short` propre ; aucun artefact de session.
- `docs/ROADMAP.md` (statut) + bloc `docs/agents/activeContext.md` ; aucun fichier d'état nouveau.
- Contrôle visuel 390 / 768 / 1024 / 1440 du studio.

