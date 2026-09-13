# Active Context — SigilOS

## ✅ DERNIÈRE PR MERGÉE — **#642** (`feat/marche-s8-lot3` = S8 lot 3) → **branche courante : `feat/marche-s8-lot4`** (PR ouverte vers `dev`)

> **Merges récents :** **#640** (lot 2bis « fidélité des lignes de jet ») · **#641** (référence des règles projet) · **#642** (S8 lot 3 « Discord & UX ») → `dev` = **`55b238e5c`**.
> **Session en cours :** **Module « Marché » · S8 LOT 4 « Supervision & clôture » (`S8.18` → `S8.22` + `S8.31`)** — branche **`feat/marche-s8-lot4`** créée depuis `dev` = `55b238e5c` · plan §18/§19.1/**§21 S8 lot 4**/§22 · mémo `src/temp/memo-2026-09-13-marche-s8-lot4.md`.
> **Livré (vérifié) :** cascade **`WITHDRAWN`** (`src/server/market/lifecycle.ts`, garde de statut **dans le `WHERE`** + audit + Discord non bloquant ; branchée sur archivage/ban/départ/suppression admin/**RGPD**) · tests `market-expire` (**13**) + `market-concurrency` (**7**) · alertes God sur incident (`src/server/market/incidents.ts`, throttle Redis `SET … EX … NX` fail-closed, `notifyGod` **non bloquant**, appelées après la télémétrie du cron) · onglet **God « Marché »** (`/god/market`, `isSuperAdmin()` **fail-closed page ET chaque action**, `createGodAuditLog` sur toute mutation, réglages globaux **sans migration**) · tour **révisé** (+ 3 ancres) + docs à jour (`seed:docs` 30 MAJ) · `tsc` **0** · `eslint` **0 erreur** · suite **1148/1148** ✅ (107 fichiers) · `build` **exit 0** · **0 migration**.
> **État du chantier :** le **MVP Marché est fermé** (`S1`→`S8` livrés). Reste **hors code** : poser la ligne crontab `market-expire` sur le VPS (`MAINTENANCE.md:65`), la **DoD visuelle** de `/god/market` (dark/light/mobile) et `S4.12` (beta 2 comptes). `S3.13`/`S6` = V1.1, jamais ouverts.
> **Règle de session (ratifiée 10/09) :** tant qu'une PR est **ouverte**, on la **surveille jusqu'au merge** (`gh pr checks <n>` · `gh run view <id> --log-failed`) ; **si une étape CI/CD échoue → on fixe, on relance** (`gh run rerun <id> --failed`) **et on recommence jusqu'au vert, puis merge**. Jamais de merge sur rouge · jamais de test désactivé pour verdir · jamais `main` · jamais de push direct sur `dev`.
> **Contexte de reprise :** plan `src/temp/refonte-marche/PLAN-MAITRE-MODULE-MARCHE.md` · état + **§0 sécurité bloquante** `src/temp/refonte-marche/REPRISE-S8-LOT4-ETAT.md` · amorce `src/temp/refonte-marche/AMORCES-A-COPIER.md`.

### Fichiers à surveiller sur cette PR (les toucher ⇒ relire les règles ci-dessous)
- **CI/CD** : `.github/workflows/verify.yml` (Lint → tsc → bot tsc → tests → build) · `.github/workflows/deploy.yml` (image construite sur runner GitHub via buildx) · `Dockerfile` (stage `builder` = `npm run build`).
- **Schéma/données** : `prisma/schema.prisma` + `prisma/migrations/**` (**idempotence obligatoire**) · `src/lib/module-types.ts` · `src/server/actions/module-actions.ts` (**`GOD_LOCKABLE_MODULES`**) · `src/lib/permissions.ts` · `src/server/actions/user-actions.ts` (**`applyModule` = piège n°1**).
- **Module Marché** : `src/server/actions/market-actions.ts` · `market-admin-actions.ts` · `market-constants.ts` · `god-market-actions.ts` (**super-admin only**) · `src/server/market/{lifecycle,incidents,expiry,reservations,offers,maintenance,retention,discord}.ts` · `src/lib/market/{kamas,stat-quality}.ts` · `src/app/dashboard/[guildId]/marche/**` · `src/app/god/market/**` · `src/app/api/cron/market-expire/route.ts`.
- **Docs & tour (obligations RULES.md)** : `src/lib/docs-catalog.ts` (**la source** — puis `npm run seed:docs` **et** `npm run build:seeds`) · `src/components/tour/tour-provider.tsx` (+ `MODULE_TOUR_PHASES`) · `src/components/tour/module-tour-replay-button.tsx`.
- **Fixtures sensibles aux modules/permissions** : `tests/unit/onboarding-console.test.ts` (`allOn()`).

### Pièges connus (brief du 10/09/2026)
- `prisma migrate dev` **échoue en local** (migration `20260819000000_add_inter_guild` appliquée en base mais absente du repo → Prisma propose un **reset destructif**) ⇒ migration **écrite à la main (idempotente)** + `prisma db execute --file`.
- **Plafond mémoire Node ~2 Go** : `tsc --noEmit` et `next build` (« Running TypeScript ») tombaient en **OOM** ⇒ heap porté à **4 Go** (`NODE_OPTIONS` dans `verify.yml` **et** `Dockerfile`), commit `66ffdd724`.
- **Tests à fixtures de date figée = bombes à retardement** ⇒ toujours une référence **relative** (`Date.now() - H`).
- `npx prisma` sans version installe la **v8 RC** ⇒ toujours `prisma@7.10.0` · PowerShell : `[guildId]` est un wildcard ⇒ `-LiteralPath`.
- **Déploiement VPS bloqué par un artefact de siphon** : `public/game-data/dungeon-monsters.json` est **versionné** (commit `ca7aed455`) **mais régénéré au runtime** (cron `sync-monster-stats` + bouton God) **à travers le bind mount compose** `~/SigilOS/public/game-data:/app/public/game-data` ⇒ le fichier est « modifié » côté serveur et **`git pull` abandonne** (`Your local changes … would be overwritten by merge → Aborting`). **Débloqué** par un garde-fou dans `scripts/deploy.sh` + `scripts/deploy-cd.sh` (`GENERATED[]`, PR **#628**). **Dette structurelle recommandée** : écrire l'artefact dans un chemin **non versionné** (volume dédié) et adapter `dungeon-monsters-siphon` (OUTPUT_PATH) + lecteurs (`game-data-actions`, `data-health-actions`) + mount Caddy statique — ou cesser de versionner le fichier (`.gitignore` + `git rm --cached` + génération au deploy).

## Session 2026-09-09 (nuit) — Landing boss + Status Discord + Ko-fi + Prod bot + Gitops
> Branches : `feat/chantier-2026-09-08-titans` (PR **#613 MERGÉE** dans `dev` → déployée beta `4dc682f7`) · `fix/migrations-idempotentes` (PR **#614 OUVERTE** → `dev`).
- ✅ **Landing `/boss` parité module Succès** (`cacc71686`) : filtre **Boss / Titans** + badge TITAN (catalogue) · fiche boss **et** titan (page résout `Dungeon` **ou** `Titan`, pré-charge sorts+famille+maps serveur) · onglets Sorts / Sorts détaillés / Simu + choix map / Grades / Drops (modale) / Monstres de salle · stats PV-PA-PM + résistances · `/travel` · `SpellRangeGrid.allowFreeCasterMove` (bypass boss libre opt-in public, dashboard épinglé inchangé).
- ✅ **Status Discord anti-spam** (`fae7b556c`, partie core déjà sur dev via #611/#612) : cause = living-status retombé en création à chaque tick (ID stocké jamais réutilisé : TTL 30 j expirée 09/08→08/09 + aucune validation) + `statusFrequency` God jamais lu. Fix = **garde-fou fréquence** (`shouldSkipStatusPing`, marge 45 s, fail-soft si Redis KO) + validation **snowflake** (un `outbox:<jobId>` ne casse plus le PATCH — important car `DISCORD_OUTBOX_ENABLED=true` sur beta) + worker tick **5 min** + nettoyage anciens schedulers + TEST PING `force:true` + embed **vulgarisé** (Bot/Site/Données, zéro techno) + God : sélecteurs mode living/notif + lite (déjà persistés, sans UI avant).
- ✅ **Ko-fi E2E** (`fae7b556c`) : vraie cause = URL Ko-fi pointait `/api/kofi` (inexistant, 404 silencieux) → **`/api/webhooks/kofi`** · 401 suivant = **`proxy.ts` bloquait `/api/webhooks/*`** (pas dans `isPublicApi`) → ajouté · token robuste aux guillemets `.env` · remerciement public `#DONS-KOFI` via `kofiChannelId` (God, migration `20260909014154`) + **ping @** si 1 seul profil Discord matché (jamais d'ambigu) + `is_public:false` respecté. Tests : 7 kofi + 9 guard.
- ✅ **Prod bot ressuscité** : crash-loop 141k restarts, `TokenInvalid` — cause double : token partagé beta+prod (bagarre de sessions gateway) + mdp BDD divergent (`DATABASE_URL` vieux mdp vs `POSTGRES_PASSWORD` + spéciaux non encodés). Fix = **2e appli Discord `SigilOS Prod`** (token+AppID+secret+clé Ed25519 dédiés, intents Members+MessageContent, invite bitmask `6356836904068`) + mdp **alphanumérique** réaligné (`ALTER USER` + `.env.prod` + recreate). Tout healthy.
- ✅ **Gitops** : 6 commits titans (boss, kofi+status, worldmap, purge J+7/14/21, divers, docs) + PR #613 mergée · **10 branches remote mergées supprimées** (reste : dev/main/inter-guilde + `onboarding-suite` avec 1 commit unique à trancher : `inline-onboarding-steps.tsx` — étapes inline sans navigation, greffe peu coûteuse mais redondante) · stash `wip-unrelated` trié et droppé (24/25 déjà absorbés, 1 helper orphelin sauvé en temp) · local 100 % poussé (vérifié : worktree vide, 0 stash, ahead=0 partout).
- ⚠️ **Dette soldée ensuite** : migrations `IF NOT EXISTS` (PR #614, protège le futur deploy prod après le P3018 beta — colonne déjà créée hors migrations → `resolve --applied`).
- ⚠️ **Leçons PowerShell session** : `>` écrit en UTF-16 (patches git corrompus — passer par `cmd /c` ou .NET) · `edit` échoue sur fichiers CRLF (normaliser LF d'abord) · `.env` relu uniquement au boot (`next dev` restart obligatoire) · `npx prisma` SANS version installe la v8 RC → toujours `prisma@7.9.1`.
- ✅ Vérifs : `tsc` 0 · **587/587** tests.

## Chantier du jour (2026-09-08) — Module « Titans » (feat. de bout en bout)
> Branche `feat/slash-rework` — **non commité**. Mémo : `src/temp/memo-2026-09-08-titans.md`.
- ✅ Modèle `Titan` + `UserTitanProgress` + `DjSearchMode.TITAN` + champs DJ (`titanId/titanName/questName/questUrl`) ; Admin God `TitanManager`, server actions `titan-admin-actions`/`titan-actions`, seed Gargandyas (**8062**, Osavora, dispo WE 19h→8h, 5 victoires max).
- ✅ `SuccesTitanTab` **parité fiche boss** : onglets **Stats & Sorts / Simulation (`SpellRangeGrid`) / Monstres de salle**.
- ✅ Résolution Gargandyas validée (id **8062**, ⚠️ homonyme 8069) · **icônes** = set **déjà officiel** (aucune intégration d'assets desktop, conforme règle « proposer puis valider ») · barre de vues Succès en **assets Dofus** + « Fiche Titans » à côté de « Fiches Boss ».
- ✅ DJ Titan : **taille FIXE = titan.maxMembers** (modale + `createDjPost` force) · **date/heure calquée sur `scheduleConfig`** (`DateTimePicker` allowedDaysOfWeek+hourRange, fenêtres nocturnes, verrou sélection) · cron `cleanup-inactive-posts` couvre TITAN · file d'attente déjà en place.
- ✅ UI /boss : bouton « Overlay en jeu » retiré des cartes + amber→`warning` · **overlay fix flèche retour** (deep-linked 1 seule fois + clear search).
- ✅ ~~`SpellRangeGrid.tsx` syntaxe JSX cassée~~ → **RÉSOLU (vérifié 09/09)** : `tsc` 0 sur le repo, fichier sain + prop `allowFreeCasterMove` ajoutée (bypass boss libre landing publique).
- ⚠️ Validation : mes fichiers **eslint 0 erreur** ; `tsc` vert.

## Chantier du jour (2026-09-04, suite) — Rush Sylvestre : refonte visuelle anti-slop + fil conducteur imagé
> Branche `feat/chantier-2026-09-04-cyber-rescan` — **rush non committé** (commit + PR `dev` à faire).
> Référence vs concurrent **Duffus** (capture) : consigne **inspiration, pas recopie** (100 % assets locaux).
- ✅ **Bug header ressources sidebar** (`RushChapterSidebar.tsx`) : titre écrasé → header 2 lignes, toggle compact, libellé Total/Encore selon mode, quantités `×`.
- ✅ **Fil conducteur** : ancres œufs 40px jalons liés + vignettes 32px chapitres (`RushTimelineClient.tsx`) ; strip `DofusProgressStrip` **branché puis retiré** (doublon + couverture `dofusId` trop faible — fichier conservé).
- ✅ **Panneau guilde** (`GuildStatusPanel.tsx`) : clic = filtre timeline + détail membres en ligne (top 8 + déplieur) ; modale vide supprimée ; **fix `%` jamais calculé**.
- ✅ **Hero diet** : 4 cartes KPI → 1 barre de statut ; boutons ghost unifiés ; **Signaler → icône** ; **Overlay → seul primaire** ; Niv.200 conservé.
- ✅ **Ambiance** : halo hero + glow œuf teintés au Dofus actif (CSS statique, 0 coût) + **particules** `GuideParticles` teintées + toggle Options persisté (défaut ON, reduced-motion OK).
- ✅ **Feedback overlay natif** (`RushOverlayFeedbackPanel.tsx`, nouveau) : le `Dialog` Radix portalait vers le document principal → formulaire `fixed` viewport overlay ; modale dashboard intacte.
- ✅ **Vérifs** : `tsc` 0 · `eslint` 0 erreur · 64/64 tests rush (`test:run` complet + `build` **non faits**).
- 🔴 **Reste n°1 (data, côté God)** : **backfill `dofusId`** (sélecteur existant) — débloque strip + panneau + ancres + vignettes. Puis check visuel + commit/PR.
- 📄 Mémo : `src/temp/memo-2026-09-04-rush-refonte-visuelle.md` · Maquettes : `src/temp/refonte-rush-sylvestre-2026.html`, `src/temp/refonte-guide-sylvestre/09-refonte-ui-ux-2026.md`.

## Chantier du jour (2026-09-04) — Rush Sylvestre : Pense-bête + modale de lancement + config GOD (PR #588)
> Branche `feat/chantier-2026-09-03-rush-ui-pense-bete` (9 commits) → PR #588 (base `dev`), **MERGEABLE**.
- ✅ **Retrait bouton + modale « Ressources » du dashboard** (conservés dans l'overlay).
- ✅ **Pense-bête** : bouton + modale **lecture seule** (liste des choses à préparer, une seule croix de fermeture).
- ✅ **Modale de lancement (4 étapes)** : choix perso → **préparation** (Metamob détecté + bouton « Lier », reset alignement optionnel, **métiers requis** déclarés ✓ / non déclarés → bouton « Déclarer ») → avancée membres → prêt. **Reset « Réinitialiser ce personnage »** ré-ouvre la modale ; **reset d'un autre perso (main + mules)** depuis la modale.
- ✅ **Config UI/UX éditable GOD** : `OptimizedGuide.rushUIConfig` (JsonB) + migration `20261013000000_add_rush_ui_config` + action `updateRushUIConfig` (audit `GOD_RUSH_UI_UPDATE`). **Onglet GOD « Lancement »** : aperçu + éditeur pense-bête (CRUD sections/items, métiers + **alternative**, **réordonnancement ↑/↓**) + toggles modale. **Fallback statique** si config vide. Côté membre : `resolveRushUIConfig`.
- ✅ **UI polish** : badges activité « pack +N » sur le dashboard (`classifyTags`), **célébration au changement de chapitre** (jade), **checkboxes 3 états** (à faire / en cours doré / terminée jade).
- ✅ **Bloc alignement** → lien vers `/dashboard/[guildId]/profile` (plus d'édition inline).
- ✅ **Modale Ocre +/−** : re-render immédiat + patch Metamob en direct (état local).
- ✅ **Fix** crash `AlignmentSection` (profil) — garde-fou `ORDERS[selectedAlignment] || []`.
- ✅ **Prisma** : migrations locales bloquantes résolues (`20261009`-`20261013`) → `Database schema is up to date!` (colonne `rushUIConfig` en base).
- ✅ **Vérifs** : `tsc` 0 · `eslint` 0 · vitest 484/484 · `npm run build` OK.

## État actuel (chantier Rush Sylvestre — session UX/sync)
- ✅ **Module Rush Sylvestre** (guide) **fonctionnel** — S4 « qui peut aider » (métier+niveau), S6 micro-célébration, S5 éditeur GOD (import icônes), S7 contexte chapitre (PR #571–#576 mergés dans `dev`).
- ✅ **Positions GPS copiables** dans l'overlay (liste, modale détail, objectif courant) via `RushCoordinateChip` + helper central `getSequenceCoord` (priorité `pos_tags` > titre > tips > note) dans `rush-guide-utils.ts`.
- ✅ **Dashboard aligné sur l'overlay** : modale **Ressources** globale (bascule **Restantes/Toutes** via `aggregateRushResources`), badge Main/Mule, fix `/travel` **2D** (plus de `worldId` parasite), suppression anciennes stats-pills, sidebar chapitre (rail). **Sync chapitre** : clic sur un header de chapitre (feed) → sélection auto dans la sidebar.
- ✅ **Copie du nom** d'une ressource (sans le chiffre) → modale ressources / liste overlay / sidebar chapitre (helper `copyToClipboard`).
- ✅ **Fix clipboard overlay** : `RushCoordinateChip` consomme `src/lib/clipboard.ts` (fallback `execCommand` pour webview / PiP) → n'affiche « Copié » que sur succès réel.
- ✅ **Ressources 200 → 515** : cause racine = séquence « Ressources à prévoir » **absente en base** (seed non idempotent). Corrigé en base (insert 477 items) + **seed rendu idempotent** (CLI `seed-rush-sylvestre-cli.mjs` + action serveur `seedRushSylvestreFromGuide`).
- ✅ **Item tags** : résolution accent-insensible + dictionnaire d'alias → unresolved **38→15** ; enrichissement propagé aux séquences DB.
- ✅ **Images ressources LOCAL-FIRST** : `resolveItemImage` sert directement le WebP siphonné `/uploads/assets-dofus/items/{id}.webp` (0 appel proxy, **0 dépendance DofusDB**) ; fallback `getItemImageFallback` → proxy (siphon à la volée). Composant partagé `ResourceImage` (`onError` → proxy). Les `249` items enrichis en remote DofusDB deviennent autonomes.
- ✅ **Modale Ressources « Restantes » décrémente** : cause = le dashboard passait `completedIds` (IDs de **chapitres**) à `aggregateRushResources` (filtré sur IDs de **séquences**) → rien n'était exclu. Corrigé : `allCompletedSeqIds` (séquences validées, en incluant les chapitres validés d'un coup) utilisé pour `resourcesRemaining` ; `gateAllCompleted` (overlay) inclut aussi les séquences des chapitres complétés d'un coup. **Synchro live** (BroadcastChannel).
- ✅ **Overlay responsive / compact** :
  - Scroll des quêtes **visible** : `<main>` passe en `min-h-0 overflow-y-auto overscroll-contain custom-scrollbar` (le `flex-1` seul ne scrollait pas, `min-height:auto`).
  - Panneau « À faire maintenant » **repliable** + chips en **rangée unique** (flex-nowrap, plus de wrapping) ; **auto-repli** quand l'overlay est réduit (`defaultCollapsed`).
  - Header **compact** : masque le label « Guide de progression » + la ligne perso, paddings réduits, **menu ⋯** regroupant les actions secondaires (tutoriel/guide/reset) — détection fiable de la taille réelle via **ResizeObserver** sur le conteneur (plus de `window.matchMedia` trompeur).
- ✅ **Validation** : `tsc` 0 · `eslint` 0 erreur (fichiers touchés) · `vitest` **484/484** (dont tests `resolveItemImage`/`getItemImageFallback` et `aggregateRushResources`).

## PR / Branche
- **Session UX/sync** → branche **`feat/rush-sylvestre-ux-v2`** (créée depuis `origin/dev` = `b185e5e61`, après merge PR #586) → PR vers `dev`.
- Merge propre : aucun chevauchement de fichiers avec `dev` (seuls `package-lock.json` + `sync-actions.ts` différaient dans `origin/dev`).

## NEXT (priorités — à faire)
- ⚠️ **Prod/Infra** — `prisma migrate deploy` sur l'env **déployé** : en local c'est réglé (`resolve --applied` sur `20261009`-`20261013`). À refaire là-bas si même cause « already exists ».
- 🔴 **Ops** — Ménage `Songes_Pour_Les_Noobs/` (177 f, 8.4 Mo) → `git rm -r --cached`.
- 🟠 **Data** — 15 `unresolved` restants (Feuille de Salace, Mesure de poivre, Bière du Chabrulé, Poiskaille en Fricassée, Kamas, « L' », phrases « ou 1 x »…) : pas d'équivalent `name.fr[]` DofusDB → mapping manuel ou acceptation.
- 🟠 **Data** — Intégrer les 15 quêtes « Apprentissage » (Ordres) : hors des 374 séquences ; mapping `alignReq`/camp requis.
- 🟡 **UI** — Liens NOOBS/DOFUSDB → modale (aujourd'hui nouvel onglet).
- 🟡 **UI** — Responsive : auto-replier aussi la barre de chapitre / le bloc recherche sur très petite hauteur ; mode compact en fallback auto très petit.
- 🟡 **Perf** — Factoriser `getSequenceHelpers` par guide / agréger « qui peut aider » par chapitre.
- 🟣 **Tech** — Nettoyer `as any` (~70 admin, ~64 timeline) ; confirmer suppression `RushOverlayQuestPanel.tsx` (orphelin).

## Références clés
- 🎨 **SOURCE D'ICÔNES OFFICIELLE (permanente, tout module)** : `C:\Users\user\Desktop\dofus_assets` (~23 770 fichiers : icônes 1x/2x, items 2x, sorts, monstres, UI…). On peut y piocher des icônes pour n'importe quel module, **UNIQUEMENT après les avoir proposées au user ET validées** avant intégration.
- Backlog canonique : `docs/ROADMAP.md` (à lire en premier en mode plan).
- Demandes ouvertes + annotations : `src/temp/chantier-actif.md`.
- Plan maître #223 : `src/temp/refonte-long-terme-discord-compatibilite/PLAN-MAITRE-RESILIENCE-DISCORD-LONG-TERME.md` + `sigilos-discord-resilience.md`.
- Dernier mémo détaillé : `src/temp/memo-2026-10-06-chantier-fiche-boss.md`.

## Vérifications globales habituelles
`npx tsc --noEmit` 0 · `npm run test:run` vert · `npm run build` OK · pas de `console.*` en prod.
