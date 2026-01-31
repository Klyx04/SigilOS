#!/bin/bash
set -e

# =============================================================================
# 🚀 SigilOS - Master VPS Initializer
# =============================================================================
# Ce script prépare l'intégralité de la machine et lance la stack Docker.
# À lancer sur le VPS après avoir configuré les clés SSH.

echo "🌟 Bienvenue dans l'initialiseur SigilOS 2026 🌟"

# 1. Sécurisation
echo "--- 1/3 SÉCURISATION ---"
chmod +x ./scripts/secure_vps.sh
sudo ./scripts/secure_vps.sh

# 2. Préparation des répertoires de stockage
echo "--- 2/3 STRUCTURE ---"
mkdir -p public/uploads/achievements
mkdir -p public/uploads/ocr-debug
mkdir -p monitoring/prometheus
mkdir -p logs/caddy

# Fix permissions
sudo chown -R 1001:1001 public/uploads

# 3. Lancement de la Stack
echo "--- 3/3 DÉPLOIEMENT ---"
if [ ! -f .env ]; then
    echo "⚠️  Fichier .env absent. Création à partir de .env.example..."
    cp .env.example .env
    echo "❌ Veuillez éditer le fichier .env et relancer le script de déploiement."
    exit 1
fi

echo "🚀 Lancement de Docker Compose (Production)..."
docker compose -f docker-compose.prod.yml up -d

echo "✅ SigilOS est maintenant en ligne !"
echo "📊 Monitoring : https://ton-domaine.com (via Caddy/Grafana)"
