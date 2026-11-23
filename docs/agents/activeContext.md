# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 23/11/2026 (suite 63) — **Rush : audit Tougli/Dofusyelle, hygiène, fiche des succès, quêtes, aide** — branches `fix/rush-hygiene-2026-11-23` + `feat/rush-succes-quetes-2026-11-23` + `feat/rush-quetes-oubliees-2026-11-23` + `feat/rush-aide-navigateur-2026-11-23`

> **Demande user (verbatim)** : « on focus tous les chantiers restant sur le rush sylvestre » puis « recouper avec le guide du streamer lanyielle (dofusyelle) en + de tougli ».
> **Mesuré** : compteur **515** identique local/bêta (29/515 = 6 %, 26/515 = 5 %, blocs 0/8 et 12/12) ⇒ « 448 » périmé, **lot clos par mesure**. Tougli API (`docs/reference/TOUGLI-API.md`) = **530 quêtes**, exactement les **530 `questDbIds`** du guide (0 écart) ⇒ l'oubli est **dans Tougli**. Dofusyelle (`window.RUSH_DATA`) = **6 quêtes réellement absentes** : L'histoire en mouvement · Mieux vaut ne pas se fier à la première impression · Full Contact · La destinée · La fatalité · L'arme fatale. **2 faux positifs** (596 et 2488 déjà dans le guide) ; « Quête de classe » couverte par les 19 variantes du guide ; 626 (2 quêtes du guide) ajouté au checkup. **114 quêtes** liées aux **72 succès** manquent dans le guide ; la fiche n'affichait que les présentes (0/0) — **corrigé par #1518** ; bêta en retard (3/4 en local, 0/0 sur la bêta).
> **Fait** : fiche + roadmap mises à jour (compteur clos, O5/O9/O11 rayés, overlay large validé, accents cadrés) · `use-optimistic-toggle.ts` supprimé (0 import) · `CompletedStepsCtx` retiré (jamais lu) · branche obsolète `fix/rush-carte-copie-details-2026-11-22` supprimée · **PR #1518** : fiche des succès (toutes les quêtes, **noms via `quest-names.json`**, **19 variantes de classe filtrées**, badge « hors guide », compteur réel, icône trophée) + règle pure `rush-success-quests` (11 tests) · **script `add-rush-missing-quests`** (6 quêtes, dry-run/--apply, **bloc résolu par l'ancre**, tags `prereq_text` avec id de séquence, données locales appliquées) · **checkup prérequis** (`scripts/fix-rush-prerequisites.ts`, dry-run/--apply) : **37 arêtes** (9 client + 28 DofusDB) + **626**, données locales appliquées, re-mesure **0 manquant** · **aide navigateur** : bulle portée dans le `body` en `fixed` (clamp 390/768/1024/1440), ajouts Ordre + bloc, 6 tests.
> **Preuves** : PR **#1517** mergée et PR **#1518** (correctifs de revue + noms/classes) · **8 369 tests** · `tsc` 0 · `lint` 0 erreur (7 795 warnings préexistants) · aucune migration.
> **Reste** : **bêta/prod : import Tougli puis scripts** (6 quêtes + 37 arêtes + 626) · positions 894/710/711/1939/626 · perf T-6/G6 · **redéploiement bêta (sans réimport)**.
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

## 📝 Session 23/11/2026 (suite 61) — **Harnais : plan de sortie Cline persisté** — branche `docs/harnais-sortie-cline-2026-11-23`

> **Demande user (verbatim)** : « ressors le plan complet si on relance une session elle va etre amnesique non ».
> **Fait** : plan exact des **2 PR** de sortie Cline écrit dans `docs/agents/harnais.md` §14 (source `.agents/skills`, liens `.cline`/`.claude`, règles, hooks, `.clineignore`, CI, clone neuf) ; scorecard 3/3 déjà remplie ; état : migration **non commencée**.
> **Preuves** : doc seule, aucun code · `git status` à contrôler avant PR.
> **Reste** : GO phase 1 · Cline secondaire à confirmer · `harness:links` en CI/installation.
> **Rotation** : bloc « suite 55 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 22/11/2026 (suite 60) — **Rush : saut vers un prérequis dans l'overlay** — branche `feat/rush-overlay-prereq-jump-2026-11-22`

> **Demande user (verbatim)** : « quand on clic dans l'overlay sur une quete prérequis on cible bien la quete prérequis on va la chercher et on focus dessus, le guide navigateur le fait déjà, meme chose si c'est une quete dans un autre bloc on fait pareil et on propose un retour arri_re comme le guide interne ? ».
> **Mesuré** : `handleGoToPrereq` cherchait `overlay-seq-*` avec le `document` GLOBAL — dans une PiP, c'est le document HÔTE : le bloc changeait, la ligne n'était jamais trouvée ; aucun retour n'était proposé, et un prérequis unique ouvrait une modale à un seul item.
> **Fait** : règle pure `planOverlayJump` (cible par `milestoneId` + `seqId`, fail-closed) ; saut dans `rootRef.current.ownerDocument`, recherche + filtres relâchés pour que la cible soit rendue, ligne centrée + anneau 1,8 s ; prérequis unique = saut direct ; toast « Revenir » (10 s) qui ramène au bloc et à la quête d'origine ; action de toast aux tokens DA.
> **Preuves** : **8 349 tests ✅** · 11 neufs (`rush-overlay-jump`) + 159 ciblés · `tsc` 0 · `lint` 0 erreur (39 warnings préexistants) · aucune migration.
> **Reste** : valider visuellement 310/390 (même bloc, autre bloc, retour) · scorecard lot 3/3 remplie — migration `.agents/skills` encore conditionnée à Cline secondaire + liens CI.
> **Rotation** : blocs « suite 54 » et antérieurs sortis — récupérables via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 22/11/2026 (suite 59) — **Rush : overlay compact (PiP étroite)** — branche `fix/rush-overlay-compact-2026-11-22`

> **Demande user (verbatim)** : « en fait la place prise par les quêtes semblent assez dérisoire plus on diminue, les bloc toutes en cours faites verrouillé sont vraiment nécessaire à cette taille ? le champ de recherche le dropdown debloc, tous les boutons du haut avec les étapes etc ? ».
> **Mesuré** : à 310 px, les 4 filtres wrappent (`Verrouillées 9` sur une 2e ligne), le header passe sur 3 lignes (`8 / 390 / quêtes`), `Ressources 3/3` est coupé, la carte garde un titre 17,5 px et le rail décoratif.
> **Fait** : `data-compact` sur la racine ; filtre en `select` thématisé ; recherche `h-8` + placeholder court ; « Ressources » en icône + badge ; header secondaire (alignement, Ocre, Metamob, donjons, masquer) dans `⋯` ; cartes `15 px`, padding réduit, rail masqué.
> **Preuves** : **103 tests ciblés ✅** (dont `rush-overlay-compact`) · `tsc` 0 · `lint` 0 erreur (39 warnings préexistants) · aucune migration.
> **Reste** : valider visuellement 310/390/768/1024/1440 · 3ᵉ palier (largeur cible + blocs visibles).

## 📝 Session 22/11/2026 (suite 58) — **Rush : overlay étroit, précédence corrigée** — branche `fix/rush-overlay-density-2026-11-22`

> **Demande user (verbatim)** : « choisi et enchaine ».
> **Mesuré** : `GuideOverlayClient.tsx:327` évaluait `h >= 900` avant `w < 580` ⇒ une PiP **400 × 1000** était `wide` alors que `overlaySmall` était vrai ; les commentaires annonçaient **820**, le code utilisait **900**.
> **Fait** : règle pure `resolveOverlayLayout` (`src/lib/rush-overlay-layout.ts`) : `small` si un côté est étroit, `tight` prioritaire, `wide` dès 820 px de haut sinon ; `GuideOverlayClient` l'utilise ; `RushOverlayHeader` fait primer `narrow` sur `density`. 4 tests neufs.
> **Preuves** : **28 tests ciblés ✅** (`rush-overlay-layout`, `rush-dungeons-overview-ui`, `rush-overlay-v2f`) · `tsc` 0 · `lint` 0 erreur (39 warnings préexistants) · aucune migration.
> **Reste** : 3ᵉ palier (largeur cible + blocs visibles, décision) · captures 390/768/1024/1440 à valider visuellement.
