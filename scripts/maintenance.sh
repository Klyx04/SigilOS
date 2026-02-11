#!/bin/bash

# maintenance.sh - Le concierge haute-performance de SigilOS (2026)
# Ce script nettoie les ressources inutilisées et alerte en cas de saturation.

# Configuration des alertes (Récupère le Webhook Discord)
DISCORD_WEBHOOK_URL=$(grep DISCORD_ADMIN_WEBHOOK .env.prod | cut -d '=' -f2)

send_alert() {
    local message=$1
    if [ ! -z "$DISCORD_WEBHOOK_URL" ]; then
        curl -X POST -H "Content-Type: application/json" -d "{\"content\": \"🚨 **[SigilOS Infra]** $message\"}" "$DISCORD_WEBHOOK_URL"
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

# Supprimer TOUT le build cache (pas juste >48h)
# Build cache se reconstruit automatiquement au prochain deploy
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

echo "✨ VPS purifié et monitoré ! Espace libre : $(df -h / | tail -1 | awk '{print $4}')"
