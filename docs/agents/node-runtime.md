---
description: Runtime Node — version unique (.nvmrc), mise à jour de sécurité, rebuild des images et vérification
---

# Runtime Node — une seule version, et une procédure pour la bouger

> **Rôle unique.** Ce fichier dit **comment** mettre à jour le runtime Node du dépôt et des
> serveurs. Il ne duplique pas les commandes de déploiement (`docs/MAINTENANCE.md`) ni les
> règles de PR (`docs/agents/git-push.md`).

## 0. La source unique

**`.nvmrc`** porte la version **exacte** (`24.22.1`, LTS actif, depuis le 22/10/2026 ; le correctif
de sécurité du 21/10 était `22.23.4`, même doctrine). Quatre consommateurs
doivent la suivre — un seul oubli = un correctif appliqué à moitié :

| Consommateur | Fichier | Forme attendue |
|---|---|---|
| Poste de dev | `.nvmrc` | version exacte (`nvm use` / `fnm use`) |
| npm | `package.json` → `engines.node` | `>=<version> <majeure+1>` |
| Images | `Dockerfile` · `services/discord-bot/Dockerfile` | `FROM node:<version>-alpine` (3 `FROM`) |
| CI | `.github/workflows/verify.yml` | `node-version-file: '.nvmrc'` (2 jobs) |

**Verrou** : `tests/unit/node-runtime-pin.test.ts` échoue si l'un des quatre diverge.
`npm run security:audit` **ne couvre pas** le runtime (dépendances npm seulement).

## 1. Quand intervenir

1. Avis **nodejs.org/blog/vulnerability** touchant **notre majeure** (`.nvmrc`).
2. `docker exec sigilos-app node -v` ≠ version de `.nvmrc` (image construite avant le bump).

## 2. Procédure (1 lot = 1 branche = 1 PR)

1. Lire l'avis : versions corrigées de **notre** ligne + CVE qui nous concernent
   (TLS **sortant** Discord/DofusDB/Metamob, Brotli/undici, keep-alive derrière Caddy).
2. Mettre à jour **les quatre** : `.nvmrc`, `engines.node`, les `FROM node:` des deux
   Dockerfiles (3 occurrences).
3. Vérifier : `npx vitest run tests/unit/node-runtime-pin.test.ts` puis `npm run test:run` ·
   `npx tsc --noEmit` · `npm run lint`.
4. PR → `dev` (skill `node-runtime`).

## 3. Après le merge — **humain, obligatoire**

- **Poste** : `nvm install && nvm use` (sinon npm affiche `EBADENGINE`).
- **Bêta** : `./scripts/deploy-cd.sh beta`, puis `docker exec sigilos-beta node -v` doit
  afficher la version du `.nvmrc` — idem `sigilos-discord-bot-beta` (noms donnés par
  `docker ps` ; il n'y a **pas** de conteneur `sigilos-app`).
- **Prod** : mêmes contrôles sur `sigilos-prod` et `sigilos-discord-bot-prod` à l'ouverture.

⚠️ **Pourquoi le rebuild est obligatoire** : une image Docker fige son runtime. Mesuré le
21/10/2026 : `sigilos-app` tournait depuis **8 mois** avec un Node d'avant plusieurs vagues
de correctifs, alors que la CI, elle, prenait déjà la dernière 22.x.

## 4. Ce que ce n'est pas

- **Une montée de majeure** (22 → 24) n'est pas un correctif de sécurité : c'est un lot
  `chore` complet (Next, Prisma, discord.js, BullMQ, suite complète, CI, images), avec
  **arrêt et question** avant de commencer (`AGENTS.md` §7).
- Un `npm update` ne remplace pas cette procédure : le runtime n'est pas un paquet npm.
