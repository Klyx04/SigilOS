#!/bin/bash

# =============================================================================
# 🧪 SigilOS — Répétition de restauration (banc d'essai jetable)
# =============================================================================
# Rejoue le dernier dump R2 dans un PostgreSQL **éphémère** : ni la bêta ni la
# prod ne sont touchées. C'est la preuve du rang 4 de `docs/ROADMAP.md` —
# « la sauvegarde se restaure vraiment, et voici les volumes récupérés ».
#
# Usage :
#   bash scripts/restore-drill.sh [beta|prod]
#
# Variables optionnelles :
#   DRILL_PORT=55432   port local du conteneur jetable (127.0.0.1 uniquement)
#   DRILL_KEEP=1       conserve le conteneur à la fin (inspection manuelle)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DRILL_START_TS=$(date +%s)

TARGET_ENV="${1:-beta}"
if [ "$TARGET_ENV" != "beta" ] && [ "$TARGET_ENV" != "prod" ]; then
    echo "❌ Usage: bash scripts/restore-drill.sh [beta|prod]"
    exit 1
fi

BACKUP_DIR="$ROOT_DIR/backups/db"
DRILL_CONTAINER="sigilos-restore-drill"
DRILL_PORT="${DRILL_PORT:-55432}"
# Même majeure que la base de production (docker-compose.prod.yml).
DRILL_IMAGE="postgres:15-alpine"

load_env() {
    local env_file=$1
    if [ -f "$env_file" ]; then
        echo "[Config] Loading $env_file"
        set -a
        # shellcheck disable=SC1090
        source "$env_file"
        set +a
    fi
}

if [ "$TARGET_ENV" == "prod" ]; then
    load_env "$ROOT_DIR/.env.prod"
    DB_CONTAINER="sigilos-db-prod"
else
    load_env "$ROOT_DIR/.env.beta"
    DB_CONTAINER="sigilos-db-beta"
fi
DB_CONTAINER="${BACKUP_DB_CONTAINER:-$DB_CONTAINER}"
SRC_USER="${POSTGRES_USER:-}"
SRC_DB="${POSTGRES_DB:-sigilos}"

# Fail-closed : sans ces valeurs, aucun téléchargement ni déchiffrement possible.
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID manquant dans l'env}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY manquant dans l'env}"
: "${R2_ENDPOINT_URL:?R2_ENDPOINT_URL manquant dans l'env}"
: "${R2_BUCKET_NAME:?R2_BUCKET_NAME manquant dans l'env}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY manquante : le dump est illisible sans elle}"

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"
export AWS_ENDPOINT_URL="$R2_ENDPOINT_URL"

# Notification God — type **SYSTEM** et non `BACKUP` : la route `/api/god/notify`
# n'enregistre la télémétrie `backup_db` que pour le type `BACKUP`, et une
# répétition ne doit jamais écraser l'état de la vraie sauvegarde.
GOD_NOTIFY_BASE="${GOD_NOTIFY_BASE:-${NEXT_PUBLIC_APP_URL:-}}"
if [ -z "$GOD_NOTIFY_BASE" ]; then
    if [ "$TARGET_ENV" == "prod" ]; then GOD_NOTIFY_BASE="https://sigilos.fr"; else GOD_NOTIFY_BASE="https://beta.sigilos.fr"; fi
fi
if [[ "$GOD_NOTIFY_BASE" == *"localhost"* ]]; then
    GOD_NOTIFY_BASE="https://beta.sigilos.fr"
fi
GOD_NOTIFY_URL="$GOD_NOTIFY_BASE/api/god/notify"

send_god_notif() {
    local title=$1
    local message=$2
    local success=$3
    local metadata=$4

    if [ -z "${CRON_SECRET:-}" ]; then
        echo "⚠️  CRON_SECRET absent : notification God ignorée."
        return
    fi

    local payload="{
        \"title\": \"$title\",
        \"message\": \"$message\",
        \"type\": \"SYSTEM\",
        \"success\": $success,
        \"metadata\": $metadata
    }"

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$GOD_NOTIFY_URL" \
        -H "Authorization: Bearer $CRON_SECRET" \
        -H "Content-Type: application/json" \
        -d "$payload") || true

    if [ "$http_code" -eq 200 ] 2>/dev/null; then
        echo "📣 Notification God envoyée."
    else
        echo "❌ Notification God en échec (HTTP $http_code) — $GOD_NOTIFY_URL"
    fi
}

mkdir -p "$BACKUP_DIR"
DRILL_FILE=""
DRILL_DEC=""
DRILL_STARTED=0

cleanup() {
    local rc=$?

    if [ "$DRILL_STARTED" -eq 1 ] && [ "${DRILL_KEEP:-0}" = "1" ]; then
        echo ""
        echo "ℹ️  Conteneur conservé : docker exec -it $DRILL_CONTAINER psql -U drill -d $SRC_DB"
        return
    fi
    if [ "$DRILL_STARTED" -eq 1 ]; then
        docker rm -f "$DRILL_CONTAINER" >/dev/null 2>&1 || true
        echo "🧹 Conteneur jetable supprimé."
    fi
    # Le dump déchiffré ne doit pas traîner en clair plus longtemps que nécessaire.
    if [ -n "$DRILL_DEC" ] && [ -f "$DRILL_DEC" ]; then
        rm -f "$DRILL_DEC"
    fi

    # Tout échec (y compris une interruption) part dans God : une répétition qui
    # ne dit rien est une répétition qu'on croit réussie.
    if [ "$rc" -ne 0 ]; then
        send_god_notif \
            "[Backup] Répétition de restauration ÉCHOUÉE" \
            "La répétition $TARGET_ENV a échoué (code $rc). La sauvegarde n'est pas forcément en cause, mais la preuve de restauration manque — voir logs/restore-drill.log." \
            "false" \
            "{ \"exit_code\": $rc, \"target\": \"$TARGET_ENV\" }"
    fi
}
trap cleanup EXIT

echo "[1/5] Dernier dump $TARGET_ENV sur R2…"
LATEST=$(aws s3 ls "s3://$R2_BUCKET_NAME/" --endpoint-url "$AWS_ENDPOINT_URL" | grep "sigilos_${TARGET_ENV}_" | sort | tail -n 1 | awk '{print $4}') || true
if [ -z "$LATEST" ]; then
    echo "❌ Aucun dump $TARGET_ENV dans le bucket."
    exit 1
fi
echo "      → $LATEST"

echo "[2/5] Téléchargement…"
DRILL_FILE="$BACKUP_DIR/$LATEST"
if ! aws s3 cp "s3://$R2_BUCKET_NAME/$LATEST" "$DRILL_FILE" --endpoint-url "$AWS_ENDPOINT_URL" --only-show-errors; then
    echo "❌ Téléchargement impossible : $LATEST"
    exit 1
fi

echo "[3/5] Déchiffrement…"
DRILL_DEC="$BACKUP_DIR/${LATEST%.gpg}"
echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --pinentry-mode loopback --yes --passphrase-fd 0 --decrypt -o "$DRILL_DEC" "$DRILL_FILE"

echo "[4/5] PostgreSQL jetable ($DRILL_IMAGE, 127.0.0.1:$DRILL_PORT)…"
docker rm -f "$DRILL_CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$DRILL_CONTAINER" \
    -e POSTGRES_USER=drill -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill \
    -p "127.0.0.1:${DRILL_PORT}:5432" "$DRILL_IMAGE" >/dev/null
DRILL_STARTED=1

READY=0
for _ in $(seq 1 60); do
    if docker exec "$DRILL_CONTAINER" pg_isready -U drill -d postgres >/dev/null 2>&1; then
        READY=1
        break
    fi
    sleep 1
done
if [ "$READY" -ne 1 ]; then
    echo "❌ Le PostgreSQL jetable n'a pas démarré (port $DRILL_PORT déjà pris ?)"
    exit 1
fi

echo "[5/5] Restauration (le dump contient les bases)…"
DRILL_LOG=$(mktemp)
gunzip -c "$DRILL_DEC" | docker exec -i "$DRILL_CONTAINER" psql -v ON_ERROR_STOP=0 -U drill -d postgres >"$DRILL_LOG" 2>&1 || true

# Les dumps produits avant le 30/10/2026 n'ont pas `--if-exists` : leur premier
# `DROP DATABASE <base>` échoue sur un cluster neuf (« does not exist »).
# C'est la SEULE erreur tolérée ; toute autre erreur fait échouer la répétition.
FATAL=$(grep '^ERROR:' "$DRILL_LOG" | grep -v 'does not exist' || true)
if [ -n "$FATAL" ]; then
    echo "❌ Erreurs inattendues pendant la restauration :"
    printf '%s\n' "$FATAL" | head -20
    rm -f "$DRILL_LOG"
    exit 1
fi
LEGACY=$(grep -c 'does not exist' "$DRILL_LOG" || true)
rm -f "$DRILL_LOG"
if [ "${LEGACY:-0}" -gt 0 ]; then
    echo "      ⚠️  ${LEGACY} avertissement(s) « does not exist » (dump antérieur à --if-exists) — tolérés"
fi
echo "      ✅ dump rejoué"

# -----------------------------------------------------------------------------
# Contrôle des volumes : la même requête des deux côtés (source vivante et
# restauration), puis l'écart. Une table absente de la copie saute aux yeux.
# -----------------------------------------------------------------------------
counts() {
    local container="$1"
    local user="$2"
    local db="$3"
    docker exec -i "$container" psql -U "$user" -d "$db" -At -F '|' 2>/dev/null <<'SQL'
select 'User', count(*) from "User"
union all select 'UserProfile', count(*) from "UserProfile"
union all select 'GuildConfig', count(*) from "GuildConfig"
union all select 'GameItem', count(*) from "GameItem"
union all select 'DofusItem', count(*) from "DofusItem"
union all select 'PlayerDofusProgress', count(*) from "PlayerDofusProgress"
union all select 'PlayerGuideProgress', count(*) from "PlayerGuideProgress"
union all select 'DreamRun', count(*) from "DreamRun"
union all select 'MarketListing', count(*) from "MarketListing"
union all select 'SupportTicket', count(*) from "SupportTicket"
order by 1;
SQL
}

echo ""
echo "📊 Volumes restaurés (jetable) vs source ($DB_CONTAINER) :"
SOURCE_COUNTS=""
if docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" >/dev/null 2>&1 && [ -n "$SRC_USER" ]; then
    SOURCE_COUNTS=$(counts "$DB_CONTAINER" "$SRC_USER" "$SRC_DB" || true)
fi
DRILL_COUNTS=$(counts "$DRILL_CONTAINER" drill "$SRC_DB" || true)
if [ -z "$DRILL_COUNTS" ]; then
    echo "❌ Aucun compteur lisible dans la base $SRC_DB : la restauration n'a rien produit."
    exit 1
fi

printf '%-24s %12s %12s\n' "table" "restauré" "source"
printf '%-24s %12s %12s\n' "------------------------" "------------" "------------"
printf '%s\n' "$DRILL_COUNTS" | while IFS='|' read -r table n; do
    [ -z "$table" ] && continue
    src="-"
    if [ -n "$SOURCE_COUNTS" ]; then
        src=$(printf '%s\n' "$SOURCE_COUNTS" | awk -F'|' -v t="$table" '$1 == t {print $2}')
        [ -z "$src" ] && src="-"
    fi
    printf '%-24s %12s %12s\n' "$table" "$n" "$src"
done

DRILL_DURATION=$(( $(date +%s) - DRILL_START_TS ))
SUMMARY=$(printf '%s\n' "$DRILL_COUNTS" | awk -F'|' '{printf "%s %s ; ", $1, $2}')

echo ""
echo "✅ Répétition terminée : $LATEST restauré intégralement dans $DRILL_IMAGE."
echo "   Durée totale : ${DRILL_DURATION} s (téléchargement + déchiffrement + restauration)."
echo "   Cette durée et les compteurs ci-dessus valent comme RTO/RPO mesurés (docs/agents/disaster-recovery.md)."

send_god_notif \
    "[Backup] Répétition de restauration réussie" \
    "Dump $LATEST rejoué dans $DRILL_IMAGE en ${DRILL_DURATION} s. Compteurs : ${SUMMARY}" \
    "true" \
    "{ \"filename\": \"$LATEST\", \"duration_s\": $DRILL_DURATION, \"target\": \"$TARGET_ENV\" }"

