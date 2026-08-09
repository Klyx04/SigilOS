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
- **Merger la PR `feat/deploy-clean-pro` → `dev`**, puis `./scripts/deploy-cd.sh beta` (avec le script corrigé).
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

## 🧭 Chantiers de sécurité restants (rappel — voir SECURITY.md)

**État au 01/08/2026 :** F-02, F-06/F-03, F-04, F-01, F-12, F-23/F-24, F-19/F-27/F-26/F-18/F-22 corrigés. **Session d'après-audit (01/08) ajoutée :** F-08 (auth WS), F-05 (chiffrement OAuth), F-04 (fail-closed + IP fiable), F-02 (expiration + clé dédiée), F-07 (JWT 8h), F-03 (SSRF image-downloader). **Rapports centralisés :** `docs/audits/` (hors git). Reste :

> ✅ **Résolu (09/08)** : **CSP nonce-based déployée** (Report-Only, commit `918fa308`) · **clé de chiffrement de secours retirée** (F-09) · **`WS_AUTH_ENABLED=true` activé en beta** (F-08, à tester puis activer en prod).

**Reste :**
- **1. Zero Console Policy** : ✅ **FAIT (09/08)** — 433 `console.*` → `logger` (commits `4355d540` + `7dc0c01f`). Vérifs 126/126 · tsc 0 · build OK. Script `.ps1` hors git.
- **2. Audit BDD tokens OAuth** : ✅ **TERMINÉ (09/08)** — beta 126/126 chiffrés · prod 3/3 re-chiffrés → **F-05 FERMÉ**.
- **3. Infra** : ✅ **I-06 (unifier Discord) FAIT + déployé beta** (`5e4921aa`) · ✅ **I-07 (séparer Redis) FAIT + déployé beta** (`de97fb3d`) · ✅ **I-15 (circuit breaker) FAIT** (`7efd4bf9`). ✅ **F-14 Caddy rate-limit : DÉPLOYÉ** (image custom `sigilos-caddy`, module `rate_limit`).

✅ **Résolu le 09/08** (en plus de la ligne ci-dessus) : **Cache permissions TTL 30s + cache positif (F-13/F-01)** · **proxy-image borné (F-06)** · **sanitisation HTML centralisée (F-11)** · **hook `updateMany` chiffrement OAuth (F-05)** · **rotation `GOD_ROUTE`** · **WS auth beta + prod (F-08)** · **CSP_ENFORCE beta activé** · **`app-prod` unhealthy réparé** (mot de passe DB encodé) + **rotation mot de passe Postgres prod** · **F-14 déployé**.

**Infra :** I-01 à I-17 traités. **Reste infra :** rien de bloquant (I-06/I-07/I-15/F-14 faits). **Gartic/Skribbl supprimés** du code.

---

*— Fichier de contexte global maintenu à jour (créé à l'issue de l'audit 2026). —*