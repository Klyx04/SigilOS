#!/bin/bash

# maintenance.sh - Le concierge haute-performance de SigilOS (2026)
# Ce script nettoie les ressources inutilisées et alerte en cas de saturation.

# 1. Config & Context
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 🛡️ SAFER ENV LOADING
load_env() {
    local env_file=$1
    if [ -f "$env_file" ]; then
        echo "[Config] Loading $env_file"
        set -a
        source "$env_file"
        set +a
    fi
}

# Environnement cible : on déduit de GOD_NOTIFY_BASE/NEXT_PUBLIC_APP_URL (défaut beta = cas courant).
TARGET_BASE="${GOD_NOTIFY_BASE:-${NEXT_PUBLIC_APP_URL:-}}"
if [ -n "$TARGET_BASE" ] && [[ "$TARGET_BASE" == *"sigilos.fr"* ]] && [[ "$TARGET_BASE" != *"beta."* ]]; then
    ENV_FILE=".env.prod"
    FALLBACK_URL="https://sigilos.fr"
else
    ENV_FILE=".env.beta"
    FALLBACK_URL="https://beta.sigilos.fr"
fi
load_env "$ROOT_DIR/$ENV_FILE"

# Nova API God Notify (Cloudflare proxy URL or internal if app is up)
# → priorité à GOD_NOTIFY_BASE (surcharge par env), sinon NEXT_PUBLIC_APP_URL, sinon FALLBACK_URL.
GOD_NOTIFY_BASE="${GOD_NOTIFY_BASE:-${NEXT_PUBLIC_APP_URL:-$FALLBACK_URL}}"
if [[ "$GOD_NOTIFY_BASE" == *"localhost"* ]]; then
    GOD_NOTIFY_BASE="$FALLBACK_URL"
fi
export GOD_NOTIFY_URL="$GOD_NOTIFY_BASE/api/god/notify"

# Fallback for discord webhook if not set globally
DISCORD_WEBHOOK_URL="${DISCORD_ADMIN_WEBHOOK:-}"

send_alert() {
    local message=$1
    if [ ! -z "$DISCORD_WEBHOOK_URL" ]; then
        curl -X POST -H "Content-Type: application/json" -d "{\"content\": \"🚨 **[SigilOS Infra]** $message\"}" "$DISCORD_WEBHOOK_URL"
    fi
}

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

    local response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$GOD_NOTIFY_URL" \
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
        echo "❌ Notification failed (HTTP $response). Check your .env CRON_SECRET and GOD_NOTIFY_URL ($GOD_NOTIFY_URL)."
    fi
}

echo "--------------------------------------------------"
echo "📅 Date : $(date '+%Y-%m-%d %H:%M:%S')"
echo "🧹 Purification du VPS en cours..."

# 1. Nettoyage Docker (Stockage SSD Long Terme)
echo "📦 Nettoyage Docker..."

# ⚠️ `docker image prune -a` supprimerait aussi les images taggées par SHA
# (sigilos-*-<env>:<sha>) utilisées pour le ROLLBACK (5 dernières versions).
# On préserve donc ces images : on ne nettoie que les images "dangling"
# (sans tag) et on laisse deploy.sh/deploy-cd.sh gérer la rotation des SHA.
# Le prune des images dangling + build cache libère déjà l'essentiel du disque.
docker image prune --force
docker builder prune -a --force

# Supprimer volumes orphelins (inchangé, déjà OK)
docker volume prune --force

# 2. Nettoyage Système (APT & Logs)
echo "📟 Nettoyage Système..."
# ⚠️ En cron, `sudo` ne peut PAS demander de mot de passe (pas de TTY) → on passe `-n` pour ne JAMAIS bloquer.
# Requiert un droit sudo NOPASSWD pour sigiladmin (visudo). Sinon on saute (non critique) au lieu de pendre.
if sudo -n apt-get update -q 2>/dev/null; then
    sudo -n apt-get autoremove -y 2>/dev/null || true
    sudo -n apt-get autoclean 2>/dev/null || true
    sudo -n journalctl --vacuum-time=7d 2>/dev/null || true
else
    echo "⚠️  sudo non interactif indisponible (NOPASSWD requis). Étapes APT/Logs système sautées."
fi

# 3. Rotation des Logs Locaux (SigilOS)
echo "📜 Rotation des logs locaux..."
LOG_DIR="$(dirname "$0")/../logs"
find "$LOG_DIR" -name "*.log" -size +10M -type f -exec mv {} {}.old \;
find "$LOG_DIR" -name "*.old" -mtime +7 -delete

# Rotation simple pour backup.log (Garder les 2000 dernières lignes)
if [ -f "$LOG_DIR/backup.log" ]; then
    tail -n 2000 "$LOG_DIR/backup.log" > "$LOG_DIR/backup.log.tmp" && mv "$LOG_DIR/backup.log.tmp" "$LOG_DIR/backup.log"
fi

# 4. Vérification de l'espace disque
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    echo "⚠️ Alerte : Disque saturé à $DISK_USAGE%"
    send_alert "Attention ! L'espace disque du VPS est saturé à **$DISK_USAGE%**. Un nettoyage manuel ou un agrandissement du disque est recommandé."
fi

# 5. Nettoyage de la base de données (Janitor)
JANITOR_OK=1  # 0 = succès, 1 = échec (défaut échec)
echo "🧹 Janitor de la base de données (GDPR + Logs)..."

# Détection du conteneur app de l'ENVIRONNEMENT CIBLÉ (sigilos-prod / sigilos-beta)
# → évite de viser le mauvais env quand prod ET beta tournent en parallèle (fin du head -n 1 ambigu).
TARGET_SUFFIX="beta"
if [ "$ENV_FILE" = ".env.prod" ]; then
    TARGET_SUFFIX="prod"
fi
CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep -x "sigilos-${TARGET_SUFFIX}" | head -n 1)

if [ -z "$CONTAINER_NAME" ]; then
    echo "❌ Erreur : Impossible de trouver un conteneur SigilOS app actif."
    send_alert "Maintenance échouée : Conteneur app introuvable."
else
    echo "🚀 Exécution du Janitor dans : $CONTAINER_NAME"
    # ⚠️ Le .ts requiert @prisma/adapter-pg (+ pg), ABSENTS de l'image standalone → `tsx` échoue.
    # On exécute donc le .js (bundleé, n'utilise que @prisma/client) en priorité = voie fiable en cron.
    docker exec "$CONTAINER_NAME" node scripts/database-janitor.js --execute 2>&1 | tee -a "$LOG_DIR/janitor.log"
    JANITOR_EXIT=${PIPESTATUS[0]}
    if [ "$JANITOR_EXIT" -ne 0 ]; then
        echo "⚠️  node .js a échoué, tentative via tsx (si @prisma/adapter-pg est présent)..."
        docker exec "$CONTAINER_NAME" npx tsx scripts/database-janitor.ts --execute 2>&1 | tee -a "$LOG_DIR/janitor.log"
        JANITOR_EXIT=${PIPESTATUS[0]}
    fi
    JANITOR_OK=$([ "$JANITOR_EXIT" -eq 0 ] && echo 0 || echo 1)
fi

# 6. Sync des départs Discord (Filet de sécurité bot Gateway)
# Rattrape les départs/kicks/bans manqués par le bot Discord
# si celui-ci était down ou redémarrait au moment de l'event.
# ──────────────────────────────────────────────────────────────
# Pour une détection plus rapide (recommandé : toutes les 30 min),
# ajouter cette ligne dans le crontab du VPS (crontab -e) :
#   */30 * * * * curl -s -H "x-cron-secret: $CRON_SECRET" "${APP_URL}/api/cron/sync-members" > /dev/null 2>&1
# ──────────────────────────────────────────────────────────────
echo "🔄 Sync des départs Discord..."
APP_URL="${NEXT_PUBLIC_APP_URL:-$FALLBACK_URL}"
if [ -n "$CRON_SECRET" ] && [ -n "$APP_URL" ]; then
    SYNC_RESPONSE=$(curl -s -o /tmp/sync-members-response.json -w "%{http_code}" \
        -H "x-cron-secret: $CRON_SECRET" \
        "$APP_URL/api/cron/sync-members")
    if [ "$SYNC_RESPONSE" -eq 200 ]; then
        ARCHIVED=$(cat /tmp/sync-members-response.json | grep -o '"totalArchived":[0-9]*' | grep -o '[0-9]*' || echo "?")
        echo "✅ Sync membres terminé — $ARCHIVED profil(s) archivé(s)"
    else
        echo "⚠️  Sync membres : HTTP $SYNC_RESPONSE (non bloquant)"
    fi
else
    echo "⚠️  Sync membres ignoré : CRON_SECRET ou APP_URL manquant"
fi

# 6b. Rappel automatique des prêts non clos (chantier #71)
# Envoyé avec la maintenance quotidienne → aucun créneau dédié à ajouter.
# (Idempotent via lastReminderAt : max 1 rappel / 24h par prêt.)
if [ -n "$CRON_SECRET" ] && [ -n "$APP_URL" ]; then
    REMINDER_RESPONSE=$(curl -s -o /tmp/loan-reminders-response.json -w "%{http_code}" \
        -H "x-cron-secret: $CRON_SECRET" \
        "$APP_URL/api/cron/loan-reminders")
    if [ "$REMINDER_RESPONSE" -eq 200 ]; then
        REMINDED=$(cat /tmp/loan-reminders-response.json | grep -o '"reminded":[0-9]*' | grep -o '[0-9]*' || echo "?")
        echo "✅ Rappels prêts envoyés — $REMINDED prêt(s) relancé(s)"
    else
        echo "⚠️  Rappels prêts : HTTP $REMINDER_RESPONSE (non bloquant)"
    fi
else
    echo "⚠️  Rappels prêts ignoré : CRON_SECRET ou APP_URL manquant"
fi

# 6c. Relance & Purge des posts inactifs DJ / Quêtes / Songes (chantier #107)
# Règle 7 > 15 > 20 > Fini (3 rappels progressifs puis clôture + suppression Discord)
if [ -n "$CRON_SECRET" ] && [ -n "$APP_URL" ]; then
    INACTIVE_RESPONSE=$(curl -s -o /tmp/inactive-posts-response.json -w "%{http_code}" \
        -H "x-cron-secret: $CRON_SECRET" \
        "$APP_URL/api/cron/cleanup-inactive-posts")
    if [ "$INACTIVE_RESPONSE" -eq 200 ]; then
        echo "✅ Posts inactifs traités avec succès (J+7, J+15, J+20, Purge J+21)"
    else
        echo "⚠️  Posts inactifs : HTTP $INACTIVE_RESPONSE (non bloquant)"
    fi
else
    echo "⚠️  Posts inactifs ignoré : CRON_SECRET ou APP_URL manquant"
fi

# 6d. Clôture auto des sondages expirés / « sans date » de plus de 30 jours
# (cron close-old-polls — plafond durée sondage : 30 jours max)
if [ -n "$CRON_SECRET" ] && [ -n "$APP_URL" ]; then
    POLLS_RESPONSE=$(curl -s -o /tmp/polls-response.json -w "%{http_code}" \
        -H "x-cron-secret: $CRON_SECRET" \
        "$APP_URL/api/cron/close-old-polls")
    if [ "$POLLS_RESPONSE" -eq 200 ]; then
        echo "✅ Sondages expirés clôturés automatiquement"
    else
        echo "⚠️  Sondages : HTTP $POLLS_RESPONSE (non bloquant)"
    fi
else
    echo "⚠️  Sondages ignoré : CRON_SECRET ou APP_URL manquant"
fi

# 7. Nettoyage cache proxy-image (images Ganymède / Imgur / DofusDB)
# Supprime les fichiers de plus de 90 jours (TTL identique à la logique Node)
echo "🖼️  Nettoyage cache proxy-image..."
PROXY_CACHE_DIR="$ROOT_DIR/public/uploads/proxy-cache"
if [ -d "$PROXY_CACHE_DIR" ]; then
    BEFORE_SIZE=$(du -sh "$PROXY_CACHE_DIR" 2>/dev/null | cut -f1 || echo "?")
    find "$PROXY_CACHE_DIR" -type f -mtime +90 -delete 2>/dev/null || true
    AFTER_SIZE=$(du -sh "$PROXY_CACHE_DIR" 2>/dev/null | cut -f1 || echo "?")
    echo "✅ Cache proxy-image purgé : $BEFORE_SIZE → $AFTER_SIZE"
else
    echo "ℹ️  Cache proxy-image absent (pas encore créé)"
fi

# 8. Audit Final
echo "🩺 Lancement de l'audit de santé..."
bash "$(dirname "$0")/audit.sh"

echo "✨ VPS purifié et monitoré ! Espace libre : $(df -h / | tail -1 | awk '{print $4}')"
FREE_SPACE=$(df -h / | tail -1 | awk '{print $4}')
# Statut final basé sur le Janitor (JANITOR_OK=0 → succès) : échec → ligne rouge + ping Discord.
if [ "$JANITOR_OK" -eq 0 ]; then
    send_god_notif "[VPS] Maintenance Réussie" "Le script de purification a terminé son cycle quotidien." "VPS_MAINTENANCE" "true" "{ \"disk_usage\": \"$DISK_USAGE%\", \"free_space\": \"$FREE_SPACE\", \"janitor_ok\": true }"
else
    send_god_notif "[VPS] Maintenance ÉCHOUÉE (Janitor)" "Le Janitor BDD a échoué — voir $LOG_DIR/janitor.log." "VPS_MAINTENANCE" "false" "{ \"disk_usage\": \"$DISK_USAGE%\", \"free_space\": \"$FREE_SPACE\", \"janitor_ok\": false }"
fi
