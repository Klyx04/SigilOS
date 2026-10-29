#!/bin/bash

# =============================================================================
# 🛡️ SigilOS - Secure Off-site Backup (R2)
# =============================================================================
# Dump PostgreSQL (pg_dumpall) → gzip → chiffrement GPG (AES-256) → upload R2.
#
# 🔒 Ce script ne dit « réussi » que sur **preuve** (relevé du 29/10/2026) :
#   ① dump complet — `pipefail` (le code de `pg_dumpall` était masqué par
#      `gzip`), conteneur vérifié, plancher de taille, `gzip -t` et marqueur de
#      fin écrit par `pg_dumpall` ;
#   ② fichier chiffré valide (`gpg --list-packets`) ;
#   ③ objet présent sur R2 **avec la taille locale** (`head-object`) ;
#   ④ rotation R2 bornée **en octets** — plan gratuit Cloudflare (10 Go) ;
#   ⑤ tout échec sort en **code 1** (le crontab le voit), en plus de la notif God.
#
# 💰 Stockage : seuls les `.gpg` partent sur R2. Rétention = 7 derniers dumps +
#    le dernier de chacun des 3 derniers mois, **plafonnés** à
#    `BACKUP_R2_MAX_MB` (4 Go par défaut, soit 40 % du plan gratuit).
#    Une suppression R2 est gratuite chez Cloudflare ; une lecture aussi.
# =============================================================================

# 1. Config & Context
# -------------------
set -euo pipefail

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
if [ -z "${ENV_FILE_LOADED:-}" ] && [ -f "$ROOT_DIR/.env" ]; then
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

# 💰 Rétention & budget (plan gratuit R2 : 10 Go / mois)
BACKUP_KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"        # N derniers dumps quotidiens
BACKUP_KEEP_MONTHLY="${BACKUP_KEEP_MONTHLY:-3}"    # + le dernier de chacun des N derniers mois
BACKUP_R2_MAX_MB="${BACKUP_R2_MAX_MB:-4096}"       # plafond dur (Mo) : 40 % des 10 Go
BACKUP_LOCAL_KEEP="${BACKUP_LOCAL_KEEP:-5}"        # copies locales gardées
BACKUP_MIN_KB="${BACKUP_MIN_KB:-1024}"             # en dessous = dump suspect (Ko)

R2_MAX_BYTES=$((BACKUP_R2_MAX_MB * 1024 * 1024))

DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME_RAW="sigilos_${TARGET_ENV}_${DATE}.sql.gz"
FILENAME_ENC="${FILENAME_RAW}.gpg"
FILENAME_ENC_PATH="$BACKUP_DIR/$FILENAME_ENC"

send_god_notif() {
    local title=$1
    local message=$2
    local type=$3
    local success=$4
    local metadata=$5

    echo "[$(date)] 📣 Sending God Notification: $title..."
    echo "[Debug] Target URL: $GOD_NOTIFY_URL"

    if [ -z "${CRON_SECRET:-}" ]; then
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
        -d "$payload") || true

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

# -----------------------------------------------------------------------------
# ④ Rotation R2 — plan pur (testable sans AWS) : lit « clé<TAB>octets<TAB>horodatage »
# sur stdin (trié du plus ancien au plus récent) et écrit « DEL <clé> » par objet
# à supprimer, puis « TOTAL <octets> ». Les objets hors nomenclature `sigilos_*`
# ne sont jamais supprimés.
# -----------------------------------------------------------------------------
plan_r2_rotation() {
    local keep_daily="$1"
    local keep_monthly="$2"
    local max_bytes="$3"

    awk -v keep="$keep_daily" -v months="$keep_monthly" -v max="$max_bytes" '
    {
        n++
        key[n] = $1
        size[n] = $2 + 0
        total += size[n]
        split($1, p, "_")
        month_of[n] = (p[1] == "sigilos") ? substr(p[3], 1, 7) : ""
    }
    END {
        total = total + 0
        # dernier objet de chaque mois (le flux est chronologique)
        for (i = 1; i <= n; i++) last_of_month[month_of[i]] = i

        # les `months` mois les plus récents
        m = 0
        for (i = n; i >= 1 && m < months; i--) {
            if (month_of[i] == "") continue
            if (!(month_of[i] in kept_month)) { kept_month[month_of[i]] = 1; m++ }
        }

        for (i = 1; i <= n; i++) {
            protected_[i] = 0
            if (month_of[i] == "") { protected_[i] = 1; continue }   # jamais touché
            if (i > n - keep) protected_[i] = 1                       # N derniers
            if (last_of_month[month_of[i]] == i && (month_of[i] in kept_month)) protected_[i] = 1
        }

        # ① rétention par nombre : tout ce qui est hors des N derniers et hors des
        #    mois conservés part, **même sous** le plafond d octets — sinon le bucket
        #    grossit sans limite tant qu on reste sous le plafond.
        for (i = 1; i <= n; i++) {
            if (protected_[i]) continue
            print "DEL " key[i]
            total -= size[i]
            deleted[i] = 1
        }
        # ② plafond dur : les protégés cèdent du plus ancien au plus récent,
        #    jamais le tout dernier.
        for (i = 1; i <= n && total > max; i++) {
            if (i == n || deleted[i]) continue
            print "DEL " key[i]
            total -= size[i]
        }
        print "TOTAL " total
    }'
}

# Garde les `keep` fichiers locaux les plus récents (rotation bornée en nombre,
# là où l ancienne rétention par ancienneté supprimait à l aveugle — y compris
# la seule copie restante pendant une panne d upload).
prune_local() {
    local keep=$1
    local n=0
    local f
    while IFS= read -r f; do
        n=$((n + 1))
        if [ "$n" -gt "$keep" ]; then
            rm -f "$f"
        fi
    done < <(ls -1t "$BACKUP_DIR"/sigilos_*.sql.gz.gpg 2>/dev/null || true)
}

# GPG Passphrase for backup encryption (Must be in .env)
if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "❌ CRITICAL: BACKUP_ENCRYPTION_KEY is missing"
    send_god_notif "[Backup] ÉCHOUÉ" "La clé de chiffrement (BACKUP_ENCRYPTION_KEY) est absente de l'env." "BACKUP" "false" "{ \"error\": \"missing_encryption_key\" }"
    exit 1
fi

mkdir -p "$BACKUP_DIR"

# 2. Dump & Compress
# ------------------
echo "[$(date)] 📦 Starting Backup (Container: $DB_CONTAINER)..."

# Fail-closed : un conteneur arrêté produisait sinon un `.gpg` de ~20 octets
# annoncé « Réussi » (le test portait sur `gzip`, jamais sur `pg_dumpall`).
if [ "$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null || echo false)" != "true" ]; then
    echo "❌ Container $DB_CONTAINER is not running!"
    send_god_notif "[Backup] ÉCHOUÉ" "Le conteneur $DB_CONTAINER n'est pas démarré — aucun dump possible." "BACKUP" "false" "{ \"step\": \"dump\", \"container\": \"$DB_CONTAINER\", \"error\": \"container_down\" }"
    exit 1
fi

# `pipefail` (posé en tête) : le code de sortie est celui de `pg_dumpall`, plus
# celui de `gzip` — c'est **le** défaut qui rendait le statut « Réussi » menteur.
# `--if-exists` est INDISPENSABLE : sans lui, `-c` émet `DROP DATABASE <base>;`
# sans garde, et la restauration s'arrête sur un cluster neuf (« database does not
# exist ») — mesuré le 29/10/2026, le dump du 27/10 n'était pas restaurable à froid.
if ! docker exec "$DB_CONTAINER" pg_dumpall -c --if-exists -U "$DB_USER" | gzip -6 > "$BACKUP_DIR/$FILENAME_RAW"; then
    echo "❌ Dump failed!"
    rm -f "$BACKUP_DIR/$FILENAME_RAW"
    send_god_notif "[Backup] ÉCHOUÉ" "Le dump PostgreSQL ($DB_CONTAINER) a échoué." "BACKUP" "false" "{ \"step\": \"dump\", \"container\": \"$DB_CONTAINER\" }"
    exit 1
fi

RAW_BYTES=$(wc -c < "$BACKUP_DIR/$FILENAME_RAW" | tr -d ' ')
RAW_KB=$((RAW_BYTES / 1024))

if [ "$RAW_KB" -lt "$BACKUP_MIN_KB" ]; then
    echo "❌ Dump too small (${RAW_KB} Ko < ${BACKUP_MIN_KB} Ko)"
    rm -f "$BACKUP_DIR/$FILENAME_RAW"
    send_god_notif "[Backup] ÉCHOUÉ" "Le dump ne pèse que ${RAW_KB} Ko (minimum ${BACKUP_MIN_KB} Ko) — dump vide ou tronqué, rien n'a été envoyé sur R2." "BACKUP" "false" "{ \"step\": \"dump\", \"bytes\": $RAW_BYTES, \"container\": \"$DB_CONTAINER\" }"
    exit 1
fi

if ! gzip -t "$BACKUP_DIR/$FILENAME_RAW" 2>/dev/null; then
    echo "❌ gzip integrity check failed!"
    rm -f "$BACKUP_DIR/$FILENAME_RAW"
    send_god_notif "[Backup] ÉCHOUÉ" "Le dump gzip est corrompu (test d'intégrité en échec)." "BACKUP" "false" "{ \"step\": \"gzip_check\", \"container\": \"$DB_CONTAINER\" }"
    exit 1
fi

# `pg_dumpall` écrit ce marqueur en dernière ligne : sans lui, le dump est tronqué.
DUMP_END=$(gzip -dc "$BACKUP_DIR/$FILENAME_RAW" | tail -n 20 | grep -c "PostgreSQL database dump complete" || true)
if [ "${DUMP_END:-0}" -lt 1 ]; then
    echo "❌ Dump incomplete (missing end marker)"
    send_god_notif "[Backup] ÉCHOUÉ" "Le dump est tronqué : le marqueur de fin de pg_dumpall est absent." "BACKUP" "false" "{ \"step\": \"dump_check\", \"bytes\": $RAW_BYTES, \"container\": \"$DB_CONTAINER\" }"
    exit 1
fi

# 3. Encrypt (AES-256)
# --------------------
echo "[$(date)] 🔒 Encrypting..."
# ⚠️ `echo` (et non `printf`) : le saut de ligne final fait partie de la phrase
# secrète. Les archives déjà déposées sur R2 ont été chiffrées ainsi — changer
# l'un rendrait toutes les anciennes illisibles.
set +e
# `--pinentry-mode loopback` : depuis GPG 2.1, `--passphrase-fd` seul est ignoré
# et gpg-agent ouvre une boîte de saisie (mesuré le 29/10/2026). En cron il n'y a
# pas de terminal : le chiffrement échouerait. Loopback = phrase lue sur stdin,
# jamais d'agent, jamais d'invite.
echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --pinentry-mode loopback --yes --passphrase-fd 0 --symmetric --cipher-algo AES256 -o "$FILENAME_ENC_PATH" "$BACKUP_DIR/$FILENAME_RAW"
GPG_STATUS=$?
set -e

if [ "$GPG_STATUS" -ne 0 ]; then
    echo "❌ Encryption failed!"
    send_god_notif "[Backup] ÉCHOUÉ" "Le chiffrement GPG du backup a échoué (le dump brut .sql.gz est conservé)." "BACKUP" "false" "{ \"step\": \"encryption\", \"filename\": \"$FILENAME_RAW\" }"
    exit 1
fi

# ② Un paquet GPG lisible sans la clé : preuve que le fichier n'est pas vide/tronqué.
if ! gpg --batch --list-packets "$FILENAME_ENC_PATH" >/dev/null 2>&1; then
    echo "❌ Encrypted file is not a valid GPG packet!"
    rm -f "$FILENAME_ENC_PATH"
    send_god_notif "[Backup] ÉCHOUÉ" "Le fichier chiffré produit est invalide (paquet GPG illisible)." "BACKUP" "false" "{ \"step\": \"encryption_check\", \"filename\": \"$FILENAME_ENC\" }"
    exit 1
fi

rm -f "$BACKUP_DIR/$FILENAME_RAW"
ENC_BYTES=$(wc -c < "$FILENAME_ENC_PATH" | tr -d ' ')
ENC_MB=$((ENC_BYTES / 1024 / 1024))

# 4. Upload to R2 (via AWS CLI)
# -----------------------------
export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
export AWS_DEFAULT_REGION="auto"
export AWS_ENDPOINT_URL="${R2_ENDPOINT_URL:-}"

if [ -z "${R2_BUCKET_NAME:-}" ] || [ -z "$AWS_ENDPOINT_URL" ] || [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "⚠️ R2 credentials missing. Skipping upload."
    prune_local "$BACKUP_LOCAL_KEEP"
    send_god_notif "[Backup] Partiel (Local)" "Le backup est prêt localement mais les clés R2 sont absentes de l'env." "BACKUP" "false" "{ \"error\": \"missing_r2_config\", \"bytes\": $ENC_BYTES }"
    exit 1
fi

echo "[$(date)] ☁️ Uploading to R2..."
if ! aws s3 cp "$FILENAME_ENC_PATH" "s3://$R2_BUCKET_NAME/$FILENAME_ENC" --endpoint-url "$AWS_ENDPOINT_URL" --only-show-errors; then
    echo "❌ Upload failed!"
    prune_local "$BACKUP_LOCAL_KEEP"
    send_god_notif "[Backup] Alerte Upload" "Le dump est fait mais le transfert vers R2 a échoué." "BACKUP" "false" "{ \"filename\": \"$FILENAME_ENC\", \"status\": \"local_only\", \"bytes\": $ENC_BYTES }"
    exit 1
fi

# ③ Le `cp` a réussi : on vérifie que l'objet est là **et complet**.
REMOTE_BYTES=$(aws s3api head-object --bucket "$R2_BUCKET_NAME" --key "$FILENAME_ENC" --endpoint-url "$AWS_ENDPOINT_URL" --query 'ContentLength' --output text 2>/dev/null || echo "0")
if [ "$REMOTE_BYTES" != "$ENC_BYTES" ]; then
    echo "❌ Upload verification failed (local: $ENC_BYTES o, R2: $REMOTE_BYTES o)"
    prune_local "$BACKUP_LOCAL_KEEP"
    send_god_notif "[Backup] Alerte Upload" "L'objet est absent de R2 ou sa taille ne correspond pas (local $ENC_BYTES o / R2 $REMOTE_BYTES o)." "BACKUP" "false" "{ \"filename\": \"$FILENAME_ENC\", \"status\": \"local_only\", \"bytes\": $ENC_BYTES, \"remote_bytes\": $REMOTE_BYTES }"
    exit 1
fi
echo "✅ Upload verified ($REMOTE_BYTES o on R2)."

# 5. Rotation (locale puis R2), bornée en nombre **et** en octets
# ---------------------------------------------------------------
prune_local "$BACKUP_LOCAL_KEEP"

R2_TOTAL_BYTES=0
R2_PRUNED=0
ROTATION_STATE="ok"

if LISTING=$(aws s3api list-objects-v2 \
        --bucket "$R2_BUCKET_NAME" \
        --endpoint-url "$AWS_ENDPOINT_URL" \
        --query 'Contents[].[Key,Size,LastModified]' \
        --output text 2>&1); then

    if [ -n "$LISTING" ] && [ "$LISTING" != "None" ]; then
        PLAN=$(printf '%s\n' "$LISTING" | grep -v '^None' | sort -k3,3 | plan_r2_rotation "$BACKUP_KEEP_DAILY" "$BACKUP_KEEP_MONTHLY" "$R2_MAX_BYTES" || true)
        R2_TOTAL_BYTES=$(printf '%s\n' "$PLAN" | awk '/^TOTAL /{print $2}')
        R2_PRUNED=$(printf '%s\n' "$PLAN" | grep -c '^DEL ' || true)

        printf '%s\n' "$PLAN" | while IFS= read -r line; do
            case "$line" in
                "DEL "*)
                    KEY="${line#DEL }"
                    if aws s3api delete-object --bucket "$R2_BUCKET_NAME" --key "$KEY" --endpoint-url "$AWS_ENDPOINT_URL" >/dev/null 2>&1; then
                        echo "🧹 R2 rotation: deleted $KEY"
                    else
                        echo "⚠️  R2 rotation: cannot delete $KEY"
                    fi
                    ;;
            esac
        done
    fi
else
    echo "⚠️  R2 rotation skipped (list-objects failed): $LISTING"
    ROTATION_STATE="list_failed"
fi

TOTAL_MB=$(( ${R2_TOTAL_BYTES:-0} / 1024 / 1024 ))

# 6. Verdict — un succès ne se déclare pas sans preuve
# ---------------------------------------------------
if [ "$ROTATION_STATE" != "ok" ]; then
    send_god_notif "[Backup] Réussi (rotation à vérifier)" "Le dump chiffré ($ENC_MB Mo) est sur R2 et vérifié. La rotation n'a pas pu être calculée — vérifier les droits du token R2 (suppression)." "BACKUP" "true" "{ \"filename\": \"$FILENAME_ENC\", \"container\": \"$DB_CONTAINER\", \"bytes\": $ENC_BYTES, \"rotation\": \"$ROTATION_STATE\" }"
elif [ "${R2_TOTAL_BYTES:-0}" -gt "$R2_MAX_BYTES" ]; then
    echo "❌ R2 budget exceeded: ${TOTAL_MB} Mo > ${BACKUP_R2_MAX_MB} Mo"
    send_god_notif "[Backup] Budget R2 dépassé" "Le dump ($ENC_MB Mo) est en sécurité, mais le bucket pèse ${TOTAL_MB} Mo pour un plafond de ${BACKUP_R2_MAX_MB} Mo : un seul dump dépasse le budget, la rétention ne peut pas le résorber. Augmenter BACKUP_R2_MAX_MB ou réduire la fréquence." "BACKUP" "false" "{ \"filename\": \"$FILENAME_ENC\", \"r2_total_mb\": $TOTAL_MB, \"max_mb\": $BACKUP_R2_MAX_MB, \"budget\": \"exceeded\" }"
    exit 1
else
    echo "✅ Upload successful! R2 total: ${TOTAL_MB} Mo / ${BACKUP_R2_MAX_MB} Mo (${R2_PRUNED} objet(s) purgé(s))"
    send_god_notif "[Backup] Réussi" "Sauvegarde chiffrée ($DB_CONTAINER, $ENC_MB Mo) transférée et vérifiée sur R2. Bucket : ${TOTAL_MB}/${BACKUP_R2_MAX_MB} Mo, $R2_PRUNED ancien(s) purgé(s)." "BACKUP" "true" "{ \"filename\": \"$FILENAME_ENC\", \"container\": \"$DB_CONTAINER\", \"bytes\": $ENC_BYTES, \"r2_total_mb\": $TOTAL_MB, \"max_mb\": $BACKUP_R2_MAX_MB, \"pruned\": $R2_PRUNED }"
fi

echo "[$(date)] 🎉 Backup procedure completed."
