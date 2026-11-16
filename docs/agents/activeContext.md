# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).
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


## 📝 Session 16/11/2026 (suite 9) — **God · lot C : vue d'ensemble allégée, SSE supprimé, cartes tokenisées** — branche `feat/god-overview`

> **Décision user (verbatim)** : « GO LOT B ET C l'un après l'autre enchaine 2 pr ».
> **Mesure** : `getPlatformActivityStats` chargeait **tous les `User`** + **tous les `AuditLog`** des 30 j en mémoire ; `getPlatformStats` = 10 `count()` repoussés toutes les 5 s par onglet ouvert (172 800 comptages/jour/onglet) ; `announcement-panel` **102 motifs**, `worker-tester` **40**, `page.tsx` 56.
> **Fait** : **C1** — « Indicateurs plateforme » et « Activité de la plateforme » supprimées, `LiveStats`/`ActivityChart`/`god-live-stats.ts`/SSE/`getPlatformStats`/`getPlatformActivityStats` supprimés (−1 161 lignes), `SystemHealthDashboard` conservée. **C2** — bandeau compact « Pilotage » (phrase, horodatage Europe/Paris, lien Journaux via `godRoute`), fallback tokenisé sans `animate-pulse`. **C3** — `AnnouncementPanel` en deux cartes (« Bandeau du dashboard » / « Broadcast Discord ») et `WorkerTester` en carte compacte « Synchronisation & diagnostic », mêmes actions et champs. **C4** — santé tokenisée (0 motif) et polling **en pause** quand `document.visibilityState === "hidden"`, reprise + refresh au retour.
> **Preuves** : **739 fichiers / 7 744 tests ✅** · `tsc` 0 · ESLint 0 erreur · ciblés : `god-overview` 4, `god-overview-tabs-render` 3, `god-overview-deslop` 4, `god-deslop` 4 · plafond de fichiers God **81 → 79**.
> **Reste / ops** : contrôle visuel humain 390/768/1024/1440 de `?tab=overview` ; aucune migration, aucun secret. Le SSE disparaît : plus aucune requête de stats toutes les 5 s depuis l'overview.
> **Rotation** : bloc « Session 16/11/2026 (suite 3) — Visiteur · entrée guidée » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 16/11/2026 (suite 8) — **Télémétrie · lot B : filtre guilde réparé, flux serveur, écran God déslopé** — branche `feat/god-telemetrie`

> **Décision user (verbatim)** : « GO LOT B ET C l'un après l'autre enchaine 2 pr ».
> **Mesure** : le sélecteur envoyait `GuildConfig.id` (CUID) alors que les événements stockent le snowflake de l'URL ⇒ **0 ligne** dès qu'une guilde était choisie ; le flux était plafonné à 100 événements et filtré côté client ; le chemin était tronqué à 320 px ; `details.userAgent` (périmé) restait affiché ; **46 motifs** de slop mesurés (le cadrage en citait 72).
> **Fait** : **B1** — `src/lib/telemetry/guild-scope.ts` (`resolveTelemetryGuildScope` : CUID **et** snowflake, inconnu ⇒ `none` sans requête), branché dans `getTelemetryStats` (`guildId: { in: scope.ids }`, `internalGuildId` pour `UserProfile`/`PlayerDofusProgress`) et dans l'export. **B2/B3** — `src/lib/telemetry/surface.ts` (`classifyTelemetrySurface`, `buildTelemetrySurfaceWhere`), `getTelemetryLiveEvents` (super-admin, Zod `limit ≤ 200`, cursor, guilde/surface/type/recherche serveur, `sanitizeTelemetryDetails`), `adminPages` (7 j, motif normalisé + membres distincts). **B4** — dashboard réécrit : tokens uniquement, 0 motif, chemin complet `break-all` + lien interne + copie, badge de surface, langue, dates exactes, pagination « Charger plus », rafraîchissement 30 s **du flux seul**, agrégats chargés une fois.
> **Preuves** : **738 fichiers / 7 742 tests ✅** · `tsc` 0 · ESLint 0 erreur · ciblés : `telemetry-guild-scope` 6, `telemetry-surface` 8, `telemetry-stats-guild-scope` 3, `telemetry-live-events` 3, `telemetry-dashboard-deslop` 3 (**23 neufs**, 89 avec les gardes existantes).
> **Reste / ops** : contrôle visuel humain 390/768/1024/1440 de `?tab=telemetry` ; la preuve de perf est structurelle (un appel `limit + 1` par page au lieu de la grappe d'agrégats à chaque frappe/30 s).
> **Rotation** : bloc « Session 16/11/2026 (suite 2) — Discord · Commande slash `/legendaire` » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 16/11/2026 (suite 7) — **Rétention · lot A : purge télémétrie 90 j + journal d'activité 365 j** — branche `feat/retention-logs`

> **Décision user (verbatim)** : « A complet » — go explicite pour le lot A du cadrage `PLAN-RETENTION-TELEMETRIE-JOURNAUX.md` (suppression de données) ; durées **90 j** / **365 j** inchangées.
> **Mesure** : `cleanup-logs` ne connaissait que l'audit (90/30 j), les notifs God et le marché ; `scripts/database-janitor.ts` ne citait ni `TelemetryEvent` ni `ServiceActivityLog` ⇒ **aucune purge** sur les deux tables. `TelemetryEvent` porte **6 index** dont `[createdAt]` ; `ServiceActivityLog` **3 index**, aucun sur `createdAt` seul.
> **Fait** : **policy** `src/lib/telemetry-retention-policy.ts` (90/365, lots de 500, budget de 10 lots) · **core** `src/server/log-retention.ts` (hors `"use server"`, suppression conditionnelle par ids, télémétrie par `createdAt`, activité **guilde par guilde** sur `GuildConfig.id` interne, `hasMore`/`failed` isolés, compteurs seulement) · **`cleanup-logs`** : deux purges isolées, compteurs dans `recordCronExecution`, `console.error` → `logger` · **janitor** : même politique en import relatif, `DRY_RUN` conservé · **God Stockage** : `getGuildLogsStats` expose `retention` (`count` + `aggregate _min.createdAt`), onglet « Logs par guilde » avec deux tuiles en lecture seule (Télémétrie 90 j / Journal d'activité 365 j, plus ancienne ligne, « purge au prochain cron »).
> **Preuves** : **35 tests ciblés verts** (`telemetry-retention-policy` 6, `log-retention` 13, `cleanup-logs` 8, `janitor-logs-retention` 5, `storage-retention-stats` 3) · `npx tsc --noEmit` 0 · `npm run lint` 0 erreur · `git status --short` propre · **`npm run test:run` à passer avant la PR**.
> **Reste / ops (humain)** : première passe réelle — dry-run du janitor puis `cleanup-logs`, mesure des compteurs God avant/après ; si `hasMore` reste vrai plusieurs jours, augmenter `LOG_PURGE_MAX_BATCHES` **avec la mesure** ; image applicative pour le cron, `git pull` sur le VPS pour le janitor ; exporter (`exportTelemetryDataAction`) **avant** la première passe si des tendances > 90 j doivent être conservées.
> **Rotation** : bloc « Session 16/11/2026 (suite) — Visiteur · tours publics (profil + guide Rush) » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


