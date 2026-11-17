# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).
## 📝 Session 17/11/2026 (suite 19) — **Missions & sondages · visuels, « Sans ping », embeds de clôture** — branche `feat/missions-sondages-artwork` (PR vers `dev`)

> **Demande user (verbatim)** : « traite ce sujet en vérifiant chaque point … un commit par lot, une pr globale, go » — + vigilance « ne te base pas uniquement sur les sources siphonnées en local : c'est pas à jour, le vps l'est ».
> **Mesure** : `monsterImageUrl` est `null` pour **23 Songes, 17 Anomalies, 135 Régulations** ; le mapping d'images existait en **3 exemplaires divergents** (`mission-card`, `mission-editor`, `MissionLivePreview`) ; `skipDiscord = pingType === "NONE"` annulait tout Discord ; la sous-grille de reping n'offrait que ROLE/EVERYONE ; un **vote tardif** et la **fermeture paresseuse** fermaient le sondage sans supprimer l'embed ; `poll-creator` était bridé à 576 px.
> **Fait** : `src/lib/mission-artwork.ts` (titre → palier de Songe, 4 épreuves, `fragment/3-gardiens/ano1/anomalie`, familles calculées par règle + 4 alias mesurés, proxy donjon) + `MissionArtworkImage` (repli bannière) ; `mapOfficialToDraftMission` propage `imageUrl`/`epreuve` ; `src/lib/mission-publish.ts` (« Sans ping » ≠ « sans annonce ») ; « Sans ping » ajouté à la mise à jour (3 colonnes) ; `deleteChannelMessage` sur vote tardif et fermeture paresseuse (garde `status: "ACTIVE"`, ids lus avant) ; modale sondage `max-w-3xl`. **UI/UX de l'éditeur** : tokens seuls (plus de palette en dur ni de `glowColor`), `font-black`/`backdrop-blur`/`rounded-2xl`/ombres colorées retirés, onglet **Anomalies** + compteurs issus du catalogue, un seul défilement par panneau (plus de liste à 360 px), cibles tactiles 44 px sur mobile, `Select`/`Input` maison, `aria-pressed`/libellés, aperçu vide explicite.
> **Preuves** : suite **753 fichiers / 7 874 tests ✅** · `tsc` 0 · ESLint 0 erreur · verrous `mission-artwork` (18), `mission-publish-ping` (6), `sondages-embed-cloture` (4), `missions-editor-ui` (9). **Mesure de couverture** : 57 des 135 familles ont un fichier dans le dépôt, 78 non — le chemin est calculé et le bind mount `game-data` du VPS fait autorité (repli visuel si absent).
> **Reste / ops** : contrôle visuel 390/768/1024/1440 (catalogue de missions, modale de mission, modale de sondage) ; **aucune migration** ; ouvrir la PR vers `dev`. Deslop hors périmètre de la capture (reste) : `guild-progress-bar`, `guild-hall-widget`, `personal-guildaton-widget`, `validation-*`, `proof-upload-dialog`, `residency/submission-countdown`.
> **Rotation** : bloc « Session 16/11/2026 (suite 13) — Visiteurs · fiche V5 bis » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 17/11/2026 (suite 18) — **God · déslop complet (D6) et normalisation `ownerId` (D7)** — branches `feat/god-deslop-tokens` (PR #1421) et `feat/god-owner-id` (PR #1422)

> **Demande user (verbatim)** : « enchaine tout conclus tout » — après D5 (G1/G2), livrer D6 (déslop God, plafond 79) puis D7 (ownerId).
> **Mesure** : 39 fichiers God portaient encore ~1 800 occurrences de palettes en dur (zinc/emerald/amber/rose/white/black), 246 `font-black`, 136 `rounded-2xl/3xl`, 23 `backdrop-blur`, 116 `tracking-widest` ; `user-list.tsx` était orphelin et `forceDeleteUser` sans appelant. `GuildConfig.ownerId` : 7 guildes locales → 3 snowflakes (3/3 résolubles), 3 nulles, 1 interne ; trois écrivains pouvaient y remettre un snowflake.
> **Fait** : **D6** — tous les fichiers God tokenisés (zéro palette, zéro forme hors DA), contraste des boutons pleins, scrims alignés sur le kit, `user-list.tsx` + `forceDeleteUser` supprimés, garde `god-deslop` réécrite (palette/formes/kit) et plafond **79 → 78**. **D7** — `resolveGuildOwnerWriteId` (cible `User.id`, snowflake transitoire sinon), onboarding + self-heals dashboard/RGPD branchés, transfert inchangé (interne), script `scripts/backfill-guild-owner-id.ts` (dry-run par défaut) et procédure `MAINTENANCE.md`.
> **Preuves** : suite **748 fichiers / 7 824 tests ✅** · `tsc` 0 · ESLint 0 erreur · dry-run réel **7 guildes : 3 à normaliser, 0 sans compte lié, 4 déjà interne/nulle** · verrous `god-deslop` (8) et `guild-owner-normalization` (13).
> **Reste / ops** : **bêta faite le 17/11/2026** — backfill `ownerId` 3/3, D8 **15 296 → 0** (11 journaux d’audit et 2 sessions God purgés), migrations V4 jouées par le déploiement. **Reste** : visuels bêta (D9 + fiche visiteur), puis **prod** — merger `dev` → `main`, `./scripts/deploy-cd.sh prod`, backfill `ownerId`, D8, visuels.
> **Rotation** : bloc « Session 16/11/2026 (suite 12) — Visiteurs · carte Ocre alignée sur l'interne » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 17/11/2026 (suite 17) — **God · glossaire des statuts (G1) et tour de contrôle allégée (G2)** — branches `feat/god-glossaire-statuts` (PR #1419) et `feat/god-tour-controle` (PR #1420)

> **Demande user (verbatim)** : « Coder D5 : d'abord G1 (glossaire/libellés God), puis G2 (page God) », sans créer `/god/users`.
> **Mesure** : « autonome / pré-approuvé / à surveiller / gelée-off » n'était expliqué nulle part dans l'écran ; « À surveiller » ressemblait à une sanction alors que c'est un radar (≤ 3 profils) ; l'en-tête des guildes portait deux actions de même poids (« Connexions non autorisées » + « Whitelist New Guild ») et affichait des sections vides ; **G9 re-mesuré** : `?tab=tickets` est la seule surface utilisateurs, aucune route `/god/users`.
> **Fait** : **G1** — `src/lib/god-status-glossary.ts` (source unique des libellés + définitions du plan), légende dépliable « Comprendre les statuts », `title` sur chaque badge, « À surveiller » → « Peu de membres — à vérifier », « Pré-approuvées » → « Validées par le staff », fiche guilde avec origine datée et statut infobulle. **G2** — une action primaire « Autoriser une guilde », connexions non autorisées dans un menu `⋯` visible seulement s'il y en a, dialogue contrôlé, blacklist vide masquée, compteurs radar `aria-pressed` + libellés humains. G3/G5 déjà couverts par la fiche guilde ; G9 = rien à coder.
> **Preuves** : suite **748 fichiers / 7 820 tests ✅** · `tsc` 0 · ESLint 0 erreur · verrous neufs `god-status-glossary` (7) et `god-tour-controle` (4) · plafond `god-deslop` inchangé (**79**).
> **Reste / ops** : D6 (déslop God, plafond à faire baisser) → D7 (ownerId) ; D8/D9 humains ; migrations V4 bêta/prod ; contrôle visuel 390/768/1024/1440/1536 de la fiche visiteur.
> **Rotation** : bloc « Session 16/11/2026 (suite 11) — Visiteurs · avis de recherche, coches par personnage, page perso et fiche lecture seule » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 17/11/2026 (suite 16) — **Visiteurs · avis/donjons dans un seul filtre, fiches concises et assets** — branche `feat/visiteurs-listes-concises` (PR #1417)

> **Demandes user (verbatim)** : « au lieu de mettre les avis sous les dj ... on peut pas les mettre dans un filtre plutôt avec les dj » · « on peut pas laisser des pavé de succès comme ca et le drop down de dj, faut un meilleur tri plus concis idem pour les avis » · « t'as pas mis les assetsd » · « metamob faudrait la favicon du site etc et une idée du % de complétion de la quete si liée ».
> **Mesure** : `/visiteurs?vue=succes` rendait deux master-détails (donjons puis avis) ; `?donjon` + `?avis` pouvaient coexister ; la fiche lecture seule affichait 2 colonnes de cartes et un `Select` de tous les donjons ; le DTO `VisitorAchievement` n'avait pas l'image du donjon ; les cartes de synthèse et Metamob n'avaient pas d'asset ; `getPublicOcreProgress()` est **lecteur-scopé** (clé Metamob privée).
> **Fait** : `?liste=avis` + zone maître-détail unique (avis prioritaire sur un ancien lien mixte), `SharedSuccesView` sans section empilée ; fiches lecture seule en **tableaux denses**, tri donjon/zone/nom/points/niveau, combobox donjon/zone **recherchable**, **filtre donjon obligatoire** (sinon « N donjons » + consigne, plus de mur de 200 lignes) ; `dungeonImageUrl` ajouté au DTO public + select ; assets Dofus sur les cartes de synthèse (expérience, trophée, donjon, aviton) et les sections ; favicon Metamob local ; **% Ocre seulement sur sa propre fiche** (aucune donnée d'un autre visiteur, aucune clé).
> **Preuves** : **746 fichiers / 7 809 tests ✅** · `tsc` 0 · ESLint 0 erreur · audit sécurité vert · métadonnées **0** · CI **7m48** · `Build & Push` bêta **11m35** · PR **#1417** mergée, `dev @ 721d71bb`.
> **Reste / ops** : contrôle visuel 390/768/1024/1440/1536 de la fiche ; migrations V4 bêta/prod ; **D5** (G1/G2, sans `/god/users`), puis D6/D7 ; D8/D9.
> **Rotation** : bloc « Session 16/11/2026 (suite 10) — Reprise D1/D2/D3 » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 17/11/2026 (suite 15) — **Simulateur · seuil conteneur, cadres de la fiche avis et reprise du plan God** — branche `fix/simulation-responsive-conteneur` (PR #1415)

> **Demande user (verbatim)** : « ya un vrai pb avec le simulateur non responsive qui sort à droite » puis « pl ya autant de contour ».
> **Mesure** : `SpellRangeGrid` passait en côte à côte à `2xl` (fenêtre ≥ 1536 px) alors que la fiche avis ne lui laisse que ~700 px (`max-w-6xl` − colonne de 340 px) : le rail de 384 px écrasait le plateau. La fiche empilait aussi une seconde carte et la légende gardait le style flottant `board`.
> **Fait** : seuil **conteneur** (`@container` + `@5xl` = 64 rem) pour le plateau et le rail ; prop `embedded` (fiche avis/monstre) qui supprime la seconde carte ; légende `full` dans le rail ; barre, puce du sort et badges sans bordures redondantes ; verrous `boss-simulation-spells` et `sim-tactique-rangement` mis à jour.
> **Preuves** : **746 fichiers / 7 804 tests ✅** · `tsc` 0 · ESLint 0 erreur · audit sécurité vert · CSS dev contient `@container (min-width: 64rem)`.
> **Reprise** : **D4 est déjà livré** (#752, 25/09/2026) — la ligne `ROADMAP` a été corrigée ; la reprise du plan God commence à **D5** (G1 glossaire + G2 tour de contrôle ; G9 re-mesuré : pas de route `/god/users`, surface dans `?tab=tickets`).
> **Reste / ops** : contrôle visuel 390/768/1024/1440/1536+ de la fiche avis ; `Build & Push` bêta post-#1415 ; aucune migration, aucun secret.
> **Rotation** : bloc « Session 16/11/2026 (suite 9) — God · lot C » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 16/11/2026 (suite 14) — **Visiteurs · filtres de la fiche + fiches boss (simulation, responsive)** — branche `feat/visiteur-fiche-complete` (PR #1414)

> **Demandes user (verbatim)** : « la liste des succès des fiches lectures seules n'a aucun filtre c imbuvable idem avis · metier on balance tout d'un coup » · « les fiches boss pas de bloc simu mais actif pour les avis et ko responsive » · « Note dans le plan, le plan doit être à jour 100% pour reprendre dans une autre session ».
> **Mesure** : la fiche V5 bis rendait 60 succès + 60 avis + 16 métiers d'un bloc, sans filtre ; `SpellRangeGrid` passait en 2 colonnes dès `lg` alors que le détail avis ne dispose que de ~880 px ⇒ débordement ; la fiche boss passait `knownSpellIds` **vide** à `mergeDofensiveSpells`, qui écartait tous les sorts Dofensive (aucun bloc simu).
> **Fait** : `src/lib/visitor-profile-filters.ts` + `VisitorProfileLists` (recherche, personnage, donjon/zone, niveau, pagination 24, « Voir plus »), plafonds 200/120 ; `knownSpellIdsForMerge` branché page boss + client ; `SpellRangeGrid` et les 3 vues Succès empilent avant `2xl` ; i18n FR/EN ; verrous `visiteur-profile-filters`, `boss-simulation-spells`, `visiteur-page-perso`.
> **Preuves** : suite **746 fichiers / 7 802 tests ✅** · `tsc` 0 · ESLint 0 erreur.
> **Reste / ops** : contrôle visuel 390/768/1024/1440 (fiche filtrée, avis, boss sans sorts locaux), migrations V4 bêta/prod, D4→D7.
> **Rotation** : bloc « Session 16/11/2026 (suite 8) — Télémétrie · lot B » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.





