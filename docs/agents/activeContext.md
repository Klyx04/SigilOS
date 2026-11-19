# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 19/11/2026 (suite 37) — **Rush · positions de lancement (itération 2c)** — branche `feat/rush-positions-2026-11-19`

> **Demande user (verbatim)** : « toutes les positions de lancement de quete? on les affiche pas actuellement ».
> **Mesure** : la trame Tougli n'a aucune position ; `DofusQuestEntry` ne couvre que 199/552 quêtes (17 positions monde, 125 PNJ) ; DPLN expose la position en ligne du haut **ou dans le corps** (ex. 1859 « Faire le mort » → `[-26,36]`) ; 6 pages n'ont aucune position écrite (622, 623, 1528, 1629, 1630, 1938) ; **alignement 233/233, Ordres 30/30, classes 19/19**.
> **Fait** : siphon `--only` sur les 15 pages + fallback `.paragraph` + `DofusQuestEntry` ⇒ **524 / 530** (515 ligne du haut + **9 reprises corps**, dont Faire le mort) ; `allowZaap` vrai + `worldId` 1 (les champs du studio God), zaap le plus proche résolu par `resolveMapWorldAction` ; `showIcon` + zaap sur les 3 surfaces ; `pos_tags` après les ressources (863 intactes), **525 tags** (une jumelle).
> **Preuves** : carte 524 · **772 fichiers / 8 118 tests ✅** · `tsc` 0 · `rush-trame-seed` **41** · `rush-quest-positions` **5** · ressources **863** intactes · aucune migration.
> **Reste** : 6 pages sans position (622, 623, 1528, 1629, 1630, 1938) — à compléter à la main ; import du guide (itération 3) pour voir les positions en base.
> **Rotation** : bloc « suite 31 » (Bloc I) sorti (7ᵉ).



## 📝 Session 19/11/2026 (suite 36) — **Rush · 55 conseils (itération 2b)** — branche `feat/rush-conseils-2026-11-19`

> **Demande user (verbatim)** : « toutes les conseils c quoi ? tougli ou dofusyelle? » ; « oui étape par étape go ».
> **Mesure** : le rapport listait **55** conseils — **50 étapes Dofusyelle** + **5 notes de blocs Tougli** ; 3 étapes (7, 35, 53) partageaient une quête et étaient comptées « à rédiger ».
> **Fait** : contenu dans `src/data/rush-guide-tips.json` (`yelle` = 50 paraphrases, `blocks` = 5 notes) ; `YELLE_DEMO_TIPS` / `TOUGLI_BLOCK_TIPS` branchés sur le seed ; les conseils d'une même quête sont **ajoutés à la suite** (pas d'écrasement) ; les étapes sans cible (1, 41, 46, 50) sont posées sur le bloc de leur catégorie ; `tipsToWrite` ne liste plus un conseil écrit ; `blockTip` alimente les 5 blocs.
> **Preuves** : rapport **0 conseil à rédiger** · **56 fusions Yelle** (55 conseils, 3 partagés) + **5 blocs** · **771 fichiers / 8 112 tests ✅** · `tsc` 0 · `rush-trame-seed` **40** · aucune migration.
> **Reste** : positions (2c — siphon DPLN à décider) ; import du guide (itération 3) pour voir les conseils en base.
> **Rotation** : bloc « suite 30 » (DofusDex, 6 totems, toasts DA) sorti (7ᵉ).



## 📝 Session 19/11/2026 (suite 35) — **Rush · monstres des combats (itération 2a)** — branche `feat/rush-monstres-2026-11-19`

> **Demande user (verbatim)** : « avec la maj des monstres et leur images fiche cliquable etc, pour l'interne vers l'interne pour le visiteur faire fiche visiteur » ; « oui étape par étape go ».
> **Mesures** : 742 tags de combat = **1 443 noms bruts**, **1 518 noms individuels** après nettoyage ; la source écrit des groupes (`A, B, C`, préfixes `groupe ·` / `soloV ·`) ; carte générée depuis `unity-bestiary.json` (5 129 monstres, **4 612 clés**) ⇒ **1 518 monstres, 100 % résolus** (3 alias mesurés : Chaffoin le Sourn, Garde Bwork Élémental d'Ai, Aventurier injuri) ; **737 / 742** tags portent leur liste.
> **Fait** : règle pure `rush-combat-monsters` + carte `src/data/rush-monster-map.json` (script `build-rush-monster-map.ts`) ; le seed écrit `monsters` (schéma d'import borné) ; badge « Groupe · N monstres », images proxy, **fiche interne** (`RushMonsterFicheModal` → `MonsterFicheView`, chargée à la demande) et **fiche publique** `/bestiaire/<slug>` ; `viewer` member / visitor / preview sur les 4 surfaces.
> **Preuves** : **771 fichiers / 8 110 tests ✅** · `tsc` 0 · lint 0 erreur · `rush-combat-monsters` **8** · `rush-trame-seed` **38** · `rush-tag-overflow` **4** · `harness-config` **9** · ROADMAP **61 376 o** (< 60 Kio).
> **Reste** : 55 conseils (2b) puis positions (2c — siphon DPLN à décider) ; l'import du guide (itération 3) est requis pour voir les monstres en base.
> **Rotation** : bloc « suite 29 » (donjons au choix) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.



## 📝 Session 19/11/2026 (suite 34) — **Rush · itération 1 : état documentaire aligné** — branche `docs/rush-etat-aligne-2026-11-19`

> **Demande user (verbatim)** : « fais 1 et 2 pour commencer » — itération 1 = docs, itération 2 = contenu (55 conseils + monstres + positions).
> **Mesures (base locale, 19/11)** : guide **36 blocs / 536 séquences** · **0** page `/q` publiée · **0** `constraints` · **0** tag `prereq_expr` (seed importé antérieur à l'OU) · **6** tips de quête / **23** de bloc · **742** tags combat sans id (404 `combat_solo` + 338 `combat_plusieurs`) · **55** conseils à rédiger (50 quêtes + 5 blocs). Bêta : **494/238/32/19**, migrations à jour (`20270207000001`), code non déployé.
> **Fait** : #1462 **déjà mergée** (`dev 88146076`) ; docs recalées — ROADMAP (55 conseils, V-D2, file V-D2, notifications, migrations V4), MODULE §T/§5 (O15/G8 livrés, 3 donjons soldés, 4 étapes/3 succès, cache = code, mesures), ROUTE §10/§12 (536, `prereq_expr` = 0, monstres 742), REFONTE (E3c livré, E2a abandonné).
> **Preuves** : `git status` propre · docs uniquement · aucun code, aucune migration.
> **Reste** : itération 2 — 55 conseils (Dofusyelle, paraphrases), monstres (742 tags → ids + images + fiches interne/visiteur), positions de lancement (`GameQuest.posX/posY/npcName` via `questDbIds`), puis VPS.
> **Rotation** : bloc « suite 28 » (UI-1) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.



## 📝 Session 19/11/2026 (suite 33) — **Rush · Bloc J « Progression Donjons »** — branche `feat/rush-bloc-j-progression-donjons`

> **Demandes user (verbatim)** : « bloc j / tu décales rush live et ouvrir overlay à droite et tu le mets entre les 2 / responsive / idem guides visiteurs connecté / non connecté / même chose dans l'overlay / oublie pas les assets » ; puis « pk tu manges l'écran en bas ? où est le skill responsive ? ».
> **Fait** : ① règle pure `rush-dungeons-overview` — **occurrences** `sequenceId::dungeonKey`, groupes « au choix » = **1 exigence**, rollups `x/y étapes`, `m/M membres`, filtres état/étape/repères/recherche, **option A** = bloc du repère + « Tout déplier » ; ② action bornée `getRushDungeonsCommunity` (3 requêtes plafonnées, fail-closed) + couture `_actions/public-rush-dungeons` (le client public n'importe **aucun** `@/server/`) ; ③ tuile **« Progression Donjons »** entre Rush Live et Ouvrir Overlay (dashboard + public), icône d'overlay **entre le compte et l'œil** (badge d'exigences restantes), panneau partagé desktop / mobile / PiP (`data-quality`) ; ④ responsive corrigé après retour : `flex` + `100dvh` mobile, `min-h-0` + `flex-1` (liste qui scrolle **dans** la modale), `pr-12` (croix ≠ compteur), cibles 44 px.
> **Preuves** : **770 fichiers / 8 098 tests ✅** (avant la passe DA) · `tsc` 0 · lint 0 erreur · `rush-dungeons-overview` **10** · `-ui` **8** · `da-wakfu` **66** · Playwright **390/768/1024/1440** : `overflowBottom` **0**, overflow horizontal **0**, liste scrollable partout. Route testée : 94 donjons / 176 occurrences / 149 exigences (global : 100 / 202 / 175). **Correctif 19/11** : groupement **par bloc** (un donjon multi-blocs apparaît dans chaque accordéon, plus de faux sous-blocs), sélecteur d'étape DA (plus de `<select>` natif), modale d'alignement élargie.
> **Reste** : **PR #1461 mergée** (`dev 971b26d2`, CI 6/6, branche supprimée) ; prochaine session : **55 conseils → VPS**. Décision user : **pas de post donjon/quête dans l'overlay PiP** (« trop lourd », `DjPostCreateModal` n'a pas de `portalContainer`) — le clic donjon → post existe sur le **dashboard** (donjon + quête préremplis). Le bruit console « script / hydratation » de la page publique est **préexistant** (au chargement, hors modale).
> **Rotation** : bloc « suite 27 » (retouches DA) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 19/11/2026 (suite 32) — **Rush · alias de donjons : 18 fantômes → 21 ids** — branche `fix/rush-donjons-alias` (PR **#1460**)

> **Demande user (verbatim)** : « on continue les chantiers rush sylvestre » — ordre posé : **18 alias → Bloc J → 55 conseils → VPS**.
> **Mesure** : Maïmane = **29 alternatives** (6 tags « A / B / C »), **11** dans `dungeonIds` ; sur 18 : **17 donjons du catalogue non liés** + **1 alias** (`Sanctuaire de Torkélonia` → `Torkélonia`). 2 autres alias : `Bibliothèque du Maître Corbac` → `maitre-corbac`, `Donjon de la mine de Sakaï` → `grolloum`. **Cause racine** : seed tronqué à **12** noms (`slice` + schéma Zod) et import par **égalité stricte**.
> **Fait** : ① règle pure `src/lib/rush-dungeon-names.ts` (découpe « / » + précision, `(niv. N)`, **3 alias mesurés**, nom exact > alias, union d'ids idempotente, plafond partagé **40**) ; ② import God — plafond 12 → 40, résolution **nom → boss → alias (slug)**, `knownDungeonNames` sur la même clé ; ③ seed Trame sur le plafond partagé ; ④ `scripts/fix-rush-dungeon-ids.ts` (dry-run → `--apply`, **sans retrait**, aucun donjon inventé) : **4 quêtes, 21 ids**, second passage **0**.
> **Preuves** : **768 fichiers / 8 082 tests ✅** · `tsc` 0 · lint 0 erreur · `rush-dungeon-names` **11** · `rush-import` **16** · `rush-trame-seed` **37** · `rush-import-typed-blocks` **6** · **139** tests donjons/parité · base locale : Maïmane **29 ids**, **6 groupes (4 + 5×5)**, `requiredBlocks` **6**, **0 fantôme**.
> **Reste / ops** : PR #1460 (CI à vérifier puis merge) ; **rejouer le script sur la bêta puis la prod** après déploiement ; régénérer `tougli-enriched.json` (hors dépôt) ; puis **Bloc J** → 55 conseils → VPS.
> **Rotation** : bloc « suite 26 » (`prereq_expr`) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.








