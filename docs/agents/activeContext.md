# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 🗓️ Session 25/11/2026 (suite 71) — **Rush : overlay PiP, zaap iso DPLN, blocs terminés** — branche `fix/rush-overlay-position-dungeon-2026-11-25` (PR **#1537**)

> **Demande user (verbatim)** : « les positions dans l'overlay s'ouvrent hors de l'overlay » · « une petite modale au clic sur la position : copier, voir la map HD en petit » · « les positions avec le zaap, très implémenté côté DPLN — on ne peut pas inventer des positions, iso DPLN pour l'entièreté des quêtes, non négociable » · « un double contour pour les modales de boss non validé » · « les notifs de copie de position dans l'overlay doivent rester dans l'overlay » · « dans chaque bloc de quête un bandeau en haut avec toutes les icônes, la quête en dessous qui respire ».
> **Mesuré** : 770 `pos_tags` (tous guides) / **531 `allowZaap`** ; le calcul du zaap utilisait `zaaps.json` (39 en monde 1, Bonta `[-32,-56]`) au lieu de la liste DPLN (37, Bonta `[-31,-56]`) ; l'ancien siphon posait `allowZaap: true` partout — le contrôle DPLN (529 pages) mesure **65 exclusions `[x,y!]`** et **51 zaaps explicites** que le guide affichait à tort ; `RushPositionMenu` portalait dans `document.body` (page principale) et utilisait le `toast` global ; `RushOverlayDungeonPopover` cumulait deux halos.
> **Fait** : position + donjons portés dans le `ownerDocument` (PiP), mini-modale position avec copie / carte HD / zaap ; **`dplnNearestZaap`** (liste DPLN exacte, Manhattan + pénalité, garde monde 1) côté client ; **`scripts/check-rush-dpln-zaap.ts`** (dry-run/`--apply`, `!`, zaap explicite) ; `buildRushPositionTag` fait gagner la donnée DPLN sur l'ancien `allowZaap` (**115 corrections**, **116 séquences locales synchronisées**) ; toasts partagés routés par `useOverlayToast` (overlay = PiP, navigateur = global) ; bloc terminé **scellé** (sceau, filet vert, jauge verte) ; modale donjon **un seul contour**, actions sur 2ᵉ ligne ; progression donjons (barre d'en-tête, compteurs, barres de bloc) ; **bandeau d'icônes** au-dessus du nom dans chaque bloc de quête + numéro d'alignement avec le titre.
> **Preuves** : tests `dpln-zaap`, `rush-position-menu-overlay`, `rush-overlay-quest-banner`, `rush-block-done-visual`, `rush-overlay-dungeons`, `rush-quest-positions` verts ; `tsc` 0 ; suite complète à jouer ; **aucune migration**.
> **Reste** : choix Brak 55/66 + God, backfill bêta/prod conditions, appliquer le JSON positions corrigé en bêta/prod (God « Synchroniser les positions ») ; mode clair #1536 prête.
> **Rotation** : bloc « suite 65 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 24/11/2026 (suite 70) — **Rush : overlay, donjons, PiP et validation** — branches `fix/rush-overlay-dungeons-pip-2026-11-24` (PR **#1533**), `feat/rush-dungeons-auto-2026-11-25` (PR **#1534**), `feat/rush-overlay-compact-2026-11-25` (PR **#1535**)

> **Demande user (verbatim)** : retours captures — tiroir conditions vide, donjons « à faire » par défaut + clignotement, image des combats, overlay compact, Opera GX ; puis « les quêtes invalidées doivent remettre les dj en à faire » et « valider une quête passe et coche les dj ».
> **Mesuré** : `prereq_text` était compté en conditions alors que `RushTagBadge` le masque → tiroir vide ; un placeholder 1×1 du proxy passait pour une image ; `requestWindow` pouvait réussir puis `preparePipDocument` échouer et **jeter la PiP ouverte** (fallback popup) ; le commentaire « Opera GX n'expose pas l'API » était faux (Opera 102+ supporte Document PiP).
> **Fait #1533** : prérequis retirés des conditions ; portrait 1×1 → repli ; `dungeonDisplayState` = « À faire » par défaut (affichage seul) ; pulse sur la pastille, les vignettes **et le bloc panneau** ; `openPipWindow` catch + **PiP conservée si les styles échouent** ; titre `SigilOS — Overlay` ; toast « non épinglée » retiré du guide Rush ; commentaires Opera corrigés.
> **Fait #1534** : les donjons non renseignés s'affichent « À faire » ; la **validation unitaire reste verrouillée** par les donjons requis (le **bloc** bypass, décision 20/11) ; une quête dévalidée efface ses états ; dashboard/overlay/public rafraîchissent la progression donjons ; tests de parité alignés.
> **Fait #1535** : overlay compact (icône de quête à gauche, nom pleine largeur, icônes succès / repère / position / donjon ×N en haut) ; clic quête → mini-modale DPLN/DofusDB/détails (liens vides masqués) ; monstres des combats cliquables → fiche (id lu dans l'asset, pas de fiche inventée).
> **Preuves** : **8 472 tests ✅** · `tsc` 0 · `lint` 0 erreur · aucune migration.
> **Reste** : mode blanc, choix Brak 55/66 + God, visuel de bloc terminé / bouton masquer-afficher, contrôle overlay public invité, **bêta/prod apply** du backfill conditions.
> **Rotation** : bloc « suite 64 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 24/11/2026 (suite 69) — **Rush : conditions Tougli (⑭ + ⑩)** — branche `feat/rush-constraints-2026-11-24` (PR **#1531**, revue **#1532**)

> **Demande user (verbatim)** : « go » sur le plan ⑭ contraintes → ⑩ fiche quête.
> **Mesuré** : Tougli 530 quêtes / **389 avec conditions** / **726 combats dont 162 multi** (max 14) / 80 `bashMobs` / 38 `needPlayer` / 37 métiers / 7 donjons au choix / 6 horaires ; base locale **0 `constraints` réelles** ; **325 séquences** avec conditions mais **aucun `tips`** (section masquée) ; 7 quêtes absentes de Tougli (1988/894/1939/614/710/711/626) ; Maïmane **29 donjons au choix > plafond 8**.
> **Fait** : contrat **v2** `combats[]` + `detail` (v1 lue et normalisée) ; mapper pur `rush-constraints-tougli` ; script `backfill-rush-constraints` (dry-run/`--apply`/`--overwrite`, API ou `--source`) ; **391 séquences écrites en local** (**161 multi-combats, 719 combats**) ; éditeur God multi-combats ; `hasRushHints` : conditions seules visibles sur les 3 surfaces ; carte combat avec icônes/portraits/PV/détail.
> **Preuves** : dry-run `391 à écrire`, apply `391`, second passage `0` ; guide public « Bien débuter » sans `tips` → `COMBAT SOLO / Poutch Céleste / Niv. 1 / 35 PV` ; **8 464 tests ✅** · `tsc` 0 · `lint` 0 erreur · `security:audit` OK.
> **Revue #1532** : bloc « Conseils » vide corrigé, v1 normalisée en lecture, niveaux >200 (jusqu'à 1 000), combats identiques conservés, cible DB explicite + `DATABASE_URL` obligatoire ; `ROADMAP` compacté sous 60 KiB.
> **Reste** : **⑨ mode blanc**, **⑪ choix Brak 55/66 + God**, ⑫/⑬/⑮/⑯/⑰/⑱, **bêta/prod apply** (script via conteneur ops), contrôle hebdo VPS, phases 4/5.
> **Rotation** : bloc « suite 63 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 24/11/2026 (suite 68) — **Rush : graphe 2c-2 (cascade, quêtes cliquables, objets requis, overlay)** — branche `feat/rush-success-graph-2c2-2026-11-24` (mergée **#1529**)

> **Demande user (verbatim)** : « enchaine 2c2 » · « ça veut dire quoi Possessions : 10 objets à avoir » · « les quêtes pourraient être cliquables vers leur quête non ? » · « l'overlay pk on casse le bloc de droite et on laisse un gros vide avec le cercle de validation d'un bloc et son bouton reset ? » · « 0 scroll dans le détail des dj de Totem de Maimane côté overlay » · « enchaine tout ».
> **Mesuré** : DofusDB nomme **478 objets** (`need.items`/`PO=`) : Six sur six = les **six Dofus**, Dom de Pin = **Dom de Pin** (27803) ; le libellé « 10 objets » ne disait rien. L'overlay étirait le bouton **Réinitialiser** (`.da-dock button { flex: 1 }` → 28 px devenus une zone vide). La popover donjons calculait `92 + N × 56` **sans plafond** : ~30 donjons de Maïmane sortaient de la PiP, aucun scroll.
> **Fait** : `rush-success-validation` (règle pure) : blocs, quêtes cibles du guide, **prérequis de route** ajoutés par la cascade, quêtes hors guide, possessions · fiche `SuccessChip` : **objets directement requis par le succès** (pas la fermeture des OA — retour user : « Planche hatoufer » venait de 2302, prérequis de 2299), **nommés** et **dédupliqués** (un `need.items` déjà listé dans les ressources d'une quête n'est pas répété — retour user sur 5932), **icône officielle siphonnée** (`iconId` → `/api/assets-dofus/items/{iconId}?icon=1`) et **petite modale au clic** listant tous les objets directs avec leur statut (requis / ressource de quête), bouton **« Valider les prérequis »** avec **aperçu** puis écriture **serveur** par bloc (`toggleMilestoneProgress`, périmètre `scopeSeqIds`, donjons/ressources/cascade) · quêtes du guide **cliquables** (saut + anneau) sur dashboard / overlay / public, hors-guide sans cible · overlay : Réinitialiser non étiré (`da-dock-reset`), popover donjons plafonnée au viewport avec `overflow-y-auto` (scroll interne ignoré par le recalcul de position) · 478 noms d'objets dans `success-graph.json` (`--check` couvre `items`) · aucune migration.
> **Preuves** : **8 435 tests ✅** · `tsc` 0 · `lint` 0 erreur · 16 tests `rush-success-validation` (dont seed réel : les 3 Qf de 1705, les six Dofus, objets directs sans fermeture OA, déduplication des ressources de quête, `iconId` des objets, PO hors guide, périmètre même bloc et cascade inter-blocs) · `--check` = aucun écart · route image vérifiée (`/api/assets-dofus/items/23035?icon=1` → 200 WebP) · tests source : reset non étiré, popover plafonnée.
> **Reste** : contrôle hebdo VPS (`--check` + alerte Discord ops/Sentry + changelog membres) en phase 4 · phases 3/4/5 · redéployer la bêta et vérifier les fiches (2299 sans « Planche hatoufer », 1385 « Bleu turquoise » + modale avec icônes, Six sur six, Dom de Pin, Maïmane).
> **Rotation** : bloc « suite 62 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

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






