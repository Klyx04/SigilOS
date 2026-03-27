#!/bin/bash

# maintenance.sh - Le concierge haute-performance de SigilOS (2026)
# Ce script nettoie les ressources inutilisées et alerte en cas de saturation.

# 1. Config & Context
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load env vars safely (Prioritize PROD > BETA > .env)
if [ -f "$ROOT_DIR/.env.prod" ]; then
    echo "[Config] Loading .env.prod"
    export $(grep -v '^#' "$ROOT_DIR/.env.prod" | xargs)
elif [ -f "$ROOT_DIR/.env.beta" ]; then
    echo "[Config] Loading .env.beta"
    export $(grep -v '^#' "$ROOT_DIR/.env.beta" | xargs)
elif [ -f "$ROOT_DIR/.env" ]; then
    echo "[Config] Loading .env"
    export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
fi

# Nova API God Notify (Cloudflare proxy URL or internal if app is up)
# CRITICAL: Define AFTER loading env vars
GOD_NOTIFY_URL="${NEXT_PUBLIC_APP_URL:-https://sigilos.fr}/api/god/notify"

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

echo "--------------------------------------------------"
echo "📅 Date : $(date '+%Y-%m-%d %H:%M:%S')"
echo "🧹 Purification du VPS en cours..."

# 1. Nettoyage Docker AGRESSIF (Stockage SSD Long Terme)
echo "📦 Nettoyage Docker..."

# Supprimer TOUTES les images inutilisées (pas juste >48h)
# Safe: garde uniquement les images des containers actuellement UP
sudo docker image prune -a --force

# Supprimer TOUT le build cache (principal coupable de l'espace disque)
sudo docker builder prune -a --force

# Supprimer volumes orphelins (inchangé, déjà OK)
sudo docker volume prune --force

# 2. Nettoyage Système (APT & Logs)
echo "📟 Nettoyage Système..."
sudo apt-get update -q
sudo apt-get autoremove -y && sudo apt-get autoclean
sudo journalctl --vacuum-time=7d

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
echo "🧹 Janitor de la base de données (GDPR + Logs)..."

# Détection dynamique du conteneur prod en priorité, beta en fallback
CONTAINER_NAME=$(sudo docker ps --format '{{.Names}}' | grep -E "^sigilos-(prod|beta)$" | grep -v "db\|ws\|worker\|discord\|gateway\|exporter\|cadvisor\|prometheus\|grafana\|redis" | head -n 1)

if [ -z "$CONTAINER_NAME" ]; then
    echo "❌ Erreur : Impossible de trouver un conteneur SigilOS app actif."
    send_alert "Maintenance échouée : Conteneur app introuvable."
    send_god_notif "[VPS] Maintenance ÉCHOUÉE" "Impossible de trouver un conteneur app actif pour lancer le Janitor." "VPS_MAINTENANCE" "false" "{ \"error\": \"container_not_found\" }"
else
    echo "🚀 Exécution du Janitor dans : $CONTAINER_NAME"
    # Utilise npx tsx directement (disponible dans l'image Node, pas besoin du .js buildé)
    sudo docker exec "$CONTAINER_NAME" npx tsx scripts/database-janitor.ts --execute 2>&1 | tee -a "$LOG_DIR/janitor.log" || {
        echo "⚠️  tsx non disponible dans le container, tentative via node..."
        sudo docker exec "$CONTAINER_NAME" node scripts/database-janitor.js --execute 2>&1 | tee -a "$LOG_DIR/janitor.log"
    }
fi

# 6. Audit Final
echo "🩺 Lancement de l'audit de santé..."
bash "$(dirname "$0")/audit.sh"

echo "✨ VPS purifié et monitoré ! Espace libre : $(df -h / | tail -1 | awk '{print $4}')"
FREE_SPACE=$(df -h / | tail -1 | awk '{print $4}')
send_god_notif "[VPS] Maintenance Réussie" "Le script de purification a terminé son cycle quotidien." "VPS_MAINTENANCE" "true" "{ \"disk_usage\": \"$DISK_USAGE%\", \"free_space\": \"$FREE_SPACE\" }"
