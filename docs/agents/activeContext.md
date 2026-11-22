# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 22/11/2026 (suite 56) — **Rush : carte des quêtes — bon monde + accès visiteur** — branche `fix/rush-carte-monde-public-2026-11-22`

> **Demande user (verbatim)** : « on oublie la vue de la map dans l'overlay pip et le point sur la map, on conserve l'existant et tu debug ce qui doit l'être (effectivement il y a beaucoup de positions qui sont dans le mauvais sous-monde) + debug visiteurs connecté/déconnecté ».
> **Mesuré** : `/api/rush/map-at` absent de `isPublicApi` ⇒ **401** pour un visiteur non connecté ; **112 / 527** positions `pos_tags` tombent sur une case présente dans plusieurs mondes ; la branche `mapId` de God était **dans un commentaire** (`mapParam` jamais lu, ESLint le signalait) ; la puce ne transmettait que `parsed.worldId` (le texte `[x,y]` ne porte pas le monde).
> **Fait** : ① proxy : `/api/rush/map-at` en **lecture publique** (asset déjà public, entiers bornés) ; ② `RushCoordinateChip` reçoit `worldId` (du `pos_tags`) et le transmet au menu **et** à `resolveMapWorldAction` (4ᵉ param, monde explicite prioritaire) ; ③ route : la carte `mapId` de God est **de nouveau prioritaire** ; ④ règle pure `buildRushMapAtUrl` (seul constructeur d'URL) ; ⑤ tests : route **7**, URL **3**, câblage **4** ; ⑥ **pas** de carte dans la PiP, **pas** de pion (décision user).
> **Preuves** : **802 fichiers / 8 299 tests ✅** · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Reste** : compteur « 448 » à reproduire dans l'en-tête PiP · overlay étroit (3ᵉ palier) à décider · T-6/G6 à profiler · `useOptimistic` à supprimer.
> **Rotation** : bloc « suite 48 » (sécurité #1486) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.



## 📝 Session 22/11/2026 (suite 55) — **Rush : bandeaux Combat de séquence + « Dofus obtenu » partagé** — branche `feat/rush-finitions-2026-11-22` (PR #1497)

> **Demandes user (verbatim)** : « combat tactique et semi tactique je veux pouvoir les mettre entre 2 quête dans un bloc pas que ça créé un bloc dédié, en + tu as mis des icones ia, pas de centrage rien etc » puis « pousse la totalité pr merge, full doc à jour ».
> **Mesuré** : `resolveRushRoute` **supprimait** tout bloc hors quête autre que `SEPARATEUR`/`INFO` (la bannière « test » n'arrivait jamais au client) ; `isNonCheckableBlock` ignorait les blocs Combat (d'où « 34 · test · 0/0 ») ; **7 copies divergentes** de la règle « bandeau » (dashboard, description de bloc, progression par Dofus, 3 projections serveur, badges) ne connaissaient que `info_sequence` ; le « Dofus obtenu » du dashboard avait un **titre codé en dur** (« LE DOFUS  ! » sans `dofusId`) et deux rendus locaux (public = encart CONSEIL, overlay = copie).
> **Fait** : ① **bandeaux Combat de séquence** — marqueur dédié `{ type: "sequence_banner", kind }` dans `activityTags` (⚠️ `combat_tactique` seul reste le tag d'une quête **cochable**, prouvé par `rush-guide-view`) ; studio : menu « Bandeau » **visible** dans `+ Quête` et dans l'inspecteur ; rendu `RushCombatBanner` **centré** (page + PiP) sur les 3 surfaces ; ② palette « Ajouter un bloc » **sans** les 2 types Combat (plus de bloc dédié) + badge « Combat tactique » sur la ligne du studio ; ③ `DofusObtainedBanner` **partagé** (dashboard/public/overlay) : le titre du studio passe devant, œuf + couleur en repère, composition centrée, **aucune image par défaut** ; ④ `resolveRushRoute` garde les blocs hors quête (`isRushNonQuestBlock`) et `isNonCheckableBlock` délègue à la même règle ; ⑤ les 7 copies alignées + gardes recalées (`rush-vocabulary` → `filteredDone/filteredTotal`, `rush-dofusdex-tip` → `CollapsibleHints`, le pavé de bloc ayant été retiré le 22/11).
> **Preuves** : **799 fichiers / 8 283 tests ✅** · `tsc` 0 · ESLint 0 erreur · aucune migration · donnée vérifiée : `activityTags = [{type:"sequence_banner",kind:"combat_tactique"}]`.
> **Reste** : overlay **étroit** (3ᵉ palier < 480 px, quêtes mises en avant) — lot UI suivant · `pos_tags.mapId` (données) · ops (bêta, migrations `20270112000000`/`20270113000000`, bot, crontabs).
> **Rotation** : bloc « suite 47 » (perf P1-2) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 22/11/2026 (suite 54) — **Rush : O6, descriptions de blocs, studio sans prompt()** — branche `feat/rush-finitions-2026-11-22`

> **Demande user (verbatim)** : « 07 : oublie et efface cette feature des chantiers · 06 : GO · 4 à creuser · 5 : GO · 6 : GO ».
> **Fait (O6)** : la fiche de quête prend le focus sur « Fermer » (`autoFocus`), verrouille le scroll du **document porteur** (PiP) et piège Tab/Shift+Tab — règle pure `nextFocusIndex` (4 tests).
> **Fait (#5)** : `syncQuestCountInDescription` + `countQuestsInBlock` recalent le nombre annoncé dans les descriptions de blocs, aux **3 écritures** (import legacy create/update + import typé). 4 tests.
> **Fait (#6)** : les **4 `prompt()`** du studio sont remplacés par 2 `Dialog` (lien : `safeExternalUrl` ; position : X/Y entiers). Aucun `prompt()` restant.
> **O7** : abandonné à la demande du mainteneur — retiré de la fiche, du plan de refonte et de la route.
> **#4 (448)** : non reproduit. Les compteurs de l arbre sont **par bloc/chapitre**, calculés depuis les données chargées ; il faut l écran exact pour trancher.
> **Preuves** : `tsc` 0 · 8 tests neufs verts · aucune migration.
> **Reste** : mesure du 448 · faux donjons (données live) · ops VPS.
## 📝 Session 22/11/2026 (suite 53) — **Rush : copie PiP, menu carte au clic, details de quete** — branche `fix/rush-carte-copie-details-2026-11-22`

> **Demande user (verbatim)** : « prends en compte les perf aussi avec les lots deja fait et a faire [...] et attaque quand t es pret » + « si tu es capable d associer le bon sous monde intelligemment chapeau par quete ».
> **Mesure** : la copie PiP echouait parce que `copyToClipboard` ecrivait dans le `document` de l onglet principal (non focalise) ; le monde etait **force a 1** dans la bulle de survol alors que `pos_tags.worldId` porte le vrai monde (527/527) ; `getMetierIconPath` fabriquait `eleveur . etre eleveur 20.png` (404) ; `RushMonsterThumb` lisait `gfxId` avant `monsterId` ; le tag `succes` tombait dans « Details utiles » (type absent de l union) ; `10000000001` (Kamas) etait traite comme un id.
> **Fait** : copie via `ownerDocument` (puce overlay + guide) ; `getSequenceCoord` lit `worldId` + `allowZaap` du tag ; menu **clic 2 etapes** (`RushPositionMenu`, guide interne + public, **pas** l overlay) ; route `/api/rush/map-at` (carte HD, `worldmap.json` serveur, 0 fetch avant clic) ; sections « Succes lie » / « Type d etape » (plus de « Badges ») ; icone de type dans la fiche badge ; titre court pour les groupes de monstres ; `monsterId` d abord ; `isResolvableItemId` (borne Int32) ; champ **Carte HD** (`pos_tags.mapId`, borne Int32) editable dans God et prioritaire dans `/api/rush/map-at`.
> **Preuves** : `tsc` 0 · 149 + 61 + 121 tests Rush verts · `rush-tag-overflow` 3 -> 4 conteneurs (justifie) · aucune migration.
> **Reste** : faux donjons (donnees live, Temple Maudit d Araknas) · encart Tougli dans la modale (O7) · verification ecran du menu et du PNJ.

## 📝 Session 22/11/2026 (suite 52) — **Restes Rush consolidés dans une fiche unique** — doc seule (aucun code produit)

> **Demande user (verbatim)** : « est-ce que toutes le restant est dans un fichier ? on en a partout j'ai l'impression, on perd un temps fou et beaucoup de tokens contexte s'envole à chaque début de prompt ».
> **Mesuré (base live `rush-sylvestre`)** : 36 blocs / **536 séquences** · 527 positions (**0 sans `worldId`**) · 527 `prereq_text` (**0 orphelin**) · 530 ids DofusDB (530 trouvés) · **518/536 cartographiables** · 863 tags `item` (505 ids : **1 id absent** 7696 ×2 et **1 id invalide** `10000000001` ×60) · 746 tags combat · **3 succès 3/3 `isSuccess`**.
> **Fait** : la **fiche unique des restes** vit dans `docs/plans/RUSH-DEVELOPPEMENT-SUITE.md` (« ⚡ Restes — fiche unique », en tête) : lots prêts (O13, V-D2, O7, O6, E5, compteur 448, descriptions), décisions (T-6/G6, `useOptimistic`, O9/O11/O5/G5/E2/`questDbIds`), livrés à acter, bloqués mainteneur, ops. `ROADMAP.md` (rangs 9/10/10b/55, §3 bis), `PLAN-REFONTE…`, `MODULE…` et `ROUTE…` §13 **pointent** vers elle et ne dupliquent plus.
> **Corrections d'état** : T-2c **clos par mesure** (0 orphelin / 527) ; 3 succès officiels **déjà posés** ; V-D2 réduit à 2 cas ; O10/O12/G2/T1/T5 **livrés**.
> **Preuves** : `git status --short` propre · sonde temporaire supprimée · aucune migration · aucun code produit.
> **Reste** : appliquer la fiche (O13 → V-D2 → O7/O6) ; les décisions listées ; ops VPS.


## 📝 Session 21/11/2026 (suite 51) — **Sécurité CodeQL + Sentry (footer, URLs sortantes, avis)** — branche `fix/codeql-sentry-2026-11-21` (empilée sur #1492)

> **Demandes user (verbatim)** : « Il y a par ailleurs des nouvelles erreurs sentry qui ont pop aujourd'hui + erreurs github security and quality — traite la totalité ».
> **Mesuré** : 3 alertes CodeQL ouvertes — `js/request-forgery` `metamob-client.ts:1221` (#134) et `dofus-noobs-helper.ts:58` (#133), `js/resource-exhaustion` `service-feedback-actions.ts:152` (#132) ; Sentry `JAVASCRIPT-NEXTJS-31` (`useSession()` sans provider dans `galactic-footer`, POST `/`) et `JAVASCRIPT-NEXTJS-30` (« unexpected response » = ancien bundle après déploiement, bruit attendu).
> **Fait** : ① `galactic-footer` lit `useSession()?.status` (plus de déstructuration d'`undefined`) ; ② gardes pures `outbound-url-guards` (slug Metamob ASCII borné + URL DPLN sur hôte fixe) utilisées avant `fetch` ; ③ `stars` borné à 1–5 avant `repeat` ; ④ test `outbound-url-guards` 2.
> **Preuves** : **793 fichiers / 8 251 tests ✅** · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Reste** : #136 remplacée par une table constante (PR #1494) et #137 (Metamob) fermée comme faux positif documenté ; redéployer puis vérifier Sentry (une issue corrigée, l'autre est le bruit de déploiement).
> **Rotation** : bloc « suite 45 » (P0 perf) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 21/11/2026 (suite 50) — **Essais : J-3, prolongation, filtre « à valider »** — branche `feat/essais-notifications-2026-11-21` (empilée sur #1490)

> **Demande user (verbatim)** : « Notification Discord lors d'une prolongation d'essai · Alerte J-3 (la doc produit la promet, le code ne le fait pas) · Filtre/onglet « essais à valider » » puis « j'en ai marre que tu t'arrêtes à chaque point ».
> **Fait** : ① **alerte J-3** (`isTrialEndingSoon`, fenêtre 3 jours) : le cron `sync-members` envoie un embed « ⏰ Essai — échéance proche » (une fois par membre + échéance, clé `trial-soon:`), en plus de la fin d'essai ; ② **prolongation** : `setMemberTrialState` lit l'ancienne échéance **avant** l'écriture et poste « 🔄 Essai prolongé » (ancienne → nouvelle) dans `trialEndNotifyChannelId`, fail-soft (l'état d'essai est écrit même si Discord refuse) ; ③ **filtre « À valider »** avec compteur dans la liste Membres (`isTrialAwaitingValidation`, échéance atteinte + non validé ; le reste exact en minutes prime sur `remainingDays`) ; ④ **télémétrie God** : la carte du cron `sync-members` affiche désormais `trialsNotified` et `trialsSoonNotified` (elle ne montrait que archivés/réactivés/erreurs).
> **Preuves** : `trial-end` 20 · `member-roster` 27 · `member-registry-filters` 19 · `membres-essai-fixes` 6 · `registre-membres-b2` 8 · **792 fichiers / 8 249 tests ✅** · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Reste** : J-3 et prolongation ne partent que si le cron `sync-members` tourne **et** que `trialEndNotifyChannelId` est configuré (ops) ; « À valider » liste les essais **échus**, pas les J-3.
> **Rotation** : bloc « suite 44 » (parité UI Rush) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 21/11/2026 (suite 49) — **Succès lisibles · siphon God · essais en heures · icônes avec repli · déploiement** — branche `feat/succes-essais-2026-11-21`

> **Demandes user (verbatim)** : « du mal à saisir ya trop de data technique » puis « 1. Go · 2. tu corriges toi même en siphonnant tout ce qui manque (la description du succès liberté est la même partout) spécial : diffère selon le dj · 3. que faire pour corriger ? · 4. [liste] ».
> **Mesuré** : la fiche `Challenge` « Liberte » porte `description: "Challenge généré automatiquement"` (seed) et `displayAchievementDescription` ne reconnaissait que le gabarit « Vaincre tel boss… » ; God rendait `challenge.iconUrl` **brut** et `SuccesTracker` faisait `display:none` sur l'image cassée (case noire) ; `differenceInDays` affichait « 0 j » le dernier jour ; `game-data/achievements` était restauré par le déploiement alors que God y écrit.
> **Fait** : ① texte générique → « Description pas encore disponible… » (+ repli vers la description partagée) ; ② heures le dernier jour (« 5 h », « moins d'1 h », « il y a 2 h ») ; ③ `DungeonAchievementIcon` (source unique, repli trophée) dans God + tracker + panneau Rush ; ④ **bouton God « Siphonner les succès »** (`siphonChallengeDetails` + `siphonSpecialAchievements`, sans borne, verrou Redis 10 min, super-admin/brique `game-data`) ; ⑤ `game-data/achievements` sort de `REPO_OWNED` → `SERVER_OWNED` (2 scripts + verrou) ; ⑥ **description officielle de « Liberté »** posée dans `prisma/seed-data/game-data.json` (entrées `liberte` **et** `libert`) — le seed étant un `upsert`, le prochain déploiement l'applique.
> **Preuves** : `challenge-description` 10 · `member-trial-display` 11 · `achievement-siphon-guard` 5 · `deploy-source-sync` 9 · `game-data-seed-descriptions` 2 · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Reste** : lancer le bouton en bêta (budget DofusDB : relancer si `deferred`) · vérifier le cron `sync-members` + le salon d'alerte (ops).
> **Rotation** : bloc « suite 43 » (positions Incarnam) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 21/11/2026 (suite 48) — *bloc sorti le 22/11/2026 (rotation, 7ᵉ)* — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 21/11/2026 (suite 46) — *bloc sorti le 22/11/2026 (rotation, 7ᵉ)* — récupérable via `git log -p -- docs/agents/activeContext.md`.


> **Rotation** : bloc « suite 46 » (perf P1-1) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.



















