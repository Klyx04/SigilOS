# 🧠 CONTEXT — SigilOS (Contexte global à fournir à chaque prompt)

> **Point d’entrée du contexte projet — VERSION CONDENSÉE (mise à jour 2026-09-02).**
> ⚠️ L’historique détaillé des sessions (avant le 21/08/2026) est archivé **hors dépôt**
> (archives externes `A:\SigilOS--temp-archive-*`) — NON relu par les prompts.
> 📌 **État actuel & prochaines priorités** : voir `docs/agents/activeContext.md` (léger, à jour) — c'est la référence pour « où on en est ».
> Les sections ci-dessous décrivent l'**architecture & le produit** (stables). L'état du chantier évolue : suivez `docs/agents/activeContext.md` + la mémo de session `memo-*.md` la plus récente.

---

## 👉 À fournir pour chaque prompt (démarrage rapide)

- **→ Utiliser `docs/agents/PROMPT_START.md`** (à la racine) : bloc à coller + ligne selon le type (bug, sécu, infra, SEO, BDD).
- **Référencer `docs/CONTEXT.md`** en premier (ce fichier). L’IA lit ensuite selon le sujet (sécurité → `docs/SECURITY.md`, dev → `docs/RULES.md`, infra → `docs/MAINTENANCE.md`, SEO → `docs/plans/SEO_REPRISE.md`).
- **Ne pas** déverser tout le repo dans le prompt — `docs/agents/PROMPT_START.md` + `docs/CONTEXT.md` suffisent.

## 🏗️ Vue d’ensemble

- **Produit** : Bot Discord + Dashboard web pour la gestion de guildes Dofus (missions, ladder, calendrier, services, jeux, etc.).
- **Stack** : Next.js 16 (App Router + Server Actions + RSC) · React 19 · TypeScript 5 · Prisma 7 · PostgreSQL · Redis (BullMQ) · Discord.js v14 · Socket.IO · Tailwind 4.
- **Archi** : Server-first + App Router ; **multi-tenant** (une app pour toutes les guildes, données scopées par `guildId`).
- **Auth** : Auth.js v5 (Discord OAuth, JWT, cookies `httpOnly`/`SameSite`/`__Secure-*` en prod).
- **Infra** : VPS Docker (app, bot, workers, ws, db, redis, monitoring) orienté **Caddy** reverse proxy · **Cloudflare Workers** (proxies ladder/dofusbook) · Grafana/Prometheus · Sentry · Backups GPG → Cloudflare R2.
- **CI/CD** : GitHub Actions (`dev`→beta, `main`→prod), `npm audit`, Semgrep, Trivy, Gitleaks. Déploiement CD (build GitHub → images GHCR → VPS `scripts/deploy-cd.sh`, ~30s). Fallback historique `scripts/deploy.sh`, rollback `scripts/rollback.sh`. Voir `docs/MAINTENANCE.md`.

## 🧭 Chantier global — backlog unique

> 📌 Pour les prompts, lire **`docs/ROADMAP.md`** : c'est LA source unique des demandes ouvertes
> (blocs de session + entrées de module + priorités).
> L'historique annoté complet (toutes demandes depuis 2026, mémos, plans de chantier) est
> **hors dépôt** (archives externes `A:\SigilOS--temp-archive-*`, cf. `docs/arbo/ARCHIVES-TEMP-2026-09.md`).

### 🔴 PRIORITÉ #223 — Résilience Discord long terme (point dur : **16/11/2026**)
> ✅ **P0 + P1 + P2 + fix CodeQL FAIT + MERGÉ (PR #520, `6e5a779a3`)** — anti-obfuscation (name nullable, UI « Salon masqué ») · signature Ed25519 UNIFIÉE (anti-replay ±300 s, clé 64 hex, fail-closed 401) · route webhook au FORMAT RÉEL (PING→204, `APPLICATION_AUTHORIZED`/`DEAUTHORIZED` ; handlers Gateway morts supprimés — Gateway = source de vérité) · fetch membres centralisés · invite SANS `permissions=8` (bitmask 6356836904068) · User-Agent `DiscordBot (url, version)` · doc intents · **fix CodeQL SSRF** (barrière regex ancrée). Vérifs : tsc 0 · lint 0 · **283/283** · build OK · **CodeQL vert**.
> 🟢 **Reste (P3 + finition + veille)** : outbox BullMQ/Redis écritures Discord · révocation de session Auth.js sur `APPLICATION_DEAUTHORIZED` · rapatrier les fetch directs restants (`dungeon-finder-actions`, `service-actions`, `profile-actions`, `god-discord-actions`) · **veille mensuelle changelog Discord + jour J 16/11/2026**.
> 📄 Plan maître : `refonte-long-terme-discord-compatibilite/PLAN-MAITRE-RESILIENCE-DISCORD-LONG-TERME.md` · Source technique : `sigilos-discord-resilience.md` (⚠️ §12 = VEILLE) · Mémo : `archive/memos/memo-2026-08-21-resilience-discord.md` · Amorce : `prompt-next-chantier-2026-08-21-resilience-discord.md`.
> 🔒 Consignes stabilité long terme (plan maître §5) : couche anti-corruption unique, IDs only (jamais de noms), name nullable, v10 explicite, UA, signature + timestamp, **pas d’upgrade v11 sans preuve changelog**.

### Sessions récentes (résumé — détail dans l’archive)
| Session | Contenu |
|---|---|
| **16-17/09 (guide Sylvestre + logs/bans + sondages)** | **Branche `feat/refonte-landing-anti-slop` → PR #683 mergée dans `dev` (squash `81bef3b10`).** Guide **Sylvestre** d'abord : pictos = **assets réels du jeu** (import curé ; `public/assets/rush-sylvestre/` 8,83 Mo → 156 Ko), **alignement calculé en direct** (blason nu + « Alignement Bontarien · tranche 1 »), **remise à zéro** en 2 temps. Puis **pagination « une vue = un chapitre »** (interne **et** public : 1 panneau rendu au lieu de 59, pager haut/bas + sommaire repliable, ancres `#bloc-…` partageables, **ISR intacte**), **progression locale PAR PERSONNAGE** côté public (classe + pseudo + serveur facultatifs, **19 icônes de classe du jeu**, `src/lib/guest-progress.ts` : clés `sigil_guest_<slug>_c_<pseudo>-<idServeur>_…` — anciennes clés conservées, adoption à la 1ʳᵉ déclaration, overlay réaligné) et **sommaire public replié** (678 px → 40 px). 🐛 **« bugs de polices partout » = double encodage UTF-8→cp1252→UTF-8** de `src/app/globals.css` (452 chaînes : les flèches des liens externes réaffichent `↗` **U+2197**) réparé par **inverse exact** + garde-fou d'encodage (voir plus bas). Côté **logs / cycle de vie** : intents `GuildModeration` (ban manuel ou bot tiers ⇒ `BANNED`, y compris après un départ), `ARCHIVED` banni ⇒ `BANNED`, hygiène de compte `DEAUTHORIZED`, réintégration refusée tant que le ban Discord est actif, **libellés humains** + traduction des anciens codes dans l'écran des logs ; **sondages** retravaillés (options mémoïsées, barres `scaleX`, votants datés). Vérifs : tsc **0** · eslint **0 erreur** · vitest **1484 tests** (après fusion de `dev`) · build **OK en CI** (`Verify & Build` verte en 7m52s). Détail : `/docs/agents/activeContext.md` (session 17/09, suite). |
| **09/09 (nuit — landing boss + status + Ko-fi + prod)** | **✅ Landing `/boss` parité Succès** (filtre Titans, fiche boss+titan complète, simu + choix map, boss déplaçable `allowFreeCasterMove`) · **✅ Status Discord anti-spam** (garde-fou fréquence God effectif, living-status 1 embed, embed vulgarisé sans technos, worker 5 min) · **✅ Ko-fi E2E** (URL `/api/webhooks/kofi`, fix 401 proxy, remerciement `#DONS-KOFI` + ping si identifié, `is_public` respecté, `kofiChannelId`+migration) · **✅ Prod bot** (2e appli `SigilOS Prod` dédiée, mdp BDD réaligné alphanumérique — fin crash-loop 141k `TokenInvalid`) · **Git** : PR **#613 mergée** (dev, déployée beta `4dc682f7`) + PR **#614 ouverte** (migrations `IF NOT EXISTS`) · 10 branches mergées supprimées · local 100 % poussé. **Règles apprises** : 1 appli Discord par env (jamais de token partagé), `POSTGRES_PASSWORD` alphanumérique, `npx prisma@7.9.1` épinglé. Vérifs : tsc 0 · **587/587**. Détail : `/\docs/agents/activeContext.md` (session 2026-09-09). |
| **26/08** | **✅ Tuiles HD mondes 37/40 (Gouffre du Gigalodon, Sanctuaire des Jardins éternels) + revalidation cache `/game-data`** : 124 `hd_maps` téléchargées (w37 73/73, w40 51/51) via `scripts/sync-world-hd-maps.js` · **PR #553 mergée** (`71faef17c`) · **PR #554 mergée** (`25d16265f`) : `deploy-cd.sh --wait-timeout 240` conditionnel (étape 3 plus figée) + `.gitignore` `*.candidate-*` (+ fix conflit git `worldmap.json`/`worlds.json` via `--no-skip-worktree` + stash/pull/drop). **Correctif cache** (les mondes 37/40 étaient invisibles dans le sélecteur après déploiement à cause d'un `worldmap.json`/`worlds.json` mis en cache heuristique par le navigateur — `/game-data/*` n'avait pas de `Cache-Control`) : `Caddyfile` → `header Cache-Control "no-cache, must-revalidate"` sur `/game-data/*` + `src/components/worldmap/map-viewer.tsx` → `fetch(..., {cache:'no-cache'})` sur `worldmap.json`/`worlds.json`. Vérifié : tsc 0 · serveur = 15356 maps (w37 73, w40 51) · `visibleWorlds` = 37 mondes **dont 37/40 (les 2 derniers du dropdown)**. Branche fix : `fix/worldmap-cache`. |
| **23/08 (one-shot 6 chantiers #232/#231/#230/#228/#226/#225)** | **VÉRIF code-level + fix archive/réactivation PRÊT (non commité)** — branche `feat/chantier-2026-08-23-one-shot` (commit `990794680`). ✔ **#230** durcissement `transferGuildOwnership` (`god-lifecycle-actions.ts`) + **316/316 tests** · **#228** patch `router.push`/`replace` (`originalPushRef`/`originalReplaceRef`/`makeGuarded`) **inclus dans le commit → à valider runtime** · **#226** modale conservée (drawer rejeté → **P5 fermable**), P1/P3/P4 faits, **P2 hiérarchie fine + P6 transitions restent** · **#225** champ icône + seed `dokille` + `imageUrl` + bandeau « Le Safari des Krokilles » faits — **manquent 4 seeds quêtes Safari + trackeur communautaire krokille** (`DofusQuestManagerV3` générique, pas de module krokille). 🖼️ **Avatar 404** : hash Discord **obsolète** `5491982a…` en BDD → `cdn.discordapp.com` 404, mais `discord-avatar-image.tsx` = `AvatarImage` en cascade → **l'avatar reste affiché** (simple bruit réseau/log) ; **aucun fix** appliqué. 📌 **Fix archive/réactivation** (cache `profile:{userId}:{internalGuildId}` périmé 60 s : `invalidateUserContextCache` appelé avec le mauvais ordre d'args + auto-guérison snowflake ajoutée) : **3 fichiers non commités à committer** (`lifecycle-actions.ts`, `user-actions.ts`, `user-context.test.ts`). ⚠️ Fichiers sans rapport (landing/`page.tsx`, `galactic-footer`, `avatar.tsx`, `DjFiltersBar`, `DjPostCard`, `DjPostDetailModal`, `DungeonFinderClient`, `DofusQuestGodManager`, `faq-section`, `module-succes/*`) **laissés de côté**. |
| **23/08 (vitrine prod)** | **Vitrine `sigilos.fr` saine (fix `/assets/*`)** : cause racine = Caddyfile/compose **VPS périmés** → `/assets/*` retombait sur `maintenance.html` (HTML) au lieu des PNG → restaurés depuis `origin/main` (`handle /assets/*` + mount `./public:/srv/static:ro`) via `git restore --source=origin/main -- Caddyfile docker-compose.prod.yml` (**sans** `git checkout -- .` pour éviter le conflit `public/game-data`) → Caddy recréé (`sigilos-gateway`). Vérifs : `/` → 200 HTML · `/assets/screenshots/screenshot1.png` → 200 PNG · `/assets/ui/logo-v2.png` (favicon+og:image) → 200 PNG · 404 `favicon.svg` = **faux positif** (non référencé, chemin inexistant). ⏳ **Reste** : VPS toujours sur `dev` (stashes + `public/game-data` modifié) → migration `main` à planifier · branches nettoyées (`dev`, `main`, `feat/inter-guilde` conservées). |

| **23/08** | **Landing & ouverture prod (vitrine `maintenance.html` + `page.tsx`)** : CTA contrasté (`.header-nav a.header-cta` → 6.67) · `docs/plans/DECISION-OUVERTURE-LANDING.md` créé (décision + checklist ouverture) · Caddy `sigilos.fr` = `rewrite * /maintenance.html` (L75) · **métadonnées vérification Discord validées** : 4/6 manquants = URLs (CU, privacy, install) à remplir après ouverture (pointeur « offensive » déjà OK) · placeholders Discord/Portal/Dev remplis avec liens prod après ouverture (décidé — aucun code à changer) · **`/legal/*` existent** (`src/app/legal/{cgu,privacy,mentions,faq}/page.tsx`, contredit les recherches précédentes). ⏳ **Décision user pendante** : refonte immersive landing React maintenant ou après ouverture · preview `:9320` (PID 61956) jusqu'à confirmation. |
| **22/08** | **BLOC A complet (9 quick wins)** : #192 bouton Suivant darkmode · #199 tour Succès (ancres stables) · #204 upload missions masqué pour God · **#201 embeds prêts/coffre** (migration `20260822000000_add_loan_vault_discord_embeds` + suppression embed à la clôture/purge) · #202 RBAC footer sticky bas + indicateur non-sauvé · #206 Dofoobz image locale · #203 multi-DJ taille de groupe par donjon ; #286/#247 vérifiés déjà corrigés. Vérifs : tsc 0 · lint 0 erreur · 313/313 · build OK. Mémo : `archive/memos/memo-2026-08-22-chantier-bloc-a.md`. |
| **22/08 (suite)** | Fix #206 Dofoobz **centralisé** (`src/lib/dofus-image-url.ts` + test, commit `1075b032a`) appliqué au hub Quêtes Dofus + profil. ✔ **Rebasé sur `origin/dev` (22/08) : divergence résolue, branche prête à merger (PR propre, 10 commits ahead).** Prochaine session : **#228 étendre `UnsavedChangesGuard` à galerie/présentation/services/donjons** + **#227 épurer l'UI de la notif partout**. |
| **22/08 (sécurité CodeQL)** | Fix `js/incomplete-url-scheme-check` : `UnsavedChangesGuard` rejette désormais `javascript:`/`data:`/`vbscript:` (helper `isExecutableScheme` : decodeURI `%xx` + trim + minuscules, insensible casse, `preventDefault` pour bloquer l'exécution au lieu de laisser le navigateur) — commit `87f56e076` + docs `13ceecc54`. Branche **12 ahead / 0 behind** `origin/dev` → PR-ready (PR à créer si pas ouverte). Vérifs : tsc 0 · lint 0 erreur · **316/316** · pre-commit vert. |
| **09/08** | Module « Titans » (branche `feat/slash-rework`, non commité) : modèle `Titan`/`DjSearchMode.TITAN` + migration · Admin God · seed Gargandyas (8062, Osavora) · `SuccesTitanTab` parité fiche boss (Stats/Simulation/Monstres) · DJ Titan (taille FIXE + date/heure calquée sur dispo, cron couvre TITAN, file d'attente) · barre de vues Succès en assets Dofus (« Fiche Titans ») · fix overlay retour `/boss` + catalogue épuré. ⚠️ `SpellRangeGrid.tsx` JSX cassé (tsc) à réparer. |
| **05/10-06/10** | Module Fiche Boss & Simulation tactique 100 % terminé (16 commits poussés) — géométrie Dofus 3 exacte, sorts Dofensive enrichis, sync intelligente local-first (701 maps + 87 fiches), refonte fiche boss, migration portable. |
| **04/10** | Anti-AI-slop UI global (6 commits) — primitives plates, home + ~13 modules, auth/docs. |
| **02-03/10** | Fiches boss + simulateur de portée + fix RBAC/cache + guides raids (Gigalodon, Jardins Éternels). |
| **20/09** | ONE-SHOT 13 chantiers restants : #127 RBAC ressources, #85 blacklist embeds, #169 boutons DJ, #172 tour Succès, #176 fiches boss, #101 SEO, guides raids, #181 privacy, #96 README, #34 télémetry UX, #41bis circuit-breaker. |
| **01-07/09** | #148 modale quête God (gros lot), #138 module Succès dédié, #141 Accès Restreint, place de marché, refonte vue Guilde, perf/virtualisation. |
| **19-31/08** | Batch dashboard, dark mode V1+V2 (tokens OKLCH, sweep blancs/états/hex/landings + garde-fou ESLint), refonte landing #80, relances, bans → tombstones, avatars Discord résilients. |

## 🎨 Assets disponibles (réutilisables dans tout chantier)

- **Design / directions UI (maquettes HTML à plat)** : **archivées hors dépôt le 19/09/2026** → `A:\SigilOS--temp-archive-2026-09-19\lot4-src-temp-avant-vidage\` (`sigilos-home-direction-2026.html`, `test.html`, `refonte-rush-sylvestre-2026.html`, `refonte-marche/maquette-lot-multiple.html` — recherche par nom de fichier). Cf. `docs/arbo/ARCHIVES-TEMP-2026-09.md`.
- **Landing / vitrine** : `public/assets/landing/` → `bg-guild.jpg` (hero), `icone-dofus.png`, `mission-preview.png`, `songes-preview.png` · `public/assets/icons/dofus_landing.png` · `public/hall-guilde.jpg` · `public/noise.svg`. **Figures de la landing** : **mockups vectoriels** (`src/components/landing/registre/*-mockup.tsx` — dashboard, calendrier, guide, missions) — **plus aucune capture PNG depuis le 20/09/2026** : `src/lib/landing-figures.ts`, son test et les 4 visuels `public/assets/screenshots/{dashboard-guilde,calendrier-sorties,missions-guilde,guide-sylvestre}.png` ont été supprimés. Image de partage social : `public/assets/landing/bg-guild.jpg` (1250×639, référencée par `public/maintenance.html`). Les captures restantes de `public/assets/screenshots/` servent les **guides** (`src/lib/docs-catalog.ts`). L'interface God `/god/landing` (feature #140, table `LandingScreen`) a été **retirée le 17/09/2026**.
- **Icônes Dofus** : `public/module-dofus/Dofus_*.png` (28 fichiers, dont `Dofus_Dofoozbz.png`). **Classes** : `public/assets/dofus/classes/<n>.png` (19 fichiers) — passer par `DOFUS_CLASSES`/`getClass()` (`src/lib/dofus-assets.ts`), jamais par une URL écrite à la main. **Serveurs Unity** : `DOFUS_UNITY_SERVERS` (`src/lib/presentation-constants.ts`, groupés Monocompte/Classique/Pionnier mono/Pionnier/Épique) — il n'existe **pas** d'icône de serveur dans le dépôt (nom seul).
- **Ambiance audio Dofus (archivé, **hors dépôt** depuis le ménage du 17/09/2026)** : les 8 mp3 (`Dofus_{Ebene,Emeraude,Ivoire,Nébuleux,Ocre,Pourpre,Turquoise,Vulbis}.mp3`) sont dans `A:\SigilOS--temp-archive-2026-09-17\lot5\ambiance-dofus\` ; la spec reste à `archive/media/ajout-ambiance-Dofus/spec-audio-dofus-dashboard.md` (+ `LISEZ-MOI.md`).
- **Divers (archivé)** : `archive/media/` → `fuji-dofensive.png`, `fuji-sigilos.png`, `map-servitude.png`.
- **Uploads (`/api/upload`, super-admin only)** : l'écriture va dans `private_uploads/<scope>/` et l'URL publique est `/uploads/<scope>/<uuid>.webp`, réécrite par `src/proxy.ts` vers `/api/storage/<scope>/…`. **Le scope décide de la visibilité** : `docs` (défaut) exige une session, tandis que `guides` et `assets` sont servis **publiquement** (`isPublicPresentationAsset` dans `src/app/api/storage/[...path]/route.ts`). Un visuel affiché sur une page publique (image de bloc de guide, bandeau) doit donc être uploadé avec `uploadImageFile(file, "guides")` — sinon l'image répond **401** aux visiteurs anonymes. ⚠️ Le scope `landing` a existé pour la feature #140 : il a été **retiré le 17/09/2026** avec le reste du pilotage God de la landing.
- **Progression invitée (guide public, sans compte)** : tout vit dans `localStorage`, sous `sigil_guest_<slug>_…` et **la clé décide du personnage** — `sigil_guest_<slug>_completed_ms|steps|bookmarks` (visiteur **sans** personnage déclaré, clés historiques) ou `sigil_guest_<slug>_c_<pseudo>-<idServeur>_…` (personnage déclaré : classe + pseudo + serveur, tous facultatifs). Passer **toujours** par `src/lib/guest-progress.ts` (`guestProgressPrefix`, `readGuestProgress`, `readGuestCharacter`, `adoptAnonymousGuestProgress`) : c'est ce module qui garde la page publique **et** `GuideOverlayClient` sur le même emplacement (`guestStoragePrefix`), et qui évite d'écrire une clé à la main (donc de perdre la progression d'un visiteur).
- **Encodage des fichiers (règle dure)** : tout fichier du dépôt est en **UTF-8 sans BOM**. **Ne jamais** réécrire un fichier source avec `Get-Content` / `Set-Content` / `Out-File` / `>` de **PowerShell 5.1** : il *lit* l'UTF-8 en Windows-1252, donc un simple aller-retour transforme `↗` en `↗` (U+00E2 U+2020 U+2014), `é` en `é`, `─` en `─` — c'est un **double encodage silencieux** (déjà arrivé sur `src/app/globals.css`, ~450 chaînes ; les formes fautives sont montrées ici **exprès**). Éditer avec les outils de l'IDE, et contrôler après toute retouche massive : `node scripts/scan-mojibake-all.mjs` doit afficher **0 fichier** (réparation : `fix-mojibake.mjs`).

## 🔒 Non-négociables (résumé — détail : `docs/RULES.md` + `docs/SECURITY.md`)

1. **Auth sur chaque action** : `auth()` / `getUserContext(guildId)` en début.
2. **Guild isolation** : toute requête BDD filtrée par `guildId`.
3. **Fail-closed, jamais fail-open** : si une API tierce échoue → REFUSER.
4. **Pas de secret en dur ni de fallback** : `process.env.*` uniquement.
5. **Comparaison de secrets en temps constant** (`timingSafeEqual`).
6. **Validation & bornes** : Zod sur toutes les entrées ; borner les valeurs externes.
7. **Vérifier l’appartenance à la guilde** avant toute écriture multi-tenant.
8. **Pas de `console.log` en prod** → `logger` de `@/lib/logger`.
9. **Rapports d’audit JAMAIS commités** (`docs/audits/`, `AUDIT_*.md`, `src/audit-*`).
10. **Secrets jamais commités** (`.env*`).

## 📚 Références détaillées

| Fichier | Rôle |
|---------|------|
| **`docs/CONTEXT.md`** | Ce fichier — point d’entrée (condensé) |
| [`RULES.md`](./RULES.md) | Conventions + règles sécu non-négociables + patterns copy-paste |
| [`SECURITY.md`](./SECURITY.md) | Politique de sécurité **publique** : signalement privé, périmètre, garanties |
| [`MAINTENANCE.md`](./MAINTENANCE.md) | Infra VPS : backups, monitoring, déploiement, urgence |
| [`DEVELOPPEMENT.md`](./DEVELOPPEMENT.md) | **Mise en route locale** : prérequis, les 3 fichiers `.env`, démarrage, commandes npm, tests, déploiement, dépannage (le `README.md` racine est une **vitrine publique**, sans détail technique) |
| [`DECISION-OUVERTURE-LANDING.md`](./plans/DECISION-OUVERTURE-LANDING.md) | **Décision ouverture prod & landing immersive** : vitrine `maintenance.html` vs `page.tsx`, checklist ouverture, statut CTA contrasté |
| [`prisma/schema.prisma`](../prisma/schema.prisma) | Schéma BDD (source de vérité) |
| `refonte-long-terme-discord-compatibilite/` | Chantier #223 : plan maître + source technique résilience |
| archives externes | Historiques complets + mémos/amorces/média **hors dépôt** (`A:\SigilOS--temp-archive-*`) |

## ⚙️ Règles d’interaction avec l’IA

0. **Terminal local = PowerShell** (séparateur `;`, pas `&&` ; `Remove-Item -Recurse -Force`).
1. **Ne jamais modifier** `docs/audits/`, `src/audit-*`, `AUDIT_*.md`.
2. **Respecter** `docs/RULES.md` (fail-closed, validation, guild isolation, logger).
3. **Avant tout commit** : pas de secret, pas d’audit, `npm run test:run` + `npm run build`.
4. **Nommer les findings** F-xx + fichier précis.
5. **Pousser** sur une branche, puis PR vers `dev`.
6. **Scripts `.ps1` de refactoring ponctuel = HORS GIT** (seuls les scripts de build/déploiement/maintenance sont commités).
7. **Captures d'écran** : pour tout retour visuel (UI, maquette, bug d'affichage, rendu carte/donjon/quête), **demander au user une capture d'écran** plutôt que de deviner.

## 📚 Système de Documentation Intégré (DocDrawer)

> Référence : `prisma/seed-docs.ts` · Contenu en base `DocPage` · `npm run seed:docs` pour synchroniser.

### Architecture du système

| Fichier | Rôle |
|---------|------|
| `prisma/seed-docs.ts` | Source de vérité de toutes les documentations (HTML sémantique) |
| `src/components/doc/doc-drawer.tsx` | Slide-over contextuel (TOC auto, scroll-spy, plein écran) |
| `src/components/doc/doc-drawer-context.tsx` | Context React global `openDoc(slug, title)` / `closeDoc()` |
| `src/components/doc/module-help-actions.tsx` | Bouton `[ 📖 Documentation ]` + `[ ❓ Tutoriel ]` à placer dans chaque header de module |
| `src/app/docs/layout.tsx` | Page de documentation complète avec sidebar catégorisée |
| `src/app/docs/[...slug]/_components/doc-viewer.tsx` | Rendu d'une page doc avec TOC latérale droite |
| `src/server/actions/doc-actions.ts` | RBAC : filtre les docs selon `isAdmin`/`isMember`/`PUBLIC` |
| `src/components/doc/doc-content.tsx` | Sanitisation HTML + classes CSS (`callout-tip`, `callout-info`...) |

### Intégration dans un module

```tsx
// Dans le header de chaque page de module (next to tour button)
import { ModuleHelpActions } from "@/components/doc/module-help-actions";

<ModuleHelpActions
    docSlug="mon-module"          // Correspond au slug dans seed-docs.ts
    docTitle="Titre du Module"    // Affiché dans le drawer
    tourPhase="monModuleTour"     // Phase du tour interactif
/>
```

### Niveaux d'accès (RBAC)

| `accessLevel` | Visible par |
|---------------|-------------|
| `PUBLIC` | Tout visiteur non connecté |
| `MEMBER` | Membres connectés avec accès dashboard |
| `ADMIN` | Staff et administrateurs uniquement |

### Classes CSS disponibles dans le contenu HTML

```html
<div class="callout callout-tip">💡 Astuce</div>
<div class="callout callout-info">ℹ️ Information</div>
<div class="callout callout-important">⚠️ Important</div>
<div class="callout callout-warning">🚨 Attention</div>
<table>...</table>   <!-- Tableaux stylés automatiquement -->
<ol class="steps">   <!-- Liste d'étapes numérotées -->
```

### Déploiement VPS

`scripts/deploy.sh` exécute automatiquement `npm run seed:docs` — les docs sont toujours à jour en prod.

---

## 🗂️ Archives (tout est conservé, rien n'est supprimé)

- Historique complet des sessions : `archive/contexte/CONTEXT-historique-complet-2026-08-21.md`
- Historique complet du chantier (toutes demandes annotées) : `archive/contexte/chantier-historique-complet-2026-08-21.md`
- Mémos anciens : `archive/memos/` · Amorces anciennes : `archive/amorces/` · Média : `archive/media/`
