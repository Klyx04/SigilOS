# 🗺️ ROADMAP — SigilOS (backlog priorisé + workflow de session)

> **Ce fichier est LA référence en mode plan.** Le backlog priorisé y est condensé.
> À chaque session, lire **uniquement** : `docs/ROADMAP.md` + `src/temp/chantier-actif.md`
> (+ `PROMPT_START.md` pour les exigences de type).
> **Historique long** (`CONTEXT.md` intégral, `src/temp/chantier.md`, `archive/`) : **À LA DEMANDE UNIQUEMENT**.
> Réouvrir l'historique en mode plan = gaspillage de tokens.

---

## 🧭 Règle mode plan (économie de tokens)

1. Lire `docs/ROADMAP.md` + `src/temp/chantier-actif.md`.
2. Ouvrir `PROMPT_START.md` pour le bloc exigences (type : dev / sécu / infra / SEO / données).
3. Ouvrir un fichier de référence (`RULES.md`, `SECURITY.md`, `MAINTENANCE.md`, `docs/SEO_REPRISE.md`)
   **uniquement si la tâche le touche**.
4. NE JAMAIS ouvrir en plan mode : `src/temp/chantier.md`, `CONTEXT-historique-*.md`,
   `src/temp/archive/`, `docs/audits/`. (Historique → consultation ponctuelle.)

---

## 🔴 Bloquant / Prod

- **#57 — Ouverture prod & PRA** : Guide maître Jour J `docs/GUIDE-DEPLOIEMENT-PROD-JOUR-J.md`
  (+ `src/temp/checklist-ouverture-prod-57.md` & `docs/DECISION-OUVERTURE-LANDING.md`).
  Actions VPS : 2 applications Discord isolées (Prod vs Beta), hardlinks des assets (`game-data` + `uploads`),
  restauration DB automatique (`./scripts/restore_db.sh prod --download-latest`), retrait du rewrite Caddy `maintenance.html`
  sur `sigilos.fr`, noindexer la beta, resoumettre le sitemap, vérifier `/legal/*`. **+ trancher la décision landing immersive** (`page.tsx`).

- ✅ **Session 10/09/2026 — Module « Marché » · B1 = S1 (fondations)** (branche `feat/marche-b1` → PR `dev` ; mémo `src/temp/memo-2026-09-10-marche.md` ; plan `src/temp/refonte-marche/PLAN-MAITRE-MODULE-MARCHE.md` §0.1.bis bloc B) :
  - **Schéma** : 9 modèles (`MarketListing`, `MarketListingStat`, `MarketListingComponent`, `MarketOffer`, `MarketReservation`, `MarketListingMedia`, `MarketDiscordMessage`, `MarketReport`, `MarketAuditLog`) + 9 enums + `GuildModules.marche` (OFF par défaut) + 16 colonnes `GuildConfig.market*` · migration **idempotente** `20261110000000_add_market_module`.
  - **Module activable** : `module-types` / `module-actions` (Zod + verrou God) / **2 permissions** `market:trade` + `market:moderate` (matrice RBAC) / `canViewMarket` + `canManageMarket` (`applyModule`) / sidebar « Marché » / carte Pilotage / onglet **Réglages → Marché**.
  - **Écrans** : `/marche` (catalogue cartes + tableau + filtres), `/marche/nouveau` (assistant 3 étapes), `/marche/[listingId]` (fiche + jet étiqueté + actions vendeur), `/marche/mes-espaces` (en cours / terminées).
  - **Actions** : catalogue, CRUD, publication (`expiresAt = +20 j`), retrait, renouvellement (1 fois), soft-delete, **journal d'audit** ; réglages + **« Tester la configuration »**.
  - **Docs & tour** : fiches `/docs/marche` + « Configurer le Marché », 2 permissions documentées, `docs-mapping`, `seed:docs`+`build:seeds` · tour `marche` (6 étapes) + les 2 boutons (`📖 Documentation` / `❓ Tutoriel`).
  - Vérifs : **`prisma validate`** ✅ · **`migrate diff` 0 écart** ✅ · **`tsc` 0 erreur** ✅ · **`build` OK** · tests Marché **27/27** ✅ · **suite complète 682/682** ✅ (2 tests « préexistants » réparés : fixtures `data-health` / `siphon-stats` figées au 09/09 → rendues relatives à l'horloge, commit `5136214ba`).
  - ⚠️ `prisma migrate dev` **impossible en local** (dérive préexistante `20260819000000_add_inter_guild` absente du repo → reset destructif refusé) ⇒ migration écrite à la main + `prisma db execute`.
  - ✅ **PR #627 MERGÉE** dans `dev` (merge `62e53aae4`, 21:50Z) — CI **Verify & Build** ✅ + CD **Build & Push Images** ✅ · branche mergée supprimée.
  - 🔧 **2 bugs d'infra corrigés avant merge** : (1) **fixtures de tests figées** (`data-health`, `siphon-stats`) = bombes à retardement → `const NOW = Date.now()` (`5136214ba`) ; (2) **plafond mémoire Node ≈ 2 Go** → OOM sur `tsc --noEmit` **et** `next build` ⇒ `NODE_OPTIONS=--max-old-space-size=4096` dans `.github/workflows/verify.yml` **et** `Dockerfile` (`66ffdd724`).
  - ⚪ RESTE : DoD visuelle dark/light/mobile (vérif user) · assistant **5 étapes** (S1.42 → B2) · ➡️ **B2 = S2 + S3** (branche depuis `dev`).

- ✅ **Session 11/09/2026 — Module « Marché » · B2 = S2 + S3 (catalogue enrichi, éditeur FM, carte d'item, publication Discord)** (branche `feat/marche-b2` → PR `dev` ; plan `src/temp/refonte-marche/PLAN-MAITRE-MODULE-MARCHE.md` §21 S2/S3) :
  - **Données (S2)** : siphon des référentiels DofusDB `/effects` (872) + `/characteristics` (123) → `GameEffect` / `GameCharacteristic` (`siphonMarketReferentials`) · lecture **data-driven** (`src/lib/market/referential.ts`) avec repli codé (`effects.ts`) · catalogue local-first `src/lib/market/item-catalog.ts` + `getGameItemCatalogFacets` (DISTINCT familles/types) · route `GET /api/market/items/search` (session + `market:trade` + module + rate-limit) · siphon à la demande `siphonGameItemByAnkamaId`.
  - **Éditeur de jet (S2)** : plages natives **recalculées serveur** depuis `GameItem.nativeEffects` (jamais le client) + libellés référentiels · exos PA/PM/PO/invocation en 1 clic + ligne libre · bouton « ✦ Jet parfait » · état en direct · assistant porté de **3 → 4 étapes** (`Nature → Objet & jet → Prix → Publication`).
  - **Carte d'item (S2)** : `src/components/market/market-item-card.tsx` (anatomie §12.3) + `stat-icon.tsx` (mapping lucide partagé) · « Modifié par » + **prix moyen guilde** (`getMarketPriceStats`) · PNG `/api/og/market/[id]` (cache `statsHash`) · icônes `sagesse.png` / `invocation.png` ajoutées · `ItemSearchPanel` consomme désormais `effects.ts` (doublons supprimés).
  - **Publication Discord (S3)** : payload **pur** `src/lib/market/discord-payload.ts` (par état, compteur d'offres seul, boutons désactivés hors ACTIVE) · service `src/server/market/discord.ts` (`publishListingToDiscord` / `syncListingMessage` / `regenerateMarketImage`, **jamais bloquant**, `syncStatus=FAILED`+`lastError`, salon non configuré = pas d'erreur, mode texte **ou** forum) · réécriture d'embed à chaque transition · étape 4 avec aperçu fidèle (`DiscordEmbedPreview`) + rôles à ping **revalidés serveur** · `resyncMarketListing` / `regenerateMarketImage` (modo).
  - **Tests** : `market-effects.test.ts` (13) + `market-discord-payload.test.ts` (9) + cas limites `market-stat-quality.test.ts` (16) → **suite complète 709/709** ✅ · `tsc` 0 erreur · `build` exit 0 · `lint` 0 erreur (warnings préexistants).
  - Docs `marche` / `admin-marche` revues + `seed:docs` (30 MAJ) + `build:seeds` · tour `marche` enrichi (8 étapes : + `marche-jet`, `marche-publish`).


- 🔸 **Session 08/09/2026 — Module « Titans »** (branche `feat/slash-rework`, non commité ; mémo `src/temp/memo-2026-09-08-titans.md`) :
  - **Fonctionnalité de bout en bout** : modèle `Titan` + `UserTitanProgress` + `DjSearchMode.TITAN` + champs DJ (`titanId/titanName/questName/questUrl`) — migrations `20261101000000_add_titan` + `20261102000000_add_titan_quests` appliquées. Admin GOD `TitanManager`, server actions `titan-admin-actions`/`titan-actions`, seed Gargandyas (id 8062, zone Osavora).
  - **Dashboard DJ** : mode `TITAN` (création/filtre/embed/close/titres) + `maxMembers` plafonné au titan.
  - **Succès** : `SuccesTitanTab` (fiche boss-like) · **Cron** `sync-monster-stats` étendu aux Titans · **Overlay Bestiaire** : filtre « 👑 Titans ».
  - **Charte « fiche boss »** : icônes vitality/résistances + sorts Dofensive (dans `SuccesTitanTab`).
  - **Correctifs** : overlay zoom (en-tête + légende restent visibles), boss épinglé + agrandi (`SpellRangeGrid`), correctifs TS (`LocalImagePicker`, `DOFUS_JOBS`).
  - **Parité fiche boss** : onglets **Simulation + Monstres de salle** dans `SuccesTitanTab` · **Résolution Gargandyas** validée (8062, homonyme 8069) · **barre de vues** en assets Dofus + « Fiche Titans » à côté de « Fiches Boss ».
  - **DJ Titan création** : **taille FIXE = titan.maxMembers** · **date/heure calquée sur `scheduleConfig`** (jours + fenêtre horaire) · **cron** relances/nettoyage couvre TITAN · **file d'attente** déjà en place.
  - **UI /boss** : bouton « Overlay en jeu » retiré des cartes · overlay **fix flèche retour** (deep-linked une seule fois + clear search).
  - Vérifs : **tsc 0** (hors `SpellRangeGrid` cassé) · **eslint 0 erreur**.
  - ⚪ RESTE : **`SpellRangeGrid.tsx` JSX cassé à réparer** (préexistant) · branche/PR `feat/slash-rework`.


- ✅ **Session 01/09/2026 (suite) — Rush Sylvestre : correctifs, S6, S7, S5** (`dev` HEAD `4c6a395b`) :
  - **Correctifs dashboard (reliquats 3/7/9)** (#572) : recherche + `hideDone` (un bloc entièrement terminé contenant un résultat reste visible via `effHideDone`) · cible de validation ≥36×36 desktop / 44×44 mobile · `data-tour` limité au premier contrôle visible (`isFirstVisible`).
  - **S6 moments premium** (#572) : `MilestoneCelebrationBurst` — burst doré + label « Bloc validé ✦ » à la validation d'un bloc (cohérent `RushCurrentObjective`).
  - **S7 contexte chapitre** (#574) : `RushChapterSidebar` enrichi — « 🏰 Donjons à prévoir » + « 🔨 Métiers requis » du chapitre (dérivés des séquences, zéro fetch).
  - **S5 éditeur GOD** (#575, **🔸 open**) : import d'image pour l'icône de séquence (URL validée `isSafeImageUrl` + upload sécurisé `/api/upload`) + helper partagé `resolveRushSeqIcon` (clé preset → `/assets/icons/…`, sinon URL) ; CodeQL `js/xss-through-dom` corrigé via `safeImageUrl`.
  - **Fix PWA icônes après nav SPA** (#573) : `public/sw.js` network-first + fallback cache/placehodler (plus de `respondWith(undefined)` → `net::ERR_FAILED`).
  Vérifs : **vitest 465/465 (53 fichiers)** · **tsc 0** · **eslint 0 erreur** · **build OK**.

- ✅ **Session 02/09/2026 — Overlay Rush Sylvestre très mature + correctifs dashboard** (branche `fix/cron-maintenance-scripts` → PR `dev`) :
  - **Overlay** (`GuideOverlayClient` + `components/RushOverlay*`) : recherche globale accent-insensible (tout le guide), arbre de chapitres `<select>` + progression N/M, modale **Ressources** globale (bascule **Restantes/Toutes**, décrément en direct `aggregateRushResources(milestones, completedSeqIds)`), modale **Membres** qui est là, modale tutoriel, mode compact, header **7 boutons** (thème/ressources/masquer faites/tutoriel/dashboard/**bug**/**reset**) + puce **personnage** (pseudo+classe Main/Mule), validation « chapitre » fiable (synchro `completedStepsByMs` + rollback), blocs non cochables (`SEPARATEUR`/`INFO`/`DOFUS_OBTAINED`), `goToNextMs` saute les blocs faits, exclusivité validé/repère, bouton **bug** pré-remplit le contexte d'étape (`context`).
  - **Fix bug repère « disparaît après 2 s »** : le dashboard (`RushTimelineClient`) ne relisait que `currentStep` préfixé `seq:` dans son effet `[milestones]` → il republiait un snapshot vide sur `BroadcastChannel` → l'overlay écrasait son repère. Normalisation brut/`seq:` + validation par séquences (init + resync) + `handleBookmark` préserve les autres blocs.
  - **Reste dashboard** (voir `activeContext.md` NEXT) : modale Ressources globale + bascule Restantes/Toutes · contexte d'étape dans « Signaler » · puce personnage Main/Mule · suppression `RushOverlayQuestPanel.tsx` orphelin · ressources `kind:"unresolved"` (données).
  - Vérifs : **tsc 0** · **eslint 0 erreur** (fichiers touchés).

- ✅ **Session 04/09/2026 — Rush Sylvestre : Pense-bête + modale de lancement + config GOD** (branche `feat/chantier-2026-09-03-rush-ui-pense-bete` → **PR #588**) :
  - **Retrait bouton + modale « Ressources » du dashboard** (conservés dans l'overlay).
  - **Pense-bête** : bouton + modale **lecture seule** (préparatifs du rush, une seule croix de fermeture).
  - **Modale de lancement (4 étapes)** : personnage → préparation (Metamob détecté + bouton « Lier », reset alignement optionnel, métiers requis déclarés ✓ / non déclarés → « Déclarer ») → membres → prêt. Reset (« Réinitialiser ce personnage ») ré-ouvre la modale + **reset d'un autre perso (main/mules)**.
  - **Config UI/UX GOD** : `OptimizedGuide.rushUIConfig` (JsonB) + migration `20261013000000_add_rush_ui_config` + action `updateRushUIConfig` (audit `GOD_RUSH_UI_UPDATE`). Onglet GOD « **Lancement** » : aperçu + éditeur pense-bête (CRUD sections/items, métiers **alternative**, **réordonnancement ↑/↓**) + toggles modale. Fallback statique si vide.
  - **UI polish** : badges activité « pack +N » (dashboard via `classifyTags`), **célébration changement de chapitre** (jade), **checkboxes 3 états** (à faire / en cours doré / terminée jade).
  - **Bloc alignement** → lien vers `/dashboard/[guildId]/profile`. **Modale Ocre +/−** re-render + patch Metamob. **Fix** crash `AlignmentSection` (profil).
  - **Prisma** : migrations locales bloquantes résolues (`20261009`-`20261013`) → `Database schema is up to date!`.
  - Vérifs : **tsc 0** · **eslint 0 erreur** · **vitest 484/484** · **build OK**.


- ✅ **Session 01/09/2026 — Recrutement & Cycle de Vie (#RH), Refonte Documentation & Unification Boutons d'Aide** :
  - **Module Recrutement & Cycle de Vie (`/admin/recruitment`)** : Gestion des périodes d'essai J-X, annuaire des mules et personnages secondaires, historique des départs & exclusions, relances et alertes Discord automatiques. Modèle `MemberLifecycle`, actions serveur sécurisées et interface pro `MemberLifecycleManager.tsx`.
  - **Documentation Exhaustive & Sécurisation God** : 28 fiches rédigées sans slop dans `prisma/seed-docs.ts` couvrant les 35 modules. Suppression stricte de tout bouton d'édition côté lecteur, gestion documentaire réservée à `/god/docs`.
  - **Unification Globale des Boutons [Documentation] + [Tutoriel]** : Standardisation du binôme de boutons `ModuleHelpActions` (ouverture du tiroir latéral contextuel + tutoriel interactif) sur 100% des 35+ modules et sous-modules du Dashboard (Membres et Staff).
  Vérifs : **vitest 458/458 (52 fichiers)** · **tsc 0** · **build OK**.

- ✅ **Lot 3 : Performance & Optimistic UI (#186a) + PWA & Offline (#197) (31/08)** :
  - **#186a — Optimistic UI (Zero-Latency) & Virtualisation** : Hook `useOptimisticSet` (`use-optimistic-toggle.ts`) pour retours visuels 0ms et rollback automatique. Composant `VirtualList.tsx` pour scroll fluide 60-120 FPS.
  - **#197 — PWA (Progressive Web App) & Cache Offline** : Manifest enrichi (`src/app/manifest.ts`) avec raccourcis Quêtes/Almanax/Défis, icônes adaptatives maskable, Service Worker (`public/sw.js`) pour cache statique/offline et bannière d'installation 1-clic `PwaInstallBanner`.
  Vérifs : **vitest 448/448** · **tsc 0** · **build OK**.

- ✅ **Lot 2 : Double Boss (#198.1), Badges & Rules Engine (#198.2) + Reaction Roles V2 Pro (#222) (31/08)** :
  - **#198.1 — Double Boss & Défi Module + Icônes Dofus Quêtes** : Vignettes authentiques des Dofus dans les cartes de quêtes (`SuccesQuestsTab.tsx`), annuaire d'entraide guilde temps réel et support multi-boss 2 à 5 boss (`SuccesDefiTab.tsx` / `defi-actions.ts`).
  - **#198.2 — Système de Badges, No-Code Rules Engine & Ko-fi** : Modèles `Badge` et `UserBadge`, studio GOD `/god/badges` avec Live Card Preview, upload drag-and-drop / presets, moteur de règles de déblocage automatique 100% No-Code (`badge-triggers.ts` pour Quêtes Dofus, Défis, Missions) et route Webhook Ko-fi (`/api/webhooks/kofi`).
  - **#222 — Reaction Roles V2 Pro (DraftBot & Dyno Inspiration)** : Multi-rôles par sélection (`extraRoleIds`), rôles temporaires avec durée d'expiration (`durationDays`), enregistrement `TimedRoleGrant`, tâche de révocation automatique Discord (`processExpiredTimedRolesAction`), et éditeur pro dans `ReactionRolesManager.tsx`.
  Vérifs : **vitest 445/445** · **tsc 0** · **build OK**.

- ✅ **Lot 1 : Quick Wins & Robustesse Immédiate (31/08)** :
  - **#199 — Tour Tuto Succès (Filtres & Défi)** : Reciblage de l'étape « Recherche et filtres » sur `[data-tour="succes-filters"]` et ajout de l'étape dédiée à l'onglet **Défi** (`[data-tour="succes-view-defi"]`) dans `tour-provider.tsx`.
  - **#230 — Succession Automatique & Sécurisation Transfert** : Algorithme fail-safe de succession (`handleGuildOwnerSuccession`) si l'owner supprime son compte/quitte Discord (Owner Discord -> Officier `system:rbac` -> Ancien membre + audit log + alerte staff) + modale de confirmation manuelle par saisie du nom de guilde (`transferGuildOwnershipAction`). 6 tests unitaires passés (`guild-owner-succession.test.ts`).
  - **#174 — Rappels Automatiques Discord Sorties Inactives** : Relances automatiques Discord + Notifications Dashboard pour les sorties Donjons/Quêtes/Songes inactives depuis > 72h avec clôture progressive (`inactive-posts-actions.ts`).
  Vérifs : **vitest 438/438** · **tsc 0** · **build OK**.

- ✅ **Harmonisation Dark/Light Mode & Tokens Sémantiques (31/08)** :
  - **Switch Thème Public & God** : Intégration du `ThemeToggle` sur le `PublicHeader` (desktop + drawer mobile) et `GodTopNav`.
  - **Suppression des classes en dur** : Nettoyage de `text-white` et `bg-zinc-900` au profit des tokens sémantiques `text-foreground`, `bg-surface`, `bg-background`, `border-border` dans `GeoguesserHUD.tsx`, `SpellRangeGrid.tsx`, `ZoneManager.tsx`.
  - **Nettoyage CSS Global** : Correction de `.ganymade-step-text strong, b` dans `globals.css` vers `text-foreground` pour la lisibilité universelle dark/light.
  Vérifs : **vitest 432/432** · **tsc 0** · **build OK**.

- ✅ **Songes, Sidebar, Dolmanax, Grille Guilde & Rapport Staff #147 (31/08)** :
  - **Clôture Songes & Embed Discord** : Déplacement de `deleteDiscordRunEmbed` avant `db.dreamRun.delete` dans `dream-run-actions.ts` (support Forum `type === 15` et Textuel `type === 0`).
  - **Ordre Sidebar Dashboard** : `Donjons & Quêtes` en 1re position, `Songes` en 2e dans `NAV_TOOLS`.
  - **Custom Module Icons GOD** : Onglet `/god?tab=module-icons` pour upload & compression WebP 128x128 max (`image-downloader.ts`).
  - **Refonte Dolmanax (Anti-Slop / DPLN)** : Offrande du jour, bouton `+1 Page du Jour` net & lisible en dark/light mode, contrôles manuels et calendrier prévisionnel 7 jours.
  - **Refonte Vue Guilde (Quêtes Dofus)** : Grille de cartes compacte 3 colonnes + Drawer d'entraide (membres en cours avec étape `🚩`, membres l'ayant obtenu, accès direct au guide).
  - **Indexation Dofus & Quêtes dans Cmd+K** : Intégration de tous les Dofus (`db.dofusItem`) et étapes de quêtes (`db.dofusQuestEntry`) dans la recherche globale.
  - **Chantier #147 — Rapport Quotidien Staff (« Data or Nothing »)** : `sendDailySummaryReport` n'envoie de message que si au moins un événement critique existe sur 24h (Arrivées, Départs/Archivages, Absences, Tickets ouverts, Preuves à valider). Si 0 événement → 0 message Discord.
  - **Kralamoure Widget** : Confinement et adaptation du composant pour éviter tout débordement dans la sidebar 300px de `/quete-ocre`.
  Vérifs : **vitest 432/432** · **tsc 0** · **build OK**.

- ✅ **Correctif 429 & Autonomie Complète Items/Ressources #38 (31/08)** :
  - **Débridage Rate-Limit `/api/assets-dofus`** : Sortie de `/api/assets-dofus` du rate-limiter strict 60 req/min (comme `/api/storage`) dans `src/proxy.ts`.
  - **Rate-limit adaptatif `/api/dofusdb`** : Élévation à 120 req/min pour absorber la frappe interactive.
  - **Cache Mémoire Serveur** : Cache in-process LRU/TTL 5 min sur la recherche multi-catégories Dofusdude/DofusDB et TTL 10 min sur les fiches items et recettes (`/api/dofusdb/items/[id]`, `/api/dofusdb/recipes/[id]`).
  - **Chantier #38 Siphon & Autonomie Local-First** : Nouveau modèle Prisma `GameItem` indexé + migration `20261009000000_add_game_item_catalog` + action serveur `siphonGameItemsBatch` (lots de 50, hash MD5 différentiel, auto-siphon WebP non-bloquant).
  - **Studio GOD & Bascule Modules** : Sous-onglet GOD « 📦 Items & Ressources » (`GameItemSiphonPanel`) + bascule local-first prioritaire pour l'Encyclopédie, les Services et le Coffre/Prêts.
  Vérifs : **vitest 429/429** · **tsc 0** · **build OK**.

- ✅ **Synchro Dokille, Outbox Discord, Tour Onboarding & Logs Audit Discord (31/08)** :
  - **Synchro bidirectionnelle Dokille / Dolmanax** : Validation/invalidation globale synchronisée avec les 20 krokilles et quêtes.
  - **Réagencement Prérequis Dokille** : Vulkania placé avant le Safari des Krokilles.
  - **Contraste "Obtenu" Dofus** : Ratio YIQ dynamique pour dark/light mode.
  - **Outbox Discord** : Correction du faux échec d'envoi (`outbox:${jobId}`).
  - **Tour Onboarding** : Ciblage direct du composant Disponibilités (`[data-tour="profile-planning"]`) & conditionnement de « Présence & Feed » au mode vitrine.
  - **Services Discord** : Affichage du surnom sur le serveur Discord (`discordNickname` / `pseudoDofus`) dans les réponses et notifications.
  - **Admin Logs & Bot Gateway** : Résolution des surnoms serveur pour les cibles de logs et affichage du détail exact (`changeDetail` : rôles, surnom, arrivées, départs).
  Vérifs : **vitest 429/429** · **tsc 0** · **build OK**.

- ✅ **Refonte Complète Module Rush Sylvestre (28/08)** (`feat/dofusbook-spells-guide-refonte`, PR → dev) :
  - **Types partagés & Helpers purs** (`rush-guide-types.ts`, `rush-guide-utils.ts` avec 13 tests unitaires passés) : parsing exact `/travel`, détection déterministe des prérequis `isSequenceBlockedByPrereqs`, recherche de prochaine étape actionable ignorant les `info_sequence`.
  - **Composants UI Partagés** : `RushCoordinateChip` (copie `/travel`), `RushProgress` (barre fluide), `RushCurrentObjective` (objectif doré `✦ À FAIRE MAINTENANT`), `RushTagBadge`, `RushActionMenu`.
  - **Dashboard Membre** (`RushTimelineClient.tsx`) : prérequis déterministes, cibles de clic agrandies, modal de reprise connectée au repère exact (`effectiveBookmarkSeqId`) et nom de quête.
  - **Overlay In-Game Redesign** (`GuideOverlayClient.tsx`) : Mode Normal + Mode Compact focalisé sur le jeu, gestion intelligente d'`Escape` et raccourci `/`.
  - **Overlay PiP toujours-au-dessus** (`use-guide-pip.ts`, modèle Ganymède) : clic direct `documentPictureInPicture.requestWindow()` + `createPortal(<GuideOverlayClient/>, pipWindow.document.body)` (une seule fenêtre, checkboxes synchronisées dashboard↔overlay). Fallback Firefox/Safari : **popup vierge + `createPortal`** (`openFallbackPopup`) — réutilise la session dashboard, plus de rebond `/dashboard/{guildId}`. Vérifs : **tsc 0** · **eslint 0 erreur**.
  - **Studio d'administration GOD** (`RushSylvestreAdminClient.tsx`) : `SequenceEditForm` en 8 sections accordéons progressives, indicateur de statut local non enregistré (`dirty`), et Aperçu Live en temps réel.
  - **S4 « qui peut aider » (31/08)** : marquage GOD « 🔨 Métier requis » + `getSequenceHelpers` (garde guilde + Zod + rate-limit) + badge « X peut aider » (dashboard + overlay, `RushHelperBadge`) + **[Inviter/Partager]** (`inviteHelperForSequence` + `listRushTextChannels`). **Gap A** : `UserProfile.metiers` enrichi `[{id, name, level}]` — `src/lib/metiers.ts` (`normalizeMetiers`, rétro-compat `string[]` → niveau 200), éditeur profil avec niveau, consommateurs durcis, Zod élargi. **tsc 0** · **eslint 0 erreur** · **vitest 465/465** · **build OK**.
  Vérifs : **test:run 389/389** · **tsc 0** · **build OK**.

- ✅ **Game Data — État des lieux & UI (27/08)** (`feat/chantier-2026-08-27-game-data-ui`, branche créée depuis `dev`, PR → dev) :
  **bug « Siphonner les quêtes » corrigé** (DofusDB pagine via `$limit`/`$skip` — avec `limit`/`page` l'API renvoie `total:0` → « 0 quête siphonnée », reproduit) ·
  dé-doublonnage des points d'entrée (`/god/game-data` → `redirect` vers l'onglet canonique `/god?tab=game-data`,
  qui porte déjà stats réelles + GameDataInterface + EventZoneManager) · galerie des modales (succès/boss) enrichie
  (**recherche** + **suppression d'image**, nouveau `DELETE /api/god/list-local-images` fail-closed anti path-traversal) ·
  onglets aérés (rangée unique qui défile, padding/gap élargis) · onglet Quêtes clarifié (« Import initial » vs « Synchronisation »).
  Vérifs : **test:run 340/340** · **tsc 0** · **eslint 0 erreur** · **build OK**. Mémo : `src/temp/memo-2026-08-27-game-data.md`.
  ⚪ RESTE (optionnel) : « Archis & Boss » = onglet (tab) **et** route standalone `/god/game-data/archimonstres` (2 views du même module) ·
  2 galeries d'assets parallèles (`LocalImagePicker` vs `AssetGalleryModal`) à unifier · `EventZoneManager` à ne monter qu'une fois ·
  déploiement = re-build app.
  ➕ **Compléments (27/08 — A/B/C)** : `searchGameQuests` = **local-first + fallback DofusDB** (le picker membre profite désormais du fallback,
  + test `tests/unit/quest-picker-fallback.test.ts`) · bouton « Associer familles (auto) » = matching **normalisé** (casse/accents) + diagnostic
  `archisWithZone` (explique quand 0 association) · onglet Import/Export documenté (couverture = **4 tables** seulement, export Git **dev-only**,
  **complémentaire** au siphon DofusDB — pas obsolète mais partiellement supplanté). Vérifs : test:run **343/343** · tsc 0 · build OK.
  ✅ **COMMIT + PUSH** : `4b58cfe45` sur `feat/chantier-2026-08-27-game-data-ui` (poussée → origin, PR → dev). Ajouts finaux :
  donjon à 0 succès **visible** dans `/succes?dungeon=` (`SuccesTracker`) · même emplacement + **plusieurs boss** (aide de sémantique +
  seed `scripts/seed-harebourg-double-boss.ts` pour les 4 variantes du Comte Harebourg) · fiche boss = **map du boss uniquement**
  (`SpellRangeGrid`, filtre `shownMaps`). RESTE : merger la PR → dev · `sudo ./scripts/deploy-cd.sh beta` (aucun migrate Prisma,
  pas de changement de schéma) · siphonner les quêtes + ajouter les 4 variantes (UI recommandé ou seed tsx). `#57` ouverture prod toujours bloquant.


- 📌 **Galerie de Stuff — classe « Inconnu » + limite 30 + filtres responsive (27/08)** (`feat/chantier-2026-08-27-galerie-stuff-classe`, PR #561 → dev) :
  **🐛 Fini le « INCONNU »** : `processDofusbookRawData` ne produit plus un faux « Inconnu » ni un `classId` par défaut (1) quand Dofusbook ne renvoie pas de `character_class` (builds partagés / réponses partielles) — `classId`→0 + `className`→vide, et la modale `DofusbookPreview` préfère le `classId` (choisi/déduit) dès que `className` est absent ou « Inconnu » (fallback `getClassName(guessedClassId)`). → **classe correcte pour n'importe quelle classe**, ajout multi-classes OK (aucune restriction implicite). · **Limite perso 20→30** (`builds-card.tsx` compteur + seuil, `UpdateDofusBookLinksSchema.max(30)`). · **UI** : contraste dark modale (en-têtes `text-foreground/30`→`/70`, rangées `bg-black/*`→`bg-surface/60`) + popovers filtres Tags avancés / Classe en **largeur responsive** `w-[min(...,calc(100vw-2rem))]` (plus de sortie d'écran).
  Vérifs : **test:run 359/359** · **tsc 0** · **lint 0 erreur** · **build OK** (+ test `tests/unit/dofusbook-utils.test.ts`). Mémo : `src/temp/memo-2026-08-27-galerie-stuff-classe.md`.
- 📌 **Doubles boss & module Défi (27/08, ONE SHOT A+B+C+D)** (`feat/chantier-2026-08-27-double-boss-defi`, depuis `feat/chantier-2026-08-27-game-data-ui`, PR → dev) :
  **A — Correctif doubles boss + dropdown map** : cause racine = `bossName` « Comte + Klime » ne matche pas le monstre Dofensive → `shownMaps` affichait toutes les maps. Fix = dissociation **affichage / résolution** : `name`/`bossName` restent « Comte et X », + 2 champs optionnels `Dungeon.dofensiveMonsterName` (`Klime`…) + `Dungeon.dofensiveDungeonName` (« Donjon du Comte Harebourg ») → `resolveDofensiveDungeonDirect` cible la bonne « Balcon » (et lève l'ambiguïté vs les donjons **solo** homonymes). `SpellRangeGrid` ne retombe plus sur toutes les maps. Script `scripts/fix-double-boss-resolution.ts` (idempotent, préserve les donjons solo) + seed MAJ. · **Robustesse (post-beta)** : helper partagé `src/lib/dofensive-boss.ts` (`deriveDofensiveMonsterName` / `resolveMonsterKey`) dérive le monstre d'un `bossName` « X et Y » (« Comte et Klime » → « Klime ») quand `dofensiveMonsterName` est **vide en base** → `SuccesBossGuide` et `getDofensiveDungeonForBoss` résolvent la bonne « Balcon » même avec des données incomplètes. ·
  **B — Donjon sans succès** : toggle « Donjon sans succès » (`Dungeon.isNoAchievement`) → pseudo-succès « Donjon validé » (challenge `donjon-valide`) relié au donjon → cochable dans « Mes Succès ». ·
  **C — Sources communautaires** : déplacé dans les `actions` du `UnifiedModuleHeader` (`succes/page.tsx`). ·
  **D — Module « Défi »** : modèle dédié `Defi` + `UserDefiProgress` + `DjSearchMode`=DEFI ; onglet « Défi » God (`DefiManager`) et `/succes` (`SuccesDefiTab`) ; 3ᵉ mode DJ (pièce, embed, clôture → `applyDefiValidation`), filtres/cartes/détail/close ; type image `defi` whitelisté.
  Vérifs : **test:run 344/344** · **tsc 0** · **build OK** · eslint 0 erreur. Mémo : `src/temp/memo-2026-08-27-double-boss-defi.md`.
  ⚠️ **Migration** `20261006000000_add_defi_double_boss_resolution` (SQL manuel) — la base locale est en **drift** (`add_inter_guild`), ne pas faire `migrate dev` (reset), utiliser **`prisma migrate deploy`** en CI/prod. Merger **d'abord** la PR game-data-ui → dev (fichiers communs). ⚪ RESTE (non fait) : multi-défis DJ, annuaire « qui a fait / pas fait » par membre (compteur simple).
  ✨ **Modale Défi enrichie** : fenêtre d'événement (`isPermanent`/`startDate`/`endDate` sur `Defi`, migration `20261007000000_add_defi_event_schedule`) — toggle « Dispo en perpétuel » (défaut) ou dates début/fin (`datetime-local` + validation end>=start) ; **slug auto-généré** depuis le nom (`src/lib/defi-slug.ts`, module pur) ; **Zone en combobox** zones siphonnées (`searchZones`) ; **Boss en combobox** monstres Dofensive siphonnés (`searchMonstersForDefi`, plus de texte libre) ; fix **galerie** `game-data/defis` fail-soft (la route `list-local-images` crée le dossier au lieu de lever `ENOENT`).
- **#223 — Résilience Discord long terme** (point dur **16/11/2026**)
  P0 + P1 + P2 + fix CodeQL : ✅ FAIT + MERGÉ (PR #520, `6e5a779a3`).
  **RESTE (P3)** : outbox BullMQ/Redis écritures Discord · révocation session Auth.js sur
  `APPLICATION_DEAUTHORIZED` · rapatrier les fetch directs restants
  (`dungeon-finder-actions`, `service-actions`, `profile-actions`, `god-discord-actions`) ·
  veille mensuelle changelog + jour J.
  📄 Plan maître : `src/temp/refonte-long-terme-discord-compatibilite/PLAN-MAITRE-RESILIENCE-DISCORD-LONG-TERME.md`
  · ⚠️ §12 = VEILLE (à relire à chaque itération Discord).
- **Fiche Boss / Simulation** (06/10, terminé — 283/283) — ✅ **25/08** (`feat/chantier-2026-08-25-succes-fiche-boss-map-dofensive`, PR #548) : resolution donjon multi-boss par **token-overlap** (gère « Temple de l'Eliocalypse » ↔ « Tempête de l'Eliocalypse » chez Dofensive, générique pour futurs DJ) → la vraie map Dofensive (Déluge 204476422) se charge ; passage du `dungeonName` au resolver. ⚪ RESTE : icônes résistances/vitalité
  `public/assets/module-succes/*.png` (**à brancher ou supprimer**, chantier en cours) · onglet
  « Mes succès / Succès Commun » · prévisu zone sous-monde · bug faces noires 3D · butin par grade · zaaps · (option « graphe multi-boss en cartes séparées » à cadrer).
- **Accès membres / Discord (25/08)** : réglé le « Accès Banni » après réintégration (invalidation cache+session, PR #541 mergée) + UX « Exclure (réintégrable) ». **✅ CHANTIER 25/08** (`feat/chantier-2026-08-25-acces-timeout-archivage`) : reflet du **timeout Discord** (écran « Accès Temporairement Suspendu » + compte à rebours) · bug « Accès Banni » après réintégration définitivement corrigé (tombstone `findFirst({ liftedAt: null })`) · `wipeUserProfile` crée son tombstone · `getGuildMemberBans` sans `take:100` · **archivage auto 12 mois** · messaging honnête Archiver vs Supprimer. ⚪ RESTE (→ #223 résilience Discord) : invalidation des caches `member:`/`roles:`/`user:ctx` à un **changement de rôle / timeout Discord** — cache membre en mémoire (process app) non partageable avec le bot Gateway → Redis/endpoint interne ; + « Supprimer définitivement » réel = retrait du rôle d'accès Discord via le bot.
- **🧪 Session debug 26/08** (`feat/chantier-2026-08-26-dofus-icones-locales`, PR → dev) : fixes console/UI —
  icônes Dofus servies en **local** (`/module-dofus/*.png`, helper `dofus-image-url.ts` local-first, plus de dofusdb pour le profil/hub) ·
  recherche Ressources : partie **dofusbook retirée** (dofusdb seul) · recette craft sans « Copier la liste » ni copie/quantité (nom seul) ·
  WS `/socket.io/*` : **fix CORS même-origine** (400 → temps réel OK) · bloc **« Tarifs Forgemagie » retiré** de la carte Métiers du profil ·
  **Sigil Bomb** : volume son appliqué, décompte 3s synchronisé, mort subite **pré-avertie** (~3 échanges) + nouveau réglage (on/off + nb d'échanges).
  Vérifs : tsc 0 · eslint 0 · **340/340**. Mémo : `src/temp/memo-2026-08-26-fixes-console-ui-sigil-bomb.md`.


## 🟠 Bloc B — UX / Perf (valeur immédiate)

- **#186a** Optimistic UI (`useOptimistic` sur Rejoindre/Cocher/Toggle) + prefetch routes +
  skeletons + **virtualisation** (ladder, annuaire, galerie).
- **#129 / #1038** Responsivité : audit composant par composant (sweep à poursuivre).

## 🟠 Retours user (suite #202)

- **#227** — ✅ FAIT (24/08) : Épuration globale UI des notifications (cloches `NotificationBell` / `FeedBell` / `GodNotificationPanel` / page notifs — harmonisation des badges de compteurs, suppression des glow/gradients et ombres criardes, tokens OKLCH, dates en français).
- **#228** — ✅ FAIT + VALIDÉ (23/08, `feat/chantier-2026-08-23-one-shot`) : garde appliquée à galerie /
  présentation / services / donjons + interception `router.push`/`replace` **validée** : mécanisme confirmé
  sur Next 16 (`useRouter()` → instance router partagée & modifiable, `window.next.router`). Tests unitaires
  ajoutés (`tests/unit/unsaved-changes-guard.test.ts` : `isDirty` + `isExecutableScheme` sécu).

## 🟡 Bloc C — Fonctionnalités (valeur moyenne)

- **#198** Badges & Achievements (méta-succès, configurable God, raretés, ping Discord épique/légendaire).
- **#71** Prêts / Coffre : rappel auto @ping si prêt non clos (cron worker), historique/export par guilde, refonte modale.
- **#265** Épuration cartes + filtres + mode multi-donjons (2-5) + multi-embed Discord unique (1 ping).
- **#196 + #197** API Webhooks (HMAC, rate-limit, retry, OpenAPI) + PWA (service worker, push, install) — même socle.

## 🟡 Bloc D — God / Télémétrie

- **#34 / #194** Refonte Télémétrie God + **God Insights** (WAU/MAU, funnel d'activation, heatmap
  d'activité par module/heure, alertes, export).

## 🟢 Long terme / à planifier

#38 WebP items/ressources (God game-data) · #190 Worldmap (routes farm, zaaps, mines, traversées de mer)
  · **06/09/2026 — fix worldmap dézoom (EN COURS, `feat/refonte-onboarding`, non commité)** : tuiles/bandes noires + freeze dashboard (banque tuiles bornée, `keepBuffer 6→2`, fond océan, redraw unique rAF, highlight 4 Hz, icônes donjons mémorisées + nouvel asset `dungeon-boss.png`). Reste : validation runtime + PR → dev.
· #175 écart Ganymède→Sylvestre · #172 musiques de fond + réglages son + interface God sons
· #205 Guesser (dictionnaires API, modale fin d'épreuve responsive) · #234 audit scalabilité worldmap/guesser
· #40 benchmark galerie stuff · #1610 sécurité/infra (à cadrer en réunion) · #186b SEO long terme
· #4 grille agenda (semaine/mois) · #188 passe module Succès · #229 plan de croissance (**NOT FAIT**, lié ouverture prod).

## ✅ Déjà soldé (surveiller)

- **#242** — ✅ FAIT (26/08) : Refonte UI/UX de la **Fiche Boss** (module Succès) — `SuccesBossGuide.tsx` dé-sloppé (tokens OKLCH, type-scale, suppression ombres/`font-black`/`tracking-widest`/`transition-all`/scales, couleurs en dur→tokens) + enrichissement des onglets (synthèse « Mécaniques clés — N sorts à anticiper », cartes sorts détaillés en sections Effet principal / Déclenchement / Effets critiques, grades alignés à droite, butin en cartes homogènes icône+nom+taux, monstres de salle compacts). Vérifs : tsc 0 · lint 0 erreur · 339/339 · build OK.

#192 bouton « Suivant » · #199 tour tuto Succès · #202 / #204 RBAC · #206 Dofoobz centralisé
· #223 P0/P1/P2 · #127 audit RBAC · #85 blacklist embeds · #169 · #101 SEO almanax · #176 fiches boss
· #181 privacy OCR · #96 README déploiement CD · #41bis circuit-breaker Dofusbook · #140 landing God → `page.tsx`
· ✅ #228 garde anti-nav (4 formulaires + `router.push`/`replace` — interception validée + tests) · ✅ #226 cartes dj/quêtes (P1/3/4, P5 drawer → modale fermable, P2 hiérarchie créneau en tête, P6 transitions) · ✅ #225 Dokille (édition image God + seed 4 quêtes Safari + prérequis + trackeur krokilles 20 archis) · ✅ #233 Guide gestion guilde & Discord (permissions, architecture, sorties, synergie SigilOS) · ✅ #208 Planning & dispos (plages horaires explicites, icônes distinctes, chips textuelles) · ✅ #209 Contraste bouton « Suivant » / « Créer » Calendrier (`text-warning-foreground`) · ✅ #221 Polish UI/contrastes (onglets création Songes, modale marché Ocre + filtre hideOwned, harmonisation boutons DofusDB) · ✅ #224 Fiches Boss & Siphon (chargement instantané du catalogue, lazy-loading par boss sélectionné avec cache, sous-onglets épurés, alertes/notifications God crons siphon Dofensive, fix réactivité MonsterImage au changement de boss, garde isNumericId anti-CUID route proxy `/?url=`, monsterId de grille gardé par `typeof number`) · ✅ #180 Ocre, Metamob Sync, Troc & Place de Marché UI (transfert unitaire strict -1/+1, troc bilatéral avec étape archimonstre, boutons de stock +/-, refonte onglets) · ✅ Songes UI (bouton clôturer dé-jauni dark mode, boutons pros h-11) · ✅ Module Monumental Reaction Roles (RBAC, 4 modes NORMAL/UNIQUE/VERIFY/REVERSE, 2 styles BUTTONS/SELECT_MENU, swap auto removeRoleId, prérequis, blacklists, simulateur Discord live, 1-clic deploy, packs d'icônes GOD drag & drop visual importer) · ✅ Module Monumental Bot Ticket Discord Pro (Flotte GOD /god/ticket-bot, Module Guilde /dashboard/[guildId]/tickets, Inbox Zendesk-like, Formulaires Intake Modals dynamiques, Multi-Panels Discord live simulateur, Transcripts HTML horodatés, Notes internes staff chiffrées, Enquête CSAT 1-5 étoiles, RBAC staff:tickets) · ✅ Gestion membres & accès (`liftGuildMemberBan` : invalidation `user:ctx` + purge sessions à la réintégration · action « Supprimer » → « Exclure (réintégrable) » + modale honnête, PR #541). (#207 FAQ · #23/#134 avatar · #26/#177 donjons : traités/poussés le 23/08.)

- ✅ **#542 / #544 — Infra build & déploiement (25/08)** : pin `prisma@7.9.1` partout. **#542** = `npx prisma` dans `services/discord-bot/Dockerfile` (CI build du bot KO car `npx prisma` tirait `prisma@latest` = RC cassée `8.0.0-rc.10` sans la cmd `generate`). **#544** = pin dans `deploy-cd.sh` / `deploy.sh` / `audit.sh` (deploy VPS en ÉTAPE 4/5 : « No command registered for `migrate` »). ⚠️ Règle : **toujours épingler `prisma@<version>`** dans les cas où le CLI n'est pas installé localement (image runner = `.next/standalone`). ⚪ RESTE (optionnel) : durcir `deploy-cd.sh` (re-exec après `git pull` réussi — piège du « SHA local »).


---

## 🔄 Workflow d'une session (sur une branche propre)

1. `git checkout dev` puis `git pull origin dev`.
2. Créer la branche : `git checkout -b feat/chantier-<AAAA-MM-JJ>-<sujet>`
   (ex : `feat/chantier-2026-08-23-ouverture-prod`).
3. **ONE SHOT** : 1 chantier = 1 session (max 2 petits). Limite le scope, facilite la revue.
4. Avant tout commit : `npm run test:run` + `npm run build` (tsc + lint inclus).
   Ne jamais committer : `docs/audits/`, `src/audit-*`, `AUDIT_*.md`, `.env*`, `src/temp/`.
5. Mettre à jour en fin de session : `src/temp/chantier-actif.md` (statut) + `docs/ROADMAP.md` +
   un mémo `src/temp/memo-<AAAA-MM-JJ>-<sujet>.md`.
6. Pousser `feat/...` → PR vers `dev` (jamais directement sur `main`/`dev`).

## 📌 Semaine type (ordre conseillé)

1. **Semaine 1** : trancher la décision landing immersive → exécuter la checklist #57 (ouverture prod)
   + #227 / #228 (retours user).
2. **Semaine 2** : **Bloc B** (perf dashboard : Optimistic UI + virtualisation) — valeur ressentie max.
3. **Semaine 3** : un choix — **#198 Badges** (engagement) OU **#71 rappels prêts** (bouchage).
4. **En creux** (si session longue) : #223 P3 Discord + reliquats fiche boss (#188 icônes module-succès).
5. **Veille** : relecture du changelog Discord avant le **16/11/2026** (jour J résilience).
