# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 19/11/2026 (suite 33) — **Rush · Bloc J « Progression Donjons »** — branche `feat/rush-bloc-j-progression-donjons`

> **Demandes user (verbatim)** : « bloc j / tu décales rush live et ouvrir overlay à droite et tu le mets entre les 2 / responsive / idem guides visiteurs connecté / non connecté / même chose dans l'overlay / oublie pas les assets » ; puis « pk tu manges l'écran en bas ? où est le skill responsive ? ».
> **Fait** : ① règle pure `rush-dungeons-overview` — **occurrences** `sequenceId::dungeonKey`, groupes « au choix » = **1 exigence**, rollups `x/y étapes`, `m/M membres`, filtres état/étape/repères/recherche, **option A** = bloc du repère + « Tout déplier » ; ② action bornée `getRushDungeonsCommunity` (3 requêtes plafonnées, fail-closed) + couture `_actions/public-rush-dungeons` (le client public n'importe **aucun** `@/server/`) ; ③ tuile **« Progression Donjons »** entre Rush Live et Ouvrir Overlay (dashboard + public), icône d'overlay **entre le compte et l'œil** (badge d'exigences restantes), panneau partagé desktop / mobile / PiP (`data-quality`) ; ④ responsive corrigé après retour : `flex` + `100dvh` mobile, `min-h-0` + `flex-1` (liste qui scrolle **dans** la modale), `pr-12` (croix ≠ compteur), cibles 44 px.
> **Preuves** : **770 fichiers / 8 098 tests ✅** · `tsc` 0 · lint 0 erreur · `rush-dungeons-overview` **8** · `-ui` **8** · Playwright **390/768/1024/1440** : `overflowBottom` **0**, overflow horizontal **0**, liste scrollable partout. Route testée : 94 donjons / 176 occurrences / 149 exigences (global : 100 / 202 / 175).
> **Reste** : PR ; 55 conseils → VPS. Le bruit console « script / hydratation » de la page publique est **préexistant** (au chargement, hors modale).
> **Rotation** : bloc « suite 27 » (retouches DA) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 19/11/2026 (suite 32) — **Rush · alias de donjons : 18 fantômes → 21 ids** — branche `fix/rush-donjons-alias` (PR **#1460**)

> **Demande user (verbatim)** : « on continue les chantiers rush sylvestre » — ordre posé : **18 alias → Bloc J → 55 conseils → VPS**.
> **Mesure** : Maïmane = **29 alternatives** (6 tags « A / B / C »), **11** dans `dungeonIds` ; sur 18 : **17 donjons du catalogue non liés** + **1 alias** (`Sanctuaire de Torkélonia` → `Torkélonia`). 2 autres alias : `Bibliothèque du Maître Corbac` → `maitre-corbac`, `Donjon de la mine de Sakaï` → `grolloum`. **Cause racine** : seed tronqué à **12** noms (`slice` + schéma Zod) et import par **égalité stricte**.
> **Fait** : ① règle pure `src/lib/rush-dungeon-names.ts` (découpe « / » + précision, `(niv. N)`, **3 alias mesurés**, nom exact > alias, union d'ids idempotente, plafond partagé **40**) ; ② import God — plafond 12 → 40, résolution **nom → boss → alias (slug)**, `knownDungeonNames` sur la même clé ; ③ seed Trame sur le plafond partagé ; ④ `scripts/fix-rush-dungeon-ids.ts` (dry-run → `--apply`, **sans retrait**, aucun donjon inventé) : **4 quêtes, 21 ids**, second passage **0**.
> **Preuves** : **768 fichiers / 8 082 tests ✅** · `tsc` 0 · lint 0 erreur · `rush-dungeon-names` **11** · `rush-import` **16** · `rush-trame-seed` **37** · `rush-import-typed-blocks` **6** · **139** tests donjons/parité · base locale : Maïmane **29 ids**, **6 groupes (4 + 5×5)**, `requiredBlocks` **6**, **0 fantôme**.
> **Reste / ops** : PR #1460 (CI à vérifier puis merge) ; **rejouer le script sur la bêta puis la prod** après déploiement ; régénérer `tougli-enriched.json` (hors dépôt) ; puis **Bloc J** → 55 conseils → VPS.
> **Rotation** : bloc « suite 26 » (`prereq_expr`) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 19/11/2026 (suite 31) — **Rush · Bloc I (succès de donjon) + coches unifiées** — branches `fix/succes-canonique` + `feat/rush-bloc-i-succes-donjon` + `fix/rush-succes-panneau-deslop`

> **Décisions user** : Q1 **unifier sur « Mes Succès »** ; Q2 **séparé** (guide interne = profil de guilde, guide public = profil visiteur) ; Q3 **sélecteur** si le personnage du guide n'est pas déclaré ; Q4 le faux « Donjon validé » **jamais listé** (les boss d'anomalie, les 4 doubles boss Frigost et la quête de Qu'Tan ne sont pas des donjons du rush) ; Q5 **guest en lecture seule** ; Q6 **RBAC strict** ; Q7 **2 PR**.
> **Fait — PR #1456 (`fix/succes-canonique`)** : `toggleDungeonAchievement` / `getDungeonAchievementStates` basculés sur **`UserDungeonProgress`** (`source: MANUAL`, `dungeonId`) ; `canViewSucces` en lecture + `canEditOwnSucces` en écriture ; `scripts/backfill-dungeon-achievements.ts` (dry-run par défaut, idempotent, sans suppression) ; fiche boss alignée (`canEdit`).
> **Fait — PR #1457 (`feat/rush-bloc-i-succes-donjon`)** : règle pure `rush-dungeon-achievements` ; catalogue public unique `src/server/dungeon-achievements.ts` ; panneau interne `getRushDungeonAchievementPanel` (séquence/donjon requis, personnage validé) + panneau visiteur `public-rush-achievements` + couture `_actions/public-dungeon-achievements` ; `DungeonAchievementsPanel` partagé, modale pleine Radix + mini-modale PiP (`data-quality` high/low, largeurs `min()`) ; `+` sur la carte donjon (requis + résolu uniquement, règle `canOpenDungeonAchievements`) câblé dans le dashboard, le guide public et l'overlay ; le guest voit le catalogue sans cocher ; le sélecteur visiteur résout le personnage déclaré.
> **Fait — PR #1458 (`fix/rush-succes-panneau-deslop`)** : retrait des points `+10` du panneau du guide (la fiche boss les garde) et de la case à cocher en lecture seule (guest / droit manquant) ; le verrou `rush-dungeon-achievements-ui` passe à **17**.
> **Preuves** : **767 fichiers / 8 068 tests ✅** · `tsc` 0 · lint 0 erreur · `boss-achievement-check` **17** · `rush-dungeon-achievements` **16** · `-public` **6** · `-ui` **17**.
> **Reste / ops** : **PR #1456 + #1457 + #1458 mergées** ; mesurer `UserDungeonAchievement` / `UserDungeonProgress` sur la bêta **et** la prod (la clé lecture seule ne les expose pas ; requête humaine ou verbe `counts-succes` à revoir) ; **après déploiement**, `npx -y tsx scripts/backfill-dungeon-achievements.ts` (dry-run → `--apply`) si les compteurs legacy > 0 ; deploy bêta puis re-mesure 494/238/32/19 ; **18 alias de donjons** (data) avant **Bloc J** ; puis 55 conseils, VPS.
> **Rotation** : bloc « suite 25 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 19/11/2026 (suite 30) — **Rush · DofusDex supprimé, 6 totems, toasts DA** — branche `fix/rush-dofusdex-bloc`

> **Demandes user (verbatim)** : « je ne veux plus des dofusdex explicatifs dans les guides c'est juste infect et inutile supprime » · « il y a 6 totems à récupérer, avec une liste de dj avec un dj au choix parmi les 6 totems » · « ça affiche bien 6/6 fait mais la notif est bugé non ? » · « TOUTES les notif toast coté navigateur (hors overlay) sont tjres pas à la DA ».
> **Mesures** : ① **13 blocs** portaient un tips « DofusDex officiel » de **463 à 1 956 caractères** (**228 lignes**) ; le pavé du bloc est rendu par le **cadre `ms.tips`** (pas par les tips de quête) ; ② Maïmane = **6 tags multi** (29 noms, **11 résolus en base**) → **3 groupes** seulement ; le **serveur** ne lisait pas `activityTags` → « **8 donjon(s) requis non fait(s)** » alors que 6/6 était fait ; ③ `AppToaster` global : `bg-card/90`, `rounded-2xl`, `backdrop-blur`.
> **Fait** : ① `RushDofusDexTip` **masque** la section officielle (plus de `<details>`) et garde Prérequis/Donjons ; ② `attachDungeonChoices` complète les groupes avec les **noms non résolus** (clé stable `nom:…`) → **6 groupes / 6 exigences** ; les compteurs des 3 surfaces annoncent `requiredBlocks` ; ③ serveur : `activityTags` chargé et transmis, `missingRequiredDungeons` (1 entrée par groupe) ; ④ `AppToaster` sous `[data-da="wakfu"]` + `.da-toaster`, CSS DA (matière + filet sémantique), idem route overlay.
> **Preuves** : `rush-dungeons-choix` **15/15** · `rush-dofusdex-tip` **9/9** · `toasts-da` **3/3** · **764 fichiers / 8 022 tests ✅** · `npx tsc --noEmit` **0** · lint **0 erreur** (7 791 warnings préexistants).
> **Reste / ops** : PR #1455 ; **18 noms** de donjons restent non résolus en base (alias data) mais le verrou est **correct** (6 totems) ; puis Bloc I → Bloc J → 55 conseils → VPS.
> **Rotation** : bloc « suite 24 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 19/11/2026 (suite 29) — **Rush · donjons « au choix » (Sufokia, Maïmane)** — branche `fix/rush-donjons-choix`

> **Demande user (verbatim)** : « https://www.dofuspourlesnoobs.com/le-disparu-de-sufokia.html **condition** et celle-ci …/les-totems-de-maimane.html **choix** — les 2 quêtes sont mal gérées actuellement, overlay et navigateur ».
> **Mesure** : payload = **7 tags `donjon` multi sur 174**, tous sur ces **deux** quêtes. Le seed écrit **un tag par groupe** (« A / B / C » + précision après `—`) et `dungeonIds` **à plat** (5 pour Sufokia, 12 pour Maïmane) : le verrou exigeait donc **tous** les donjons. Sufokia = 1 donjon **selon le niveau** (5 listés) ; Maïmane = **6 totems**, 3 à 5 donjons au choix par totem.
> **Fait** : ① règle pure `attachDungeonChoices` (overlay-utils) — un tag multi devient un **groupe** (`choix:N`, libellé = la précision), rapprochement **par nom normalisé**, fail-open si moins de 2 donjons résolus ; ② `sequenceDungeonProgress` expose `requiredBlocks` / `missingBlocks` / `choiceGroups`, un groupe étant satisfait dès **une** coche ; `missingRequiredDungeons` ne liste plus les alternatives d'un groupe satisfait ; ③ UI : le panneau compte les **exigences** (« N requis restants »), la carte donjon pose « … — un seul suffit » avant le groupe ; ④ **aucune migration, aucun réimport** (le groupement vit dans `activityTags`, déjà en base).
> **Preuves** : `rush-dungeons-choix` **13/13** · **118 tests ciblés** (donjons, parité, Ocre) · **762 fichiers / 8 008 tests ✅** · `npx tsc --noEmit` **0** · lint **0 erreur** (7 791 warnings préexistants).
> **Reste / ops** : PR ; sur Maïmane, **11/30 donjons sont en base** (12 au seed : G1 = 5, G2 = 4, G3 = 2) ⇒ 3 groupes sur 6 sont pris en compte (les 3 autres ignorés, fail-open) : la quête peut être débloquée avec **3 donjons** — à finir avec les **alias de donjons** (data, 19 à résoudre) ; puis Bloc I → Bloc J → 55 conseils → VPS.
> **Rotation** : bloc « suite 23 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 19/11/2026 (suite 28) — **Rush · UI-1 (Succès public + Dofus du bloc)** — branche `feat/rush-ui-1`

> **Demande user (verbatim)** : « commencer la prochaine session par `gh pr checks 1450`, merger si vert, puis `git fetch origin dev`… » ; « Ensuite : **UI-1 → Bloc I → Bloc J → 55 conseils → VPS** ».
> **Fait** : ① **#1450 mergée** (`dev 2d70019c`, CI **6/6 verte**, branche supprimée) ; ② **pastille Succès du guide public** — `SuccessChip` + `guideQuests` construit sur les **mêmes `questDbIds`** que le dashboard, verrouillé par `rush-public-parity` ; ③ **icône Dofus de l'overlay** — le médaillon de la barre de chapitre porte le **Dofus du bloc** (`getDofusMeta`, repli `etape.png`) et la liste des chapitres nomme chaque Dofus (parité dashboard/public) ; ④ **points fermés par la mesure** : DofusDex **déjà livré** (`PublicDofusProgressPanel` + `RushDofusDetailModal`), items **déjà couverts** (`ResourceImage` par id, **1 898 WebP**) ; ⑤ **compteur 448** : payload local **536 séquences / 0 info / 0 choix** ⇒ le public affiche **536** ; aucun chemin ne produit 448 — **à reproduire sur l'écran exact** ; ⑥ **monstres** : **742 tags de combat sans id**, **31 PNG** locaux ⇒ **lot data** (seed + proxy), pas UI.
> **Preuves** : `rush-public-parity` **51/51** · `rush-overlay-chapitre-bulles` **14/14** · `da-wakfu` **66/66** · **761 fichiers / 7 995 tests ✅** · `npx tsc --noEmit` **0** · lint **0 erreur** (7 791 warnings préexistants).
> **Reste / ops** : PR de `feat/rush-ui-1` ; **Bloc I** (succès de donjon) → **Bloc J** → **55 conseils** → **VPS** ; archivage + import `prereq_expr` (local **et** VPS) ; 3 alias de donjons.
> **Rotation** : bloc « suite 22 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.



