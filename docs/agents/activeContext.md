# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).
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


## 📝 Session 16/11/2026 (suite 6) — **God · V3 visiteurs (liste + reset) + fiche guilde refondue** — branche `feat/god-visiteurs`

> **Décisions user (verbatim)** : « V3 god des visiteurs : à dev coté guilde oui avec la refonte UI de toute la partie guilde complete en meme temps , raz le q de tous ces IA slop » · « le jour de l'ouverture on aura la meme chose que la landing actuel de la beta » (**D7 tranché**) · « la démo est loin d'être fini » · acquisition = outils publics déjà en ligne · V2d abandonné · affinage fiche soldé.
> **Mesure** : aucun écran God « visiteurs » (`src/app/god/` sans dossier dédié) ; `/god?tab=guilds` ne rend que `GuildTable` + `BlacklistSection` ; `guild-table.tsx` portait **89** motifs de slop (palettes `zinc`/`violet`/`emerald`/`amber`, `font-black`, `rounded-2xl/3xl`, gradients, emoji, `animate-pulse`), `blacklist-section.tsx` **≈ 12** ; la fiche guilde en portait **104** de plus (`page.tsx` 34, `access-panel` 27, `target-purge-panel` 31, `user-list` 6, `guild-tabs` 4, `modules-client` 2), avec les colonnes vides du roster partagé (`ANKAMA ID` = « AJOUTER ID », `SUPPRESSION` = `-`) ; `PublicProfile` porte les 3 consentements et `banEntity`/`unbanEntity` existent déjà.
> **Fait** : **V3-a** — sous-vue `?tab=guilds&vue=visiteurs` (super-admin seulement), règle pure `src/lib/god-visitors.ts` (bornes d'URL, `where` consentement/recherche/serveur, DTO sans mule/Metamob/`userId`, pagination), lecture serveur `src/server/god-visitors.ts` (garde `isSuperAdmin` **avant** toute requête), `visitors-panel` + `guild-area-switch` + `god-pagination-links` (kit God). **V3-b** — `resetGodVisitorVisibility` : les 3 consentements repassent à `false`, idempotent, garde d'état dans le `WHERE`, rate limit Redis, journal `GOD_CONFIG_OVERRIDE` (cible `PROFILE`, sans `discordId`) ; bouton `visitor-visibility-reset`. **V3-c** — `deleteGodVisitorUser` : ban `PlatformBan` **avant** suppression du `User` (cascade), refus fail-closed si propriétaire d'une guilde, confirmation `SUPPRIMER`, rate limit 3/min, journal sans `discordId` ; **fiche détail** `?visiteur=` (identité, Discord, guildes, consentements) + boutons `Bannir` / `Bannir + supprimer`. **Fiche guilde** — en-tête refait (icône, nom, ID, phrase d'origine, statut, 3 chiffres mesurés), **4 onglets** (`Vue d'ensemble` / Modules / Journal / Accès & RBAC), **bloc propriétaire** (avatar, pseudo Dofus, classe, niveau, points, **lien ladder Ankama**) résolu depuis `ownerId` (snowflake **ou** UUID) par `src/lib/god-guild-owner.ts`, roster `showIds={false}`, modules avec **libellés humains + assets `nav/*`**, RBAC avec **libellés de permissions** (plus de slug brut) et compteur de sensibles. **Membres** — le **pseudo Dofus ladder** est enfin lisible sous le nom Discord (`pseudoDofus` → repli `dofusPseudo`, niveau calculé depuis `totalXp`, points `achievementPoints`, **lien ladder Ankama**), badge « Pseudo manquant » remplacé par un texte normal, menu membre regroupé (`Actions` / `Fiche Dofus` / `Danger`), libellés clarifiés (« Bannir de la guilde (profil conservé) » vs « Exclure (profil supprimé) »), statuts traduits (Actif/Archivé/Banni), `font-black`/uppercase/`rounded-2xl` retirés de **toute la table** (ligne, menu, filtres, tableau, pagination, modales). **Modules (pilotage guilde)** — carte désactivée refaite : **un seul statut** (badge dupliqué supprimé), plus d’`opacity-50`/`grayscale`, pages et RBAC **masqués quand le module est OFF**, `rounded-2xl`/`font-black`/uppercase retirés, grille resserrée (16 → 4 px) et barre de résumé tokenisée. **Rétention (audit 16/11)** — **bug critique corrigé** : le janitor VPS supprimait tout `User` sans `UserProfile` depuis 7 j, donc **tout visiteur** (qui n'a qu'un `PublicProfile`) ; le filtre exclut désormais `publicProfile: { is: null }` (règle pure `buildOrphanUserWhere`, verrou `janitor-orphan-visitors` **7**), et l'e-mail n'est plus journalisé. **Même faille dans le panneau God « Comptes sans profil »** : `getGhostUsers` et `cleanupGhostUsers` excluent les profils publics, `deleteGhostUser` refuse explicitement un visiteur, et le log de purge ne porte plus pseudo/discordId. **Panneau + `user-list`** tokenisés (0 motif de slop : `rounded-[2.5rem]`, `backdrop-blur`, glow, `font-black`, uppercase, `animate-pulse`, palettes zinc/rose/amber/emerald/blue). **Mesure** : `TelemetryEvent` et `ServiceActivityLog` restent **sans purge** (voir ROADMAP §0). **Liste guildes** — menu d'état redondant retiré (les 5 cartes sont le filtre), **légende en clair**, menu d'actions réduit à 5 entrées (« Archiver 30 jours (réversible) », « Supprimer définitivement (irréversible) »). **Refonte UI** : `guild-table.tsx` et `blacklist-section.tsx` passés aux tokens (0 motif de slop mesuré sur les deux fichiers), boutons/ordre/libellés conservés — seuls les emoji décoratifs et « Bot Seul » → « Bot seul » changent.
> **Amorces cadrées le 16/11 (aucun code)** : `docs/plans/PLAN-RETENTION-TELEMETRIE-JOURNAUX.md` (lot A, go-ahead attendu) et `docs/plans/PLAN-GOD-TELEMETRIE-OVERVIEW.md` (lots B/C) — ordre dans `ROADMAP.md` §2 bis.

> **Preuves** : `npm run test:run` **728 fichiers ✅** · `tsc` 0 · ESLint **0 erreur** · verrou `god-visitors` **26** + `god-guild-owner` **7** · plafonds God ajustés **77 → 81** (4 fichiers neufs, tous consommateurs du kit) avec justification dans `god-deslop` et `rush-editor-shell`.
> **Reste / ops** : `target-purge-panel` et `user-list` — **tokenisés** (0 motif de slop mesuré) · **contact propriétaire à l'onboarding** (debug2.md) bloqué par **D5** · normalisation `ownerId` (UUID seul) encore ouverte · **D7 levé** mais bloc Caddy `sigilos.fr` à réécrire depuis le bloc bêta (`/game-data/*`, `/socket.io/*`, en-têtes, rate limit) · contrôle visuel 390/768/1024/1440 de l'écran God · rebuild bêta/prod.
> **Rotation** : bloc « Sentry · un log n'est pas une exception… » sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.























