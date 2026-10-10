---
description: Module Rush Sylvestre — agrégateur (carte des fichiers + chantiers A→H) ; pointe vers les plans durables, ne les duplique pas
---

# 🏹 Module Rush Sylvestre — agrégateur

> **Rôle unique.** Index du module : **où sont les fichiers**, **quels chantiers restent**, **quel ordre**.
> Il **ne duplique rien** : chaque chantier renvoie à son **plan durable** (règle `AGENTS.md` §4.3).
>
> **Sources de vérité (contenu)**
> - Refonte rush (ergonomie, visuel, éditeur God, perf) → **chantier T** : `docs/plans/PLAN-REFONTE-RUSH-SYLVESTRE.md`
> - Alignement Bonta/Brâkmar + Ordres → `docs/plans/ARCHITECTURE-ALIGNEMENT-RUSH-SYLVESTRE.md` + `docs/plans/MAPPING-RUSH-SYLVESTRE.md`
> - **Ordre d'exécution** (jamais dupliqué ici) → `docs/plans/FILE-EXECUTION.md`
> - Backlog canonique + blocs de session → `docs/ROADMAP.md`
>
> **Dernière MAJ : 10/10/2026.**

## 0. Gouvernance (3 niveaux)

| Rôle | Fichier |
|---|---|
| L'ORDRE (« la prochaine chose ? ») | `docs/plans/FILE-EXECUTION.md` |
| Le backlog canonique + blocs de session | `docs/ROADMAP.md` |
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
`RushOnboardingWizardModal.tsx` · `rush/GuestCharacterModal` · `rush/MilestoneCelebration` · `rush/NpcBadge` · `rush/QuestHelpersSection` · `rush/QuestItemResourceGrid` · `rush/RushActionMenu` · `rush/RushBlockMetaEditor` · `rush/RushChapterSidebar` (bandeau « Objets requis ») · `rush/RushCoordinateChip` · `rush/RushInfoBanner` · `rush/RushInfoSequenceBanner` · `rush/RushOverlayLiveToast` · `rush/RushPenseBeteModal` · `rush/RushProgress` · `rush/RushRichText` · `rush/RushSeparatorBanner` · `rush/RushTagBadge` · `components/rush/RushHelperBadge`

### 1.4 Composants liés
`ResourceImage` · `OcreProgressModal` · `DofusOcreMetamob` · `AlignmentModal` · `components/ocre/*` (dashboard ocre, `not-linked-state`, `OcreTargetBits`, panneau pierres) · `components/profile/metamob-link.tsx` · `hooks/use-ocre-write-queue`

### 1.5 Libs (`src/lib`)
`rush-guide-utils.ts` (`resolveItemImage`, `rushResourceKey`, `isSequenceBlockedByPrereqs`…) · `rush-guide-view.ts` (`buildRushGuideView`, `computeRushAlignment`) · `rush-helpers.ts` · `rush-resources-preheat.ts` (pur, client-safe) · `rush-dofus-meta.ts` · `rush-rich-meta.ts` · `rush-ui-config.ts` · `guest-progress.ts` · `dofus-asset-siphon.ts` (`siphonAndCompressImage`, `siphonItemIconsBatchCore`) · `dofusdb-limiter.ts` / `dofusdb-throttle.ts` · `ocre-soul-stones.ts` · `ocre-write-queue.ts` · `metamob-client.ts` · `class-spells-siphon.ts`

### 1.6 Actions serveur
`optimized-guide-actions.ts` (lecture du guide, coches de ressources, reset d'alignement) · `asset-siphon-actions.ts` (pré-chauffage) · `ocre-actions.ts` (liaison Metamob, progression) · `rush-actions.ts` · `game-data-admin-actions.ts` · `game-data-sync-actions.ts`

### 1.7 Store / types / données
`src/store/rush-overlay-store.ts` · `src/types/rush-guide-types.ts` · `src/data/rush-sylvestre-guide.json` (**96 blocs / 335 séquences / 568 tags `item` / 391 ids uniques**) · `src/data/rush-sylvestre-guide.enriched.json` (374 quêtes) · `src/data/rush-sylvestre-pense-bete.ts`

### 1.8 Scripts
`scripts/correlate-rush-guides.mjs` (Tougli ∪ Dofusyelle ∪ NOOBS — **rapport dry-run**) · `enrich-rush-guide-items.mjs` · `seed-rush-sylvestre-cli.mjs` · `seed-rush-sylvestre-enriched-cli.mjs` · `inspect-rush-sylvestre-guide.mjs` · `prune-rush-guide-orphans.mjs` · `dofus-asset-siphoner.ts` · `siphon-guide-images.ts`

### 1.9 Tests (35 fichiers)
`rush-guide-utils` · `rush-guide-view` · `rush-overlay-utils` · `rush-resource-checks` · `rush-public-parity` · `rush-resources-preheat` · `rush-overlay-ocre` · `rush-helpers` · `rush-dofus-meta` · `rush-rich-meta` · `rush-rich-text` · `rush-prereq-target` · `rush-god-studio-robustesse` · `rush-delete-idempotent` · `rush-block-image-rendered` · `rush-dashboard-members` · `rush-guide-ui-polish` · `rush-info-sequence-banner` · `rush-live-presence` · `rush-overlay-chapitre-bulles` · `rush-overlay-chapter-bar` · `rush-overlay-dungeons` · `rush-overlay-entraide-guild-scopee` · `rush-overlay-non-checkable-blocks` · `rush-quest-state-colors` · `rush-separator-banner` · `rush-sylvestre-construction` · `rush-tips-block-studio` · `siphon-sorts-niveau` · `siphon-stats` · `dofus-asset-siphon-url` · `bounty-siphon` · `metamob-ocre-match` · `ocre-write-queue` · `calendar-krala-metamob-ui`

## 2. Chantiers du module

> Format : **BESOIN → ÉTAT MESURÉ → CHANGEMENT → TESTS → DÉPENDANCES → STATUT**.
> L'**ordre** vit dans `FILE-EXECUTION.md` ; ici, le **quoi**.

### T — Refonte rush (plan durable : `PLAN-REFONTE-RUSH-SYLVESTRE.md`)
- **Reste** : T-2c (id de quête dans `prereq_text`) · lot 4 habillage Dofus (O14/O15, G7, G8, G9, T2) · lot 5 overlay avancé (O9, O10, O11, O12, O13) · lot 6 perf (G6 + `useOptimistic`) · transverses (O5, O6, O7, G2, G5, T1, T5) + les 4 `prompt()` / `confirm()` du studio.
- **Statut** : T-1 / T-2 / T-2b / T-3 livrés (PR #851 / #853 / #856 / #857).

### U — Zéro dépendance DofusDB (cadré, aucun lot commencé)
- **Lots** : U-1 inventaire / ratchet · U-2 réécrire les `img` des `*-compiled.json` · **U-3 plus de repli réseau** · U-4 recherches sur catalogue local · U-5 ops (health / crons / allowlist).
- **Statut** : cadrage dans `FILE-EXECUTION.md` §1 (pas encore de plan dédié).

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

- **Reste** : trancher le nom de `33380` (données) · pré-chauffer les **319** icônes siphonnables (bouton God) · les **~21 000** objets hors guide relèvent du chantier **U**.
- **Tests** : `tests/unit/rush-guide-item-ids.test.ts` (garde de **données**, sans réseau : l'id fautif ne revient pas, le bon est présent) + parité du rail (`rush-resource-checks`, `rush-public-parity`).
- **Dépendances** : — · **Statut** : **livré le 10/10/2026** (les 5 cas mesurés traités ; le balayage du guide ne laisse qu'une décision de **nom**).

### C — Purge des WebP corrompus + siphon « jamais deviné » (rattaché U-3)
- **État mesuré** : `siphonAndCompressImage` conserve `allowGuessedPath` par défaut `true` pour items / monstres (dette **U-3** déjà notée au `ROADMAP`).
- **Changement** : interdire le chemin deviné pour les **objets**, purger les `items/{id}.webp` dont l'id est invalide / mismatch (script de repérage), re-pré-chauffer avec `allowGuessedPath:false`.
- **Dépendances** : **B** · **Statut** : **à faire** · **Ops** : purge à exécuter côté serveur (volumes `assets-*-data`).

### D — Couverture des ressources du guide (391 → ~609)
- **État mesuré** : nous **391** ids uniques · **Tougli** 517 directs / **543** avec recettes · **Dofusyelle** 478 (531 lignes) · **union = 609**. 119 manquants chez nous : 53 récupérables via l'arbre de recettes Tougli, 66 restants (45 au catalogue Tougli non référencés + 21 absents).
- **Changement** : importer l'union (base **Tougli** + compléments Dofusyelle) → `preparation.items` + tags `item` ; re-seed ; pré-chauffer les icônes nouvelles.
- **Dépendances** : **B** · **Statut** : **à faire**.

### E — Vérifications + docs
- `npm run test:run` · `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm run security:audit`, puis `docs/ROADMAP.md` (bloc de session) + `docs/agents/activeContext.md` (bloc en haut).

### F — Route d'alignement Bonta / Brâkmar + Ordres (plan durable : `ARCHITECTURE-ALIGNEMENT-RUSH-SYLVESTRE.md`)
- **Décisions verrouillées (10/10/2026)** :
  - **un seul** guide `rush-sylvestre`, branché par **données** (`alignReq` = cité, `alignOrderReq` = ordre, `alignLevelReq` = seuil) — **jamais deux guides** ;
  - **Ordre** choisi à la **1ʳᵉ quête d'Ordre (seuil 20)** ; rangs **20 / 40 / 60 / 80 / 100** ;
  - **changement de cité = logique jeu** : **reset** de l'alignement (+ `alignmentBefore`) et **retour à la 1ʳᵉ quête** de la nouvelle cité ; quêtes communes conservées ;
  - **résolution** : `resolveRushRoute` **filtre**, puis `buildRushGuideView` / `isSequenceBlockedByPrereqs` / `aggregateRushResources` **calculent sur le set filtré** (un prérequis masqué ne bloque pas) ;
  - **God** : marquage par séquence + action de masse par bloc + vue « Branches » + « créer la jumelle » (miroir par slot).
- **État mesuré** : nos 66 tags `alignment_set` sont **tous `bontarien`** · `alignReq` / `alignOrderReq` **null** partout · **Bonta 98/100** (`Bandanarthrie`, `Le subterfuge de la corne` manquantes) · **Brâkmar 0/102** · **6 ordres × 5 rangs**, 2 slots multi-quêtes.
- **Dépendances** : **D** (même import NOOBS / Tougli) · **Statut** : **à faire**.

### G — Liaison Metamob **dans l'overlay** (fin du cul-de-sac)
- **État mesuré** : l'overlay ocre affiche « rien à prévoir » puis, au refresh, « Compte Metamob non lié » (`RushOverlayOcreModal:125`) — impasse.
- **Changement** : quand non lié, afficher la brique « non lié » + bouton **« Lier mon compte Metamob »** qui ouvre **le même composant que le dashboard** (`components/profile/metamob-link.tsx` + `linkOcreAccount` / `unlinkOcreAccount` / `forceRefreshOcre`) — overlay **et** guide interne.
- **Dépendances** : — · **Statut** : **à faire**.

### H — Donjons « ocre à capturer » : état + ouverture
- **Existant** : tag `ocre_dungeon` (God, `isDungeonOcre`) · progression Metamob (`getOwnQuestMonsters`, `findMonsterOwnersAction`, `OcreProgressData`).
- **Changement** : à côté du badge ocre → **« capturé ✓ / à capturer »** (tous les monstres du donjon possédés) ; chaque donjon ocre **cliquable** → fenêtre Ocre (`RushOverlayOcreModal` / `OcreProgressModal` / `DofusOcreMetamob`) ; non lié → ouvre **G**.
- **Dépendances** : **G** · **Statut** : **à faire**.

## 3. Ordre d'exécution

→ **`docs/plans/FILE-EXECUTION.md`** (l'ordre unique). Non recopié ici.

## 4. Invariants non négociables du module

1. **Filtrer AVANT de calculer** (route filtrée → vue / prérequis / ressources).
2. **Une seule agrégation** : `aggregateRushResources` + `rushResourceKey` — aucune liste parallèle.
3. **Jamais deviner un chemin d'icône** : id d'entité ≠ id d'apparence ; passer par la fiche + **garde d'identité**.
4. **Local-first** : `resolveItemImage` sert le WebP local, le proxy est un repli (objectif **U**).
5. **Fail-closed** : un alignement / ordre inconnu ne débloque rien ; état illisible ⇒ on refuse.
6. **Une seule implémentation par comportement** (un composant partagé, jamais une copie par surface).