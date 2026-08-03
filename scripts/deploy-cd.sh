#!/bin/bash

# =============================================================================
# 🚀 SigilOS - Script de Déploiement CI/CD (2026) — v2
# =============================================================================
# Usage:
#   ./scripts/deploy-cd.sh list
#   ./scripts/deploy-cd.sh beta <sha>    # déploie la version <sha> en beta
#   ./scripts/deploy-cd.sh prod <sha>    # déploie la version <sha> en prod
#   ./scripts/deploy-cd.sh beta          # déploie latest en beta
#
# Principe :
#   Les images sont buildées sur GitHub Actions et poussées vers GHCR
#   (voir .github/workflows/deploy.yml). Ce script ne fait que :
#     1. se connecter à GHCR
#     2. pull les 4 images (app, worker, ws, discord-bot) taggées <sha>
#     3. les retagger en :latest local (pour utiliser le compose existant)
#     4. `docker compose up -d --no-build`  → AUCUN build sur le VPS
#
# Résultat : déploiement ~30s au lieu de ~5min (~4min de build économisées).
# ─────────────────────────────────────────────────────────────
# Prérequis :
#   - GHCR_TOKEN : token GHCR avec read:packages (sur le VPS, dans le shell
#     ou via le cron). À définir une fois : export GHCR_TOKEN=... 
#   - GitHub user : GHCR_USER (défaut : Klyx04).
# ─────────────────────────────────────────────────────────────

ACTION=$1
TARGET=$2
SHA=${3:-latest}

if [ "$ACTION" == "list" ]; then
    echo "📋 Utilisation :"
    echo "  ./scripts/deploy-cd.sh beta <sha>   (ou prod)"
    echo "  ./scripts/deploy-cd.sh beta         (latest)"
    echo ""
    echo "🔎 Le SHA correspond au commit GitHub. Il est visible dans"
    echo "   l'onglet Actions > run > en bas, ou via l'API GHCR."
    exit 0
fi

if [ "$ACTION" != "beta" ] && [ "$ACTION" != "prod" ]; then
    echo "Usage: ./scripts/deploy-cd.sh {beta|prod} [sha]"
    echo "  beta|prod <sha>   -> déploie la version <sha>"
    echo "  beta|prod         -> déploie latest"
    exit 1
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
ENV_FILE=".env.prod"
[ "$TARGET" == "beta" ] && ENV_FILE=".env.beta"

GHCR_USER="${GHCR_USER:-Klyx04}"
GHCR_REG="ghcr.io/${GHCR_USER}"
GHCR_TOKEN="${GHCR_TOKEN:?❌ GHCR_TOKEN non défini. Exportez-le : export GHCR_TOKEN=<token read:packages>}"

cd "$(dirname "$0")/.."

echo "📦 Login GHCR en tant que $GHCR_USER..."
echo "$GHCR_TOKEN" | sudo docker login ghcr.io -u "$GHCR_USER" --password-stdin

# -----------------------------------------------------------------------------
# Récupération du code (pour .env et compose à jour)
# -----------------------------------------------------------------------------
echo "📦 Récupération du code ($ACTION)..."
sudo git pull origin "$(git rev-parse --abbrev-ref HEAD)"

# -----------------------------------------------------------------------------
# Pull + retag des 4 images pour <sha>
# -----------------------------------------------------------------------------
echo "📥 Pull des images $GHCR_REG (tag: $SHA)..."
for NAME in app worker ws discord-bot; do
    IMG="${GHCR_REG}/sigilos-${NAME}-${TARGET}"
    echo "  ↪ ${IMG}:${SHA}"
    sudo docker pull "${IMG}:${SHA}" || {
        echo "❌ Image ${IMG}:${SHA} introuvable sur GHCR."
        echo "   Vérifiez que le workflow GitHub a bien tourné pour ce SHA."
        exit 1
    }
    # Retagge en :latest local (le compose existant utilise :latest avec --no-build)
    sudo docker tag "${IMG}:${SHA}" "sigilos-${NAME}-${TARGET}:latest"
done

echo ""
echo "🔄 Mise à jour des conteneurs ${TARGET^^} (attente healthcheck)..."
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --no-build --wait app-${TARGET} worker-${TARGET} ws-${TARGET} discord-bot-${TARGET}

echo "📂 Migration des fichiers vers Private Storage ${TARGET^^}..."
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-${TARGET} npm run migrate:uploads

echo "🧹 Synchronisation des migrations ${TARGET^^}..."
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-${TARGET} npx --yes prisma migrate deploy
# db push en beta uniquement (itération rapide), jamais en prod
if [ "$TARGET" == "beta" ]; then
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-${TARGET} npx --yes prisma db push
fi

echo "🌱 Seeding des données de jeu ${TARGET^^}..."
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-${TARGET} npm run seed:game-data:prod

echo ""
echo "✅ Déploiement ${TARGET^^} (SHA $SHA) terminé en mode CD !"
echo "   Vérif santé : curl https://${TARGET}.sigilos.fr/api/health"