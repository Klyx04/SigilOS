---
name: node-runtime
description: Utiliser quand une version de Node doit bouger — avis de sécurité nodejs.org, conteneur plus vieux que .nvmrc, montée de majeure. Couvre .nvmrc, engines, les Dockerfiles, la CI, le verrou node-runtime-pin, le rebuild bêta/prod et la vérification de version dans le conteneur.
---
# Runtime Node

1. Lire `docs/agents/node-runtime.md` : **`.nvmrc` est la source unique**, quatre consommateurs
   doivent la suivre.
2. Trancher : **correctif** (même majeure) = ce lot ; **montée de majeure** (22 → 24) = lot
   séparé, avec arrêt et question (`AGENTS.md` §7).
3. Bump les quatre : `.nvmrc`, `engines.node`, les `FROM node:` des deux Dockerfiles, et
   laisser la CI sur `node-version-file: '.nvmrc'`.
4. Vérifier : `npx vitest run tests/unit/node-runtime-pin.test.ts`, puis `npm run test:run` ·
   `npx tsc --noEmit` · `npm run lint`.
5. PR → `dev` (skill `lot-pr`) ; documenter les CVE qui nous touchent réellement (TLS sortant,
   Brotli/undici, keep-alive).
6. **Ops humain** : `./scripts/deploy-cd.sh beta` puis `docker exec sigilos-app node -v` =
   version du `.nvmrc` (idem bot) ; prod à l'ouverture. Sans rebuild, le conteneur garde son
   ancien Node.
