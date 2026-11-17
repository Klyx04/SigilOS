# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).
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




