# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 21/11/2026 (suite 50) — **Essais : J-3, prolongation, filtre « à valider »** — branche `feat/essais-notifications-2026-11-21` (empilée sur #1490)

> **Demande user (verbatim)** : « Notification Discord lors d'une prolongation d'essai · Alerte J-3 (la doc produit la promet, le code ne le fait pas) · Filtre/onglet « essais à valider » » puis « j'en ai marre que tu t'arrêtes à chaque point ».
> **Fait** : ① **alerte J-3** (`isTrialEndingSoon`, fenêtre 3 jours) : le cron `sync-members` envoie un embed « ⏰ Essai — échéance proche » (une fois par membre + échéance, clé `trial-soon:`), en plus de la fin d'essai ; ② **prolongation** : `setMemberTrialState` lit l'ancienne échéance **avant** l'écriture et poste « 🔄 Essai prolongé » (ancienne → nouvelle) dans `trialEndNotifyChannelId`, fail-soft (l'état d'essai est écrit même si Discord refuse) ; ③ **filtre « À valider »** avec compteur dans la liste Membres (`isTrialAwaitingValidation`, échéance atteinte + non validé ; le reste exact en minutes prime sur `remainingDays`).
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


## 📝 Session 21/11/2026 (suite 48) — **Sécurité #1485/#1486 · B-3 dashboard · `proxy-image` async · doc** — branche `chore/security-guards-infra-2026-11-21` (PR #1486)

> **Demande user (verbatim)** : « tout ça est documenté / vérifier pour enchainer ? » puis « documente maj tout ce qui doit l'être puis choisi 5 chantiers à faire dans cette session ».
> **Mesure (git + code)** : **#1485 mergé** (`a9fee50d`), `dev` local en retard (`7a74ff2e`) ; #1486 ouvert, CI verte, merge sans conflit ; **aucun `PERF-WEB` §6.3 bis** (le fichier s'arrête à §5) ; `getPolls` déjà en `select { id }` (B-1) ; `getUserProfile` = **4 lectures** pour 3 champs ; `proxy-image` 100 % synchrone ; **`game-data:ro` casse des écritures de l'app** (`sync-monster-stats` → `dungeon-monsters.json`, God upload/download, bascules « ignorer »).
> **Fait** : ① **#1486 mergé**, corrigé par **#1487** (montages app-prod/app-beta **RW assumés**, l'app écrit — commentaire mesuré) ; ② **B-3 profil allégé** (`getUserProfileSummary` + `DASHBOARD_PROFILE_SUMMARY_SELECT` — 1 lecture pour l'accueil, les autres écrans gardent `getUserProfile`) ; ③ **B-3 TTL stats 60 → 180 s** (`GUILD_STATS_CACHE_TTL_SECONDS`, clé `guild:stats:<guildId>`) ; ④ **`proxy-image` en `fs.promises`** (plus de `*Sync`, branche `.svg` morte retirée) ; ⑤ doc (ROADMAP, PERF-WEB §2/§3.5/§3.6, RUSH-DEV §5, ROUTE §13, `AGENTS.md`).
> **Preuves** : `proxy-image-svg` 4 · `dashboard-profile-summary` 2 · `guild-stats-cache` 2 · `tsc` 0 · ESLint **0 erreur** · aucune migration.
> **Reste** : **redéployer la bêta** (2 bots, Caddy, 1 upload God, 1 run `sync-monster-stats`) → P2 cadrage → P3 CDN (D8) ; requêtes 600–1 000 ms du dashboard à mesurer par `EXPLAIN ANALYZE` (à chaud) ; itérations 5/6 (définition absente) ; 3 tags `succes` + 6 positions (God).
> **Rotation** : bloc « suite 42 » (UI Rush, PR #1473) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 21/11/2026 (suite 47) — **Perf web · P1-2, images servies à la taille d'affichage** — branche `perf/p1-2-images-2026-11-21` (PR #1482)

> **Demande user (verbatim)** : « l'objectif c'est surtout de tout prendre en compte, interne public, tout le projet » puis « go ».
> **Mesure avant** : `calendar_kralamour.png` **8,2 Mo**, `calendar_autres.png` 2 Mo, `songes.png` 1,3 Mo, `dofus-missions-thumb.png` 1,08 Mo, `Roublard.png` 1,6 Mo, `calendar_dungeon_farm.png` 892 Ko — servis tels quels au navigateur, souvent pour un rendu de 16 à 144 px.
> **Fait** : `next/image` sur `event-card` (fill + `sizes`), `raid-hero-banner` (56 px), `SongesPicto` (16–32 px), `mission-settings` (144 px), `BombGame` (800 px). Les PNG restent la source des embeds Discord (`calendar-event-images.ts`).
> **Gain mesuré (sharp, qualité 75)** : kralamour **31 Ko** @512, dungeon_farm **47 Ko**, autres **23 Ko**, songes **< 1 Ko** @32, vignette missions **7 Ko** @144, Roublard **84 Ko** @800 → **÷20 à ÷100**.
> **Fait (B-1, PR #1483)** : id de guilde résolu **une fois par requête** (`src/server/guild-id.ts`, React `cache` + mémoire 5 min) ; **4 lectures `GuildConfig` en double retirées** (calendrier, raid, activité, sondages, présence).
> **Fait (B-2, PR #1484)** : calendrier du dashboard en **une lecture** (semaine + raid actif + focus 24 h, règle pure `dashboard-calendar`) ; focus préchargé, **2 requêtes `GuildEvent` en moins**.
> **Preuves** : **788 fichiers / 8 219 tests ✅** (dont `guild-id` 2/2, `dashboard-calendar` 4/4) · `tsc` 0 · ESLint 0 erreur · `next-image-local-patterns` 3/3 · aucune migration.
> **Reste** : `logo-v2.png` 170 Ko (favicon/manifest 32/192 px) ; P1-3 cache public ; P2 statique/PPR ; P3 CDN/WAF.
> **Rotation** : bloc « suite 41 » (revalidations Rush) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 20/11/2026 (suite 46) — **Perf web · P1-1, spans serveur du dashboard** — branche `perf/p1-1-spans-2026-11-20` (PR #1479)

> **Demande user (verbatim)** : « reprenons : […] Si tu valides ce périmètre, je démarre par 1.1 immédiatement ; sinon dis-moi ce que tu veux prioriser ».
> **Mesure avant code (Sentry 7 j, doc §0)** : `/dashboard/:guildId` = **1 980 transactions** (≈ 280/j), p95 **836 ms** ; prélèvement serveur **5 %**. `@prisma/instrumentation` **absent** du projet mais **Prisma est déjà tracé automatiquement** (`prisma:client:operation`, SQL, `pg-pool.connect`) — inutile de l'ajouter. POST > 1 s (sous-ensemble) : `quetes-dofus/guide/[slug]` **100**, `profile` **80**, `galerie-stuff` 20, `missions` 10 — des **server actions** qui re-rendent le layout.
> **Correction de diagnostic** : `getGuildHeaderData` (cache mémoire **60 s**) et `getGuildModules` (**30 s**) sont **déjà** cachés ; `getUserGuilds`/`getPlatformConfig` ont `cache()` depuis P0. Le « cache dashboard » restant à trancher est donc `getUserContext` (déjà Redis 60 s) et la requête `getUserGuilds` — la mesure décide.
> **Fait (P1-1)** : helper `withSpan` (`src/lib/perf-span.ts` : serveur, no-op si Sentry off, rejet jamais avalé) ; **6 spans** sur le layout (`getUserContext`, `getGuildHeaderData`, `getUserGuilds`, `getGuildModules`, `getPlatformConfig`, `getUpcomingGuildEvents` **streamée**) ; sous-spans `userContext.redis.get`, `userContext.guildConfig.read`, `userContext.discord.fetch`, `userGuilds.query`, `guildHeader.*`, `guildModules.guildConfig.read`, `platformConfig.read` ; **aucun `guildId`** dans un nom de span (verrou `tests/unit/perf-span.test.ts`, 9 cas).
> **Trace bêta du 20/11 (après deploy)** : `GET /dashboard/[guildId]` = **1 964 ms** ; `getUserContext` touche Redis (`user:ctx…`, **3,9 ms**) et **n'appelle pas Discord** ⇒ le layout n'est pas le coût principal ; le `render route` porte ~20 opérations Prisma à 600–1 000 ms. `pg-pool.connect` sur 1 h : p50 **1,1 ms**, p95 **82 ms** (max 981 ms).
> **Correction mesurée (PR #1480)** : le SDK Next isole le rendu RSC dans un scope **sans client** ; `startSpan` rendait un span non enregistré (zéro donnée en bêta). `sentry.server.config.ts` enregistre le client rendu par `init` (`globalThis`) et `ensureSentryClient()` le rattache au scope courant.
> **Preuves** : **786 fichiers / 8 213 tests ✅** (dont `perf-span-runtime`, transport mémoire réel) · `tsc` 0 · ESLint **0 erreur** · aucune migration.
> **Reste** : redéployer la bêta avec **#1480** puis lire les p95 par span (`GET /dashboard/[guildId]`) ; **P1-2** images (calendrier 913 Ko, logo 170 Ko) ; **P1-3** cache public ; **P2** statique/PPR ; **P3** CDN/WAF + DPA.
> **Rotation** : bloc « suite 40 » (runbook VPS) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 20/11/2026 (suite 45) — **Perf web · mesure de charge et P0 (compression, cache config, dashboard)** — branche `perf/p0-web-2026-11-20` (PR #1476)

> **Demande user (verbatim)** : « enchaine en autonomie , documente d'abord puis enchaine , fais des test de charge etc au fur et à mesure , n'(oublies rien ».
> **Mesure (bêta `8d7528ff`, autocannon v9, 10 s/palier, gzip)** : guide **2,5 req/s** (10 et 25), **2,1** (50), **1,6** (100) — p97,5 **9,9–10 s** ; accueil **19,6 req/s** ; CSS statique **34,5** (cache froid) ; 0 `5xx`, 0 timeout ; bêta `healthy` après. Sentry 7 j : `quetes-dofus` p95 **2 029 ms**, `profile` **1 531**, `services` **1 029**, accueil **836**.
> **Après P0 (bêta `02070473`)** : guide **3,1–3,3 req/s** (+25–30 %), accueil **21,9** (+12 %), CSS **69** (×2) ; zstd **145 Ko** / gzip **151 Ko** (Node gzip avant : 143 Ko — gain CPU, pas réseau) ; `br` seul non compressé ; 0 erreur.
> **Diagnostic** : tout le public est dynamique (nonce CSP `proxy.ts`, `auth`/`headers`/locale/`platformConfig` dans le layout, `auth`/`getUserContext`/`getServerI18n`/`JsonLd` dans la page) ; Node gzippe 1,13 Mo par requête ; dashboard = 5 appels + config lue deux fois + spinner + PNG 913 Ko.
> **Fait (P0)** : Caddy `encode zstd gzip` + Next `compress: false` ; `getPlatformConfig` et `getUserGuilds` en `cache()` **par requête** (pas de TTL → maintenance immédiate) ; `donationsEnabled` mort retiré ; squelette de chargement ; `docs/plans/PERF-WEB.md` (mesures, diagnostic, lots P0→P3, protocole autocannon) + ROADMAP/README.
> **Preuves** : **783 fichiers / 8 201 tests ✅** · `tsc` 0 · ESLint **0 erreur** · verrou `caddy-compression` **2/2** · Caddy validé par le verrou (l'image stock n'a pas le plugin `rate_limit` du VPS). Aucune migration.
> **Reste** : **P1** cache public + images ; **P2** statique/PPR (proxy + layout + page + thème/JSON-LD + session) ; **P3** CDN/WAF + DPA. Bêta `02070473` déployée et mesurée.
> **Rotation** : bloc « suite 39 » (enrichissement 3b) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


















