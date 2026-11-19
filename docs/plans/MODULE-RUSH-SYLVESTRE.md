---
description: Module Rush Sylvestre — agrégateur (carte des fichiers + chantiers A→H) ; pointe vers les plans durables, ne les duplique pas
---

# 🏹 Module Rush Sylvestre — agrégateur

> **Rôle unique.** Index du module : **où sont les fichiers**, **quelles décisions sont actées**,
> **quels pièges sont mesurés**. L'**ordre** vit dans `docs/ROADMAP.md` (§3 bis, file Rush + visiteur) :
> ce fichier ne le duplique pas.
> Il **ne duplique rien** : chaque chantier renvoie à son **plan durable** (règle `AGENTS.md` §4.3).
>
> **Sources de vérité (contenu)**
> - Refonte rush (ergonomie, visuel, éditeur God, perf) → **chantier T** : `docs/plans/PLAN-REFONTE-RUSH-SYLVESTRE.md`
> - Alignement Bonta/Brâkmar + Ordres → `docs/plans/ARCHITECTURE-ALIGNEMENT-RUSH-SYLVESTRE.md` + `docs/plans/MAPPING-RUSH-SYLVESTRE.md`
> - **Ordre d'exécution** (jamais dupliqué ici) → `docs/ROADMAP.md` §3 bis
> - Backlog + ordre → `docs/ROADMAP.md` ; blocs de session → `docs/agents/journal-sessions-2026.md`
>
> **Dernière MAJ : 12/11/2026.**

## 0 bis. Décisions actées (12/11/2026 — ne pas les re-débattre)

| Sujet | Décision |
|---|---|
| Reset de progression au changement de cité/Ordre | **automatique** (lot 3) : `alignmentChangeReset` + `resetProgressOnAlignmentChange` avant l'écriture, annonce `cleared` |
| Texte différent selon le camp | **une seule quête, deux textes** (lot 4) : colonne `routeVariants`, résolue par `resolveRushRoute` |
| Numérotation des blocs | **une seule table** `rushChapterNumbers` (bandeaux exclus) : guide membre, guide public, overlay |
| Navigation des guides | **une page = un bloc**, sommaire plat des blocs, mode « Tout » **supprimé** |
| E2a-reste (découper les 3 formulaires) | **abandonné** : les verrous lisent le dossier, invisible pour l'utilisateur |
| API Tougli | **jamais d'appel à l'exécution** (usage : veille / import ponctuel) |

## 0 ter. Pièges mesurés

- **PR grosse** : un correctif urgent part en PR séparée, jamais empilé.
- **Flaky** `lot4-slash-commands-api-keys` (timeout 5 s) : fait rougir la suite une fois sur deux.
- **Quête de classe oubliée** : visible par les 19 classes ; le contrôle « Problèmes » la signale (mot entier).
- **Rail de droite** : progression, donjons et objets sont calculés sur le **bloc** affiché, pas le chapitre.
- **`prisma migrate dev`** : exige un reset de la base locale (dérive `add_inter_guild`) ⇒ écrire la migration additive à la main puis `migrate deploy`.
- **Migration** : jamais sans GO explicite ; `routeVariants` (lot 4) est jouée en local, **à jouer en bêta puis en prod**.

## 0. Gouvernance (3 niveaux)

| Rôle | Fichier |
|---|---|
| L'ORDRE (« la prochaine chose ? ») | `docs/ROADMAP.md` |
| Le backlog + l'ordre | `docs/ROADMAP.md` |
| Les blocs de session (historique) | `docs/agents/journal-sessions-2026.md` |
| Le contenu durable par sujet | `docs/plans/*.md` (ce fichier + les plans cités) |

Règle d'or : **1 étape = 1 lot = 1 branche = 1 PR → `dev`**.

## 1. Carte des fichiers du module

### 1.1 Routes / pages
| Fichier | Rôle |
|---|---|
| `src/app/guides/rush-sylvestre/page.tsx` + `_components/PublicRushGuideClient.tsx` | Guide public (ISR, `noindex` tant que « Mode Construction ») |
| `src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx` | Guide interne (membres) |
| `src/app/overlay/guide/[guildId]/[slug]/page.tsx` + `GuideOverlayClient.tsx` | Overlay PiP (interne + invité) |
| `src/app/god/rush-sylvestre/page.tsx` + `RushSylvestreAdminClient.tsx` | Studio God (édition du guide) |
| `src/app/api/rush/leave/route.ts` | Sortie de présence overlay |
| `src/app/dashboard/[guildId]/_components/rush-overlay-host.tsx` | Hôte du PiP |

### 1.2 Composants overlay (`src/app/overlay/guide/[guildId]/[slug]/components/`)
`overlay-utils.ts` (agrégation) · `RushOverlayChapterBar` · `RushOverlayDungeonCard` · `RushOverlayDungeonPopover` · `RushOverlayFeedbackPanel` · `RushOverlayFooter` · `RushOverlayHeader` · `RushOverlayMemberBubbles` · `RushOverlayMembersModal` · `RushOverlayOcreModal` · `RushOverlayQuestDetailModal` · `RushOverlayQuestListItem` · `RushOverlayResourcesModal` · `RushOverlaySearch` · `RushOverlayTagSection` · `RushOverlayTutorialModal`

### 1.3 Composants rush (`src/components/dofus-quests/`)
`RushOnboardingWizardModal.tsx` · `rush/GuestCharacterModal` · `rush/MilestoneCelebration` · `rush/NpcBadge` · `rush/QuestItemResourceGrid` · `rush/RushActionMenu` · `rush/RushBlockMetaEditor` · `rush/RushChapterSidebar` (bandeau « Objets requis ») · `rush/RushCoordinateChip` · `rush/RushInfoBanner` · `rush/RushInfoSequenceBanner` · `rush/RushOverlayLiveToast` · `rush/RushPenseBeteModal` · `rush/RushProgress` · `rush/RushRichText` · `rush/RushSeparatorBanner` · `rush/RushTagBadge`

### 1.4 Composants liés
`ResourceImage` · `OcreProgressModal` · `DofusOcreMetamob` · `AlignmentModal` · `components/ocre/*` (dashboard ocre, `not-linked-state`, `OcreTargetBits`, panneau pierres) · `components/profile/metamob-link.tsx` · `hooks/use-ocre-write-queue`

> ✅ **Code mort retiré (27/10/2026)** : `dashboard/[guildId]/quetes-dofus/guide/[slug]/DofusProgressStrip.tsx`
> n'était monté nulle part (0 import) — il est **supprimé**. Le bandeau réellement affiché est `GuildStatusPanel.tsx`
> (modale par Dofus depuis le 26/10), et c'est **lui** que le verrou T2 garde désormais (bouton + `aria-label`,
> titre/description de la modale, geste de filtre) — il ne gardait auparavant qu'un composant mort.

### 1.5 Libs (`src/lib`)
`rush-guide-utils.ts` (`resolveItemImage`, `rushResourceKey`, `isSequenceBlockedByPrereqs`, `getAlignmentSet`, `collectCascadeUncheck`…) · `rush-guide-view.ts` (`buildRushGuideView`, `computeRushAlignment`) · `rush-choice-groups.ts` (`getChoiceGroup`, `stepCounts`, `applyChoiceExclusivity` — étape à variantes exclusives) · `rush-resources-preheat.ts` (pur, client-safe) · `rush-import.ts` (`planRushImport`, `safeRushGuideLink`, `boundQuestDbIds` via `rush-quest-identity`) · `rush-dofus-meta.ts` · `rush-rich-meta.ts` · `rush-ui-config.ts` · `guest-progress.ts` · `dofus-asset-siphon.ts` (`siphonAndCompressImage`, `siphonItemIconsBatchCore`) · `dofusdb-limiter.ts` / `dofusdb-throttle.ts` · `ocre-soul-stones.ts` · `ocre-write-queue.ts` · `metamob-client.ts` · `class-spells-siphon.ts`

### 1.6 Actions serveur
`optimized-guide-actions.ts` (lecture du guide, coches de ressources, reset d'alignement) · `asset-siphon-actions.ts` (pré-chauffage) · `ocre-actions.ts` (liaison Metamob, progression) · `rush-actions.ts` · `game-data-admin-actions.ts` · `game-data-sync-actions.ts`

### 1.7 Store / types / données
`src/store/rush-overlay-store.ts` · `src/types/rush-guide-types.ts` · `src/data/rush-sylvestre-guide.json` (**96 blocs / 335 séquences / 568 tags `item` / 391 ids uniques**) · `src/data/rush-sylvestre-guide.enriched.json` (374 quêtes) · `src/data/rush-sylvestre-pense-bete.ts`

### 1.8 Scripts
`scripts/correlate-rush-guides.mjs` (Tougli ∪ Dofusyelle ∪ NOOBS — **rapport dry-run**) · `enrich-rush-guide-items.mjs` · `seed-rush-sylvestre-cli.mjs` · `seed-rush-sylvestre-enriched-cli.mjs` · `inspect-rush-sylvestre-guide.mjs` · `prune-rush-guide-orphans.mjs` · `dofus-asset-siphoner.ts` · `siphon-guide-images.ts` · `build-rush-trame-seed.ts` (**Touglie enrichi**, `--enrich-yelle`) · `archive-rush-guide.mjs` (**archivage/remplacement** local + VPS)

### 1.9 Tests (**49** fichiers `tests/unit/rush-*.test.ts`)

Le détail suit le préfixe `rush-*` (`Get-ChildItem tests/unit -Filter 'rush-*.test.ts'`). **Ajoutés le 26/10/2026** : `rush-quest-identity` (identité de quête + borne des `questDbIds`), `rush-order-codes` (référentiel des 6 Ordres),
`rush-import` (plan de dry-run + verrou « l'import n'efface rien »), `rush-dofus-accent` (contraste 4,5:1 des 24 accents + accessibilité du filtre), `rush-dofus-progress` (progression d'un membre **quête par quête** dans la modale par Dofus).

## 1 bis. État mesuré le 02/11/2026 (soir) — la route, surface par surface

> Mesuré sur la **base locale** (5433, lecture seule) + le code. À re-vérifier en bêta avant conclusion.

### 1 bis.1 Ce que chaque surface applique

| Surface | Cité | Ordre | Classe |
|---|---|---|---|
| Dashboard interne | ✅ camp du **personnage sélectionné** (`page.tsx:175-180`) | ❌ **jamais passée** à `resolveRushRoute` | ✅ `resolveDofusClassId` (mule incluse) |
| Guide public | ✅ sélecteur local (`sigilos_rush_route_<slug>`) | ❌ | ❌ **déclarée mais non passée** (19 quêtes de classe visibles) |
| Overlay | ❌ **aucune route** (jalons bruts, `page.tsx:116`) | ❌ | ❌ mule → `classe: null` |

Conséquence mesurée : **15** quêtes d'Ordre affichées au lieu de **5** (interne/public), **30** dans l'overlay.

### 1 bis.2 Données en base (guide `rush-sylvestre`, 492 séquences)

| Mesure | Valeur |
|---|---|
| `alignReq` | **236** : 100 cité bontarienne + 15 Ordres Bonta · 106 cité brâkmarienne + 15 Ordres Brâkmar |
| Quêtes d'Ordre | **30** = 6 × 5, paliers **20/40/60/80/100**, **0 `prereq_text`** |
| Quêtes de classe | **19** dans **1** bloc, `classReq` = 19 ids, un `order` 0…18 chacun |
| `alignment_set` | **67** seulement (66 bontariens + 1 mal tagué), écrits `{type, camp, level: 1}` |

### 1 bis.3 Défauts mesurés (chacun est un correctif, pas une opinion)

1. **Deux vocabulaires `alignment_set`** : l'import écrit `camp`, le studio écrit `name`
   (`RushSylvestreAdminClient.tsx:2703-2710`). `getAlignmentSet` exige `name`
   (`rush-guide-utils.ts:289`) ⇒ **null sur les 67 lignes réelles** ⇒ bandeau « Alignement » public et
   badge par quête **jamais rendus**, `applyRushAlignmentFromSequence` **no-op**
   (`optimized-guide-actions.ts:1746,1782`). Les tests sont verts car leurs fixtures utilisent `name`.
2. **`level` toujours `1`** sur les lignes importées : le palier réel est `alignmentCountForCamp`.
3. **Reset d'alignement incomplet** : `resetAlignmentQuests` (`rush-alignment.ts:76`) retire les
   `alignment_set` + cascade ⇒ **67 racines sur 236**. Le reset doit porter sur **`alignReq` (l'ancienne cité)**.
4. **Chaîne d'Ordre absente** : 0 prérequis sur les 30 quêtes ⇒ à 100 quêtes de cité, le rang 5 se coche
   sans les rangs 1→4.
5. **Compteur gonflé** : `alignmentCountForCamp` compte aussi les quêtes d'Ordre (elles portent `alignReq`).
6. **Ordre jamais filtré** ⇒ 15 quêtes au lieu de 5 ; overlay : les **deux** cités + les **6** Ordres.
7. **Prop morte** : `hasNoClassDeclared` n'est jamais passée (`RushTimelineClient.tsx:2556`).

> **Livrés le 02/11/2026 (L1)** : défauts **1**, **2**, **3** et **5** — source `camp`/`name`,
> palier calculé (`alignmentCountForCamp`, hors Ordres), reset par cité (`alignmentResetSeeds`),
> compteur corrigé. **Livrés le 02/11/2026 (L2)** : défauts **4** (chaîne des rangs
> `previousOrderRank` : le rang N exige N−1) et **6** (l'Ordre entre dans la route du dashboard
> **et** de l'overlay autonome). **Livré le 02/11/2026 (L3)** : défaut **7** — `hasNoClassDeclared`
> est calculé pour le personnage sélectionné (mule comprise) et affiché dans la modale d'accueil,
> qui passe en DA « Carnet ».

### 1 bis.4 Outillage God manquant (gestes attendus, sans migration)

| # | Geste | Pourquoi |
|---|---|---|
| **G1** | Barre **« Route » du bloc** : Cité / Ordre / Palier + « Appliquer au bloc » (+ effacer), compteur de quêtes | aujourd'hui c'est **quête par quête** (236 fois) |
| **G2** | **Classe = liste fermée** (l'`<input>` libre devient un `<select>` des 19 ids + tableau 19 lignes) | une faute de frappe ⇒ quête **invisible** (fail-closed) |
| **G3** | **Aperçu de route** (Cité / Ordre / Classe) qui passe par `resolveRushRoute` | voir ce que verra le joueur, sans publier |
| **G4** | **Branches à 3 étages** (cité → Ordre → classe) + manques nommés | contrôle qualité de la saisie |

### 1 bis.5 Ordre des lots Rush (le détail des fichiers est dans le plan du lot)

`G0` (outillage God G1→G4), `L1` (source d'alignement), `L2` (route cité→Ordre→classe sur
interne + overlay, chaîne des rangs, changement d'Ordre) et `L3` (modale d'accueil en DA « Carnet »,
classe manquante dite et cliquable) sont **livrés** → **`textes`** (tips par quête) : **livré le
03/11/2026** pour les références `&n` (**74** champs corrigés, dataset + base, garde d'écriture) et
la **corrélation Dofusyelle** (**5** conseils écrits, **18** références Ali/Ordre listées) ; **25
conseils de plus le 04/11/2026** — les contraintes Tougli sont désormais rattachées **par
`questDbIds`**, donc les séquences importées depuis God (Brâkmarien) sont atteignables. Reste
**194** conseils (98 Brâkmarien sans aucune source, 42 Bontarien, 54 hors route). Le **public
authentifié** et l'annuaire par serveur sont un chantier distinct : `docs/plans/PLAN-ESPACE-VISITEUR.md`
(la modale publique, elle, attend ce compte visiteur : **migration ⇒ accord**).

> **Livrés le 02/11/2026** : G0 (`feat/rush-route-tooling`), L1 (`feat/rush-alignment-l1`),
> L2 (`feat/rush-route-l2`) et L3 (`feat/rush-onboarding-l3`). Preuves : `rush-route-tooling` **19**
> · `rush-class-branches` **10** · `rush-alignment-source` **15** · `rush-order-chain` **17**
> · `rush-order-reset` **8** · `rush-onboarding-carnet` **14** · Rush **60 fichiers / 742 tests ✓**.
> **Aucune migration.** **`textes` livré le 03/11/2026** : `resolveQuestRefs` + script ciblé
> (**74** champs, **0** `&n` restant), garde `upsertRushSequence`, siphon Dofusyelle (pas d'API)
> et corrélation par nom (**5** conseils ; **18** références Ali/Ordre listées, non appliquées).
> **`textes` complété le 04/11/2026** : rattachement des contraintes Tougli **par `questDbIds`**
> (`NoteTarget.questIds`), cibles calculées **aussi** depuis la base ⇒ **25 conseils** écrits
> (19 Brâkmarien + 6 Bontarien, 28 contraintes), **2ᵉ passage = 0 écriture**.
> **Reste** : **194** conseils — **98 Brâkmarien** (aucune source : Tougli n'a aucun texte de quête,
> Dofusyelle ne couvre que Bonta), **42 Bontarien**, **54 hors route** ;
> **18** références « Ali N »/« Ordre N » à trancher pour appliquer les notes de donjon Dofusyelle.
>
> **L2, ce qui a changé concrètement** : l'Ordre du personnage sélectionné entre dans la route
> (5 quêtes d'Ordre au lieu de 15) ; l'overlay autonome `/overlay/guide/...` calcule enfin sa route
> (cité + Ordre + classe, classe de mule lue dans `altPseudos`) ; la chaîne des rangs est
> **calculée** (`previousOrderRank`, palier immédiatement inférieur, même cité + même Ordre) et non
> saisie — les 30 quêtes d'Ordre n'ont aucun `prereq_text` ; changer d'Ordre décoche les **5**
> quêtes de l'ancien Ordre (`orderResetSeeds`, sans cascade) via `resetRushOrderProgress`
> (auth + rate limit Redis + cité/Ordre relus en base).
>
> **L3, ce qui a changé concrètement** (PR #1228, puis #1229/#1230) : la modale d'accueil passe en
> DA « Carnet » ; `hasNoClassDeclared` est calculé pour le personnage **sélectionné** (mule comprise)
> et affiché avec un lien vers le profil ; **trois étapes** seulement (la page « membres » est
> supprimée) ; **plus de bloc « Métiers requis »** (ni `getGuideMetiersRequires`, ni `metierIds`, ni
> `updateUserProfile`) ; les boutons `Précédent / Suivant / Lancer` vivent **dans le contenu de chaque
> étape** (un `<footer>` séparé ne se rendait pas), avec croix + Échap + clic sur le fond ; la hauteur
> suit le contenu, plafonnée à l'écran ; le changement de personnage reprend le parcours à l'étape 2.

## 2. Chantiers du module

> Format : **BESOIN → ÉTAT MESURÉ → CHANGEMENT → TESTS → DÉPENDANCES → STATUT**.
> L'**ordre** vit dans `docs/ROADMAP.md` ; ici, le **quoi**.

### T — Refonte rush (plan durable : `PLAN-REFONTE-RUSH-SYLVESTRE.md`)
- **Éditeur God** : la refonte UI/UX du studio a son plan dédié — `docs/plans/REFONTE-EDITEUR-RUSH.md` (E1→E5).
- **Reste** : **lot 4** — **O14** (contraste ✓ le 26/10 ; reste l'application générale des accents) et **T2** (**bandeau réel** `GuildStatusPanel` ✓ ; verrou repointé le 27/10 après suppression de `DofusProgressStrip`) faits · **DA « Carnet de campagne » livrée le 02/11** (matières, en-tête, chapitre, cartes, fiches, bandeaux, alignement, filtre Toutes/En cours/Verrouillées, ressources à prévoir, footer et portails ; verrou `rush-da-grimoire` **23**), **O15** et **G8** sont livrés le 12/11 (T-4a) ; restent **G7** hero complet et la composition **G9** (**à arbitrer**) · lot 5 overlay avancé (O9, O10, O11, O12, O13) · lot 6 perf (G6 + `useOptimistic`) · transverses (O5, O6, O7, G2, G5, T1, T5) + les 4 `prompt()` / `confirm()` du studio.
- **Statut** : T-1 / T-2 / T-2b / T-3 livrés (PR #851 / #853 / #856 / #857) · **T-4 partiel** le 26/10/2026 (O14 + T2, PR #1136) · **T2 consolidé** le 27/10/2026 (composant mort supprimé, verrou sur le code rendu) · **T-2c livré le 20/10/2026** (prérequis par id stable — il était encore listé en reste ici par erreur).

### U — Zéro dépendance DofusDB (cadré, aucun lot commencé)
- **Lots** : U-1 inventaire / ratchet · U-2 réécrire les `img` des `*-compiled.json` · **U-3 plus de repli réseau** · U-4 recherches sur catalogue local · U-5 ops (health / crons / allowlist).
- **Statut** : cadrage dans `docs/ROADMAP.md` §1 (pas encore de plan dédié).

### A — Une seule agrégation des ressources (toutes les surfaces)
- **Besoin** : liste et compteurs de ressources **identiques** partout (overlay, dashboard, guide public, sidebar « Objets requis », modale, grilles de quête).
- **État mesuré (10/10/2026)** : **deux** agrégations concurrentes — `RushChapterSidebar` (clé `nom` seul, `quantity||count`, phrases `kind:"instruction"` comptées → **391 lignes**) vs `aggregateRushResources` (clé `rushResourceKey` = `id+nom`, `count??quantity` + exclusions → **392**).
- **Les 2 cas, TRANCHÉS le 10/10/2026 (mesure à la source, DofusDB en lecture seule)** :
  - « Reflet onirique » → `/items/22058` renvoie l'**item de repli `id 666`** (« Purée pique-fêle ») : id **invalide** ; le vrai objet est **`32079`** (type 219 « Ressource des Songes », `iconId` 164149). La fusion par nom **cachait** l'id fautif et affichait son icône ;
  - id `9687` → = « **Moyenne pierre d'âme** » : le tag nommé « Moyenne pierre d'âme **parfaite** » est un **nom/id désapparié**.
  - ⇒ **Décision** : c'est la clé **canonique** (`id+nom`) qui a raison — les 2 écarts sont des **défauts de DONNÉES**, à corriger en **V-B** ; le +1 (391 → 392) disparaîtra alors de lui-même (22058 → 32079 fusionne en une ligne).
- **Livré le 10/10/2026** (branche `feat/rush-v-a-agregation-unique`) : l'agrégation locale du rail est **supprimée**, il appelle `aggregateRushResources(currentMilestones)` / `(…, completedSeqIds)` — l'icône suit l'id de **sa** ligne, la clé React est la clé canonique (les 6 surfaces partagent donc la même liste et les mêmes compteurs).
- **Tests** : parité **de comportement** (rendu du rail = sortie de la source unique, 5 cas dans `rush-resource-checks`) + verrou de source (import + absence de clé « nom seul ») dans `rush-public-parity`. **Preuves** : 317 fichiers / 3 444 tests ✓ · `tsc` 0 · `lint` 0 erreur.
- **Dépendances** : — · **Statut** : **livré le 10/10/2026**.

### B — Ids invalides / noms ≠ icônes
- **État mesuré** : `GET /items/7809` et `/items/7807` → **item de repli `id 666`** ; `name.fr` « Dragodinde Rousse Sauvage » → `total: 0` (montures ≠ items). WebP `{id}.webp` gravé via le **chemin deviné** = icône d'un **autre** objet, servie `immutable` 1 an.
- **Mesuré le 10/10/2026** (au passage du lot **V-A**) : `22058` « Reflet onirique » → **repli `666`** (le vrai objet est `32079`, type 219 « Ressource des Songes », `iconId` 164149) et `9687` porté par le nom « Moyenne pierre d'âme **parfaite** » (`9687` = « Moyenne pierre d'âme ») — ce sont **les 2 écarts de comptage** du rail (391 vs 392), à corriger **ici** (le +1 disparaîtra alors de lui-même).
- **Balayage complet du guide (10/10/2026)** : les **391** ids uniques passés aux fiches groupées (`items?id[$in][]=`, 50/req, **garde d'identité** : seuls les ids demandés sont retenus) puis **une requête par image réellement donnée par l'API** ⇒ **5 ids que DofusDB ne sert pas** (repli `666`), **0 image en échec**, **1 nom divergent** (`33380`) ; `10000000001` « Kamas » est un id **synthétique** porté par **38** tags ; les 3 dragodindes sauvages sont absentes **et** de `/items` **et** de `/mounts`.
- **Livré le 10/10/2026 (lot V-B)** :
  - `22058` → **`32079`** : corrigé dans la **source de seed** (`src/data/rush-sylvestre-guide.json`) **et** en base par un correctif **ciblé** (un tag, une séquence — **jamais** de re-seed, qui écraserait les éditions du studio God) : `scripts/fix-rush-guide-item-ids.mjs` (**dry-run par défaut**, `--apply` pour écrire) ;
  - **Kamas** (id synthétique `10000000001`) : **aucune donnée touchée** — l'icône locale est posée au bon endroit du cache (`items/10000000001.webp`, WebP 44×44) ⇒ `resolveItemImage` la sert partout, y compris après un déploiement (volume `assets-*-data`) ;
  - **3 montures sauvages** (`7807` / `7809` / `7864`) : icônes fournies par le propriétaire (Duffus) et installées en `items/{id}.webp` (128×128, WebP q85). ⚠️ Duffus est **hors allowlist** du siphon ⇒ **aucun auto-heal** : ces fichiers vivent **hors git**, à copier dans le volume du VPS — `docker cp ./items/. sigilos-prod:/app/public/uploads/assets-dofus/items/` puis `docker exec sigilos-prod chown -R nextjs:nodejs /app/public/uploads/assets-dofus/items` (idem `sigilos-beta`).
  - **Pourquoi ces icônes disparaissaient à chaque déploiement** (trouvé en préparant le VPS) : `scripts/migrate-uploads.mjs`, joué **à chaque deploy** (étape 4/5), déplaçait **tout** `public/uploads/**` vers `private_uploads/**` — **y compris** `assets-dofus` (le cache siphonné, servi en statique via `getLocalAssetUrl`) et `proxy-cache`, alors que le volume `assets-*-data` existe **précisément** pour le préserver : le cache repartait de zéro et les icônes revenaient une par une. Corrigé par `KEEP_IN_PUBLIC = {assets-dofus, proxy-cache}` (ces dossiers ne sont **jamais** descendus), annoncé dans la sortie du déploiement (`🔒 N dossier(s) de cache conservé(s) en public`), **prouvé en bac à sable** (`proofs/` part bien en privé, les 2 caches restent) + garde `tests/unit/deploy-sortie-visible.test.ts` ⑦.
- **Correctif de données sur le VPS** (le script Node **n'y tourne pas** : l'image *standalone* est amputée de `@prisma/driver-adapter-utils` ⇒ `ERR_MODULE_NOT_FOUND`, mesuré le 10/10/2026 — esbuild **bundle** les seeds, d'où leur immunité). Le **même** correctif, en **SQL**, dans le conteneur de base (`sigilos-db-beta`, puis `sigilos-db-prod`) :

```sql
-- contrôle : `reste_22058` doit finir à 0
SELECT count(*) FILTER (WHERE "activityTags" @> '[{"id": 22058}]'::jsonb) AS reste_22058 FROM "GuideSequence";

UPDATE "GuideSequence" s
SET "activityTags" = (
  SELECT jsonb_agg(CASE WHEN t->>'id' = '22058' THEN jsonb_set(t, '{id}', '32079'::jsonb) ELSE t END ORDER BY ord)
  FROM jsonb_array_elements(s."activityTags") WITH ORDINALITY AS e(t, ord)
)
WHERE s."activityTags" @> '[{"id": 22058}]'::jsonb;
```

```bash
docker exec -i sigilos-db-beta sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -' < fix-rush-22058.sql
```

- **Patchs SQL des conseils (03/11/2026)** — les trois correctifs de texte ont une option `--sql` qui imprime un patch **portable** (cible le **contenu** ou le **nom**, jamais le cuid, qui diffère entre local, bêta et prod) :
  - `npx tsx scripts/fix-rush-guide-quest-refs.ts --sql` → références `&n` (40 `UPDATE` par contenu) ;
  - `npx tsx scripts/correlate-dofusyelle-tips.ts --sql` → 5 conseils Dofusyelle (par nom, protégés par `tips = ''`) ;
  - `npx tsx scripts/correlate-rush-notes.ts --sql` → contraintes Tougli.
  L'échappement est **une seule règle** (`sqlLiteral`, `src/lib/rush-notes.ts`, testée). `--apply` et `--sql` sont exclusifs : on relit le patch avant de le jouer. Sortie redirigeable puis `psql` dans `sigilos-db-beta`, puis `sigilos-db-prod`.

- **Ops (humain) — état au 10/10/2026** :
  - **Bêta : FAIT** — les 4 WebP sont en place (`items/{7807,7809,7864,10000000001}.webp`, propriété rendue à l'app par `docker exec -u root … chown nextjs:nodejs`) et la base est corrigée (`reste_22058` **1 → 0**, `avec_32079` = 2).
  - **Reste bêta** : merger le lot puis **déployer** (c'est le deploy qui active le correctif `migrate-uploads`) → **ensuite** pré-chauffer les **319** icônes (bouton God) → contrôle visuel de la modale « Ressources à prévoir ».
  - 🅿️ **Prod : RIEN À FAIRE aujourd'hui** (mesuré le 10/10) : le guide n'y est **pas seedé** (`22058` = 0, `32079` = 0) et le volume d'assets est **vide** (`/app/public/uploads/assets-dofus/items` n'existe pas ⇒ la copie échoue ; il faut `mkdir -p` d'abord). Au moment du déploiement prod : ① **aucun SQL** — le correctif est dans la **source de seed**, le futur seed prod naîtra bon ; ② `docker exec -u root sigilos-prod mkdir -p /app/public/uploads/assets-dofus/items`, copie des 4 WebP (hors git) puis `chown nextjs:nodejs` ; ③ pré-chauffage des 319.
- **Reste (données)** : trancher le nom de `33380` · les **~21 000** objets hors guide relèvent du chantier **U**.
- **Tests** : `tests/unit/rush-guide-item-ids.test.ts` (garde de **données**, sans réseau : l'id fautif ne revient pas, le bon est présent) + parité du rail (`rush-resource-checks`, `rush-public-parity`).
- **Dépendances** : — · **Statut** : **livré le 10/10/2026** (les 5 cas mesurés traités ; le balayage du guide ne laisse qu'une décision de **nom**).

### C — Purge des WebP corrompus + siphon « jamais deviné » (rattaché U-3)
- **État mesuré** : `siphonAndCompressImage` conserve `allowGuessedPath` par défaut `true` pour items / monstres (dette **U-3** déjà notée au `ROADMAP`).
- **Changement** : interdire le chemin deviné pour les **objets**, purger les `items/{id}.webp` dont l'id est invalide / mismatch (script de repérage), re-pré-chauffer avec `allowGuessedPath:false`.
- **Dépendances** : **B** · **Statut** : **à faire** · **Ops** : purge à exécuter côté serveur (volumes `assets-*-data`).

### D — Couverture des ressources du guide (390 → 485 livrés ; cible par quête 517)
- **État mesuré le 04/11/2026** : **390** ids uniques dans le guide · **Tougli** 517 ids directs · **Dofusyelle** 472 ids (531 lignes) · **union 584**.
  ⚠️ **584 n'est pas atteignable par quête** : Dofusyelle liste ses ressources **globalement** (nom + quantité, sans id ni quête) ⇒ **67** ids n'existent que là. La cible honnête, par quête, est **517** (Tougli).
- **Livré le 04/11/2026 (`V-D1`, branche `feat/rush-ressources`)** : règle pure `src/lib/rush-resource-tags.ts` (`mergeItemTags` : ajoute les ids absents, ne réécrit ni ne supprime, nom **canonique** réutilisé) + `scripts/enrich-rush-guide-resources.ts` (appariement `questDbIds` → URL → nom, dry-run, `--apply --db`, `--sql` additif) ⇒ **81 séquences**, **252 tags**, **173 ids** dont **95 nouveaux** : **390 → 485**. Brâkmarien **1 → 151 ids**, **65** séquences avec objets. **2ᵉ passage = 0 écriture** ; dataset **inchangé** (ces séquences ne sont pas dans le seed) ; **aucune migration**.
  **Jamais de re-seed** (il écraserait les éditions God) : le script, idempotent, fait foi — le rejouer sur la bêta (`--sql`), puis pré-chauffer les **95** icônes nouvelles.
- **Défaut mesuré et corrigé le 04/11/2026** : la trame Tougli a poussé l'id **7696** (« Dragofesse en Cuir Violet de Bwork ») que DofusDB **ne connaît pas** (elle renvoie l'item de repli **666**) et qui est absent de `GameItem` ⇒ **garde catalogue** dans le script (un id inconnu n'est jamais écrit) + retrait ciblé (`--drop-ids 7696`, appliqué en local et sur la bêta). Sur les **485** ids du guide, **2** sont absents du catalogue : **7696** (fautif) et **10000000001** (Kamas, icône locale, whitelisté).
- **Reste (`V-D2`, à trancher)** : **51** ids Tougli dont la quête est absente de notre base (530 quêtes Tougli vs 492 séquences) + **67** ids Dofusyelle par étape — **chiffres de l'ancien guide 492** : à re-mesurer sur le guide **536** avant de trancher. `preparation.items` (391 noms, sans id, non lu par l'UI) n'est pas reconstruit.
- **Dépendances** : **B** (livré) · **Statut** : **V-D1 livré**, V-D2 ouvert.

### E — Vérifications + docs
- `npm run test:run` · `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm run security:audit`, puis `docs/ROADMAP.md` (bloc de session) + `docs/agents/activeContext.md` (bloc en haut).

### F — Route d'alignement Bonta / Brâkmar + Ordres (plan durable : `ARCHITECTURE-ALIGNEMENT-RUSH-SYLVESTRE.md`)
- **Décisions verrouillées (10/10/2026)** :
  - **un seul** guide `rush-sylvestre`, branché par **données** (`alignReq` = cité, `alignOrderReq` = ordre, `alignLevelReq` = seuil) — **jamais deux guides** ;
  - **Ordre** choisi à la **1ʳᵉ quête d'Ordre (seuil 20)** ; rangs **20 / 40 / 60 / 80 / 100** ;
  - **changement de cité = logique jeu** : **reset** de l'alignement (+ `alignmentBefore`) et **retour à la 1ʳᵉ quête** de la nouvelle cité ; quêtes communes conservées ;
  - **résolution** : `resolveRushRoute` **filtre**, puis `buildRushGuideView` / `isSequenceBlockedByPrereqs` / `aggregateRushResources` **calculent sur le set filtré** (un prérequis masqué ne bloque pas) ;
  - **God** : marquage par séquence + action de masse par bloc + vue « Branches » + « créer la jumelle » (miroir par slot).
- **État mesuré** : nos 66 tags `alignment_set` sont **tous `bontarien`** · `alignReq` / `alignOrderReq` **null** partout · **100 quêtes de cité côté Bonta** (source, dont 66 portées par notre seed) · **102 côté Brâkmar** · **6 ordres × 5 rangs** · 19 variantes de classe (1 substitution à Astrub).
- **Dépendances** : **D** (même import NOOBS / Tougli) · **Statut** : **à faire**.

### F2 — Arbre d'alignement à DEUX étages (état mesuré et livré le 20/10/2026)

> **Révision de la section F** : la structure réelle a été vérifiée aux sources (DPLN + API Tougli).
> Elle est plus riche que « deux colonnes » : **cité**, puis **Ordre**.

**Structure réelle (mesurée)**
- **2 séries de quêtes de cité**, **100** côté Bontarien (100ᵉ = « L'exorciste ») et **102** côté Brâkmarien (102ᵉ = « La danse macabre »). Le miroir vaut **par position tant que les deux séries avancent ensemble** ; il ne vaut pas pour le total (6 quêtes Turquoise côté Bonta, **7** côté Brâkmar). Dofusyelle n'en liste que **99** (préfixe exact de la liste Tougli, mesuré le 21/10).
- **3 Ordres par cité**, **5 quêtes d'Apprentissage** chacun, seuils **> 20 / 40 / 60 / 80 / 100**.
- Les **5 quêtes ont un nom propre par Ordre** (ex. Ménalt / Silvosse / Jiva) ⇒ **30 quêtes d'Ordre** au total, pas 6 × 5.
- Le palier 100 exige donc **les 100 quêtes de cité** (dont la 100ᵉ) : c'est un **verrou**, pas un badge.

**Modèle de données (migration additive `20270114000000_rush_alignment_route`)**
| Champ | Rôle |
|---|---|
| `alignReq` | cité (`bontarien` / `brakmarien`) — toute la série de 100 |
| `alignOrderCode` | Ordre (6 valeurs) — **uniquement** les quêtes d'Ordre |
| `alignLevelReq` | palier 20/40/60/80/100 — **verrou calculé** |
| `classReq` | classe (12 valeurs) — quêtes de classe du début de guide |
| `alignOrderReq` | **legacy** (seuil de niveau) — conservé pour la bascule, à supprimer ensuite |

**Règles (pures, testées)**
- `resolveRushRoute` (`src/lib/rush-route.ts`) : filtre **cité → Ordre → classe**. Le palier **ne masque rien**.
- `alignmentCountForCamp` + verrou dans `isSequenceBlockedByPrereqs` : une quête d'Ordre au palier N exige **N quêtes de cité validées**. Le verrou est évalué **avant** les tags `prereq_text` (une quête d'Ordre n'en porte pas).
- **La tranche n'est plus une donnée** : c'est ce compteur. Aucune saisie, aucun affichage de niveau.
- **Changement de cité = reset** des quêtes d'alignement **+ cascade transitive** des prérequis (`cascadeResetIds`), les autres quêtes gardent leur avancement.

**God**
- `duplicateRushSequenceAsTwin` : jumelle de **cité** (1 → 1, camp opposé, même `order`).
- `duplicateRushSequenceAsOrderTwins` : jumelle d'**Ordre** (1 → 3, les 2 autres Ordres de la même cité), **idempotente**, fail-closed sans cité/Ordre.
- Champs de création : Cité, Ordre (dépendant de la cité), Palier, Classe.

**API Tougli (mesurée, pour comprendre — aucun import de leurs données)**
- Base `https://api.tougli.barbofus.com` ; `GET /api/guide/details/<slug>` (1,1 Mo), `GET /api/guide/list`.
- Leur modèle : `objectives[]` typés `note | title | quest | take_quests | choice`, et `choice.payload` = branches `{ condition, objectives }` avec des **conditions en texte** (`Classe=Feca`).
- **Non copié** : le DSL en texte (fragile). On garde des champs typés.

**Reste à faire (dans cet ordre)**
1. ~~**Vue Branches à 2 étages** dans God~~ — **livrée** le 23/10/2026 (cible **100 / 102**). Organisation de la suite,
   blocs S0→S6 : `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md`.
2. ~~**Édition** des champs de route sur une séquence **existante**~~ — **livrée** le 26/10/2026 (section « 7. Route »).
3. **Route d'alignement sur les 3 surfaces** — état mesuré, défauts (7) et ordre des lots :
   **§ 1 bis** — `G0`, `L1`, `L2` **et** `L3` sont **livrés le 02/11/2026** ; **`textes` livré le
   03/11/2026** (références `&n` corrigées, corrélation Dofusyelle) ; reste la rédaction des **194**
   conseils manquants.
   La **classe publique** n'est plus
   « à trancher » : elle viendra du **compte visiteur** (`docs/plans/PLAN-ESPACE-VISITEUR.md`, V1/V2).
4. Saisie du contenu : 2 × 100 quêtes de cité + 30 quêtes d'Ordre — **outillée** : export JSON de la trame + import
   **dry-run** dans God (`S4-4`). Reste l'écriture éditoriale (textes réécrits, jamais recopiés).
5. **Dette de schéma** : drop de la colonne `alignOrderReq` quand la bascule est finie (migration ⇒ accord
   explicite) ; **`alignmentLevel` reste** — c'est le palier du joueur, affiché par le profil et le panneau de guilde.
6. **V-C** — purge des WebP corrompus + siphon des images « jamais devinées » (rattaché à U-3, « zéro DofusDB »).
   **V-D** — couverture des ressources **391 → 584** (détail : `MAPPING-RUSH-SYLVESTRE.md` §4.5).
   **V-H** — donjons « ocre à capturer » : état + ouverture de la fenêtre Ocre (détail : §H ci-dessous).
7. **Bloc B — livré le 12/11/2026** : page publique par quête (`/guides/rush-sylvestre/q/[slug]`,
   `publicSlug` figé à la publication, `isPublished`, 404 si non publiée, `noindex` tant que le
   guide est en construction, sitemap conditionnel) + bouton publier/dépublier dans l'inspecteur
   de bloc. **Blocs Combat tactique / semi-tactique livrés le 13/11/2026** : types d'information
   non cochables, image fournie convertie en WebP, `RushCombatBanner` partagé, liens nommés
   (favicon, 10 max) et markdown borné (gras, italique, titres, listes, couleurs sémantiques).

### G — Liaison Metamob **dans l'overlay** (fin du cul-de-sac)
- **État mesuré (avant V-G)** : l'overlay ocre affichait « rien à prévoir » puis, au refresh, « Compte Metamob non lié » (`RushOverlayOcreModal:125`) — impasse.
- **Changement** : quand non lié, afficher la brique « non lié » + bouton **« Lier mon compte Metamob »** qui ouvre **le même composant que le dashboard** (`components/profile/metamob-link.tsx` + `linkOcreAccount` / `unlinkOcreAccount` / `forceRefreshOcre`) — overlay **et** guide interne.
- **Dépendances** : — · **Statut** : **livré (V-G)** — la modale propose le lien ; le chemin est couvert par `rush-overlay-ocre-link`.

### H — Donjons « ocre à capturer » : état + ouverture

- **Existant** : tag `ocre_dungeon` (God, `isDungeonOcre`) · progression Metamob (`getOwnQuestMonsters`, `findMonsterOwnersAction`, `OcreProgressData`).
- **Changement** : à côté du badge ocre → **« capturé ✓ / à capturer »** ; chaque donjon ocre **cliquable** → fenêtre Ocre (`RushOverlayOcreModal` / `OcreProgressModal` / `DofusOcreMetamob`) ; non lié → ouvre **G**.
- **Dépendances** : **G** (**livré**) · **Statut** : **livré le 10/11/2026 (V-H)**.
- **Mesure préalable** : le schéma n'a **aucune relation `Dungeon → Monster`**. Le rapprochement se fait donc sur le **nom du boss** du donjon (repli : nom du donjon), normalisé (`src/lib/ocre-dungeons.ts`, comparaison exacte, pas `includes`). La version stricte « tous les monstres du donjon » exigera une table Donjon → Monstres alimentée par DofusDB (**migration ⇒ accord**) : lot séparé, non ouvert.
- **Câblage** : la carte partagée `RushOverlayDungeonCard` porte l'état et le bouton ; le panneau, la popover et la fiche détail transmettent les deux props ; le **dashboard** alimente avec `capturedMonsterNames` et ouvre `OcreProgressModal`, l'**overlay** dérive les captures de `ocre.monsters` et ouvre `RushOverlayOcreModal` ; le **guide public** ne reçoit aucune action. `getDungeons` marque désormais **un** donjon par tag (`isOcreTagged`), plus toute la séquence.
- **Preuves** : `ocre-dungeons` **19** (règle, rendu réel, câblage) · suite **647 fichiers / 6 909 tests** · `tsc` 0 · ESLint 0 erreur · **aucune migration**.
- **Mesure du 10/11 (cas Meulou)** : `Dungeon.isOcreQuest` est la source **fiable** — la quête « Culs Bottés » avait le drapeau `true` **sans** tag `ocre_dungeon`, donc V-H ne montrait rien. `getDungeons` lit désormais `isOcreQuest` puis le tag en **repli**, et les deux payloads (`getPublicGuideDetail` / `getOptimizedGuideDetail`) sélectionnent la colonne.
- **Fiche détail** : les deux coches `Fait / À faire` y vivent **aussi**, avec la même source que le panneau (dashboard, overlay, guide public connecté). L'aperçu God reste en lecture seule.
- **Guide public connecté (page)** : le pont voisin `PublicOcreDungeonBridge` charge `getPublicOcreProgress` **à la demande** (ouverture d'un panneau ou de la fiche), et le bouton ouvre `PublicMetamobModal` (même `OcreQuestPanel`), jamais la modale Ocre interne.
- **Overlay public (10/11)** : `DialogContent` porte un `portalContainer` ; `PublicMetamobModal` est rendue dans le `body` de la **PiP** (même `OcreQuestPanel`), les captures du visiteur sont poussées par `publicCapturedOcreNames`, et `OverlayToastProvider` est monté dans le portail public (toasts dans la PiP, DA unique). `notifyBlockDone` toastifie un **bloc validé** / un **Dofus obtenu** dans `GuideOverlayClient`.
- **Reste (mesuré le 10/11)** : le live **entre visiteurs du même serveur** (bloc validé / Dofus obtenu) = **V2c**, **livré le 11/11/2026** (room SSE par serveur, `showPresence` opt-in, toasts page + PiP) ; les toasts de la **page** publique restent des toasts de page, volontairement.

### I — Succès de donjon (modale) · à faire (17/11/2026)

- **Besoin (verbatim)** : « dans les dj requis un bouton en + par dj qui ouvre une modale (modale dédiée
  pour le guide navigateur et mini modale aussi côté rush mais que pour l'interne et visiteur connectés)
  qui liste les succès validés ou non et qui est sur l'étape et pourrait taper ce donjon et ce / ces succès ».
- **État mesuré** :
  - `DungeonAchievement` (les succès du donjon : `dungeonId`, `challengeId`, `points`, `imageUrl`,
    `description`, `achievedBy`, `publicAchievedBy`, `userProgress`) ; `visibleDungeonAchievements`
    (le pseudo-succès « Donjon validé » de `Dungeon.isNoAchievement`) ; `getDungeonAchievementIconUrl`.
  - `UserDungeonAchievement` (interne : `userId`, `dungeonAchievementId`, `characterSlot`, `completedAt`) ;
    `UserDungeonProgress` (interne « Mes Succès » : `profileId`, `dungeonId`, `achievementId`,
    `characterSlot`, `source`) ; `PublicDungeonAchievement` (visiteur : `publicProfileId`,
    `dungeonAchievementId`, `characterSlot`, `completedAt`).
  - Actions existantes : `toggleDungeonAchievement`/`getDungeonAchievementStates`
    (`dungeon-achievement-actions.ts`, le boss `SuccesBossGuide`) ; `toggleDungeonAchievements`
    (`dungeon-finder-actions.ts`, le `SuccesTracker`) ; `togglePublicDungeonAchievement`/les bracket/group
    (`public-profile-actions.ts`, l'espace visiteur) ; `setRushDungeonState` (`optimized-guide-actions.ts`,
    `PlayerGuideDungeonState`, la coche **par occurrence** de quête).
  - UI existante : `RushOverlayDungeonCard` (les donjons requis, les états, le `+` ocre) ;
    `RushOverlayDungeonPopover` ; `RushOverlayQuestDetailModal` (le détail, la carte donjon) ;
    `RushOverlayQuestListItem` (l'overlay) ; `RushTimelineClient`/`PublicRushGuideClient`/`GuideOverlayClient`
    (les 3 surfaces) ; `RushOverlayDungeonCard` est déjà partagé par le détail dashboard/public/overlay.
- **Changement** :
  - Un bouton **`+`** par donjon **requis** (`sequence.dungeonIds` − `dungeonOptionalIds`) dans la carte
    donjon (le `RushOverlayDungeonCard`, à côté du badge ocre) ; il ouvre la modale.
  - **Guide navigateur** : une **modale dédiée** (`DungeonAchievementsModal`, pleine) depuis le détail de
    l'étape (dashboard et public connecté) ; liste les `DungeonAchievement` du donjon avec l'état
    **validé/non validé** du membre (`UserDungeonAchievement`/`UserDungeonProgress`/`PublicDungeonAchievement`),
    le « Valider le donjon » (`setRushDungeonState(..., "DONE")`/`TODO`/`null`) et le toggle des succès
    (`toggleDungeonAchievement`/`toggleDungeonAchievements` pour l'interne, `togglePublicDungeonAchievement`
    pour le visiteur).
  - **Overlay Rush** : une **mini modale** (`RushOverlayDungeonAchievementsModal`) depuis la carte donjon,
    **uniquement** pour l'**interne** (le guildId réel) et le **visiteur connecté** (un profil) ; le
    **guest** (`isGuest`/`isPublicOverlay`) reste en **lecture seule** (ou sans le bouton) — aucune
    écriture serveur sans profil.
  - **« Sur l'étape »** : la coche du donjon est **par occurrence** (`sequenceId` + `dungeonKey`, la table
    `PlayerGuideDungeonState`) ; les succès de donjon sont **par donjon + personnage** (`characterSlot`) ;
    la modale dit les deux niveaux (le donjon de cette étape / les succès du donjon) pour ne pas confondre
    « ce donjon » et « ce succès ».
  - **Assets** : l'icône du succès (`getDungeonAchievementIconUrl`), le nom du challenge, les points, le
    boss/le niveau/le donjon ; la même ligne/le même composant sur les 3 surfaces ; la DA (tokens, pas de
    `filter` sur les listes, `data-quality`), le responsive 390/768/1024/1440, le focus/`aria`.

- **Données / décisions ouvertes** :
  - **Deux tables internes** (`UserDungeonAchievement` vs `UserDungeonProgress`) : la source **canonique**
    de « Mes Succès » doit être choisie ; ne pas créer une troisième vérité. Le `SuccesBossGuide`
    (`UserDungeonAchievement`) et le `SuccesTracker` (`UserDungeonProgress`) doivent être alignés ou
    explicitement distingués (le lot doit trancher).
  - **`characterSlot`** : les 4 tables le portent ; la modale doit utiliser le **personnage sélectionné**
    (`altPseudo`) comme `setRushDungeonState` ; le `UserDungeonAchievement` est `userId` (pas `profileId`).
  - **Visiteur** : `PublicDungeonAchievement` pour l'espace visiteur/le guide public connecté ; la coche
    du **donjon** (`PlayerGuideDungeonState`) exige un `guildId`/un `UserProfile` — le guide public
    connecté ne peut donc pas « taper le donjon » par cette table ; décider (le public connected a-t-il
    un `PlayerGuideDungeonState` ? sinon, la coche du donjon reste **interne**, le visiteur ne coche que
    ses succès `PublicDungeonAchievement`).
  - **`isNoAchievement`** : le pseudo-succès « Donjon validé » est-il listé/cochable ? Le `visibleDungeonAchievements`
    le filtre déjà ; le « Valider le donjon » le remplace.
  - **`DungeonAchievement` vs les 68 `isSuccess`** : la modale traite les **succès de donjon**, pas les
    succès de quête Yelle (`GuideSequence.isSuccess`) ; le libellé doit être sans ambiguïté.
  - **Donjons optionnels** : le `+` est sur les **requis** ; les optionnels peuvent être listés sans
    bloquer (le `dungeonOptionalIds` existant).
- **Tests** : la règle pure (requis/optionnel, `dungeonKey`, `sequenceDungeonProgress`, `missingDungeons`,
  `visibleDungeonAchievements`, `isNoAchievement`) ; les actions (auth interne/visiteur, guilde/guide/
  séquence/donjon, `characterSlot`, rate limit, idempotence, log, fail-closed) ; l'UI (le `+` par requis,
  la modale pleine, la mini, le guest, la parité des 3 surfaces, la DA/responsive/a11y) ; les verrous
  existants (`rush-overlay-dungeon-gate` 12, `dungeon-invalidation`, `rush-dungeons`,
  `dungeon-no-achievement`, `dungeon-completion` 7, `succes-ui-deslop` 4).
- **Statut** : **implémenté le 19/11/2026** (branches `fix/succes-canonique` puis
  `feat/rush-bloc-i-succes-donjon` ; **PR #1456 + #1457 + #1458 mergées**). **Décisions tranchées** : ① source canonique =
  `UserDungeonProgress` (legacy `UserDungeonAchievement` backfillé puis gelé) ; ② guide interne
  et guide public = deux profils **séparés** ; ③ visiteur connecté : coche du donjon
  locale/miroir, succès `PublicDungeonAchievement`, **sélecteur** si le personnage du guide
  n'est pas déclaré ; ④ le faux « Donjon validé » n'est **jamais** listé dans ce panneau (la
  coche du donjon le remplace ; la fiche boss garde son fallback) ; ⑤ guest = catalogue en
  **lecture seule** ; ⑥ RBAC strict : `+` seulement avec `canViewSucces`, coche avec
  `canEditOwnSucces` (la fiche boss est alignée) ; ⑦ **aucune migration de schéma** ; ⑧ le panneau
  du guide n'affiche **pas** les points de succès (`+10`) et ne rend **aucune case** en lecture
  seule (guest / droit manquant) — la fiche boss garde les points.

### J — Donjons du guide : vue transversale « qui a fait quoi » · cadré le 18/11/2026

- **Besoin (verbatim)** : « liste des dj guide navigateur / bouton overlay avec leur quête et étape
  associées, qui parmi les gens sur le rush a fait lequel / à faire ; succès associés de guilde /
  visiteurs connectés ; penser aux dj qui ont plusieurs quêtes aussi ; attention les dj dans Brâkmar
  si Bontarien = pas possible par exemple ».
- **Différence avec I** : I ouvre **un** donjon (modale de succès). J est une **vue d'ensemble** :
  la liste de **tous** les donjons de la route, chacun relié à **ses** quêtes/étapes, avec l'état
  **par membre** et les **succès agrégés**. I et J partagent la même vérité de coche, aucune
  duplication de table.
- **État mesuré (18/11/2026)** :
  - **Coche par occurrence** : `PlayerGuideDungeonState` = `(profileId, guideId, sequenceId,
    characterSlot, dungeonKey, state)` — le même donjon demandé par **deux quêtes** se coche deux
    fois (`@@unique` sur les cinq colonnes). `useRushDungeonStates` expose déjà `others`
    (`RushDungeonMemberState[]`) pour le bloc affiché : l'agrégat « qui a fait lequel » se lit là,
    pas dans une table parallèle.
  - **Visiteurs** : `PublicRushProgress.dungeonChecks` (Json) porte les coches publiées, **par
    `characterSlot`** et **uniquement si `PublicProfile.showRushProgress`** (consentement distinct,
    D-V21). Sans consentement : rien n'est lu, rien n'est agrégé.
  - **Succès** : `DungeonAchievement` (par donjon) ; `UserDungeonAchievement` (membre, par
    `characterSlot`) ; `PublicDungeonAchievement` (visiteur, par `characterSlot`). Le pseudo-succès
    « Donjon validé » (`Dungeon.isNoAchievement` → `visibleDungeonAchievements`) reste le fallback :
    il ne doit pas être compté deux fois avec la coche de donjon.
  - **Clé de donjon** : `dungeonKeyOf` (stable) — jamais l'id local ni le nom brut ; la résolution
    des noms passe par `Dungeon.dofusdbId`. **Les alias sont livrés le 19/11/2026** : les **3**
    libellés client mesurés (« Bibliothèque du Maître Corbac », « Donjon de la mine de Sakaï »,
    « Sanctuaire de Torkélonia ») pointent vers `maitre-corbac`, `grolloum`, `torkelonia`
    (`src/lib/rush-dungeon-names.ts`) et les `dungeonIds` ont été complétés (4 quêtes, **21 ids**,
    dont les **18 fantômes** de Maïmane).
  - **Contrainte d'alignement** : `Dungeon` ne porte **aucune** cité/Ordre/classe. La seule source
    est la **quête requérante** (`GuideSequence.alignReq`, `alignOrderCode`, `classReq`, filtrés par
    `resolveRushRoute`). Un donjon dont **toutes** les quêtes requérantes sont hors route disparaît ;
    un donjon requis par une quête commune reste visible. **Ne jamais écrire « impossible » sans
    mesure** : le verdict vient du filtre de route, pas d'un libellé codé en dur.
- **Décisions ouvertes** :
  - **Agrégat membres** : une requête par guide (group by `dungeonKey`, `sequenceId`) bornée, jamais
    une par donjon ; afficher « n/N occurrences » et « m/M membres » (jamais un « fait » global
    déduit d'une seule occurrence).
  - **Visiteurs connectés** : agrégat des seuls profils publiés (`showRushProgress`) et **jamais**
    `userId`/snowflake/e-mail ; un visiteur non consenti est **invisible**, pas « à faire ».
  - **Multi-quêtes** : lister les quêtes/étapes qui exigent le donjon (nom + bloc + position), et
    l'état par occurrence ; un donjon peut être « fait » sur une quête et « à faire » sur une autre.
  - **Succès de guilde** : par donjon, « x/y membres » pour chaque succès ou un compteur agrégé ;
    les succès restent **par personnage** (`characterSlot`), donc agréger au niveau **membre** en
    disant le slot (pas de fusion silencieuse main + mules).
  - **Place dans l'UI** : guide navigateur (panneau/liste dédiée) et bouton dans l'overlay ; la
    fiche donjon existante (`/boss/<slug>`) reste la source du détail.
- **Invariants** : filtre de route **avant** l'agrégat ; fail-closed sur le consentement ; aucune
  requête N+1 ; pas de `filter` CSS sur une liste de cartes ; overlay en `data-quality="low"` ;
  DA Wakfu (`--da-*`) ; français, aucun nom d'outil interne.
- **Tests** : règle pure de l'agrégat (multi-quêtes, occurrences, donjon hors route, donjon commun,
  consentement absent) ; actions (auth, guilde, `characterSlot`, lecture seule, rate limit) ;
  parité des 3 surfaces ; verrous existants `rush-dungeons`, `rush-overlay-dungeon-gate`,
  `dungeon-no-achievement`.
- **Statut** : **livré le 19/11/2026** (branche `feat/rush-bloc-j-progression-donjons`). Décisions validées :
  ① **option A** — seul le bloc du repère est ouvert, « Tout déplier » + recherche ;
  ② **liste par donjon ET par bloc** (un donjon multi-blocs — Belvédère d'Ilyzaelle —
  apparaît dans chaque accordéon avec **ses** seules étapes), jamais un « fait » global ;
  ② bis **clic sur un donjon** → modale existante de **post donjon / quête** (Dungeon Finder),
  préremplie donjon + quête (dashboard interne ; pas de post sans guilde, PiP non branché) ;
  ③ filtres **Tous / À faire / Fait** (un donjon `4/6` apparaît dans les deux), **étape**
  (les 141 qui portent un donjon), **repères**, recherche ; ④ public : agrégat des visiteurs
  **consentants**, mode perso sans agrégat ; ⑤ overlay : icône entre le compte et l'œil,
  badge d'exigences restantes, `data-quality` en PiP ; ⑥ compteur en **exigences** (un groupe
  « au choix » = 1) ; ⑦ **aucune migration**, aucune écriture depuis la vue.
  Verrous : `rush-dungeons-overview` **8** · `rush-dungeons-overview-ui` **8**.
  Responsive **vérifié** 390/768/1024/1440 : 0 débordement bas, 0 débordement horizontal,
  liste qui scrolle à l'intérieur.

## 3. Ordre d'exécution

→ **`docs/ROADMAP.md`** (l'ordre unique). Non recopié ici.

## 4. Invariants non négociables du module

1. **Filtrer AVANT de calculer** (route filtrée → vue / prérequis / ressources).
2. **Une seule agrégation** : `aggregateRushResources` + `rushResourceKey` — aucune liste parallèle.
3. **Jamais deviner un chemin d'icône** : id d'entité ≠ id d'apparence ; passer par la fiche + **garde d'identité**.
4. **Local-first** : `resolveItemImage` sert le WebP local, le proxy est un repli (objectif **U**).
5. **Fail-closed** : un alignement / ordre inconnu ne débloque rien ; état illisible ⇒ on refuse.
6. **Une seule implémentation par comportement** (un composant partagé, jamais une copie par surface).
7. **Ressources et validation** : valider une quête **coche** toutes ses ressources, l'invalider les **décoche** — règle pure `src/lib/rush-resource-checks.ts`, appliquée côté serveur et en écho optimiste sur les trois surfaces.

## 5. Retours du test local (17/11/2026) — backlog UI/UX

> Le guide **Touglie enrichi** est importé (36/536) et bon ; les retours portent sur le **rendu** ou le
> **contenu non importé**. Détail route/seed/archive : `ROUTE-RUSH-ISO-TOUGLI.md` §10-13 ; prérequis :
> `QUEST-PREREQUISITES.md` §5.1/§6 ; feature succès de donjon : **Bloc I**.
>
> **Mesures du 19/11/2026 (base locale)** : **36 blocs / 536 séquences** · **0** page `/q`
> publiée · **0** `constraints` · **0** tag `prereq_expr` (le seed importé est antérieur à l'OU) ·
> **6** tips de quête / **23** de bloc · **742** tags combat sans id · **0** conseil à rédiger (55 écrits : 50 Yelle + 5 blocs)
> (5 blocs + 50 quêtes). Le `591` du §10 de `ROUTE-RUSH` est la génération du 17/11 ; le guide
> importé fait **536**.

| Retour | Lot | Points d'entrée |
|---|---|---|
| Prérequis absents | ✅ livré | siphon client (`startCriterion`) + verrou d'ordre ; 451 jeu + 76 ordre |
| Prérequis « au choix » (OU) | ✅ livré 18/11/2026 | `prereq_expr` : alternatives par id DofusDB, « au moins une » ; une alternative **hors guide** ne bloque jamais ; ligne « Au choix : … » sur les 3 surfaces. **Archivage + import requis** ; le seed régénéré du 19/11 porte **3 groupes** (20 quêtes), la base locale en a **0** tant que le guide n'est pas réimporté |
| Détail trop petit / vrais monstres/items | ✅ **code + seed livrés 19/11/2026 (monstres)** : 742 tags → **1 518** monstres, **100 %** résolus (carte `rush-monster-map`, 3 alias mesurés) ; image + fiche interne / publique `/bestiaire/<slug>` ; items ✅ (`ResourceImage`, 1 898 WebP) | `RushOverlayTagSection`, `RushTagBadge`, `RushMonsterFicheModal`, `rush-combat-monsters`, `build-rush-monster-map.ts` |
| 68 succès cochables | ✅ livré | un succès est un **groupe de quêtes** : 303 tags sur 284 quêtes, `SuccessChip` (pastille + fiche) |
| Compteur 0/448 vs 536 séquences | ⏸ **à reproduire** : payload local = **536** séquences, **0** info, **0** choix ⇒ le public affiche 536 ; aucun chemin ne produit 448 | `RushGuideView`/`stepCounts` (étapes ≠ 536 séquences ; succès/donjons/infos) |
| 16 DofusDex sans panneau | ✅ **déjà livré** : `PublicDofusProgressPanel` + `RushDofusDetailModal` partagée avec l'interne | `tips`/`RushMarkdown`, `dofusId`, `RushDofusBadge`, `RushDofusProgress` |
| Icône Dofus discrète | ✅ **livré 19/11/2026** : le médaillon de la barre de chapitre porte le **Dofus du bloc** (overlay), et la liste nomme chaque Dofus — parité dashboard/public | `RushTimelineClient:970`, `GuideOverlayClient:688`, `PublicDofusProgressPanel`, `RUSH_DOFUS_META` |
| Pastille Succès absente du guide **public** | ✅ **livré 19/11/2026** : `SuccessChip` + `guideQuests` (mêmes `questDbIds`), verrouillé par `rush-public-parity` | `SuccessChip`, `getSequenceSuccesses` |
| Donjons « au choix » (Sufokia, Maïmane) | ✅ **livré 19/11/2026** : un tag `donjon` multi = **un groupe** (`attachDungeonChoices`), un seul donjon suffit ; les noms **non résolus** du tag deviennent des alternatives à clé stable `nom:…` ; **6 groupes / 6 exigences** sur Maïmane ; compteurs = `requiredBlocks` ; serveur aligné (`activityTags`) | `overlay-utils`, `rush-dungeons`, `RushOverlayDungeonCard`, `RushQuestDungeonsPanel` |
| Toasts navigateur hors overlay | ✅ **19/11/2026** : `AppToaster` sous `[data-da="wakfu"]` + `.da-toaster` (matière `--da-panel`/`--da-ink`, filet sémantique), route overlay incluse | `AppToaster`, `da-wakfu.css` |
| Pavés « DofusDex officiel » dans les tips de bloc | ✅ **supprimé du rendu 19/11/2026** (demande user : « c'est juste infect et inutile supprime ») : **13 blocs** (463 à 1 956 car., 228 lignes) — `splitDofusDexTip` isole la section, `RushDofusDexTip` ne rend **que le reste** (Prérequis / Donjons) ; plus de `<details>`, plus d'objectifs | `rush-dofusdex-tip`, `RushDofusDexTip` |
| Quêtes non cliquables | ✅ livré 18/11/2026 | la ligne (nom) ouvre la fiche sur le dashboard et le guide public ; picto « i » conservé |
| Changement perso sans message | ✅ livré 18/11/2026 | toast « Personnage actif : <nom> » + `sync` de l'overlay ouvert |
| Alignement sans refresh/message | ✅ livré 18/11/2026 | cause : payload PiP figé ; `sync` du store + cité/Ordre pré-remplis |
| Succès de donjon | ✅ **livré 19/11/2026 (Bloc I)** | `RushOverlayDungeonCard`, `setRushDungeonState`, `DungeonAchievement`, `UserDungeonAchievement` |
| Donjons du guide : qui a fait quoi | ✅ **livré 19/11/2026 (Bloc J)** | `PlayerGuideDungeonState`, `PublicRushProgress.dungeonChecks`, `dungeonKeyOf`, `resolveRushRoute` (route **avant** l'agrégat) |
| 55 conseils | ✅ **livrés 19/11/2026** : 50 paraphrases Yelle + 5 notes de blocs Tougli (`src/data/rush-guide-tips.json`), **0 à rédiger** ; 3 étapes partageant une quête sont ajoutées à la suite | `YELLE_DEMO_TIPS`, `TOUGLI_BLOCK_TIPS` |
| Descriptions de blocs (8 vs 12) | Seed | `enrichTouglieWithYelle` (mettre à jour `description` après les succès) |
| 3 donjons inconnus | ✅ **soldé le 19/11/2026** : les 3 alias mesurés (`rush-dungeon-names`) ; re-générer le rapport pour 98/98 | `dungeonNames`, `Dungeon`/`bossName` |
| 4 étapes / **3 succès** (rapport du 18/11) | Normal | « Compléments — succès hors trame » |
| Cache public | Code | ISR 1 h, `revalidatePath`/`updateRushSylvestreSettings` |
| Progression au déplacement | Backend | `moveRushSequence`, `PlayerGuideProgress`, `deleteRushMilestone` |
| Pages `/q/<slug>` | Ops | 0 publiée |
| Quêtes d'alignement numérotées (« Ali 1 », « Ali 2 »…), séparées Bonta / Brâkmar | ✅ livré 18/11/2026 | `buildAlignmentSeries` (rangs 1→100/102, Ordres 1→5) · `RushAlignmentBadge` · sections par cité sur dashboard / guide public / overlay |
| Icône de quête dans l'overlay | ✅ livré | `RushOverlayQuestListItem` : repli `icone-quete.png`, comme le dashboard |
| Light mode de l'overlay | ✅ retiré | `GuideOverlayClient`/`RushOverlayHeader` : état, `localStorage`, bouton |
| Alignement modifié mais guide inchangé | ✅ livré 18/11/2026 | cause : payload PiP figé ; `sync` du store, cité/Ordre pré-remplis |
| Quête verrouillée peu lisible / repère posable | ✅ livré | rouge franc, opacité `.92`, libellé « Verrouillée » ; repère retiré sur une quête verrouillée |
| Liste « Mon Ocre » rognée | ✅ livré | `OcreQuestPanel` : défilement natif `min(440px,55svh)`, barre visible |
| Retouches DA PiP + guide + verrou (17) | ✅ livré 19/11/2026 | bord gauche « faire maintenant », titre verrouillé, copie 900 ms, compression PiP, dégradé d'arc, respiration ≥ 1024 px, `#da-rough` focalisé, conseil ouvert, cartes verrouillées (ligne compacte ambre, fond discret, sans badge ni sous-boîte), blocs DofusDex en markdown, header PiP ajusté au contenu, fiche Succès portée hors carte, pastilles Donjon/Succès/présence dans le même bloc segmenté, icône Succès normalisée `succes.png` |

**Ordre** : UX ✅ (« Ali 1 / Ali 2 », alignement, clic quête, message perso) → **`prereq_expr` (OU)** ✅ →
**retouches DA** ✅ (PiP, guide, verrou, DofusDex, fiche Succès, pastilles — PR #1450) →
**UI-1** ✅ 19/11/2026 (Succès public + Dofus du bloc ; DofusDex déjà livré ; compteur 448 à reproduire ;
monstres = lot data) → **Bloc I** (succès de donjon) →
**Bloc J** (donjons : qui a fait quoi) → **VPS** (conseils écrits le 19/11).