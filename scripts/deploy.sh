#!/bin/bash

# =============================================================================
# 🚀 SigilOS - Script de Déploiement Unifié (2026) — v2
# =============================================================================
# Usage:
#   ./scripts/deploy.sh prod   -> Déploie la PROD (main)
#   ./scripts/deploy.sh beta   -> Déploie la BETA (dev)
#
# Changements v2 :
#   - FIX : la page maintenance reste active pendant TOUTE la durée du
#           déploiement (build + migrations + seed). Caddy n'est recréé qu'à
#           la FIN, donc le flag n'est plus perdu au moment du recreate.
#   - `prisma db push` RETIRÉ de la PROD (réservé au beta/dev). En prod,
#           seule `migrate deploy` est autorisée — db push peut désynchroniser
#           le schéma BDD de façon irréversible.
#   - Build en mode silencieux (docker compose build -q) : seuls les
#           erreurs et le résumé final sont affichés.
#   - `--wait` sur le up : attend que les conteneurs soient "healthy" avant
#           de continuer (nécessite healthcheck dans docker-compose.prod.yml).
#   - Vérification de santé POST-déploiement via https://…/api/health
#   - Seeding conditionnel : le seed de données de jeu n'est lancé QUE si le
#           hash de prisma/seed-data/game-data.json a changé depuis le dernier
#           déploiement (SEED_ONLY_ON_CHANGE). Le hash est stocké dans
#           .deploy-seed-hash.<target>.
# =============================================================================

# Couleurs + helpers (même style que deploy-cd.sh)
if [[ -t 1 ]]; then
    C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
    C_RED=$'\033[31m';  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
    C_CYAN=$'\033[36m'
else
    C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_CYAN=""
fi
info() { printf "${C_CYAN}%s${C_RESET}\n" "$*"; }
ok()   { printf "${C_GREEN}✓ %s${C_RESET}\n" "$*"; }
warn() { printf "${C_YELLOW}⚠  %s${C_RESET}\n" "$*"; }
err()  { printf "${C_RED}✗ %s${C_RESET}\n" "$*" >&2; }
dim()  { printf "${C_DIM}%s${C_RESET}\n" "$*"; }

TARGET=$1

if [ "$TARGET" != "beta" ] && [ "$TARGET" != "prod" ]; then
    echo "Usage: ./scripts/deploy.sh {beta|prod}"
    echo "  beta  -> Déploie la BETA (branche dev)"
    echo "  prod  -> Déploie la PRODUCTION (branche main)"
    exit 1
fi

# Choix du fichier d'environnement
ENV_FILE=".env.prod"
[ "$TARGET" == "beta" ] && ENV_FILE=".env.beta"

info "🚀 Démarrage du déploiement : $TARGET ($ENV_FILE)"

# 1. On s'assure d'être dans le bon dossier
cd "$(dirname "$0")/.."

# 2. Mise à jour du code
info "📦 Récupération du code..."
if [ -d "public/uploads/guides" ]; then
    dim "🧹 Nettoyage temporaire des guides pour éviter les conflits de pull..."
    rm -rf public/uploads/guides
fi
git pull origin "$(git rev-parse --abbrev-ref HEAD)"

# 3. Mise à jour de l'infrastructure de monitoring (silencieux)
info "📊 Mise à jour de l'infrastructure de monitoring..."
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" pull -q prometheus grafana node-exporter cadvisor postgres-exporter
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d prometheus grafana node-exporter cadvisor postgres-exporter

# -----------------------------------------------------------------------------
# 🔁 Fonction : seeding conditionnel des données de jeu
# Ne seed QUE si le hash de game-data.json a changé (ou si SEED_ALWAYS=1).
# -----------------------------------------------------------------------------
run_conditional_seed() {
    local APP_SERVICE=$1
    local HASH_FILE=".deploy-seed-hash.${TARGET}"
    local SEED_FILE="prisma/seed-data/game-data.json"

    if [ ! -f "$SEED_FILE" ]; then
        warn "$SEED_FILE introuvable — seed ignoré."
        return
    fi

    local CURRENT_HASH
    CURRENT_HASH="$(sha256sum "$SEED_FILE" | awk '{print $1}')"
    local PREV_HASH=""
    [ -f "$HASH_FILE" ] && PREV_HASH="$(cat "$HASH_FILE")"

    if [ "$SEED_ALWAYS" == "1" ] || [ "$CURRENT_HASH" != "$PREV_HASH" ]; then
        info "🌱 Seeding des données de jeu ${TARGET^^} (données modifiées)..."
        sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec "$APP_SERVICE" npm run seed:game-data:prod
        echo "$CURRENT_HASH" > "$HASH_FILE"
        ok "Seed terminé."
    else
        dim "⏭️  Seeding ignoré (game-data.json inchangé depuis le dernier déploiement)."
    fi

    # Documentation synchronization
    info "📚 Synchronisation de la documentation ${TARGET^^}..."
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec "$APP_SERVICE" npm run seed:docs:prod || warn "Seed docs ignoré ou non-critique"
    ok "Documentation à jour."
}

# -----------------------------------------------------------------------------
# 🔖 Fonction : tagger les images avec le SHA git + garder les 5 dernières
# (Permet le rollback en 1 commande via scripts/rollback.sh)
# -----------------------------------------------------------------------------
tag_images_with_sha() {
    local SHA
    SHA="$(git rev-parse --short HEAD)"
    local SUFFIX=$1  # ex: "beta" ou "prod"
    local IMAGES=("app" "worker" "ws" "discord-bot")
    local KEEP=5

    info "🔖 Tagging des images avec le SHA git ($SHA)..."
    for NAME in "${IMAGES[@]}"; do
        local IMG="sigilos-${NAME}-${SUFFIX}"
        sudo docker tag "$IMG:latest" "$IMG:$SHA" 2>/dev/null || true
    done

    # Nettoyage : ne garder que les 5 tags les plus récents (par image)
    for NAME in "${IMAGES[@]}"; do
        local IMG="sigilos-${NAME}-${SUFFIX}"
        # Liste les tags SHA (hors latest), trie par date de création desc, vire les KEEP premiers
        local OLD
        OLD="$(sudo docker images --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' "$IMG" \
            | grep -v ':latest' \
            | sort -k2 -r \
            | tail -n +$((KEEP + 1)) \
            | awk '{print $1}')"
        for TAG in $OLD; do
            sudo docker rmi "$TAG" 2>/dev/null || true
        done
    done
    echo "✅ Images taggées (SHA $SHA) — les $KEEP dernières conservées."
}

# 4. Déploiement selon l'environnement
# =============================================================================
# 🟡 BÊTA
# =============================================================================
if [ "$TARGET" == "beta" ]; then
    CADDY_CONTAINER="sigilos-gateway"

    echo ""
    info "🛠️ Activation de la page maintenance BETA..."
    sudo docker exec "$CADDY_CONTAINER" touch /srv/maintenance-beta-on 2>/dev/null || true

    echo ""
    info "🧪 Construction BÊTA (mode silencieux — erreurs uniquement)..."
    BUILD_LOG="$(mktemp)"
    if ! sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" build -q app-beta worker-beta ws-beta discord-bot-beta >"$BUILD_LOG" 2>&1; then
        err "❌ Build échoué. Dernières lignes :"
        tail -40 "$BUILD_LOG"
        rm -f "$BUILD_LOG"
        # On relève la maintenance pour ne pas laisser la beta down
        sudo docker exec "$CADDY_CONTAINER" rm -f /srv/maintenance-beta-on 2>/dev/null || true
        exit 1
    fi
    rm -f "$BUILD_LOG"
    ok "Build terminé."

    tag_images_with_sha beta

    info "Mise à jour des conteneurs BÊTA (attente healthcheck)..."
    # --wait : ne passe à la suite que quand les services avec healthcheck sont healthy
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --no-build --wait app-beta worker-beta ws-beta discord-bot-beta

    info "📂 Migration des fichiers vers Private Storage BÊTA..."
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-beta npm run migrate:uploads

    info "🧹 Synchronisation des migrations BÊTA..."
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-beta npx --yes prisma@7.9.1 migrate deploy
    # Le `db push` reste en beta pour itérer vite sur le schéma (dev-like)
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-beta npx --yes prisma@7.9.1 db push

    run_conditional_seed app-beta

    # Caddy recréé à la FIN avec la nouvelle config.
    # Pendant build + migrations, l'ANCIEN Caddy sert la maintenance (flag actif).
    # Après le recreate, Caddy route vers les nouveaux conteneurs (déjà prêts).
    info "🔄 Recréation du proxy Caddy (nouvelle config)..."
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --force-recreate --no-deps caddy

    ok "✅ Désactivation de la page maintenance BETA..."
    sudo docker exec "$CADDY_CONTAINER" rm -f /srv/maintenance-beta-on 2>/dev/null || true

# =============================================================================
# 🔴 PRODUCTION
# =============================================================================
else
    echo ""
    info "🏰 Construction PRODUCTION (mode silencieux)..."
    BUILD_LOG="$(mktemp)"
    if ! sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" build -q app-prod worker-prod ws-prod discord-bot-prod >"$BUILD_LOG" 2>&1; then
        err "❌ Build échoué. Dernières lignes :"
        tail -40 "$BUILD_LOG"
        rm -f "$BUILD_LOG"
        exit 1
    fi
    rm -f "$BUILD_LOG"
    ok "Build terminé."

    tag_images_with_sha prod

    info "Mise à jour des conteneurs PRODUCTION (attente healthcheck)..."
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --no-build --wait app-prod worker-prod ws-prod discord-bot-prod

    info "📂 Migration des fichiers vers Private Storage PROD..."
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-prod npm run migrate:uploads

    info "🧹 Synchronisation des migrations PRODUCTION..."
    sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec app-prod npx --yes prisma@7.9.1 migrate deploy
    # 🛑 `prisma db push` est volontairement ABSENT en prod.
    # Seule `migrate deploy` est autorisée sur une base de production :
    # db push peut désynchroniser le schéma et les migrations de façon
    # irréversible (perte de données, divergence avec l'historique).

    run_conditional_seed app-prod
fi

# 5. Vérification de santé post-déploiement
echo ""
info "🔎 Vérification de la santé post-déploiement..."
if [ "$TARGET" == "beta" ]; then
    HEALTH_URL="https://beta.sigilos.fr/api/health"
else
    HEALTH_URL="https://sigilos.fr/api/health"
fi

HEALTH_HTTP="$(curl -fsS -m 20 -w '\n%{http_code}' "$HEALTH_URL" 2>/dev/null)"
if [ $? -eq 0 ]; then
    HTTP_CODE="$(echo "$HEALTH_HTTP" | tail -1)"
    BODY="$(echo "$HEALTH_HTTP" | head -n -1)"
    ok "$HEALTH_URL → HTTP $HTTP_CODE"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    err "❌ Santé KO : $HEALTH_URL ne répond pas."
    echo "   ⚠️  Les conteneurs viennent d'être mis à jour — à vérifier manuellement."
fi

echo ""
ok "✅ Déploiement $TARGET terminé."

# 6. État des conteneurs
sudo docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" ps