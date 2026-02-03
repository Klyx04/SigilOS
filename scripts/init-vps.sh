#!/bin/bash
set -e

# =============================================================================
# 🚀 SigilOS - Master VPS Initializer
# =============================================================================
# Ce script prépare l'intégralité de la machine et lance la stack Docker.
# À lancer sur le VPS après avoir configuré les clés SSH.

echo "🌟 Bienvenue dans l'initialiseur SigilOS 2026 🌟"

# 1. Sécurisation et Pré-requis
echo "--- 1/3 SÉCURISATION & OUTILS ---"

# Install basics & Security Updates
sudo apt-get update && sudo apt-get install -y unzip gnupg curl unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades # Activer les mises à jour de sécurité auto

# AWS CLI v2 (for R2 Backups)
if ! command -v aws &> /dev/null; then
    echo "📦 Installation AWS CLI v2..."
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
fi

chmod +x ./scripts/secure_vps.sh
sudo ./scripts/secure_vps.sh

# 2. Préparation des répertoires de stockage
echo "--- 2/3 STRUCTURE ---"
mkdir -p public/uploads/achievements
mkdir -p public/uploads/ocr-debug
mkdir -p monitoring/prometheus
mkdir -p logs/caddy
mkdir -p backups/db   # Ajouté pour le nouveau système de backup

# Fix permissions
sudo chown -R 1001:1001 public/uploads

# 3. Lancement de la Stack
echo "--- 3/3 DÉPLOIEMENT ---"
if [ ! -f .env.prod ] && [ ! -f .env.beta ]; then
    echo "⚠️  Fichiers d'environnement absents (.env.prod ou .env.beta)."
    echo "❌ Veuillez les configurer sur le VPS avant de continuer."
    exit 1
fi

echo "🚀 Lancement du déploiement via le script de gestion..."
chmod +x ./scripts/deploy.sh
./scripts/deploy.sh prod # Par défaut on lance la prod à l'init

echo "✅ SigilOS est maintenant initialisé !"
echo "📊 Monitoring : https://ton-domaine.com (via Caddy/Grafana)"
