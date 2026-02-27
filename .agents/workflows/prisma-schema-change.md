---
description: How to safely modify the Prisma schema and deploy migrations
---

# ⚠️ Règle d'Or — Toute modification de `schema.prisma` DOIT avoir une migration

## Workflow obligatoire

### 1. Modifier le schema
Fais tes changements dans `prisma/schema.prisma`.

### 2. Générer la migration (OBLIGATOIRE)
```bash
npx prisma migrate dev --name description_courte_du_changement
```
- Crée le fichier SQL dans `prisma/migrations/`
- Met à jour la DB locale
- Régénère le Prisma Client

> ❌ NE PAS faire seulement `npx prisma generate` — ça met à jour le client mais PAS la DB.

### 3. Vérifier le fichier migration généré
```bash
# Voir la dernière migration créée
ls prisma/migrations/ | tail -1
```

### 4. Committer schema + migration ensemble
```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): description du changement"
```

> Le pre-commit hook bloquera si `schema.prisma` est staged sans migration.

### 5. Le deploy.sh fait le reste automatiquement
```bash
./scripts/deploy.sh beta   # applique les migrations via prisma migrate deploy
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
