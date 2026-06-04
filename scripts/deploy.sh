#!/bin/bash

# =============================================================================
# 🚀 SigilOS - Script de Déploiement Unifié (2026)
# =============================================================================
# Usage: 
#   ./scripts/deploy.sh prod   -> Déploie la PROD (main)
#   ./scripts/deploy.sh beta   -> Déploie la BETA (dev)
#
# Beta déploiements activent automatiquement la page maintenance
# pendant le rebuild. Les joueurs voient une page stylée au lieu d'un 502.

TARGET=$1

if [ "$TARGET" != "beta" ] && [ "$TARGET" != "prod" ]; then
    echo "❌ Usage: ./scripts/deploy.sh {beta|prod}"
    exit 1
fi

# Choix du fichier d'environnement
ENV_FILE=".env.prod"
if [ "$TARGET" == "beta" ]; then
    ENV_FILE=".env.beta"
fi

echo "🚀 Démarrage du déploiement : $TARGET (via $ENV_FILE)"

# 1. On s'assure d'être dans le bon dossier
cd "$(dirname "$0")/.."

# 2. Mise à jour du code
echo "📦 Récupération du code..."
if [ -d "public/uploads/guides" ]; then
    echo "🧹 Nettoyage temporaire des guides pour éviter les conflits de pull..."
    rm -rf public/uploads/guides
fi
git pull origin $(git rev-parse --abbrev-ref HEAD)

# 3. Mise à jour de l'infrastructure de monitoring (Prometheus, Grafana, etc)
echo "📊 Mise à jour et sécurisation de l'infrastructure de monitoring..."
sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE pull prometheus grafana node-exporter cadvisor postgres-exporter
sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE up -d prometheus grafana node-exporter cadvisor postgres-exporter

# 4. Lancement Docker selon l'environnement
if [ "$TARGET" == "beta" ]; then
    # =========================================================================
    # 🛠️ MAINTENANCE MODE — Automatique pendant le rebuild
    # =========================================================================
    CADDY_CONTAINER="sigilos-gateway"
    
    echo "🛠️ Activation de la page maintenance BETA..."
    sudo docker exec $CADDY_CONTAINER touch /srv/maintenance-beta-on 2>/dev/null || true
    
    # Force Caddy to re-evaluate (config already handles the flag file)
    sleep 1

    echo "🧪 Mise à jour du laboratoire BÊTA..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE up -d --build app-beta ws-beta discord-bot-beta worker-beta --force-recreate caddy

    echo "🔄 Caddy recréé avec le nouveau Caddyfile."
    
    echo "📂 Migration des fichiers vers Private Storage BÊTA..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE exec app-beta npm run migrate:uploads

    echo "🧹 Synchronisation des migrations BÊTA..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE exec app-beta npx prisma migrate deploy
    echo "🌱 Seeding des données de jeu BÊTA..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE exec app-beta npm run seed:game-data:prod
    
    # =========================================================================
    # ✅ MAINTENANCE OFF — Beta is back online
    # =========================================================================
    echo "✅ Désactivation de la page maintenance BETA..."
    sudo docker exec $CADDY_CONTAINER rm -f /srv/maintenance-beta-on 2>/dev/null || true

else
    echo "🏰 Mise à jour de la PRODUCTION..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE up -d --build app-prod ws-prod discord-bot-prod worker-prod

    echo "📂 Migration des fichiers vers Private Storage PROD..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE exec app-prod npm run migrate:uploads

    echo "🧹 Synchronisation des migrations PRODUCTION..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE exec app-prod npx prisma migrate deploy
    echo "🌱 Seeding des données de jeu PRODUCTION..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE exec app-prod npm run seed:game-data:prod
fi

echo "✅ Déploiement $TARGET terminé avec succès !"

# On utilise l'env_file ici aussi pour supprimer les derniers warnings d'affichage
sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE ps
