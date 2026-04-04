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

# 🛡️ SAFER ENV LOADING (Handles quotes and spaces better than export $(...))
load_env() {
    local env_file=$1
    if [ -f "$env_file" ]; then
        echo "[Config] Loading $env_file"
        set -a
        source "$env_file"
        set +a
        export ENV_FILE_LOADED="$env_file"
    fi
}

FALLBACK_URL="https://sigilos.fr"

if [ -f "$ROOT_DIR/.env.prod" ]; then
    load_env "$ROOT_DIR/.env.prod"
    FALLBACK_URL="https://sigilos.fr"
elif [ -f "$ROOT_DIR/.env.beta" ]; then
    load_env "$ROOT_DIR/.env.beta"
    FALLBACK_URL="https://beta.sigilos.fr"
elif [ -f "$ROOT_DIR/.env" ]; then
    load_env "$ROOT_DIR/.env"
    FALLBACK_URL="https://beta.sigilos.fr"
fi

# Nova API God Notify (Cloudflare proxy URL or internal if app is up)
# CRITICAL: If NEXT_PUBLIC_APP_URL is localhost, we MUST use the external domain 
# from the VPS host because localhost:3000 is not exposed there.
GOD_NOTIFY_URL="${NEXT_PUBLIC_APP_URL:-$FALLBACK_URL}"
if [[ "$GOD_NOTIFY_URL" == *"localhost"* ]]; then
    GOD_NOTIFY_URL="$FALLBACK_URL"
fi
export GOD_NOTIFY_URL="$GOD_NOTIFY_URL/api/god/notify"

DB_CONTAINER="sigilos-db-prod"
if [[ "$ENV_FILE_LOADED" == *".env.beta"* ]]; then
    DB_CONTAINER="sigilos-db-beta"
fi

# Override from env if set
DB_CONTAINER="${BACKUP_DB_CONTAINER:-$DB_CONTAINER}"
DB_USER="${POSTGRES_USER:-user}"

DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME_RAW="sigilos_${DATE}.sql.gz"
FILENAME_ENC="${FILENAME_RAW}.gpg"

send_god_notif() {
    local title=$1
    local message=$2
    local type=$3
    local success=$4
    local metadata=$5

    echo "[$(date)] 📣 Sending God Notification: $title..."

    if [ -z "$CRON_SECRET" ]; then
        echo "⚠️  CRON_SECRET is missing. Notification skipped."
        return
    fi

    # Ensure GOD_NOTIFY_URL is reachable (use fallback if domain is not yet resolved or internal only)
    local target_url="$GOD_NOTIFY_URL"
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$target_url" \
        -H "Authorization: Bearer $CRON_SECRET" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"$title\",
            \"message\": \"$message\",
            \"type\": \"$type\",
            \"success\": $success,
            \"metadata\": $metadata
        }")

    if [ "$response" -eq 200 ]; then
        echo "✅ Notification sent!"
    else
        echo "❌ Notification failed (HTTP $response). Check your CRON_SECRET and URL: $target_url"
    fi
}

# GPG Passphrase for backup encryption (Must be in .env)
if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
    echo "❌ CRITICAL: BACKUP_ENCRYPTION_KEY is missing"
    send_god_notif "[Backup] ÉCHOUÉ" "La clé de chiffrement (BACKUP_ENCRYPTION_KEY) est absente de l'env." "BACKUP" "false" "{ \"error\": \"missing_encryption_key\" }"
    exit 1
fi

mkdir -p $BACKUP_DIR

# 2. Dump & Compress
# ------------------
echo "[$(date)] 📦 Starting Backup (Container: $DB_CONTAINER)..."
docker exec $DB_CONTAINER pg_dumpall -c -U $DB_USER | gzip > "$BACKUP_DIR/$FILENAME_RAW"

if [ $? -ne 0 ]; then
    echo "❌ Dump failed!"
    send_god_notif "[Backup] ÉCHOUÉ" "Le dump PostgreSQL ($DB_CONTAINER) a échoué." "BACKUP" "false" "{ \"step\": \"dump\", \"container\": \"$DB_CONTAINER\" }"
    exit 1
fi

# 3. Encrypt (AES-256)
# --------------------
echo "[$(date)] 🔒 Encrypting..."
echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 --symmetric --cipher-algo AES256 -o "$BACKUP_DIR/$FILENAME_ENC" "$BACKUP_DIR/$FILENAME_RAW"

if [ $? -eq 0 ]; then
    echo "✅ Encryption successful."
    rm "$BACKUP_DIR/$FILENAME_RAW" 
else
    echo "❌ Encryption failed!"
    send_god_notif "[Backup] ÉCHOUÉ" "Le chiffrement GPG du backup a échoué." "BACKUP" "false" "{ \"step\": \"encryption\", \"filename\": \"$FILENAME_RAW\" }"
    exit 1
fi

# 4. Upload to R2 (via AWS CLI)
# -----------------------------
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"
export AWS_ENDPOINT_URL="$R2_ENDPOINT_URL" 

if [ -n "$R2_BUCKET_NAME" ] && [ -n "$AWS_ENDPOINT_URL" ]; then
    echo "[$(date)] ☁️ Uploading to R2..."
    aws s3 cp "$BACKUP_DIR/$FILENAME_ENC" "s3://$R2_BUCKET_NAME/$FILENAME_ENC" --endpoint-url "$AWS_ENDPOINT_URL"

    if [ $? -eq 0 ]; then
        echo "✅ Upload successful!"
        send_god_notif "[Backup] Réussi" "Sauvegarde chiffrée ($DB_CONTAINER) transférée vers R2." "BACKUP" "true" "{ \"filename\": \"$FILENAME_ENC\", \"container\": \"$DB_CONTAINER\" }"
    else
        echo "❌ Upload failed!"
        send_god_notif "[Backup] Alerte Upload" "Le dump est fait mais le transfert vers R2 a échoué." "BACKUP" "false" "{ \"filename\": \"$FILENAME_ENC\", \"status\": \"local_only\" }"
    fi
else
    echo "⚠️ R2 credentials missing. Skipping upload."
    send_god_notif "[Backup] Partiel (Local)" "Le backup est prêt localement mais les clés R2 sont absentes." "BACKUP" "false" "{ \"error\": \"missing_r2_config\" }"
fi

# 5. Cleanup Local & Remote (Rotation)
# ------------------------------------
# Keep local files for 3 days
find $BACKUP_DIR -type f -name "*.gpg" -mtime +3 -delete

# (Optional) Remote rotation - handled by Bucket Lifecycle Policy usually, but simple cleanup check:
# aws s3 ls ... | sort ...

echo "[$(date)] 🎉 Backup procedure completed."
