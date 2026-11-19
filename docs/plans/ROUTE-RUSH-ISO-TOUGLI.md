# Route Rush Sylvestre — iso Tougli × Dofusyelle × DofusDex

> **Rôle unique.** Ce fichier porte le **plan de la route et de la démo** du Rush
> Sylvestre : les 5 scénarios d'alignement, la corrélation Tougli × Dofusyelle, le
> DofusDex officiel, le seed God et le reste à faire. L'**ordre** vit dans
> `docs/ROADMAP.md` (§0 et §3 bis) ; la source DofusDex dans
> `docs/reference/DOFUSDEX.md` ; le module dans `docs/plans/MODULE-RUSH-SYLVESTRE.md`.
> **Dernière mesure : 17/11/2026.**

## 1. Les sources, mesurées

| Source | Ce qu'elle apporte | Chiffres mesurés |
|---|---|---|
| **Tougli** `rsa-rush-sylvestre-accelere` | exhaustivité, conditions, contraintes | **383 objectifs** (35 titres, 238 quêtes, 74 `take_quests`, 16 `group`, **11 `choice`**, 2 succès, 10 notes) · **530 quêtes** · **28 conditions** · 19 classes · **Bonta 100 / Brâkmar 102 / Neutre 1** · **6 Ordres × 5** · 1 085 contraintes · 99 donjons |
| **Dofusyelle** (Marcellusito & Laniyelle) | trame chronologique | **57 étapes** · 392 quêtes · **81 succès** · 83 donjons · 531 ressources · 21 prépas · 40 saves |
| **Trame locale** (`src/temp/trame-rush/`, hors dépôt) | rapprochement Tougli × Yelle | 530 quêtes · 36 blocs · **361/384** quêtes Yelle appariées (23 non appariées) |
| **DofusDex** (client Dofus 3) | ordre **officiel** par Dofus | **30 progressions** · 115 étapes · 109 prérequis · **783 objectifs** · **0 non résolu** (`docs/reference/DOFUSDEX.md`) |
| **Notre moteur** | route, verrous, surfaces | `resolveRushRoute` (cité → Ordre → classe) · 12 types de bloc · 3 surfaces · `constraints` + `activityTags` + `dofusId` |

Le delta 530 / 392 n'est pas un désaccord : Tougli découpe **chaque micro-quête** et
les deux cités ; Dofusyelle agrège les succès et ne joue qu'une cité (Bonta). La Trame
montre **98,5 %** de quêtes communes.

## 2. Les 5 scénarios — ce que fait Tougli, ce que fait SigilOS

| Situation | Tougli (mesuré) | SigilOS aujourd'hui | Décision / état |
|---|---|---|---|
| **Classe Crâ** | `choice` racine à **19 branches** `Classe=` ; une seule est résolue par le personnage actif. Crâ = **1 quête, `1971`** | `classReq` + `resolveRushRoute` : 1 quête visible **si** `playerClass` est fourni ; sans classe, **les 19 restent visibles** | **Corrigé** : `resolveRushScenario` masque les 19 et expose `needsClassChoice` ; le seed pose les 19 branches dans le bloc Astrub/étape 2, la route n'en garde qu'une |
| **Aucun alignement** | branche **`Ali=Neutre` = 1 quête** (`1316` « La rivalité ») ; les 100 Bonta + 102 Brâkmar et les Ordres sont **masqués** | `camp = null` ⇒ **les deux cités** (100 + 102) restent visibles ; aucune notion de neutre | **Corrigé** : `kind = "no-alignment"`, « La rivalité » visible, cités/Ordres masqués, `needsCampChoice` ; `alignReq = "neutre"` est reconnu par `rush-route.ts` |
| **Alignement au départ** | une seule cité (100 ou 102) ; l'Ordre n'apparaît qu'après le choix de cité | filtre `alignReq` OK ; **les 15 quêtes d'Ordre** restent visibles tant qu'aucun Ordre n'est choisi | **Corrigé** : sans Ordre, les quêtes d'Ordre sont retirées ; `canChooseOrder` à partir de **20 quêtes de cité**, `nextOrderThreshold` 20/40/60/80/100 |
| **Changement de cité en cours** | le guide se **re-résout** sur le personnage actif : l'ancienne branche disparaît, la nouvelle repart de sa 1ʳᵉ quête ; la progression est conservée **par quête**, pas fusionnée | `alignmentChangeReset` + `alignmentResetSeeds` existent ; le reset est calculé côté profil, sans vue unifiée | **Planifié** : `kind = "camp-switch"`, `resetSeqIds` / `resetCompletedSeqIds` / `keptCompletedSeqIds` ; l'UI doit **confirmer** et afficher ce qui sera décoché. **Neutre → cité n'est pas un reset** |
| **Changement d'Ordre** | 5 quêtes de l'ancien Ordre disparaissent, 5 du nouveau apparaissent | `alignOrderCode` + `alignmentChangeReset("order")` ; pas de plan de reset exposé | **Planifié** : `kind = "order-switch"`, les 5 anciennes listées, les 5 nouvelles visibles ; la chaîne des rangs (`previousOrderRank`) et le palier restent actifs |
| **Ordres (les 6)** | 6 branches × 5 quêtes ; **aucun palier dans le guide** (le jeu verrouille) | `alignOrderCode` + `alignLevelReq` + `alignmentCountForCamp` + chaîne des rangs | **Conservé** : 20/40/60/80/100 · 5 des 30 exigent d'autres joueurs (`1916/1917/1918/1919/1921`) · l'Ordre d'un camp opposé est **ignoré** avec avertissement |

Le module `src/lib/rush-route-scenarios.ts` rend ces états **purs et testés** (17 cas) :
`no-alignment` · `neutral` · `aligned` · `camp-switch` · `order-switch`, avec
`needsClassChoice`, `needsCampChoice`, `needsOrderChoice`, `canChooseCamp`,
`canChooseOrder`, `nextOrderThreshold`, `switchPlan` et les compteurs
`hiddenByClass/Camp/Order` (la somme des trois = total − visible, verrouillé par test).

## 3. Ce qui est livré (code, 17/11/2026)

| Fichier | Rôle | Preuve |
|---|---|---|
| `src/lib/rush-route-scenarios.ts` | 5 scénarios, prompts, plan de reset | `tests/unit/rush-route-scenarios.test.ts` (**17**) |
| `src/lib/rush-route.ts` | `alignReq = "neutre"` : visible sans cité, masqué dès qu'une cité est choisie | `tests/unit/rush-route.test.ts` (**15**) |
| `src/lib/rush-import.ts` + `optimized-guide-actions.ts` | import **typé** : `type`, chapitre, description, image, liens, `dofusId`, `isSuccess`, `activityTags` ; blocs d'information **sans quête** | `tests/unit/rush-import-typed-blocks.test.ts` (**6**) + `rush-import.test.ts` (**14**) |
| `src/lib/rush-trame-seed.ts` | Trame → payload God : spine Tougli/Yelle, conditions, ressources, succès, DofusDex | `tests/unit/rush-trame-seed.test.ts` (**13**) |
| `scripts/build-rush-trame-seed.ts` | CLI : lit la Trame + la Yelle brute + le DofusDex, écrit le payload et le rapport dans `src/temp/rush-seed/` | exécuté le 17/11/2026 |
| `scripts/siphon-dofusdex.py` | lecture **typetree** du DofusDex du client | 30/115/109/783, **0 non résolu** |
| `public/game-data/dofusdex.json` | référentiel officiel (faits, sans descriptions) | 245 Ko |

**Aucune migration.** Les colonnes `type`, `description`, `accentColor`, `imageUrl`,
`tips`, `links`, `dofusId`, `isSuccess`, `activityTags`, `chapter` existent déjà.

### 3.1 Le seed, mesuré

| Spine | Blocs | Séquences | Quêtes avec id | Succès | Tags item | DofusDex | Non appariées |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Tougli** (exhaustif) | 35 | 523 | 523 | 0 | 839 | **9** | 0 |
| **Yelle** (chronologique) | 56 | 457 | 375 | **81** | 598 | **23** | **1** (`Flovoraison`) |

- Tougli : 530 quêtes dans la source, 523 séquences → 7 doublons/1 bloc vide, **jamais
  une perte silencieuse** (le rapport les liste).
- Yelle : la **liste `quetes` brute** est la référence ; les lignes de corps
  (« Bloqué par un horaire… ») ne deviennent **jamais** des quêtes. Les 81 succès et
  les donjons viennent de la Yelle brute, fusionnée par numéro d'étape.
- Les 19 classes sont ajoutées au bloc « Incarnam/Astrub » ; « La rivalité » à la
  première étape d'alignement ; les ressources/contraintes deviennent des tags bornés.
- Le DofusDex ajoute une **checklist officielle** (objectifs + niveaux + prérequis) et
  le `dofusId` aux blocs qui portent un nom de Dofus (Dofus Émeraude, Dofus des
  Veilleurs, Domakuro…), tronquée à 3 950 caractères.
- **Donjons** : le seed transporte des **`dungeonDbIds` (ids DofusDB)**, jamais les
  cuids locaux. L'import résout `Dungeon.dofusdbId` sur la base cible : **140 séquences /
  184 arêtes / 98 ids** (Tougli), **113 / 166 / 85** (Yelle), **0 cuid local**. Les
  102/89 noms restent dans les tags `donjon` ; le dry-run VPS signalera les ids DofusDB
  inconnus.

## 4. Les types de bloc — ce qui existe déjà, ce qui manque

Les **12 types de la capture** existent déjà dans l'enum Prisma et la palette du
studio : `QUETE_SERIE`, `PREREQUIS`, `ALIGNEMENT`, `DOFUS`, `SUCCES`, `ZONE`, `DONJON`,
`INFO`, `SEPARATEUR`, `DOFUS_OBTAINED`, `COMBAT_TACTIQUE`, `COMBAT_SEMI_TACTIQUE`.
Le lot ne les a **pas recréés** : il les rend **importables** avec leur contenu.

Ce qui manque, et qui demanderait une **migration d'enum** (donc un accord explicite) :

| Type proposé | Ce qu'il porterait | Pourquoi pas un champ existant |
|---|---|---|
| `RESSOURCES` | checklist globale (531 ressources Yelle, quantités) | `activityTags` est **par quête**, pas global |
| `SAVE_DONJON` | « save à prendre / arrêt devant le boss » (40 saves) | `DONJON` + `isOptional` ne dit pas *quand* s'arrêter |
| `DOFUSDEX` | progression officielle d'un Dofus (783 objectifs) | `DOFUS` la porte aujourd'hui en `tips` ; un type dédié permettrait un rendu et un verrou |
| `ORDRE` | les 6 Ordres × 5 rangs | `ALIGNEMENT` mélange cité et Ordre |
| `CONTRAINTE` | fenêtre horaire / attente / joueurs / métiers | `constraints` JSON est par quête ; un bloc le rendrait lisible |

**Décision pour la démo** : aucun nouveau type. Le seed utilise les 12 existants +
`tips`/`description`/`links`/`dofusId`/`activityTags`/`isSuccess`. Les 5 types ci-dessus
sont un lot **post-démo**, avec migration et accord.

## 5. « Iso Tougli » ou « Yelle » ?

| Besoin | Spine recommandé |
|---|---|
| Démo de fin de semaine, proche des captures (57 étapes, succès, donjons) | **Yelle** (`--spine yelle`) |
| Référence exhaustive, Brâkmar, 6 Ordres, 530 quêtes | **Tougli** (`--spine tougli`) |
| Vérifier l'ordre officiel d'un Dofus | **DofusDex** (les deux spines l'ajoutent) |

Les deux spines sont **additifs** : l'import God ne supprime ni ne réécrit un bloc
existant, il ajoute les quêtes manquantes. On peut donc importer Yelle d'abord, puis
Tougli pour compléter Brak/Ordres, sans perdre les éditions du studio.

> **Cible VPS vérifiée le 17/11/2026 (bêta, lecture seule)** : le guide `rush-sylvestre`
> existant porte **494 séquences / 238 align / 32 Ordres / 19 classes** (dépôt
> `0f3a052e`). Le spine **Tougli** (523) est la **même structure de blocs** : il complète
> le guide existant. Le spine **Yelle** (56 blocs) est une **nouvelle trame
> chronologique** : l'import God ajoute au même guide `rush-sylvestre`, donc soit tu
> l'acceptes comme seconde section, soit il faut un **guide cible** (lot séparé).

## 6. Plan de démo — fin de semaine

| Lot | Quand | Contenu | État |
|---|---|---|---|
| **0 — seed + import** | ce soir | `npx tsx scripts/build-rush-trame-seed.ts --spine yelle` → God ▸ Importer (dry-run → apply) ; contrôle du guide public avec **Crâ + Bonta**, un visiteur **sans alignement**, puis un **Ordre** | **prêt** |
| **1 — scénarios sur les 3 surfaces** | avant la démo si possible | brancher `resolveRushScenario` dans le dashboard, le guide public et l'overlay : prompts classe/cité/Ordre, confirmation de changement de cité/Ordre | module prêt, branchement à faire |
| **2 — revue éditoriale** | après l'import | **48 conseils Yelle** + **5 notes Tougli** à réécrire (le rapport les liste) ; relier `Flovoraison` ; vérifier les checklists DofusDex | reste |
| **3 — types dédiés** | post-démo | `RESSOURCES`, `SAVE_DONJON`, `DOFUSDEX`, `ORDRE`, `CONTRAINTE` : migration d'enum + accord | à décider |

**Scénario de démo conseillé** : spine **Yelle** (chronologique), personnage **Crâ**
(`classReq = cra` → une seule quête de classe), cité **Bonta**, Ordre **Cœur Vaillant**
après 20 quêtes de cité ; puis montrer un **visiteur sans alignement** (« La rivalité »
seule) et un **changement de cité** (le plan de reset s'affiche, le reste est conservé).
Le spine **Tougli** sert de contrôle exhaustif (Brâkmar, 6 Ordres).

## 7. Ops et commandes

```bash
# 1. Seed (local, lecture seule sur la Trame + la Yelle brute + le DofusDex)
npx tsx scripts/build-rush-trame-seed.ts --spine yelle
#    → src/temp/rush-seed/yelle.json + yelle-rapport.md (volatile, non commité)

# 2. Import God : Rush Sylvestre ▸ Importer → dry-run, lire le plan, puis appliquer
#    (additif : aucun bloc existant n'est réécrit, aucune migration)

# 3. Contrôle : guide public /dashboard/<guildId>/quetes-dofus + overlay
#    (Crâ + Bonta ; sans cité ; Ordre ; changement de cité)

# 4. DofusDex (uniquement si le client a changé)
python scripts/siphon-dofusdex.py            # → public/game-data/dofusdex.json
```

- **VPS bêta vérifié le 17/11/2026** (clé `agent-ro`, lecture seule) : `status` =
  `0f3a052e` (merge de la mission précédente, conteneurs sains) ; `counts` = **494 / 238 /
  32 / 19** ; `migrations` à jour (dernière `20270207000001`) ; `quests` `1971`, `1960`,
  `2149`, `2197`, `1316`, `433` présents. **Le code n'est pas déployé** : il doit être
  mergé puis déployé en bêta (`./scripts/deploy-cd.sh beta`) **avant** l'import. Aucune
  migration.
- **Limite du dispositif** : `counts` ne compte que les `GuideSequence` du guide ; il
  n'expose **ni `Dungeon`, ni le total `GameQuest`**. Un verbe `dungeons` serait une
  **nouvelle capacité** (revue + `docs/agents/vps-read-only.md` + test).
- **Aucune migration**, aucun secret, aucun appel réseau à l'exécution.
- `src/temp/` reste **volatile** : le payload et le rapport ne sont pas commités ;
  `public/game-data/dofusdex.json` est le seul ajout de données (faits, 245 Ko).
- Avant PR : les tests ciblés + `npx tsc --noEmit` + `npm run lint` + `npm run test:run`
  (le lot touche l'action d'import et la règle de route).

## 8. Risques et limites mesurées

1. **Données tierces** : Tougli et Dofusyelle ne sont pas commités. Le seed ne recopie
   aucun texte : les conseils sont rédigés pour SigilOS, les notes sources sont
   seulement **comptées** (`tipsToWrite`). Une relecture humaine reste obligatoire.
2. **Écarts de comptage** : Tougli 530 quêtes → 523 séquences (7 doublons/bloc vide) ;
   Yelle 392 quêtes brutes → 375 ids + 81 succès + 1 non appariée (`Flovoraison`).
   Les rapports listent chaque écart ; rien n'est supprimé silencieusement.
3. **DofusDex** : l'ordre et les prérequis sont officiels ; les **bornes de niveau**
   peuvent différer de la carte communautaire (Pourpre 110–130 vs 100–180) et les
   **descriptions** Ankama ne sont pas commitées.
4. **Scénarios** : `resolveRushScenario` est **prêt et testé**, mais pas encore branché
   sur les 3 surfaces. Tant que ce branchement n'est pas fait, le guide public garde le
   comportement actuel (sans classe : 19 quêtes visibles ; sans cité : les deux).
5. **Nouveaux types** : une migration d'enum est un arrêt + accord (`AGENTS.md` §7).
   La démo n'en a pas besoin.
6. **DofusDB** : la licence LPNC-IA reste attachée aux liens/fiches existants ; le
   DofusDex est lu dans le **client**, pas via DofusDB. Aucun nouvel appel AI au
   fournisseur.

## 9. Prérequis entre quêtes — mesuré le 17/11/2026

- **Tougli** : l'arbre reste **linéaire** (383 objectifs, `choice`/`group`/`take_quests`),
  mais les **données de quête** portent **430/530** quêtes à prérequis (**492 arêtes**,
  `{type:"quest", id}`, **sans opérateur**, max 19). `1960` « Ça sent le gaz » = **19
  classes en OU** : jamais à importer en ET (le cas est déjà réglé par `classReq`).
- **DofusDex** : **109 prérequis de Dofus** + 115 étapes + 783 objectifs ; **pas** le
  graphe complet (le client a **1 984 quêtes**). Il reste une checklist de Dofus.
- **Client `QuestsDataRoot.startCriterion`** : **990/1 984** quêtes avec `Qf=`,
  **1 187 arêtes**, **842 cibles**, max **35** ; **893 quêtes / 957 arêtes AND-only**,
  **97 quêtes / 230 arêtes avec OR** (`1960`, `747`, `1329`…).
- **SigilOS** : `prereq_text` **AND-only**, **301 tags par nom** sur 259/335 séquences
  (0 id, T-2c à faire) ; le seed Trame **n'en ajoute pas**. Le prochain lot est
  `prereq_expr` ET/OU + import **AND-only** (893/957), les 97 quêtes OR attendant le
  modèle. Détail : `docs/reference/QUEST-PREREQUISITES.md`.

## 10. Touglie enrichi — un seul guide, trame Touglie + tout Dofusyelle (17/11/2026)

> **Mise à jour du 19/11/2026** : le seed régénéré et le guide importé font **536 séquences**
> (le `591` ci-dessous est la génération du 17/11). Le rapport du 19/11 ne liste **0 conseil à rédiger**
> (55 écrits), **4 étapes sans cible** et **3 succès** dans « Compléments ». Les compteurs du §10 restent la
> mesure du 17/11 ; les lignes d'état (§12) sont, elles, alignées sur 536.

> **Besoin** : garder la **trame Touglie** (35 blocs, 523 quêtes, 2 cités, Ordres, conditions,
> ressources, donjons) et y fusionner **tout Dofusyelle** (81 succès, conseils, donjons, DofusDex).
> Les deux spines `tougli.json` / `yelle.json` ne répondaient pas à ce besoin : ils sont séparés.

- **Générateur** : `src/lib/rush-trame-seed.ts`, option `enrichFromYelle` ; CLI :
  `npx tsx scripts/build-rush-trame-seed.ts --spine tougli --enrich-yelle`
  → `src/temp/rush-seed/tougli-enriched.json` + `tougli-enriched-rapport.md` (volatile, non commité).
- **Règles de fusion** : une étape Yelle est rattachée au bloc Touglie de la **première quête corrélée**
  (la Trame `dofusyelle.correlation`) ; un succès qui porte le nom d'une quête existante **marque la quête**
  (`isSuccess = true`), sinon il est ajouté ; un bloc plein (80) envoie ses succès dans
  **« Compléments — succès hors trame »** (avec les 4 étapes sans cible) ; un conseil rédigé
  (`YELLE_DEMO_TIPS`, 6) se pose sur la **quête** corrélée, les autres restent dans `tipsToWrite`
  (aucun texte tiers recopié) ; le DofusDex d'une étape s'applique au bloc Touglie **même si son titre
  diffère** (Domakuro, Dorigami, Tacheté…), sans doublon ; les donjons d'étape deviennent une ligne
  **« Donjons (étape N de la trame) »** dans les conseils du bloc ; les **ressources/conditions**
  restent celles de la Trame **par quête** (la liste globale Yelle n'a pas de quête cible).
- **Payload** : **36 blocs / 591 séquences** ; 523 quêtes Touglie ; **68 succès distincts** (81 occurrences,
  13 doublons) ; **839 tags `item`** ; **33 blocs avec donjons Yelle** ; **16 checklists DofusDex**
  (9 Touglie + 7 Yelle) ; **55 conseils à rédiger** ; 4 étapes sans cible ; 10 succès dans
  « Compléments » ; **140 séquences / 98 noms de donjons** (dont **95 résolus** en local par nom).
- **Tests** : `tests/unit/rush-trame-seed.test.ts` **24** (dont 7 pour l'enrichissement : succès,
  conseil sur la quête, DofusDex d'un bloc au titre différent, donjons, Compléments, absence de noms
  de source) ; `tsc` 0. Le **rapport** liste les 55 conseils, les 4 étapes, les 7 succès « bloc plein »
  et les 13 doublons.
- **Corrections du lot** : `accentColor` du seed reste `null` (l'import ne force plus `#10b981`) ;
  l'import **legacy** est refusé sur le nouveau guide (`rushUIConfig.seedSource`) ; les donjons de
  quête sont résolus **par nom** (`dungeonNames`, `Dungeon.name`/`bossName`) en plus de `dungeonDbIds`
  (3/98 → **95/98**).
- **Ce que le seed ne fait pas** : il **n'importe pas les prérequis** (`prereqIds` de la Trame,
  430/530, 492 arêtes ; client 990/1984, 893 AND/97 OR) — voir `docs/reference/QUEST-PREREQUISITES.md`
  §5.1/§6 ; il ne réécrit pas les 55 conseils ; les descriptions de blocs gardent le compte **avant**
  l'enrichissement (« Incarnam · 8 quêtes » alors que 12 séquences avec les 4 succès) — petit correctif
  du générateur à faire.
- **Suite** : l'import local a été fait (36/536) ; le remplacement/archivage est décrit au §11 ;
  les retours du test sont au §12 ; la reprise propre au §13.

## 11. Remplacement du guide — archivage local / VPS (17/11/2026)

> **Principe** : on ne supprime jamais le guide actif. On l'**archive** (slug
> `rush-sylvestre-archive-<date>`, `isActive=false`), on crée un nouveau `rush-sylvestre` **vide** avec
> les réglages copiés et le marqueur `rushUIConfig.seedSource = "trame-enriched"`, puis on importe le
> payload via **God ▸ JSON** (dry-run → Appliquer). L'ancien guide/progression reste en base ; le
> nouveau démarre à zéro.

- **Script** : `scripts/archive-rush-guide.mjs` (même style que `seed-rush-sylvestre-cli.mjs`) :
  `--dry-run` (défaut), `--apply`, `--list-archives`, `--delete-archive <slug> --apply`.
  Il refuse toute suppression hors `rush-sylvestre-archive-*` ; la suppression cascade (`OptimizedGuide`
  → blocs → séquences → progression, coches de ressources, états de donjons).
- **Local (fait)** : `rush-sylvestre` archivé **108/492** → `rush-sylvestre-archive-20261117T224935` ;
  nouveau guide **0/0** ; import God **36/536** ; l'ancien guide est conservé, le nouveau est actif
  (pas en construction, public ouvert, `TIMELINE`).
- **VPS (à faire)** : `./scripts/deploy-cd.sh beta` (code + script) → `pg_dump` de sauvegarde →
  `docker compose exec app node scripts/archive-rush-guide.mjs --dry-run` puis `--apply` → God bêta
  ▸ JSON ▸ `tougli-enriched.json` (le fichier reste **local** : le champ fichier du navigateur l'envoie)
  → vérifier → `--delete-archive` seulement après validation. La **prod** suit la même procédure.
- **Lecture seule** : la clé `agent-ro` ne peut pas exécuter ces écritures ; `pg_dump`, `docker compose
  exec app`, l'import God et `--delete-archive` sont **humains**. `counts`/`logs` restent les seules
  vérifications agent. Détail : `docs/MAINTENANCE.md` § Rush — remplacer/archiver ; `vps-read-only.md`.
- **Legacy interdit** : `src/data/rush-sylvestre-guide.json` + le bouton « Importer » + le CLI
  `seed-rush-sylvestre-cli.mjs` **resynchronisent l'ancien dataset** et suppriment les blocs absents ;
  le bouton God est refusé par `seedSource`, mais **le CLI doit être considéré comme obsolète** sur le
  nouveau guide (voir la note ajoutée dans `MAINTENANCE.md`). Le nouveau seed est le JSON enrichi.
- **Conséquences** : progression/ressources/donjons des membres **remis à zéro** (nouveaux ids) ;
  l'archive les conserve ; les pages `/q/<slug>` restent en 404 tant qu'elles ne sont pas publiées ;
  le public est en ISR 1 h (revalidation/`updateRushSylvestreSettings` ou attente).
- **PR** : le code (seed, import, action, script, tests) + les docs sont **non commités** ; branche
  `feat/rush-touglie-enrichi` à créer, PR → `dev`, `npm run test:run`/`tsc`/`lint`/`security:audit`,
  CI, merge, puis `deploy-cd.sh beta`. Aucune migration, aucun lockfile.

## 12. Retours du test local (17/11/2026) — backlog

> Le guide importé est **bon** (structures, quêtes, succès, donjons, DofusDex). Les retours portent sur
> ce qui n'est **pas encore rendu** ou **pas importé**. Détail UI/UX/feature : `MODULE-RUSH-SYLVESTRE.md`
> §5 et Bloc I ; prérequis : `QUEST-PREREQUISITES.md` §5.1/§6.

| Retour | Cause | Lot |
|---|---|---|
| Prérequis absents (ex. « Destination Astrub » : 1635, niveau 10, guilde) | ✅ **livré 18/11/2026** : siphon client (`startCriterion` : 990 quêtes / 1 187 arêtes, ET-only) + verrou d'**ordre** (`Réponses à tout` → `Sous le regard des dieux`) ; **451 prérequis du jeu + 76 d'ordre** | — |
| Prérequis **« au choix »** (ex. « Supermilicien » : 272, 273 **ou** 274) | ✅ **livré 18/11/2026** : tag `prereq_expr` (alternatives par id DofusDB, **aucune migration**), évaluation « au moins une » ; une alternative **hors guide** ne bloque jamais ; seed enrichi depuis `quest-prerequisites.json`. **Archivage + import requis** (mesuré le 19/11 : **0** tag `prereq_expr` en base) | — |
| Détail de quête trop petit / pas de vrais monstres/items | `RushOverlayQuestDetailModal` + `RushOverlayTagSection`/`RushTagBadge` ; `Monster` 4 728 / `GameItem` 21 886 disponibles | **UI** — items ✅ (`ResourceImage`, 1 898 WebP) ; **monstres = data** (**742** tags combat sans id, mesure du 19/11) |
| 68 succès cochables | ✅ **livré 18/11/2026** : un succès est un **groupe de quêtes** — 68 lignes supprimées, **303 tags** sur 284 quêtes, pastille + fiche `SuccessChip` (dashboard + overlay, icône officielle du client) | — |
| Compteur 0/448 vs 536 séquences | ✅ en-tête du dashboard : « **blocs** » (il comptait des blocs) ; ⏸ le « 448 » reste **non reproduit** (payload local **536**, 0 info, 0 choix) | **UI** (à reproduire) |
| 16 DofusDex : où ? | dans les `tips` des blocs Dofus (repli « Conseils »), pas de panneau dédié | ✅ **déjà livré** : panneau + fiche partagée |
| Icône du Dofus discrète | `dofusId` + `RUSH_DOFUS_META` existent ; l'icône est dans l'en-tête/overlay/public mais peu visible | ✅ **livré 19/11/2026** : médaillon du bloc (overlay) + liste des chapitres |
| Pastille Succès sur le guide **public** | absente : `SuccessChip` n'était montée que dans le dashboard et l'overlay | ✅ **livré 19/11/2026** : même `SuccessChip`, mêmes `questDbIds` |
| Donjons « au choix » (Sufokia, Maïmane) | un tag `donjon` multi était lu comme N exigences (`dungeonIds` à plat) | ✅ **livré 19/11/2026** : un groupe = une exigence, un seul donjon suffit ; sans migration (`activityTags`) |
| Pavés « DofusDex officiel » dans les tips de bloc | 13 blocs (13 à 51 lignes) rendus entiers dans le dashboard et l'overlay | ✅ **supprimé du rendu 19/11/2026** : seule la suite (Prérequis / Donjons) s'affiche |
| Quêtes non cliquables dans le guide navigateur | ✅ **livré 18/11/2026** : la **ligne de quête** (nom) ouvre la fiche détaillée sur le dashboard et le guide public ; le picto « i » reste | — |
| Changement d'alignement : refresh ? | ✅ **livré 18/11/2026** — cause mesurée : le PiP recevait un **instantané figé** ; l'overlay ouvert est resynchronisé (`sync`) à chaque rafraîchissement, et la cité/Ordre du personnage pré-remplit sa modale | — |
| Changement de personnage : aucun message | ✅ **livré 18/11/2026** : toast « Personnage actif : <nom> » + resynchronisation de l'overlay | — |
| **Succès de donjon : bouton `+`/modale** | **feature demandée** : voir `MODULE-RUSH-SYLVESTRE.md` **Bloc I** (guide navigateur + mini overlay interne/connecté) | **Bloc I** |
| 55 conseils | ✅ **livrés 19/11/2026** : 50 Yelle + 5 blocs Tougli, **0 à rédiger** | — |
| Descriptions de blocs (8 vs 12) | description calculée avant l'enrichissement | **seed** (petit) |
| 3 donjons inconnus | ✅ **soldé le 19/11/2026** : 3 alias mesurés (`rush-dungeon-names`) ; rapport à re-générer | — |
| 4 étapes / **3 succès** (rapport du 18/11) | « Compléments — succès hors trame » | **normal** |
| Cache public | ISR 1 h ; tous les edits ne revalident pas | **petit lot** |
| Progression au déplacement/suppression | `PlayerGuideProgress` par bloc ; `moveRushSequence`/`deleteRushMilestone` | **backend** (avant éditions) |
| Pages `/q/<slug>` | 0 publiée | **ops/édition** |
| **Quêtes d'alignement numérotées** (« Ali 1 », « Ali 2 »…), séparées Bonta / Brâkmar | ✅ **livré 18/11/2026** : « Ali 1 → 100 » (Bonta) et « Ali 1 → 102 » (Brâkmar), rangs d'Ordre **1 → 5** ; **dérivés à l'affichage** (`buildAlignmentSeries`), blocs séparés par cité (dashboard, guide public, overlay). Aucun renommage, aucun réimport : les prérequis restent résolus par nom | — |
| Icône de quête dans l'overlay | ✅ **livré 18/11/2026** : repli `icone-quete.png`, même convention que le dashboard | — |
| Bouton light mode de l'overlay | ✅ **retiré 18/11/2026** (état + `localStorage.sigil_overlay_theme` + bouton) | — |
| Quête verrouillée peu lisible | ✅ **livré 18/11/2026** : rouge franc, opacité `.92`, libellé « Verrouillée » ; **plus de repère** sur une quête verrouillée (navigateur + overlay) | — |
| Liste « Mon Ocre » rognée | ✅ **livré 18/11/2026** : défilement natif borné (`min(440px,55svh)`), barre visible | — |
| Changement d'alignement visible immédiatement | ✅ **livré 18/11/2026** : cause = payload PiP figé ; `sync` du store à chaque rafraîchissement + cité/Ordre pré-remplis dans la modale | — |
| Retouches DA (PiP, guide, verrou, DofusDex, fiche Succès, pastilles) | ✅ **livré 19/11/2026** : 17 retouches ; fiche Succès portée hors carte, pastilles dans le bloc segmenté, icône `succes.png`, markdown des blocs DofusDex ; `da-wakfu` 66/66, suite 7 992 ; **PR #1450** | — |

**Ordre proposé** : UX ✅ (séries Ali, alignement, clic quête, message perso) → **`prereq_expr` (OU)** ✅ →
**retouches DA** ✅ (PiP, guide, verrou, DofusDex, fiche Succès, pastilles — PR #1450) →
**UI-1** ✅ 19/11/2026 (Succès public, Dofus du bloc ; DofusDex déjà livré ; compteur à reproduire) →
**Bloc I** (succès de donjon) →
**Bloc J** (donjons : quêtes/étapes, qui a fait quoi, succès de guilde/visiteurs) →
**VPS** (conseils écrits le 19/11).

## 13. Reprise propre — la porte d'entrée

1. Lire `docs/agents/activeContext.md` (bloc **suite 21**, en haut) puis `docs/ROADMAP.md` (§0 + §2).
2. Le **quoi** : `docs/plans/ROUTE-RUSH-ISO-TOUGLI.md` §10-13 (seed/archivage/retours) ;
   `docs/plans/MODULE-RUSH-SYLVESTRE.md` **Bloc I** (succès de donjon) + **§5** (retours UI/UX).
3. Les **prérequis** : `docs/reference/QUEST-PREREQUISITES.md` §5.1/§6.
4. Les **ops** : `docs/MAINTENANCE.md` § Rush — remplacer/archiver ; `docs/agents/vps-read-only.md`.
5. **État local** : `rush-sylvestre` **36/536** (importé), archive **108/492** ;
   `src/temp/rush-seed/tougli-enriched.json` (volatile) ; le code + les docs sont **non commités** ;
   la branche est `dev`.
6. **Prochaine session** : choisir le lot (prérequis, UX, UI, Bloc I) ; la PR du seed peut être préparée
   en parallèle ; le VPS après la PR (backup → archive → import → vérifier → `--delete-archive`).
7. **Ne pas** : lancer le CLI legacy sur le nouveau guide ; importer le seed sans dry-run ; déplacer/
   supprimer des quêtes cochées ; oublier `npm run test:run` avant la PR.