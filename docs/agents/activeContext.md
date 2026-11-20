# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 20/11/2026 (suite 42) — **Rush · UI (icônes, blocs, fiche Dofus), temps réel et verrou du bloc** — branche `fix/rush-live-progress-2026-11-20` (PR #1473)

> **Demandes user (verbatim)** : « les blocs soient dépliés », « les dj doublés avec une icône placeholder », « laisse afficher le zaap », « la vraie icône succès », « ali 17 brak 3 quêtes au choix », « 173 dj public / 143 interne », « valider par bloc aussi, sans erreur ».
> **Livré (mergé)** : **#1471** (5 positions : La fonte des glaces `[-60,-57]` zaap `-78,-41`, Lavomatique, C'est frais…, Une âme en peine, Temple Sadida ; icône succès `icone-succes.png` ; donjons « (niv. 50) » dédoublonnés par `mergeRushChapterDungeons`) · **#1472** (icône de quête réelle `questTypeIconPath("secondaire")` — **0/536** séquences du seed n'ont d'icône ; onglet **Quêtes/Avancement** ; Dofus terminé = bordure + pastille ; **blocs dépliés par défaut** public + interne).
> **PR #1473** : temps réel (refresh serveur débouncé **900 ms** après validation locale et sur `step:validated`/`batch`/`milestone:completed`) · **projection ids de séquence → clés d'étape** (`projectRushStepKeys`, `rushStepKeysBySequenceId`) — la base stocke des ids, la modale attendait `GPx-N`, d'où **0/8 avec 4 blocs terminés** · **bloc sans verrou** : `toggleMilestoneProgress` ne consulte plus donjon/prérequis (décision user : 500+ coches sinon), la validation quête par quête garde les deux gardes ; le toast affiche `res.error` au lieu de « Erreur ».
> **Mesures** : base locale **4 blocs terminés / 9 avec étapes** (Wylan) · compteurs donjons **99 / 202 / 175** (173/143 non reproduits) · Ali 17 = prérequis unique « D'égout pillé » (DPLN) · WebSocket local = `npm run ws` (port 3001), **non lancé** par `npm run dev`.
> **Preuves** : `rush-chapter-dungeons` 6 · `rush-blocks-expanded` 2 · `rush-live-refresh` 3 · `rush-dofus-progress-projection` 4 · `rush-public-parity` 51 · `tsc` 0 · lint 0 erreur · aucune migration.
> **Reste** : merger **#1473** puis **redéployer la bêta** · **173 vs 143** (écran exact à fournir) · **3 succès** à marquer dans God · **6 quêtes sans position** (5 des 11 traitées) · **itérations 5/6**.
> **Rotation** : bloc « suite 36 » (55 conseils) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 20/11/2026 (suite 41) — **Rush · revalidations du contenu (itération 4)** — branche `fix/rush-revalidations-2026-11-20`

> **Demande user (verbatim)** : « avance sur l'itération 4 » — le public voyait l'ancien guide jusqu'à 1 h après une modification God.
> **Mesure** : page publique en **ISR 1 h** (`revalidate = 3600`) ; sur 49 actions qui écrivent, **20 actions de contenu Rush** ne revalidaient pas la page publique (10 n'avaient que God + dashboard, 4 n'avaient rien, 6 avaient un triplet dupliqué) ; les actions de progression (14) n'ont pas à la revalider.
> **Fait** : helper **non exporté** `revalidateRushContent()` (publique + dashboard + God) — un export dans un fichier `"use server"` casserait le build ; les **20 actions de contenu** l'utilisent (import, upsert, delete, reorder, seed, route, UI, settings, move, bulk ×3, split, sync ×2, duplicate ×2) ; doublons retirés ; `publishRushSequence` garde ses pages `/q` ; les actions de progression sont inchangées.
> **Preuves** : `rush-revalidations` **5 tests** ✅ · ciblés Rush **51** ✅ · **777 fichiers / 8 165 tests ✅** · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Reste** : 11 quêtes sans position (8 directes + 3 sans `questDbIds`) à saisir dans God ; itérations 5/6.
> **Rotation** : bloc « suite 35 » (monstres 2a) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 20/11/2026 (suite 40) — **Harnais · runbook d'ops VPS (fin du bricolage)** — branche `ops/vps-runbook`

> **Demande user (verbatim)** : « on peut arrêter le bricolage et statuer sur du long terme quand ya besoin de faire ce genre de manip sur le vps via un skills ou autre dans le harnais ? c'est quoi la best practice cutting edge ? » puis « livre oui ».
> **Mesure (incident réel)** : `docker compose exec app-beta node scripts/archive-rush-guide.mjs` échoue sur `@prisma/driver-adapter-utils`, puis `postgres-array` — l'image `runner` est un standalone Next, elle n'embarque pas les dépendances des outils d'admin. Deux commandes ad hoc avaient aussi échoué sur les noms de services (`db`, `app` au lieu de `db-beta`, `app-beta`).
> **Fait** : stage Docker `ops` (deps + `prisma generate`, sans build Next) · services `ops-beta`/`ops-prod` (profil `ops`, jamais démarrés par `up`) · `scripts/ops/vps.sh` (verbes fermés : `dump`, `rush-archive`, `rush-delete-archive`, `rush-verify` ; dry-run par défaut, `--apply` seul mot qui écrit, garde `rush-sylvestre-archive-*`, refus d'un dump vide, journal `~/backups/ops.log`) · skill `.cline/skills/vps-ops/` (routeur : interdit `exec app-*`, impose dump → dry-run → apply → verify → rollback) · `docs/agents/vps-ops.md` · `AGENTS.md` §2 · `MAINTENANCE.md` § Rush réécrit · `vps-read-only.md` recalé.
> **Preuves** : `ops-runbook` **10 tests** ✅ · `bash -n` OK (script converti en LF) · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Reste** : le runbook n'est pas encore utilisé sur la bêta (la remise à zéro s'est faite via SQL testé) ; au prochain déploiement bêta, `./scripts/ops/vps.sh rush-archive beta` remplace les commandes manuelles.
> **Rotation** : bloc « suite 34 » (itération 1) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

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












