#!/bin/bash

# =============================================================================
# 🚀 SigilOS - Script de Déploiement Unifié (2026)
# =============================================================================
# Usage: 
#   ./scripts/deploy.sh prod   -> Déploie la PROD (main)
#   ./scripts/deploy.sh beta   -> Déploie la BETA (dev)

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
git pull origin $(git rev-parse --abbrev-ref HEAD)

# 3. Lancement Docker selon l'environnement
if [ "$TARGET" == "beta" ]; then
    echo "🧪 Mise à jour du laboratoire BÊTA..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE up -d --build app-beta discord-bot-beta worker-beta --force-recreate caddy

    echo "🔄 Caddy recréé avec le nouveau Caddyfile."

    echo "🧹 Synchronisation des migrations BÊTA..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE exec app-beta npx prisma migrate deploy
    echo "🌱 Seeding des données de jeu BÊTA..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE exec app-beta npm run seed:game-data:prod
else
    echo "🏰 Mise à jour de la PRODUCTION..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE up -d --build app-prod discord-bot-prod worker-prod
    echo "🧹 Synchronisation des migrations PRODUCTION..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE exec app-prod npx prisma migrate deploy
    echo "🌱 Seeding des données de jeu PRODUCTION..."
    sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE exec app-prod npm run seed:game-data:prod
fi

echo "✅ Déploiement $TARGET terminé avec succès !"

# On utilise l'env_file ici aussi pour supprimer les derniers warnings d'affichage
sudo docker compose -f docker-compose.prod.yml --env-file $ENV_FILE ps
