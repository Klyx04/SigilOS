# Carte du projet SigilOS — « c'est quoi ce fichier ? »

État au 19/09/2026. Objectif : pouvoir répondre, pour n'importe quel fichier du dépôt : **à quoi il sert,
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
| `scripts/` | Outils de dev/ops : seeds, siphons de données Dofus, déploiement, worldmap | ⚠️ à trier (84 fichiers) |
| `tests/` | Tests vitest (161 fichiers, 1722 tests) | ✅ |
| `docs/` | Documentation versionnée (roadmap, guides d'ops, plans de chantier) | ✅ (+ `docs/audits/` **non suivi**) |
| `services/` | Le **bot Discord** (process Node séparé, 117 Mo avec son `node_modules`) | ✅ |
| `cloudflare-workers/` | 3 Workers Cloudflare (proxies Dofusbook / Ladder) | ✅ |
| `monitoring/` `prometheus/` | Config Prometheus — **une par environnement** (`monitoring/` = prod, `prometheus/` = dev) | ✅ les deux |
| `.agents/` `.gemini/` `.antigravity` | Consignes/workflows pour les assistants IA (dont `.agents/workflows/activeContext.md` = journal de session) | ✅ outils |
| `.github/` `.husky/` | CI/CD + hook pre-commit (scan de secrets, tsc, vérif migration Prisma) | ✅ |
| `node_modules/` `.next/` `dist/` `.playwright-profile/` | Artefacts locaux (jamais commités… sauf `dist/` voir §6) | ❌ jetables |

## 2. La racine, fichier par fichier (34 fichiers suivis)

| Fichier | Rôle |
|---|---|
| `README.md` | Vitrine du projet + démarrage rapide |
| `CONTEXT.md` | **Point d'entrée technique** : arborescence, modules, assets, pièges (le condensé) |
| `RULES.md` | Conventions de code + règles de sécurité non négociables |
| `SECURITY.md` | Politique de sécurité (convention GitHub) + chantiers ouverts |
| `PROMPT_START.md` | Amorce de session lue par les assistants IA (courte volontairement) |
| `MAINTENANCE.md` | **Ops** : cron, déploiement, incidents, procédures (50 Ko) — cité 20× dont dans du code, reste à la racine |

> **Supprimés le 19/09/2026** : `WORKFLOW.md` (doublon exact de `RULES.md §Git Workflow`, zéro citation) et
> `USER_ACTIONS_REQUIRED.md` (checklist de mise en production one-shot, zéro citation) — récupérables via
> `git log` (ils étaient versionnés).
| `.antigravity` | Fichier de contexte du projet pour l'assistant Antigravity |
| `package.json` / `package-lock.json` | Dépendances + scripts npm (`dev`, `build`, `test:run`, `seed:docs`, `build:worker`…) |
| `next.config.ts` | Config Next.js (images, redirections, sécurité) |
| `tsconfig.json` | Config TypeScript |
| `tailwind.config.ts` / `postcss.config.mjs` / `components.json` | Design system (Tailwind + shadcn) |
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
| `src/scripts/` | ⚠️ 2 outils de dev (`reset-db.ts`, `verify-schema.ts`) — leur place est dans `scripts/` | 2 |
| `src/temp/` | Zone de travail **volatile, ignorée par git** (cf. `docs/ARCHIVES-TEMP-2026-09.md`) | — |

## 4. `public/` — tout ce qui est servi aux visiteurs (2 303 fichiers suivis)

| Sous-dossier | Contenu | Statut |
|---|---|---|
| `assets/` (721) | Visuels du site : landing, calendrier, classes Dofus, screenshots | ✅ |
| `game-data/` (473) | Données Dofus générées (monstres, donjons, items, tuiles de carte) + JSON | ✅ mais **partiellement ignoré** par git (§7) |
| `images/` (407) | Images de contenu (Sigil King, cartes, bannières) | ✅ |
| `module-dofus/` (27) | Les 28 icônes Dofus officielles | ✅ |
| `ordres/`, `banners/`, `sounds/`, `songes/`, `bonus_guilde/` | Visuels et audio des modules | ✅ |
| `uploads/` | ⚠️ **3 natures différentes mélangées** → ci-dessous | ⚠️ |

### ⚠️ Le cas `public/uploads/` — à traiter à part (33 330 fichiers / 156 Mo sur disque)

| Sous-dossier | Nature | Verdict |
|---|---|---|
| `assets-dofus/` | **32 691 fichiers / 135 Mo** : cache WebP siphonné de DofusDB | **Donnée d'exécution** — ignorée par git, montée en **volume Docker persistant** (`assets-prod-data`). Se régénère via les scripts `siphon-*` / `sync-assets` |
| `guides/` (610), `docs/` (10), `guilds/` (16), `proofs/` (3) | **636 fichiers suivis (~20 Mo)** | **Ancien système d'upload** (avant `private_uploads/`). Le proxy réécrit `/uploads/<scope>/<uuid>.webp` → `/api/storage/<scope>/…` qui lit `private_uploads/`. ⚠️ À vérifier en base avant toute suppression (cf. `scripts/migrate-uploads.mjs`) |

## 5. `prisma/` — base de données (304 fichiers suivis)

| Élément | Rôle |
|---|---|
| `schema.prisma` | **La source de vérité du modèle** (toutes les tables) |
| `migrations/` (253) | Historique SQL. **Ne jamais modifier une migration déjà appliquée** (checksum Prisma → deploy cassé) |
| `seed.ts`, `seed-docs.ts`, `seed-legendary.ts`, `seed-data/seed.ts` | Seeds : données par défaut, catalogue des docs, items légendaires |
| `seed-data/dofus-quests/*-compiled.json` (30+) | Quêtes Dofus compilées, par serveur (Ébène, Ivoire, Vulbis…) |
| `seeds/game-data.json`, `seed-data/game-data.json` | Données de jeu de référence (deux emplacements) |
| `clear.ts`, `clear-dj-posts.sql`, `add-new-creators.ts` | Outils one-shot de maintenance BDD |
| `seed.js`, `seed_simple.js` | 🔴 **Fichiers compilés** (`npm run build:seeds`) suivis par erreur → §7 |

---

## 6. `scripts/` — 84 fichiers : à quoi sert quoi (par famille)

| Famille | Exemples | Statut |
|---|---|---|
| **Déploiement / infra** (~17) | `deploy.sh`, `deploy-cd.sh`, `init-vps.sh`, `secure_vps.sh`, `backup_db.sh`, `restore_db.sh`, `rollback.sh`, `diagnose-vps-deploy.sh`, `maintenance.sh`, `check-hardening.sh` | ✅ **vivants** (procédures de `MAINTENANCE.md` / `docs/GUIDE-DEPLOIEMENT-PROD-JOUR-J.md`) |
| **Base de données** (~18) | `database-janitor.ts` (**cron**), `migrate-oauth-tokens.ts`, `re-encrypt-oauth-tokens.ts`, `purge-ghosts.ts`, `purge-emails.ts`, `check-db.ts`, `clean-db.ts`, `fix-local-db.ts`, `rescue.ts`, `export-seeds.sh` | ⚠️ mixte : le janitor et les migrations de tokens sont **vivants**, le reste = one-shot |
| **Seeds de contenu** (~22) | `seed-dofus-quests.ts`, `seed-bounties.ts`, `seed-cauchemar.ts`, `seed-platform-config.ts`, `global-seed.ts`, `seed-v3-compiled.ts`, `populate-invader-bosses.mjs`, `add-extended-bosses.mjs`, `sort-bosses-by-tier.mjs` | ⚠️ **one-shot** : ils ont servi à remplir la base d'un module. Les données sont en BDD + dans `prisma/seed-data/` |
| **Données Dofus (siphon/sync/compile)** (~25) | `dofus-asset-siphoner.ts`, `dofus-compiler.ts`, `dofus-compiler-v3.ts`, `sync-worldmap*.ts`, `sync-world*n-tiles.js`, `siphon-*.js/ts`, `compile-harvest-and-zaaps.ts`, `download-*-assets.ts`, `generate-bomb-dictionary.ts`, `compress-images.ts` | ⚠️ **à la demande** : relancer quand une nouvelle map/monstre/asset arrive (procédures dans `.agents/workflows/siphon-worldmap.md` et `sync-game-assets.md`) |
| **Proxies Dofusbook / Ladder** (4) | `check-dofusbook-relay.mjs`, `warm-dofusbook-cache.*`, `purge-dofusbook-icon-cache.cjs` | ⚠️ liés aux Workers Cloudflare (cf. `docs/GALERIE-DOFUSBOOK-RELAIS.md`) |
| **Assets & captures d'écran** (~8) | `capture-screenshots.mjs`, `capture-landing-visuels.mjs`, `probe-figure-slots.mjs`, `crop-landing-visuels.mjs`, `scan-mojibake-all.mjs`, `fix-mojibake.mjs`, `sync-assets.sh/.ps1` | ✅ **vivants** (cités par `MAINTENANCE.md` / `CONTEXT.md`) |
| **Divers** | `tsconfig.json` (config TS pour ces scripts), `convert-console-to-logger.ps1`, `backfill-changelog-en.mjs` | ⚠️ |

> Le **tri fin** (vivant vs one-shot livré) est le **lot L5** de l'audit : méthode en §0, puis archive externe
> des one-shot (rien n'est supprimé sans vérifier les citations).

## 7. Les autres dossiers

| Chemin | Rôle | Remarque |
|---|---|---|
| `services/discord-bot/` (7 suivis) | **Le bot Discord** : `index.ts` (source), `Dockerfile`, `package.json`, + `dist/index.js` | 🔴 `dist/index.js` est un **fichier compilé suivi** (régénéré au déploiement) |
| `cloudflare-workers/` (7) | 3 Workers : `dofusbook-proxy`, `dofus-ladder-proxy`, `sigil-ladder-ankama` (chacun `worker.js` + `wrangler.toml`) | 🔴 + `.wrangler/cache/cf.json` (cache local) suivi |
| `monitoring/prometheus/prometheus.yml` | Config Prometheus **de prod** (montée par `docker-compose.prod.yml:367`) | ✅ vivant |
| `prometheus/prometheus.yml` | Config Prometheus **de dev** (montée par `docker-compose.yml:192`) | ✅ vivant — ⚠️ même nom, deux endroits : risque de divergence, à unifier |
| `.agents/workflows/` (12) | Procédures pour les assistants : `session-amorce.md`, `deploy-vps.md`, `prisma-schema-change.md`, `siphon-worldmap.md`, `disaster-recovery.md`… + `activeContext.md` (**journal de session**, 100+ Ko) | ✅ outils internes |
| `.agents/workflow-images-buggérés.md` | Fiche sur un incident d'images (nom de fichier avec faute de frappe) | 🟡 à renommer ou archiver |
| `.github/workflows/verify.yml` + `deploy.yml`, `dependabot.yml` | CI (lint/tsc/tests), déploiement, mises à jour de dépendances | ✅ |
| `.husky/pre-commit` | Scan de secrets + `tsc` + refus si `schema.prisma` change sans migration | ✅ (⚠️ bloque aussi un simple commentaire dans le schéma) |
| `.gemini/antigravity/brain/…/scratch/*.py` (3) | Brouillons d'un assistant IA | 🔴 à détracker |
| `docs/` (12 suivis) | `ROADMAP.md`, `MAINTENANCE`-like, plans de chantier, guides d'ops (i18n, OCR, SEO, déploiement) | ✅ |
| `docs/audits/` (6 fichiers, **non suivis**) | Audits de sécurité/infra/SEO + `retour-kimik3.md` | ✅ locaux par choix (`PROMPT_START.md` interdit de les committer) |
| `tests/` (162) | `unit/` (154) + `security/` + `infrastructure.test.ts` : 1722 tests | ✅ |

## 8. Récap : ce qui ne sert plus (par ordre de certitude)

| Élément | Nature | Action |
|---|---|---|
| `dist/worker.js`, `dist/ws-server.js`, `services/discord-bot/dist/index.js` | Fichiers **compilés** | Détracker (le build les recrée) |
| `prisma/seed.js`, `prisma/seed_simple.js`, `scripts/database-janitor.js`, `scripts/siphon-guide-images.js` | Fichiers **compilés** | Détracker (+ compléter `.gitignore`) |
| `cloudflare-workers/dofus-ladder-proxy/.wrangler/cache/cf.json` | **Cache** d'outil | Détracker |
| `private_uploads/**` (5), `backups/**` (2) | **Données d'exécution** | Détracker |
| `.gemini/…/scratch/*.py` (3) | Brouillons d'agent | Détracker |
| `.playwright-profile/` (**87,5 Mo / 915 fichiers**) | Profil navigateur de test | Supprimer (se recrée avec `--login`) |
| `public/uploads/{guides,docs,guilds,proofs}` (636 suivis, ~20 Mo) | Ancien système d'upload | ⚠️ **Vérifier en base** puis archiver |
| `src/scripts/reset-db.ts`, `verify-schema.ts` | Outils de dev mal placés | Déplacer dans `scripts/` |
| `USER_ACTIONS_REQUIRED.md` | Liste d'actions du propriétaire | Vérifier la fraîcheur, archiver si périmé |
| `prisma/seeds/game-data.json` + `prisma/seed-data/game-data.json` | Doublon apparent | Vérifier lequel est lu |
| `tsconfig.tsbuildinfo`, `.next/` | Artefacts locaux | Jetables (déjà ignorés) |


