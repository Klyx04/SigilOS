#!/bin/bash

# =============================================================================
# 🚀 SigilOS - Script de Déploiement CI/CD (2026) — v2
# =============================================================================
# Usage:
#   ./scripts/deploy-cd.sh list beta        -> Liste les versions (SHA) dispo
#   ./scripts/deploy-cd.sh list prod
#   ./scripts/deploy-cd.sh beta <sha>       -> Déploie la version <sha> en beta
#   ./scripts/deploy-cd.sh prod <sha>       -> Déploie la version <sha> en prod
#   ./scripts/deploy-cd.sh beta             -> Déploie latest en beta
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
#   - GHCR_TOKEN : token GHCR avec read:packages (sur le VPS).
#     À définir une fois : export GHCR_TOKEN=...
#   - GitHub user : GHCR_USER (défaut : klyx04, en minuscules comme GHCR).
# ─────────────────────────────────────────────────────────────

COMMAND=$1

if [ "$COMMAND" != "list" ] && [ "$COMMAND" != "beta" ] && [ "$COMMAND" != "prod" ]; then
    echo "Usage: ./scripts/deploy-cd.sh {list|beta|prod} [sha]"
    echo "  list beta|prod        -> Liste les versions disponibles"
    echo "  beta|prod <sha>       -> Déploie la version <sha>"
    echo "  beta|prod             -> Déploie latest"
    exit 1
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
# GHCR impose des noms de repo en minuscules → on force klyx04
GHCR_USER="${GHCR_USER:-klyx04}"
GHCR_USER_LOWER="${GHCR_USER,,}"
GHCR_REG="ghcr.io/${GHCR_USER_LOWER}"
GHCR_TOKEN="${GHCR_TOKEN:?❌ GHCR_TOKEN non défini. Exportez-le : export GHCR_TOKEN=<token read:packages>}"

cd "$(dirname "$0")/.."

# -----------------------------------------------------------------------------
# 📋 ACTION : list — affiche les versions disponibles
# -----------------------------------------------------------------------------
if [ "$COMMAND" == "list" ]; then
    TARGET=$2
    if [ "$TARGET" != "beta" ] && [ "$TARGET" != "prod" ]; then
        echo "Usage: ./scripts/deploy-cd.sh list {beta|prod}"
        exit 1
    fi
    echo "📋 Versions disponibles pour $TARGET (sur $GHCR_REG) :"
    echo ""
    for NAME in app worker ws discord-bot; do
        echo "── ${GHCR_REG}/sigilos-${NAME}-${TARGET} ──"
        sudo docker buildx imagetools inspect "${GHCR_REG}/sigilos-${NAME}-${TARGET}:latest" 2>/dev/null \
            || sudo docker manifest inspect "${GHCR_REG}/sigilos-${NAME}-${TARGET}:latest" 2>/dev/null \
            || echo "  (pas d'image trouvée — le build GHCR a-t-il tourné ?)"
    done
    exit 0
fi

# -----------------------------------------------------------------------------
# 🔄 ACTION : rollback/deploy — revenir à une version <sha>
# -----------------------------------------------------------------------------
TARGET=$COMMAND
SHA=${2:-latest}

ENV_FILE=".env.prod"
[ "$TARGET" == "beta" ] && ENV_FILE=".env.beta"

echo "📦 Login GHCR en tant que $GHCR_USER_LOWER..."
echo "$GHCR_TOKEN" | sudo docker login ghcr.io -u "$GHCR_USER_LOWER" --password-stdin

# Pull + retag des 4 images pour <sha>
echo "📥 Pull des images $GHCR_REG (tag: $SHA)..."
for NAME in app worker ws discord-bot; do
    IMG="${GHCR_REG}/sigilos-${NAME}-${TARGET}"
    echo "  ↪ ${IMG}:${SHA}"
    sudo docker pull "${IMG}:${SHA}" || {
        echo "❌ Image ${IMG}:${SHA} introuvable sur GHCR."
        echo "   Vérifiez que le workflow GitHub a bien tourné (onglet Actions) pour ce SHA."
        exit 1
    }
    # Retagge en :latest local (le compose utilise :latest avec --no-build)
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