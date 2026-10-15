---
description: Chantier « Raccord DofusDB » — données de combat manquantes dans les fiches (résistances, tacle/fuite, effets de sorts, critiques) et visuels assombris (icônes de défi), mesurés le 15/10/2026
---

# PLAN — **Raccord avec DofusDB** (données de fiches + visuels)

> **Demande user (verbatim, 15/10/2026)** : « il y a encore pleins de boss monstres ou autres dans
> …/succes (boss, anomalies, avis de recherche, titans, raids, monstres) à qui il manque des infos.
> Par exemple Shin Larve, elle n'a pas ses résistances, pas d'icônes de tacle/fuite etc. Il manque des
> infos encore des sorts (dans 25.0 % des cas etc.). Il y a aussi des assets qui ont des coups critiques
> en dessous en terme de dégâts que les dégâts de base. Enfin bon on est pas encore tout à fait raccord
> avec DofusDB pour avoir des siphon ultra fiable pour être souverain. » +
> « dans …/donjons-et-quetes il y a encore des icônes de succès qui sont très foncées, pourquoi ils n'ont
> pas leur couleur d'origine comme dans [God]?tab=game-data ».
> **Statut : plan écrit, non exécuté.** **Aucune migration** prévue : il s'agit de **compléter des champs
> déjà existants** et de **corriger des URL d'images**.

## 1. Le besoin

Les fiches publiques (module Succès : boss, anomalies, avis de recherche, titans, raids, monstres) doivent
dire **la vérité du jeu** : PV, PA/PM, **résistances**, **tacle/fuite/esquive**, **initiative**, **sorts
avec leurs effets ET leurs probabilités**, et des **dégâts critiques ≥ dégâts de base**. Et les icônes de
défi doivent avoir **leur couleur d'origine**, partout (pas seulement dans God).

## 2. État mesuré (15/10/2026)

| Constat | Mesure | Conséquence |
|---|---|---|
| Fiche monstre incomplète | Exemple `Shin Larve` (`dofusdb.fr/fr/database/monster/457`) : résistances **affichées vides**, tacle/fuite/esquive PA-PM **absents** | les champs existent côté DofusDB ⇒ **siphon partiel** : notre copie locale ne les porte pas (ou ne les affiche pas) |
| Sorts sans probabilités | Exemple `Convocation gluante` : « Invogue 1 Larve Saphir **(dans 25.0 % des cas)** » — cette mention manque chez nous | le siphon des **effets** ne conserve pas la **probabilité** de chaque ligne d'effet |
| Critiques < base | des lignes « EFFETS CRITIQUES » ont des valeurs **inférieures** aux dégâts de base (ex. `Mansoluble` : 322-385 vol Eau vs crit 56-65) | **donnée fausse**, pas un problème d'affichage : c'est la preuve que notre siphon **ne distingue pas** ce qui vient de DofusDB de ce qu'il a mal recopié |
| Icônes de défi assombries | les modales DJ affichent `a.challenge.iconUrl` **brut** (`src/components/dungeon-finder/DjEditModal.tsx:294`, `DjPostCreateModal.tsx:964`, `DjPostCard.tsx:284`, `DjPostDetailModal.tsx:312`, `DjMultiDungeonModal.tsx:252`) — **aucun filtre CSS, aucune opacité** dans ces composants | la **variante sombre** vient de l'**URL** (cache legacy `uploads/assets-dofus` ou hotlink DofusDB), alors que la page God `?tab=game-data` sert la **forme canonique du proxy** |

**Ce qui existe déjà et qu'il faut réutiliser (ne rien réinventer) :**
- le **résolveur unique d'assets** : `src/lib/dofus-image-url.ts:123` —
  `DofusAssetType = "spells" | "items" | "monsters" | "challenges" | "achievements"`, avec
  `resolveDofusAssetImageUrl`, `normalizeDofusAssetStoredUrl` (proxy **interne**, cache disque 1 an) et
  la note `:223` : pour `challenges`/`achievements`, « un seul espace d'id, et c'est l'**icône** » ;
- les **8 selects** qui alimentent les modales/cartes DJ :
  `src/server/actions/dungeon-finder-actions.ts:748/865/967/1354/1435/2514/2956/3218`.

## 3. Décisions à trancher

| # | Question | Recommandation |
|---|---|---|
| 1 | Visuels : corriger les **5 composants** ou les **8 selects** ? | **Les selects** (le bon étage) : une valeur stockée ne doit jamais être rendue brute (même règle que `normalizeDofusAssetStoredUrl`) ⇒ un seul point de normalisation, les composants restent bêtes |
| 2 | Données : re-siphonner ou corriger l'affichage ? | **Mesurer d'abord** : pour 3 monstres témoins, comparer `notre champ` vs `DofusDB` ⇒ on saura si le champ est **absent en base** (siphon) ou **présent mais non rendu** (UI). Sans cette mesure, tout correctif est une supposition |
| 3 | « Critiques < base » : où est l'erreur ? | traiter comme un **bug de données** : verrouiller par un test pur « crit ≥ base » sur le siphon (fail-closed : une ligne critique incohérente est **écartée**, jamais publiée) |

## 4. Lots

| Lot | Contenu | Taille |
|---|---|---|
| **R-1** | **Mesure** : 3 fiches témoins (dont `Shin Larve`) — quels champs sont **en base** vs côté DofusDB, et quels champs ne sont **pas rendus**. Livrable : le tableau de mesure dans ce fichier (remplace le §2) | S |
| **R-2** | **Visuels** : normaliser les icônes de défi **dans les selects** (`challenges`) ⇒ le même rendu que God, **souverain** (proxy interne), et un filet | S |
| **R-3** | **Données manquantes** : résistances, tacle/fuite, initiative, probabilités d'effets — compléter le siphon et/ou le rendu **selon la mesure de R-1** | L |
| **R-4** | **Garde-fous** : test pur « dégâts critiques ≥ dégâts de base » sur le siphon, et une fiche témoin en non-régression | M |
