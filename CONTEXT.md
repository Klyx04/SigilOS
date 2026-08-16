# 🧠 CONTEXT — SigilOS (Contexte global à fournir à chaque prompt)

> **Ce fichier est le point d'entrée du contexte projet.** Il centralise la vision globale et pointe vers les références détaillées. À référencer en tête de **chaque** nouveau prompt, pour que l'IA (Cline, ou autre) ait toujours la vision complète et ne rate rien.

---

## 👉 À fournir pour chaque prompt (démarrage rapide)

- **→ Utiliser `PROMPT_START.md`** (à la racine) : il donne le bloc à coller + la ligne à ajouter selon le type (bug, sécu, infra, SEO, BDD). C'est le réflexe n°1.
- **Référencer `CONTEXT.md`** en premier (contexte global).
- L'IA lit ensuite les fichiers référencés selon le sujet (sécurité → `SECURITY.md`, dev → `RULES.md`, infra → `MAINTENANCE.md`, SEO → `docs/SEO_REPRISE.md`).
- **Ne pas** déverser tout le repo dans le prompt — `PROMPT_START.md` + `CONTEXT.md` suffisent à orienter.

---

## 🏗️ Vue d'ensemble

- **Produit** : Bot Discord + Dashboard web pour la gestion de guildes Dofus (missions, ladder, calendrier, services, jeux, etc.)
- **Stack** : Next.js 16 (App Router + Server Actions + RSC) • React 19 • TypeScript 5 • Prisma 7 • PostgreSQL • Redis (BullMQ) • Discord.js v14 • Socket.IO • Tailwind 4
- **Archi** : Server-first + App Router ; **multi-tenant** (une app pour toutes les guildes, données scopées par `guildId`)
- **Auth** : Auth.js v5 (Discord OAuth, JWT, cookies `httpOnly`/`SameSite`/`__Secure-*` en prod)
- **Infra** : VPS Docker (app, bot, workers, ws, db, redis, monitoring) orienté **Caddy** reverse proxy • **Cloudflare Workers** (proxies ladder/dofusbook) • **Grafana/Prometheus** • **Sentry** • Backups chiffrés GPG → Cloudflare R2
- **CI/CD** : GitHub Actions (`dev`→beta, `main`→prod), `npm audit`, Semgrep, Trivy, Gitleaks, lockfile integrity
- **Déploiement CD (2026-08)** : build sur GitHub → images poussées vers **GHCR** (`.github/workflows/deploy.yml`) → le VPS fait `./scripts/deploy-cd.sh` (pull + up, ~30s, aucun build local). Fallback historique : `./scripts/deploy.sh`. **Rollback en 1 commande** : `./scripts/rollback.sh`. Voir `MAINTENANCE.md` (section 3b + procédures).

## 🧭 Chantier global (src/temp/chantier) — SESSION 18/08 (3e passe) — rapport quotidien débloqué + planning virtualisé

> **✅ PR #480 (`feat/design-system-polices` → dev) : 8 commits poussés le 18/08** —
> `e8aee47cd` (chantier dashboard) + `7776675a6` (fix sécurité CodeQL, 7 alertes levées) + **session 3** :
> `d2b48afef` (batch dashboard : **#93** modale donjon non couvert + CTA Discord, **#95/#4/#5** lag + dé-slop
> calendrier, **#94** filtres annuaire, **#77** rapport vulgarisé, **#89** logs Discord Gateway lisibles,
> **#22** onglets ladder dé-sloppés, **#55** rate-limits songes complétés),
> `7becc2cbc` (worker : logs d'erreur réels + bouton « Rapport quotidien » dé-sloppé),
> `09ea6ae9c` (**🔴 CAUSE RACINE rapport quotidien** : le worker BullMQ échouait sur `getPlatformStats()` qui
> exige une session God → stats désormais en requêtes directes scopées guilde, le rapport part enfin),
> `38d2522a5` (**#98 planning virtualisé** : fenêtre de lignes visibles au lieu de la `<table>` complète →
> scroll fluide à des centaines de membres).
> Vérifs : tsc 0 · lint 0 erreur · **192/192** · build OK. ⚠️ Déploiement beta requis pour : fix rapport quotidien,
> Planning (module Disponibilités + RBAC `availability:view` ; migration `20260818000000_add_availability_module`
> déjà appliquée en beta), virtualisation #98.
> Rappel : **#80 landing MERGÉE dans dev (18/08, PR #478, `a13e89184`)** + **#5 slice 1** (fonts 6→4, Space Grotesk,
> type scale) déjà dans `dev`/cette branche. Historique des sessions précédentes (16/08 → PR #470-477) ci-dessous.
> Détail : `src/temp/memo-2026-08-13-chantier-global.md` + `src/temp/chantier.md` (annoté ✅/🔸, session 3).

> PR #469 (feat/chantier-2026-08-13 → dev) **mergée + déployée en beta** (WS recréé, auth ACTIVÉE,
> migrations 201 à jour, Sondages `polls=t`). **PR #470 (session 14/08) MERGÉE dans dev**
> (`d39d40e97`, base 8866229d7). Branche `feat/chantier-2026-08-14` porte les **11 commits 15/08**
> (session 4e passe + correctif tags) **non encore mergés** → nouvelle PR vers dev.
> **Session 16/08 — #66bis (audit RBAC complet) + #72 (RBAC par membre / navbar admin) FAITS**
> sur `feat/rbac-audit-2026-08-16` (branchée sur `feat/chantier-2026-08-14`).
> Détail complet : `src/temp/memo-2026-08-13-chantier-global.md`.
> **Session 16/08 (fin) — F-16 SSRF + #73 présence + #58 badge God FAITS** (commit
> `fdf72c228` poussé sur `feat/rbac-audit-2026-08-16` → PR #473 mise à jour, CI relancée).
> F-16 : CodeQL `js/request-forgery` (faux positif, hôte Discord fixe + sig Ed25519 vérifiée)
> corrigé par bornage fail-closed dans `editInteractionMessage`. #73 : notif « a quitté »
> réparée (broadcast `leave` idempotent dans `disconnect`). #58 : badges non-lus God rendus
> (sidebar + topbar mobile).
> **Session 16/08 (3e) — #68 corrigé + refonte éditeur de quêtes façon Rush** (commit `fa2c5f08c`
> poussé) : icônes Dofus réelles restaurées sur les pages par-Dofus (DofusIcon) ; choix d''icône
> `serie-de-quete` / `icone-succes` par SECTION dans « Éditer la Section » ; éditeur de quêtes façon
> Rush Sylvestre (positions GPS + URLs DofusDB/DofusNoobs, anciens champs retirés).
> **Session 16/08 (4e) — icône de section membre agrandie + icône de bloc Rush** (commits
> `40a76738b` + `3760dcf5e`) : les sections quêtes affichent l''icône choisie (serie-de-quete /
> icone-succes) à la place de l''icône générique ; Rush Sylvestre : « Icône du bloc » optionnelle
> dans l''éditeur (`GuideSequence.icon`, migration `20260815120000`).
> **Session 16/08 (5e) — Lots 1-3 du chantier (5 commits, base `1f8fb6e4e` → `f48f4dd12`, poussés) :**
> 🔐 **Lot 1** (`4e60158e9`) : **#72 toggle God « Membres Spécifiques »** (`PlatformConfig.rbacUsersMappingEnabled`,
> migration `20260816100000_add_rbac_users_mapping_toggle`, kill-switch fail-closed lecture+écriture+UI,
> helper `src/lib/platform-rbac.ts`) · **#47** blindage God (`api/god/notify` Zod+temps constant, `api/god/upload-image` 10 Mo)
> · **#75** traçage God (`GOD_CONFIG_OVERRIDE`/`GOD_MAINTENANCE_MODE`) · **#55** rate-limits (relance 5/min+bornage 200,
> nudge 10/min, poll 5/30/min, calendrier 10/min, quêtes 60/min).
> 🎨 **Lot 2** (`33bf6c781`) : **#62** favoris navbar (garde anti-race `localPinMutations`) · **#63** anti-layout-shift
> onglet quête dofus (skeleton 60vh + fade pur) · **#59** landing guilde/annuaire « connecté » (badge + CTA Dashboard)
> · **#23** avatars Discord (`src/lib/discord-avatars.ts`, `?size=256`, webp) · **#69** profil lecture seule dé-sloppé +
> croquette conditionnelle.
> 🧩 **Lot 3** : **#74** interface « Relancer » dédiée solo/bulk (`240e4de30`) · **#40/#41** proxy dofusbook durci +
> alerte God throttlée panne/schéma FM (`6bbcb74a3`) · **#71** prêts : limite 5 actifs, « pas d'échéance », prévisu salon (`f48f4dd12`).
> Vérifs : tsc 0 · lint 0 erreur · test:run **187/187** · build OK. ⚠️ Migration à vérifier au deploy :
> `20260816100000_add_rbac_users_mapping_toggle` (appliquée en local).

### ✅ Session 15/08 — #68 icônes (choix God), Songe « éditer une run », #63, vérif multi-donjons
- **#68 icônes** : choix de l'icône du bloc d'en-tête des pages quêtes par Dofus **côté God**
  (`PlatformConfig.dofusQuestHeaderIcon`, migration `20260815000000_add_dofus_quest_header_icon`,
  validation Zod enum dans `updatePlatformConfig`, select dans `platform-config-panel.tsx`) →
  rendue dans `quetes-dofus/[dofusSlug]/page.tsx` via `getDofusQuestHeaderIcon()` (fail-closed).
  `icone-quete.png` posé dans chaque quête : par-Dofus (`DofusTimelineQuest` QuestRow) + Rush
  (`RushTimelineClient` SequenceRow). ⚠️ `OptimizedGuideClient` jamais touché.
- **Songe « éditer une run »** (manquante) : `updateDreamRun` (Zod, guild isolation, leader/admin,
  rate-limit, refresh embed) + modale `RunEditModal` branchée dans `RunCard.tsx` (bouton « Modifier »
  dans les actions leader).
- **#63** : onglet « Quêtes Dofus » lecture seule stabilisé (`min-h-[60vh]` TabsContent + retrait slide-in,
  loading `min-h-[50vh]`).
- **Vérif sécurité multi-donjons (#26/#7)** : `closeMemberPublishedContent` couvre déjà les posts multi
  (1 ligne `DjSearchPost` + 1 `discordMessageId`) → CLOSED + embed supprimé, aucun job de rappel planifié.
- **2e passe (15/08)** : présence Dashboard → popups discrets `GuildActivityStream` (bus
  `dashboard-presence-bus`, type LEAVE « a quitté », popups remontées `bottom-24` au-dessus du bouton
  Don) · panneau admin **« Points de Contribution »** `/admin/points` (`GuildConfig.pointsConfig`,
  migration `20260816000000_add_guild_points_config`, Zod admin, branché dans les clôtures DJ/Songes)
  · modale de suppression de run refaite (difficulté + avertissement, a11y).
- **3e passe (15/08)** : RBAC dédiée **`points:manage`** (« Gestion des Points de Contribution ») → carte
  automatique dans `/admin/permissions` (défaut : personne, admin bypass) · fix build (helpers purs →
  `src/lib/points-config.ts`, un fichier « use server » n'exporte que des async) · migrations
  `20260815000000` + `20260816000000` **appliquées en local** (`prisma migrate deploy`).
- Vérifs : tsc 0 · lint 0 erreur · **test:run 168/168** · build exit 0.

### ✅ Session 15/08 (4e passe) — #66 clarté Modules/RBAC + #67 galerie + #70 croix fermer
- **#66** : chaque carte Module affiche désormais **« Pages : »** avec liens cliquables vers les pages
  concernées (`MODULE_ROUTES` dans modules-client.tsx) ; chaque carte RBAC affiche **« Débloque : »**
  (permission-card.tsx). Dé-slop des deux pages (zéro glow/blur/animate-pulse, typo ≥ 11px).
  ⚠️ **#66bis** : audit RBAC complet (doublons/manques/incohérences + bloc admin) — session dédiée.
- **#67 galerie-stuff** : dé-slop page (header, tabs, filtres, cartes, compteur, micro-typos) sans
  toucher à la logique (filtres/votes/partage).
- **#70 croix fermer** : fix systémique `DialogContent`/`SheetContent` → bouton visible partout
  (bg-white/10, bordure, opacity-90, aria-label « Fermer »).
- Vérifs : tsc 0 · lint 0 erreur (warnings pré-existants) · **test:run 168/168** · build OK.

### ✅ Session 16/08 — #66bis audit RBAC complet + #72 (RBAC par membre / navbar admin)
- **#66bis audit RBAC** (sur `feat/rbac-audit-2026-08-16`) — 17 permissions auditées. Corrections :
  - **`system:rbac` rendue réellement utile** (décision produit) : nouvelle guard `requireRbacManagement`
    (guards.ts) accepte les admins Discord (niveau `discord-admin`) ET les détenteurs de `system:rbac`
    (niveau `delegated`) → la page `/admin/permissions` + carte admin + sidebar + tour passent de
    `isDiscordAdmin` à `canManageRBAC`. Un admin peut désigner un **successeur** (anti-blocage si
    l'unique admin Discord disparaît).
  - **🔒 Garde-fou anti-escalade** dans `updateRBACMapping` : un gestionnaire `delegated` ne peut NI
    octroyer NI révoquer `system:god` / `system:rbac` (réservé aux admins Discord). Testé unitairement.
  - **Validation fail-closed du payload** : permission inconnue rejetée, clé `usersMapping` non-snowflake
    rejetée (un UUID interne ne matche jamais le Discord ID → permission silencieusement inopérante).
  - **#72** : `hasAnyAdminPermission` (sidebar) complété (`canManagePoints`, `canValidateMissions`,
    `canManageRelance`) → un membre `points:manage` voit enfin « Centre Admin » (avant : accès en URL
    directe sans navbar) · carte « Points de Contribution » ajoutée au `NAV_REGISTRY` + aliases
    `modules`/`points` · `memberOptions` n'utilise plus que le `providerAccountId` (avatar `icon`, fixé).
  - **Sécurité legacy** : `stats:view` ne remappe plus vers `STAFF_AUDIT` (un rôle legacy obtient
    maintenant `canViewStats` via `DASHBOARD_LOGIN` sans accès Audit Logs).
  - **#66bis (2e volet)** : Galerie Stuff rattachée à `GAME_VIEW` uniquement (plus de chevauchement
    `COMMUNITY_ACCESS` non documenté) · badge « 🔐 Sensible » sur `system:god`/`system:rbac` dans la
    carte RBAC · ordre `PERMISSION_MODULES` aligné sur `MODULE_ORDER`.
- Tests : **+16** (`rbac-update.test.ts` 8, guards +4, user-context +3) → **184/184**.
- Vérifs : tsc 0 · lint 0 erreur (warnings pré-existants) · **test:run 184/184** · build OK.
- ⚠️ **Aucune migration** (pur code). Déployable sur les 11 commits 15/08 (branche empilée).

### ✅ Session 16/08 (fin) — F-16 SSRF (déblocage CI PR #473) + #73 présence + #58 badge God
- **F-16 SSRF CodeQL** (faux positif, corrigé) : CodeQL `js/request-forgery` (critical) sur
  `src/server/discord.ts:54` (`fetchWithRetry`), flow `interactions/route.ts` →
  `editInteractionMessage` (webhook `@original`). Faux positif (hôte `discord.com` fixe +
  signature Ed25519 vérifiée en amont) mais **bornage fail-closed** ajouté : `applicationId`
  (`/^\d{15,21}$/`) + `interactionToken` (`/^[A-Za-z0-9._~-]{10,200}$/`) AVANT l'URL webhook
  → débloque la CI de la **PR #473**. Alerte pré-existante sur dev (merge #447), pas introduite
  par la PR.
- **#73 présence** : la notif « a quitté le dashboard » ne partait jamais → le handler WS
  `disconnect` broadcast maintenant un `leave` idempotent (`dashboardGuildId` mémorisé au
  join, nettoyé au leave). Couvre onglet fermé + coupure réseau.
- **#58 badge God** : `unreadCount`/`ticketCount` passés à `GodSidebar` mais jamais rendus →
  badge rouge « Alertes Système » + badge indigo « Tickets » sur les items de sidebar +
  cloche + badge dans le topbar mobile (`godRoute?tab=notifications`).
- Commit `fdf72c228` poussé sur `feat/rbac-audit-2026-08-16` (aucune nouvelle branche).
- Vérifs : tsc 0 · lint 0 erreur (warnings pré-existants) · test:run 184/184 · build non
  relancé localement (dev server actif) — la CI le validera.

### ✅ Session 16/08 (3e) — #68 corrigé (icônes Dofus réelles + icône par section) + refonte éditeur de quêtes façon Rush
- **#68 corrigé** (retour user) : les pages par-Dofus affichent de nouveau l''icône **réelle du Dofus**
  (`DofusIcon`, `/module-dofus/Dofus_*.png`) dans le hero ; le choix `serie-de-quete` / `icone-succes`
  est déplacé **par SECTION** (`DofusQuestChain.sectionIcon`, migration `20260815100000_add_quest_section_icon`)
  dans « Éditer la Section » (God) et rendu à côté du nom de chaque bloc (God + membre).
- **Refonte éditeur de quêtes façon Rush Sylvestre** : `DofusQuestEntry` + `positions` (GPS `[{x,y}]`),
  `dofusdbUrl`, `dofuspourlesnoobsUrl` (migration `20260815110000_add_quest_entry_positions_sources`) ;
  suppression de Objectifs / Objets requis / Donjons requis / Type / DofusDB ID / Coord X-Y dans l''éditeur ;
  ajout bloc « Positions GPS » + URLs. Membre : QuestActionsBlock (GPS positions[0] + URLs) + QuestChecklist
  (positions de lancement + icône section).
- Commit `fa2c5f08c` poussé sur `feat/rbac-audit-2026-08-16`. Migrations appliquées en local (`prisma migrate deploy`).
- **Rush Sylvestre — icône de bloc optionnelle** (`GuideSequence.icon`, migration `20260815120000_add_rush_sequence_icon`) : choix `serie-de-quete` / `icone-succes` (optionnel) dans l''éditeur Rush (« Icône du bloc ») ; rendu sur le bloc membre (RushTimelineClient) + liste God (SequenceRowAdmin). Commit `3760dcf5e`.
- **Quêtes Dofus — membre** : l''icône générique (Layers) des sections est remplacée par l''icône de section agrandie (DofusTimelineQuest).
- Vérifs : tsc 0 · lint 0 erreur (warnings pré-existants) · test:run 184/184.

### ✅ Session 14/08 (suite 5) — #37 présence WS par-Dofus + #26/#27 Donjons (7 commits)
- **`71fc3c148` — #37 présence WS temps réel page par-Dofus** : module WS `dofus-presence.ts`
  (room `guild:{gid}:dofus:{slug}`, position = `questId`, fail-closed `isMemberOfGuild`) + hook
  `use-dofus-presence.ts` + `dofus-realtime.ts` (publish best-effort). `toggleQuestStatus` publie
  `quest:status` → synergie LIVE (fin du polling 2 min). Bandeau « Présence live » + badge
  « N en direct » par quête + viewers live. **`OptimizedGuideClient` (Ganymède) jamais touché.**
- **`1c6d35308` → `79631ac97` — #26/#27 Donjons (v1→v3)** :
  épuration UI/UX (dé-lag framer-motion, anti AI-slop) + `DjMultiDungeonModal` ; fix DateTimePicker
  z-index (date/heure injoignable) + icônes ; **v2 « UN SEUL post »** (migration `dungeonsJson`,
  un post multi au lieu de N, **UN embed PAR donjon**) + retour « Mode simple » ; **v3 boutons
  Discord PAR donjon** (`dj:join:{postId}:{idx}`, libellé « S'inscrire — <nom> », migration
  `dungeonIndex` sur `DjSearchParticipant`), blocage SUIVANT expliqué (blockReason), étape 2
  scrollable, date multi optionnelle ; **limite posts actifs/membre 5**.
- **#27** : `AchievementTracker` dé-sloppé ; ⚠️ **placement « Mes succès »/« Succès Commun » :
  décision produit à trancher.**
- Vérifs : tsc 0 · lint 0 erreur · **test:run 168/168** · build OK.
- ⚠️ **Migrations à vérifier à la PR/deploy** : `20260814120000_add_dj_multi_dungeons` +
  `20260814130000_add_dj_participant_dungeon_index`. ⚠️ Après deploy : recréer le container WS
  (handlers `dofus:*`).

### ✅ Sécurité — F-01 (revocation d'accès membres supprimés/bannis)
- **Bug confirmé** : un membre supprimé par un admin (`deleteProfileByAdmin`) était **ré-provisionné
  automatiquement** (profil recréé car toujours sur Discord avec un rôle autorisé) + cache 60s non invalidé.
- **Fix** : table `GuildMemberBan` (tombstone guild-scopé, migration `20260813000000_add_guild_member_ban`),
  check fail-closed dans `_getUserContext`, upsert/lift sur delete/ban/reactivate/sync,
  invalidation immédiate des caches, **onglet « Exclus »** dans l'admin membres (liste + « Réintégrer »).
- **Flux archivé** : auto-archive → redirection `/dashboard/{guildId}` (page « Compte Archivé » + réintégration).

### ✅ Quick wins & features (chantier)
- Ladder : messages clairs avec le nom du serveur Dofus configuré (Draconiros) — 4 points de vérification.
- Guides : alignement des MULES synchro profil perso (`updateMuleAlignment` → `altPseudos`), tranches par pas
  de 10 (10→100) sur Ganymède / Rush / Profil, highlight « rendu ici » emerald + centrage.
- Missions : icône exclamation sur objectifs manuels. Guild-hub : onglet Stats supprimé.
- Notifications : page stabilisée (plus de saut au changement d'onglet).
- Sidebar : nom + logo de guilde affichés même pour une seule guilde. Dashboard : widgets Agenda/Sondages
  gatés par RBAC (`canViewCalendar` / `canViewPolls`).
- Audit fermeture posts : DJ posts restent ouverts (auto-expire volontairement désactivé) — voir mémo.

### ✅ Qualité
- `tsc --noEmit` 0 · lint 0 erreur · `test:run` **155/155** · `npm run build` OK.
- ⚠️ Migration Prisma à appliquer en beta : `20260813000000_add_guild_member_ban`.

### ✅ Session 14/08 — #36, #33 (fin), #18, #25 (même branche, 3 commits + rush dans #36)
- **#36 Membres En Ligne** (`7d2139e3b`) : nouvelle action `searchGuildMembers` (Zod + fail-closed
  non-auth/non-membre/sans `canViewRoster` → `[]`, scope guilde ACTIVE, take 8) + **champ de recherche
  dans la modale headbar** (debounce 250 ms) → clic = page lecture seule `/members/{slug}`. +10 tests
  (`tests/unit/presence-search.test.ts`) → **165/165**.
- **#33 rush « Rendu ici » 1 max par bloc** : état `bookmarksByMs: Map<msId, seqId>` + toggle per-bloc
  (le serveur était déjà per-milestone), **bouton « Rendu ici/Repère » dans l'en-tête de chaque bloc**
  (pose sur la 1ʳᵉ quête non faite / retire), repère principal (HUD « Rush Live » + « Reprendre ? ») =
  bloc actif sinon 1er du guide. ⚠️ fichier inclus dans le commit `7d2139e3b` (incident lock/quoting).
- **#18 ladder** (`6553598ba`) : `vitrineMode` **appliqué aux admins/God** (suppression `&& !user.isAdmin`)
  → Activité/Guildatons masqués pour tous en vitrine ; onglet **« Général » (XP membres) remonté en 2ᵉ position**.
- **#25 songes** (`a953df2ca`) : **heure « Créée/Départ »** sur les cartes de runs + épuration UI
  (decor blur, glow boutons, barre gradient animée, `animate-pulse`, `backdrop-blur` retirés).
- Vérifs : tsc 0 · lint 0 erreur · **165/165** · build OK · pre-commit vert (4 commits).
- 🔜 Reportés : #34 God Télémetry pro + #26/#27 donjons (multi-embed) → prochaine session.

### ✅ Session 14/08 (suite) — #61 Rush Sylvestre + quick wins (2 commits `0869dc11e` + `f435969bf`)
- **#61 Rush Sylvestre refondu** (`0869dc11e`, PLAN-ACTION-RUSH-SYLVESTRE.md 4 phases, **`OptimizedGuideClient` jamais touché**) :
  - **P1 temps réel** : `useGuidePresence` porté (room `guild:{guildId}:guide:rush-sylvestre`), `RushLivePopover`
    (poll BDD 10s) remplacé par présence WS + fallback props serveur, **polling `router.refresh()` 120s supprimé**,
    **mode discret** (localStorage `guide-incognito-{guildId}`) dans le menu Options, `LiveActivityTicker` réutilisé,
    modale « Membres sur le guide », `guide-styles.css` importé (tokens `--z-*` dispo sur la page Rush).
  - **P3 densité** : checkbox 44px→22px, suppression du doublon « Position de lancement » (tips vs chip pos_tags). **Icônes conservées visibles** (retour user 2e passe) : chips NOOBS/DOFUSDB restaurées avec favicons + tous les badges d'activité affichés.
  - **P4 glow** : textShadow/boxShadow ornés/drop-shadow retirés (bannières DofusObtained/Info/InfoSequence plates, hero plat).
  - **P2 hero** : carte **Metamob cliquable → `OcreProgressModal`** (nouvelle prop `ocreMonsters`), carte Alignement
    cliquable entière, **menu « Options »** (Masquer terminées / Mode discret / Aide / Réinitialiser) — 3 boutons retirés de la barre sticky.
- **Quick wins** (`f435969bf`) :
  - **#39** présence Dashboard temps réel (WS) : handlers `dashboard:join/leave` (auth + guild isolation fail-closed,
    broadcast aux AUTRES via `socket.broadcast.to`) + hook `useDashboardPresence` dans la SmartBar → toasts
    « X est arrivé(e) / a quitté le dashboard ». ⚠️ **redéployer le container WS** pour activer.
  - **#45** embeds lifecycle : pseudo **serveur** (`discordNickname`) en priorité, plus jamais `user.name` (bot inclus).
  - **#46** popup d'arrivée sous le bouton Don : Dialog shadcn `z-50`→`z-[110]` (close `z-[120]`), welcome modals `z-[120]` — au-dessus du SupportOrb `z-[100]`.
  - **#42** galerie + profil : icône remontée de façon robuste (wrapper `bottom-14` + `object-[50%_20%]`) sur `gallery-client.tsx` **et** `skin-library.tsx` (profil — non touché avant).
  - **#43** boutons onglet Stuff du profil : tailles unifiées `w-9 h-9`, **teintes colorées** (Sync sky / Éditer ambre / Supprimer rouge / Copier emerald) + **logo Discord blurple #5865F2** (overlay + modale).
  - **#60** annuaire : bouton **« Copier »** visible (bordure emerald + libellé) → `/w pseudo`.
- Vérifs : tsc 0 · lint 0 erreur · **test:run 165/165** · build OK · pre-commit vert (2 commits).
- 🔜 Prochaine session : #37 God quêtes-dofus, #38 Prêt/Coffre, #44 sondages UX, + rappels #34/#26/#27.

### ✅ Session 14/08 (suite 2) — #37 (bug + harmonisation + particules + présence), #38, #44, icône Discord profil (même branche)
> ⚠️ **`/quetes-dofus` ≠ `/dofus-guides`** : 2 modules distincts — le #37 porte sur **`/quetes-dofus`** (admin God
> + pages membre par-Dofus). **`OptimizedGuideClient` (Ganymède) jamais touché.**
- **#37 bug « Déjà en dernière position » corrigé** (`dofus-quest-admin-actions.ts`) : cause = voisin cherché
  par `chainOrder/stepOrder: { gt/lt }` sur des champs `@default(0)` NON uniques après siphon. Fix = liste
  triée + swap par index + **valeurs contiguës 0..N-1 en transaction** (Zod direction, auth fail-closed).
- **#37 admin God harmonisé** (`DofusQuestGodManager.tsx`) : dé-glow total (italic, `shadow-*`, `blur-3xl`,
  `animate-in`, inputs emerald/cyan → neutres), « Expulser »→« Supprimer », modale DofusDB ID restylée.
- **#37 pages membre par-Dofus** : `GuideParticles` paramétrable → **particules teintées à la couleur
  officielle du Dofus** + nouveau `DofusPageOptions` (menu « Options » du bandeau, toggle localStorage) ;
  **« Qui est rendu où »** sans plafond (`QuiEstOuPanel` scrollable, détails quête IN_PROGRESS + COMPLETED).
  ⚠️ Suivi : présence WS dédiée page par-Dofus non portée (nécessite redeploy container WS).
- **#38 Coffre** : source documentée dans l'UI (**Dofusdude**, fallback saisie libre) + **consommables
  ajoutés** à la recherche `all` + UI `vault-form`/`vault-table` dé-sloppée.
- **#44 Sondages** : `poll-card`/`poll-list` dé-sloppés (glow/blur/pulse/italic/hover cyan retirés) → Calme 2026.
- **Icône Discord profil** (retour user) : bouton **toujours visible** sur chaque miniature de stuff
  (`skin-library.tsx`, blurple #5865F2, partage rapide).
- Vérifs : tsc 0 · lint 0 erreur · **test:run 165/165**.
- **Session 14/08 (suite 3)** — **#37 prérequis rendus côté user** : `getDofusDetailWithChains` charge
  `prereqsByQuestId` → quête **grisée + badge cadenas « N prérequis »** tant que non complété + clic = focus/scroll
  sur la quête prérequis. **#44 module Sondages invisible** : cause = `DEFAULT_MODULES.polls=false` + **toggle
  `polls` absent de `/admin/modules`** → toggle « Sondages » ajouté (+ **doublon « Mini-Jeux & Carte » supprimé**).
  ⚠️ Réactiver « Sondages » dans `/admin/modules` après déploiement.
- **Session 14/08 (suite 4)** — **« Rendu ici » bloqué sur quêtes à prérequis non terminés** (page par-Dofus :
  bouton désactivé ; Rush : refus dans `handleBookmarkSequence` via `blockedSeqIds`) + **dénomination revue :
  « Rendu ici » → « Je suis ici »** partout (boutons, tooltips, compteurs « N membres ici », Rush inclus).

## 🧭 Suivi de chantier — Carte du Monde, 429, mini-jeux (10/08/2026) — FAIT sur `feat/deploy-clean-pro`

> Tous les commits poussés sur `feat/deploy-clean-pro` (PR à merger vers `dev`). Détail complet : `src/temp/memo-2026-08-10-worldmap-jeux-429-suite.md`.

### ✅ Rate-limit Caddy 429 (correctif appliqué en beta)
- `Caddyfile` : bornes hautes (**3000 req/min + burst 500/s**) + exemption assets (`/game-data/*`, `/_next/*`, `/manifest.webmanifest`, `/images/*`, `/icons/*`, `/fonts/*`, `/assets/*`, `/uploads/*`, `/api/storage/*`).
- Belle page 429 : `public/429.html` + snippet `(error_page_429)` (`handle_errors 429`).
- ⚠️ **`deploy-cd.sh` ne recrée PAS caddy** → recreate manuel : `docker compose -f docker-compose.prod.yml --env-file .env.beta up -d --force-recreate --no-deps caddy`.
- ⏳ **Prod (main)** : même recréation à faire après merge.

### ✅ Monde 38 (Village des Brigandins) réparé
- Specs officielles DofusDB (`4085×2861`, mapWidth 510, mapHeight 366, origine 9908/9402) dans `worlds.json` + **tuiles officielles** (banks 1=204, 0.75=117, 0.5=54, 0.25=15) via `scripts/sync-world38-tiles.js` (hors git → `sync-assets.sh`).
- Coordonnées `x/y` des maps corrigées ; **POC vue HD à fort zoom** (`map-hd-overlay.tsx`, monde 38).
- **Fix 404 tuiles (10/08)** : Next.js en mode `standalone` ne sert pas de façon fiable le dossier `public/game-data` bind-mounté → `/game-data/*` est désormais servi **en statique par Caddy** (`handle /game-data/*` + `uri strip_prefix`, volume `./public/game-data:/srv/game-data:ro` sur le service `caddy`). Déployé beta (curl → 200). Mise à jour tuiles = `sync-assets.sh beta` (hors git) + recreate Caddy. Détail : `MAINTENANCE.md` §3d.

### ✅ Plein écran des mini-jeux (Sigil Guesser + Bomb)
- Mécanisme unifié : `worldmap-fullscreen` (sur `#worldmap-page` / `#mini-games-page` / `#sigil-bomb-page`) + `map-fullscreen` sur `<body>` (cache sidebar/topnav/footer/tours).
- ForceFullscreen + style inline + interval de secours ; déclencheur = **`gamePhase !== 'idle'`** (retour menu sans blocage).
- HUD (score/timer/round) en haut en plein écran + **bouton Quitter la partie** + croix (dans la zone `activeTab==='games'`).
- Guesser : **zone cible / carte monde 50/50**, classement en bandeau + scores agrandis, **pré-chargement tuiles** (anti-clignotement), fix monde `-1` (recherche monstre).

➡️ **Action** : PR `feat/deploy-clean-pro` → `dev` ✅ **MERGÉE + DÉPLOYÉE (10/08)** (build beta + `sync-assets.sh` tuiles monde 38 + favicon). Ensuite Prod (`main`).

## 🧭 Suivi de chantier — Refonte UI « moins IA » (dashboard + landing) — FAIT sur `refonte/dashboard-ui-moins-ia`

> **Branche** : `refonte/dashboard-ui-moins-ia` → PR vers `dev` (lien : `https://github.com/Klyx04/SigilOS/pull/new/refonte/dashboard-ui-moins-ia`). **Mémo** : `src/temp/memo-2026-08-10-refonte-ui-moins-ia.md` (gitignoré).
> Application de la direction design 2026 (`src/temp/sigilos-design-system-etat-de-l-art.md` + `sigilos-home-direction-2026.html` + `sigilos-landing-direction-2026-v3.html`). **21 commits**, poussée le 10/08/2026. tsc 0 · eslint 0 · hooks verts.

### Principes appliqués (partout)
- **Une seule couleur d'accent** (emerald) ; **zéro glow/aura** (profondeur par surfaces + bordures) ; **typo ≥11px** (plus d'italic-black hors display) ; **motion ≤200ms** ; décor coloré retiré.

### Chrome & home
- **Sidebar** (`app-sidebar.tsx`) : **plate** (sections dépliées), dashboard item normal, footer neutre (Docs/Maj/Bugs), **densité verticale réduite** (~moitié du scroll), `SectionTitle` statique.
- **Top bar** (`top-nav.tsx`) : **centre vidé** (ticker retiré), LiveStreamBadge + **pilulier « prochain event »** + **stack d'avatars en ligne** (SmartBar) repliés à droite, breadcrumb page courante en `foreground`.
- **Home** (`page.tsx`) : header contextuel « Bonsoir {prénom} ⚔ », suppression fond aurora glow, KPI strip neutre, bande **« À faire maintenant »** (sondages ACTIVE, prochain event, almanax).
- **Drawer mobile** + **panneau god** (god-sidebar/god-top-nav) : même traitement Calme (statuts sémantiques conservés).
- **Landing** : passe Calme sur 11 composants (`src/components/landing/*` + `src/app/page.tsx`), SEO/ISR/JSON-LD conservés.

### Bug fixes (en passant)
- Hydration `<button>` imbriqué (`live-stream-badge.tsx` → span role=button a11y) ; Image `fill` missing `sizes` (`unified-module-header.tsx`).
- **9 pages Prisma → composants client sérialisées** (`JSON.parse(JSON.stringify(...))`) : members, missions, validation, services, donjons, galerie, kamas, ocre, archimonstres (erreur « plain objects / symbol properties »).
- Hydration SmartBar (compteur live, `suppressHydrationWarning`) ; crash **`useTour` SSR** (garde context null via `useContext(TourContext)`) ; badge live nettoyé.

### Perf / infra
- `getUnreadNotifications` : **cache-first** (évite `getUserContext` ~5s par poll sidebar) + TTL 10s.
- Pool pg (`src/lib/prisma.ts`) : `connectionTimeoutMillis` 5→10s, `idleTimeoutMillis` 5→15s (réduit « timeout exceeded when trying to connect » sous charge).

### 🔜 Suite (non fait)
- **PR `refonte/dashboard-ui-moins-ia` → `dev`** ✅ **MERGÉE (10/08)** — remplacée par la branche `refonte-module-ganymede`.
- **DB pool/infra** : si timeouts persistent en prod sous charge → `max_connections` Postgres + réduire le parallélisme de la home (11 requêtes, après retrait de 2 appels `getActivityLadder` morts — voir ci-dessous).

### ✅ Session 10/08 — commit `25918f3d` (poussé sur `refonte/dashboard-ui-moins-ia`) + points 4/5
- **Home KPI avec comparaisons temporelles** (point 4) : `QuickStatsRow` affiche des deltas (`▲ +3 ce mois` / `▼` / « stable ») pour Membres actifs (croissance nette via `retention.growth`) et Événements (`events.thisMonth`). **0 requête BDD en plus** (réutilise `guildStats` déjà chargé) → cohérent avec le point 2.
- **Mode vitrine (missions) → masque aussi pour les admins** :
  - **Cause racine** : `getUserContext` (`user-actions.ts`) ne sélectionnait **pas** `missionVitrineMode` dans le `select` du `guildConfig` → `user.missionVitrineMode` toujours `false`. Fix : champ ajouté au select.
  - **Home** : carte « Progression Dofus » masquée quand vitrine active (`hideDofusProgress`).
  - **Profils** (`profile-bento-grid.tsx`) : `isVitrineActive = missionVitrineMode` (retiré le `&& !isAdmin` qui laissait l'onglet visible sur les profils admin) → onglet « Présence & Feed » masqué **aussi pour les admins** (profil perso + profils membres, bento partagé) + garde repousse `?tab=activity`.
  - **Fix annuaire (React #441)** : `UserProfile.totalXp` est un **BigInt** (seul du schéma). `getGuildMembers` (`profile-actions.ts`) propageait `...p` → `JSON.stringify` throw sur BigInt quand un membre avait `totalXp` non-null → crash SSR #441. Fix : `totalXp.toString()` dans le mapping.
- **Landing v3** : branche `SaasFeatures` + `HowItWorks` + `PreFooterCta` (composants préexistants jamais branchés) + `landing-carousel.tsx` aligné direction Calme (retrait blobs amber, `backdrop-blur-xl`→md, transitions→150/`transition-colors`).
- **Landing v3 — showcase mini-dashboards par guilde** (point 4) : nouvelle action publique `getPublicGuildShowcase(limit=6)` (`presentation-actions.ts`) agrège par guilde : membres actifs, missions validées, songes complétés, progression Dofus moyenne. **Léger** : cache Redis 5 min + agrégats groupés. Nouveau composant `guild-showcase-section.tsx` branché sur la landing.
- **Perf home (point 5)** : retrait de **2 requêtes mortes** `getActivityLadder(weekly/monthly)` (jamais utilisées dans le rendu, signalées par lint) → parallélisme **13 → 11 requêtes**.
- **Validation** : `tsc --noEmit` 0 · eslint 0 erreur (warnings pré-existants) · `test:run` **137/137** · pre-commit vert.

---

## 🧭 Suivi de chantier — Ménage branches + nouveau chantier (10/08/2026)

> **Tous les chantiers antérieurs sont MERGÉS dans `dev`** (vérifié : les 8 branches feature sont des ancêtres de `origin/dev`, rien perdu). **Nettoyage terminé** le 10/08.

- ✅ **Ménage complet des branches** : suppression (local + remote) de `feat/csp-nonce-based`, `feat/deploy-clean-pro`, `feat/onboarding-admin-tour`, `feat/security-hardening-suite`, `fix/display-name-server-pseudo`, `fix/ladder-discord-stats`, `fix/tour-admin-first-admin`, `refonte/dashboard-ui-moins-ia`. **Ne restent que `main` et `dev`** (remote + local).
- ✅ **`SECURITY.md` resynchronisé** : CSP_ENFORCE activé beta+prod (10/08), WS auth activé+testé prod — lignes « À faire » obsolètes retirées.
- ✅ **Nouvelle branche de travail** : `refonte-module-ganymede` (ouverte depuis la HEAD mergée, contenant toute la session).

### ✅ Refonte module GANYMEDE (guide complet) — MERGÉE dans `dev` (PR #456, merge `42b5c4d4`, 13/08/2026)

> **Branche MERGÉE** : `refonte-module-ganymede` → **PR #456 mergée dans `origin/dev`** (merge commit `42b5c4d4`, 13/08). **Mémo** : `src/temp/memo-2026-08-10-module-ganymede.md`. Mock de référence : `src/guide-complet-refonte.html` (jamais commité).

- **Module cible** : `https://beta.sigilos.fr/dashboard/1290442961380835451/quetes-dofus/guide/progression-complete` (route `src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/page.tsx`).
- **Périmètre (fichiers)** : parser `src/lib/ganymede-parser.ts` · actions `optimized-guide-actions.ts` · rendu `OptimizedGuideClient.tsx` + `guide-styles.css` · `RushTimelineClient.tsx` (sylvestre, **non touché**) · onglet/admin `OptimizedGuideTab.tsx` / `god/dofus-guides/` (phase 6 séparée).
- **Direction design 2026 « moins IA » appliquée** : palette disciplinée **doré = fil de quête · emerald = progression · rouge = danger · bleu = coords/infos**, zéro glow, typo ≥11px, motion ≤200ms, colonne lecture 840px + breadcrumb sticky.

### 🎯 Architecture finale — mode unique « Guide Focus » plein écran (refonte complète 10-12/08)
- **Un seul mode** : le guide occupe tout l'écran. Mode mission supprimé. **Chrome app masqué** (`body.guide-fullscreen` → cache sidebar/topnav/footer via `globals.css`, `.guide-shell` = `position:fixed; inset:0; height:100dvh`).
- **Vue de base supprimée** (fini « Hub / X/Y complétées / % / Rechercher / Suivi de guilde ») : plus de sidebar.
- **Mini-bar sticky** (`guide-hud`) : bouton **✕ Quitter** (sortie garantie) · Sommaire (bouton + raccourci `S`) · sélecteur de guide (`getOptimizedGuidesLite`) · `Phase X · [GPx] nom · Z%` · barre dorée.
- **Tiroir Sommaire (TOC)** : chapitres/jalons, rendu en `createPortal(document.body)` (passe AU-DESSUS de la navbar app), fermeture `S`/Échap. **Épinglable** en rail fixe 340px (bouton 📌, localStorage `guide-toc-pinned-{guildId}-{slug}`, repli < 1200px).
- **Hiérarchie Échap** : 1) ferme le sélecteur de guide 2) ferme le tiroir 3) quitte le module.
- **Bandeau héro style rush sylvestre** (`guide-hero`, **pleine largeur**) : grand bouton « Quêtes Dofus », 4 cartes — **Personnage Actif** (`GuideCharDropdown` : mules/classe) · **Alignement/Ordre** (`getAlignment`/`ORDERS`, badge tranche) · **Métamob/Ocre** (`ocreStats` : Gardiens X/51 · Archis X/286 + lien `quete-ocre` ou « Lier Metamob ») · **Progression** (% + barre). La **lecture seule** reste en colonne 840px centrée (`.guide-read-col`).
- **Étapes des sous-guides en liste** (plus de focus une-à-la-une), avatars Discord remplacés par un compteur « N membres » discret, popin sociale 3ᵉ niveau conservée, « Signaler un bug » restauré.
- **Boutons dé-glowés** (directives design system) : `nav-btn`/`validate-btn`/`bookmark-btn` sans glow/pilule/translateY, footer stable (`min-width`).
- **Par-Dofus gardé** (10/08) : refonte zero-glow `DofusQuestHub.tsx` + fix hydration `<button>` imbriqués dans `DofusTimelineQuest.tsx`.

### Commits clés (refonte complète, poussés)
Anciens : `631ae4c8` tokens · `46aa6378` nettoyage AI slop · `5c1e6dc2` mode mission · `ef1dd0ce` lecture · `e5578ac3` entraide/reward/tags · `f15f766e` par-Dofus + fix hydration · `767f7839` focus · `3a175e93` désencombrement · `9e15d73b` mode unique Guide Focus · `e3660144` fix encodage UTF-8 (mojibake).
Session 11/08 : `36bf6a25` hover carte `CoordHoverMap` + suppression bandeaux positions · `0b93d302` pin supply-chain CI · `908582ea` CONTEXT · `aea3ac68` CodeQL SSRF/command-injection.
Refonte finale : `4a2d8e04` HUD flottant + sélecteur guide + nettoyage · `d5a2b83e` suppression sidebar + tiroir sommaire + étapes en liste + sélecteur personnage · `8aeb9e9e` tiroir TOC en portal + plein écran app + boutons dé-glowés · `f6fa41c1` bandeau style sylvestre + aération.
Session 12/08 (reprise refonte, branche `refonte-module-ganymede`) : `e8a2d36e` **AI slop unifié Ganymède+Rush** (zéro glow/blur/translateY/pulse) · `0dd86d03` **échelle z-index unifiée** (tokens `--z-*`, retrait `z-[999999]`) · `0231ac9a` **V2** (bouton Quitter HUD + Échap hiérarchisé + sommaire épinglable + hero pleine largeur + plein écran `100dvh`) · `f6aa862b` **3 chantiers UX** (valider tout le guide d'un coup `completeGuideProgress` + libellés unifiés « Masquer/Afficher les étapes validées » + bouton valider/étape agrandi).
**Session 12/08 (continuation — 15 commits `53160815`→`9d95f51e`)** : **K** UX jalons/sous-guides (fix « 1 membre », clarté sommaire) · **E temps réel serveur** (`guide-realtime.ts` + `guide-presence.ts`, Redis `guide:*` → room `guild:<guildId>:guide:<slug>`, heartbeat 45s, batching) · **F temps réel client** (`use-guide-presence`, `LiveActivityTicker`, mode discret) · progression par mule (`key={character}` + localStorage scopé) · menu Options unifié + « Tout valider » visible · recherche sommaire (jalons+sous-guides, surbrillance) · modale « Mon Ocre » (zéro refetch Metamob) · particules désactivables · édition alignement/ordre · fix écran noir (CSS corrompu) · **valider un sous-guide d'un coup** + masquage des validés · lisibilité HUD (Quitter rouge, menu opaque) · **notifs arrivée/départ** (presence join/leave) · **guide tour complet** (phase `guide`, rejouable, pour tous) · dédoublonnage présence.
- **Phase I — Agrégation serveur ✅ commit `2c9e4161`** : `getGuildOptimizedGuideProgress` passe au **select chirurgical** (fini le `include profile + user` 5k-15k lignes) + agrégats `presenceMap`/`uniqueGuildMembers` calculés **côté serveur** via `guide-progress-helpers.ts` (helpers purs + 4 tests) — shape des props client NON cassée (passthrough page.tsx), fallback client conservé, **zéro migration Prisma** (auth + guild isolation intouchées).
- **Retours user 12/08 (round 3) ✅ commit `a8137e16`** : le sommaire se met enfin à jour après validation d'un sous-guide (jalon auto-complété quand toutes ses étapes sont cochées — fix `isAllCompleted`) · nav du guide principal **dans le contenu de l'étape GP0** (`guide-step-nav-top`, flèches flottantes supprimées) · libellé « Sous-guide · Étape N/M » pour la nav de lecture.
- **Retours user 12/08 (round 2) ✅ commit `6ca7a6f0`** : flèches Précédent/Suivant TOUJOURS visibles sur le guide principal (compteur « Étape X/N ») · sommaire masque tout sous-guide validé (parties incluses) · **vue lecture = seule vue** (bouton et vue liste supprimés) · bulles profils de présence en avatars en haut des étapes · particules plus immersives (palette Dofus, halos, perf).
- **Fix retours user 12/08 ✅ commit `de632c69`** : le sommaire masque maintenant AUSSI les sous-guides sans bornes 100 % validés (remontée des étapes chargées `refStepsByRef`) · flèches ‹ › de changement d'étape sur le guide principal (suit l'étape visible) · boutons de contrôles dissociés visuellement (ambre/vert/bleu).
- **Vague UX 12/08 ✅ commit `467fe0d1`** : sommaire masque les sous-guides validés quand « Masquer les étapes validées » est actif (jalon complété inclus) · « Revoir le guide tour » sorti du menu Options → bouton doré dans le bandeau du haut · bulles de présence des étapes remontées en haut · suppression du décalage au hover (translateX) · **vue lecture** (étapes numérotées + bouton Suivant ›) dans chaque sous-guide.

### ✅ Session 13/08 — Alignement GP9/GP9B (branche `fix/guide-gp9-alignment-refs`, poussée — PR → `dev` à créer)

> **Branche** : `fix/guide-gp9-alignment-refs` (6 commits `4056745f`→`0a3c5af7`, base = `origin/dev` = merge PR #456). **Mémo** : `src/temp/memo-2026-08-13-guide-gp9-gp9b.md` (gitignorée). **Contexte** : le guide Ganymède a deux guides d'alignement partageant le préfixe `[GP9]` (Bontarien + Brâkmarien) → les refs se mélangeaient à l'import. Normalisation **GP9 = Bontarien, GP9B = Brâkmarien** + lisibilité sommaire + validation/réinitialisation par sous-guide.

- **`4056745f` fix serveur + admin God** : nouvelle action **`repairAlignmentRefs()`** (idempotente) → garantit GP9=Bontarien / GP9B=Brâkmarien quel que soit l'ordre d'import (swap si inversé + `updateMany` sur les `GuideSequence` par nom : BONTARIEN / BRÂKMARIEN / BRAKMARIEN), log `GOD_GUIDE_UPDATE`/`DATA_SYNC` · **bouton « 🔧 Réparer GP9 / GP9B »** dans le God Panel (onglet Edit, encart ambre) · **détection de conflit de guideRef à l'import** (`importSubGuide`) : si le `[GPx]` du nom est déjà pris par un autre `ganymadeId` → variant `GP9B`/`GP9C`… (fallback `GP_ID{n}`) · revalidatePaths morts `routes/progression-complete` → `/dashboard/{guildId}/quetes-dofus` (toggle/reset milestone, resetGuide, completeGuide, updateStep) · `getOptimizedGuides` sans include steps · seed : `GP9-BONTA`→`GP9` + **nouvelles séquences `GP9B` Alignement Brâkmarien** (jalon alignement chapitre 2, bornes 1→6 + jalon final) · bouton **Preview** du God Panel pointe vers la 1ʳᵉ guild active réelle (`firstGuildId`, désactivé si aucune).
- **`6cebe9ce` fix cross-refs GP9B (client)** : `listSubGuides()` appelé en parallèle côté page → `subGuideIdMap` (ganymadeId→guideRef) → les liens `guide-step-link` résolvent **GP9B** via le `guideid` numérique (priorité 1) avant la regex du nom `[GP(\d+[A-Za-z]*)]` (priorité 2).
- **`5de0b827` fix sommaire** : `.ms-title` wrap 2 lignes (`-webkit-line-clamp:2`) + badge `ms-seqs` affiche **`[GP9B]`** quand un seul sous-guide (au lieu de « 1 sous-guide ») ; tooltip `[ref] nom` par ligne.
- **`fc194f9c` feat masquage des sous-guides 100 % cochés** : `isSeqFullyDone` gagne un **fallback DB `subGuideTotals`** (totalSteps stocké) → détecte un sous-guide complet sans l'avoir chargé → masqué du sommaire (`ChapterGroup`) et de la pagination quand « Masquer les étapes validées » est actif.
- **`bc626b9c` fix réactivité sommaire** : `completedSubGuideRefs` en `useMemo` réactif sur `checkedSteps`/`refStepsByRef`/`subGuideTotals` → le sommaire masque/réaffiche immédiatement sans dépendre du chargement des étapes.
- **`0a3c5af7` feat toggle valider/reset sous-guide** : bouton de carte → **« Réinitialiser ce sous-guide »** (rouge, `RotateCcw`) quand 100 % validé, sinon « Valider ce sous-guide » · `handleResetSubGuide` décoche toutes les étapes + une seule persistance (`updateStepProgress`) + **décomplète le jalon** si le serveur répond `isCompleted:false`.

**État git (13/08)** : branche `fix/guide-gp9-alignment-refs` **poussée sur origin**, working tree propre. `origin/dev` = `42b5c4d4` (PR #456 mergée) ; `dev` local en retard (`76836f4c`). Prochaine étape : **PR `fix/guide-gp9-alignment-refs` → `dev`** + recette GP9/GP9B sur beta.

### ⚠️ Restant / à savoir
- **Branche `refonte-module-ganymede`** : 20 commits (15 session 12/08 + Phase I `2c9e4161` + vague UX `467fe0d1` + fix `de632c69` + round 2 `6ca7a6f0` + round 3 `a8137e16`) → **MERGÉE dans `origin/dev` via PR #456** (merge `42b5c4d4`, 13/08). ⚠️ `dev` local encore sur `76836f4c` → `git pull` au prochain checkout de `dev`.
- **Chantier UX guide (13/08) ✅ CORRIGÉ** (commits `eef017c4` + `730ad57a` + `1218b80e`) : tour « ? » → **« Aide »** réparé — cause racine `body.guide-fullscreen .dashboard-tour { display:none }` **retirée** de `globals.css` (l'overlay redevient visible pendant le plein écran) + le tour s'arrête **silencieusement** quand on quitte la page guide (`tour-provider.tsx`) · état « Sous-guides validés et masqués ✅ » **avec issue** (toggle « Afficher les étapes validées » toujours visible + bouton d'action directe) · **un seul toggle global** (le local par carte `hideCompletedLocal`/`sgc-hide-steps-btn` supprimé) · **tour stable** (l'étape « Valider un sous-guide » supprimée du tour — cible conditionnelle au chargement qui causait un auto-skip ; contenu fusionné dans l'étape footer ; auto-start `sigilos-tour-guide-seen-v2` = pop 1 fois à la 1ʳᵉ arrivée) · **notifs guide visibles** (SupportOrb `z-[100]` masqué sous `body.guide-fullscreen .support-orb`) · **hero responsive** (grille 2 colonnes ≤1280px, overflow/truncate carte personnage + dropdown, padding hero/HUD réduits sur petits écrans) · **bandeau uniformisé** (Signaler `guide-hud-btn` accent rouge au lieu du dégradé, Ganymède avec libellé, présence alignée — même base, accent couleur par bouton) · **bulle profil sur « J'en suis là »** (`currentIdentity` ajoutée à `SubGuideCard` → le membre courant apparaît immédiatement dans les `active` de l'étape marquée).
- **Scalabilité module guide ✅ P0+P1 (13/08, commits `100f947a` + `3dce90c9` + `f938d2ed` + `96d1f002`)** : **cache Redis 3s des agrégats** `getGuildOptimizedGuideProgress` (clé `guide:progress:{guildId}:{slug}`, invalidation sur chaque write) — plus de re-fetch de ~10k lignes à chaque page view · **rate-limit des mutations membres** (toggle 30/min, step 120/min, reset, complete, bookmark) + **validation `completedSteps`** · **WS présence sans requête DB** (identité résolue au `guide:join`, stockée sur le socket) · **rate-limit admin God** (`requireGuideWriteAccess`) · **P2 `console.error`→logger** (`f3e8cbd7`). Décisions P2 : lazy-load admin jugé non bloquant (admin-only, payload faible), `completedSteps` en JSON conservé + cache 3s (table = chantier futur si la charge le justifie).
- **⛔ Module guide GANYMEDE = CLOS jusqu'à nouvel ordre (décision 13/08)** : plus de développement sur le module guide pour l'instant (fichiers concernés listés dans `src/temp/memo-2026-08-13-guide-gp9-gp9b.md`). Branche `fix/guide-gp9-alignment-refs` poussée (`0a3c5af7..0733cf81`) et validée, **PR → `dev` en attente** (à faire quand l'utilisateur le décidera). Prochaine session = **debug hors module guide**.
- **Reste à faire (mémo `src/temp/memo-2026-08-12-refonte-ganymede-rush.md`)** : **G** portages UX croisés (recherche persistante, ContextualHelp, verrouillage prérequis Rush→Ganymède ; CoordHoverMap→Rush) · **J** finalisation (console.error → logger **FAIT** `f3e8cbd7` ; reste recette UX sur beta) · **Bonus** : facepile Rush (RushTimelineClient) temps réel.
- **Images guides en 404** (`/uploads/guides/*.webp`, `guide_*.webp`) : fichiers absents côté serveur (infra/données, pas une régression code) — vérifier `/uploads/guides/` sur le VPS / ré-importer.
- **Warning `Cannot update component (Router) while rendering OptimizedGuideClient`** : pré-existant, lié à `useSearchParams()` — correctif = composant enfant sous Suspense (option).
- **Leaflet `_leaflet_pos`** (`map-viewer.tsx`) : pré-existant, map détachée/cleanup.
- **Rush sylvestre** : nettoyage AI slop + z-index faits (12/08) ; reste portage `CoordHoverMap`, réduction boutons, temps réel partagé (phases E→H). **Ne pas fusionner les deux modules** (différenciateurs préservés). Admin/composer (`OptimizedGuideAdminClient`, `OptimizedGuideTab`, `god/dofus-guides`) : **phase 6 dédiée** (réimport à la volée déjà fonctionnel).
- Mémo à jour : `src/temp/memo-2026-08-12-refonte-ganymede-rush.md` (refonte 12/08) + **`src/temp/memo-2026-08-13-guide-gp9-gp9b.md`** (session 13/08 — alignement GP9/GP9B + bugs UX, voir section ci-dessus) + `src/temp/memo-2026-08-10-module-ganymede.md` (historique 10-12/08).

---

## 🔒 Non-négociables (résumé — toujours appliqués)

> Détail complet : `RULES.md` (conventions + sécu) et `SECURITY.md` (posture + chantiers).

1. **Auth sur chaque action** : `await auth()` ou `getUserContext(guildId)` en début de toute action.
2. **Guild isolation** : toute requête BDD filtrée par `guildId` (multi-tenant).
3. **Fail-closed, jamais fail-open** : si une vérification/API tierce échoue → REFUSER (jamais accorder l'accès par défaut).
4. **Pas de secret en dur ni de fallback** dans le code → `process.env.*` uniquement, fail-closed si absent.
5. **Comparaison de secrets en temps constant** (`timingSafeEqual` / `timingSafeEqualStr`).
6. **Validation & bornes** : Zod sur toutes les entrées ; borner les valeurs issues d'API externes (longueur, plage).
7. **Vérifier l'appartenance à la guilde** avant toute écriture multi-tenant (cible vs contexte).
8. **Pas de `console.log` en prod** → utiliser `logger` de `@/lib/logger` (auto-redaction des secrets).
9. **Rapports d'audit JAMAIS commités** (`docs/audits/`, `AUDIT_*.md`, `src/audit-*`) — centralisés dans `docs/audits/`, gardés en local, ignorés via `.gitignore`.
10. **Secrets jamais commités** (`.env*`) ni partagés dans un canal non sécurisé.

---

## 📚 Références détaillées (à lire selon le sujet)

| Fichier | Rôle |
|---------|------|
| **`CONTEXT.md`** | Ce fichier — point d'entrée |
| [`RULES.md`](./RULES.md) | Conventions de dev + règles de sécurité **non-négociables** + patterns copy-paste |
| [`SECURITY.md`](./SECURITY.md) | Posture sécurité **réelle** (mesures en place + chantiers ouverts) |
| [`docs/SECURITY_HARDENING_PLAN.md`](./docs/SECURITY_HARDENING_PLAN.md) | Plan de durcissement (quoi de fait / quoi reste) |
| [`MAINTENANCE.md`](./MAINTENANCE.md) | Infra VPS : backups, monitoring, déploiement, urgence |
| [`README.md`](./README.md) | Démarrage, stack, structure, scripts |
| [`docs/REDIS-OCR-SETUP.md`](./docs/REDIS-OCR-SETUP.md) | Infra OCR & Redis (VPS) — setup spécifique |
| [`prisma/schema.prisma`](./prisma/schema.prisma) | Schéma BDD (source de vérité des modèles) |
| [`src/temp/memo-2026-08-08-tours-admin.md`](./src/temp/memo-2026-08-08-tours-admin.md) | **Tours admin** : architecture, phases, logique intelligente (data-tour stables), maintenance |

---

## ⚙️ Règles d'interaction avec l'IA (moi, Cline ou autre)
0. **ENV DE DEV LOCAL (POSTE) = PowerShell** — le terminal local est PowerShell sur Windows, PAS `cmd.exe`. Utiliser la syntaxe PowerShell : séparateur `;` (PAS `&&`), suppression de dossier `Remove-Item -Recurse -Force` (PAS `rmdir /s /q`), variables `$`. Les commandes `npm`/`npx`/`git` restent identiques. Note : le VPS Docker utilise du bash/sh côté serveur — rester en PowerShell uniquement pour les actions sur le poste local.
1. **Ne jamais modifier** `docs/audits/`, `src/audit-*`, `AUDIT_*.md` (livrables locaux hors git).
2. **Respecter strictement** `RULES.md` (fail-closed, validation, guilde isolation, logger).
3. **Vérifier** avant tout commit : pas de secret, pas d'audit, `npm run test:run` + `npm run build` en local.
4. **Nommer les findings** avec référence (F-xx) si on parle d'audit, et pointer le fichier précis.
5. **Pousser** sur une branche, puis PR vers `dev` (pas directement sur `main`/`dev` sauf cas exceptionnel).
6. **Scripts `.ps1` de refactoring ponctuel = HORS GIT** (ex. `convert-console-to-logger.ps1`) — utilitaires de dev locaux, jamais commités ni pushés. Seuls les scripts de **build/déploiement/maintenance** légitimes sont commités (ex. `scripts/sync-assets.ps1`). Documenter l'existence des scripts ponctuels dans le CONTEXT (pas dans git).

---

## 🧭 Suivi de chantier — Session debug 13/08 (accès candidat, bouton Synchroniser, portail) — FAIT sur `fix/access-sync-portal`

> **Branche** : `fix/access-sync-portal` (base = `origin/dev` 5858a376) → PR vers `dev` (2 commits : `88c99b64` + `7d01ba61`). **Mémo** : `src/temp/memo-2026-08-13-debug-acces-candidat.md` (gitignoré). Outil diagnostic : `src/temp/diagnostic-arrivee-candidat.ts` (hors git). **Module guide CLOS — non touché.**

### 🎯 Audit « un candidat s'est-il connecté ? » — Verdict
- **Login = appartenance, PAS de rôle** (`auth.ts` signIn) : tout membre d'une guilde `guildConfig`/`allowedGuild` active obtient une session. → un candidat « Candidat » PEUT se connecter instantanément (c'est la vraie raison du « l'infra est très vif »). Le staff n'a donc pas halluciné sur la session/le portail.
- **Données protégées (fail-closed)** : `getUserContext` → `canViewDashboard` bloque sans `DASHBOARD_LOGIN`/admin/owner/mapping → `AccessDenied`, aucun module accessible.
- **⚠️ Notif d'arrivée = preuve de passage du gatekeeper** : `sendWelcomeNotifications` n'est déclenchée QUE lors de la **création du profil** (membre autorisé). Si l'embed Discord « NOUVELLE ARRIVÉE » est parti → le user était **autorisé à ce moment** (rôle mappé / admin / owner), OU source manuelle/welcome natif Discord. Preuve dispo : `AuditLog PLATFORM_ARRIVAL.newValue.roleName`.

### ✅ Fix 1 (`88c99b64`) — Bouton « Je viens de rejoindre (Synchroniser) » réellement utile
- **Bug racine** : `revalidateUserContext` invalidait le cache membre Discord (`member:{guildId}:{discordId}`) avec `session.user.id` (**UUID interne**) → `key.includes()` ne matchait jamais → rôle octroyé ignoré jusqu'au TTL 15s. Fix : `session.user.discordId` (snowflake) + `roles:{guildId}` + résolution id interne `guildConfig` pour le `profileCache`.
- `getGuildsSeparated` : type `GuildPortalItem` (`hasAccess`/`accessLabel`). **+4 tests** → 155/155.

### ✅ Fix 2 (`7d01ba61`) — UI honnête
- Portail `/dashboard` + drawer : « Rôle d'accès requis » (ambre) au lieu de « Accès Membre »/« Membre Actif » trompeurs pour un candidat.
- Page « Vérification » : l'état 429 dit désormais « API Discord temporairement saturée » (plus de faux « Synchronisation des accès en cours »).

### 🔜 Reste
- Lancer `diagnostic-arrivee-candidat.ts` sur **beta/prod** pour trancher le rôle exact du user (PLATFORM_ARRIVAL.roleName). Décision produit en attente : durcir le `signIn` par rôle (déconseillé — coût multi-guilde, données déjà protégées).

---

## 🧭 Suivi de chantier — Session 13/08 (arrivée : changelog, activités obligatoires, God changelog, tour navbar) — FAIT sur `refonte/arrivee-changelog-tour`

> **Branche** : `refonte/arrivee-changelog-tour` (base = `origin/dev` 11f1d71c) → PR vers `dev`. **4 chantiers en 3 commits** : `da72df08` (changelog user) · `97df0fff` (onboarding+tour) · `78661947` (God changelog). Contient aussi le fix CI `6a7222f1`. **Module guide GANYMEDE toujours CLOS.**

### ✅ Chantier 1 — Le changelog ne pollue plus les nouveaux
- **Cause** : `checkChangelogVisibility` affichait la dernière release à tout user dont `lastSeenChangelogId !== latest.id` → un **nouvel arrivant** (null) recevait le popup au-dessus de l'onboarding/tour. + `getLatestChangelogEntry` ne filtrait pas `isInternal` → entrées internes auto-affichées.
- **Fix** : entrées internes filtrées ; si `lastSeenChangelogId === null` → pas de popup + **markSeen silencieux** (le lien « Maj » de la sidebar reste le chemin d'accès).

### ✅ Chantier 2 — « Activités & Contenu préféré » obligatoire à l'onboarding
- Nouveau `src/lib/profile-activities.ts` (source de vérité : `PREFERRED_ACTIVITIES` + tuple `PREFERRED_ACTIVITY_IDS`).
- `UpdateProfileSchema` : `preferredActivities: z.array(z.enum(PREFERRED_ACTIVITY_IDS))` (fini les valeurs arbitraires).
- `UserContext.hasPreferredActivities` → `OnboardingWizard` **étape 3** (chips ≥1 requis) déclenchée quand `!hasPreferredActivities` (non-admin).

### ✅ Chantier 3 — Rendu changelog + God admin
- Nouveau **`ChangelogContent`** : rendu léger/sans conflit de classes prose (tableaux scrollables, code scrollable, images bornées, callouts sobres) — remplace `DocContent` overridé dans la modale user.
- **God panel réécrit** (-101 lignes) : éditeur en **modale** (plus de panneaux resizables), cartes de liste claires (catégorie/version/date/badge Interne), actions distinctes **Publier Hub** vs **Diffuser à toutes les guildes**, aperçu via `ChangelogContent`.

### ✅ Chantier 4 — Tour d'arrivée : navbar finale
- `DASHBOARD_STEPS` : suppression de l'étape « Missions de guilde » + **carte finale « Tous vos modules »** ciblant `[data-tour="sidebar-root"]` (posé sur le conteneur sidebar). « Pas d'AI slop » : description sobre.

### 🔒 Fix CI (branch `fix/ci-ghcr-rate-limit`, hotfix autonome)
- **Échec** : push `sigilos-worker-beta` → **403 secondary rate limit GHCR** (burst push+cache registry `mode=max` ×4 images). Fix : **retry+backoff** (3 tentatives 60/120s) + `sleep 10` entre images + `timeout-minutes` 45. Inclus aussi dans `refonte/arrivee-changelog-tour`.

### ✅ Vérifs
tsc 0 · lint 0 erreur · **test:run 155/155** · build exit 0.

---

## 🧭 Suivi de chantier courant (Évol 4 — God evolutions)

> **Source de vérité par tâche** : `src/temp/evolution4.md` (gitignoré, à relire en PRIORITÉ à chaque reprise).
> Mode de travail : **un prompt par tâche** — lire le suivi + CONTEXT.md, pas tout le code.

**Branche** : `evo4-god-evolutions` → PR vers `dev`. **État** : R1 + R2 + R3 terminés (R3 FAIT confirmé en beta le 06/08).

- ✅ **R1** — Lectures God granuleuses par scope (`canGodAccess`) + redirect tab fail-closed + refonte `god/page.tsx` par tab. FAIT.
- ✅ **R2** — Tuto God interactif (`god-access-banner.tsx` → client + localStorage + bouton « Revoir »). FAIT.
- ✅ **R3 — FAIT (06/08)** — Anti-scout : secret route `GOD_ROUTE`, noindex + `X-Robots-Tag`, rate-limit + IP allowlist désactivable, fuite `/god/dofus-guides` retirée, F-SEC-1 corrigé.
  - ✅ **Confirmation beta** : admin connecté → panel `/god` affiche (200) ; non-connecté → 404 ; `/mng-FAKE` → 404.
  - ✅ **Deux causes du 404 admin connecté corrigées** :
    1. **Edge runtime** : `src/middleware.ts` (Next 16) forçait Edge → env inlinés au build (GOD_ROUTE/AUTH_SECRET invisibles au runtime). **Fix** : `middleware.ts` → **`src/proxy.ts`** (convention Proxy = Node runtime, `process.env` lu au runtime). Commit `f50ecdfc`.
    2. **Décodage session dans le proxy** : `req.auth` (providers vides) ne décodait pas le cookie JWT → `hasAuth:false` même connecté → garde `/god` sans session → 404. **Fix** : `getToken` de `next-auth/jwt` (`fa8fb7de`) + forcer `cookieName`/`secureCookie` pour lire le même cookie que le serveur (`963e7c07`).
  - ✅ **Rate-limit final (`d7cc8389`)** : 120 req/min sur routes God **légitimes** (plus de 429 sur `/mng-<secret>?tab=...`), 10 req/min sur **mauvais secrets** (anti-brute-force).
  - ✅ Vérifs : `test:run` 97 ✅, `tsc --noEmit` 0 ✅, `lint` 0 ✅, `build` 62 pages ✅.
  - ⚠️ **Secret réel fuité dans l'historique git → à ROTATER** (nouvelle `GOD_ROUTE` sur beta + prod, `.env`). Procédure dans `src/temp/evolution4.md`.
- ✅ **R4 FAIT (06/08)** — Session God + révocation live complète : schema Prisma (scopeVersion + GodAccessLog/GodSessionLog), revokeDelegate bump scopeVersion + audit, **révocation LIVE socket/SSE** (Redis pub/sub `god:revoked` → WS room `user:<userId>` → popup + redirect via `GodExpiryGuard`), **session active `GodSessionLog`** (open/heartbeat/close dans le layout via `god-session-tracker`). Fail-closed si socket down (polling + garde serveur).
- ✅ **R5** — Logging exhaustif God : `GOD_DASHBOARD_ACCESS` ajouté + remplacé le no-op `logPageAccess` dans le layout par `createGodAuditLog`.
- ✅ **PILIER D (PIM granulaire) FAIT + durci (06/08)** — Table `GodAccessGrant` + guard `canAccessBrick` (fail-closed, **fix double OR** qui laissait passer les grants expirés) + grant/revoke JIT (durée, justification obligatoire) + UI `/god/delegates` + warn anti-scout. **Ajouts 06/08 → commits `2f3dc878`, `028bac21`, `eb3ff2a8`, `31832de5`, `a1e9e593`** :
  - **PIM réellement fonctionnel** : registre centralisé `god-bricks.ts` (`subGodAccess` fail-closed), `getAccessibleBricks()`, sidebar/layout filtrent par brique, matrice sous-god stricte (test-debug) — ses pages interdites (overview/telemetry/infra/notifications/mini-games/security/bugs/roadmap/changelog/onboarding/delegates) jamais visibles d'un sous-god, guildes en whitelist seule (ReadOnly), pages d'atterrissage via `resolveGodLanding` tenant compte des briques.
  - **Traçage God exhaustif** : helper `logGodWrite` + nouvelles actions Audit (`GOD_GUIDE_UPDATE`, `GOD_RUSH_UPDATE`, `GOD_QUEST_DATA_UPDATE`, `GOD_GAME_DATA_UPDATE`, `GOD_TICKET_ACTION`, `GOD_DOC_UPDATE`) posées sur toutes les écritures guides/rush/quetes/game-data/tickets/docs — log UNIQUEMENT sous-god (pas de doublon admin).
  - **Édition en place des droits** : `syncBrickAccessForDelegate()` (diff atomique : crée/révoque/prolonge, bump scopeVersion, audit) + `EditAccessManager.tsx`. Plus de « révoquer + recréer ».
  - **UX sous-god** : `getMyActiveGrants()` → vue **« Mon accès »** dans le bandeau (remplace le lien mort `/god/delegates`) avec temps restant par brique ; **`GodExpiryGuard`** : badge permanent « Expire : X », popup <10 min, **déconnexion forcée** quand tous les accès expirent (fail-closed UI).
  - **Refonte `/god/delegates`** : stepper 3 étapes (Délégué → Scopes & Briques → Durée & Validation), délégué créable vierge, scopes exploitables restreints, durée flexible (min/heures/jours), historique isolé dans `AccessHistory`.
  - **`.next` corrompu** supprimé/régénéré → tsc OK ; **110 tests** ✅.
- ⚠️ **Navigation** : Sous-Gods pointe vers la route dédiée `/god/delegates` (plus `?tab=delegates`).
- ✅ **F-SEC-1** — Corrigé (invite Discord `permissions=8` → `DISCORD_BOT_INVITE_URL` + toggle).
- 🧹 **À faire Évol 4 restant** : déployer PR #405 (rate-limit) beta ; **rotation `GOD_ROUTE`** (secret fuité) — modifier `.env` + `docker compose up -d` ; volume `GOD_DASHBOARD_ACCESS` (loggé à chaque rendu) ; B3-B5 (refonte overview, primitives, animations) ; A4 purge/ménage ; évolutions 2/3 (fuite `user.name` ~90 fichiers, etc.).

**Checkpoint Évol 4** : `npm run test:run` (110 tests) ✅ + `npm run build` (62 pages) ✅ + `npx tsc --noEmit` ✅ + ESLint 0 ✅.

---

## 🧭 Suivi de chantier courant (Tickets & Whitelist) — FAIT le 07/08/2026

> **Branche** : `fix/ticket-whitelist-2bugs` → PR vers `dev` (lien : `https://github.com/Klyx04/SigilOS/pull/new/fix/ticket-whitelist-2bugs`).

- **Contexte** : corrige `src/temp/refonte-ticket-whilist.md` + `src/temp/test-debug`. Le rapport d'audit IA contenait **1 invention** (autoriser les admins de guilde ordinaires à fermer les tickets) → **refusé**, conforme à la demande de base : seul le **God super-admin ou un sous-god via PIM** peut fermer/whitelister.
- ✅ **Commit `34e15126` — Bugs 1 & 2 corrigés** :
  - **Bug 1 (fermer le ticket)** : `closeSupportTicket` passe à `requireTicketAdmin()` (super-admin OU sous-god PIM brique `tickets`) ; **vérification du retour d'`archiveThread`** (échec d'archivage → erreur honnête, plus de `success:true` mensonger) ; nouveau helper Discord `editInteractionMessage` (follow-up) ; handler `ticket:close` → ACK `type:6` + follow-up éphemère (succès/erreur visible). Plus de fire-and-forget silencieux.
  - **Bug 2 (whitelist)** : rôle ajouté sur la **guilde cible** (`discordGuildId`=`targetGuildId`) + rôle auto `ticketAutoRoleId` sur serveur Support (rétro-compat) ; helper `notifyGuildAccessApproved` avec **fallback fiable** (threadId → `serviceStatusChannelId` → `godNotifyChannelId` → log) ; `addAllowedGuild`/`toggleGuildActive` accessibles aux **sous-gods PIM scope `guilds`** (fail-closed sinon) ; whitelist manuelle God → notif client si ticket ACCESS_REQUEST ouvert.
  - **Faiblesses connexes** : `getSupportTickets`/`getSupportTicketById`/`updateTicketStatus`/`getTicketStats`/`getSupportGuildRoles` → `requireTicketAdmin()` (dashboard God utilisable par sous-god PIM tickets) ; `sendTicketReply` retourne `statusChanged` ; `console.*` → `logger.*` ; `getAppBaseUrl()` partout (URLs beta/prod dynamiques, plus de `sigilos.fr` en dur dans `discord.ts`).
- ✅ **Commit `9c66f26f` — Refonte UI dashboard tickets** (`ticket-dashboard.tsx`) : stats avec icônes, toolbar unifiée, table hiérarchisée (avatars, chips colorées), panel Discord/Guard en grille ; **modale 2 panneaux** (gauche : auteur/détails/description/décision d'accès ; droite : fil de discussion + réponse directe + footer), bouton retour, messages honnêtes sur les actions.
- **Vérifs** : `tsc --noEmit` 0 ✅, `lint` 0 erreur ✅, `test:run` **110 tests** ✅, `build` 62 pages ✅, pre-commit (secrets ✅, Prisma inchangé ✅).
- **Aucune migration Prisma** (aucun champ BDD ajouté).
- 🔜 **Prochain chantier (préparé)** : onboarding/guide admin post-whitelist — voir `src/temp/prompt-next-chantier.md`.

---

## 🧭 Suivi de chantier courant (Onboarding admin post-whitelist + Dashboard d'arrivée) — FAIT le 08/08/2026

> **Branche** : `feat/onboarding-admin-tour` → PR vers `dev` (lien : `https://github.com/Klyx04/SigilOS/pull/new/feat/onboarding-admin-tour`).
> Source : `src/temp/prompt-next-chantier.md` + rapport `refonte-ticket-whilist.md` (Bugs 3-6 + Feature 5) + `test-debug`. Mémo : `src/temp/memo-2026-08-08-onboarding-admin.md`.

- ✅ **Commit `77cff012` — TÂCHE 1 (Bug 4)** : `isOnboardingComplete = isRbacConfigured && !!guildConfig?.dofusServerId` (`user-actions.ts`). La navbar admin est désormais grisée **au backend** (toutes les perms membres forcées à false) tant que serveur de jeu + rôles & permissions ne sont pas configurés. Pas de blocage en boucle (admin garde settings/permissions + getting-started). Réponse « logique cohérente pour une arrivée » : OUI.
- ✅ **Commit `6f7ea8cc` — TÂCHE 2 (Bug 3)** : disparition du flash « page erreur système » (~1s) au déploiement. Cause = cache Redis `guild_allowed:{id}` (TTL 60s) jamais invalidé. Nouveau helper `invalidateAllowedGuildCache` appelé dans `addAllowedGuild`, `removeAllowedGuild`, `toggleGuildActive` et `onboardGuild` (création + réactivation).
- ✅ **Commit `0f0c08ad` — TÂCHE 3 (Bug 6)** : `DEFAULT_MODULES` → **seul `admin: true`** par défaut (tout le reste `false`). Step « modules » de `getting-started` = COMPLETED seulement si une vraie config BDD existe (≥ 1 module actif), plus jamais via le fallback `> 4`. Code mort dupliqué de `module-actions.ts` supprimé. **Aucun backfill** : guildes existantes avec une ligne `GuildModules` conservent leurs valeurs (défauts BDD `@default(true)`).
- ✅ **Commit `1c9230f9` — TÂCHE 4 (Feature 5)** : **tuto tour admin dynamique par cartes**, rejouable, filtré par RBAC. Phase `"admin"` du `TourProvider` (réutilisé) + 6 cartes calquées sur getting-started, filtrées par `requiresPerm` (perm RBAC admin) et `module`. Bouton « Revoir le tour » (`admin-tour-replay.tsx` + `data-tour` par étape) ; `layout.tsx` passe `user` au provider.
- ✅ **Commit `7ffc695a` — TÂCHE 4 REFONTE (retour beta)** : le tour admin était un copier-coller du tour membre et ne se lançait pas. Refonte :
  - **Auto-déclenchement au 1er chargement d'un admin**, sans dépendre d'une query `?tour=` (useEffect sur `sigilos-tour-admin-done-{guildId}`).
  - **Deux volets filtrés RBAC + module actif** : `admin` (onboarding : Serveur de Jeu, Rôles & Permissions, Lier le Bot, Modules) pour guilde en cours de config ; `adminModules` (Missions, Songes, Ocre, Ladder, Services, Calendrier, Sondages → briques de la sidebar) pour **guilde déjà configurée**.
  - `tour-completion.tsx` : **écran de fin dédié admin** (CTA « Ouvrir le Centre Admin » + « Revoir la mise en route ») au lieu de « Voir les Missions » membre.
  - `app-sidebar.tsx` : `tourKey` ajouté sur Missions/Ladder/Quêtes/Ocre, Songes/Donjons/Services, Mini-Jeux/Sondages → `data-tour="sidebar-*"` pour le spotlight.
  - `tour-overlay.tsx` : gère la phase `adminModules` (bouton « Terminer »).
- ✅ **Commit `c2b74028` — Correctifs logique tour admin** : `completeTour` ne nulle plus `tourPhase` (sinon TourCompletion perdait le CTA admin vs membre) ; mémorisation **distinguée** admin (`sigilos-tour-admin-done`) vs membre (`sigilos-tour-done`).
- **Vérifs** : `tsc --noEmit` 0 ✅ · `lint` 0 erreur (warnings pré-existants) ✅ · `test:run` **110 tests** ✅ · `build` 62 pages ✅ · pre-commit (secrets ✅, Prisma inchangé ✅).
- **Aucune migration Prisma.**
- 🔜 **À tester en beta** : pop auto du tour admin à l'arrivée (guilde neuve → onboarding ; guilde déjà configurée → modules/briques), écran de fin admin (« Centre Admin »), filtres RBAC (carte masquée si pas la perm), rejouabilité via « Revoir », disparition du flash déploiement. Rappel : `.next` corrompu → `Remove-Item -Recurse -Force .next` puis relancer `npm run dev`.
- 🔜 **Guilde de test locale** : `1290442961380835451` whitelistée active + onboarding remis à zéro (dofusServerId null, RBAC vide, modules BDD supprimés) pour tester l'arrivée.
- ♻️ **RESET guilde locale à la volée** : `npx tsx src/temp/reset-guild-test.ts` (gitignoré) → remet l'état « arrivée » (navbar grisée + tour admin) tout en gardant la whitelist active. Procédure détaillée dans `src/temp/memo-2026-08-08-onboarding-admin.md`.

---

## 🧭 Suivi de chantier courant (Tours admin rejouables) — FAIT le 08/08/2026

> **Branche** : `feat/onboarding-admin-tour` → PR vers `dev`.
> **Mémo** : `src/temp/memo-2026-08-08-tours-admin.md` (à relire en priorité pour toute modif des tours).

- ✅ **CI débloqué** : `npm audit --audit-level=high` → **0 vulnérabilités**. Overrides `nanoid ^3.3.17` (GHSA-2v37-7h3g-55p8) + `dompurify ^3.4.13` (GHSA-55q2-fjhq-7xh7). Commit `2a35ab8a`.
- ✅ **Tutos admin rejouables par module** (commits `14ab569a`) : phases `adminSettings/Permissions/ModulesMgmt/Presentation/Missions/Validation/Members/Logs`, auto-start Dashboard une fois, rejouable à tout moment, filtrage RBAC.
- ✅ **Tour briques `/admin`** (`6bbd4ce9`) : phase `adminOverview` (chaque carte du Centre Admin) + `tourId` stable sur `AdminCard` + bouton « Fermer » (reste sur la page) + `AdminTourReplay` par `phase`.
- ✅ **Enrichi + mémo** (`2aa8ac32`) : descriptions complètes (Paramètres/Missions/Validation), mémo architecture/maintenance créée.
- ⚠️ **À vérifier** : build Next.js complet (étape Verify and build) — l'audit est corrigé mais les tours ajoutés doivent compiler.

---

## 🧭 Ménage des branches (nettoyage) — FAIT le 08/08/2026

- ✅ **Constat** : aucune branche ne portait de travail perdu. Les fixes `test-dependabot` (esbuild/deps) et `ticket-whitelist` étaient déjà intégrés à `dev`. Le vieux commit `fix/robots-beta-indexable` (CI/CD GHCR, 03/08) était entièrement couvert par l'infra CD déjà présente et plus à jour dans `dev`/branche courante.
- ✅ **Branche de travail** : `feat/onboarding-admin-tour` = la plus à jour, contient `dev` + les 13 commits de la session (fix audit + tours admin).
- ✅ **Supprimées (local + GitHub)** : `evo3-god-security-fixes`, `evo4-god-evolutions`, `feat/audit-and-dofus-enhancements`, `feat/channel-preview-admin`, `feat/god-notif-performedBy`, `feat/rush-position-preview`, `feat/rush-sylvestre-refactor`, `feat/security-post-audit`, `feature/feedback-dofus`, `feature/service-dialogue-et-rendu`, `fix/landing-clarification-and-audit`, `fix/robots-beta-indexable`, `fix/sitemap-base-url`, `fix/ticket-whitelist-2bugs`, `test-dependabot`.
- ✅ **Restent** : `main`, `dev`, `feat/onboarding-admin-tour` (local + remote).

---

## 🧭 Suivi de chantier courant (Session 08/08 — corrections en cours, branche fix/tour-admin-first-admin)

> **Branche** : `fix/tour-admin-first-admin` → PR vers `dev`.

### ✅ Ladder Discord — cause racine corrigée (`fix/ladder-discord-stats`)
- **Cause** : `docker-compose.prod.yml` reconstruisait la `DATABASE_URL` du bot → `ERR_INVALID_URL` → aucun compteur écrit. Fix : override supprimé (prod+beta), fail-fast URL dans le bot, log `count=0`, reset scopé par guilde, filtre Discord limité à Vocal/Messages/Stream. Voir `memo-2026-08-08-ladder-discord.md`.

### ✅ Tour admin auto-start — 1er admin uniquement (commits sur la branche courante)
- Champ `firstAdminViewAt` sur `GuildConfig` (migration `20260808120000_add_first_admin_view_at`) + calcul atomique `isFirstAdminForGuild` dans `user-actions.ts`.
- `tour-provider.tsx` : auto-start `adminModules` restreint à `isFirstAdminForGuild && !isSuperAdmin` (God jamais concerné).
- `tour-overlay.tsx` : anti-centrage (skip d'une étape si `data-tour` introuvable après ~2s).

### ✅ Fonctionnalité présence — flag AFK 15 min
- `getActivePresence` : seuil d'inactivité 2 min → **15 min**, chaque membre retourné porte `isAfk`.
- Facepile / Heartbeat / Modal : prise en compte du flag AFK.

### 🪧 Autres modifs poussées sur la branche
- Web parallèles (guide quêtes, mentions légales, footer, support orb, worldmap, profil, gallery).
- Worldmap : `sync-assets.ps1`, workflow `siphon-worldmap.md`, données `worldmap.json`/`worlds.json`, `siphon-brigandins.js`.

## 🧭 Suivi de chantier courant (Ladder Discord) — cause racine corrigée le 08/08/2026

> **Branche recommandée** : `fix/ladder-discord-stats` → PR vers `dev`. Mémo : `src/temp/memo-2026-08-08-ladder-discord.md`. Prompt prêt à coller : `src/temp/prompt-next-chantier-ladder-discord.md`.

- **Problème** : filtres/classements Ladder Discord vides (messages/vocal/caractères) dans le Dashboard.
- ✅ **Cause racine confirmée (08/08)** : le bot échouait à TOUTE écriture BDD avec `ERR_INVALID_URL`
  (`docker logs sigilos-discord-bot-beta`). Cause = override `DATABASE_URL` reconstruit dans
  `docker-compose.prod.yml` (L153 prod / L274 beta) → variable `${POSTGRES_*}` absente ou caractère
  spécial → URL invalide. L'app chargeait sa vraie `DATABASE_URL` via `env_file` → seul le bot était cassé.
- ✅ **Fix appliqué** :
  1. `docker-compose.prod.yml` : override `DATABASE_URL` reconstruit **supprimé** (prod + beta) → le bot
     prend la `DATABASE_URL` canonique du `.env` via `env_file`.
  2. `services/discord-bot/index.ts` : **fail-fast** sur `DATABASE_URL` (validation `new URL()` au démarrage).
  3. `services/discord-bot/index.ts` : **log `count=0`** dans `updateDiscordActivity` (plus d'échec silencieux).
  4. `services/discord-bot/index.ts` : **reset hebdo/mensuel scopé par guilde** (guildes du bot via
     `client.guilds.cache`) — respecte la guild isolation.
- ✅ **Vérifié** : `cd services/discord-bot && npm run build` (tsc) ✅.
- ⚠️ **À faire** : redéployer (build image bot GHCR/CD puis `./scripts/deploy-cd.sh beta`), confirmer les
  logs `tracked`, tester manuellement (6 métriques × 3 périodes), et si compteurs nuls pour certains membres
  → investiguer SUSPECT A (matching `user.accounts` : champ `discordId` via migration Prisma OU upsert
  fallback scopé par `guildId`).

## 🧭 Suivi de chantier courant (Refonte profil « rendu pro ») — FAIT & MERGÉ le 09/08/2026

> **Branche** : `fix/tour-admin-first-admin` → PRs vers `dev` (PR #417 + #418 mergées). **Commit final : `c9f7b58e`**.
> Source : retour de session — refonte de l'affichage du profil pour un rendu plus pro.

- ✅ **Refonte profil « rendu pro »** (`c9f7b58e`, 26 fichiers, +1505/-298) : hero-header, bento-grid, onglets (Activité & Feed, Quêtes Dofus, Services), présentation, avatars/badges, migration Prisma `20260808140000_add_profile_presentation_fields` (objectifs, preferredActivities, discordContact).
- ✅ **Migration Prisma** `prisma/migrations/20260808140000_add_profile_presentation_fields` + champs cohérents dans `prisma/schema.prisma`.
- ✅ **Nouveaux composants profil** : `presentation-card.tsx`, `profile-activity-tab.tsx`, `profile-dofus-tab.tsx`, `profile-services-tab.tsx`.

### ✅ Tuto d'arrivée (« tour membre ») non cassé
- La refonte du profil conserve tous les `data-tour` du parcours d'arrivée (`profile-header`, `profile-class`, `profile-tab-metiers/planning/combat/intro/settings`) → les nouveaux onglets respectent les ancrages, aucune étape du tuto ne pointe vers un élément disparu.

### ✅ Bug modale « Revoir le tour » corrigé (dashboard)
- **Avant** : le bouton « Revoir le tour » lançait `adminModules` (tour de la **sidebar**), et la modale de fin affichait les CTA **membre** (« Voir les Missions » / « Voir mon Profil ») — incohérent pour un admin.
- **Après** : nouvelle phase **`dashboardBricks`** (`tour-provider.tsx`) qui visite les **widgets de la page d'accueil** (stats, événements, sondages, groupes, galerie, almanax, activité) avec des bulles explicatives. La modale affiche « Fermer ». Le bouton lance `dashboardBricks`. Le `tour-overlay` gère le skip des widgets absents (anti-centrage existant).
- Fichiers : `src/components/tour/dashboard-admin-tour-button.tsx`, `tour-provider.tsx`, `tour-completion.tsx`, `tour-overlay.tsx`, `src/app/dashboard/[guildId]/page.tsx` (data-tour `dash-*`).

### ✅ Images services dans l'onglet « Services Proposés » du profil
- **Avant** : image pleine largeur trop grosse, pas d'icônes.
- **Après** : **miniature** (`h-12 w-12`, comme le module services) + **icônes métiers** (FM/Métiers) et **classes** (Tutorat) via `getJob`/`getClass`. Métiers supplémentaires en petites icônes empilées. Prix ajusté au format `string` réel du schéma.
- `src/server/actions/profile-actions.ts` : mappings `activeServices` enrichis (professions, dungeonName, dungeonImageUrl, dofusItemIconUrl, dofusItemName) dans `getUserProfile` ET `getMemberProfile`.

### 🪧 VPS / git — notes utiles
- **Alias SSH poste** : `ssh myvps` (gère port 2222 + user) — utilisé pour `scp myvps:...`.
- **Clé SSH VPS en lecture seule** : `git push` impossible depuis le VPS (le commit worldmap a été fait là-bas mais pas pushé). **Travail worldmap/worlds déjà sécurisé** : commités dans git (`1e40bdd9`) + tuiles gitignorées + bind mount VPS.
- `git update-index --skip-worktree` utilisé sur les assets `game-data` du VPS pour débloquer le `git pull` (assets restent intacts via bind mount). Si de nouveaux assets apparaissent → rejouer la commande de marquage.
- **Vérifié** : toute la branche `fix/tour-admin-first-admin` est poussée (working tree clean, up to date).

---

## 🧭 Suivi de chantier courant (CSP nonce-based) — DÉPLOYÉ le 09/08/2026 + WS auth activée en beta

> **Branche** : `feat/csp-nonce-based` → PR vers `dev` (lien : `https://github.com/Klyx04/SigilOS/pull/new/feat/csp-nonce-based`). **Commit : `918fa308`**.
> **Mémo** : `src/temp/memo-2026-08-09-csp-nonce.md` (gitignoré).

- ✅ **`src/lib/csp.ts`** : module descriptif pur — `generateCspNonce()` (randomBytes base64url), `buildCsp({ nonce, enforce })` (script-src **sans `'unsafe-inline'`** + nonce, style-src conservé, img/connect/font/frame conservés, `report-uri /api/csp-report` + `report-to csp-endpoint`). Mode : `CSP_ENFORCE=true` → enforce, sinon report-only.
- ✅ **`src/proxy.ts`** : génère le nonce **par requête** (Node runtime), l'injecte dans la **requête** (Next la consomme via `getScriptNonceFromHeader`) + dans la **réponse** (navigateur) + pose `x-nonce` pour les JSON-LD (F-28). Ajoute `/api/csp-report` aux routes publiques (rate-limit IP).
- ✅ **`next.config.ts`** : **CSP statique retirée** (conflit avec une CSP partielle) — les autres security headers (`X-Frame-Options`, HSTS, etc.) conservés.
- ✅ **`src/app/api/csp-report/route.ts`** : endpoint de rapport — validation **Zod**, borne taille 64 Ko → 413, rate-limit IP 60/min → 429, log `logger` (jamais console), retour 204.
- ✅ **`tests/security/csp.test.ts`** : **16 tests** (pas d'unsafe-inline, présence nonce, mode report/enforce, unsafe-eval dev-only, conservation Sentry/WS/fonts/img CDNs).
- ✅ **Vérifs** : `test:run` 126/126 ✅ · `tsc --noEmit` 0 ✅ · lint 0 erreur ✅ · pre-commit (secrets, Prisma, lint, tsc) ✅.
- ✅ **Déployé sur beta** : CSP Report-Only active (sans blocage), endpoint `/api/csp-report` recevant les violations.
- ✅ **`WS_AUTH_ENABLED=true` activé sur beta PUIS PROD (09/08)** : l'auth WebSocket (F-08) — décodage session + appartenance guilde — est active sur les deux environnements (`.env.beta` + `.env.prod`). **Reste** : tester reconnexion/temps réel (présence, rush, sondages, révocation God) sur beta. ✅ **Fait le 10/08** : reconnexion / temps réel WS testé sur beta.
- 🔜 **À faire** : ~~confirmer aucune violation bloquante~~ puis `CSP_ENFORCE=true` sur beta → prod. ✅ **Fait le 10/08** : `CSP_ENFORCE=true` activé sur **beta PUIS prod**.
- ✅ **CSP_ENFORCE activé sur BETA (09/08)** : `CSP_ENFORCE=true` dans `.env.beta`, header `content-security-policy` (enforce) servi avec nonce, **0 violation** collectée. (Prod plus tard.)

---

## 🧭 Suivi de chantier courant (Session hardening 09/08) — branche `feat/security-hardening-suite`

> Branch : `feat/security-hardening-suite` (poussée). Merge partiel dans `dev` via PR #424 (Zero Console + I-15 + I-07 + I-06). **Non encore mergés** : retrait overlay vocal (`96df9806`) + chantier God UX (9 commits) + **session 09/08** (A4 purge `ba7e2cf7`, B3-B5 `ca11584d`/`0757308f`/`db9a4e47`, nav God géoguesser/firewall `9f012166`/`0888a927`).

### 🔒 Chantiers sécurité terminés (09/08)
- ✅ **CSP_ENFORCE beta** : activé + vérifié (enforce, nonce, 0 violation).
- ✅ **I-15 Circuit breaker** (`7efd4bf9`) : module `src/lib/circuit-breaker.ts` (closed/open/half-open, incrément sur échec/reset sur succès) + branchement metamob + 11 tests.
- ✅ **I-07 Redis séparé** (`de97fb3d`) : service `redis-beta` (beta-net, `REDIS_PASSWORD_BETA`), prod restreint à `prod-net`. **Déployé beta** (containers redis-beta + beta relancés, PING_OK).
- ✅ **I-06 Unifier Discord** (`5e4921aa`) : le bot = **unique Gateway** (plus de double login 4004/4096), état voix via Redis pub/sub. **Déployé beta**. ⚠️ **Puis `96df9806`** : retrait de la feature overlay vocal (poids mort) — les overlays ont été supprimés des jeux, `use-discord-voice`/`DiscordVoiceOverlay` retirés, publication voix bot retirée (Ladder Discord vocal/stream/message **conservé**).
- ✅ **WS auth F-08 testé en réel** : présence live, 0 unauthorized, révocation God live (popup + redirect).
- ✅ **Ladder Discord** : fix déployé + compteurs `tracked` vérifiés (vocal/stream/message).

### 🎨 Chantier God UX (nouveau, issu du test beta) — sur la branche, **PAS encore mergé**
- `4ae63f56` garde anti-expiration (décompte réel, 1 popup, redirection forcée) · `7963fc1e` grants dans la carte du délégué · `59dbdfc0` « Modifier l'accès » en **modale** + stepper supprimé · `e2a4ec16` « Mon accès » toujours visible en **h/m/s temps réel** + badge bas-gauche retiré · `10cf55ab` bouton cliquable + justification optionnelle + modale auto à la création · `fca362e1` briques groupées par scope · `fdffe6d5` **live refresh `god:access-changed`** (briques apparaissent/disparaissent sans logout) · `caef4453` anti-doublon délégué actif. + `5177c7c5` fix `Dockerfile.caddy` (`USER 1000:1000`).
- ➡️ Nécessite **PR → merge → `deploy-cd.sh beta`** (rebuild bot/ws) pour être visible sur beta.

### 🛠️ Infra VPS réglée (09/08)
- ✅ **F-14 Caddy rate-limit** : image custom `sigilos-caddy:latest` (plugin `rate_limit`) buildée + gateway recréé (fix `USER caddy` → `USER 1000:1000` + chown volumes caddy_data/config). Module `http.handlers.rate_limit` confirmé. Limite 300 req/min + burst 60/s par IP.
- ✅ **`app-prod` unhealthy réparé** : cause = mot de passe DB avec caractères spéciaux (`#`,`!`) non encodés dans `DATABASE_URL` → `ERR_INVALID_URL`. Encodé (`%23`,`%21`). **+ rotation du mot de passe Postgres prod** (fuite dans les logs de session, nouveau mdp hex URL-safe).


## 🧭 Suivi de chantier courant (Déploiement pro + TUTOS PARTOUT) — FAIT sur branche, PR → dev (10/08/2026)

> **Branche** : `feat/deploy-clean-pro` → PR vers `dev` (lien : `https://github.com/Klyx04/SigilOS/pull/new/feat/deploy-clean-pro`).
> **Mémo** : `src/temp/memo-2026-08-10-deploy-tours.md` (gitignoré). Source : Évol 3 restant (« tutos partout ») + nettoyage déploiement.

### ✅ Déploiement « produit pro » (refonte de la sortie)
- `scripts/deploy-cd.sh` **v4** : sortie lisible (bannière, récapitulatif pré-vol, 5 étapes numérotées), pulls d'images résumés en tableau (`✓ déjà à jour` / `✓ téléchargée` / `✗ ÉCHEC`), `--help`, `list beta|prod`, `git pull` non bloquant avec détection des fichiers locaux, résumé final + santé + rollback.
- `scripts/migrate-uploads.mjs` : **silencieux** par défaut (résumé) — plus de mur de `.webp` (détail via `MIGRATE_UPLOADS_VERBOSE=1`).
- `scripts/deploy.sh` : aligné sur le même style (helpers `info/ok/warn`).
- **Fix `SEED_ALWAYS`** (`191ec50f`) : variable non définie sous `set -u` → `${SEED_ALWAYS:-0}` (l'ÉTAPE 5 seed plantait sinon).

### ✅ TUTOS PARTOUT (Évol 3 restant) — rejouable sur CHAQUE module
- `ModuleTourReplayButton` générique (prop `phase`), visible admin + membres, injecté dans les `UnifiedModuleHeader` de tous les modules.
- `TourPhase` étendue (16 phases modules) + helper `isReplayableTourPhase` (rejouable, jamais de flag `done` définitif).
- **3 lots** : Lot 1 (Missions/Ladder/Songes/Ocre), Lot 2 (Services/Donjons/Calendrier/Sondages/Annuaire), Lot 3 (Quêtes Dofus/Galerie/Ressources/Mini-jeux/Stats/Présentation). Chaque module : `<X>_STEPS` (5-12 étapes réelles), `data-tour` stables, filtrage `module` + `requiresPerm` (RBAC), routage `startTour`, écran de fin « Fermer ».
- Ancres `data-tour` posées sur les pages + composants clients (headers, boards, tabs, grids, search, create…).

### ✅ Correctifs tours
- **Fermeture immédiate des tours modules** : garde dans l'`useEffect` d'auto-start (ne pas fermer un tour rejouable via le flag `sigilos-tour-done`).
- **Tour profil** réécrit sur les vrais onglets (overview/metiers/planning/combat/dofus/activity/settings) ; retrait « Présente-toi » ; `DASHBOARD_STEPS` réduit (retrait Accueil/Annuaire/Calendrier) ; CTA membre → « Fermer ».
- **Bouton « Tutoriel »** (ⓘ ?) **orange** partout à la place de « Revoir le tour ».
- **Dernière étape = rappel navbar/sidebar** : `tourKey` ajoutés (annuaire/calendar/ressources/galerie/la-guilde) + étape « Où le retrouver » en fin de chaque tour + ouverture de la bonne section sidebar.

### 🔜 À faire (en attente de merge / prod)
- **Merger la PR `feat/deploy-clean-pro` → `dev`** ✅ **MERGÉE + DÉPLOYÉE (10/08)** (build beta avec le script corrigé).
- (sécurité) CSP prod + reconnexion WS : ✅ **FAIT (10/08)**.

---

## 🧭 Suivi de chantier courant (Login & Whitelist + Rate-limit 429) — FAIT, push le 10/08/2026

> **Branche** : `feat/deploy-clean-pro` · **Commits** : `53269602` (login) + `b4d6fb4a` (rate-limit). Push sur `origin/feat/deploy-clean-pro`.

### ✅ Login & Whitelist (accès dashboard immédiat + observabilité God)
- **Problème** : candidats qui, après avoir reçu un rôle Discord autorisé, devaient vider cache / incognito / attendre pour se logger ; rien de visible côté God.
- **Causes** : blocage `signIn` si l'API `@me/guilds` est KO/en retard (pas de fallback BDD) ; caches rôle/membre (`fetchGuildMember`/`fetchGuildRoles`) 60 s (404 15 s) ; atterrissage sur la landing `/` sans porte d'entrée pour un nouveau membre ; refus de connexion non tracés.
- **Fix** (`53269602`) :
  - `src/lib/access-attempt.ts` (nouveau) : `logAccessAttempt()` + `hasActiveProfileInManagedGuild()` (fail-open ciblé).
  - `src/auth.ts` : sign-in résilient — si API Discord KO/en retard, autorise un membre ACTIVE connu d'une guilde gérée, sinon fail-closed + journalise le refus.
  - `src/server/discord.ts` : TTL `fetchGuildMember`/`fetchGuildRoles` 60→15 s ; `404` membre 15→5 s.
  - `src/server/actions/user-actions.ts` : invalidation cache Discord à l'arrivée ; plus de cache Redis des contextes refusés.
  - `src/app/page.tsx` : membre connecté avec guilde accessible → `redirect('/dashboard')`.
  - **Observabilité God** : table `AccessAttempt` (migration `20260810090000_add_access_attempt`, PII minimale, rétention 90 j via janitor) + `getRecentAccessAttempts()` + section « Tentatives de connexion refusées » dans `src/app/god/logs/page.tsx`.
  - ⚠️ **Migration à appliquer** au déploiement via `migrate deploy`.

### ✅ Rate-limit 429 en pagaille (Caddy trop strict)
- **Cause** : snippet `rate_limit_base` du `Caddyfile` appliquée globalement à `beta.sigilos.fr` — 300 req/min + burst 60 req/s par IP sur TOUT (assets inclus). Un dashboard/monde chargé (tuiles `.webp` + prefetch RSC + manifest) dépasse 60 req/s → 429 en cascade.
- **Fix** (`b4d6fb4a`, `Caddyfile`) : borne haute **3000 req/min + burst 500/s** + **exemption assets statiques** (`/game-data/*`, `/_next/*`, `/manifest.webmanifest`, `/images/*`, `/icons/*`, `/fonts/*`, `/api/storage/*`). ⚠️ À appliquer au prochain déploiement (recréation Caddy par `deploy.sh`).

### ✅ Vérifs
- `tsc --noEmit` 0 · eslint 0 erreur · `test:run` **137/137** · `build` **62 pages** · push OK (`43098737..b4d6fb4a`).
- Mémos : `src/temp/memo-2026-08-10-login-whitelist.md` + `src/temp/memo-2026-08-10-rate-limit-429.md`.

---


## 🧭 Suivi de chantier — Refonte onglet Guilde Quêtes Dofus (10/08/2026)

> **Branche** : `feat/deploy-clean-pro` (à pousser).

### ✅ Refonte UI/UX — onglet Guilde (`/quetes-dofus?tab=guilde`)
- **Progression guilde** : barres horizontales triées par % (couleur officielle du Dofus via nouveau `dofus-colors.ts`, valeur `nb obtenus/total` + `%` sur la barre).
- **Insights guilde** : 3 KPIs (Dofus uniques obtenus, taux global, Dofus le plus avancé) + **filtres rapides** (Tous / >50% / 20–50% / <20%).
- **Table d'Honneur** : top 3 distinct (or/argent/bronze), tooltips au survol, légende, **recherche de membre sur les 121 actifs** (serveur : nouveau type `GuildMemberSummary`, `getGuildDofusStats` renvoie désormais `members`).
- **Fiche membre** : libellés clairs, tri (obtenus → % → alpha), badge « Obtenu », lien direct vers le guide, statut Obtenu/%/À faire.
- **Modale « Progression par Dofus »** : tri par défaut, filtres avancés, opacité des obtenus, chip « Rendu ici », tooltip Moy. Progression, pagination « Afficher plus ».
- **Accessibilité** : `role="dialog"` + `aria-modal` + fermeture sur Échap (les 2 modales).
- **Style** : adouci (moins de glow/italic, plus « pro ») ; bouton « Signaler » **rouge rétabli** (après passage temporaire discret).

### ✅ « Rendu ici » posable + avatars Discord (page détail `/quetes-dofus/[slug]`)
- Réutilise l'état `PlayerDofusQuestProgress.status = IN_PROGRESS` → **aucune migration**.
- Bouton **« Rendu ici »** par quête (surlignage ambre) + **avatars Discord empilés** des membres présents sur la quête + **modale** au clic (liste pseudo + avatar).
- Fix : la `synergy` excluait l'utilisateur courant → avatar « toi » ajouté localement ; `loadSynergy()` appelé après chaque toggle (mise à jour immédiate).

### ✅ Fichiers
`GuildDofusOverview.tsx`, `DofusQuestHub.tsx`, `DofusTimelineQuest.tsx`, `DofusQuestManagerV3.tsx`, `QuestFeedbackButton.tsx`, `dofus-colors.ts` (nouveau), `dofus-quest-actions.ts`.

### ✅ Vérifs
`tsc --noEmit` 0 erreur · eslint 0 erreur (sur les fichiers modifiés).

---

## 🗂️ Chantiers restants documentés (rappel — d'autres arriveront)

| Chantier | Réf / fichier | État |
|----------|---------------|------|
| Rotation secret `GOD_ROUTE` (fuité en git) | `src/temp/evolution4.md` | ✅ **FAIT (09/08)** — nouvelle `GOD_ROUTE` appliquée sur `.env.beta` + `.env.prod`, conteneurs rechargés (`docker compose up -d`), vérif 404 ancienne / 200 nouvelle / 404 mauvais secret |
| CSP nonce-based (`unsafe-inline`) | `src/temp/memo-2026-08-09-csp-nonce.md` | ✅ **Déployé** (commit `918fa308`) · ✅ **`CSP_ENFORCE=true` activé beta PUIS prod (10/08)** — enforce, nonce, 0 violation |
| Clé de chiffrement de secours dev | `SECURITY.md` | ✅ **Fermé** (F-09, retirée dans `encryption.ts`) |
| Chiffrement tokens OAuth (F-05) | `SECURITY.md` / `prisma.ts` | ✅ **FAIT (09/08)** — service `token-encryption.ts` + hook `updateMany` (commit `339db4e1`) |
| Cache permissions (F-13) + fallback RBAC (F-01) | `SECURITY.md` / `guards.ts` | ✅ **FAIT (09/08)** — TTL 30s + cache positif seulement (commit `0dd660bf`) |
| Caddy rate-limit (F-14) | `SECURITY.md` / `Caddyfile` | ✅ **FAIT (09/08, commit `cde708a7`)** + **RECALIBRÉ 10/08 (commit `b4d6fb4a`)** — `Dockerfile.caddy` (xcaddy + `caddy-ratelimit`). Correctif 429 : borne haute **3000 req/min + burst 500/s** + **exemption assets statiques** (`/game-data/*`, `/_next/*`, uploads, images, manifest). Fix Trivy DS-0002 (commit `fbc371e2`) : `USER caddy` non-root ajouté |
| proxy-image limites/footprint (F-06) | `SECURITY.md` | ✅ **FAIT** — taille streaming 5 Mo + magic bytes + blocage HTML déguisé |
| Sanitisation HTML centralisée (F-11) | `SECURITY.md` | ✅ **FAIT (09/08 add)** — centralisée `security.ts` + Monstres Spéciaux/Ressources (commit `d8189f42`) |
| SSRF image-downloader (F-03) | `SECURITY.md` | ✅ **FAIT** — protocoles + IP privées/réservées + DNS rebinding |
| JWT 8h (F-07) | `SECURITY.md` / `auth.ts` | ✅ **FAIT** — `maxAge: 8h` + `updateAge: 4h` |
| Activer `WS_AUTH_ENABLED` | `SECURITY.md` | ✅ **Activé beta + PROD (09/08)** — `WS_AUTH_ENABLED=true` dans `.env.beta` et `.env.prod` |
| Évol 4 restant (B3-B5 overview, A4 purge) | `CONTEXT.md` / `evolution4.md` | ✅ **FAIT (09/08, branche `feat/security-hardening-suite`)** — `ba7e2cf7` A4 purge, `ca11584d` B3 overview, `0757308f` B4 primitives, `db9a4e47` B5 animations. Reste Évol 2/3 (voir chantier `user.name` ci-dessous) |
| **Tours admin** : enrichir + sous-cartes par module | `src/temp/memo-2026-08-08-tours-admin.md` | ⚪ **Abandonné (décision 09/08)** — hors priorité, ne pas relancer |
| Vérifier build Next.js complet (CI Verify and build) | branche `feat/onboarding-admin-tour` | ✅ **FAIT (09/08)** — branche **ancêtre de `dev`** (déjà mergée), tours admin présents, build garanti par CI au merge. Rien à corriger |
| **Ladder Discord** : déployer fix + test manuel (puis prévoir SUSPECT A si besoin) | `memo-2026-08-08-ladder-discord.md` | ✅ **Corrigé + mergé (PR #416, `fa66e8fe`) + DÉPLOYÉ + VÉRIFIÉ (09/08)** — logs bot 48 h = **0 `NOT tracked`**, compteurs écrits. **SUSPECT A FERMÉ** : pas de migration `discordId` (aucun membre actif non-tracké) |
| **Zero Console Policy** | `SECURITY.md` / branche `feat/security-hardening-suite` | ✅ **FAIT (09/08)** — 433 `console.*` → `logger` (commits `4355d540` + `7dc0c01f`), 126/126 tests, build OK. Script utilitaire `.ps1` hors git |
| **Fuites `user.name`** (~90 fichiers) → pseudo serveur | branche `fix/display-name-server-pseudo` | ✅ **FAIT (09/08, 4 commits : `d3517f6a` lot1 server actions, `e43f55f8` lot2 API/cron, `627f73f1` lot3 client, `2936f67b` lot4 God/calendrier/profil)** — `user.name` d'autres membres remplacé par `getDisplayName()`/`getGameDisplayName()` (pseudo serveur en priorité). Self/actor conservés. **~27 fichiers** · tsc/lint/tests/build OK |
| Nav God : **blacklist géoguesser** + **firewall fantôme** | branche `feat/security-hardening-suite` | ✅ **FAIT (09/08)** — `9f012166` retrait de l'entrée fantôme « Chat Firewall » + câblage onglet GUESSER → whitelist géoguesser ; `0888a927` item sidebar direct « Blacklist Géoguesser » → `/god/mini-games?sub=GUESSER` |
| **Évol 3 — fallback pseudo + tuto profil** | branche `fix/display-name-server-pseudo` | ✅ **FAIT (09/08, `b6820cf5` + `33bebc43`)** — toggle God **« Fallback Pseudo Manuel »** (PlatformConfig `ladderManualFallback`) : si la liaison Ankama est KO, les nouveaux ne sont plus bloqués (saisie manuelle sécurisée par Zod, sans chiffres). Vérif « loupe » **claire et obligatoire** sur identité de combat ET mules (contournée si fallback ON). + bouton **« Tutoriel »** dans le profil. ✅ **TUTOS PARTOUT FAIT (10/08, branche `feat/deploy-clean-pro`)** — voir section « Déploiement pro + TUTOS PARTOUT » ci-dessus. |
| **Évol 2** (refonte Game Data, modale Monstre Spécial, missions ×8, footer en jeu, Génie d'Amakna, map signalée → notif God, ping roles, republier sans notif) | `evolution2.md` | ✅ **CLÔTURÉ (09/08, décision user)** — « tout est déjà fait », ne pas relancer |

---

## 🧭 Suivi de chantier courant (Session 10/08/2026 — Copie Couleurs, Barbofus, Date Profil, Tickets, God, Missions, SigilBomb)

> **Branche** : `feat/deploy-clean-pro` (modifications de la session du 10/08/2026).

### ✅ Presse-papier Hexa (Copie de couleur dans les modales)
- **Galerie de guilde** ([gallery-client.tsx](file:///a:/SigilOS/src/app/dashboard/%5BguildId%5D/galerie-stuff/gallery-client.tsx)) & **Garde-Robe / Profil** ([skin-library.tsx](file:///a:/SigilOS/src/components/profile/skin-library.tsx)) : Les cartes de couleurs sont devenues des boutons interactifs avec icône de copie. Un clic copie la couleur Hexa (ex: `#12AB34`) dans le presse-papier avec notification Toast de confirmation (`Couleur Peau (#12AB34) copiée ! 🎨`).

### ✅ Extraction Barbofus & Correctif Embed Discord
- **Scraper Barbofus Avancé** ([skin-actions.ts](file:///a:/SigilOS/src/server/actions/skin-actions.ts)) : Récupération exhaustive via `img[src*='/items/']` de 100% des types d'équipements Dofus 2 & Unity (costumes, mimibiotables, apparats, objets vivants, familiers, montures, épaulières, boucliers, etc.).
- **Fix Embed Image Discord** ([skin-actions.ts](file:///a:/SigilOS/src/server/actions/skin-actions.ts)) : Nettoyage des caractères invisibles (`\r\n\t`) présents dans les balises `<meta property="og:image">` de Barbofus. Re-scrape et auto-cache à la volée avant l'envoi sur Discord. Les images de skins Barbofus s'affichent désormais parfaitement en grand format dans les embeds Discord.

### ✅ Isolation de la Date d'Édition Manuelle du Profil (`userUpdatedAt`)
- **Problème** : `profile.updatedAt` se rafraîchissait automatiquement lors des cron jobs (Ladder, Metamob, Discord Sync, validation de missions), affichant des dates trompeuses ("Aujourd'hui à 03:02").
- **Fix** :
  - Migration Prisma `20260810073345_add_user_updated_at_to_user_profile` (`schema.prisma`) : Ajout de `userUpdatedAt DateTime? @default(now())`.
  - [profile-actions.ts](file:///a:/SigilOS/src/server/actions/profile-actions.ts) & [skin-actions.ts](file:///a:/SigilOS/src/server/actions/skin-actions.ts) : `userUpdatedAt` n'est mis à jour QUE lors des actions explicites du membre (infos profil, disponibilités, vacances, builds Dofusbook, skins).
  - Front-end ([page.tsx](file:///a:/SigilOS/src/app/dashboard/%5BguildId%5D/members/%5Bslug%5D/page.tsx)) : L'en-tête `"Dernière mise à jour du profil"` consomme `profile.userUpdatedAt`.

### ✅ Embed Discord Missions — Fix Type "Spéciales" sur Missions Normales
- **Problème** : Les missions Songe (Plongée en Cauchemar/Paradoxe) et Anomalie étaient catégorisées comme "Spéciales" dans l'embed Discord même si l'admin ne les avait pas configurées comme telles.
- **Fix** ([mission-actions.ts](file:///a:/SigilOS/src/server/actions/mission-actions.ts)) : L'embed regroupe désormais les missions par leur **vrai type BDD** (`missionType`), et non par règle heuristique sur le nom. Seules les missions avec `missionType === 'SPECIAL'` apparaissent dans la section "Spéciales". Missions Songe et Anomalie en mode normal → section normale.

### ✅ Sanitisation & Validation des Inputs Tickets Discord
- **Ticket Whitelist** ([route.ts](file:///a:/SigilOS/src/app/api/discord/interactions/route.ts)) : Validation stricte de toutes les saisies utilisateur du modal de demande d'accès :
  - **ID Discord Serveur** : regex `^\d{17,20}$` (snowflake Discord strict)
  - **Nom de guilde Dofus** : regex nomenclature Dofus (lettres, accents, tirets, crochets — sans chiffres ni caractères spéciaux)
  - **Pseudo Dofus** : regex Dofus SigilOS stricte (`formatDofusPseudo` — pas de chiffres)
  - **Nombre de membres** : entier entre 1 et **350** (ancienne limite 500 corrigée, placeholder mis à jour)
  - Rate-limiting côté bot : 1 création de ticket toutes les 10s par utilisateur Discord.

### ✅ Capacité Max Membres par Guilde Whitelistée (`maxMembers`) & Alertes 50%/80%
- **Nouvelle Server Action** ([god-lifecycle-actions.ts](file:///a:/SigilOS/src/server/actions/god-lifecycle-actions.ts)) : `updateGuildMaxMembers(guildId, maxMembers)` permet aux Super-Admins et délégués God d'ajuster le quota d'emplacements d'une guilde (1 à 1000) avec notification God automatique.
- **Édition Directe dans le Dashboard God** ([guild-table.tsx](file:///a:/SigilOS/src/app/god/components/guild-table.tsx)) : Bouton crayon `✏️` au survol de la colonne Membres permettant de modifier le nombre d'emplacements d'une guilde à la volée.
- **Alertes de Capacité (50% & 80%)** ([member-stats-overview.tsx](file:///a:/SigilOS/src/components/admin/member-stats-overview.tsx)) :
  - **Seuil > 50%** : Badge ambre `⚡ Capacité > 50%` + bannière d'attention.
  - **Seuil > 80%** : Badge rouge clignotant `⚠️ Seuil > 80%` + bannière d'alerte critique pulsée.

### ✅ SigilBomb — Correctifs Majeurs (Modale, Solo, Salons)

#### 🚫 Blocage Lancement Solo Non-Autorisé
- **Validation côté serveur** ([SigilBombRoom.ts](file:///a:/SigilOS/src/server/games/SigilBomb/SigilBombRoom.ts)) : `startGame` vérifie `humanCount < 2 && !this.config.isSoloMode`. Impossible de lancer seul sans activer le mode Solo ou avoir 2 joueurs humains.

#### ⚙️ Modale de Configuration — Non-Fermeture sur Modification
- **Double problème racine** ([BombGame.tsx](file:///a:/SigilOS/src/components/bomb/BombGame.tsx)) :
  1. Le handler WebSocket `bomb:sync` appelait `setShowOptions(false)` après chaque config update → fermeture systématique.
  2. Le `useEffect` monitorant `gameState.state === 'LOBBY'` appelait aussi `setShowOptions(false)` → même résultat.
  3. La modale était imbriquée dans un conteneur `overflow-hidden` → tronquée + clics parasites.
- **Fix complet** :
  - Suppression de tous les appels `setShowOptions(false)` dans `bomb:sync` et le `useEffect` LOBBY.
  - Modale déplacée en **overlay fixe `fixed inset-0 z-[999]`** au root du composant, hors de tout conteneur clippant.
  - `e.preventDefault()` + `e.stopPropagation()` sur tous les éléments interactifs de la modale.
  - `max-h-[75vh] overflow-y-auto custom-scrollbar` : plus de débordement vertical.
  - Toggle **🤖 Mode Solo (Robot Crâ-Mée)** réintégré dans la modale.
  - Bouton **"⚡ Lancer l'Épreuve"** dynamiquement désactivé (grisé avec texte explicatif) si les conditions ne sont pas réunies.

#### 🔄 Synchro Temps Réel des Salons (sans F5)
- ([BombManager.ts](file:///a:/SigilOS/src/server/games/SigilBomb/BombManager.ts)) : Méthode `broadcastRoomList()` ajoutée, appelée automatiquement lors de la création, destruction et mise à jour des rooms. Les salons s'actualisent en temps réel sans refresh page.

---

## 🧭 Chantiers de sécurité restants (rappel — voir SECURITY.md)

**État au 01/08/2026 :** F-02, F-06/F-03, F-04, F-01, F-12, F-23/F-24, F-19/F-27/F-26/F-18/F-22 corrigés. **Session d'après-audit (01/08) ajoutée :** F-08 (auth WS), F-05 (chiffrement OAuth), F-04 (fail-closed + IP fiable), F-02 (expiration + clé dédiée), F-07 (JWT 8h), F-03 (SSRF image-downloader). **Rapports centralisés :** `docs/audits/` (hors git). Reste :

> ✅ **Résolu (09/08)** : **CSP nonce-based déployée** (Report-Only, commit `918fa308`) · **clé de chiffrement de secours retirée** (F-09) · **`WS_AUTH_ENABLED=true` activé en beta** (F-08, à tester puis activer en prod).

**Reste :**
- **1. Zero Console Policy** : ✅ **FAIT (09/08)** — 433 `console.*` → `logger` (commits `4355d540` + `7dc0c01f`). Vérifs 126/126 · tsc 0 · build OK. Script `.ps1` hors git.
- **2. Audit BDD tokens OAuth** : ✅ **TERMINÉ (09/08)** — beta 126/126 chiffrés · prod 3/3 re-chiffrés → **F-05 FERMÉ**.
- **3. Infra** : ✅ **I-06 (unifier Discord) FAIT + déployé beta** (`5e4921aa`) · ✅ **I-07 (séparer Redis) FAIT + déployé beta** (`de97fb3d`) · ✅ **I-15 (circuit breaker) FAIT** (`7efd4bf9`). ✅ **F-14 Caddy rate-limit : DÉPLOYÉ** (image custom `sigilos-caddy`, module `rate_limit`).

✅ **Résolu le 09/08** (en plus de la ligne ci-dessus) : **Cache permissions TTL 30s + cache positif (F-13/F-01)** · **proxy-image borné (F-06)** · **sanitisation HTML centralisée (F-11)** · **hook `updateMany` chiffrement OAuth (F-05)** · **rotation `GOD_ROUTE`** · **WS auth beta + prod (F-08)** · **CSP_ENFORCE beta activé** · **`app-prod` unhealthy réparé** (mot de passe DB encodé) + **rotation mot de passe Postgres prod** · **F-14 déployé**.

**Infra :** I-01 à I-17 traités. **Reste infra :** rien de bloquant (I-06/I-07/I-15/F-14 faits). **Gartic/Skribbl supprimés** du code.

### ✅ Correctifs du Module Ressources (Tutoriel & Notification Serveur)
- **Fix du Tutoriel qui sautait (Actualités)** ([ResourcesTabs.tsx](file:///a:/SigilOS/src/components/ressources/ResourcesTabs.tsx) & [tour-provider.tsx](file:///a:/SigilOS/src/components/tour/tour-provider.tsx)) : Les ancres `data-tour` du tutoriel (`ressources-news-tab`, `ressources-links-tab`) ont été déplacées sur les **onglets principaux** (toujours présents dans le DOM) au lieu des conteneurs de contenu conditionnels. Le tutoriel ne saute plus l'étape des actualités après 2s d'attente.
- **Suppression du 404 & Erreur Notification** ([NewsGrid.tsx](file:///a:/SigilOS/src/components/ressources/NewsGrid.tsx) & [news-discord-actions.ts](file:///a:/SigilOS/src/server/actions/news-discord-actions.ts)) : Remplacement du fetch mort vers `/api/dashboard/${guildId}/config` (route absente produisant une exception 404/erreur serveur) par la server action directe `getNewsTargetChannelName(guildId)`.

### ✅ Correctifs UI/UX & Stabilité Sigil-Guesser (Zoom 100%, Écran Noir, Design Gaming Pro)
- **Ajustement de la hauteur du viewport** ([page.tsx](file:///a:/SigilOS/src/app/dashboard/%5BguildId%5D/mini-jeux/page.tsx)) : passage de `calc(100vh-120px)` à `calc(100vh-80px)` pour s'adapter parfaitement aux écrans 100% sans générer de barres de défilement globales ni bloquer les conteneurs.
- **Fix Clignotement / Écran Noir en Fin de Round** ([interactive-map-v2.tsx](file:///a:/SigilOS/src/components/worldmap/interactive-map-v2.tsx)) : Bornage strict (`Math.max(0, Math.min(100, ...))`) de la barre de distance et du calcul de score pour éviter tout dépassement d'intervalle ou valeur `NaN` qui provoquait un clignotement/écran noir à partir d'une certaine distance.
- **Refonte Design Pro Gaming des Menus & Cartes** ([interactive-map-v2.tsx](file:///a:/SigilOS/src/components/worldmap/interactive-map-v2.tsx)) : Remplacement du style générique (gros biseaux `rounded-[3rem]`, paddings exagérés `py-5`, typographies italiques disproportionnées) par un design sombre épuré pro gaming (`rounded-2xl`, typographie hiérarchisée `zinc-400`, boutons `rounded-xl` réactifs).

### ✅ Correctifs UI/UX Globaux (Search, Membres 404, Calendrier, Headbar, Footer & Live Badge)
- **Fix 404 Clic Membre dans la Recherche** ([search-actions.ts](file:///a:/SigilOS/src/server/actions/search-actions.ts)) : Redirection corrigée vers `/dashboard/${guildId}/members/${encodeURIComponent(slug)}` (au lieu de la route inexistante `/profile/[id]`).
- **Refonte Bouton Rechercher & Command Menu** ([sidebar-search.tsx](file:///a:/SigilOS/src/components/layout/sidebar-search.tsx) & [command-menu.tsx](file:///a:/SigilOS/src/components/layout/command-menu.tsx)) : Élimination des effets "IA slop" (scanlines, badges sur-stylisés `v3.0`, bordures animées). Bouton de recherche épuré pro-gaming avec badge `<kbd>⌘K</kbd>` propre.
- **Clôture Automatique des Événements du Calendrier** ([calendar-actions.ts](file:///a:/SigilOS/src/server/actions/calendar-actions.ts)) : Basculement automatique au statut `COMPLETED` lors du fetch pour tout événement dont la date de fin est dépassée par rapport à `now`.
- **Simplification Headbar & Footer** ([top-nav.tsx](file:///a:/SigilOS/src/components/layout/top-nav.tsx) & [galactic-footer.tsx](file:///a:/SigilOS/src/components/layout/galactic-footer.tsx)) : Suppression des animations de balayage `shine`, typographies italiques disproportionnées et dégradés bariolés au profit d'un design épuré, sombre et minimaliste.
- **Fix Modale "Créateurs en LIVE"** ([live-stream-badge.tsx](file:///a:/SigilOS/src/components/notifications/live-stream-badge.tsx)) : Correction des contraintes de largeur (`max-w-sm`), suppression du débordement à droite et ajustement du layout.

- **Refonte des Fil d'Ariane (Breadcrumbs Header)** ([top-nav.tsx](file:///a:/SigilOS/src/components/layout/top-nav.tsx)) : Les chemins de navigation (ex: `Tableau de bord` > `Membres` > `Wylan`) sont désormais clairs, lisibles et hautement contrastés avec un dictionnaire de noms propres (`MODULE_NAMES`), un décodage URL propre et une mise en valeur verte (`bg-emerald-500/10`) pour l'emplacement actuel.

- **Ouverture Directe de la Modale d'Événement depuis le Header** ([calendar-dashboard.tsx](file:///a:/SigilOS/src/components/calendar/calendar-dashboard.tsx) & [page.tsx](file:///a:/SigilOS/src/app/dashboard/%5BguildId%5D/calendar/page.tsx)) : Les clics sur les événements défilants de la barre supérieure redirigent désormais avec le paramètre `?event=ID`. Le tableau de bord du calendrier écoute ce paramètre et ouvre automatiquement la modale de détails (`EventDetailModal`) au lieu d'afficher uniquement le calendrier global.

### ✅ Désactivation des Pings Rôles par Défaut & Message d'Avertissement
- **Changement UX global** ([CreateRunButton.tsx](file:///a:/SigilOS/src/components/songes/CreateRunButton.tsx), [event-form.tsx](file:///a:/SigilOS/src/components/calendar/event-form.tsx), [DjPostCreateModal.tsx](file:///a:/SigilOS/src/components/dungeon-finder/DjPostCreateModal.tsx), [poll-creator.tsx](file:///a:/SigilOS/src/components/sondages/poll-creator.tsx)) : Suppression de la pré-sélection / auto-fill automatique de tous les rôles Discord lors de la création d'un événement, d'une run de Songes, d'un groupe Donjon/Quête ou d'un Sondage. Par défaut, aucun rôle n'est pré-coché (`mentionRoleIds = []`).
- **Bannière d'information claire** : Ajout d'un callout explicatif au-dessus du sélecteur de rôles dans chaque modale : `⚠️ Aucun ping par défaut. Sans sélection, personne ne sera notifié. Choisissez un ou plusieurs rôles pour donner de la visibilité.`

### ✅ Verrouillage Stricte des Places Max en Raid
- **Places Max Figées par Type de Raid** ([event-form.tsx](file:///a:/SigilOS/src/components/calendar/event-form.tsx)) : 
  - **Gigalodon** : bloqué et figé à **12 places**.
  - **Sanctuaire des Jardins Éternels** : bloqué et figé à **16 places**.
  - L'input `maxParticipants` modifiable est remplacé par un badge verrouillé `12 places (fixe)` / `16 places (fixe)` lorsque le type sélectionné est un Raid Officiel.

### ✅ Suppression du Bloc "Ton Stuff" dans les Songes
- **Nettoyage UI / Formulaires Songes** ([CreateRunButton.tsx](file:///a:/SigilOS/src/components/songes/CreateRunButton.tsx) & [RunCard.tsx](file:///a:/SigilOS/src/components/songes/RunCard.tsx)) : Suppression complète du bloc "🛡️ Ton Stuff pour cette Run" (grille de miniatures, saisie d'un nom personnalisé de stuff, et sélection de build dans la galerie) à la fois lors de la création d'une run de Songes et dans la modale de candidature/postulation.

### ✅ Refonte du Centre de Notifications (Filtres Statut, Historique & Layout Responsive)
- **Nouvelle Server Action `getAllNotifications`** ([notification-actions.ts](file:///a:/SigilOS/src/server/actions/notification-actions.ts)) : Permet de récupérer à la fois les notifications lues et non lues (historique complet).
- **Filtres par Statut** ([page.tsx](file:///a:/SigilOS/src/app/dashboard/%5BguildId%5D/notifications/page.tsx)) : Ajout d'onglets principaux **`Non lues`**, **`Historique (Lues)`** et **`Toutes`** avec compteurs dynamiques.
- **Catégories toujours visibles & Fix Débordement UI** ([page.tsx](file:///a:/SigilOS/src/app/dashboard/%5BguildId%5D/notifications/page.tsx) & [notification-bell.tsx](file:///a:/SigilOS/src/components/notifications/notification-bell.tsx)) : Les puces de catégories (Missions, Succès, Songes, Donjons, Events, Sondages, Ocre, Admin) sont désormais **toujours visibles** avec leurs compteurs. Utilisation d'un layout responsive `flex-wrap` pour empêcher tout débordement ou tronquage du texte à droite de l'écran.

---

*— Fichier de contexte global maintenu à jour (créé à l'issue de l'audit 2026). Session 10/08/2026 intégrée. —*

## ✨ Mise à jour 11/08/2026 — Refonte Ganymède (positions) + Repo passé PUBLIC (blindage)

- **Ganymède** : nouveau composant `CoordHoverMap.tsx` → **hover carte sur toutes les positions** (comme rush sylvestre `MapPositionPopover`), délégation sur `mainRef`, résolution monde auto via `resolveMapWorldAction`, boutons Copier /travel + Carte. **Suppression du bandeau « Trajet · N cartes »** (état `checkedSubMaps`, `localStorage sigilos_submaps_*`), du bouton œil `coord-eye-btn` + modal `mapModal` + `onMapClick` + `EYE_SVG` + `detectWorldId` (morts). CSS mort retiré (`.sgc-step-coords`, `.coord-btn`), hover `.coord-chip` amélioré (glow bleu). Commit `36bf6a25`.
- **Supply-chain CI** : actions tierces épinglées sur SHA de commit (gitleaks/semgrep/trivy) + permissions `issues:write` au job `security-scan`. Commit `0b93d302`.
- **Repo `Klyx04/SigilOS` passé PUBLIC** (minutes Actions illimitées) → blindage : secret scanning + push protection ON, dependabot alerts/security updates + CodeQL ON, mot de passe beta `BETA_PASSWORD` changé (GitHub + `.env.beta` serveur) + beta redéployé, images GHCR **privées**, branches `dev`/`main` **protégées** (PR + CI vert ; approbation relâchée sur `dev` car solo), interaction limits « prior contributors », limite PR inconnus = 1. Détails : `src/temp/memo-2026-08-11-blindage-public-suite.md`.
- **Branche `refonte-module-ganymede` poussée** (commits `36bf6a25`, `0b93d302`) → **PR vers `dev` à créer/merger** (le user solo peut s'auto-approuver sur `dev`).
- **PR dependabot en cours** : `lodash` mergé ✅ · `undici` (sécurité) prête · `ws` (sécurité) en rebase.
- **Prochaine session** : **continuer la refonte du guide complet Ganymède** (chantier ouvert — cf. `src/temp/memo-2026-08-10-module-ganymede.md`).


## Mise a jour 11/08 (suite) - Triage CodeQL + corrections securite
- Premier scan CodeQL : ~68 alertes. Triage des Critical :
  - SSRF (16) : 15 faux positifs (hotes fixes). 1 vraie (`dofusbook-actions.ts:22`, URL utilisateur fetch avec redirect:follow, aucun garde) -> **CORRIGE** : export `assertSafeUrl` (image-downloader) + host allowlist d-bk.net/dofusbook.net + blocage IP internes/DNS rebinding.
  - Uncontrolled command line (4) : reel mais admin-only -> **CORRIGE** : validation slug (regex) avant execAsync (`dofus-v3-actions.ts`, `dofus-quest-admin-actions.ts`).
- Commit `aea3ac68` pousse sur `refonte-module-ganymede` (PR #451). tsc 0, eslint 0 erreur, tests 137/137.
- Reste a trier (non bloquant, CodeQL non requis pour merge) : sanitization/double escaping, format string cache.ts, DOM XSS kama widgets, dist/*.js (build, ignorer).

---

## 🧭 Session 12/08/2026 — Fixes UX + Archivage Discord (branche `fix/debug-amelio`)

> **Branche** : `fix/debug-amelio` → PR vers `dev` (mergée). **Commits** : `1f64507e`, `577b1e97`, `15b52fdb`, `89d527b1`, `d0533af8`, `9bd6e825`.

### ✅ Fix 1 — Chip Événements Header non-cliquable (overflow clippé)

- **Problème** : la popover de la chip événements était clippée par le `overflow-hidden` du header → non cliquable.
- **Fix** (`top-nav.tsx`) : chip déplacée hors du conteneur `overflow-hidden`, popover libre dans le DOM.
- **Comportement** : 1 événement → ouvre `EventDetailModal` directement ; N événements → ouvre une liste cliquable (chaque item ouvre la modale).

### ✅ Fix 2 — Bouton Réglages du profil ouvre directement l'onglet Settings

- **Problème** : clic sur « Réglages » dans le dropdown du profil ouvrait le profil sur l'onglet Général.
- **Fix** (`top-nav.tsx` + page profil) : ajout de `?tab=settings` dans le lien → détection côté serveur via `searchParams` → onglet Réglages actif immédiatement.

### ✅ Fix 3 — Flux de déploiement Missions (1er déploiement + re-déploiement)

- **Problème** : au 1er déploiement, pas d'étape de ping Discord (pourtant des rôles étaient définis). Au re-déploiement, pas de choix entre reping ou silencieux.
- **Fix** (`mission-publish-flow-dialog.tsx`) :
  - **1er déploiement** : étape `DISCORD_PING` avec rôles pré-cochés (issus de la config admin).
  - **Re-déploiement** : nouvelle étape `REPUBLISH_CHOICE` → « Modifier sans reping » (silencieux) OU « Modifier en pingant » (ouvre la modale de ping).

### ✅ Fix 4 — Archivage automatique lors des départs Discord (bot + cron)

**Cause racine** : le bot Discord (discord.js, conteneur séparé) manque les events `GuildMemberRemove` quand il crash/redémarre. Discord ne rejoue pas les events manqués.

- **Bot** (`services/discord-bot/index.ts`) :
  - Ajout de `Partials.GuildMember` → events fiables même pour membres non cachés (bot redémarré).
  - Ajout de `scheduledDeletion: +30j` à l'archivage.
  - Ajout de l'envoi direct d'un embed Discord dans `lifecycleNotifyChannelId` après chaque archivage (`GuildMemberRemove`).

- **Cron safety net** (`src/app/api/cron/sync-members/route.ts`) — **NOUVEAU** :
  - Endpoint `/api/cron/sync-members` protégé par `x-cron-secret`.
  - Appelle `syncAllGuilds()` : cross-check membres Discord vs profils actifs en DB, archive les absents, réactive les retours.
  - Intégré dans `scripts/maintenance.sh` (nightly 4h00).
  - **Cron VPS toutes les 30min** à ajouter : `*/30 * * * * curl -s -H "x-cron-secret: SECRET" "https://beta.sigilos.fr/api/cron/sync-members" >> .../logs/sync-members.log 2>&1`

### ✅ Fix 5 — Embeds lifecycle envoyés sur départs/bans automatiques

- **Problème** : `sendLifecycleNotification` n'était appelée que sur les actions manuelles (admin archive/delete). Les départs automatiques (bot ou cron sync) n'envoyaient aucun embed.
- **Fix** :
  - `lifecycle-actions.ts` : `sendLifecycleNotification` **exportée** (auparavant privée).
  - `sync-actions.ts` : import + appel après chaque archivage LEFT/BANNED dans `syncMembershipStatusInternal`. User select enrichi avec `name` + `image`.
  - Bot : embed direct via `client.channels.fetch(lifecycleNotifyChannelId)` après archivage dans `GuildMemberRemove`.
- **Couverture complète** :
  - ✅ Auto-archive depuis le profil utilisateur → embed `ARCHIVED`
  - ✅ Admin archive/supprime → embed `ARCHIVED`/`DELETED`
  - ✅ GDPR deletion → embed `DELETED`
  - ✅ Départ Discord (bot temps réel) → embed `LEFT`
  - ✅ Départ Discord (cron sync fallback) → embed `LEFT`
  - ✅ Ban Discord (cron sync) → embed `BANNED`
  - ✅ Réactivation admin → embed `REACTIVATED`
  - ✅ AuditLog créé pour chaque action, cloison par guilde garantie.

### 📋 Rappels actions VPS post-déploiement

1. `./scripts/deploy.sh beta` (rebuild app + bot Discord)
2. `crontab -e` → ajouter la ligne `*/30 * * * *` sync-members (cf. ci-dessus)
3. Vérifier que `lifecycleNotifyChannelId` est configuré dans **Admin → Settings → Notifications** de chaque guilde

