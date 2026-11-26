---
description: Refonte « Objectif Dofus » — hub sans Ganymède, fiche Dofus à double vue Rush/DofusDex, DofusDex ISO client, suivi entre membres et sûreté de progression Rush/Dofus (26/11/2026)
---

# 🎯 Objectif Dofus — refonte du hub, des fiches et de l'entraide

> **Rôle unique.** Ce fichier porte le **cadrage, l'architecture et les lots** de la refonte
> « Objectif Dofus » : hub `/quetes-dofus`, fiches par Dofus, DofusDex ISO, suivi entre membres,
> retrait de Ganymède et **sûreté de la progression** lors des éditions God.
>
> **Ce fichier ne porte pas :**
> - l'**ordre global** → `docs/ROADMAP.md` (§2 sexies) ;
> - les **restes du Rush** → `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` (« ⚡ Restes — fiche unique ») ;
> - la **source officielle DofusDex** → `docs/reference/DOFUSDEX.md` (30 progressions, 115 étapes,
>   109 prérequis, 783 objectifs) ;
> - le **graphe des prérequis de quêtes** → `docs/reference/QUEST-PREREQUISITES.md`.
>
> **Dernière mesure locale : 26/11/2026.** Les chiffres ne sont **pas** autoritaires pour la bêta
> ni pour la prod : le lot **L0** les re-mesure en lecture seule avant toute écriture.

---

## 1. Demande et cadrage

### 1.1 Demande user (extrait, 26/11/2026)

> « Il faut qu'on reprenne le contrôle sur les chantiers — phases restantes autour du rush sylvestre
> et tout ce qui le concerne (de près ou de loin) + la refonte que j'aimerais envisager sur
> `/dashboard/.../quetes-dofus`, et dans chaque page de chaque Dofus (si le Dofus n'est pas dans le
> rush on ne parle pas du RHS tout simplement). Ces pages inutiles `?tab=guide` avec un archive
> bizarre et la suppression totale du guide Ganymède du code, une page totalement refaite du suivi
> entre membres, la refonte du DofusDex pour être totalement ISO client du jeu sur chaque Dofus
> (avec les donjons, un mapping DofusDB, sans rien coder en dur permettant l'édition DofusDB). »
>
> « Si on touche à chaque Dofus, on va casser la progression actuelle des gens sur les Dofus ? Si
> côté God j'ai besoin de bouger des blocs / des quêtes dans des blocs / modifier / supprimer /
> éditer / replacer / ajouter, etc., les incidences sur les rush sylvestres en cours des gens, entre
> leurs différents perso, toutes les interactions ? »

### 1.2 Les cinq chantiers réellement contenus dans la demande

| # | Chantier | Résultat attendu |
|---|---|---|
| **A** | **Sûreté de la progression** | Déplacer/supprimer/ajouter un bloc ou une quête ne perd plus une coche par surprise ; l'impact est mesuré avant l'écriture. |
| **B** | **Hub Objectif Dofus** | Maquette 1 : bandeau Rush + Suivi des Dofus + Avancement guilde, sans Ganymède, sans archive, sans bouton flottant. |
| **C** | **Fiche par Dofus** | Maquette 2 : double vue « Ordre Rush & Entraide » / « Trame DofusDex officielle » ; la vue Rush **n'existe que si le Dofus est réellement dans le Rush**. |
| **D** | **DofusDex ISO + God** | Trame officielle du client (30/115/109/783), donjons, mapping DofusDB, éditable dans God, **sans liste de quêtes codée en dur**. |
| **E** | **Suivi entre membres** | Maquette 3 : membres × blocs Rush × Dofus × étapes, drawer d'entraide, création de sortie Discord. |

### 1.3 Principes non négociables

1. **Aucune coche perdue sans décision explicite et sauvegarde.** Une opération God qui touche à la
   structure doit produire un **rapport d'impact** avant écriture.
2. **1 lot = 1 branche = 1 PR → `dev`.** On merge avant d'ouvrir le suivant.
3. **Aucune migration dans L0–L6.** La seule migration prévue est le nettoyage Ganymède (L7), et elle
   attend l'accord explicite du mainteneur (`docs/agents/prisma-schema-change.md`).
4. **Une seule source de vérité par règle.** Le Rush reste la source du Rush ; le DofusDex devient la
   source de la trame Dofus ; `rush-dofus-progress.ts` reste la règle pure partagée.
5. **Zéro liste codée en dur** pour les Dofus, les quêtes, l'ordre ou les donjons de la trame. Les
   données viennent de `DofusItem`, `DofusQuestEntry`, `dofusdex.json`, `Dungeon`, `GameQuest`.
6. **Pas d'appel DofusDB à l'exécution** pour afficher une fiche : on stocke le mapping et les liens,
   on ne dépend pas du réseau (chantier `dofusdb-zero`).
7. **DA Gouache Wakfu** (skill `sigilos-da-wakfu`) et **responsive 390 / 768 / 1 024 / 1 440**
   (skill `responsive`) : tokens `--da-*`, zéro `backdrop-blur`, zéro couleur Tailwind générique.
8. **Aucune suppression de données sans export/dump** (voir `docs/agents/vps-ops.md`).

---

## 2. État mesuré (local, 26/11/2026)

### 2.1 Hub et pages

| Élément | Mesure |
|---|---|
| `DofusQuestHub` | 4 onglets : `menu`, `dofus`, `guide`, `guilde` (`src/components/dofus-quests/DofusQuestHub.tsx:17`). |
| `?tab=guide` | Visible pour un admin car `getOptimizedGuides` renvoie **tous** les guides si `isAdmin` (`src/server/actions/optimized-guide-actions.ts:229-233`). Il liste 5 guides : `progression-complete`, `rush-sylvestre` et **3 archives**. |
| `OptimizedGuideTab` | Filtre `rush-sylvestre` et retombe sur « Aucun guide configuré » (`src/components/dofus-quests/OptimizedGuideTab.tsx:28-44`). |
| Cartes du menu | 4 cartes codées en dur, dont l'icône `ganymede.webp` et le texte « rédigés par Ganymède » (`DofusQuestHub.tsx:244-271`). |
| Sélecteurs de personnage | **Deux** : `CharacterQuestSelector` (page) et `CharDropdown` (bandeau Dofus, `DofusQuestBanner.tsx:45-97`). |
| Progression affichée | Deux fois sur la fiche : bandeau + hero. |
| Props mortes | `membersGuideProgress`, `guideColor` (calculés, jamais rendus), `timelineGuides`, `selectedGuideUserProgress`, `userProfile` (`DofusQuestHub.tsx:129-176`). |
| `heatmapData` | Chargé par la fiche (`[dofusSlug]/page.tsx:53`) puis **jamais utilisé** par `DofusQuestManagerV3`. |
| `DofusGlobalLogistics` | **Orphelin** : aucun import dans `src`. Il appelle même `api.dofusdb.fr` côté client (`:23`). |

### 2.2 Ganymède : inventaire

| Élément | Mesure / preuve |
|---|---|
| `SubGuideData` | **89 lignes** ; modèle `prisma/schema.prisma:3603-3616` (migration `20260430132227_add_subguide_data`). |
| `OptimizedGuideStep` | **0 ligne** ; modèle `prisma/schema.prisma:3349-3362`. |
| Guide `progression-complete` | **163 blocs / 223 séquences** ; **4 lignes** `PlayerGuideProgress`. |
| Archives Rush | 3 guides : `rush-sylvestre-archive-20261117T224935` (108 blocs / 492 séq.), `…20261118T160434` (36 / 608), `…20261118T182958` (36 / 601) ; **19 lignes** de progression. |
| Total Ganymède + archives | **23 des 53 lignes** `PlayerGuideProgress` locales (30 pour le Rush actif). |
| Code Ganymède-only | `src/lib/ganymede-parser.ts`, `OptimizedGuideClient.tsx`, `OptimizedGuideTab.tsx`, `importSubGuide`, `getSubGuideSteps`, `listSubGuides`, `deleteSubGuide`, `updateSubGuideStep`, `importGanymedeGuide`, `repairAlignmentRefs`, `findGuideBySubRef`, `updateBookmarkedStep`, `completeGuideProgress`, onglet God « Import Ganymède ». |
| Assets / réseau | `ganymede.webp`, hosts `ganymede-dofus.com` / `ganymede-app.com` (`next.config.ts:117-124`, `src/app/api/proxy-image/route.ts:84-85`, `src/lib/csp.ts:94,116`), attributs `guideid/guidename` (`src/lib/security.ts:46`), lien ressources (`resources-actions.ts:165`), mentions légales/FAQ. |
| Faux positifs | « Ganymède » est aussi un **PNJ**, des **quêtes** (« Retourner voir Ganymède »), un **item** (« Diadème de Ganymède »), un **passif** et des **monstres** : ne jamais supprimer par simple grep. |

`progression-complete` n'est créé par **aucun seed** du dépôt : il n'apparaît que dans
`scripts/test-guide-actions.ts` et des tests unitaires. C'est un **vestige**, pas un guide éditorial
vivant ; sa suppression ne retire aucun contenu maintenu.

**Partagé avec le Rush — à ne pas supprimer :** `OptimizedGuide`, `GuideMilestone`, `GuideMilestoneChild`,
`GuideSequence`, `PlayerGuideProgress`, `PlayerGuideResourceCheck`, `PlayerGuideDungeonState`,
`setRushSequenceProgress`, `resetGuideProgress`, `getGuildOptimizedGuideProgress`,
`getMemberAllGuidesProgress`, `getOptimizedGuideDetail`, `/god/rush-sylvestre`, `RushTimelineClient`,
`RushEditorStudio`, `guide-styles.css`. Les colonnes `GuideSequence.subGuideRef/stepFrom/stepTo`
restent utilisées par le Rush : **ne pas les dropper** dans le lot de nettoyage.

### 2.3 Données Dofus : pipeline réel

| Étape | État mesuré |
|---|---|
| Référentiel Dofus | `prisma/seed-data/dofus-quests/dofus-items.json` : **26 Dofus** curatés à la main (slug, noms, `isSylvestreReq`, `isMeta`, bonus, catégories, `dofusDbItemId`). |
| Compilateur | `scripts/dofus-compiler-v3.ts` et `scripts/dofus-compiler.ts` lisent `scripts/dofus-configs/<slug>.json`… **dossier supprimé** (commit `7e6b0149`). Ils sont inutilisables en l'état. |
| Seeder actif | `seedDofusData` (`src/server/actions/dofus-quest-actions.ts:1573-1791`) : lit `dofus-items.json` + **25 noms de fichiers compilés codés en dur** (`:1618-1648`), **omet `dofoozbz`**, puis **supprime les chaînes** du Dofus avant de recréer (`:1716`). |
| Seeder générique | `scripts/seed-argent-tree.ts` : upsert `DofusItem`, puis `deleteMany` des chaînes (`:104`), recréation avec ids stables `<slug>-<section>-<dofusdbId|nom>` (`:141-143`). |
| Seeder legacy | `scripts/seed-dofus-quests.ts` + `quest-chains.json` : ancienne trame, aucun appelant, n'écrit pas `isMeta/isSylvestreReq/bonusSummary`. |
| Modèle | 26 Dofus, **73 chaînes** (61 `MAIN_CHAIN`, 12 `PREREQUISITE`), **433 entrées**, **0 succès conteneur** (`entryKind=ACHIEVEMENT`), 126 `isDungeon`, 432 avec `dungeonsRequired`, 426 avec `objectives`. |
| `DofusItem.dofusDbItemId` | Présent dans le JSON sur **25/26** Dofus, **absent du schéma Prisma** : il est jeté au seed. |
| `DofusRequirement` | Aucun code ne l'alimente ni ne le lit hors actions orphelines. |
| `GameQuest` | Miroir **partiel** de DofusDB : 1 976 quêtes, `contentJson` résumé FR borné (400 caractères par texte), pas de `startCriterion`, pas de multilingue. |
| Catalogues statiques | `success-graph.json` (2 777 succès), `quest-prerequisites.json` (990 quêtes / 1 187 arêtes ET-OU), `dungeon-monsters.json` (187 donjons), `npcs-client.json` (6 487 PNJ). **Pas de tables DB** pour ces trois premiers. |

### 2.4 DofusDex officiel : ce que le client expose

| Donnée | Mesure |
|---|---|
| Source | `public/game-data/dofusdex.json`, siphon client Unity `DofusProgressionsDataRoot`, `generatedAt` 17/11/2026. |
| Volume | **30 progressions · 115 étapes · 109 prérequis · 783 objectifs · 0 non résolu**. |
| Types d'étape | 80 quêtes, 133 succès, 10 PNJ, 1 donjon. |
| Types d'objectif | 601 quêtes, 133 succès, **49 objectifs** (donjons, niveaux, alignement, monstres). |
| Prérequis Sylvestre | **1 seul** dans le DofusDex (`achievement 31 — Cavernes Givrefoux`), alors que `DofusItem.isSylvestreReq` marque **12** Dofus : c'est un **tag éditorial**, pas une donnée officielle. |
| Progressions hors module | 4 : **Dofawa, Dofus Kaliptus, Dotruche, Réunification**. Le module a 26 Dofus ; le client en a 30. |

**Écarts mesurés entre la trame officielle et la base actuelle** (quêtes officielles uniques vs entrées DB) :

| Dofus | Quêtes officielles | Entrées DB | Constat |
|---|---:|---:|---|
| Ivoire | 43 | 10 | 33 manquantes |
| Dom de Pin | 77 | 20 | 61 manquantes |
| Cauchemar | 43 | 8 | 35 manquantes |
| Ocre | 15 | 1 | 14 manquantes (page redirigée vers `/quete-ocre`) |
| Émeraude | 21 | 9 | 12 manquantes |
| Argenté | 37 | 57 | **plus d'entrées que l'officiel** : doublons/legacy à ne pas compter dans le % ISO |

> Le DofusDex actuel n'est donc **pas ISO** : il n'a aucun succès conteneur, et le nombre d'entrées
> varie du simple au triple selon le Dofus. Réhabiller l'existant ne suffit pas ; il faut importer la
> trame officielle **sans casser les ids existants**.

### 2.5 Rush et couverture par Dofus

| Donnée | Mesure |
|---|---|
| Guide actif | `rush-sylvestre` : **35 blocs / 544 séquences**. |
| Quêtes portées | **543 séquences** avec `questDbIds` non vide. |
| `GuideMilestone.dofusId` | **0 bloc** renseigné en local : ce champ n'est pas une source de couverture fiable. |
| `RUSH_DOFUS_META` | 21 ids uniques (22 entrées avec l'alias `cauchemar`), constante de code pour libellés/couleurs/images. |
| Incohérence de clé | `DofusItem.slug` utilise des tirets (`dom-de-pin`, `argente-scintillant`, `du-cauchemar`, `veilleur`) ; le Rush des underscores (`dom_de_pin`, `argente_scintillant`, `du_cauchemar`, `des_veilleurs`). |
| Couverture | calculée par **intersection `questDbIds` × quêtes officielles** (prérequis + étapes + objectifs de type quête), et non par `dofusId`. |

**Couverture mesurée des 26 Dofus du module** — `blocs` = blocs du Rush contenant au moins une quête
officielle du Dofus ; `occ.` = occurrences de quêtes officielles rencontrées (une même quête peut
apparaître dans plusieurs blocs). Cette table est une **mesure de départ**, pas une règle codée en dur.

| Dofus | `isSylvestreReq` | id `RUSH_DOFUS_META` | DofusDex | Blocs couverts | Occ. |
|---|:---:|---|:---:|---:|---:|
| `emeraude` | ✔ | `emeraude` | oui | 3 | 22 |
| `turquoise` | ✔ | `turquoise` | oui | 2 | 15 |
| `ivoire` | ✔ | `ivoire` | oui | 4 | 42 |
| `ebene` | ✔ | `ebene` | oui | 5 | 37 |
| `ocre` | ✔ | `ocre` | oui | 2 | 15 |
| `pourpre` | ✔ | `pourpre` | oui | 2 | 14 |
| `vulbis` | — | `vulbis` | oui | 1 | 4 |
| `abyssal` | — | `abyssal` | oui | 1 | 5 |
| `sylvestre` | — | `sylvestre` | oui | 4 | 11 |
| `cawotte` | — | `cawotte` | oui | 1 | 3 |
| `dom-de-pin` | — | `dom_de_pin` | oui | 13 | 78 |
| `des-glaces` | ✔ | `des_glaces` | oui | 2 | 34 |
| `nebuleux` | — | **—** | oui | 1 | 5 |
| `dokoko` | — | `dokoko` | oui | **0** | 0 |
| `domakuro` | ✔ | `domakuro` | oui | 3 | 8 |
| `dolmanax` | — | `dolmanax` | oui | **0** | 0 |
| `dorigami` | ✔ | `dorigami` | oui | 3 | 11 |
| `du-cauchemar` | ✔ | `du_cauchemar` | oui | 11 | 45 |
| `forgelave` | — | **—** | oui | 2 | 9 |
| `argente` | ✔ | `argente` | oui | 3 | 18 |
| `argente-scintillant` | — | `argente_scintillant` | oui | 5 | 22 |
| `cacao` | — | **—** | oui | **0** | 0 |
| `tachete` | ✔ | `tachete` | oui | 1 | 4 |
| `veilleur` | — | `des_veilleurs` | oui | 1 | 15 |
| `dofoozbz` | — | **—** | oui | 2 | 12 |
| `dokille` | — | **—** | oui | **0** | 0 |

**Conséquence produit :** la fiche d'un Dofus n'affiche l'onglet Rush que si `Blocs couverts > 0`.
Aujourd'hui : **Cacao, Dokille, Dolmanax, Dokoko** sont à 0. Les autres le sont, souvent via des
prérequis répartis sur plusieurs blocs — ce que `GuideMilestone.dofusId` ne sait pas exprimer.

### 2.6 Progression locale (à re-mesurer en bêta)

| Table | Lignes locales |
|---|---:|
| `PlayerDofusProgress` | 66 |
| `PlayerDofusQuestProgress` | **518** (dont **285 sur Argenté / 1 profil / 5 personnages**) |
| `PlayerGuideProgress` | 53 (30 Rush + 4 `progression-complete` + 19 archives) |
| `PlayerGuideDungeonState` | 112 |
| `PlayerGuideResourceCheck` | 354 |
| `PublicRushProgress` | à mesurer (visiteurs) |

> La concentration sur Argenté / 5 personnages prouve que le multi-perso est réel : une migration qui
> ne traite que le personnage actif est **fausse**.

### 2.7 Dettes, bugs et doublons mesurés (à traiter dans les lots)

| Sujet | Mesure | Lot |
|---|---|---|
| `getGuildDofusStats` — `dofusObtained` | Compte **toutes** les lignes de progression, pas seulement `isObtained` (`dofus-quest-actions.ts:659-691`). Un Dofus commencé est compté « obtenu ». | L6 |
| `getGuildDofusStats` — images | `topMembers.image` forcé à `null` (`:681`) alors que `members` a l'image. | L6 |
| `getGuildDofusStats` — périmètre | `membersProgress` ne lit que `PRINCIPAL` (`:587-599`) : les mules sont absentes. | L6 |
| Liens donjons | `DofusQuestEntry.dungeonsRequired[].id` est un **id DofusDB**, passé à `dungeonFicheHref` qui attend un `Dungeon.id`/slug (`src/lib/dungeon-fiche.ts:14-25`) → liens non résolus. | L3/L4 |
| DofusDB à l'exécution | `DofusGlobalLogistics` (orphelin) appelle `api.dofusdb.fr/items` (`:23`). | L2/L7 |
| URL générée | `DofusTimelineQuest` fabrique `dofuspourlesnoobs.com/donjon-${slug(name)}` (`:245`) au lieu d'utiliser un lien stocké. | L5 |
| Couleurs | `DOFUS_OFFICIAL_COLORS` a des clés `dofus-argente`/`dofus-pourpre` qui ne matchent pas les slugs réels (`dofus-colors.ts:9-30`) → retombe sur la couleur DB. | L2 |
| Champs fantômes | `bossName`/`bossImg` lus sur `DofusQuestEntry` (`dofus-quest-actions.ts:417-418`) mais absents du modèle. | L5 |
| Seed actif | `seedDofusData` code 25 noms de fichiers et omet `dofoozbz` (`:1618-1648`). | L3 |
| Compilateur | `scripts/dofus-configs/` supprimé ; `dofus-compiler-v3.ts` et `seed-argent-tree.ts` ne peuvent plus produire de données. | L3 |
| `dofusId` Rush | 0 bloc renseigné localement ; `RUSH_DOFUS_META` est une constante, pas une donnée DB. | L4/L5 |
| Orphelins | `DofusGlobalLogistics`, `SylvestreDonut`, `QuestChecklist`, `QuestActionsBlock`, `MapPositionModal`, `DofusQuestGodClient`, `DofusNeuralTree` (à confirmer par `git grep` avant suppression). | L2/L7 |
| Commentaire | `prisma/schema.prisma:3128` dit « les 23 Dofus » alors que le seed en a **26**. | L3 |

---

## 3. Réponses aux deux questions de progression

### 3.1 Dofus — ce qui casse, ce qui ne casse pas

La progression Dofus est portée par **`PlayerDofusQuestProgress.questId` → `DofusQuestEntry.id`**
(`onDelete: Cascade`) et par `PlayerDofusProgress` au niveau Dofus. Le pourcentage est calculé **à la
lecture** sur les entrées `entryKind=QUEST`, `isOptional=false`, pondérées par `weight`
(`dofus-quest-actions.ts:241-254`) ; `completionPercent` n'est utilisé que pour Dolmanax.

| Opération | Effet sur la progression | Pourquoi |
|---|---|---|
| Renommer, réordonner, changer zone/coords/objectifs/donjons/`dofusdbId` | **Conservée** | L'id de l'entrée ne change pas. |
| Déplacer une quête vers une autre section (`chainId`) | **Conservée** | Même id ; seule la chaîne change. |
| Ajouter une quête | Existante conservée ; dénominateur et % évoluent | Nouvelle entrée sans progression. |
| Supprimer une quête | Progression de cette quête perdue | Cascade `PlayerDofusQuestProgress`. |
| Supprimer une section / un Dofus | Toute la progression de la section/Dofus perdue, tous personnages | Cascade `DofusQuestChain` → entrées → progression. |
| **`seedDofusData`, `seed-argent-tree`, `compileDofusChain`** | **Destructeur** : `deleteMany` des chaînes puis recréation | Le cascade supprime les entrées **avant** de les recréer, même avec des ids stables. |

**Conclusion :** on peut éditer les Dofus **en place** sans casser les coches. On ne peut pas utiliser
les outils de resync actuels tels quels. Le lot **L3** remplace le `delete + recreate` par un
**upsert par id stable**, sans suppression automatique. Les entrées absentes restent en place
(« compléments ») ou sont exclues du % ISO par leur chaîne, jamais supprimées par le sync.

### 3.2 Rush — ce qui casse, ce qui ne casse pas

La progression Rush est portée par **`PlayerGuideProgress(profileId, milestoneId, characterSlot)`**,
avec `completedSteps = [GuideSequence.id]` (`rush-dofus-progress.ts:425-432`). Le bloc fait partie de
la clé : c'est ce qui rend le déplacement dangereux.

| Opération God | Effet | Détail |
|---|---|---|
| Éditer / renommer / réordonner une quête ou un bloc | **Conservée** | `guideSequence.update({ id })`, aucun `PlayerGuideProgress` touché. |
| Ajouter une quête | Existante conservée ; nouvelle « à faire » | ⚠️ `isCompleted` du bloc n'est pas recalculé : il peut rester `true` à tort. |
| **Déplacer une quête** (`moveRushSequence`, `bulkMove`, `reorder` inter-blocs) | **Non migrée aujourd'hui** | Seuls `milestoneId` + `order` changent. La cible voit « à faire » ; l'ancien bloc garde un id orphelin ; `currentStep` reste dans l'ancien bloc. |
| Supprimer une quête | Progression de la quête perdue | L'id reste orphelin dans `completedSteps` ; **coches donjons supprimées en cascade** (`PlayerGuideDungeonState.sequenceId`). |
| Supprimer un bloc | **Toute la progression du bloc perdue**, tous membres et tous `characterSlot` | Cascade `PlayerGuideProgress` + `GuideSequence` + donjons. |
| Import Rush additif (`importRushGuide`) | **Conservée** | Additif, dry-run, no-op au 2ᵉ passage (`:5720-5773`). |
| Import legacy / Ganymède | **Destructeur** | `deleteMany` des séquences du bloc puis recréation (nouveaux ids). |
| Split (`splitRushSequence`) | Progression reportée, **coches donjons perdues** | Les N nouvelles séquences remplacent l'id dans `completedSteps`, puis l'original est supprimé. |
| Reset bloc/guide | Perte volontaire | `resetMilestoneProgress` / `resetGuideProgress`. |

**Correctif minimal (L1, aucune migration) :** un helper transactionnel `moveSequenceProgress` appelé
par `moveRushSequence`, `bulkMoveRushSequences` et `reorderRushSequences` quand le bloc change :
- retirer l'id du bloc source et l'ajouter au bloc cible pour **toutes** les lignes
  `PlayerGuideProgress` concernées ;
- recalculer `isCompleted` / `completedAt` des deux blocs avec les règles existantes
  (`stepCounts`) ;
- déplacer `currentStep` s'il vaut l'id ;
- laisser `PlayerGuideDungeonState` et `PlayerGuideResourceCheck` inchangés (ils suivent l'id de
  séquence / la clé de ressource) ;
- traiter aussi `PublicRushProgress` (JSON `Record<milestoneId, ids>`) par le même helper, en lots
  bornés (lecture/écriture JSON) ; si le volume dépasse le plafond, fournir un script de reprise
  idempotent. On ne laisse pas le visiteur dans un état incohérent « à réparer à la main ».

**Si God doit réorganiser souvent**, la table stable `(profileId, characterSlot, sequenceId)` devient
préférable : elle rend les déplacements, splits et recréations sûrs par construction. C'est une
**migration** : décision `D-OD1`, à ne pas prendre dans L1.

### 3.3 Multi-personnages et visiteurs

- `PlayerGuideProgress` est déjà par `characterSlot` (`PRINCIPAL` ou pseudo de mule) : toute migration
  doit boucler sur **tous** les profils et **tous** les slots. Le cas local d'Argenté (1 profil,
  5 personnages, 285 lignes) est le contre-exemple à ne pas reproduire.
- `PlayerDofusQuestProgress` est par `characterName` : les migrations Dofus doivent aussi traiter
  toutes les mules.
- `PublicRushProgress` (visiteurs) stocke `completedMilestones`, `completedSteps`, `bookmarks`,
  `dungeonChecks`, `currentStep` en JSON. Une action God ne le migre **jamais** aujourd'hui. L1 doit
  soit le migrer, soit documenter que le visiteur répare à sa prochaine sauvegarde.
- `RushPresence.milestoneId` n'a pas de FK : supprimer un bloc laisse une présence orpheline jusqu'au
  prochain heartbeat/leave.

### 3.4 Règle de pourcentage

Deux pourcentages différents ne doivent pas cohabiter sans explication.

- **Dofus** : le % ISO se calcule sur les chaînes `DOFUSDEX_*` (étapes officielles). Les coches
  existantes sont réutilisées par `dofusdbId`, mais **le dénominateur change** (ex. Ivoire 43 quêtes
  officielles vs 10 entrées actuelles). Les coches ne sont pas perdues ; le % peut baisser. On affiche
  un bandeau « trame mise à jour » et on ne change pas le chiffre en silence.
- **Rush** : le % se calcule sur les séquences du bloc. Ajouter/déplacer/supprimer une quête change
  le dénominateur et peut rendre un bloc incomplet. Après toute opération structurelle, `isCompleted`
  doit être recalculé pour les blocs touchés (L1) ; on ne se fie pas à l'ancien booléen.
- **Décision `D-OD4`** : assumer le nouveau dénominateur ISO (recommandé, avec bandeau) ou conserver
  l'ancien % jusqu'à validation. Dans les deux cas, aucune coche n'est supprimée.

---

## 4. Architecture cible

### 4.1 Clé canonique Dofus (prérequis de tout le reste)

Aujourd'hui, quatre identités coexistent : `DofusItem.slug` (tirets), `RUSH_DOFUS_META.id`
(underscores), `dofusdex.id` (numérique) et `DofusDB item id` (numérique, dans le JSON seulement).
Il faut **une clé canonique** et une seule :

```
DofusItem.slug  ←→  canonicalDofusKey()  ←→  RUSH_DOFUS_META.id
                ←→  dofusdex.id          ←→  DofusDB item id
```

- **Recommandation** : ajouter `DofusItem.dofusDbItemId` (additif, présent dans `dofus-items.json`)
  et une fonction pure `canonicalDofusKey` qui normalise `des_veilleurs` → `veilleur`,
  `dom_de_pin` → `dom-de-pin`, `argente_scintillant` → `argente-scintillant`,
  `du_cauchemar` → `du-cauchemar`. Tests de table sur les 26.
- **Sans migration** : commencer par un adaptateur pur + le mapping déjà présent dans
  `dofus-items.json` ; la colonne peut attendre L3/L4.
- `RUSH_DOFUS_META` ne doit plus être la source d'une liste : il devient un **adaptateur d'affichage**
  (couleur/image) alimenté par `DofusItem`, avec un repli explicite. Aucun nouveau Dofus ne doit
  nécessiter un changement de code.
- `isSylvestreReq` reste un **tag éditorial** (12 Dofus), pas une déduction du DofusDex (1 prérequis).

### 4.2 Hub `/quetes-dofus` (maquette 1)

**Structure cible :**

1. En-tête : titre « Objectif Dofus », description, **un seul** sélecteur de personnage actif,
   Documentation/Tutoriel.
2. Bandeau pleine largeur **Rush Sylvestre** : dernier bloc actif, barre de progression, % en
   mini-écriteau, boutons « Reprendre le Rush » et « Ouvrir l'Overlay PiP », nombre de membres en cours.
3. Deux cartes : **Suivi des Dofus** (25/26) et **Avancement de la guilde** (107 membres).
4. Feedback dans le flux ; **aucun bouton flottant** `SIGNALER`.

**Suppressions :**

- l'onglet `?tab=guide` et le type `Tab = "guide"` ;
- `OptimizedGuideTab` et ses imports ;
- la carte « Guides optimisés » / `ganymede.webp` / le texte Ganymède ;
- les fetchs et props mortes `guides`, `selectedGuideDetail`, `selectedGuideUserProgress`,
  `selectedGuideGuildProgress`, `membersGuideProgress`, `guideColor`, `timelineGuides`, `userProfile` ;
- les 5 icônes Dofus codées en dur dans la carte « Suivi des Dofus » (utiliser `DofusItem`) ;
- le double sélecteur de personnage (garder `CharacterQuestSelector`).

**Données :** `getDofusListWithProgress`, `getGuildDofusStats` (après correction L6), état du guide
Rush (`isUnderConstruction`), présence. Les archives ne sont plus listées ; elles restent en base
jusqu'à L7.

**Tests :** absence de `ganymede`, de `tab=guide`, de `OptimizedGuideTab` ; présence du bandeau Rush
et des deux cartes ; `da-wakfu.test.ts` ; captures 390/768/1 024/1 440.

### 4.3 Fiche par Dofus (maquette 2)

**En-tête :** nom, image, rareté, niveau, progression, **un seul** sélecteur de personnage,
« Voir dans le Rush (Bloc X) » **si et seulement si** la couverture est > 0, « Overlay PiP ».

**Onglet 1 — « Ordre Rush Sylvestre & Entraide » (par défaut si couvert) :**

- séquences du Rush dont au moins un `questDbIds` appartient aux quêtes officielles du Dofus ;
- regroupement par bloc Rush, prérequis intercalés (réutiliser `dofusQuestRefsForMilestone`,
  `questStatusForMembers`, `RushDofusDetailModal`) ;
- « Ici maintenant » / « Peut aider » / « Validée » par quête ;
- copie `/travel` avec flash vert `Copié ✓` ;
- « Proposer une sortie » (L6).

**Onglet 2 — « Trame DofusDex (Officielle) » :**

- ordre strict du client, succès conteneurs, objectifs, niveaux, prérequis ;
- donjons résolus vers la fiche interne (`Dungeon.id`/slug), avec lien DofusDB stocké ;
- aucun appel réseau DofusDB à l'exécution ;
- aucun texte Rush dans cet onglet.

**Règle de couverture (pure, testée) :**

```
couverture(dofus) = sequencesRush.filter(seq =>
  seq.questDbIds ∩ quetesOfficielles(dofus) ≠ ∅
)
```

`quetesOfficielles(dofus)` = ids de quête de `dofusdex.json` (prérequis + étapes + objectifs de type
quête). Si `couverture.length === 0` : **pas d'onglet Rush, pas de mention RHS**. Cacao, Dokille,
Dolmanax et Dokoko sont dans ce cas aujourd'hui (mesure locale). Aucun `if (slug === ...)`.

**Repli explicite (donnée God, pas hardcode)** : si un bloc du Rush porte un `dofusId` renseigné par
God et résolu par `canonicalDofusKey`, ses séquences comptent aussi dans la couverture. Aujourd'hui
**0 bloc** a ce champ en local : le repli ne sert donc à rien tant que L0/L3 ne l'ont pas mesuré.
Il est là pour un Dofus dont les quêtes Rush ne seraient pas dans le DofusDex (cas à vérifier pour
Dokoko) ; le dry-run doit afficher « couvert par questDbIds » vs « couvert par dofusId ».

**Pont vers le Rush :** accepter `?block=<milestoneId>&seq=<sequenceId>` (ou réutiliser
`from`/`fromTitle`), puis `scrollToSequence` + focus. Test de comportement : la fiche arrive sur la
bonne quête, le bon bloc est ouvert, le personnage actif est conservé.

**Cas spéciaux assumés :**

- **Ocre** : la page reste redirigée vers `/quete-ocre` (module dédié Metamob). La fiche DofusDex
  n'affiche pas de doublon ; le lien depuis la grille reste.
- **Dolmanax** : le tracker `PAGES:X` reste ; la trame officielle est affichée à côté, sans compter
  le tracker dans le % ISO.
- **Dokille** : le tracker `KROKILLES:[...]` reste ; la trame officielle est affichée à côté.
- Ces trois cas sont **explicites et documentés**, pas des listes de quêtes cachées.

### 4.4 DofusDex ISO — modèle, import, God

#### 4.4.1 Pas de nouvelle table : réutiliser `DofusQuestChain` / `DofusQuestEntry`

Le modèle actuel sait déjà faire les succès imbriqués (`entryKind=ACHIEVEMENT`, `parentEntryId`),
les donjons (`dungeonsRequired`), les objectifs (`objectives`), les prérequis
(`DofusQuestPrerequisite`) et la pondération (`weight`). Il manque **la structure officielle**, pas
un nouveau modèle.

**Convention de chaînes :**

- `sectionType = "DOFUSDEX_PREREQUISITE"` : prérequis officiels du Dofus ;
- `sectionType = "DOFUSDEX_MAIN"` : étapes officielles, dans l'ordre du client ;
- les anciennes chaînes `PREREQUISITE` / `MAIN_CHAIN` restent en place et deviennent des
  **compléments** (hors % ISO tant que la trame officielle existe).

**Convention d'entrées :**

- étape de type `quest` → `entryKind=QUEST`, `questType=QUEST`, `weight=1` ;
- étape de type `achievement` → `entryKind=ACHIEVEMENT`, `weight=0` ; ses objectifs de type quête
  deviennent des enfants (`parentEntryId`) **si la quête n'appartient qu'à ce succès** ;
- une quête partagée par plusieurs succès reste **une seule entrée** (une seule progression),
  référencée dans les `objectives` JSON de chaque succès : on ne duplique jamais une quête ;
- étape `npc` → entrée informative, `weight=0`, `isOptional=true` (visible, non comptée) ;
- étape `dungeon` / objectif `objective` → `objectives` JSON + `dungeonsRequired` quand un donjon est
  résolu ; `weight=0` si ce n'est pas une quête jouable, `weight=1` si c'est un donjon validable ;
- `dofusdbId` = id de la quête / du succès / du donjon ; `dofusdbUrl` = lien stocké ;
- `dungeonsRequired[]` porte `{ dungeonId, dofusdbId, name, level, bossName, imageUrl }` :
  `dungeonId` est l'id **local** `Dungeon.id` (ou le slug), `dofusdbId` la provenance. Le rendu ne
  passe plus un id DofusDB à `dungeonFicheHref`.

#### 4.4.2 Algorithme d'import (dry-run par défaut)

1. Lire `public/game-data/dofusdex.json` et vérifier `counts` (30/115/109/783) + `unresolved = 0`.
2. Résoudre chaque progression vers un `DofusItem` par `canonicalDofusKey` ; les 4 progressions sans
   `DofusItem` sont listées « non suivies » (décision `D-OD7`).
3. Créer/récupérer les chaînes `DOFUSDEX_PREREQUISITE` et `DOFUSDEX_MAIN` (id stable, pas de delete).
4. Pour chaque étape, calculer la clé `(dofus, type, id)` ; chercher une entrée existante du même
   Dofus par `dofusdbId` + `entryKind` :
   - si trouvée : **réutiliser son id**, mettre à jour les champs, la déplacer dans la chaîne
     officielle (le `chainId` change, l'id et la progression restent) ;
   - si absente : créer avec un id stable `${slug}-dex-${type}-${id}`.
5. Créer les succès conteneurs avant leurs enfants ; rattacher les enfants non partagés.
6. Résoudre les donjons par `Dungeon.dofusdbId`, puis par nom/boss normalisé ; stocker l'id local ;
   lister les non résolus (les 49 objectifs `objective` sont le principal gisement).
7. Ne **jamais** supprimer : les entrées absentes de la trame restent dans leurs anciennes chaînes
   (« compléments ») et sont exclues du % ISO.
8. Recalculer les compteurs dérivés si nécessaire ; ne pas toucher `PlayerDofusQuestProgress`.
9. Écrire un journal `GOD_DOFUSDEX_SYNC` avec `créés / réutilisés / déplacés / non résolus /
   progressions affectées`.
10. `apply` seulement après un dry-run vert, dans une transaction, avec un plafond de lignes.

**Sortie du dry-run :**

```
Dofus: 26 suivis / 4 non suivis
Chaînes: 52 (26 prérequis + 26 principales)
Étapes: 115 (80 quêtes, 133 succès, 10 PNJ, 1 donjon)
Objectifs: 783 (601 quêtes, 133 succès, 49 objectifs)
Réutilisés: N ids existants (progression conservée)
Créés: N entrées
Déplacés: N entrées (chainId seulement)
Donjons résolus: N / non résolus: N (liste)
Progressions affectées: N lignes (aucune suppression)
```

#### 4.4.3 God — édition du mapping, pas de DofusDB

On ne peut pas écrire chez DofusDB. On rend **notre mapping** éditable :

- nouvel onglet `DofusDex` dans `/god/quetes-dofus` (ou route dédiée) :
  - arbre par Dofus : prérequis, étapes, objectifs, succès, donjons ;
  - colonnes `type`, `dofusdbId`, `dofusdbUrl`, `entryKind`, `weight`, `parentEntryId`,
    `dungeonsRequired`, `objectives` ;
  - badges « réutilisé / créé / déplacé / non résolu » ;
  - bouton **Synchroniser (dry-run)** puis **Appliquer** ;
  - recherche des non-mappés, résolution manuelle d'un donjon, création d'une entrée manquante.
- Les actions existantes `upsertQuestEntry`, `upsertQuestChain`, `deleteQuestEntry`,
  `addQuestPrerequisite` restent la base ; on ajoute le sync et la vue, pas un second CRUD.
- RBAC : `isSuperAdmin` ou brique `game-data-quetes` ; audit `GOD_DOFUSDEX_SYNC` ; rate limit.

#### 4.4.4 Sources de données (aucune liste en dur)

| Donnée | Source |
|---|---|
| Ordre, étapes, prérequis, objectifs | `public/game-data/dofusdex.json` |
| Succès → quêtes | `public/game-data/success-graph.json` (2 777) |
| Prérequis quête → quête | `public/game-data/quest-prerequisites.json` (990 / 1 187) |
| Noms/niveaux/contenu résumé | `GameQuest` (1 976, par `dofusDbId`) |
| Donjons + monstres | `public/game-data/dungeon-monsters.json` (187) + `Dungeon.dofusdbId` |
| PNJ | `prisma/seed-data/npcs/npcs-client.json` (6 487) |
| Icônes/couleurs/images Dofus | `DofusItem` (DB) + `resolveDofusImageUrl` |
| Mapping DofusDB | `DofusQuestEntry.dofusdbId` / `dungeonsRequired[].dofusdbId` |

**Interdits dans la trame :** une liste de quêtes dans un composant, un `if (dofus.slug === ...)`
pour une quête, une URL DofusDB générée depuis un nom, un appel `api.dofusdb.fr` à l'exécution.

### 4.5 Suivi entre membres / entraide (maquette 3)

**Ne pas créer une 3ᵉ logique.** Les briques existent :

| Besoin | Brique existante |
|---|---|
| Matrice Dofus × membres | `GuildDofusOverview` + `getGuildDofusStats` (après correction) |
| Heatmap quête × membre | `getGuildHeatmapForDofus` (déjà calculée, jamais rendue) |
| Qui est où | `getGuildSynergyForDofus`, `getOtherMembersOnQuest`, `useDofusPresence` |
| Suivi Rush par Dofus/membre | `getGuildOptimizedGuideProgress`, `getMemberAllGuidesProgress`, `GuildStatusPanel`, `RushDofusDetailModal` |
| Sortie donjon/quête | `createDjPost` / `createDjPosts` + `DjPostCreateModal` (modes `DONJON`, `QUETE`) |
| Sortie planifiée | `createCalendarEvent` + `GuildEvent` (`SORTIE_FARM`, `DUNGEON_FARM`) |
| Miroir agenda | `agenda-mirror-sync.ts` |
| Quêtes liées à un donjon | `getLinkedQuests` |

**Nouvelle action serveur** `getGuildEntraideOverview(guildId, { dofusSlug?, blockId? })` :

- **membres** : une ligne par **personnage** (principal + mules), avec `ownerName`, `isMule`,
  bloc Rush actif, % Rush, Dofus obtenus, présence, dernier heartbeat ;
- **Dofus** : grille avec obtenus / en cours / membres par étape officielle (ou quête Rush) ;
- **drawer** : groupe les membres par étape, « Ici » vs « Validée », bouton « Créer une sortie » ;
- **filtres** : « Mon personnage » / « Tous les personnages », recherche membre, Dofus, bloc ;
- **RBAC** : `canViewQuests`, isolation `guildId`, aucun visiteur, aucun e-mail/snowflake ;
- **perf** : cache Redis court, pagination/plafond, pas de N+1 (le batch de validation et l'agrégat
  guilde sont déjà des points chauds).
- **sortie** : `DjPostCreateModal` en mode `QUETE` avec `initialQuestName` / `initialDungeonId`, ou
  `createCalendarEvent` si la sortie est planifiée. Aucun nouveau modèle sans décision `D-OD6`.

**Bugs à corriger avant la page :** `dofusObtained` (compte les commencés), `topMembers.image = null`,
`membersProgress` limité à `PRINCIPAL`, `completionPercent` non recalculé pour les cas normaux.

### 4.6 Ganymède — retrait en deux temps

**L2 (UI, sans migration) :**

- retirer l'onglet `?tab=guide`, `OptimizedGuideTab`, la carte Ganymède, les archives de la liste ;
- garder les données en base (elles ne sont plus affichées) ;
- retirer le bouton flottant `SIGNALER` et le double sélecteur.

**L7 (code + données, migration à valider) :**

- supprimer `SubGuideData`, `OptimizedGuideStep`, `OptimizedGuide.steps` ;
- supprimer `ganymede-parser.ts`, `OptimizedGuideClient` (branche TREE), les actions d'import/édition
  de sous-guides, `repairAlignmentRefs`, `findGuideBySubRef`, `updateBookmarkedStep`,
  `completeGuideProgress` (si plus aucun appelant) ;
- supprimer la CSS `.ganymade-step-text`, `ganymede.webp`, les hosts CSP/proxy, le lien ressources,
  les mentions légales/FAQ si plus aucun contenu Ganymède n'est servi ;
- exporter puis supprimer `progression-complete` et les 3 archives (23 lignes de progression
  locales) après dump ;
- **ne pas** supprimer `OptimizedGuide`, `GuideMilestone`, `GuideSequence`, `PlayerGuideProgress`,
  `PlayerGuideResourceCheck`, `PlayerGuideDungeonState`, `/god/rush-sylvestre`, `RushTimelineClient`,
  `RushEditorStudio`, `guide-styles.css` ;
- **ne pas** supprimer les faux positifs « Ganymède » (PNJ, quêtes, item, passif, monstres) ;
- preuve : `git grep -n "ganym|SubGuideData|OptimizedGuideStep"` ne doit plus retourner que les faux
  positifs documentés.

### 4.7 DA et responsive

- La DA est **Gouache Wakfu** : `src/app/da-wakfu.css`, tokens `--da-*`, `.da-rail`, `.da-card`,
  `.da-node`, `.da-btn`, `.da-plank`. Les maquettes HTML sont des **références**, pas du CSS à copier.
- Zéro `backdrop-blur`, zéro ombre molle, zéro couleur Tailwind générique (`#10b981`, `#f59e0b`),
  zéro `font-black` hors convention.
- Une seule action primaire par écran ; le bouton « Reprendre le Rush » reste le CTA du hub.
- Vérification **390 / 768 / 1 024 / 1 440** à chaque lot UI (skill `responsive`) ; pas de largeur
  fixe qui déborde ; `svh/dvh` pour les hauteurs.
- Le feedback (`QuestFeedbackButton`) reste dans le flux, jamais en overlay flottant.

---

## 5. Plan par lots

> **Ordre global :** `docs/ROADMAP.md` §2 sexies. **1 lot = 1 branche = 1 PR → `dev`.**
> Les lots L0–L6 ne font **aucune migration**. L7 est le seul lot avec migration, et il attend
> l'accord explicite.

### L0 — Mesure bêta, sauvegarde et rapport d'impact (S, aucun code)

**But :** ne rien toucher avant de connaître les vrais chiffres.

- Mesure en **lecture seule** sur la bêta (`docs/agents/acces-lecture-seule.md`) :
  - `OptimizedGuide` (slug, actif, displayMode) et comptage blocs/séquences ;
  - `PlayerGuideProgress` par guide et par `characterSlot` ;
  - `PlayerDofusProgress` / `PlayerDofusQuestProgress` par Dofus et par `characterName` ;
  - `PublicRushProgress` (visiteurs) ;
  - `SubGuideData`, `OptimizedGuideStep`, guides archives ;
  - `GuideMilestone.dofusId` renseigné ou non.
- Dump/backup avant toute écriture (`docs/agents/vps-ops.md`) : `./scripts/ops/vps.sh dump beta`
  (ou l'équivalent documenté), vérification de la taille et de la restauration.
- Rapport d'impact :
  - combien de lignes seraient touchées par un resync Dofus, un déplacement Rush, une suppression de
    bloc, une suppression de Ganymède ;
  - quels Dofus ont une couverture Rush > 0 (recalcul `questDbIds` × DofusDex) ;
  - quels donjons sont non résolus.
- Mettre à jour la §2.6 de ce plan avec les chiffres bêta (pas de nouveau fichier d'état).

**DoD :** chiffres bêta consignés, dump vérifié, aucune écriture, aucun code.

### L1 — Sûreté des déplacements Rush (M, aucune migration)

**But :** rendre `moveRushSequence`, `bulkMoveRushSequences` et `reorderRushSequences` sûrs avant que
God ne réorganise.

**Fichiers :**

- `src/server/actions/optimized-guide-actions.ts` (les 3 actions + helper) ;
- nouveau `src/lib/rush-progress-move.ts` (règle pure de calcul des ids à déplacer/recalculer) ;
- `tests/unit/rush-move-sequence.test.ts`, `tests/unit/rush-bulk-actions.test.ts` ;
- nouveau `tests/unit/rush-move-progress.test.ts`.

**Comportement :**

- helper transactionnel : retirer l'id du bloc source, l'ajouter au bloc cible pour **toutes** les
  lignes `PlayerGuideProgress`, recalculer `isCompleted`/`completedAt` des deux blocs, déplacer
  `currentStep` ;
- `reorderRushSequences` : si un id change de `milestoneId`, appliquer les mêmes gardes que
  `moveRushSequence` (même guide, cible non `SEPARATEUR`/`INFO`) et le même helper ;
- `bulkMove` : même helper, une seule transaction ;
- `PublicRushProgress` : migration best-effort bornée ou réparation à la prochaine écriture
  (documenter le choix) ;
- aucun champ de route/tips/tags/donjons écrasé (le bug historique de l'update partiel est verrouillé
  par le test existant).

**Tests :** un bloc avec 2 profils × 2 `characterSlot` **et une ligne `PublicRushProgress`**, une
séquence cochée déplacée → toutes les lignes conservent la coche et les deux blocs ont le bon
`isCompleted` ; un déplacement vers le même bloc est un no-op ; une cible `SEPARATEUR`/`INFO` est
refusée.

**DoD :** `npm run test:run`, `npx tsc --noEmit`, `npm run lint`, aucun changement de schéma, preuve
avant/après dans la PR.

### L2 — Hub sans Ganymède (M, aucune migration)

**But :** maquette 1, suppression de l'onglet et de l'archive bizarre.

**Fichiers :** `DofusQuestHub.tsx`, `page.tsx`, `DofusGemCard.tsx`, `DofusQuestBanner.tsx`,
`QuestFeedbackButton` (placement), `dofus-colors.ts`, tests UI/DA.

**Comportement :**

- type `Tab` sans `guide` ; `?tab=guide` redirige vers le hub ou 404 propre ;
- bandeau Rush + 2 cartes ;
- suppression des fetchs/props mortes et des 5 icônes codées en dur ;
- archives masquées (pas supprimées) ;
- suppression du bouton flottant `SIGNALER` ;
- un seul sélecteur de personnage.

**Tests :** source-level « aucun `ganymede`, aucun `tab=guide`, aucun `OptimizedGuideTab` » ; rendu
des 2 cartes ; `tests/unit/da-wakfu.test.ts` ; captures 390/768/1 024/1 440.

**DoD :** aucun changement de données, CI verte, contrôle visuel.

### L3 — Sync Dofus non destructive (M, aucune migration)

**But :** arrêter de perdre la progression au resync.

**Fichiers :** `src/server/actions/dofus-quest-actions.ts` (`seedDofusData`/nouvelle action
`syncDofusFromCompiled`), `scripts/seed-argent-tree.ts` (mode dry-run/upsert), tests.

**Comportement :**

- `DofusItem` upsert par `slug` ;
- chaînes : match par `(dofusId, sectionType, sectionName)` ; création si absente ; **pas de delete** ;
- entrées : match par id stable puis par `(dofusdbId, entryKind, name)` ; mise à jour sur place ;
  **pas de delete** ;
- les entrées absentes du fichier restent en place (rapport « absentes, non supprimées ») ;
- le sync ne touche **jamais** `PlayerDofusQuestProgress` ;
- dry-run par défaut, `apply` explicite, transaction, audit, plafond ;
- les 25 noms de fichiers codés en dur sont remplacés par une découverte des `*-compiled.json`
  (le champ `dofus` du JSON donne le slug) ; `dofoozbz` n'est plus oublié, aucun nouveau Dofus ne
  demande de modifier le code.

**Tests :** deux passages = 0 changement ; une ligne de progression factice sur une entrée existante
survit ; une entrée absente n'est pas supprimée ; un renommage ne crée pas de doublon ; les compteurs
du rapport sont exacts.

**DoD :** dry-run vert sur la base locale, CI verte, aucune migration.

### L4 — DofusDex ISO et God mapping (L, aucune migration)

**But :** importer la trame officielle et la rendre éditable.

**Fichiers :**

- nouveau `scripts/import-dofusdex.ts` (dry-run/apply) ou `src/server/actions/dofusdex-actions.ts` ;
- nouveau `src/lib/dofusdex.ts` (normalisation, clé canonique, résolution donjons) ;
- `src/app/god/quetes-dofus/page.tsx` + composant `DofusDexManager` ;
- tests `tests/unit/dofusdex-import.test.ts`, `dofusdex-mapping.test.ts`, `dofusdex-god.test.ts`.

**Comportement :** algorithme §4.4.2 ; chaînes `DOFUSDEX_*` ; succès conteneurs ; objectifs ;
donjons ; quêtes partagées ; aucun delete ; rapport ; audit ; RBAC.

**Tests :** 30/115/109/783, 0 non résolu ; idempotence ; une progression existante sur un
`dofusdbId` réutilisé survit ; un succès conteneur a `weight=0` ; aucun doublon de `dofusdbId` dans
un Dofus ; les 4 progressions hors module sont listées ; les donjons non résolus sont listés ; aucun
appel réseau DofusDB dans le rendu.

**DoD :** dry-run vert, apply local, God opérationnel, CI verte, aucune migration.

### L5 — Fiche Dofus à double vue (L, aucune migration)

**But :** maquette 2, avec la règle « pas de Rush si le Dofus n'est pas dans le Rush ».

**Fichiers :** `[dofusSlug]/page.tsx`, `DofusQuestManagerV3.tsx`, `DofusTimelineQuest.tsx`,
`DofusQuestBanner.tsx`, nouveau `DofusDexTrame.tsx`, `DofusGemCard.tsx`,
`src/lib/rush-dofus-coverage.ts`, tests.

**Comportement :**

- en-tête + un seul sélecteur ;
- onglet Rush conditionnel (couverture > 0) ; onglet DofusDex toujours présent ;
- séquences Rush filtrées par `questDbIds` ; prérequis intercalés ; « Ici »/« Peut aider » ;
- trame officielle : succès, objectifs, donjons, liens stockés ;
- pont `?block`/`?seq` vers le Rush (scroll + focus, personnage conservé) ;
- Ocre/Dolmanax/Dokille : cas explicites ;
- zéro appel DofusDB à l'exécution.

**Tests :** couverture (Cacao/Dokille/Dolmanax/Dokoko = 0 → pas d'onglet) ; un Dofus couvert affiche
seulement ses séquences ; le pont ouvre le bon bloc ; un donjon pointe vers la fiche interne ;
responsive 390/768/1 024/1 440 ; `da-wakfu`.

**DoD :** CI verte, contrôle visuel, aucune migration.

### L6 — Suivi entre membres / entraide (L, aucune migration)

**But :** maquette 3, une seule logique.

**Fichiers :** `GuildDofusOverview.tsx` (refonte ou remplacement), `DofusQuestHub.tsx` (onglet
`guilde`), nouveau `getGuildEntraideOverview` dans `dofus-quest-actions.ts` (ou un fichier dédié),
`DjPostCreateModal` (intégration), tests.

**Comportement :**

- une ligne par personnage (principal + mules) avec `ownerName`/`isMule` ;
- grille Dofus + drawer par étape ;
- `Ici` vs `Validée` ; présence live ;
- « Créer une sortie » via `DjPostCreateModal` mode `QUETE` (ou `GuildEvent` si planifiée) ;
- corrections `getGuildDofusStats` (obtenus, images, mules) ;
- RBAC, isolation guilde, cache/pagination, rate limit sur la création.

**Tests :** RBAC, isolation, mules, compteurs, drawer, sortie, responsive.

**DoD :** CI verte, contrôle visuel, aucune migration.

### L7 — Nettoyage Ganymède + migration (M, migration à valider)

**But :** suppression totale du code mort et des données Ganymède.

**Fichiers :** liste §4.6 ; migration additive/drop ; tests de non-régression.

**Comportement :**

- export/dump de `progression-complete` + archives ;
- suppression des données après validation ;
- suppression du code Ganymède-only et des assets/CSP/legal ;
- `git grep` de preuve ;
- conservation des modèles partagés et des faux positifs.

**Tests :** build, `git grep`, aucun import Ganymède, aucune référence `SubGuideData`/
`OptimizedGuideStep`, migration appliquée en local, CI verte.

**DoD :** accord explicite, backup, migration jouée, CI verte, doc à jour.

### Rappel — où en est le Rush (source : fiche unique)

| Phase | État | Reste |
|---|---|---|
| **1 — Cohérence de progression** | livrée **#1525** | — |
| **2 — Lisibilité** | close : #1531/#1532, #1536, #1539, #1540, #1542 | — |
| **3 — Données** | ⑭ bêta appliquée ; ⑫/⑬ positions ; ⑯ clos par mesure ; ⑰ acté | **⑮ 98 conseils Brâkmarien** (manuel), **⑱ séquence `test`**, prod |
| **4 — Ops / vérifs** | bêta : vérifier le dernier lot déployé (#1561–#1564) ; prod **standby** | V-C purge WebP, contrôle visuel, migrations/bot/crons |
| **5 — Perf / décisions** | E2 écarté, itérations 5/6 supprimées, **D-G1 cadré** (L6) | **T-6**, G7/G9, graphe ㉙, raccourcis ㉚, **batch succès** |

### Interleave — restes Rush et chantiers adjacents

Le plan **ne remplace pas** la fiche unique du Rush. Il la séquence :

| Reste Rush / adjacent | État | Interaction avec ce plan |
|---|---|---|
| Batch de validation des succès (perf) | à faire | après L1 (mêmes actions) ; ne pas mélanger |
| T-6 contextes → Zustand + profiler | à faire | indépendant ; après L1/L2 |
| Graphe des succès (㉙) | idée | indépendant ; après L5 |
| Raccourcis overlay + sélecteur de bloc (㉚) | idée | indépendant ; après L5 |
| 98 conseils Brâkmarien (⑮) | manuel mainteneur | aucune interaction |
| Séquence `test` (⑱) | à supprimer après accord | L0/L7 (données) |
| Positions sous-mondes / 6 positions / 894 | données bêta | L0 mesure, puis ops |
| Migrations `20270112000000`, `20270113000000`, `20270208000000` | bêta/prod | ops, pas dans L0–L6 |
| Bot Discord + 4 crontabs | ops | après deploy bêta |
| V-C purge WebP | ops | après validation archive |
| G7/G9 captures | cosmétique | après L2/L5 |
| Sentry lot B / 32/34 | suivi | après déploiement bêta |
| Class-watch Bellaphone (crons) | ops | indépendant |
| Perf web P2/P3 | plan séparé | ne pas absorber |
| Prod standby | décision 26/11 | aucune écriture prod |

**Hors périmètre explicite :** Tickets v2, rôles multi-sources, RAID, marché, onboarding, landing.
Ils ne sont pas absorbés par cette refonte.

---

## 6. Tests et verrous

### 6.1 Verrous existants à ne pas affaiblir

| Test | Ce qu'il protège |
|---|---|
| `tests/unit/rush-move-sequence.test.ts` | Action dédiée, cible même guide, refus `SEPARATEUR`/`INFO`, champs de route non réécrits. |
| `tests/unit/rush-bulk-actions.test.ts` | Actions de masse, bornes, appartenance au guide, transaction. |
| `tests/unit/rush-progression-coherence.test.ts` | Cascade prérequis, donjons cochés au bloc, reset. |
| `tests/unit/rush-dofus-progress-projection.test.ts` | Projection id → clés, `isCompleted` = toutes les séquences (à corriger avec L1). |
| `tests/unit/rush-import.test.ts` | Import additif, no-op au 2ᵉ passage. |
| `tests/unit/rush-content-sync.test.ts` | Tips God jamais écrasé. |
| `tests/unit/rush-split-blocks.test.ts` | Split : report de `completedSteps`. |
| `tests/unit/rush-delete-idempotent.test.ts` | Suppression idempotente, `guideId` dans le WHERE. |
| `tests/unit/da-wakfu.test.ts` | Tokens DA, pas de slop. |
| `tests/unit/product-docs-hygiene.test.ts` | Docs produit. |

### 6.2 Nouveaux tests à écrire

- **L1** : déplacement simple/masse/reorder → coche conservée pour 2 profils × 2 slots ;
  `isCompleted` recalculé ; `currentStep` déplacé ; donjons/ressources intacts.
- **L2** : aucun `ganymede`, aucun `tab=guide`, aucune archive listée, 2 cartes + bandeau Rush.
- **L3** : sync idempotent ; progression existante conservée ; entrée absente non supprimée ;
  renommage sans doublon ; rapport exact.
- **L4** : import DofusDex 30/115/109/783 ; idempotent ; progression réutilisée ; succès `weight=0` ;
  quête partagée non dupliquée ; donjons résolus ; God RBAC/audit.
- **L5** : couverture Rush conditionnelle ; pas de mention Rush à 0 ; pont `?block`/`?seq` ;
  donjon → fiche interne ; responsive.
- **L6** : RBAC/isolation ; mules ; compteurs ; drawer ; sortie ; responsive.
- **L7** : `git grep` sans Ganymède-only ; build ; migration locale.

### 6.3 Commandes de vérification (chaque lot)

```bash
npm run test:run
npx tsc --noEmit
npm run lint
npm run security:audit
git status --short
```

Pour les lots UI : captures 390 / 768 / 1 024 / 1 440 + contrôle `da-wakfu` ; pour les lots data :
dry-run + `--apply` local, puis bêta après accord.

---

## 7. Ops, migrations et déploiement

- **L0** : mesure bêta en lecture seule + dump. Aucune écriture.
- **L1/L2** : déploiement bêta après CI verte ; pas de migration ; vérifier manuellement un
  déplacement God sur un profil de test.
- **L3/L4** : dry-run local, puis bêta ; vérifier les compteurs et une progression existante ;
  aucune migration.
- **L5/L6** : bêta + contrôle visuel 390/768/1 024/1 440 ; vérifier la couverture Rush d'un Dofus
  non couvert (Cacao/Dokille/Dolmanax) et d'un Dofus couvert (Émeraude).
- **L7** : backup + export ; migration additive/drop après accord ; appliquer en local, puis bêta ;
  prod **standby** (aucune écriture prod dans ce chantier).
- **Ops VPS** : suivre `docs/agents/vps-ops.md` ; jamais `docker compose exec app-*` pour
  l'administration ; conteneur `ops-*`, dry-run avant `--apply`, preuve avant/après.
- **Rollback** : chaque lot UI est réversible par redéploiement ; les données ne sont pas supprimées
  avant L7 ; L7 conserve un export des lignes Ganymède/archives.

---

## 8. Décisions ouvertes

| # | Décision | Recommandation | Bloque |
|---|---|---|---|
| **D-OD1** | Rush : helper de migration sur déplacement (L1) ou table stable `(profil, perso, séquence)` tout de suite ? | **Helper d'abord** ; table seulement si God réorganise souvent. | L1 |
| **D-OD2** | Ganymède : archiver/export puis supprimer, ou laisser dormir en base ? | **Export + suppression** en L7, après L2. | L7 |
| **D-OD3** | Trame ISO : réutiliser `DofusQuestEntry` + chaînes `DOFUSDEX_*` (recommandé, zéro migration) ou nouvelle table ? | **Réutiliser** ; séparer seulement si le besoin d'édition dépasse le CRUD existant. | L4 |
| **D-OD4** | % Dofus : nouveau dénominateur ISO assumé (bandeau) ou ancien % conservé jusqu'à validation ? | **Nouveau dénominateur + bandeau** ; aucune coche perdue. | L5 |
| **D-OD5** | Sync Rush ↔ Dofus : Rush → Dofus en écriture + Dofus → Rush en lecture, ou bidirectionnel strict ? | **Rush → Dofus en écriture** ; Dofus → Rush en lecture, pour ne pas contourner les verrous Rush. | L5 |
| **D-OD6** | Sortie entraide : `DjSearchPost` mode `QUETE` ou `GuildEvent` ? | **`DjSearchPost` mode `QUETE`** (déjà supporté) ; `GuildEvent` seulement si planifiée. | L6 |
| **D-OD7** | 4 progressions officielles hors `DofusItem` (Dofawa, Kaliptus, Dotruche, Réunification) : ajouter ou masquer ? | **Masquer + documenter** ; les ajouter seulement si le produit les expose. | L4 |
| **D-OD8** | URL Rush : garder `/quetes-dofus/guide/rush-sylvestre` ou déplacer vers `/quetes-dofus/rush` ? | **Garder** + redirection si renommage. | L2 |
| **D-OD9** | Clé canonique : ajouter `DofusItem.dofusDbItemId` (migration additive) ou rester sur l'adaptateur JSON ? | **Adaptateur d'abord**, colonne en L3/L4 si le mapping doit être édité en God. | L3/L4 |
| **D-OD10** | Suppression des 23 lignes Ganymède/archives : export JSON, dump SQL, ou les deux ? | **Dump + export JSON** avant L7. | L7 |

---

## 9. Références

- Ordre global : `docs/ROADMAP.md` §2 sexies.
- Restes Rush : `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` « ⚡ Restes — fiche unique ».
- DofusDex officiel : `docs/reference/DOFUSDEX.md`.
- Prérequis de quêtes : `docs/reference/QUEST-PREREQUISITES.md`.
- Règles de code et sécurité : `docs/RULES.md`.
- Responsive : skill `.agents/skills/responsive/`.
- DA Gouache Wakfu : skill `.agents/skills/sigilos-da-wakfu/`.
- Ops VPS : `docs/agents/vps-ops.md`, `docs/agents/acces-lecture-seule.md`.
- Perf web : `docs/plans/PERF-WEB.md`.
- Changement de schéma : `docs/agents/prisma-schema-change.md`.

### Fichiers pivots (mesurés)

```
src/app/dashboard/[guildId]/quetes-dofus/page.tsx
src/app/dashboard/[guildId]/quetes-dofus/[dofusSlug]/page.tsx
src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/page.tsx
src/components/dofus-quests/DofusQuestHub.tsx
src/components/dofus-quests/DofusQuestManagerV3.tsx
src/components/dofus-quests/DofusTimelineQuest.tsx
src/components/dofus-quests/GuildDofusOverview.tsx
src/components/dofus-quests/DofusQuestBanner.tsx
src/components/dofus-quests/OptimizedGuideTab.tsx
src/server/actions/dofus-quest-actions.ts
src/server/actions/dofus-quest-admin-actions.ts
src/server/actions/optimized-guide-actions.ts
src/lib/rush-dofus-progress.ts
src/lib/rush-dofus-meta.ts
src/lib/dofus-quest-tree.ts
src/lib/dungeon-fiche.ts
prisma/schema.prisma
public/game-data/dofusdex.json
prisma/seed-data/dofus-quests/dofus-items.json
prisma/seed-data/dofus-quests/*-compiled.json
```

---

## 10. Journal de cadrage

| Date | Événement |
|---|---|
| 26/11/2026 | Cadrage complet après mesure locale (code + base) et lecture des 3 maquettes. Aucun code, aucune migration. Décisions `D-OD1` à `D-OD10` ouvertes. Prochain lot : **L0**, puis **L1**. |
| 26/11/2026 | **Correctif sous-blocs** (`fix/rush-child-save-2026-11-26`, `b6bcf902`) : éditeur isolé par bloc (`key`), remontée immédiate de la liste au studio (`onChildrenChange`), helpers `upsertRushChild`/`removeRushChild`. 13 tests ciblés, `tsc` 0, lint 0. |
| 26/11/2026 | **Lot Rush Live/UX** (`fix/rush-live-ux-2026-11-26`, `346095ce`) : présence par `surface` (dashboard/overlay) et `characterSlot`, registre des sockets actifs (plus de faux « a quitté le guide » à la fermeture de l'overlay), arrivées/départs « a ouvert/fermé l'overlay », suppression du mode discret, icônes de classe, regroupement par compte dans les fiches Dofus/donjons, monstres cliquables, favicons DofusNoobs/DofusDB en tête de fiche. |
| 26/11/2026 | **Images Ocre + options overlay** (`580f51ca`) : image résolue par `dofusdbId` en **espace entité** (le proxy vérifie l'identité), plus aucun repli construit depuis l'id Metamob (301 → un AUTRE monstre), rafraîchissement silencieux de la PiP ; menu « Quête Ocre » sans compteur, « Donjons X / X », reset de bloc aligné sur le reset complet (repère + fiche + ressources + donjons, rollback compris). |
