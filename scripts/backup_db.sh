#!/bin/bash

# =============================================================================
# 🛡️ SigilOS - Secure Off-site Backup (R2)
# =============================================================================
# Encrypts database dump with GPG (AES-256) and uploads to Cloudflare R2.
# Requirement: .env file with R2 credentials or env vars set.

# 1. Config & Context
# -------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Local backup directory instead of /var/backups to avoid sudo/permission issues
BACKUP_DIR="$ROOT_DIR/backups/db"

# Load env vars safely (Prioritize PROD)
if [ -f "$ROOT_DIR/.env.prod" ]; then
    echo "[Config] Loading .env.prod"
    export $(grep -v '^#' "$ROOT_DIR/.env.prod" | xargs)
elif [ -f "$ROOT_DIR/.env" ]; then
    echo "[Config] Loading .env"
    export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
fi

DB_CONTAINER="sigilos-db-prod"
DB_USER="${POSTGRES_USER:-user}"

DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME_RAW="sigilos_${DATE}.sql.gz"
FILENAME_ENC="${FILENAME_RAW}.gpg"

# Nova API God Notify (Cloudflare proxy URL or internal if app is up)
GOD_NOTIFY_URL="https://sigilos.fr/api/god/notify"

send_god_notif() {
    local title=$1
    local message=$2
    local type=$3
    local success=$4
    local metadata=$5

    if [ ! -z "$CRON_SECRET" ]; then
        curl -s -X POST "$GOD_NOTIFY_URL" \
            -H "Authorization: Bearer $CRON_SECRET" \
            -H "Content-Type: application/json" \
            -d "{
                \"title\": \"$title\",
                \"message\": \"$message\",
                \"type\": \"$type\",
                \"success\": $success,
                \"metadata\": $metadata
            }" > /dev/null
    fi
}

# GPG Passphrase for backup encryption (Must be in .env)
# If not set, we cannot secure the backup.
if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
    echo "❌ CRITICAL: BACKUP_ENCRYPTION_KEY is missing in .env"
    exit 1
fi

mkdir -p $BACKUP_DIR

# 2. Dump & Compress
# ------------------
echo "[$(date)] 📦 Starting Backup..."
docker exec $DB_CONTAINER pg_dumpall -c -U $DB_USER | gzip > "$BACKUP_DIR/$FILENAME_RAW"

if [ $? -ne 0 ]; then
    echo "❌ Dump failed!"
    send_god_notif "[Backup] ÉCHOUÉ" "Le dump PostgreSQL a échoué." "BACKUP" "false" "{ \"step\": \"dump\", \"filename\": \"$FILENAME_RAW\" }"
    exit 1
fi

# 3. Encrypt (AES-256)
# --------------------
echo "[$(date)] 🔒 Encrypting..."
# --batch --yes avoids interactive prompts
echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 --symmetric --cipher-algo AES256 -o "$BACKUP_DIR/$FILENAME_ENC" "$BACKUP_DIR/$FILENAME_RAW"

if [ $? -eq 0 ]; then
    echo "✅ Encryption successful."
    rm "$BACKUP_DIR/$FILENAME_RAW" # Remove raw file
else
    echo "❌ Encryption failed!"
    exit 1
fi

# 4. Upload to R2 (via AWS CLI)
# -----------------------------
# Remap R2 env vars to AWS CLI expected vars
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"
# R2 Endpoint URL (e.g. https://<account_id>.r2.cloudflarestorage.com)
export AWS_ENDPOINT_URL="$R2_ENDPOINT_URL" 

if [ -n "$R2_BUCKET_NAME" ] && [ -n "$AWS_ENDPOINT_URL" ]; then
    echo "[$(date)] ☁️ Uploading to R2..."
    aws s3 cp "$BACKUP_DIR/$FILENAME_ENC" "s3://$R2_BUCKET_NAME/$FILENAME_ENC" --endpoint-url "$AWS_ENDPOINT_URL"

    if [ $? -eq 0 ]; then
        echo "✅ Upload successful!"
        send_god_notif "[Backup] Réussi" "Sauvegarde chiffrée transférée vers Cloudflare R2." "BACKUP" "true" "{ \"filename\": \"$FILENAME_ENC\", \"status\": \"uploaded\" }"
    else
        echo "❌ Upload failed. Local copy kept."
        send_god_notif "[Backup] Alerte Upload" "Le dump est fait mais le transfert vers R2 a échoué." "BACKUP" "false" "{ \"filename\": \"$FILENAME_ENC\", \"status\": \"local_only\" }"
    fi
else
    echo "⚠️ R2 credentials missing. Skipping upload."
fi

# 5. Cleanup Local & Remote (Rotation)
# ------------------------------------
# Keep local files for 3 days
find $BACKUP_DIR -type f -name "*.gpg" -mtime +3 -delete

# (Optional) Remote rotation - handled by Bucket Lifecycle Policy usually, but simple cleanup check:
# aws s3 ls ... | sort ...

echo "[$(date)] 🎉 Backup procedure completed."
