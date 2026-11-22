# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

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

## 📝 Session 22/11/2026 (suite 57) — **Harnais : bascule OpenCode, Cline conservé** — branche `feat/harnais-opencode-2026-11-22`

> **Demande user (verbatim)** : « je souhaite migrer finalement sans supprimer cline je conserve cline mais on migre ici quand même ».
> **Fait** : ① `opencode.json` : skills partagés `.cline/skills` (12 skills), permissions (`.env` deny, `prisma/migrations` + `migrate dev` + `db push` ask, destructives ask, `--no-verify` deny), `watcher.ignore`, MCP Sentry distant ; ② `/reprise` + `/fin` ; ③ routeurs `src/AGENTS.md`, `tests/AGENTS.md`, `docs/AGENTS.md`, `services/AGENTS.md` + routage dans `AGENTS.md` ; ④ `docs/agents/harnais.md` §12, table 12 skills, `CARTE-DU-PROJET` ; ⑤ garde `harness-config` (2 tests neufs, 11 au total).
> **Preuves** : **806 fichiers / 8 325 tests ✅** · `harness-config` 11/11 · `tsc` 0 · `lint` 0 erreur (7 798 warnings préexistants) · sondes : écriture `.env` **deny**, `--no-verify` **deny** · Cline intact (`.clinerules`, `.cline/skills`, hooks, `.clineignore`).
> **Suite (même session) — Lot 2** : sous-agent `reviewer` read-only (`.opencode/agents/reviewer.md`) · premier **worktree** (`harnais-lot2`) avec `node_modules` en jonction · hooks Cline durcis (`prisma migrate dev`, `db push`, `.env` par shell, `Remove-Item -Recurse`, `.env.example` autorisé) · `TaskStart` lit **tout** `ROADMAP` §0 (l'ancien `Prochaine étape` n'existait plus : fallback silencieux corrigé) · `TaskComplete` liste 5 fichiers · tests de comportement 18/18 · inventaire exact 12 skills · `paths:` vérifiés.
> **Preuves Lot 2** : **806 fichiers / 8 332 tests ✅** · `harness-config` **18/18** · `tsc` 0 · `lint` 0 erreur (7 798 warnings préexistants) · relecture `reviewer` : findings 1-5 + 7-14 intégrés · worktree C: → 6-8 timeouts de scan `src/` (5 s), futurs worktrees sur `../sigilos-worktrees` · CI à venir.
> **Suite (même session) — Lot 3** : `npm run harness:links` (jonctions `.agents/skills` + `.claude/skills` vers `.cline/skills`, gitignorées) · scorecard dans `harnais.md` §14 · `/fin` déclenche `reviewer` automatiquement · source unique `.cline/skills` conservée pour Cline.
> **Preuves Lot 3** : `harness-config` **19/19** · 8 333 tests (CI) · `tsc` 0 · `lint` 0 erreur · liens créés et vérifiés sur Windows · Cline intact.
> **Suite (même session) — Lot 4** : décision **source `.cline/skills` conservée** ; migration `.agents/skills` conditionnée (3 lots produit + Cline secondaire + liens CI) ; baseline Lots 1-3 dans `harnais.md` §14 ; scorecard produit à remplir.
> **Preuves Lot 4** : relecture Lot 3 → 2 bloquants corrigés (`/fin` sur `origin/dev...HEAD`, `.claude/settings.local.json` ignoré) · `harness-config` 19/19 · `tsc` 0 · `lint` 0 erreur · CI à venir.
> **Reste** : 3 lots produit à mesurer (scorecard §14) · migration conditionnée · rotation `activeContext` non tranchée (#42) · gaps best-effort du hook shell.

## 📝 Session 22/11/2026 (suite 56) — **Rush : carte des quêtes — bon monde + accès visiteur** — branche `fix/rush-carte-monde-public-2026-11-22`

> **Demande user (verbatim)** : « on oublie la vue de la map dans l'overlay pip et le point sur la map, on conserve l'existant et tu debug ce qui doit l'être (effectivement il y a beaucoup de positions qui sont dans le mauvais sous-monde) + debug visiteurs connecté/déconnecté ».
> **Mesuré** : `/api/rush/map-at` absent de `isPublicApi` ⇒ **401** pour un visiteur non connecté ; **112 / 527** positions `pos_tags` tombent sur une case présente dans plusieurs mondes ; la branche `mapId` de God était **dans un commentaire** (`mapParam` jamais lu, ESLint le signalait) ; la puce ne transmettait que `parsed.worldId` (le texte `[x,y]` ne porte pas le monde).
> **Fait** : ① proxy : `/api/rush/map-at` en **lecture publique** (asset déjà public, entiers bornés) ; ② `RushCoordinateChip` reçoit `worldId` (du `pos_tags`) et le transmet au menu **et** à `resolveMapWorldAction` (4ᵉ param, monde explicite prioritaire) ; ③ route : la carte `mapId` de God est **de nouveau prioritaire** ; ④ règle pure `buildRushMapAtUrl` (seul constructeur d'URL) ; ⑤ tests : route **7**, URL **3**, câblage **4** ; ⑥ **pas** de carte dans la PiP, **pas** de pion (décision user).
> **Preuves** : **802 fichiers / 8 299 tests ✅** · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Suite (même session) — Temple Céleste (monde 41)** : DofusDB l'a créé le 23/06/2026 (sous-zone 446, 3 cartes 241443329/241444353/241445377) ; `worldmap.json` datait du 16/04. Voie **ciblée** `scripts/sync-subworld.ts` (dry-run/`--apply`, refus 19/29, aucun écrasement) : **37 mondes / 14 706 cartes** ; `DOFUS_WORLDS` + test de parité ; images **3 HD + 160/84/40/12 tuiles** ; **cache serveur `getWorldmapData` invalidé par mtime** (`map-at?world=41` → 200 sans redémarrage) ; audit `--world 41` : **1 écart** « Réponses à tout » (1631) `worldId=1 → 41`, carte 241443329, à corriger dans God (« Bien débuter » déjà passé à 41). Doc : `docs/agents/siphon-worldmap.md` réécrite.
> **Suite 2 (même session) — sous-mondes / `(0,0)`** : « Le jour le plus long » (2111) était `worldId: 1` alors que sa carte `201588736` est en **monde 24** (Blessures de Guerre) ; `map-at` refusait `(0,0)` en bloc. **Fait** : `(0,0)` autorisé si monde explicite > 1 (ou carte God imposée), testé (route 9) ; **worldmap** : `hasKnownGameCoords` accepte `(0,0)` d'un sous-monde > 1 et `map-hd-overlay` ne l'exclut plus (index de clic + overlay HD, test source) ; règle pure `rush-pos-fix` + `scripts/fix-rush-pos-worlds.ts` (dry-run/`--apply`) : **514 corrections** proposées (149 monde+carte, 365 carte seule — Mappemondes/donjons) ; **4 appliquées en local** (24 ×3, 41 ×1), audits 24/41 = 0 ; `map-at?x=0&y=0&world=24` → 200. **La tuile de fond `0` n'existe pas chez DofusDB (404)** : le sync à partir de 1 est correct. `npx` absent de l'hôte VPS → script dans le conteneur app.
> **Reste** : compteur « 448 » à reproduire dans l'en-tête PiP · **bêta : appliquer le fix des positions (24/41 puis global 510)** (local déjà appliqué) · overlay étroit (3ᵉ palier) à décider · T-6/G6 à profiler · `useOptimistic` à supprimer.
> **Rotation** : bloc « suite 48 » (sécurité #1486) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.
