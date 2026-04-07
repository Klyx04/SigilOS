#!/bin/bash

# =============================================================================
# 🚑 SigilOS - Emergency Restore
# =============================================================================
# Downloads encrypted backup from R2, decrypts it, and restores to DB.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 1. Config & Context
# -------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Local backup directory
BACKUP_DIR="$ROOT_DIR/backups/db"
mkdir -p "$BACKUP_DIR"

# [MOD] Target Environment (Required)
TARGET_ENV="$1"
if [ "$TARGET_ENV" != "beta" ] && [ "$TARGET_ENV" != "prod" ]; then
    echo "❌ Usage: ./restore_db.sh {beta|prod} {filename|--download-latest}"
    exit 1
fi

ACTION="$2"
if [ -z "$ACTION" ]; then
    echo "❌ Usage: ./restore_db.sh $TARGET_ENV {filename|--download-latest}"
    exit 1
fi

# Load env vars
load_env() {
    local env_file=$1
    if [ -f "$env_file" ]; then
        echo "[Config] Loading $env_file"
        set -a
        source "$env_file"
        set +a
    fi
}

if [ "$TARGET_ENV" == "prod" ]; then
    load_env "$ROOT_DIR/.env.prod"
else
    load_env "$ROOT_DIR/.env.beta"
fi

DB_CONTAINER="sigilos-db-$TARGET_ENV"
DB_USER="${POSTGRES_USER:-user}"

# Remap R2 env vars
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"
export AWS_ENDPOINT_URL="$R2_ENDPOINT_URL"

# Mode: Download Latest
if [ "$ACTION" == "--download-latest" ]; then
    echo "☁️ Fetching latest $TARGET_ENV backup from R2..."
    # Filter by sigilos_beta_ or sigilos_prod_
    LATEST=$(aws s3 ls "s3://$R2_BUCKET_NAME/" --endpoint-url "$AWS_ENDPOINT_URL" | grep "sigilos_${TARGET_ENV}_" | sort | tail -n 1 | awk '{print $4}')
    
    if [ -z "$LATEST" ]; then
        echo "❌ No backup found for $TARGET_ENV in bucket."
        exit 1
    fi
    
    echo "⬇️ Downloading $LATEST..."
    aws s3 cp "s3://$R2_BUCKET_NAME/$LATEST" "$BACKUP_DIR/$LATEST" --endpoint-url "$AWS_ENDPOINT_URL"
    TARGET_FILE="$BACKUP_DIR/$LATEST"
else
    TARGET_FILE="$ACTION"
fi

if [ ! -f "$TARGET_FILE" ]; then
    echo "❌ File not found: $TARGET_FILE"
    exit 1
fi

# Decrypt
DECRYPTED_FILE="${TARGET_FILE%.gpg}"
echo "🔓 Decrypting..."
echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 --decrypt -o "$DECRYPTED_FILE" "$TARGET_FILE"

if [ $? -ne 0 ]; then
    echo "❌ Decryption failed! Check BACKUP_ENCRYPTION_KEY."
    exit 1
fi

# Restore
echo "🛑 Restoring Database (This will overwrite everything)..."
read -p "Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Drop & Restore logic depends on dump type. pg_dumpall -c includes "DROP DATABASE" usually.
cat "$DECRYPTED_FILE" | gunzip | docker exec -i $DB_CONTAINER psql -U $DB_USER postgres

echo "✅ Restore completed."
rm "$DECRYPTED_FILE" # Clean up decrypted file
