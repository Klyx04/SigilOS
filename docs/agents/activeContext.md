# Active Context — SigilOS

> 📌 **Rotation (depuis le 20/09/2026)** : cette page ne garde que les **6 dernières sessions**.
> Les blocs plus anciens (26 au 20/09/2026) étaient archivés hors dépôt — ces archives ont été
> **supprimées le 20/09/2026** (`docs/arbo/ARCHIVES-TEMP-2026-09.md`) ; ils restent **intégralement**
> consultables via `git log -p -- docs/agents/activeContext.md` (l'historique git n'est pas concerné).
> En fin de session : ajouter le nouveau bloc EN HAUT, et **sortir le 7ᵉ** (récupérable via `git log`).

## 📝 Session 20/11/2026 (suite 46) — **Perf web · P1-1, spans serveur du dashboard** — branche `perf/p1-1-spans-2026-11-20` (PR #1479)

> **Demande user (verbatim)** : « reprenons : […] Si tu valides ce périmètre, je démarre par 1.1 immédiatement ; sinon dis-moi ce que tu veux prioriser ».
> **Mesure avant code (Sentry 7 j, doc §0)** : `/dashboard/:guildId` = **1 980 transactions** (≈ 280/j), p95 **836 ms** ; prélèvement serveur **5 %**. `@prisma/instrumentation` **absent** du projet ⇒ Prisma n'est **pas** tracé automatiquement.
> **Correction de diagnostic** : `getGuildHeaderData` (cache mémoire **60 s**) et `getGuildModules` (**30 s**) sont **déjà** cachés ; `getUserGuilds`/`getPlatformConfig` ont `cache()` depuis P0. Le « cache dashboard » restant à trancher est donc `getUserContext` (déjà Redis 60 s) et la requête `getUserGuilds` — la mesure décide.
> **Fait (P1-1)** : helper `withSpan` (`src/lib/perf-span.ts` : serveur, no-op si Sentry off, rejet jamais avalé) ; **6 spans** sur le layout (`getUserContext`, `getGuildHeaderData`, `getUserGuilds`, `getGuildModules`, `getPlatformConfig`, `getUpcomingGuildEvents` **streamée**) ; sous-spans `userContext.redis.get`, `userContext.guildConfig.read`, `userContext.discord.fetch`, `userGuilds.query`, `guildHeader.*`, `guildModules.guildConfig.read`, `platformConfig.read` ; **aucun `guildId`** dans un nom de span (verrou `tests/unit/perf-span.test.ts`, 6 cas).
> **Preuves** : **784 fichiers / 8 207 tests ✅** · `tsc` 0 · ESLint **0 erreur** · aucune migration.
> **Reste** : déployer la bêta puis lire les p95 par span (`GET /dashboard/[guildId]`) ; **P1-2** images (calendrier 913 Ko, logo 170 Ko) ; **P1-3** cache public ; **P2** statique/PPR ; **P3** CDN/WAF + DPA.
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

## 📝 Session 20/11/2026 (suite 42) — **Rush · UI (icônes, blocs, fiche Dofus), temps réel et verrou du bloc** — branche `fix/rush-live-progress-2026-11-20` (PR #1473)

> **Demandes user (verbatim)** : « les blocs soient dépliés », « les dj doublés avec une icône placeholder », « laisse afficher le zaap », « la vraie icône succès », « ali 17 brak 3 quêtes au choix », « 173 dj public / 143 interne », « valider par bloc aussi, sans erreur ».
> **Livré (mergé)** : **#1471** (5 positions : La fonte des glaces `[-60,-57]` zaap `-78,-41`, Lavomatique, C'est frais…, Une âme en peine, Temple Sadida ; icône succès `icone-succes.png` ; donjons « (niv. 50) » dédoublonnés par `mergeRushChapterDungeons`) · **#1472** (icône de quête réelle `questTypeIconPath("secondaire")` — **0/536** séquences du seed n'ont d'icône ; onglet **Quêtes/Avancement** ; Dofus terminé = bordure + pastille ; **blocs dépliés par défaut** public + interne).
> **PR #1473** : temps réel (refresh serveur débouncé **900 ms** après validation locale et sur `step:validated`/`batch`/`milestone:completed`) · **projection ids de séquence → clés d'étape** (`projectRushStepKeys`, `rushStepKeysBySequenceId`) — la base stocke des ids, la modale attendait `GPx-N`, d'où **0/8 avec 4 blocs terminés** · **bloc sans verrou** : `toggleMilestoneProgress` ne consulte plus donjon/prérequis (décision user : 500+ coches sinon), la validation quête par quête garde les deux gardes ; le toast affiche `res.error` au lieu de « Erreur ».
> **Mesures** : base locale **4 blocs terminés / 9 avec étapes** (Wylan) · compteurs donjons **99 / 202 / 175** (173/143 non reproduits) · Ali 17 = prérequis unique « D'égout pillé » (DPLN) · WebSocket local = `npm run ws` (port 3001), **non lancé** par `npm run dev`.
> **Preuves** : `rush-chapter-dungeons` 6 · `rush-blocks-expanded` 2 · `rush-live-refresh` 3 · `rush-dofus-progress-projection` 4 · `rush-public-parity` 51 · `tsc` 0 · lint 0 erreur · aucune migration.
> **Reste** : merger **#1473** puis **redéployer la bêta** · **173 vs 143** (écran exact à fournir) · **3 succès** à marquer dans God · **6 quêtes sans position** (5 des 11 traitées) · **itérations 5/6**.
> **Rotation** : bloc « suite 36 » (55 conseils) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.


## 📝 Session 20/11/2026 (suite 41) — **Rush · revalidations du contenu (itération 4)** — branche `fix/rush-revalidations-2026-11-20`

> **Demande user (verbatim)** : « avance sur l'itération 4 » — le public voyait l'ancien guide jusqu'à 1 h après une modification God.
> **Mesure** : page publique en **ISR 1 h** (`revalidate = 3600`) ; sur 49 actions qui écrivent, **20 actions de contenu Rush** ne revalidaient pas la page publique (10 n'avaient que God + dashboard, 4 n'avaient rien, 6 avaient un triplet dupliqué) ; les actions de progression (14) n'ont pas à la revalider.
> **Fait** : helper **non exporté** `revalidateRushContent()` (publique + dashboard + God) — un export dans un fichier `"use server"` casserait le build ; les **20 actions de contenu** l'utilisent (import, upsert, delete, reorder, seed, route, UI, settings, move, bulk ×3, split, sync ×2, duplicate ×2) ; doublons retirés ; `publishRushSequence` garde ses pages `/q` ; les actions de progression sont inchangées.
> **Preuves** : `rush-revalidations` **5 tests** ✅ · ciblés Rush **51** ✅ · **777 fichiers / 8 165 tests ✅** · `tsc` 0 · ESLint 0 erreur · aucune migration.
> **Reste** : 11 quêtes sans position (8 directes + 3 sans `questDbIds`) à saisir dans God ; itérations 5/6.
> **Rotation** : bloc « suite 35 » (monstres 2a) sorti (7ᵉ) — récupérable via `git log -p -- docs/agents/activeContext.md`.














