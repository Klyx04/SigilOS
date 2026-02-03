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

# 1. Nettoyage Docker (Images, cache de build, volumes orphelins)
echo "📦 Nettoyage Docker..."
sudo docker system prune -af --filter "until=48h"
sudo docker builder prune -af --filter "until=48h"
sudo docker volume prune -f

# 2. Nettoyage Système (APT & Logs)
echo "📟 Nettoyage Système..."
sudo apt-get autoremove -y && sudo apt-get autoclean
sudo journalctl --vacuum-time=7d

# 3. Vérification de l'espace disque
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    echo "⚠️ Alerte : Disque saturé à $DISK_USAGE%"
    send_alert "Attention ! L'espace disque du VPS est saturé à **$DISK_USAGE%**. Un nettoyage manuel ou un agrandissement du disque est recommandé."
fi

echo "✨ VPS purifié et monitoré ! Espace libre : $(df -h / | tail -1 | awk '{print $4}')"
