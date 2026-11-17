# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).
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



## 📝 Session 16/11/2026 (suite 13) — **Visiteurs · fiche V5 bis complète (succès, avis, mules, activités, Rush, Metamob)** — branche `feat/visiteur-fiche-complete`

> **Demande user (verbatim)** : « c ca que t'appelle fait sur v5 fche lecture seule ? » puis choix « V5 bis complet : succès + avis + mules + activités + Rush/Metamob (en respectant les consentements) ».
> **Mesure** : la fiche V5 ne rendait que le hero, 4 compteurs, présentation/objectifs/métiers ; le DTO `VisitorProfile` ne portait ni mules, ni activités, ni listes de succès/avis, ni Rush, ni Metamob. Les données existaient en base (`altPseudos`, `preferredActivities`, `PublicDungeonAchievement`, `PublicBountyCompletion`, `PublicRushProgress`, `metamobPseudo/Verified`).
> **Fait** : `VisitorProfile` enrichi (mules normalisées, activités filtrées par liste blanche, succès/avis plafonnés à 60 avec totaux `_count`, Rush résumé par personnage, Metamob vérifié) ; `PROFILE_SELECT` + `hydrateProfile` lisent le Rush **seulement** si `showRushProgress` ; `VisitorProfileCard` rend les sections (aucune palette en dur, assets du jeu) ; i18n FR/EN ; décision `D-V9 bis` ; verrous `visitor-directory` + `visiteur-page-perso`.
> **Preuves** : suite **744 fichiers / 7 790 tests ✅** · `tsc` 0 · ESLint 0 erreur · ciblés **141 ✅** (8 fichiers).
> **Reste / ops** : contrôle visuel 390/768/1024/1440 de la fiche (listes longues, Rush non partagé, Metamob vérifié) ; aucune migration.
> **Rotation** : bloc « Session 16/11/2026 (suite 7) — Rétention · lot A » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.



## 📝 Session 16/11/2026 (suite 12) — **Visiteurs · carte Ocre alignée sur l'interne (possession + vraie synchro)** — branche `fix/ocre-visiteur-parite`

> **Demande user (verbatim)** : « la quete ocre se sync pas en externe comme l'interne c bizarre » (+ captures : externe 1/18, 0 %, 0/51, 0/286 ; interne 1/34, 69 %, 42/51, 191/286).
> **Mesure** : la route de quête Metamob renvoie `status` / `want` / `offer` sans `owned` ; l'interne passait par `normalizeQuestMonster`, le visiteur lisait `owned ?? 0` ⇒ 0 capture partout. `stepCount` venait de `quest_template.step_count` (18) alors que l'interne affiche 34. Enfin, « Forcer la synchro » relisait le cache Next (`revalidate` 3600) et le patch relisait sans `skipCache` (double cross-check factice).
> **Fait** : `toPublicOcreMonster` reçoit l'`owned` normalisé (`normalizeQuestMonster`, `parallel_quests`) ; comptage des deux côtés par `isOcreMonsterNeeded` (possédé **ou** étape passée) ; `OCRE_TOTAL_STEPS = 34` source unique (guide, PiP, carte visiteur) ; `getPublicOcreProgress({ force })` borné par Zod, `skipCache`/`revalidate: 0` sur la lecture forcée (TTL normal 5 min) ; relecture du patch sans cache + `revalidateTag` par pseudo ; tests `ocre-possession-parity`.
> **Preuves** : `npm run test:run` **744 fichiers / 7 786 tests ✅** · `tsc` 0 · ESLint 0 erreur · ciblés **108 ✅**.
> **Reste / ops** : contrôle visuel 390/768/1024/1440 de la carte Ocre visiteur (valeurs identiques à l'interne, bouton « Forcer la synchro ») ; les migrations V4 restent à jouer en bêta puis prod.
> **Rotation** : bloc « Session 16/11/2026 (suite 6) — God · V3 visiteurs + fiche guilde » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 16/11/2026 (suite 11) — **Visiteurs · avis de recherche, coches par personnage, page perso et fiche lecture seule** — branches `fix/visiteurs-filtres-hover`, `feat/avis-et-personnages`, `feat/visiteur-page-perso`

> **Demande user (verbatim)** : « on s'était dit aussi qu'on referait la page perso plus personnalisé à la duffus sans copier duffus évidemment et aussi les pages en lecture seule laide actuellement » · « ajoute les avis de recherche dans /espace-visiteur/succes à cocher simplement, validé ou non, même fiche que l'interne, et que ça se voit côté filtre commun, avis fait non fait » · « oui cree la table et enchaine visiteur filtre commun mais idem coté profil de guilde interne : pouvoir cocher les avis de recherche + filtre commun et évidemment on doit pouvoir changer de mule aussi pour les coches des succès, interne et visiteurs » · « ya aucune hover ou survrillance a la selection c penible ».
> **Mesure** : le survol des filtres utilisait `hover:bg-surface` sur un panneau `.reg-panel` en `--surface` (invisible) ; les avis étaient listés en lecture seule dans `/espace-visiteur/succes` ; le tracker interne écrivait `UserDungeonProgress` sans personnage ; la page perso et la fiche `Rakzia` n'avaient ni hero ni compteurs.
> **Fait** : **#1409** survol/sélection (hover elevated, ring actif, focus). **#1410** deux migrations **additives** (`PublicBountyCompletion` / `UserBountyCompletion`, `characterSlot` sur les coches) ; coche d'avis visiteur + fiche `BountyFicheView` partagée ; section « Avis de recherche » dans `/visiteurs?vue=succes` (fait / cherchent encore) ; côté interne, sélecteur de personnage dans Mes Succès et la fiche Avis, carte « Avis de recherche » avec filtre commun de guilde. **#1411** page perso (hero, 4 compteurs réels, visibilité, raccourcis ; formulaires et ancres du tour inchangés) et fiche lecture seule (hero, 4 chiffres dont « avis faits » via `bountiesDone`, présentation/objectifs/métiers).
> **Preuves** : suite **743 fichiers / 7 777 tests ✅** · `tsc` 0 · ESLint 0 erreur · migrations appliquées en local (`migrate deploy` + `generate`) · PR **#1409**, **#1410**, **#1411**.
> **Reste / ops** : jouer les migrations en **bêta puis prod** (`prisma migrate deploy`) ; contrôle visuel 390/768/1024/1440 de la page perso, de la fiche `/visiteurs/[id]`, du sélecteur de personnage et du filtre avis ; D4→D7 inchangés.
> **Rotation** : bloc « Session 16/11/2026 (suite 5) — Stats · restes soldés » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 16/11/2026 (suite 10) — **Reprise D1/D2/D3 : Discord SigilOS, rangs explicites, annuaire multi-serveurs** — branches `feat/discord-sigilos`, `fix/ladder-libelles`, `feat/visiteurs-filtre-serveur`

> **Demande user (verbatim)** : « Commence par D1 et D2 (XS), puis D3. »
> **Mesure** : `discord.gg/uX7G6SUDgN` résout la guilde **SigilOS** ; `/discord` (`BMVvXpYHEt`) résout **STELLIUM** (nom interne). `#364` = rang du worker Ladder **Ankama** ; `#13` = `getLadderPreview` (membres ACTIFs avec plus de points + 1), pas un rang Ankama. `/visiteurs` figeait `dofusServerId: viewer.serverId` dans la liste **et** la fiche : explorer un autre serveur aurait rendu un 404 par profil.
> **Fait** : **D1** — `src/lib/discord-invite.ts` (env + repli), lien « Discord » à côté de Documentation (rangée en `flex-wrap` pour la sidebar à 232 px), bouton « Rejoindre le Discord » sur Tickets (cible 44 px), verrou `discord-sigilos-links` 3 tests. **D2** — `src/lib/ladder-rank.ts` (`formatRankOrdinal` déterministe U+202F : `364ᵉ`, `1ᵉʳ`, `—`), libellés « Rang succès » / « Rang interne » + info-bulles, carte en `flex-wrap` (390 px), verrou 3 tests. **D3** — `serverId` borné 1..9999 + `all`, serveur du lecteur en défaut, consentement `showOnDirectory` **global** (liste **et** fiche), menu serveur avec icônes `ALL_DOFUS_SERVER_ENTRIES`, colonne Serveur (sous le pseudo en mobile), pagination qui préserve `serverId`, i18n FR/EN, texte de consentement explicite, plan D-V18 révisé, 81 ciblés.
> **Preuves** : suite **739 fichiers / 7 752 tests ✅** · `tsc` 0 · ESLint 0 erreur · PR **#1405**, **#1406**, **#1407** mergées · aucune migration, aucun secret, aucun cron.
> **Reste / ops** : contrôle visuel humain 390/768/1024/1440 de la sidebar, de la page Tickets et de `/visiteurs` (menu serveur + colonne) ; vérifier le post-merge `Build & Push` bêta ; D4→D7 inchangés.
> **Rotation** : bloc « Session 16/11/2026 (suite 4) — Visiteur · guide Rush » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.



