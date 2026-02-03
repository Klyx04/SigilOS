#!/bin/bash

# =============================================================================
# 🚑 SigilOS - Emergency Restore
# =============================================================================
# Downloads encrypted backup from R2, decrypts it, and restores to DB.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load env vars
if [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
fi

DB_CONTAINER="sigilos-db"
DB_USER="${POSTGRES_USER:-user}"
BACKUP_DIR="/var/backups/sigilos"

# Check dependencies
if ! command -v aws &> /dev/null; then echo "❌ aws-cli required"; exit 1; fi
if ! command -v gpg &> /dev/null; then echo "❌ gpg required"; exit 1; fi

if [ -z "$1" ]; then
    echo "Usage: ./restore_db.sh <backup_filename.sql.gz.gpg>"
    echo "Available local backups:"
    ls -lh $BACKUP_DIR/*.gpg 2>/dev/null
    echo ""
    echo "To download from R2, use --download-latest"
    exit 1
fi

TARGET_FILE="$1"

# Remap R2 env vars
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"
export AWS_ENDPOINT_URL="$R2_ENDPOINT_URL"

# Mode: Download Latest
if [ "$1" == "--download-latest" ]; then
    echo "☁️ Fetching latest backup from R2..."
    LATEST=$(aws s3 ls "s3://$R2_BUCKET_NAME/" --endpoint-url "$AWS_ENDPOINT_URL" | sort | tail -n 1 | awk '{print $4}')
    
    if [ -z "$LATEST" ]; then
        echo "❌ No backup found in bucket."
        exit 1
    fi
    
    echo "⬇️ Downloading $LATEST..."
    aws s3 cp "s3://$R2_BUCKET_NAME/$LATEST" "$BACKUP_DIR/$LATEST" --endpoint-url "$AWS_ENDPOINT_URL"
    TARGET_FILE="$BACKUP_DIR/$LATEST"
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
