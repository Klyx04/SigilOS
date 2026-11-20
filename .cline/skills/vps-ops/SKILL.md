---
name: vps-ops
description: Utiliser dès qu'une opération d'écriture est nécessaire sur le VPS (archiver ou remplacer le guide Rush, sauvegarde PostgreSQL, suppression d'archive, vérification des compteurs). Interdit les commandes docker compose exec app-* pour les outils d'administration, impose le conteneur ops-* (stage ops), le dry-run avant --apply, une sauvegarde préalable et une preuve avant/après.
---
# Ops VPS (écriture)

## Règle d'or
Un outil d'administration ne tourne **jamais** dans l'image applicative (`app-beta` / `app-prod`) : elle est standalone et n'embarque pas les dépendances (mesuré le 20/11/2026 : `@prisma/driver-adapter-utils`, puis `postgres-array`). Il tourne dans `ops-beta` / `ops-prod` (stage `ops` du Dockerfile).

## Procédure
1. **Sauvegarde** : `./scripts/ops/vps.sh dump <beta|prod>` — refuser si le fichier est vide.
2. **Dry-run** : `./scripts/ops/vps.sh rush-archive <env>` — coller la sortie.
3. **Appliquer** : `./scripts/ops/vps.sh rush-archive <env> --apply`.
4. **Prouver** : `./scripts/ops/vps.sh rush-verify <env>` (avant et après).
5. **Rollback** : l'archive `rush-sylvestre-archive-*` reste en place ; ne jamais la supprimer avant validation.

## Interdits
- `docker compose exec app-* node scripts/…`
- `npm install` / `npm pack` dans un conteneur applicatif
- une commande SQL ad hoc hors `scripts/ops/vps.sh` (sauf incident déclaré, avec dump préalable)

Détail : `docs/agents/vps-ops.md`.
