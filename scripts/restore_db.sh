#!/bin/bash

# =============================================================================
# 🚑 SigilOS - Emergency Restore
# =============================================================================
# Downloads encrypted backup from R2, decrypts it, and restores to DB.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 1. Config & Context
# -------------------
# `pipefail` : un `aws s3 ls` en échec ne doit pas se traduire par « aucun backup
# trouvé » (les deux cas sortaient vides et se confondaient).
set -uo pipefail

# Local backup directory
BACKUP_DIR="$ROOT_DIR/backups/db"
mkdir -p "$BACKUP_DIR"

# [MOD] Target Environment (Required)
TARGET_ENV="${1:-}"
if [ "$TARGET_ENV" != "beta" ] && [ "$TARGET_ENV" != "prod" ]; then
    echo "❌ Usage: ./restore_db.sh {beta|prod} {filename|--download-latest}"
    exit 1
fi

ACTION="${2:-}"
FROM_ENV="$TARGET_ENV"   # source du dump : la bascule Jour J restaure beta → prod
ASSUME_YES=0

if [ $# -ge 2 ]; then shift 2; else shift $#; fi

while [ $# -gt 0 ]; do
    case "$1" in
        --from) FROM_ENV="${2:-}"; shift 2 ;;
        -y|--yes) ASSUME_YES=1; shift ;;
        *) echo "❌ Option inconnue : $1"; exit 1 ;;
    esac
done

if [ -z "$ACTION" ]; then
    echo "❌ Usage: ./restore_db.sh $TARGET_ENV {filename|--download-latest} [--from beta|prod] [--yes]"
    exit 1
fi

if [ "$FROM_ENV" != "beta" ] && [ "$FROM_ENV" != "prod" ]; then
    echo "❌ --from doit valoir 'beta' ou 'prod' (reçu : '$FROM_ENV')"
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

# Remap R2 env vars (fail-closed : sans ces clés, aucune restauration possible)
export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
export AWS_DEFAULT_REGION="auto"
export AWS_ENDPOINT_URL="${R2_ENDPOINT_URL:-}"

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$AWS_ENDPOINT_URL" ] || [ -z "${R2_BUCKET_NAME:-}" ]; then
    echo "❌ Configuration R2 incomplète (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT_URL / R2_BUCKET_NAME)."
    echo "   Vérifier l'env chargé (.env.beta / .env.prod) — aucune restauration n'est tentée."
    exit 1
fi

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "❌ BACKUP_ENCRYPTION_KEY absente : les dumps sont illisibles sans elle."
    exit 1
fi

# Mode: Download Latest
if [ "$ACTION" == "--download-latest" ]; then
    echo "☁️ Fetching latest $FROM_ENV backup from R2..."
    # Filtre sur la **source** ($FROM_ENV), pas sur la cible : la doc annonçait
    # « restaure la prod depuis le dernier backup beta » alors que le script
    # cherchait `sigilos_prod_` — la bascule Jour J échouait ou restaurait un
    # dump prod périmé (mesuré le 29/10/2026).
    LATEST=$(aws s3 ls "s3://$R2_BUCKET_NAME/" --endpoint-url "$AWS_ENDPOINT_URL" | grep "sigilos_${FROM_ENV}_" | sort | tail -n 1 | awk '{print $4}') || true

    if [ -z "$LATEST" ]; then
        echo "❌ No backup found for $FROM_ENV in bucket."
        exit 1
    fi

    echo "⬇️ Downloading $LATEST..."
    if ! aws s3 cp "s3://$R2_BUCKET_NAME/$LATEST" "$BACKUP_DIR/$LATEST" --endpoint-url "$AWS_ENDPOINT_URL" --only-show-errors; then
        echo "❌ Téléchargement échoué : $LATEST"
        exit 1
    fi
    TARGET_FILE="$BACKUP_DIR/$LATEST"
else
    # La doc passe un **nom nu** (`sigilos_prod_….sql.gz.gpg`), pas un chemin :
    # `-f` échouait donc systématiquement sur la restauration d'un fichier précis.
    if [ -f "$ACTION" ]; then
        TARGET_FILE="$ACTION"
    elif [ -f "$BACKUP_DIR/$ACTION" ]; then
        TARGET_FILE="$BACKUP_DIR/$ACTION"
    else
        TARGET_FILE="$ACTION"
    fi
fi

if [ ! -f "$TARGET_FILE" ]; then
    echo "❌ File not found: $TARGET_FILE"
    exit 1
fi

# Decrypt
DECRYPTED_FILE="${TARGET_FILE%.gpg}"
echo "🔓 Decrypting..."
echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --pinentry-mode loopback --yes --passphrase-fd 0 --decrypt -o "$DECRYPTED_FILE" "$TARGET_FILE"

if [ $? -ne 0 ] || [ ! -s "$DECRYPTED_FILE" ]; then
    echo "❌ Decryption failed! Check BACKUP_ENCRYPTION_KEY."
    exit 1
fi

# Restore
echo "🛑 Restoring $TARGET_ENV (This will overwrite everything)..."
if [ "$ASSUME_YES" -ne 1 ]; then
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 1
    fi
fi

# Deux gardes, mesurées le 29/10/2026 :
# ① `psql` sans `ON_ERROR_STOP` continuait après une erreur et le script annonçait
#    « ✅ Restore completed » sur une base à moitié restaurée ;
# ② un `ON_ERROR_STOP=1` sec casse la restauration d'un dump produit **avant**
#    `--if-exists` : son premier `DROP DATABASE <base>` échoue quand la base
#    n'existe pas encore. On tolère donc UNIQUEMENT les erreurs « does not exist ».
# Prérequis : arrêter les conteneurs applicatifs avant (docs/agents/disaster-recovery.md).
RESTORE_LOG=$(mktemp)
cat "$DECRYPTED_FILE" | gunzip | docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=0 -U "$DB_USER" postgres >"$RESTORE_LOG" 2>&1 || true

FATAL=$(grep '^ERROR:' "$RESTORE_LOG" | grep -v 'does not exist' || true)
if [ -n "$FATAL" ]; then
    echo "❌ Restauration ÉCHOUÉE — erreurs rencontrées :"
    printf '%s\n' "$FATAL" | head -20
    echo "   Le dump déchiffré est conservé pour rejouer : $DECRYPTED_FILE"
    exit 1
fi
rm -f "$RESTORE_LOG"

# Preuve minimale : une base restaurée sans aucun compte n'est pas une restauration.
USER_COUNT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "${POSTGRES_DB:-sigilos}" -At -c 'select count(*) from "User"' 2>/dev/null || true)
if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" = "0" ]; then
    echo "❌ Restauration ÉCHOUÉE — la table \"User\" est vide ou illisible dans ${POSTGRES_DB:-sigilos}."
    echo "   Le dump déchiffré est conservé pour rejouer : $DECRYPTED_FILE"
    exit 1
fi
echo "   Comptes restaurés : $USER_COUNT"

echo "✅ Restore completed."
rm "$DECRYPTED_FILE" # Clean up decrypted file
