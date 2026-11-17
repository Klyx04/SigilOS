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