---
paths:
  - "package.json"
  - ".nvmrc"
  - "Dockerfile*"
  - "services/**/Dockerfile"
  - ".github/workflows/**"
---
# Règles runtime Node

- **Une seule version** : `.nvmrc` (exacte). Ne jamais bouger un seul des quatre consommateurs
  (`.nvmrc`, `engines.node`, les `FROM node:` des images, la CI) — le verrou
  `tests/unit/node-runtime-pin.test.ts` doit rester vert.
- **Tags d'image épinglés** : `FROM node:<version>-alpine`, jamais `node:22-alpine` (flottant :
  le correctif n'arrive qu'au rebuild, sans trace dans git).
- **Avis de sécurité runtime** : suivre `docs/agents/node-runtime.md`. Le **rebuild des images**
  (bêta puis prod) fait partie du lot, sinon les conteneurs gardent leur ancien Node.
- `npm run security:audit` couvre les **dépendances**, pas le runtime : un audit vert ne dit
  rien de la version de Node.
- **Montée de majeure** = lot séparé, arrêt et question (`AGENTS.md` §7), jamais glissée dans
  un correctif.
