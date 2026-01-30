#!/bin/bash

# =============================================================================
# 🚀 SigilOS - Script de Déploiement Unifié
# =============================================================================
# Usage: 
#   ./deploy.sh prod   -> Déploie la PROD (main)
#   ./deploy.sh beta   -> Déploie la BETA (dev)
#   ./deploy.sh all    -> Déploie TOUT (attention aux ressources)
#   ./deploy.sh monit  -> Déploie le Monitoring uniquement

ENV=$1

if [ -z "$ENV" ]; then
    echo "❌ Usage: ./deploy.sh [prod|beta|all|monit]"
    exit 1
fi

echo "🚀 Démarrage du déploiement pour : $ENV"

# Fonction pour déployer un service spécifique
deploy_service() {
    SERVICE=$1
    echo "🔄 Build & Restart de $SERVICE..."
    docker compose -f docker-compose.prod.yml up -d --build $SERVICE
}

case $ENV in
    "prod")
        echo "🔵 Déploiement PRODUCTION..."
        deploy_service "app-prod"
        deploy_service "caddy"
        ;;
    
    "beta")
        echo "🟡 Déploiement BETA..."
        deploy_service "app-beta"
        deploy_service "caddy"
        ;;

    "monit")
        echo "📊 Déploiement MONITORING..."
        docker compose -f docker-compose.prod.yml up -d --build prometheus grafana caddy
        ;;

    "all")
        echo "🌍 Déploiement COMPLET..."
        docker compose -f docker-compose.prod.yml up -d --build
        ;;
    
    *)
        echo "❌ Environnement inconnu. Utilisez: prod, beta, all, ou monit."
        exit 1
        ;;
esac

echo "✅ Déploiement terminé !"
docker compose -f docker-compose.prod.yml ps
