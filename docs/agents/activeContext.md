# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 24/11/2026 (suite 67) — **Rush : graphe DofusDB 2c-1 (données + fiche)** — branche `feat/rush-success-graph-2c-2026-11-24`

> **Demande user (verbatim)** : « et dofusdb peut aider ? » puis « vulgarise un peu stp voir comment on peut faire le mieux possible » et « reprend ».
> **Mesuré** : DofusDB est plus complet que le client pour les arêtes : **2 777** succès (`need`) et **1 984** quêtes (`startCriterion`), dont **5933 L'héritage de l'île brisée** (`need.achievements = 5925/5928/5931/5932`) **absent** de notre `achievements.json` client. Les exemples : **1048 Vert émeraude → 1036** via 1463→1462 ; **5222 Prologue → 1705 Six sur six** via la quête 2409 (`OA=1705`) ; **7761 En attendant le printemps → 5222/7760/5933** (override DPLN Dom de Pin) ; la quête 2489 porte `PO=27803`.
> **Fait** : `scripts/siphon-dofusdb-success-graph.mjs` (statique, `--check` de diff) · `public/game-data/success-graph.json` (600 Ko) · `rush-success-meta.json` (override 7761→5933) · `rush-success-graph` étendu (`questCriteria`, `successByQuestId`, `effectiveSuccessIds`, possessions, meta) · `SuccessChip` : état, prérequis **dérivés** et sous-prérequis dépliés, possessions séparées des ressources, date DofusDB · aucune migration.
> **Preuves** : **8 416 tests ✅** · `tsc` 0 · `lint` 0 erreur (7 802 warnings préexistants) · 6 tests DofusDB réels + 6 graphe + verrous `SuccessChip` · `--check` = « aucun écart ».
> **Reste** : **2c-2** cascade « Valider les prérequis » avec aperçu (écrit les quêtes de la route) · contrôle hebdo VPS (`--check` + Discord ops/Sentry + changelog membres) en phase 4 · phases 3/4/5 prochaine conversation.
> **Rotation** : bloc « suite 61 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 24/11/2026 (suite 66) — **Rush : graphe des succès 2b (données + fiche)** — branche `feat/rush-success-graph-2026-11-24`

> **Demande user (verbatim)** : « attention 6/6 est un exemple il n'y a pas que cet exemple à prendre en compte » puis « il y a des quêtes par exemple qui nécessite d'avoir déjà validé tel succès (qui comporte lui même des quêtes) et qui lui même nécessite d'avoir validé tel quêtes ».
> **Mesuré** : le client expose `OA=<achievementId>` (succès prérequis) en plus de `Qf` : **576** succès avec OA, **1 983** OA distincts. Dans le guide, **3** succès portent des OA (1705 Six sur six, 2298 La chevauchée fantastique, 7761 En attendant le printemps) et **61** succès sont des prérequis. Six sur six = 3 Qf (2048/2049/2050) + **11 OA** (10 dans le guide, **565 hors guide**). Le siphon ne gardait que `Qf` ; l'arête **quête → succès** n'est pas encore mesurée (support pur ajouté).
> **Fait** : `siphon-achievements.py` extrait `successIds` (2 775 succès, 576 avec OA) et `public/game-data/achievements.json` régénéré · `src/lib/rush-success-graph.ts` : succès **dérivé** (`Qf + OA`), cycles absorbés, hors guide, `successQuestLeaves`, `questSuccessPrerequisites` · `SuccessChip` : la fiche affiche l'état du succès (`validé / en attente / hors guide`) et la section **« Succès prérequis x/y »** avec l'état de chaque OA · aucune migration.
> **Preuves** : **8 410 tests ✅** · `tsc` 0 · `lint` 0 erreur (7 801 warnings préexistants) · 6 tests `rush-success-graph` + verrous `SuccessChip`.
> **Reste** : **2c** cascade « Valider les prérequis » avec aperçu (écrit les quêtes du guide) · arête quête → succès (source client/tag) · PR 2b à ouvrir · Phases 3/4/5 prochaine conversation.
> **Rotation** : bloc « suite 60 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 24/11/2026 (suite 65) — **Rush : route d'alignement unique** — branche `feat/rush-route-alignement-2026-11-24`

> **Demande user (verbatim)** : « attaque par contre te plante pas avec ce qu'on avait statué » puis « je valide » la route d'alignement.
> **Mesuré** : le profil local Wylan a `alignmentOrder = attentif` ; `MilestoneRow` cachait « Valider » dès qu'un Ordre était sélectionné (`!orderKey`) et le serveur validait **tout le milestone** (autres Ordres compris). La page projetait déjà la route (`resolveRushRoute` camp/Ordre/classe) ; le filtre d'Ordre par bloc était redondant. L'overlay décochait tout le chapitre par le nœud.
> **Fait** : panneau unique `RushAlignmentPanel` (cité / Ordre / palier 20-100 ; badge statique et dropdown masqué quand l'Ordre est terminé ; panneau masqué quand cité 100 + Ordre fait) · `RushOrderSelect` `allowAll` (plus de « Tous » pour un choix de route) · `toggleMilestoneProgress(..., scopeSeqIds)` : cascade, donjons et ressources **sur le périmètre**, `completedSteps` en union, `isCompleted` stocké = bloc entier, événement guilde seulement si bloc entier · complétude de bloc dérivée des séquences de route (dashboard + overlay) · overlay : nœud du chapitre = validation seule, reset dédié · `RushOrderSelect` retiré des blocs.
> **Preuves** : **8 404 tests ✅** · `tsc` 0 · `lint` 0 erreur (7 802 warnings préexistants) · 1 test de source `rush-route-alignment` + 12 cascade (périmètre) · aucune migration.
> **Reste** : **graphe des dépendances quête ↔ succès** (siphon OA, quête→succès, succès dérivé, aperçu/cascade) · PR route à ouvrir · Phases 3/4/5 prochaine conversation.
> **Rotation** : bloc « suite 59 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.



## 📝 Session 23/11/2026 (suite 64) — **Rush : plan consolidé 28 points, décisions 16-21, début phase 1** — branche `feat/rush-progression-2026-11-23`

> **Demande user (verbatim)** : « documente/maj les contexte la totalité avant non ? commit puis démarre la phase 1 ».
> **Décisions** : ① validation de bloc = **cascade montante** des prérequis (un seul par groupe « OU ») + **coche des donjons requis** (un par groupe « au choix ») ; ② **reset bloc/guide** recalcule la fermeture des blocs validés, **retire** les prérequis qui ne sont plus impliqués et **efface les donjons** du personnage ; ③ dévalider un bloc **laisse** les donjons ; ④ la modale Dofus « Avancement », la modale « Progression Donjons » (statut par membre) et la coche du sommaire se recalculent après chaque mutation, pour le personnage ciblé ; ⑤ overlay = bouton **« Réinitialiser »** du bloc ; ⑥ célébration unifiée (bloc = toast, chapitre = burst) ; ⑦ **choix Brak 55/66** = carte claire + éditable God ; ⑧ **mode blanc** prioritaire sur G7/G9 ; ⑨ **E2 écarté** (pas de migration) ; ⑩ **itérations 5/6 supprimées** ; ⑪ **prod en attente**.
> **Mesuré** : 117 Brâkmarien local = **102 série + 15 Ordres** (3×5) ; le 121 est le compte brut, pas un doublon. **0 constraints réelles** en local ; **29 conseils** (7+22, bêta 49) ; **742 tags combat** (bêta 746) ; **6 positions** des quêtes ajoutées (local fait, bêta à vérifier ; 894 sans source) ; DPLN **0 à mettre à jour** (532) ; **bêta 540 / local 541** ; 20 `createContext` dans `RushTimelineClient` ; `resetMilestoneProgress`/`resetGuideProgress` **n'effacent pas** `PlayerGuideDungeonState` ; `dungeonsCommunity` chargé **une fois** ; la modale Dofus lit `guildProgress` serveur, pas l'état local.
> **Fait (docs + Phase 1)** : fiche unique §H (plan 28 points/5 phases + décisions), ROADMAP §0 + rangs 9/10/10b/55/59/64 + §3 bis, `REFONTE-EDITEUR-RUSH` (choix Brak), `ROUTE-RUSH-ISO-TOUGLI` (itérations supprimées), `MAINTENANCE` (positions DPLN ≠ manuelles) · **Phase 1A serveur** : cascade montante (`rush-prereq-cascade`), donjons requis (`rush-block-dungeons`), resets qui effacent les donjons, retrait des prérequis orphelins · **Phase 1B UI** : projection `memberCompletedStepKeys` (bloc `isCompleted` = toutes ses quêtes), statut par membre dans la modale Donjons, relecture de la communauté, reset du bloc dans l'overlay, célébration réservée aux fins de chapitre, `refresh` des donjons après chaque mutation · **PR #1525** (CI verte).
> **Preuves** : **27 tests neufs** (12 cascade + 6 donjons + 2 projections + 7 verrous source) · `tsc` 0 · **8 397 tests ✅** · `lint` 0 erreur (7 796 warnings préexistants) · **CI #1525 verte** · aucune migration.
> **Reste** : Phase 2 (mode blanc, fiche quête, choix Brak + God) · Phase 3 données (6 positions bêta, 894, 514, 1 085 contraintes, 98 conseils, combats) · ops/prod en attente.
> **Rotation** : bloc « suite 58 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 23/11/2026 (suite 63) — **Rush : audit Tougli/Dofusyelle, hygiène, fiche des succès, quêtes, aide, fiche détail** — branches `fix/rush-hygiene-2026-11-23` + `feat/rush-succes-quetes-2026-11-23` + `feat/rush-quetes-oubliees-2026-11-23` + `feat/rush-aide-navigateur-2026-11-23` + `feat/rush-detail-succes-toast-2026-11-23`

> **Demande user (verbatim)** : « on focus tous les chantiers restant sur le rush sylvestre » puis « recouper avec le guide du streamer lanyielle (dofusyelle) en + de tougli ».
> **Mesuré** : compteur **515** identique local/bêta (29/515 = 6 %, 26/515 = 5 %, blocs 0/8 et 12/12) ⇒ « 448 » périmé, **lot clos par mesure**. Tougli API (`docs/reference/TOUGLI-API.md`) = **530 quêtes**, exactement les **530 `questDbIds`** du guide (0 écart) ⇒ l'oubli est **dans Tougli**. Dofusyelle (`window.RUSH_DATA`) = **6 quêtes réellement absentes** : L'histoire en mouvement · Mieux vaut ne pas se fier à la première impression · Full Contact · La destinée · La fatalité · L'arme fatale. **2 faux positifs** (596 et 2488 déjà dans le guide) ; « Quête de classe » couverte par les 19 variantes du guide ; 626 (2 quêtes du guide) ajouté au checkup. **114 quêtes** liées aux **72 succès** manquent dans le guide ; la fiche n'affichait que les présentes (0/0) — **corrigé par #1518** ; bêta en retard (3/4 en local, 0/0 sur la bêta).
> **Fait** : fiche + roadmap mises à jour (compteur clos, O5/O9/O11 rayés, overlay large validé, accents cadrés) · `use-optimistic-toggle.ts` supprimé (0 import) · `CompletedStepsCtx` retiré (jamais lu) · branche obsolète `fix/rush-carte-copie-details-2026-11-22` supprimée · **PR #1518** : fiche des succès (toutes les quêtes, **noms via `quest-names.json`**, **19 variantes de classe filtrées**, badge « hors guide », compteur réel, icône trophée) + règle pure `rush-success-quests` (11 tests) · **script `add-rush-missing-quests`** (6 quêtes, dry-run/--apply, **bloc résolu par l'ancre**, tags `prereq_text` avec id de séquence, données locales appliquées) · **checkup prérequis** (`scripts/fix-rush-prerequisites.ts`, dry-run/--apply) : **37 arêtes** (9 client + 28 DofusDB) + **626**, données locales appliquées, re-mesure **0 manquant** · **aide navigateur** : bulle portée dans le `body` en `fixed` (clamp 390/768/1024/1440), ajouts Ordre + bloc, 6 tests · **fiche détail + toast** : `SuccessChip` (z-120, Échap/focus/PiP, une pastille par succès), croix du toast retour (PR #1522) · **Bêta 23/11** : code `latest` + données appliquées (6 quêtes + 626 + 39 tags), **540 séquences**, `quest-names.json` 200, idempotence no-op ; contrôle visuel à faire.
> **Preuves** : PR **#1517** mergée et PR **#1518** (correctifs de revue + noms/classes) · **8 372 tests** · `tsc` 0 · `lint` 0 erreur (7 795 warnings préexistants) · aucune migration.
> **Reste** : **prod** : import Tougli puis scripts (6 quêtes + 37 arêtes + 626), release `main` pour les nouvelles fiches UI · **contrôle visuel bêta** · positions 894/710/711/1939/626 · perf T-6/G6.
> **Rotation** : bloc « suite 57 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 23/11/2026 (suite 62) — **Harnais : sortie de Cline terminée** — branche `refactor/harnais-sortie-cline-2026-11-23`

> **Demande user (verbatim)** : « PR 1 puis PR 2 d'affilée » puis « feu vert ».
> **Mesuré** : la jonction `.cline/skills` de la PR 1 a cassé un `git switch` vers un commit antérieur — git a restauré `.cline/skills/*` sous la jonction en supprimant la nouvelle source ; réparé par `git restore`. Les 3 hooks `.ps1` coûtaient 22 s de `harness-config` pour une politique déjà exprimable par `opencode.json`.
> **Fait** : PR 1 **#1510** (source `.agents/skills`, `harness:links` idempotent + `--check`, CI, 4 tests repointés) · PR 2 (règles → `docs/agents/rules`, hooks supprimés, `.clineignore` supprimé, lien `.cline/skills` retiré, écriture `.env` par commande et `git push --force`/`-f` en `deny`) · test des garde-fous par **matrice de commandes** (dernière règle gagnante) · script `harness:links` testé (dossier vide/plein, `--check`).
> **Preuves** : **809 fichiers / 8 346 tests ✅** · `harness-config` 16/16 · `harness:links` 1/1 + `--check` · export sans lien → recréé, 12 skills · `tsc` 0 · `lint` 0 erreur · CI #1510 verte · relecture `reviewer` : 1 bloquant + 3 importants corrigés.
> **Reste** : Cline désinstallé et `~/.cline` supprimé (1,27 Go libérés) · permissions rechargées **sans redémarrage** (config à chaud ; vérifié : écriture `.env` refusée).
> **Suite (même session) — PR #1512** : `.github/pull_request_template.md` (6 sections) · règle « réussi si » dans `git-push.md` §8 et `AGENTS.md` §7.6 · garde `harness-config` 17/17.
> **Suite 2 (même session) — PR #1513** : mutation testing Stryker **9.6** (pilote `rush-overlay-layout`, **18/18 mutants tués**, 23 s, hors CI) · `reviewer` borné (`node_modules` interdit, ~40 appels) après une revue à 6 min / 145 k tokens.
> **Rotation** : bloc « suite 56 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.




