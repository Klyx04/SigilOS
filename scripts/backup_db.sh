#!/bin/bash

# Configuration
# -------------
BACKUP_DIR="/var/backups/sigilos"
DB_CONTAINER="sigilos-db"
DB_USER="user"
DB_NAME="sigilos"
RETENTION_DAYS=7
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="backup_${DATE}.sql.gz"

# Créer le dossier s'il n'existe pas
mkdir -p $BACKUP_DIR

# 1. Dump de la base de données
# ----------------------------
echo "[$(date)] Début du backup..."

docker exec -t $DB_CONTAINER pg_dumpall -c -U $DB_USER | gzip > "$BACKUP_DIR/$FILENAME"

if [ $? -eq 0 ]; then
    echo "[$(date)] ✅ Sauvegarde réussie : $FILENAME"
else
    echo "[$(date)] ❌ Erreur lors de la sauvegarde !"
    # Ici on pourrait ajouter une notif Discord ou Email
    exit 1
fi

# 2. Nettoyage des vieux backups
# ------------------------------
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Nettoyage des backups de plus de $RETENTION_DAYS jours effectué."

# 3. (Optionnel) Envoi vers un stockage externe (AWS S3, etc)
# -----------------------------------------------------------
# aws s3 cp "$BACKUP_DIR/$FILENAME" s3://mon-bucket-backup/
