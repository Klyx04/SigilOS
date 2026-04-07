---
description: Plan de Reprise d'Activité (PRA) — Restore depuis un backup chiffré R2
---

# 🛡️ PRA SigilOS — Restauration depuis Cloudflare R2

> À utiliser en cas de corruption de DB, perte du VPS, ou incident critique.
> Les backups sont chiffrés AES-256 (GPG) et stockés sur Cloudflare R2.

---

## Prérequis sur le VPS (ou nouvelle machine)

```bash
# Vérifier que les outils sont disponibles
aws --version      # AWS CLI (pour accès R2)
gpg --version      # GPG (pour déchiffrement)
docker ps          # Docker opérationnel
```

---

## Étape 1 — Lister les backups disponibles sur R2

```bash
# Charger les variables d'environnement
source .env.prod

# Lister les backups BÊTA (les plus récents en premier)
AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID \
AWS_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY \
aws s3 ls s3://$R2_BUCKET_NAME/ --endpoint-url $R2_ENDPOINT_URL | grep "sigilos_beta_" | sort -r

# Lister les backups PROD
aws s3 ls s3://$R2_BUCKET_NAME/ --endpoint-url $R2_ENDPOINT_URL | grep "sigilos_prod_" | sort -r
```

Note le nom du fichier à restaurer, ex: `sigilos_beta_2026-04-07_18-20-11.sql.gz.gpg`

---

```bash
# Option manuelle (si tu as le nom du fichier)
./scripts/restore_db.sh beta sigilos_beta_2026-04-07_12-00-00.sql.gz.gpg

# Option AUTOMATIQUE (Recommandé - télécharge le dernier backup BETA)
bash ./scripts/restore_db.sh beta --download-latest
```

---

## Étape 3 — Déchiffrer le backup (AES-256 GPG)

```bash
# La clé est BACKUP_ENCRYPTION_KEY dans .env.prod
source .env.prod

echo "$BACKUP_ENCRYPTION_KEY" | gpg \
  --batch \
  --yes \
  --passphrase-fd 0 \
  --decrypt \
  -o ~/restore/restore.sql.gz \
  ~/restore/$BACKUP_FILE

echo "✅ Déchiffré → ~/restore/restore.sql.gz"
```

---

Les étapes de déchiffrement et d'injection sont désormais automatisées par le script `restore_db.sh`. Il demande confirmation avant d'écraser les données.

```bash
# Pour la Bêta
./scripts/restore_db.sh beta --download-latest

# Pour la Prod
./scripts/restore_db.sh prod --download-latest
```

---

## Étape 5 — Redémarrer les containers

```bash
# Après restauration, forcer le redémarrage de l'app pour vider les caches Prisma
docker restart sigilos-prod      # ou sigilos-beta
docker restart sigilos-worker-prod  # si applicable
```

---

## Étape 6 — Vérification

```bash
# Compter les données restaurées
docker exec sigilos-db-prod psql -U sigiluser -d sigilos -c "
SELECT 'Users' AS t, COUNT(*) FROM \"User\"
UNION ALL SELECT 'GuildConfig', COUNT(*) FROM \"GuildConfig\"
UNION ALL SELECT 'UserProfile', COUNT(*) FROM \"UserProfile\"
UNION ALL SELECT 'Missions', COUNT(*) FROM \"Mission\";
"
```

---

## 🕐 Fréquence des backups

Le script `scripts/backup_db.sh` tourne **chaque nuit à 4h00** via `maintenance.sh` (crontab).
Les backups locaux sont conservés **3 jours**, les R2 selon la Lifecycle Policy du bucket.

---

## 📞 Contacts d'urgence

| Rôle | Contact |
|------|---------|
| Admin VPS | `sigiladmin` sur le serveur |
| R2 Bucket | Cloudflare Dashboard → R2 → `sigilos-backups` |

---

> [!CAUTION]
> Ne jamais restaurer un backup prod directement sur la beta sans vider les données de guilde beta d'abord. Utiliser `reset-beta.sh` avant si besoin.
