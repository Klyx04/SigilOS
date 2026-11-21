# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 21/11/2026 (suite 48) — **Sécurité #1485/#1486 · B-3 dashboard · `proxy-image` async · doc** — branche `chore/security-guards-infra-2026-11-21` (PR #1486)

> **Demande user (verbatim)** : « tout ça est documenté / vérifier pour enchainer ? » puis « documente maj tout ce qui doit l'être puis choisi 5 chantiers à faire dans cette session ».
> **Mesure (git + code)** : **#1485 mergé** (`a9fee50d`), `dev` local en retard (`7a74ff2e`) ; #1486 ouvert, CI verte, merge sans conflit ; **aucun `PERF-WEB` §6.3 bis** (le fichier s'arrête à §5) ; `getPolls` déjà en `select { id }` (B-1) ; `getUserProfile` = **4 lectures** pour 3 champs ; `proxy-image` 100 % synchrone ; **`game-data:ro` casse des écritures de l'app** (`sync-monster-stats` → `dungeon-monsters.json`, God upload/download, bascules « ignorer »).
> **Fait** : ① #1486 corrigé (montages app-prod/app-beta **RW assumés**, commentaire mesuré) ; ② **B-3 profil allégé** (`getUserProfileSummary` + `DASHBOARD_PROFILE_SUMMARY_SELECT` — 1 lecture pour l'accueil, les autres écrans gardent `getUserProfile`) ; ③ **B-3 TTL stats 60 → 180 s** (`GUILD_STATS_CACHE_TTL_SECONDS`, clé `guild:stats:<guildId>`) ; ④ **`proxy-image` en `fs.promises`** (plus de `*Sync`, branche `.svg` morte retirée) ; ⑤ doc (ROADMAP, PERF-WEB §2/§3.5/§3.6, RUSH-DEV §5, ROUTE §13, `AGENTS.md`).
> **Preuves** : `proxy-image-svg` 4 · `dashboard-profile-summary` 2 · `guild-stats-cache` 2 · `tsc` 0 · ESLint **0 erreur** · aucune migration.
> **Reste** : merger #1486 → **redéployer la bêta** (2 bots, Caddy, 1 upload God, 1 run `sync-monster-stats`) → P2 cadrage → P3 CDN (D8) ; requêtes 600–1 000 ms du dashboard à mesurer par `EXPLAIN ANALYZE` (à chaud) ; itérations 5/6 (définition absente) ; 3 tags `succes` + 6 positions (God).
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


## 📝 Session 20/11/2026 (suite 44) — **Rush · parité UI public/interne et % Dofus au grain de la quête** — branche `fix/rush-ui-parity-2026-11-20` (PR #1475)

> **Demandes user (verbatim)** : « pk il y a une barre horizontale […] sur le public et pas l'interne » · « afficher et aligner les positions à droite […] guide interne comme le public » · « guide public rentre l'icône succès dans le bloc des favicon comme l'interne » · « le % affiché par dofus ne grimpe pas […] quand on coche des quêtes » · « quête bloquée […] faire comme l'interne pour le public » · « même chose pour les dj côté public c'est moche, fais la même chose que l'interne ».
> **Mesure (rendu local Playwright)** : succès public parent = groupe `border` des favicons ; quête verrouillée publique = **0 position, 0 donjon, 1 lien titre** (favicons disparus) ; panneau avec **1 quête Pourpre injectée → Pourpre 1/11** (le % est au grain de la quête).
> **Fait** : position interne déplacée dans le wrapper droit devant le groupe segmenté ; `SuccessChip compact` public déplacé dans ce groupe ; **verrou donjon = ligne normale** (pastille `Donjon ×N` dans la barre, plus de gros bloc rouge), **verrou prérequis = carte épurée** ; barre des notes retirée sur le verrou prérequis et ligne « Position de lancement » retirée des tips ; `dofusQuestStats` (quêtes, hors succès/INFO) remplace `dofusMilestoneStats` pour la vue « Moi » (libellés « quêtes validées »).
> **Preuves** : `rush-dofus-progress` **11** · `rush-public-parity` **51** · `da-wakfu` **66** · **121 fichiers / 1 490 tests Rush ✅** · **782 fichiers / 8 199 tests ✅** · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Reste** : contrôles visuels 390/768/1024/1440 (les 6 points) · appliquer Positions/Succès dans God · redéployer la bêta · itérations 5/6.
> **Rotation** : bloc « suite 38 » (synchro positions 3a) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

## 📝 Session 20/11/2026 (suite 43) — **Rush · positions Incarnam, 3 succès hors trame, 173 vs 143 expliqué** — branche `fix/rush-reste-2026-11-20`

> **Demande user (verbatim)** : « reprenons sur tous les chantier restant de près ou de loin sur le rush sylvestre, exhaustivement » + `src/temp/debug.md` (les 11 positions et les 3 succès).
> **Mesure (base locale, lecture seule)** : 536 séquences · 3 sans `questDbIds` (succès hors trame) · 9 sans `pos_tags`, dont 622/623/1528 **déjà dans la carte** mais jamais synchronisés · `DofusQuestEntry` 1629/1630 = `coords [-3,-3] monde 2` (Incarnam), 1938 = `[0,0]` (20 temples selon la classe) · **173 vs 143** : la tuile compte des **exigences** (groupe au choix = 1), pas des donjons distincts ; public sans alignement **175**, route Bontarien+Ordre **145** → l'écart **30** est le filtre `resolveRushRoute`, pas un bug (modale locale : 99 donjons / 202 occurrences / 175 exigences).
> **Fait** : `positionFromDofusQuestEntry` (repli `coords`, refuse `0,0`) + siphon `--only 1629,1630 --apply` → **529 positions** ; `planRushPositionSync` écarte les **succès** (`successes`, aucune alerte) et explique **1938** (temple de classe) → plan **533 quêtes / 532 avec position / 1 sans / 6 mises à jour** ; `rush-success-placeholders` (Démons **5165**, Quêtes de Silvosse → **L'arbre qui cache la forêt 7760**, En attendant le printemps **7761**) branché dans les **4** créations de succès du seed ; modale God : « N succès hors trame écarté(s) » ; **case 🏆 Succès officiel** dans le studio pour les 3 lignes existantes.
> **Preuves** : `rush-position-sync` **20** · `rush-success-placeholders` **6** · `rush-trame-seed` **43** · `rush-quest-positions` **5** · **121 fichiers / 1 487 tests Rush ✅** · **782 fichiers / 8 196 tests ✅** · `tsc` 0 · ESLint **0 erreur** · aucune migration.
> **Reste** : appliquer **Positions** dans God (6 mises à jour → 1 seule quête sans position, 1938) ; poser les **3 tags `succes`** dans God (les 3 lignes existantes ne sont pas réécrites par l'import additif) ; **redéployer la bêta** (repo **f2e9c07f**, dev **96ddd29f**) ; itérations 5/6.
> **Rotation** : bloc « suite 37 » (positions 2c) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.

















