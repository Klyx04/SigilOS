#!/bin/bash

# =============================================================================
# ⏪ SigilOS - Script de Rollback (2026)
# =============================================================================
# Usage:
#   ./scripts/rollback.sh list beta           -> Liste les versions (SHA) disponibles
#   ./scripts/rollback.sh list prod
#   ./scripts/rollback.sh beta <sha>          -> Revient à la version <sha> en beta
#   ./scripts/rollback.sh prod <sha>          -> Revient à la version <sha> en prod
#
# Prérequis : deploy.sh v2 doit avoir été exécuté au moins une fois pour
#             que les images soient taggées avec le SHA git.
# =============================================================================

ACTION=$1
TARGET=$2
SHA=$3

if [ "$ACTION" != "list" ] && [ "$ACTION" != "beta" ] && [ "$ACTION" != "prod" ]; then
    echo "Usage: ./scripts/rollback.sh {list|beta|prod} [beta|prod] [sha]"
    echo "  list beta|prod           -> Liste les versions disponibles"
    echo "  beta|prod <sha>          -> Revient à la version <sha>"
    exit 1
fi

cd "$(dirname "$0")/.."

ENV_FILE=".env.prod"
[ "$TARGET" == "beta" ] && ENV_FILE=".env.beta"

# -----------------------------------------------------------------------------
# 📋 ACTION : list — affiche les versions disponibles
# -----------------------------------------------------------------------------
if [ "$ACTION" == "list" ]; then
    if [ "$TARGET" != "beta" ] && [ "$TARGET" != "prod" ]; then
        echo "Usage: ./scripts/rollback.sh list {beta|prod}"
        exit 1
    fi
    echo "📋 Versions disponibles pour $TARGET :"
    echo ""
    for NAME in app worker ws discord-bot; do
        echo "── $NAME-$TARGET ──"
        sudo docker images --format '{{.Tag}}  {{.CreatedAt}}' "sigilos-${NAME}-${TARGET}" \
            | grep -v ':latest' \
            | grep -v '<none>' \
            | sort -k2 -r
    done
    exit 0
fi

# -----------------------------------------------------------------------------
# 🔄 ACTION : rollback — revenir à une version <sha>
# -----------------------------------------------------------------------------
if [ -z "$SHA" ]; then
    echo "❌ SHA manquant. Usage: ./scripts/rollback.sh $TARGET <sha>"
    echo "   Voir les SHA dispo : ./scripts/rollback.sh list $TARGET"
    exit 1
fi

# Vérifie que les images taggées existent (toutes les 4)
MISSING=0
for NAME in app worker ws discord-bot; do
    IMG="sigilos-${NAME}-${TARGET}:${SHA}"
    if ! sudo docker image inspect "$IMG" >/dev/null 2>&1; then
        echo "❌ Image introuvable : $IMG"
        MISSING=1
    fi
done

if [ "$MISSING" -eq 1 ]; then
    echo ""
    echo "⚠️  Certaines images pour le SHA $SHA manquent."
    echo "   Vérifiez la liste : ./scripts/rollback.sh list $TARGET"
    exit 1
fi

echo "⏪ Rollback de $TARGET vers le SHA $SHA..."
echo ""

# Recrée les conteneurs avec les images taggées (forcé, sans rebuild)
for NAME in app worker ws discord-bot; do
    IMG="sigilos-${NAME}-${TARGET}:${SHA}"
    echo "  ↪ ${NAME}-${TARGET} -> $IMG"
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --no-build --force-recreate "${NAME}-${TARGET}" >/dev/null 2>&1 || {
        # Fallback : docker compose utilise :latest ; on retagge la version cible vers latest puis on recrée
        sudo docker tag "$IMG" "sigilos-${NAME}-${TARGET}:latest"
        sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --no-build --force-recreate "${NAME}-${TARGET}"
    }
done

# Recrée Caddy pour appliquer le routage (au cas où)
echo "  ↪ recréation de Caddy (proxy)..."
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --force-recreate --no-deps caddy

echo ""
echo "✅ Rollback vers $SHA terminé !"
echo "   Vérifier : ./scripts/rollback.sh list $TARGET"
echo "   Santé : curl https://${TARGET}.sigilos.fr/api/health (ou https://sigilos.fr/api/health pour prod)"