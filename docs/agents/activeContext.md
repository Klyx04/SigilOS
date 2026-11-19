# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 19/11/2026 (suite 27) — **Rush · retouches DA Wakfu (PiP + guide)** — branche `feat/rush-da-retouches`

> **Demande user (verbatim)** : « tout sauf l'œuf » — appliquer les 8 retouches UI/UX des deux briefs `src/temp/debug2.md` (PiP + guide), puis le 3ᵉ bloc (nettoyage des cartes verrouillées), le rendu des blocs DofusDex/Donjons/Prérequis/Personnages et le header PiP, sans l'œuf Dofus à 5 stades.
> **Fait** : ① PiP : bord gauche 3,5 px sur « faire maintenant », titre verrouillé en `--da-muted`, feedback de copie `.da-coord` 900 ms (`data-copied`), compression `max-height: 580px` (`.da-blockdesc` masqué, carte `.6rem .75rem`) ; `data-host="pip"` posé sur la coque. ② Guide : dégradé d'ambiance `.da-guide[data-host="page"]`, respiration `.da-row` ≥ 1024 px, `#da-rough` réservé aux cartes focales (`next`/`here`), fond des conseils ouverts ; `data-host="page"` posé sur la coque. ③ `RushCoordinateChip` : classe `da-coord` + `data-copied`, 900 ms. ④ Test DA : 7 cas neufs, 66/66. ⑤ Cartes verrouillées (dashboard, overlay, guide public) : badge et sous-boîte supprimés, ligne compacte `↳ À terminer avant : nom ›` (ambre/muted), fond de carte discret ; les gardes `rush-quest-state-colors` et `rush-finitions-anonymes` sont réécrites, pas affaiblies. ⑥ Blocs DofusDex : `RushRichText` parse `**gras**`/`*italique*`, `splitTipLines` retire les puces `- ` et coupe sur `>` ; les blocs info du dashboard et `RushInfoSequenceBanner` passent par `RushTipLines` (les `**` ne s'affichent plus en brut). ⑦ Header PiP : `min-height: 0` sous `data-host="pip"` (wide/normal), plus de bande vide au-dessus de 700 px. ⑧ Fiche Succès : `SuccessSheet` portée hors de `.da-card` via `createPortal` (+ wrapper `da-portal` et `ownerDocument.body` pour la PiP) ; fin du chevauchement sous les cartes et du `line-through` hérité. ⑨ Dashboard : pastille Donjon, `SuccessChip` compact et bulle de présence regroupés dans le bloc d'actions à droite (`flex-wrap`) ; l'icône de quête est masquée sur les quêtes validées de l'overlay et disparaît si l'image est cassée. ⑩ Pastilles : Donjon, Succès et présence sont dans le **même bloc segmenté** que les favicons DPLN/DofusDB, le drapeau et l'info (dashboard), sans cadre interne ; la pastille Succès utilise l'icône normalisée `/assets/icons/succes.png` (la fiche garde l'icône du succès).
> **Preuves** : `tests/unit/da-wakfu.test.ts` **66/66** · `tests/unit/rush-rich-text.test.ts` **22/22** · **152 tests ciblés** (DA, parité, repères verrouillés, finitions, markdown) · `npx tsc --noEmit` **0** · `npm run lint` **0 erreur** (7 791 warnings préexistants) · `npm run test:run` **761 fichiers / 7 992 tests ✅** · `git diff --check` propre.
> **Reste / ops** : **PR #1450** ouverte (branche `feat/rush-da-retouches`, 6 commits, CI à vérifier puis merge) ; l'œuf Dofus à 5 stades reste **hors lot** (UI-2 Dofus, avec le panneau DofusDex) ; UI-1 assets/compteur, Bloc I, Bloc J, 55 conseils, VPS ; archivage + import `prereq_expr` (local et VPS), 3 alias de donjons.
> **Rotation** : bloc « suite 21 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 18/11/2026 (suite 26) — **Rush · prérequis « au choix » (`prereq_expr`)** — branche `feat/rush-prereq-or` (PR **#1448** mergée, `dev ec9bd234`)

> **Demande user (verbatim)** : « Reste : … le `prereq_expr`, puis UI / Bloc I / 55 conseils / VPS. » — avec la règle posée : « jamais de blocage si une alternative n'est pas vérifiable dans le guide ».
> **Mesure** : « Supermilicien » (275) exige `(Qf=272|Qf=273|Qf=274)` dans le client ; la Trame est **plate** (`prereqIds: [272,273,274]`) et ne connaît ni 272 ni 274 ; le guide ne contient que 273 → il était exigé en **ET**.
> **Fait** : ① `src/lib/rush-prereq-expr.ts` — lecture bornée (**4 groupes × 8 alternatives**), résolution par **`questDbIds`**, évaluation « au moins une », **non bloquant dès qu'une alternative est hors guide** ; intégration dans `isSequenceBlockedByPrereqs`. ② Seed : `--prereq-or` lit `quest-prerequisites.json`, émet `prereq_expr`, **retire** les `prereq_text` déjà posés sur une alternative et **neutralise le verrou d'ordre** sur ces mêmes alternatives. ③ Schéma d'import borné (`alternatives` ≤ 8). ④ Ligne « Au choix : … » sur dashboard, guide public et overlay ; **le verrou de l'overlay appelle enfin la règle serveur** (palier + OU), au lieu de sa liste locale.
> **Preuves** : **761 fichiers / 7 977 tests ✅** · `tsc` 0 · lint 0 erreur · **16 tests** (13 `rush-prereq-or` + 3 seed : groupe posé, arête ET retirée, alternative unique ignorée, verrou d'ordre neutralisé) · seed réel : **3 `prereq_expr`** (Supermilicien 272/273/274, Malédiction 710/711/1316, Ça sent le gaz borné à 8) et **plus aucun `prereq_text`** en doublon.
> **Reste / ops** : **archivage + import** (local et VPS) pour que les tags `prereq_expr` arrivent au guide ; puis **UI**, **Bloc I** (succès de donjon), **Bloc J** (donjons : quêtes/étapes, qui a fait quoi, succès de guilde/visiteurs — cadré dans `MODULE` §J), 55 conseils. `git status` propre, `dev` = `ec9bd234`.
> **Rotation** : bloc « suite 20 » (route iso Tougli × Yelle) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 18/11/2026 (suite 25) — **Rush · les 3 derniers points UX** — branche `feat/rush-ux-trois`

> **Demande user (verbatim)** : « Reste : les 3 autres points UX (alignement visible, clic quête, message perso), le `prereq_expr`, puis UI / Bloc I / 55 conseils / VPS. »
> **Cause mesurée (alignement)** : le PiP ne se rafraîchissait **jamais** — `RushTimelineClient` figeait `milestones` dans `openOverlay(...)` (« payload figé à l'ouverture ») ; `router.refresh()` rafraîchissait le dashboard, pas l'instantané du PiP. Le payload n'y portait pas non plus `selfAlignment`/`selfOrder`.
> **Fait** : ① store `sync(patch)` + `overlayData` mémoïsé (ouverture **et** resynchronisation) + cité/Ordre du personnage dans le payload/host ; ② le **nom de quête** ouvre la fiche détaillée (dashboard + guide public, `aria-label`, picto « i » conservé) ; ③ toast « Personnage actif : <nom> » au changement de slot (progression séparée).
> **Preuves** : **760 fichiers / 7 961 tests ✅** · `tsc` 0 · lint 0 erreur · 5 tests `rush-ux-trois` (sync conserve fenêtre et reste du payload, no-op sans overlay, câblage des 3 surfaces).
> **Reste / ops** : `prereq_expr` (OU) — mesuré sur « Supermilicien » (275) : le client accepte 272/273/274, le guide n'exige que 273 ; puis UI, Bloc I, 55 conseils, VPS. **PR à ouvrir**.
> **Rotation** : bloc « suite 19 » (Missions & sondages) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 18/11/2026 (suite 24) — **Rush · séries d'alignement numérotées** — branche `feat/rush-alignement-series`

> **Demandes user (verbatim)** : « oui il faut afficher séparément de 1 à X bonta et idem brak, idem ordre aussi » · « pour brak il y a une quête qui a en prérequis plusieurs quêtes au choix, c'est pris en compte dans le backend et l'ui ? ».
> **Mesure** : **aucune** séquence ne porte le préfixe « Brâkmarien : » (0/536) ; les deux cités vivent **mêlées** dans les 4 blocs « Alignement » (17/19 · 45/45 · 15/15 · 15/15), « Ordres » (15/15) et 3 blocs Dofus ; 117 brâkmariennes / 115 bontariennes / 304 sans cité. Le rang existe dans la source (`cites[].series[].index`) mais n'était pas transporté.
> **Fait** : règle pure `src/lib/rush-alignment-series.ts` — rang **par cité** dans l'ordre du guide (**Bonta 1→100**, **Brâkmar 1→102**, Ordres **1→5** par palier), regroupement **fail-closed** (une ligne sans série annule le réordonnancement) ; pastille `RushAlignmentBadge` ; sections par cité sur dashboard, guide public et overlay. Le nom stocké n'est **jamais** préfixé : les prérequis sont résolus par nom (`resolvePrereqTag`).
> **Preuves** : **759 fichiers / 7 956 tests ✅** · `tsc` 0 · lint 0 erreur · base réelle : **100/102 sans discontinuité**, 6 Ordres en rangs 1→5, bloc 2/4 → **2 sections 45/45** (Ali 20→64 / Ali 21→65).
> **Reste / ops** : prérequis **OU** non modélisés (`prereq_expr`) — mesuré sur « Supermilicien » (275) : le jeu accepte 272/273/274, le guide n'exige que 273 ; puis les **3 autres points UX**, UI, Bloc I, 55 conseils, VPS. **PR à ouvrir**.
> **Rotation** : bloc « suite 18 » (God D6/D7) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 18/11/2026 (suite 23) — **Rush · prérequis client, succès en tags, verrou d'ordre et verrouillage lisible** — `dev` (`269805fb`)

> **Demandes user (verbatim)** : « c'est pas vide » · « on affiche ça comment dans le guide et l'overlay ? » · « les succès sont des listes de quêtes, pas des coches » · « je peux cocher Réponses à tout alors que Sous le regard des dieux n'est pas faite » · « le repère n'a pas à être dispo si la quête n'est pas possible » · « fais et pose plus de question ».
> **Fait (14 PR #1431 → #1444)** : prérequis **client** siphonnés (`QuestsDataRoot.startCriterion` : 990 quêtes / 1 187 arêtes, ET-only, `Qf!` écarté) + **verrou d'ORDRE** (par branche, `takeEarly`/parallèles exempts, anti-cycle) → **451 prérequis du jeu + 76 d'ordre** ; **succès = tags de quêtes** (les 68 fausses cases sont supprimées, `public/game-data/achievements.json` = 2 777 succès / 259 avec quêtes, **303 tags sur 284 quêtes**, pastille + fiche `SuccessChip` dashboard/overlay, icône officielle du client) ; guide local **36 / 536** ; **quête verrouillée lisible** (rouge franc, opacité `.92`, libellé « Verrouillée ») et **plus de repère dessus** (navigateur + overlay, retrait conservé) ; overlay **sombre uniquement** ; icône de quête sur la ligne du nom ; **scroll « Mon Ocre »** réparé ; plafond 80 → 120 (10 quêtes brâkmariennes récupérées).
> **Preuves** : **758 fichiers / 7 945 tests ✅** · `tsc` 0 · lint 0 erreur · CI verte sur chaque PR · `git status` propre · base locale **536 séquences** (importée).
> **Reste / ops** : **UX** (« Ali 1 / Ali 2 » Bonta/Brâkmar, alignement visible après enregistrement, clic quête, message changement de perso) ; **UI** (détail/assets, DofusDex, icône Dofus, pastille succès sur le guide **public**) ; **Bloc I** (succès de donjon) ; **55 conseils** ; 3 donjons à aliasser ; cache public ; `/q/<slug>` ; **VPS** (`deploy-cd.sh beta` → `pg_dump` → archivage → import → `--delete-archive`). Détail : `ROUTE-RUSH-ISO-TOUGLI.md` §12 · `MODULE-RUSH-SYLVESTRE.md` §5.
> **Rotation** : blocs « suite 17 », « suite 16 » et « suite 15 » sortis (≥ 6 blocs) — récupérables via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 18/11/2026 (suite 22) — **Rush · Touglie enrichi mergé + quick win prérequis** — `dev` (`928c1d18`)

> **Demande user (verbatim)** : « enchaine 1 2 3 » (PR du seed, prérequis, puis UX/UI).
> **Fait** : PR **#1431** (Touglie enrichi + archivage) et **#1432** (prérequis) **mergées** ; `dev @ 928c1d18`. La suite entière a d'abord détecté une régression : `ROADMAP.md` à **62 162 o** pour un garde-fou à **61 440** → doc resserrée à **61 247 o** (le test n'a pas été touché).
> **Prérequis mesurés** : 492 arêtes `prereqIds` → **442 tags `prereq_text`** posés (règle pure `attachQuestPrerequisites`) ; écartées : **19** quêtes de classe (`1960`), **1** autre cité, **30** cibles absentes, 7 doublons de nom ; plafond **30 tags** du schéma d'import respecté. L'import est **additif** : les tags n'apparaissent qu'au prochain **archivage + import** (bêta/prod), pas sur le guide local déjà importé.
> **Correctif mesuré (même jour)** : le plafond de **80** (seed + Zod) coupait les **10 dernières quêtes** de « Alignement - Partie 2/4 » (**90 quêtes**) ; « Une faille dans sa carapace » ne pouvait donc pas afficher « Retour aux origines ». Plafond porté à **120**, payload **36 blocs / 601 séquences / 451 `prereq_text`**, chaîne **307 → 308 → 309** vérifiée (toutes brâkmariennes). Le compteur d'en-tête du dashboard disait « étapes » pour des **blocs** (`completedIds` = ids de jalons) → « blocs », verrouillé par `rush-vocabulary`.
> **Overlay (18/11)** : **light mode retiré** (état + `localStorage.sigil_overlay_theme` + bouton de l'en-tête) ; **icône de quête** dans la liste avec le repli `icone-quete.png` du dashboard. Backlog ajouté : quêtes d'alignement numérotées « Ali 1 / Ali 2 » séparées Bonta/Brâkmar, et visibilité de l'alignement après enregistrement (`router.refresh()` existe, l'overlay ne se met pas à jour → **à reproduire**).
> **UI — non livré, mesuré** : le « 0/448 vs 591 » n'est produit par **aucun chemin** du code (seed : **0** tag `info_sequence`, **0** `choice_group` ; `buildRushGuideView().counters` n'est consommé que par le guide public). Le garde-fou `rush-vocabulary` impose « quêtes » pour un compteur de lignes cochables : l'alignement de l'overlay sur `stepCounts` a été **reverté**. **Reproduire l'écran avant de corriger.**
> **Preuves** : **757 fichiers / 7 937 tests ✅** · `tsc` 0 · lint 0 erreur · audit sécurité vert (exception picomatch datée du 24/11) · CI verte sur les deux PR · `git status` propre.
> **Reste / ops** : reproduire le compteur 448 ; UX (clic quête, message perso, alignement/`resolveRushScenario`) ; UI (détail/assets, succès, DofusDex, icône) ; **Bloc I** ; 55 conseils ; `deploy-cd.sh beta` puis archive → import → vérifier → `--delete-archive` (humains).






