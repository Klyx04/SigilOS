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
> - **Ordre d'exécution** (jamais dupliqué ici) → `docs/ROADMAP.md`
> - Backlog + ordre → `docs/ROADMAP.md` ; blocs de session → `docs/agents/journal-sessions-2026.md`
>
> **Dernière MAJ : 27/10/2026.**

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
`rush-guide-utils.ts` (`resolveItemImage`, `rushResourceKey`, `isSequenceBlockedByPrereqs`, `getAlignmentSet`, `collectCascadeUncheck`…) · `rush-guide-view.ts` (`buildRushGuideView`, `computeRushAlignment`) · `rush-resources-preheat.ts` (pur, client-safe) · `rush-dofus-meta.ts` · `rush-rich-meta.ts` · `rush-ui-config.ts` · `guest-progress.ts` · `dofus-asset-siphon.ts` (`siphonAndCompressImage`, `siphonItemIconsBatchCore`) · `dofusdb-limiter.ts` / `dofusdb-throttle.ts` · `ocre-soul-stones.ts` · `ocre-write-queue.ts` · `metamob-client.ts` · `class-spells-siphon.ts`

### 1.6 Actions serveur
`optimized-guide-actions.ts` (lecture du guide, coches de ressources, reset d'alignement) · `asset-siphon-actions.ts` (pré-chauffage) · `ocre-actions.ts` (liaison Metamob, progression) · `rush-actions.ts` · `game-data-admin-actions.ts` · `game-data-sync-actions.ts`

### 1.7 Store / types / données
`src/store/rush-overlay-store.ts` · `src/types/rush-guide-types.ts` · `src/data/rush-sylvestre-guide.json` (**96 blocs / 335 séquences / 568 tags `item` / 391 ids uniques**) · `src/data/rush-sylvestre-guide.enriched.json` (374 quêtes) · `src/data/rush-sylvestre-pense-bete.ts`

### 1.8 Scripts
`scripts/correlate-rush-guides.mjs` (Tougli ∪ Dofusyelle ∪ NOOBS — **rapport dry-run**) · `enrich-rush-guide-items.mjs` · `seed-rush-sylvestre-cli.mjs` · `seed-rush-sylvestre-enriched-cli.mjs` · `inspect-rush-sylvestre-guide.mjs` · `prune-rush-guide-orphans.mjs` · `dofus-asset-siphoner.ts` · `siphon-guide-images.ts`

### 1.9 Tests (**49** fichiers `tests/unit/rush-*.test.ts`)

Le détail suit le préfixe `rush-*` (`Get-ChildItem tests/unit -Filter 'rush-*.test.ts'`). **Ajoutés le 26/10/2026** : `rush-quest-identity` (identité de quête + borne des `questDbIds`), `rush-order-codes` (référentiel des 6 Ordres),
`rush-import` (plan de dry-run + verrou « l'import n'efface rien »), `rush-dofus-accent` (contraste 4,5:1 des 24 accents + accessibilité du filtre), `rush-dofus-progress` (progression d'un membre **quête par quête** dans la modale par Dofus).

## 2. Chantiers du module

> Format : **BESOIN → ÉTAT MESURÉ → CHANGEMENT → TESTS → DÉPENDANCES → STATUT**.
> L'**ordre** vit dans `docs/ROADMAP.md` ; ici, le **quoi**.

### T — Refonte rush (plan durable : `PLAN-REFONTE-RUSH-SYLVESTRE.md`)
- **Reste** : T-2c (id de quête dans `prereq_text`) · **lot 4** — **O14** (contraste ✓ le 26/10 ; reste l'application générale des accents) et **T2** (**bandeau réel** `GuildStatusPanel` ✓ ; verrou repointé le 27/10 après suppression de `DofusProgressStrip`) faits, restent **O15** motion sobre, **G7** hero, **G8** dépli `grid-template-rows`, **G9** célébration (**à arbitrer**) · lot 5 overlay avancé (O9, O10, O11, O12, O13) · lot 6 perf (G6 + `useOptimistic`) · transverses (O5, O6, O7, G2, G5, T1, T5) + les 4 `prompt()` / `confirm()` du studio.
- **Statut** : T-1 / T-2 / T-2b / T-3 livrés (PR #851 / #853 / #856 / #857) · **T-4 partiel** le 26/10/2026 (O14 + T2, PR #1136) · **T2 consolidé** le 27/10/2026 (composant mort supprimé, verrou sur le code rendu).

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
   blocs S0→S5 : `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md`.
2. ~~**Édition** des champs de route sur une séquence **existante**~~ — **livrée** le 26/10/2026 (section « 7. Route »).
3. Sélecteur d'**Ordre** dans l'overlay et le guide public (aujourd'hui : cité seule).
4. Saisie du contenu : 2 × 100 quêtes de cité + 30 quêtes d'Ordre — **outillée** : export JSON de la trame + import
   **dry-run** dans God (`S4-4`). Reste l'écriture éditoriale (textes réécrits, jamais recopiés).
5. Supprimer `alignOrderReq` et `alignmentLevel` quand la bascule est terminée.

### G — Liaison Metamob **dans l'overlay** (fin du cul-de-sac)
- **État mesuré** : l'overlay ocre affiche « rien à prévoir » puis, au refresh, « Compte Metamob non lié » (`RushOverlayOcreModal:125`) — impasse.
- **Changement** : quand non lié, afficher la brique « non lié » + bouton **« Lier mon compte Metamob »** qui ouvre **le même composant que le dashboard** (`components/profile/metamob-link.tsx` + `linkOcreAccount` / `unlinkOcreAccount` / `forceRefreshOcre`) — overlay **et** guide interne.
- **Dépendances** : — · **Statut** : **à faire**.

### H — Donjons « ocre à capturer » : état + ouverture
- **Existant** : tag `ocre_dungeon` (God, `isDungeonOcre`) · progression Metamob (`getOwnQuestMonsters`, `findMonsterOwnersAction`, `OcreProgressData`).
- **Changement** : à côté du badge ocre → **« capturé ✓ / à capturer »** (tous les monstres du donjon possédés) ; chaque donjon ocre **cliquable** → fenêtre Ocre (`RushOverlayOcreModal` / `OcreProgressModal` / `DofusOcreMetamob`) ; non lié → ouvre **G**.
- **Dépendances** : **G** · **Statut** : **à faire**.

## 3. Ordre d'exécution

→ **`docs/ROADMAP.md`** (l'ordre unique). Non recopié ici.

## 4. Invariants non négociables du module

1. **Filtrer AVANT de calculer** (route filtrée → vue / prérequis / ressources).
2. **Une seule agrégation** : `aggregateRushResources` + `rushResourceKey` — aucune liste parallèle.
3. **Jamais deviner un chemin d'icône** : id d'entité ≠ id d'apparence ; passer par la fiche + **garde d'identité**.
4. **Local-first** : `resolveItemImage` sert le WebP local, le proxy est un repli (objectif **U**).
5. **Fail-closed** : un alignement / ordre inconnu ne débloque rien ; état illisible ⇒ on refuse.
6. **Une seule implémentation par comportement** (un composant partagé, jamais une copie par surface).