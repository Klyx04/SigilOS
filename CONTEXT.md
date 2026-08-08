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

---

## 🗂️ Chantiers restants documentés (rappel — d'autres arriveront)

| Chantier | Réf / fichier | État |
|----------|---------------|------|
| Rotation secret `GOD_ROUTE` (fuité en git) | `src/temp/evolution4.md` | ⚠️ À faire |
| CSP nonce-based (`unsafe-inline`) | `SECURITY.md` | Reste |
| Clé de chiffrement de secours dev | `SECURITY.md` | Reste |
| Cache permissions 60s (F-13) + fallback RBAC (F-01) | `SECURITY.md` | Reste |
| Caddy rate-limit (F-14) | `SECURITY.md` | Reste |
| proxy-image limites/footprint (F-06) | `SECURITY.md` | Reste |
| Sanitisation HTML centralisée (F-11) | `SECURITY.md` | Reste (lié à dompurify) |
| Activer `WS_AUTH_ENABLED` en beta | `SECURITY.md` | À activer |
| Évol 4 restant (B3-B5 overview, A4 purge, Évo 2/3) | `CONTEXT.md` / `evolution4.md` | ⚠️ |
| **Tours admin** : enrichir + sous-cartes par module | `src/temp/memo-2026-08-08-tours-admin.md` | ⚠️ Suite |
| Vérifier build Next.js complet (CI Verify and build) | branche `feat/onboarding-admin-tour` | ⚠️ |
| Déployer PR #405 (rate-limit) beta + rotation GOD_ROUTE | `CONTEXT.md` | ⚠️ |
| **Ladder Discord** : déployer fix + test manuel (puis prévoir SUSPECT A si besoin) | `memo-2026-08-08-ladder-discord.md` | ✅ Corrigé, à déployer |

---

## 🧭 Chantiers de sécurité restants (rappel — voir SECURITY.md)

**État au 01/08/2026 :** F-02, F-06/F-03, F-04, F-01, F-12, F-23/F-24, F-19/F-27/F-26/F-18/F-22 corrigés. **Session d'après-audit (01/08) ajoutée :** F-08 (auth WS), F-05 (chiffrement OAuth), F-04 (fail-closed + IP fiable), F-02 (expiration + clé dédiée), F-07 (JWT 8h), F-03 (SSRF image-downloader). **Rapports centralisés :** `docs/audits/` (hors git). Reste :

- **1. CSP nonce-based** (remplacer `unsafe-inline`) — chantier séparé (Report-Only d'abord).
- **2. Clé de chiffrement de secours** en dev (`encryption.ts` fallback).
- **3. Cache permissions 60s** (F-13 — réduire TTL).
- **4. Caddy rate-limit** (F-14 — au niveau proxy).
- **5. F-01 partiel** : fallback RBAC `guards.ts` (l.96-117, 229-244) + cache « positif seulement » à consolider.
- **6. F-06 partiel** : proxy-image sans limite de taille ni magic bytes (à compléter).
- **7. F-11** : sanitisation HTML centralisée.

**Déploiement :** F-08 (auth WS) est fourni avec kill-switch `WS_AUTH_ENABLED=false` → **activer en beta d'abord**, tester reconnexion, puis prod.

**Infra faite (01/08) :** I-03, I-04, I-05, I-10, I-11, I-12, I-02, I-08. **Faux positifs écartés :** I-01, I-17. **Reste infra :** I-06 (unifier Discord), I-07 (séparer Redis), I-15 (circuit breaker). **Gartic/Skribbl supprimés du code** (dashboard + code mort retiré).

---

*— Fichier de contexte global maintenu à jour (créé à l'issue de l'audit 2026). —*