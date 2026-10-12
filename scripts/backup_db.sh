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

# Local backup directory
BACKUP_DIR="$ROOT_DIR/backups/db"

# [MOD] Argument Handling (Defaults to beta since that's where everyone is)
TARGET_ENV="${1:-beta}"
echo "[Config] Target Environment: $TARGET_ENV"

# 🛡️ SAFER ENV LOADING 
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

FALLBACK_URL="https://beta.sigilos.fr"

# Load the relevant env file based on target
if [ "$TARGET_ENV" == "prod" ]; then
    load_env "$ROOT_DIR/.env.prod"
    FALLBACK_URL="https://sigilos.fr"
else
    load_env "$ROOT_DIR/.env.beta"
    FALLBACK_URL="https://beta.sigilos.fr"
fi

# If specific file not found, try generic .env
if [ -z "$ENV_FILE_LOADED" ] && [ -f "$ROOT_DIR/.env" ]; then
    load_env "$ROOT_DIR/.env"
fi

# Nova API God Notify URL
# → priorité à GOD_NOTIFY_BASE (surcharge), sinon NEXT_PUBLIC_APP_URL, sinon FALLBACK_URL.
GOD_NOTIFY_BASE="${GOD_NOTIFY_BASE:-${NEXT_PUBLIC_APP_URL:-$FALLBACK_URL}}"
if [[ "$GOD_NOTIFY_BASE" == *"localhost"* ]]; then
    GOD_NOTIFY_BASE="$FALLBACK_URL"
fi
export GOD_NOTIFY_URL="$GOD_NOTIFY_BASE/api/god/notify"

# Container detection
DB_CONTAINER="sigilos-db-beta"
if [ "$TARGET_ENV" == "prod" ]; then
    DB_CONTAINER="sigilos-db-prod"
fi

# Override from env if set
DB_CONTAINER="${BACKUP_DB_CONTAINER:-$DB_CONTAINER}"
DB_USER="${POSTGRES_USER:-user}"

DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME_RAW="sigilos_${TARGET_ENV}_${DATE}.sql.gz"
FILENAME_ENC="${FILENAME_RAW}.gpg"

send_god_notif() {
    local title=$1
    local message=$2
    local type=$3
    local success=$4
    local metadata=$5

    echo "[$(date)] 📣 Sending God Notification: $title..."
    echo "[Debug] Target URL: $GOD_NOTIFY_URL"

    if [ -z "$CRON_SECRET" ]; then
        echo "⚠️  CRON_SECRET is missing from env. Notification skipped."
        echo "[Debug] Loaded env file: ${ENV_FILE_LOADED:-none}"
        return
    fi

    echo "[Debug] CRON_SECRET is set (length: ${#CRON_SECRET})"

    local target_url="$GOD_NOTIFY_URL"
    local payload="{
        \"title\": \"$title\",
        \"message\": \"$message\",
        \"type\": \"$type\",
        \"success\": $success,
        \"metadata\": $metadata
    }"

    # Capture both HTTP code AND response body for debugging
    local http_body
    local http_code
    http_body=$(curl -s -w "\n%{http_code}" -X POST "$target_url" \
        -H "Authorization: Bearer $CRON_SECRET" \
        -H "Content-Type: application/json" \
        -d "$payload")

    http_code=$(echo "$http_body" | tail -n1)
    local response_body=$(echo "$http_body" | sed '$d')

    echo "[Debug] HTTP Response Code: $http_code"
    echo "[Debug] Response Body: $response_body"

    if [ "$http_code" -eq 200 ] 2>/dev/null; then
        echo "✅ Notification sent successfully!"
    else
        echo "❌ Notification failed (HTTP $http_code) — Check CRON_SECRET and URL: $target_url"
        echo "   Body: $response_body"
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
