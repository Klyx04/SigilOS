# 💻 Développement — mise en route locale

> **Ce fichier remplace l'ancien `README.md` technique** (déplacé ici le 20/09/2026 : le README est
> devenu une vitrine publique, sans détail technique).
> Sources de vérité du projet : [`CONTEXT.md`](./CONTEXT.md) (architecture), [`RULES.md`](./RULES.md)
> (conventions + sécurité), [`MAINTENANCE.md`](./MAINTENANCE.md) (exploitation),
> [`ROADMAP.md`](./ROADMAP.md) (backlog). Index complet : [`docs/README.md`](./README.md).

## 1. Prérequis

| Outil | Version | Remarque |
|---|---|---|
| Node.js | **22+** | aligné sur `Dockerfile` (`node:22-alpine`) et la CI |
| Docker + Compose | récent | fournit PostgreSQL, Redis, Caddy et le monitoring en local |
| Git | récent | hooks `husky` installés automatiquement par `npm install` |

## 2. Les trois fichiers d'environnement

| Fichier | Versionné ? | Rôle |
|---|---|---|
| `.env.example` | ✅ **oui** | **Le modèle** : toutes les variables attendues, documentées. À recopier pour démarrer. |
| `.env` | ❌ non (gitignoré) | **La config locale de l'app** : base de données, Discord, Auth.js, Redis, Sentry, OCR, workers… |
| `.env.local` | ❌ non (gitignoré) | **La config locale d'exploitation** : cibles SSH du VPS (`VPS_SSH_ALIAS_BETA/PROD`, `VPS_IP_*`, `VPS_PATH_*`), `MAINTENANCE_MODE`. Lue par `scripts/sync-assets.sh` / `.ps1`, `scripts/check-dofusbook-relay.mjs` et `scripts/backfill-changelog-en.mjs`. |

> ⚠️ **Ordre de priorité** : `.env.local` **écrase** `.env` (Next.js) et, en CLI, le **dernier** `--env-file` gagne.
> Ne jamais dupliquer une clé entre les deux : la valeur de `.env.local` gagnerait silencieusement.

## 3. Démarrage pas à pas

```bash
# 1. Dépendances (installe aussi le hook pre-commit husky)
npm install

# 2. Environnement
cp .env.example .env          # puis renseigner DATABASE_URL, AUTH_SECRET, Discord…

# 3. PostgreSQL + Redis (compose fournit la base sur le port hôte 5433)
docker compose up -d db redis

# 4. Client Prisma + schéma + données de référence
npx prisma generate
npx prisma migrate deploy      # ou `npx prisma migrate dev` si tu crées une migration
npm run seed                   # données de base
npm run seed:game-data         # données de jeu (monstres, donjons, items…)
npm run seed:docs              # catalogue de la documentation publique

# 5. Application (http://localhost:3000)
npm run dev
```

**Stack complète en Docker** (app + bot + caddy + monitoring, comme en prod) :

```bash
docker compose up -d
```

## 4. Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Next.js (dev / build de prod / serveur) |
| `npm run test:run` | Suite Vitest complète (≈ 1 700 tests) |
| `npm run test:coverage` | Idem avec couverture |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Vérification TypeScript (aussi jouée par le hook pre-commit) |
| `npm run seed` / `seed:game-data` / `seed:docs` | Seeds (défauts / données de jeu / catalogue docs) |
| `npm run worker` · `npm run ws` | Worker BullMQ · serveur WebSocket (dev) |
| `npm run build:worker` · `build:ws` · `build:seeds` · `build:maintenance` | Bundles esbuild utilisés par le Dockerfile |
| `npm run migrate:uploads` | Migration des fichiers `public/uploads` → `private_uploads` |
| `npm run export-seeds` | Export des seeds |

## 5. Qualité : ce que le hook pre-commit vérifie

1. **Secrets** (tokens Discord/GitHub/AWS, `.env`, chaînes PostgreSQL) → commit bloqué ;
2. **Dérive Prisma** : `prisma/schema.prisma` modifié **sans** nouvelle migration → bloqué ;
3. **lint-staged** (ESLint sur les fichiers stagés) puis **`tsc --noEmit`** sur tout le projet.

> Si un changement est volontairement hors migration (ex. **commentaire** dans le schéma), le passage
> par `git commit --no-verify` est un choix explicite à documenter dans la PR.

## 6. Déploiement

- **Voie normale (CD)** : `dev` → images bêta, `main` → images prod, poussées par GitHub Actions (GHCR) ;
  le VPS ne fait que `pull` + `up` (~30 s) via `./scripts/deploy-cd.sh <env> [sha]`.
- **Repli** : `./scripts/deploy.sh <env>` · **Retour arrière** : `./scripts/rollback.sh`.
- Procédures, cron, incidents, sauvegardes : [`MAINTENANCE.md`](./MAINTENANCE.md)
  et [`ops/GUIDE-DEPLOIEMENT-PROD-JOUR-J.md`](./ops/GUIDE-DEPLOIEMENT-PROD-JOUR-J.md).

## 7. Dépannage

| Symptôme | Piste |
|---|---|
| `sharp not found` | `npm rebuild sharp` |
| Prisma ne génère pas | `npx prisma generate --force` |
| Erreur Redis en local | Redis n'est pas nécessaire à l'app en dev : ne pas définir `REDIS_URL` (ou démarrer `docker compose up -d redis`) |
| Admin God : images manquantes | vérifier `public/game-data/{monsters,achievements,dungeons}` |
| Un fichier ne se commite pas | `git check-ignore -v <fichier>` — et **ne jamais** écrire un source avec `>` sous PowerShell 5.1 (UTF-16 → fichier corrompu) |
| `The column X does not exist` juste après une migration | Un `next dev` **déjà lancé** garde l'**ancien client Prisma** dans ses chunks SSR (un `include` demande alors toutes les colonnes) : redémarrer le serveur après `npx prisma generate` |
