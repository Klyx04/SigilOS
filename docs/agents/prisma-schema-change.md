---
description: How to safely modify the Prisma schema and deploy migrations
---

# ⚠️ Règle d'Or — Toute modification de `schema.prisma` DOIT avoir une migration

## 0. Ce dépôt n'utilise **pas** `migrate dev` (mesuré le 14/10/2026)

`npx prisma migrate dev` est **inutilisable sur cet historique local** :

- la base locale contient une migration **absente du dépôt** (`20260819000000_add_inter_guild`) —
  `npx prisma migrate status` la signale (« The migration from the database are not found locally »)
  et `migrate dev` refuse de tourner sur une base en **drift** ;
- les migrations de ce dépôt sont **écrites à la main** (additives, `IF NOT EXISTS`), alignées sur le
  datamodel — c'est la méthode de tous les lots récents.

**Donc** : on écrit le SQL soi-même (§2) et on l'applique avec **`migrate deploy`** (§3), qui joue les
migrations **en attente** et les enregistre — la ligne orpheline ne le dérange pas.

## Workflow obligatoire

### 1. Modifier le schéma
Fais tes changements dans `prisma/schema.prisma`.

### 2. Écrire la migration à la main
Crée `prisma/migrations/<AAAAMMJJHHMMSS>_description_courte/migration.sql` (même préfixe de date que
les lots récents, `20270107000000_…` par exemple) :

- **additif et idempotent** : `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, FK sous `DO $$ … IF NOT EXISTS (SELECT 1 FROM pg_constraint …) $$` ;
- **aucune donnée réécrite** quand ce n'est pas indispensable — et quand ça l'est, l'écrire dans l'en-tête ;
- en-tête en français : **pourquoi** la migration existe, **ce qu'elle contient**, et **pourquoi elle est
  écrite à la main** (cf. §0) ;
- ⚠️ **ne jamais modifier une migration déjà appliquée** : Prisma vérifie son **checksum**, la retoucher
  fait échouer `migrate deploy`. On en ajoute une **nouvelle**.

### 3. Appliquer en local, puis régénérer le client
```bash
npx prisma migrate deploy   # joue les migrations EN ATTENTE sur la base locale (127.0.0.1:5433)
npx prisma generate         # régénère le client Prisma
npx prisma migrate status   # doit finir par « Database schema is up to date! »
```

> ⚠️ **PUIS REDÉMARRER `npm run dev`** : un serveur déjà lancé garde l'**ancien** client Prisma en
> mémoire et lève « The column X does not exist » — piège payé plusieurs fois (cf. `DEVELOPPEMENT.md` §7).
> 💡 Le réflexe à retenir après un `git pull` qui apporte une migration :
> **`npx prisma migrate deploy && npx prisma generate`, puis redémarrer le serveur.**

### 4. Vérifier que la base a vraiment la nouvelle forme
```bash
docker exec sigilos-db psql -U user -d sigilos -c "\d \"GuildConfig\""      # colonnes réelles
docker exec sigilos-db psql -U user -d sigilos -c "\dt"                      # tables réelles
```

### 5. Committer schéma + migration ensemble
```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): description du changement"
```

> Le pre-commit hook bloquera si `schema.prisma` est staged sans migration.

### 6. Le déploiement joue le reste (bêta puis prod)
```bash
./scripts/deploy-cd.sh beta   # applique les migrations en attente via `prisma migrate deploy`
```

---

## Si tu as oublié la migration (correction urgente)

### Cas 1 — Pas encore pushé en prod
```bash
# Créer la migration maintenant
npx prisma migrate dev --name fix_missing_migration

# Ajouter et committer
git add prisma/migrations/
git commit --amend --no-edit   # ou nouveau commit
git push origin dev
```

### Cas 2 — Déjà déployé sur beta (comme aujourd'hui)
```bash
# 1. Identifier les colonnes manquantes via psql
docker exec sigilos-db-beta psql -U sigiluser -d sigilos -c '\d "TableName"'

# 2. Appliquer le SQL manuellement
docker exec -i sigilos-db-beta psql -U sigiluser -d sigilos << 'EOF'
ALTER TABLE "Table" ADD COLUMN IF NOT EXISTS "colonne" TEXT;
EOF

# 3. Créer le fichier migration localement avec le même SQL
# (dans prisma/migrations/YYYYMMDDHHMMSS_nom/migration.sql)

# 4. Marquer comme appliquée dans _prisma_migrations
docker exec -i sigilos-db-beta psql -U sigiluser -d sigilos << 'EOF'
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text, '', now(), '20260227175500_nom_migration', NULL, NULL, now(), 1);
EOF

# 5. Résoudre drift local
npx prisma migrate resolve --applied TIMESTAMP_nom_migration

# 6. Committer et pusher
git add prisma/migrations/
git commit -m "fix: add missing migration for [feature]"
git push origin dev
```

---

## Commandes utiles

```bash
# Vérifier l'état des migrations
npx prisma migrate status

# Voir le diff entre schema et DB
docker exec sigilos-beta npx prisma migrate diff \
  --from-config-datasource \
  --to-schema-datamodel prisma/schema.prisma \
  --script

# Colonnes réelles en DB
docker exec sigilos-db-beta psql -U sigiluser -d sigilos -c '\d "GuildConfig"'
```
