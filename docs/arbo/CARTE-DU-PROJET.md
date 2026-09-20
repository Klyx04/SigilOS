# Carte du projet SigilOS — « c'est quoi ce fichier ? »

État au 20/09/2026. Objectif : pouvoir répondre, pour n'importe quel fichier du dépôt : **à quoi il sert,
qui l'utilise, et s'il peut partir.**

## 0. La méthode : « ce fichier sert-il encore ? » (3 commandes)

```bash
# 1. Qui le cite ? (code, docs, scripts, CI)
git grep -n "nom-du-fichier"

# 2. Quand a-t-il bougé pour la dernière fois, et par quel chantier ?
git log --oneline -3 -- chemin/du/fichier

# 3. Est-il lancé par npm, Docker, ou une procédure d'ops ?
grep -rn "chemin/du/fichier" package.json Dockerfile* docker-compose*.yml .github/ .husky/
```

Verdict : **cité + lancé** = vivant (à garder) · **cité seulement dans un vieux mémo/roadmap** = historique
(archive externe) · **plus cité nulle part** = one-shot déjà livré (archive externe).

---

## 1. Les dossiers de la racine

| Dossier | À quoi il sert | Vivant ? |
|---|---|---|
| `src/` | Le site Next.js (pages, composants, logique serveur) | ✅ cœur du projet |
| `prisma/` | Schéma BDD + 253 migrations + données de seed des modules Dofus | ✅ |
| `public/` | Tout ce qui est servi en statique (assets, images, game-data, uploads) | ✅ |
| `scripts/` | Outils de dev/ops : seeds, siphons de données Dofus, déploiement, worldmap | ✅ trié (76 fichiers — lot L5 du 19/09) |
| `tests/` | Tests vitest (162 fichiers, 1722 tests) | ✅ |
| `docs/` | **Toute la documentation du projet** + `docs/audits/` (non suivi) | ✅ arbo unique depuis le 20/09 (§2bis) |
| `services/` | Le **bot Discord** (process Node séparé, 117 Mo avec son `node_modules`) | ✅ |
| `cloudflare-workers/` | 3 Workers Cloudflare (proxies Dofusbook / Ladder) | ✅ |
| `monitoring/` | Config Prometheus **unique** (dev **et** prod) | ✅ unifié le 20/09/2026 — l'ancien doublon `prometheus/prometheus.yml` est supprimé |
| `.gemini/` | Brouillons locaux d'un assistant IA (**ignoré par git** : plus rien de suivi) | ❌ jetable |
| `.github/` `.husky/` | CI/CD + hook pre-commit (scan de secrets, tsc, vérif migration Prisma) | ✅ |
| `node_modules/` `.next/` `dist/` `.playwright-profile/` | Artefacts locaux (jamais commités) | ❌ jetables |

## 2. La racine, fichier par fichier (26 fichiers suivis)

> **Pourquoi tout ça à la racine ?** Trois familles, par ordre de contrainte :
> 1. **Imposé par l'outil** (déplacer casse le build) : `package.json` / `package-lock.json`, `next.config.ts`,
>    `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `prisma.config.js`,
>    `sentry.{client,server,edge}.config.ts` (lus **à la racine** par `@sentry/nextjs`), `Dockerfile`,
>    `.dockerignore`, `.gitignore`, `.gitattributes`, `.npmrc`, `.env`.
> 2. **Convention forte de l'écosystème** (déplaçable, mais tout le monde l'attend là) : `AGENTS.md`
>    (standard lu **automatiquement** par les assistants IA — Cline, Cursor, Copilot, Codex…),
>    `components.json` (CLI shadcn), `docker-compose.yml` / `docker-compose.prod.yml` / `Dockerfile.caddy` /
>    `Caddyfile` (référencés par les scripts de déploiement et la CI), `README.md`, `.env.example`.
> 3. **Supprimés / générés** : `tailwind.config.ts` (mort — Tailwind v4 est *CSS-first*, la config n'est
>    jamais lue) ; `tsconfig.tsbuildinfo` et `next-env.d.ts` sont générés et ignorés par git.

| Fichier | Rôle |
|---|---|
| `AGENTS.md` | **Amorce des assistants IA** (créé le 20/09/2026) : point d'entrée unique, lu **automatiquement** — routage vers les sources de vérité, invariants de sécurité, hygiène « zéro dette ». Il **ne duplique aucune doc** (il route). |
| `README.md` | **Vitrine publique** du projet (aucun détail technique) — l'un des **2 seuls `.md` de la racine** (avec `AGENTS.md`) ; la mise en route locale est dans `docs/DEVELOPPEMENT.md` |

> 📌 **Toute la documentation vit dans `docs/`** : index `docs/README.md`, arborescence détaillée §2bis.
> **Supprimés le 19/09/2026** : `WORKFLOW.md` (doublon exact de `docs/RULES.md §Git Workflow`, zéro citation) et
> `USER_ACTIONS_REQUIRED.md` (checklist de mise en production one-shot, zéro citation) — récupérables via `git log`.
> **Supprimés le 20/09/2026** : `.antigravity` (58 Ko de contexte d'assistant, **figé depuis le 31/08** → remplacé par
> `docs/CONTEXT.md` + `docs/agents/activeContext.md`) et les kits `_menage-*` (archivés hors dépôt).

| Fichier | Rôle |
|---|---|
| `package.json` / `package-lock.json` | Dépendances + scripts npm (`dev`, `build`, `test:run`, `seed:docs`, `build:worker`…) |
| `next.config.ts` | Config Next.js (images, redirections, sécurité) |
| `tsconfig.json` | Config TypeScript |
| `postcss.config.mjs` / `components.json` | Design system (Tailwind v4 **CSS-first** + shadcn) |
| `eslint.config.mjs` | Règles de lint |
| `vitest.config.ts` | Config des tests |
| `sentry.client.config.ts` / `.server.` / `.edge.` | Monitoring d'erreurs Sentry (3 runtimes) |
| `prisma.config.js` | Config Prisma |
| `Dockerfile` / `Dockerfile.caddy` | Images Docker de l'app et du reverse-proxy |
| `docker-compose.yml` / `docker-compose.prod.yml` | Orchestration (dev/CI vs prod) |
| `docker-entrypoint.sh` | Point d'entrée conteneur (migrations au boot) |
| `Caddyfile` | Reverse-proxy (TLS, routes, cache statique) |
| `.env.example` | Modèle des variables d'environnement (**seul `.env*` versionné**) |
| `.gitignore` / `.gitattributes` / `.dockerignore` | Exclusions git / normalisation des fins de ligne / exclusions Docker |
| `.gitleaks.toml` | Règles de détection de secrets |
| `.npmrc` | Config npm |

## 2bis. `docs/` — l'arborescence de la documentation (une seule, depuis le 20/09/2026)

```
docs/
├── README.md                      index de la documentation (« où est quoi »)
├── CONTEXT.md                     point d'entrée technique (ex-racine)
├── RULES.md                       conventions de code + sécurité (ex-racine)
├── SECURITY.md                    politique de sécurité (ex-racine ; GitHub lit aussi docs/)
├── MAINTENANCE.md                 ops : cron, déploiement, incidents (ex-racine)
├── ROADMAP.md                     backlog priorisé + workflow de session
├── agents/                        consignes données aux assistants IA (ex-`.agents/workflows/`) ;
│   │                              l'amorce lue automatiquement est `AGENTS.md` (RACINE)
│   ├── session-amorce.md · activeContext.md · git-push.md · prisma-schema-change.md
│   └── add-cron-task.md · discord-module.md · dev-local.md · deploy-vps.md ·
│       disaster-recovery.md · dofus-quest-compile.md · siphon-worldmap.md · sync-game-assets.md
├── ops/                           runbooks d'exploitation (GUIDE-DEPLOIEMENT-PROD-JOUR-J.md)
├── plans/                         chantiers produit (ONBOARDING, LANDING, SEO)
├── reference/                     références stables (I18N, GLOSSARY-EN, OCR, Dofusbook, hardening…)
├── arbo/                          état de l'arbo (CARTE, AUDIT-ARBO, ARCHIVES-TEMP)
└── audits/                        rapports d'audit locaux (ignorés par git)
```

> **Règle** : un nouveau `.md` va **toujours** dans `docs/` (jamais à la racine de `src/`, `scripts/`…).
> Seules exceptions : `README.md` à la racine et les `README.md` colocalisés d'un sous-projet autonome
> (`prisma/seed-data/README.md`, `cloudflare-workers/dofusbook-proxy/README.md`).

---

## 3. `src/` — le cœur Next.js (1 246 fichiers suivis)

| Dossier | Rôle | Volume |
|---|---|---|
| `src/app/` | **Les routes** (App Router) : pages publiques, `dashboard/[guildId]/…`, `god/…`, et toutes les API (`app/api/…`) | 427 |
| `src/components/` | Composants React réutilisables (`components/ui/` = briques shadcn) | 433 |
| `src/lib/` | Utilitaires + intégrations : API Discord, DofusDB, permissions RBAC, marché, i18n | 165 |
| `src/server/` | **La logique métier côté serveur** : `actions/` (Server Actions), `discord.ts`, `market/`, `websocket/` | 161 |
| `src/content/` | Contenus textuels (guides Dofus, traductions) | 17 |
| `src/data/` | Données embarquées du module Rush Sylvestre (JSON générés + TS) | 5 |
| `src/hooks/` | Hooks React partagés | 9 |
| `src/store/` | États globaux client (Zustand) : overlays boss / rush | 2 |
| `src/types/` | Types TypeScript partagés (missions, worldmap, socket, guide) | 4 |
| `src/config/` | Config du site + mapping des docs | 2 |
| `src/utils/` | 1 utilitaire isolé (`canvas.ts`) | 1 |
| `src/workers/` | Workers Node exécutés par Docker (`worker.js`, `ladder-sync.js`) — pas par Next | ⚠️ |
| `src/proxy.ts` | Proxy Next 16 (**convention non négociable** : remplace `middleware.ts`, tourne en Node) | 1 |
| `src/scripts/` | ✅ **vidé le 19/09/2026** : ses 2 outils (`reset-db.ts`, `verify-schema.ts`) sont dans `scripts/` | 0 |
| `src/temp/` | Zone de travail **volatile, ignorée par git** — **supprimée le 20/09/2026**, recréée à la demande par une session (règle : `docs/agents/zone-volatile.md`) | 0 |

## 4. `public/` — tout ce qui est servi aux visiteurs (2 303 fichiers suivis)

| Sous-dossier | Contenu | Statut |
|---|---|---|
| `assets/` (721) | Visuels du site : landing, calendrier, classes Dofus, screenshots | ✅ |
| `game-data/` (473) | Données Dofus générées (monstres, donjons, items, tuiles de carte) + JSON | ✅ mais **partiellement ignoré** par git (§7) |
| `images/` (407) | Images de contenu (Sigil King, cartes, bannières) | ✅ |
| `module-dofus/` (27) | Les 28 icônes Dofus officielles | ✅ |
| `ordres/`, `banners/`, `sounds/`, `songes/`, `bonus_guilde/` | Visuels et audio des modules | ✅ |
| `uploads/` | 2 natures différentes → ci-dessous | ⚠️ |

### ⚠️ Le cas `public/uploads/` (32 694 fichiers / 135 Mo sur disque — **0 suivi**)

| Sous-dossier | Nature | Verdict |
|---|---|---|
| `assets-dofus/` | **32 691 fichiers / 135 Mo** : cache WebP siphonné de DofusDB | **Donnée d'exécution** — ignorée par git, montée en **volume Docker persistant** (`assets-prod-data`) et **référencée 21 857× en base** (`/uploads/assets-dofus/…`) → **NE JAMAIS SUPPRIMER**. Se régénère via `siphon-*` / `sync-assets` |
| `proofs/` (3) | Uploads locaux, non suivis | ✅ ignoré (données d'exécution) |
| ~~`guides/` (610), `docs/` (10), `guilds/` (16)~~ | **Ancien système d'upload** (636 fichiers suivis, ~20 Mo) | ✅ **sortis le 20/09/2026** (archivés hors dépôt) **après vérification en base** : aucune ligne ne les référence. Les URL `/uploads/…` écrites en base désignent des fichiers présents dans `private_uploads/`, servis par le rewrite Caddy → `docs/arbo/AUDIT-ARBO-2026-09.md` §0.1 |

## 5. `prisma/` — base de données (304 fichiers suivis)

| Élément | Rôle |
|---|---|
| `schema.prisma` | **La source de vérité du modèle** (toutes les tables) |
| `migrations/` (253) | Historique SQL. **Ne jamais modifier une migration déjà appliquée** (checksum Prisma → deploy cassé) |
| `seed.ts`, `seed-docs.ts`, `seed-legendary.ts`, `seed-data/seed.ts` | Seeds : données par défaut, catalogue des docs, items légendaires |
| `seed-data/dofus-quests/*-compiled.json` (30+) | Quêtes Dofus compilées, par serveur (Ébène, Ivoire, Vulbis…) |
| `seeds/game-data.json`, `seed-data/game-data.json` | Données de jeu de référence (deux emplacements) |
| `clear.ts`, `clear-dj-posts.sql`, `add-new-creators.ts` | Outils one-shot de maintenance BDD |
| `seed.js`, `seed_simple.js` | Fichiers compilés (`npm run build:seeds`) — ✅ **détrackés le 19/09**, ignorés par git |

---

## 6. `scripts/` — 76 fichiers : à quoi sert quoi (par famille)

| Famille | Exemples | Statut |
|---|---|---|
| **Déploiement / infra** (~17) | `deploy.sh`, `deploy-cd.sh`, `init-vps.sh`, `secure_vps.sh`, `backup_db.sh`, `restore_db.sh`, `rollback.sh`, `diagnose-vps-deploy.sh`, `maintenance.sh`, `check-hardening.sh` | ✅ **vivants** (procédures de `docs/MAINTENANCE.md` / `docs/ops/GUIDE-DEPLOIEMENT-PROD-JOUR-J.md`) |
| **Base de données** (~18) | `database-janitor.ts` (**cron**), `migrate-oauth-tokens.ts`, `re-encrypt-oauth-tokens.ts`, `purge-ghosts.ts`, `purge-emails.ts`, `check-db.ts`, `clean-db.ts`, `fix-local-db.ts`, `rescue.ts`, `export-seeds.sh` | ⚠️ mixte : le janitor et les migrations de tokens sont **vivants**, le reste = one-shot |
| **Seeds de contenu** (~22) | `seed-dofus-quests.ts`, `seed-bounties.ts`, `seed-cauchemar.ts`, `seed-platform-config.ts`, `global-seed.ts`, `seed-v3-compiled.ts`, `populate-invader-bosses.mjs`, `add-extended-bosses.mjs`, `sort-bosses-by-tier.mjs` | ⚠️ **one-shot** : ils ont servi à remplir la base d'un module. Les données sont en BDD + dans `prisma/seed-data/` |
| **Données Dofus (siphon/sync/compile)** (~25) | `dofus-asset-siphoner.ts`, `dofus-compiler.ts`, `dofus-compiler-v3.ts`, `sync-worldmap*.ts`, `sync-world*n-tiles.js`, `siphon-*.js/ts`, `compile-harvest-and-zaaps.ts`, `download-*-assets.ts`, `generate-bomb-dictionary.ts`, `compress-images.ts` | ⚠️ **à la demande** : relancer quand une nouvelle map/monstre/asset arrive (procédures dans `docs/agents/siphon-worldmap.md` et `docs/agents/sync-game-assets.md`) |
| **Proxies Dofusbook / Ladder** (4) | `check-dofusbook-relay.mjs`, `warm-dofusbook-cache.*`, `purge-dofusbook-icon-cache.cjs` | ⚠️ liés aux Workers Cloudflare (cf. `docs/reference/GALERIE-DOFUSBOOK-RELAIS.md`) |
| **Assets & captures d'écran** (~5) | `capture-screenshots.mjs` (captures de l'app, profil `.playwright-profile/`), `scan-mojibake-all.mjs`, `fix-mojibake.mjs`, `sync-assets.sh/.ps1` | ✅ **vivants** — les 3 outils de figures de landing (`capture-landing-visuels.mjs`, `crop-landing-visuels.mjs`, `probe-figure-slots.mjs`) ont été **retirés le 20/09/2026** avec les visuels qu'ils produisaient (les figures de la landing sont des **mockups vectoriels**) |
| **Divers** | `tsconfig.json` (config TS pour ces scripts), `convert-console-to-logger.ps1`, `backfill-changelog-en.mjs` | ⚠️ |

> Le **tri fin** (vivant vs one-shot livré) a été fait le 19/09/2026 (lot **L5**) : 19 outils one-shot jamais cités
> sont sortis du dépôt (données déjà en base + `prisma/seed-data/`). Méthode de vérification : §0.

## 7. Les autres dossiers

| Chemin | Rôle | Remarque |
|---|---|---|
| `services/discord-bot/` (6 suivis) | **Le bot Discord** : `index.ts` (source), `Dockerfile`, `package.json`… | ✅ `dist/index.js` est **détracké** (19/09) : régénéré au déploiement |
| `cloudflare-workers/` (6) | 3 Workers : `dofusbook-proxy`, `dofus-ladder-proxy`, `sigil-ladder-ankama` (chacun `worker.js` + `wrangler.toml`) | ✅ cache `.wrangler/` **ignoré** (détracké le 19/09) |
| `monitoring/prometheus/prometheus.yml` | Config Prometheus **unique** : montée par `docker-compose.yml:192` (dev) **et** `docker-compose.prod.yml:367` (prod) | ✅ unifié le 20/09/2026 (l'ancien doublon `prometheus/prometheus.yml` est supprimé) |
| `docs/agents/` (13) | Procédures pour les assistants : `session-amorce.md`, `git-push.md`, `prisma-schema-change.md`, `deploy-vps.md`, `zone-volatile.md`… + `activeContext.md` (**journal de session** — rotation à 6 sessions, ~29 Ko). L'amorce lue automatiquement est `AGENTS.md` (racine) | ✅ outils internes (ex-`.agents/workflows/`) |
| `.github/workflows/verify.yml` + `deploy.yml`, `dependabot.yml`, `CODEOWNERS` | CI (filtre, lint/tsc/tests, scan secrets/IOC, build de prod), déploiement GHCR, mises à jour de dépendances, propriétaires de revue (surface sensible) | ✅ |
| `.husky/pre-commit` | Scan de secrets + `tsc` + refus si `schema.prisma` change sans migration | ✅ (⚠️ bloque aussi un simple commentaire dans le schéma) |
| `.gemini/antigravity/brain/…/scratch/*` | Brouillons locaux d'un assistant IA | ✅ **rien de suivi** (ignoré par git) |
| `docs/` (32 suivis) | **Toute la documentation du projet** : 5 docs de référence + `agents/`, `ops/`, `plans/`, `reference/`, `arbo/` | ✅ arbo unique (cf. §2bis) |
| `docs/audits/` (6 fichiers, **non suivis**) | Audits de sécurité/infra/SEO + `retour-kimik3.md` | ✅ locaux par choix (`AGENTS.md` §3 l'interdit) |
| `tests/` (162) | `unit/` (154) + `security/` + `infrastructure.test.ts` : 1722 tests | ✅ |

## 8. Récap : ce qui ne sert plus (par ordre de certitude)

| Élément | Nature | Action |
|---|---|---|
| `dist/worker.js`, `dist/ws-server.js`, `services/discord-bot/dist/index.js` | Fichiers **compilés** | ✅ **détrakés le 19/09** (le build les recrée) |
| `prisma/seed.js`, `prisma/seed_simple.js`, `scripts/database-janitor.js`, `scripts/siphon-guide-images.js` | Fichiers **compilés** | ✅ **détrakés le 19/09** + règles `.gitignore` |
| `cloudflare-workers/dofus-ladder-proxy/.wrangler/cache/cf.json` | **Cache** d'outil | ✅ **détracké le 19/09** |
| `private_uploads/**`, `backups/**` | **Données d'exécution** | ✅ **détrakés le 19/09** (18,2 Mo sortis du dépôt) |
| `.gemini/…/scratch/*` | Brouillons d'agent | ✅ **rien de suivi** (ignoré par git) |
| `.playwright-profile/` (**87,5 Mo / 915 fichiers**) | Profil navigateur de test | ✅ **supprimé le 19/09** (se recrée avec `--login`) |
| `public/uploads/{guides,docs,guilds,proofs}` (636 suivis, ~20 Mo) | Ancien système d'upload | ✅ **sortis le 20/09/2026** — 0 référence en base (cf. §4 et l'audit §0.1) |
| `src/scripts/reset-db.ts`, `verify-schema.ts` | Outils de dev mal placés | ✅ **déplacés dans `scripts/`** le 19/09 |
| `USER_ACTIONS_REQUIRED.md` | Liste d'actions du propriétaire | ✅ **supprimé le 19/09** (one-shot périmé, récupérable via `git log`) |
| `prisma/seeds/game-data.json` | Doublon **mort** de `prisma/seed-data/game-data.json` (le seul lu) | ✅ **supprimé le 19/09** |
| `tsconfig.tsbuildinfo`, `.next/` | Artefacts locaux | ✅ ignorés (jetables) |
| `src/` — 12 **reliques** (`TODO-rush-sylvestre-refactor.md`, `module-quetes-dofus-v3.md`, `sigil_king_guide.md`, `temp-demo-deploy`, `.metamob_api`, `.feed-ankama`…) | Notes, dumps, specs livrées et log de déploiement **tracés à la racine de `src/`** | ✅ **sorties le 20/09** (archivées hors dépôt, 0 citation) |
| `.antigravity` (58 Ko) | Contexte d'assistant figé depuis le 31/08 | ✅ **supprimé le 20/09** |
| `_menage-2026-09-13/17/19` | Kits de ménage à la racine | ✅ **sortis le 20/09** (l'archive du ménage a elle-même été supprimée le même jour, après copie des preuves utiles — voir `docs/arbo/ARCHIVES-TEMP-2026-09.md`) |


