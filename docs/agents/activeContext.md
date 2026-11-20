# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 20/11/2026 (suite 39) — **Rush · enrichissement du guide existant (itération 3b : conseils + monstres)** — branche `feat/rush-contenu-2026-11-20`

> **Demande user (verbatim)** : « il faut le mode “mise à jour” de l'import (dry-run + apply, sans écraser les textes God) — c'est ce qui fera apparaître monstres et conseils sur les 494/536 existantes ».
> **Mesure (base locale, lecture seule)** : guide **536 séquences · 530 `tips` vides / 6 pleins · 742 tags de combat, 742 sans `monsters`** ; payload enrichi (`src/temp/rush-seed/tougli-enriched.json`) : **36 blocs / 536 séquences / 49 conseils / 742 tags combat dont 737 porteurs de monstres** ; rapprochement **(bloc, nom)** normalisé : **536/536**.
> **Fait** : règle pure `rush-content-sync` (`planRushContentSync`, `summarize…`, `isRushContentSyncNoop`) — un conseil n'est écrit **que si `tips` est vide** (un texte God différent est compté « protégé »), un tag de combat qui porte **déjà** ses monstres n'est jamais remplacé, **aucun tag ajouté ni supprimé**, les 5 groupes non résolus restent **signalés** ; action God `syncRushGuideContent(raw, apply)` (**dry-run par défaut**, schéma Zod **partagé** avec l'import, rate limit, lots de 100, `logGodWrite`, revalidation `/god` + `/guides` + `/dashboard`) ; **même payload** que l'import : la modale « JSON » analyse l'import **et** l'enrichissement, bouton **« Enrichir l'existant (N) »**. L'import garde sa garde « aucun `.update(` » (`rush-import.test.ts:241`), donc rien n'a été affaibli.
> **Preuves** : dry-run réel sur la base locale : **374 séquences · 43 conseils · 737 tags · 1 518 monstres · 5 groupes non résolus · 0 non apparié** · `rush-content-sync` **17 tests** ✅ · **774 fichiers / 8 148 tests ✅** · `tsc` 0 · ESLint **0 erreur** · aucune migration.
> **Reste** : **bêta** (deploy `8a243ddf` → import → Positions → **Enrichir l'existant** → re-mesure) ; 6 pages sans position + 3 séquences sans `questDbIds` ; itérations 4/5/6 ; prod.
> **Rotation** : bloc « suite 33 » (Bloc J) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 20/11/2026 (suite 38) — **Rush · synchro des positions DPLN en base (itération 3a)** — branche `feat/rush-positions-sync-2026-11-20`

> **Demande user (verbatim)** : « on est bloqué partout ? on fait comment? » — l'import God restait sur « Rien à créer » et les icônes position/zaap ne s'affichaient pas.
> **Mesure (base locale, lecture seule)** : guide **536 séquences · 533 `questDbIds` · 0 `pos_tags`** ; plan de synchro **527 à mettre à jour**, **0 déjà à jour**, **9 sans position** — 6 pages sans position (622, 623, 1528, 1629, 1630, 1938) + 3 séquences sans id (Démons et merveilles, Quêtes de Silvosse, En attendant le printemps) ; « Faire le mort » → `[-26,36]`.
> **Fait** : règle pure `rush-quest-positions` (`buildRushPositionTag`, `planRushPositionSync`, `summarize…`) — tag remplacé/ajouté **en place**, `allowZaap` explicite et **zaap manuel** `zaapX/zaapY` conservés, entrées non mutées, idempotente ; action God `syncRushPositions` (**dry-run par défaut**, rate limit, lots de 100, `logGodWrite`, revalidation `/god` + `/guides` + `/dashboard`) ; bouton **Positions** + modale dans `RushEditorStudio` (aucun fichier God neuf) ; le seed consomme la même règle.
> **Preuves** : **13 tests** `rush-position-sync` ✅ · ciblés **91/91** · `tsc` 0 · ESLint 0 erreur · plan local **527/9** · « Faire le mort » `[-26,36]` · aucune migration.
> **Reste** : **Positions appliquées en local** (527 tags ; bêta après déploiement) ; 6 pages sans position à compléter à la main ; 3 séquences sans `questDbIds` à rattacher ; 2a/2b (monstres/conseils) non appliqués en base — l'import reste additif, l'enrichissement de l'existant arrive en 3b (bloc 39).
> **Rotation** : bloc « suite 32 » (alias de donjons) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

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



