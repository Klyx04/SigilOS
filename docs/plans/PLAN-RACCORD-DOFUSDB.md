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

### 2.b — Verdict de la mesure **R-1** (jouée le 15/10/2026 sur la base locale)

Requête : `MonsterStat` (`283` lignes, `lastSyncedAt` = **2026-09-09** ⇒ **périmé de plus d'un mois**),
témoin `Shin Larve` (`Donjon des Larves`).

| Fait mesuré | Valeur | Lecture |
|---|---|---|
| Clés **de premier niveau** de `Shin Larve` | `coordinates, drops, dungeonName, familyId, grades, id, imageUrl, name, spells` | **`tackle` et `evade` n'existent pas** (ni au premier niveau, ni ailleurs) |
| `stats ? 'tackle'` / `stats ? 'evade'` sur les **283** lignes | **0 / 0** | **le tacle et la fuite ne sont JAMAIS siphonnés** — alors que `scripts/siphon-unity-bestiary.py:371/390` les **calcule** (`tackle = agi/10 + bonus`, `evade`) : deux siphons, une seule des deux règles appliquée |
| Résistances | **présentes** : `grades[].resists = { neutral: 54, fire: 34, earth: 34, water: -26, air: -26 }` (+ `lifePoints`, `actionPoints`, `movementPoints` par grade) | **la donnée est en base** ⇒ l'écran qui affiche « RÉSISTANCES » **sans valeurs** a un **bug de lecture** (clé/grade attendu), pas un trou de données |
| `stats::text ILIKE '%resistance%'` | **135 / 283** | la moitié seulement des monstres portent le bloc de résistances (siphon partiel ou publication DofusDB incomplète) |
| Probabilités d'effets (`%probability%`) | **127 / 283** | **partielles** — la mention « dans 25.0 % des cas » manque là où la clé n'est pas écrite |
| `spells` | **283 / 283** | les sorts sont là ; c'est leur **contenu** (probabilité, critiques) qui est incomplet |

**Conclusion (les deux causes sont réelles, à des endroits différents)** :
1. **Tacle / fuite : bug de siphon.** La règle existe déjà dans `scripts/siphon-unity-bestiary.py` (agi/10 + bonus) — il faut l'appliquer au siphon qui alimente `MonsterStat` (ou brancher les deux sur la **même** règle).
2. **Résistances : bug d'affichage.** Les valeurs sont en base dans `grades[].resists` ; les écrans qui les rendent vides sont
   `src/components/succes/MonsterFicheView.tsx`, `SuccesBossEncyclo.tsx`, `SuccesBossGuide.tsx`, `SuccesTitanTab.tsx`,
   `src/app/boss/[dungeonId]/_components/PublicBossDetailClient.tsx`, `src/components/boss-overlay/BossOverlayClient.tsx`.
3. **Probabilités / critiques : siphon partiel + donnée fausse** (crit < base) ⇒ verrou « crit ≥ base » au siphon.

**Ce que R-1 change dans les lots** : R-2 devient **« lire la bonne clé »** (`grades[].resists`) — pas un re-siphon — et un
**re-siphon** (R-3) reste nécessaire pour tacle/fuite + probabilités, avec la donnée **périmée depuis le 09/09** comme
argument supplémentaire.


| # | Question | Recommandation |
|---|---|---|
| 1 | Visuels : corriger les **5 composants** ou les **8 selects** ? | **Les selects** (le bon étage) : une valeur stockée ne doit jamais être rendue brute (même règle que `normalizeDofusAssetStoredUrl`) ⇒ un seul point de normalisation, les composants restent bêtes |
| 2 | Données : re-siphonner ou corriger l'affichage ? | **Mesurer d'abord** : pour 3 monstres témoins, comparer `notre champ` vs `DofusDB` ⇒ on saura si le champ est **absent en base** (siphon) ou **présent mais non rendu** (UI). Sans cette mesure, tout correctif est une supposition |
| 3 | « Critiques < base » : où est l'erreur ? | traiter comme un **bug de données** : verrouiller par un test pur « crit ≥ base » sur le siphon (fail-closed : une ligne critique incohérente est **écartée**, jamais publiée) |

## 4. Lots

| Lot | Contenu | Taille |
|---|---|---|
| **R-1** ✅ | **Mesure** : verdict écrit en **§2.b** (résistances **en base**, `tackle`/`evade` **0/283**, probabilités 127/283, données **périmées au 09/09**) · *livré le 15/10/2026, PR #983* | S |
| **R-2** ✅ | **Lecture des résistances** : la clé n'était pas fausse — la donnée arrive sous **3 formes** et le `\|\| {}` local faisait disparaître les valeurs **sans erreur** ⇒ `readGradeResists` (pur, fail-closed) + `EMPTY_GRADE_RESISTS`, une seule lecture pour les 3 écrans · *livré le 15/10/2026, PR #984* | S |
| **R-3** ✅ | **Données manquantes** : `monster-stats-core.ts` a **deux** producteurs de grades et le **second** omettait les caractéristiques de combat (`tackle` 0/283) ⇒ `deriveGradeCombatStats` (valeur publiée **d'abord**, tacle/fuite **dérivés** de l'agilité en dernier recours avec la règle du jeu `floor(agi/10) + bonus`, celle de `scripts/siphon-unity-bestiary.py:371`) · *livré le 15/10/2026, PR #986* · **opérations** : relancer `/api/cron/sync-monster-stats` pour que les fiches déjà en base reçoivent les clés (la base ne se met pas à jour toute seule) | L |
| **R-4** ✅ | **Garde-fou** : `isCoherentCritJet` (pur) — un jet **critique inférieur** au jet normal n'est plus publié (`attachCriticalDamage`, `dofensive-api.ts:687`), la **file positionnelle** par élément avance quand même · *livré le 15/10/2026, PR #985* | M |

**Reste de ce chantier** : la **complétude** (~4 875 monstres sur ≈5 135 n'ont **aucune** fiche riche — arbitrage produit : boss de donjon seuls, ou toutes les fiches ?) et la **relance du siphon** (opérations, cf. R-3).
